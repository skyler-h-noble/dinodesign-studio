// record.ts — "render and record": recording stand-ins for @omni-design/components.
//
// The code → Figma compiler needs to know, for one state of one page, which lib
// component drew each part of the screen and with which props. Reading the JSX
// cannot say that (31% of elements sit under a condition, 40% of text is
// computed), and reading the DOM cannot either (the lib leaves no component
// marker). So the page's own, unmodified code is RUN, with real React, real
// context and real state, and every lib export it imports is swapped for a
// stand-in that renders a marker carrying its export name and props.
//
// ── Why server rendering (react-dom/server), not a DOM ─────────────────────
//
//   - No new dependency: no jsdom, no browser, no test renderer. The app's own
//     react-dom/server is enough, so the app's own React version is the one
//     that runs (omni-r5 is React 18; the studio is 19 — both work).
//   - Deterministic: effects do not run on the server, so nothing fetches, no
//     timer fires, no media query flips mid-render. Same seed in, same tree out.
//   - Props are recorded at the source: each stand-in writes its props into a
//     side table keyed by a render id, and only the id goes into the markup.
//     The markup is parsed back for STRUCTURE only, so no prop goes through a
//     string round trip (numbers stay numbers, booleans stay booleans).
//   - renderToPipeableStream + onAllReady waits for lazy() pages and Suspense,
//     which renderToStaticMarkup would leave as their fallback.
//
// The cost: an app that loads its data in useEffect renders its loading state.
// The bench apps load synchronously; an app that does not needs its data
// seeded (the snapshot spec's job) or the browser path (phase 5).
//
// ── Matching exports by identity ────────────────────────────────────────────
//
// The lib's published build is minified: Button.name is undefined, VStack's is
// "u". So nothing here reads a function's name. The stand-in module is built
// from the REAL module's export table: each export KEY names its stand-in, and
// two keys holding the same value (Body1 and Body, say) are recorded as aliases
// of each other, by identity. Non-component exports (constants, utilities)
// pass through as the real values; hooks that read the real provider's context
// are replaced (useOmniDesign, useHeadingLevel).
//
// ── Lib behaviors the stand-ins copy ────────────────────────────────────────
//
// A stand-in draws nothing itself, so anything the real component decides
// about its CHILDREN must be copied, or the snapshot shows the wrong thing:
//
//   - a closed overlay (Modal, Dialog, Drawer, Popover, Snackbar, Sheet, Menu…)
//     renders nothing — without this the home page drew 8 hidden quick-view
//     modals;
//   - Tabs show only the active TabPanel, and each Tab knows if it is selected;
//   - Section and HeadingLevel raise the heading level, which is what an
//     AutoHeading without a size draws;
//   - Tooltip renders its trigger only.
//
// Keep this list short and tested (code2figma.test.ts). The phase-5 browser
// checker is what catches a behavior that is missing from it.
//
// This module never imports React: the runner hands in the APP's React, so the
// stand-ins and the app share one React instance.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RecordedValue =
  | string | number | boolean | null
  | RecordedValue[]
  | { [k: string]: RecordedValue };

export type RecordedNode =
  | {
    kind: 'lib';
    /** The export name the app imported. */
    name: string;
    /** Other export names that hold the very same value (identity). */
    aliases?: string[];
    props: Record<string, RecordedValue>;
    /** Element-valued props, rendered: startDecorator, endDecorator, icon … */
    slots?: Record<string, RecordedNode[]>;
    children: RecordedNode[];
  }
  | { kind: 'icon'; name: string; props: Record<string, RecordedValue> }
  | { kind: 'html'; tag: string; attrs: Record<string, string | true>; style?: Record<string, string | number>; children: RecordedNode[] }
  | { kind: 'text'; text: string };

export interface RecorderOptions {
  /** Viewport the state is drawn at (useMediaQuery-style hooks read it). */
  viewport?: { width: number; height?: number };
  /** Color mode the provider reports. */
  mode?: 'light' | 'dark';
}

/** Components whose `open` prop decides whether they render at all. */
export const OVERLAYS = new Set([
  'Modal', 'Dialog', 'AlertDialog', 'FormDialog', 'Drawer', 'Popover', 'Snackbar', 'Sheet', 'Menu', 'SpeedDial',
]);

/** Element-valued children of these are rendered; everything else is recorded. */
const SLOT_MARK = 'omni-slot';
const NODE_MARK = 'omni-node';

type ReactLike = {
  createElement: (...a: any[]) => any;
  createContext: (v: any) => any;
  useContext: (c: any) => any;
  isValidElement: (v: any) => boolean;
  forwardRef: (f: any) => any;
  Children: { map: (c: any, f: (x: any, i: number) => any) => any; toArray: (c: any) => any[] };
  cloneElement: (e: any, p: any) => any;
};

interface Entry { name: string; props: Record<string, RecordedValue>; slotNames: string[] }

/** True for a value React can render as a component. */
export function isComponentValue(v: unknown): boolean {
  if (typeof v === 'function') return true;
  if (v && typeof v === 'object' && typeof (v as any).$$typeof === 'symbol') {
    const t = String((v as any).$$typeof);
    return /forward_ref|memo|lazy/.test(t);
  }
  return false;
}

/** Which real exports are components (stand-ins) and which pass through. */
export function classifyExports(real: Record<string, unknown>): { components: string[]; passthrough: string[]; aliases: Record<string, string[]> } {
  const components: string[] = [];
  const passthrough: string[] = [];
  const byValue = new Map<unknown, string[]>();
  for (const key of Object.keys(real).sort()) {
    if (key === 'default' || key === '__esModule') { passthrough.push(key); continue; }
    const v = real[key];
    /* A component is an upper-case export whose value React can render. Hooks
       (useX), helpers (lower-case) and constants (UPPER_CASE objects) pass. */
    const looksComponent = /^[A-Z]/.test(key) && !/^[A-Z0-9_]+$/.test(key) && isComponentValue(v);
    (looksComponent ? components : passthrough).push(key);
    if (looksComponent) {
      const list = byValue.get(v) ?? [];
      list.push(key);
      byValue.set(v, list);
    }
  }
  const aliases: Record<string, string[]> = {};
  for (const names of byValue.values()) {
    if (names.length < 2) continue;
    for (const n of names) aliases[n] = names.filter((x) => x !== n);
  }
  return { components, passthrough, aliases };
}

/**
 * Serialize one prop value. Functions, React elements and component types
 * cannot be drawn; they are recorded as markers so the mapper can say what it
 * saw. Elements are rendered separately, as slots.
 */
function serialize(React: ReactLike, v: unknown, depth = 0): RecordedValue | undefined {
  if (v === undefined) return undefined;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v as RecordedValue;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  if (typeof v === 'function') return { $fn: true };
  if (typeof v === 'symbol' || typeof v === 'bigint') return String(v);
  if (React.isValidElement(v)) return { $element: true };
  if (v instanceof Date) return v.toISOString();
  if (isComponentValue(v)) return { $component: true };
  if (depth > 6) return '[deep]';
  if (Array.isArray(v)) return v.map((x) => serialize(React, x, depth + 1) ?? null);
  if (typeof v === 'object') {
    const o: Record<string, RecordedValue> = {};
    for (const k of Object.keys(v as object)) {
      const s = serialize(React, (v as any)[k], depth + 1);
      if (s !== undefined) o[k] = s;
    }
    return o;
  }
  return String(v);
}

export interface Recorder {
  /** Stand-in for every component export, keyed by export name. */
  standIns: Record<string, unknown>;
  /** Stand-in for one icon (@omni-design/icons/<name>). */
  icon(name: string): unknown;
  /** Hook replacements, keyed by export name. */
  hooks: Record<string, unknown>;
  /** Forget everything recorded (between states). */
  reset(): void;
  /** Parse rendered markup back into the recorded tree. */
  parse(html: string): RecordedNode[];
  /** Alias groups found by identity. */
  aliases: Record<string, string[]>;
}

/**
 * Build the stand-ins for one real lib module.
 *
 * `real` is the module's export table (require('@omni-design/components')).
 */
export function createRecorder(React: ReactLike, real: Record<string, unknown>, opts: RecorderOptions = {}): Recorder {
  const h = React.createElement;
  const registry = new Map<number, Entry>();
  let nextId = 1;
  const { components, aliases } = classifyExports(real);

  const HeadingCtx = React.createContext(1);
  const TabsCtx = React.createContext(null);

  function record(name: string, props: Record<string, any>, extra: Record<string, RecordedValue> = {}): { rid: number; slots: any[] } {
    const rid = nextId++;
    const out: Record<string, RecordedValue> = {};
    const slots: any[] = [];
    const slotNames: string[] = [];
    for (const k of Object.keys(props).sort()) {
      if (k === 'children') continue;
      const v = props[k];
      if (React.isValidElement(v)) {
        slotNames.push(k);
        slots.push(h(SLOT_MARK, { key: `slot-${k}`, 'data-slot': k }, v));
        out[k] = { $slot: k };
        continue;
      }
      const s = serialize(React, v);
      if (s !== undefined) out[k] = s;
    }
    if (typeof props.children === 'function') out.children = { $renderProp: true };
    Object.assign(out, extra);
    registry.set(rid, { name, props: out, slotNames });
    return { rid, slots };
  }

  function marker(name: string, props: Record<string, any>, children: any, extra?: Record<string, RecordedValue>) {
    const { rid, slots } = record(name, props, extra);
    const kids = typeof children === 'function' ? null : children;
    return h(NODE_MARK, { 'data-rid': String(rid) }, ...slots, kids);
  }

  function make(name: string): unknown {
    let C: any;
    if (OVERLAYS.has(name)) {
      C = (props: any) => (props.open === true ? marker(name, props, props.children) : null);
    } else if (name === 'Section' || name === 'HeadingLevel') {
      C = (props: any) => {
        const level = React.useContext(HeadingCtx);
        return h(HeadingCtx.Provider, { value: Math.min(level + 1, 6) }, marker(name, props, props.children));
      };
    } else if (name === 'AutoHeading') {
      C = (props: any) => {
        const level = React.useContext(HeadingCtx);
        return marker(name, props, props.children, { $level: level });
      };
    } else if (name === 'Tabs') {
      C = (props: any) => {
        const value = props.value !== undefined ? props.value : props.defaultValue !== undefined ? props.defaultValue : 0;
        return h(TabsCtx.Provider, { value: { value } }, marker(name, props, props.children));
      };
    } else if (name === 'TabList') {
      C = (props: any) => {
        const kids = React.Children.map(props.children, (c: any, i: number) => (React.isValidElement(c) ? React.cloneElement(c, { $index: i }) : c));
        return marker(name, props, kids);
      };
    } else if (name === 'Tab') {
      C = (props: any) => {
        const ctx = React.useContext(TabsCtx);
        const own = props.value !== undefined ? props.value : props.$index;
        const { $index: _drop, ...rest } = props;
        return marker(name, rest, props.children, { $selected: !!ctx && ctx.value === own });
      };
    } else if (name === 'TabPanel') {
      C = (props: any) => {
        const ctx = React.useContext(TabsCtx);
        if (ctx && ctx.value !== props.value) return null;
        return marker(name, props, props.children);
      };
    } else if (name === 'Tooltip') {
      /* The tip itself is hover-only; the trigger is what the page shows. */
      C = (props: any) => marker(name, props, props.children);
    } else {
      C = (props: any) => marker(name, props, props.children);
    }
    /* forwardRef so an app passing a ref does not warn; the ref is dropped. */
    const F = React.forwardRef((props: any, _ref: any) => C(props));
    F.displayName = `Rec(${name})`;
    return F;
  }

  const standIns: Record<string, unknown> = {};
  for (const name of components) standIns[name] = make(name);

  const iconCache = new Map<string, unknown>();
  function icon(name: string): unknown {
    if (!iconCache.has(name)) {
      const F = React.forwardRef((props: any, _ref: any) => {
        const { rid } = record(`icon:${name}`, props);
        return h(NODE_MARK, { 'data-rid': String(rid) });
      });
      F.displayName = `RecIcon(${name})`;
      iconCache.set(name, F);
    }
    return iconCache.get(name);
  }

  const noop = () => {};
  const hooks: Record<string, unknown> = {
    useOmniDesign: () => ({
      theme: 'Default', style: null, surface: 'Surface', isDark: opts.mode === 'dark', cssStatus: 'ready', cssError: null,
      setTheme: noop, setStyle: noop, setSurface: noop, toggleDarkMode: noop, setDarkMode: noop,
      themes: [], styles: [], surfaces: [], name: null,
    }),
    useHeadingLevel: () => React.useContext(HeadingCtx),
  };
  hooks.useDynoDesign = hooks.useOmniDesign;

  function parse(html: string): RecordedNode[] {
    return toRecorded(parseMarkup(html), registry, aliases);
  }

  return {
    standIns,
    icon,
    hooks,
    aliases,
    reset() { registry.clear(); nextId = 1; },
    parse,
  };
}

// ── Markup → tree ───────────────────────────────────────────────────────────

interface RawEl { tag: string; attrs: Record<string, string | true>; children: Array<RawEl | string> }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|quot|amp|lt|gt|nbsp|#x27);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'quot') return '"';
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'nbsp') return ' ';
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return m;
  });
}

/**
 * A small parser for React's server output — well-formed by construction:
 * every element closed, attributes double-quoted, comments only as text
 * separators and Suspense markers. Comments are dropped; adjacent text joins.
 */
export function parseMarkup(html: string): RawEl {
  const root: RawEl = { tag: '#root', attrs: {}, children: [] };
  const stack: RawEl[] = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[5] !== undefined) {
      const t = unescapeHtml(m[5]);
      const last = top.children[top.children.length - 1];
      if (typeof last === 'string') top.children[top.children.length - 1] = last + t;
      else top.children.push(t);
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      /* Close the nearest open element with this tag. */
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const attrs: Record<string, string | true> = {};
    for (const a of m[3].matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? true : unescapeHtml(a[2]);
    const el: RawEl = { tag, attrs, children: [] };
    top.children.push(el);
    if (!m[4] && !VOID.has(tag)) stack.push(el);
  }
  return root;
}

/** "margin-top:16px;flex:1 1 160px" → { marginTop: 16, flex: '1 1 160px' }. */
export function parseStyle(css: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) continue;
    const key = k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = /^-?\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : /^-?\d+(\.\d+)?$/.test(v) ? parseFloat(v) : v;
  }
  return out;
}

function toRecorded(root: RawEl, registry: Map<number, Entry>, aliases: Record<string, string[]>): RecordedNode[] {
  const conv = (x: RawEl | string): RecordedNode[] => {
    if (typeof x === 'string') return x ? [{ kind: 'text', text: x }] : [];
    if (x.tag === NODE_MARK) {
      const entry = registry.get(Number(x.attrs['data-rid']));
      if (!entry) return x.children.flatMap(conv);
      if (entry.name.startsWith('icon:')) return [{ kind: 'icon', name: entry.name.slice(5), props: entry.props }];
      const slots: Record<string, RecordedNode[]> = {};
      const children: RecordedNode[] = [];
      for (const c of x.children) {
        if (typeof c !== 'string' && c.tag === SLOT_MARK) slots[String(c.attrs['data-slot'])] = c.children.flatMap(conv);
        else children.push(...conv(c));
      }
      const node: RecordedNode = { kind: 'lib', name: entry.name, props: entry.props, children };
      if (Object.keys(slots).length) node.slots = slots;
      if (aliases[entry.name]) node.aliases = aliases[entry.name];
      return [node];
    }
    if (x.tag === SLOT_MARK) return x.children.flatMap(conv);
    const attrs: Record<string, string | true> = {};
    let style: Record<string, string | number> | undefined;
    for (const k of Object.keys(x.attrs).sort()) {
      if (k === 'style') style = parseStyle(String(x.attrs[k]));
      else attrs[k] = x.attrs[k];
    }
    const node: RecordedNode = { kind: 'html', tag: x.tag, attrs, children: x.children.flatMap(conv) };
    if (style && Object.keys(style).length) node.style = style;
    return [node];
  };
  return root.children.flatMap(conv);
}

// ── Viewport shims (useMediaQuery / matchMedia) ─────────────────────────────

/**
 * Does a media query match at this viewport width? Handles the min-width /
 * max-width / orientation / prefers-color-scheme queries apps write; anything
 * else does not match (and is the same answer every run).
 */
export function mediaMatches(query: string, viewport: { width: number; height?: number }, mode: 'light' | 'dark' = 'light'): boolean {
  const height = viewport.height ?? 800;
  return query.split(',').some((part) => {
    const conds = part.toLowerCase().match(/\(([^)]+)\)/g) ?? [];
    if (!conds.length) return /\b(all|screen)\b/.test(part);
    let negate = /^\s*not\b/.test(part);
    const ok = conds.every((c) => {
      const m = /\(\s*([\w-]+)\s*:\s*([^)]+?)\s*\)/.exec(c);
      if (!m) return false;
      const [, feat, raw] = m;
      const px = parseFloat(raw) * (/em$/.test(raw) ? 16 : 1);
      switch (feat) {
        case 'min-width': return viewport.width >= px;
        case 'max-width': return viewport.width <= px;
        case 'min-height': return height >= px;
        case 'max-height': return height <= px;
        case 'orientation': return raw === (viewport.width >= height ? 'landscape' : 'portrait');
        case 'prefers-color-scheme': return raw === mode;
        case 'prefers-reduced-motion': return raw === 'no-preference';
        case 'hover': return raw === 'hover';
        case 'pointer': return raw === 'fine';
        default: return false;
      }
    });
    if (negate) { negate = false; return !ok; }
    return ok;
  });
}
