// mapper.ts — recorded tree (record.ts) → the code → Figma IR (schema.ts).
//
// Every component mapping here is the INVERSE of the Figma → code tables in
// src/utils/aaid/propTables.ts, read from those same tables:
//
//   variant axes         invertVariantTable(VARIANT_TABLES[...])
//   type styles          EXPORT_TO_TEXT_STYLE (checked against TEXT_STYLE_TO_EXPORT)
//   Button variant       splitButtonVariant (the inverse of buttonVariant)
//   icons                iconGlyphFromComponent (the inverse of iconComponentName)
//   spacing              SIZING_TOKENS
//   themes / surfaces    THEMES / SURFACES
//
// so a fix to a table fixes both directions. What is NOT a table — layout,
// margins, inline styles — is rules here, each reported when it loses
// something.
//
// Status of each drawn node (the coverage report):
//   clean       drawn with the system's own component / style / tokens
//   lossy       drawn, but something the code said is not in Figma (noted)
//   needsTable  a Figma set exists, there is no prop table yet: placeholder
//   unmapped    nothing in the template draws it: placeholder
//
// Off-system inline styles are NORMALIZED where the system answer is clear
// (owner decision 3): marginTop/Bottom → a spacer bound to a Sizing token,
// fontWeight 700 on Body → the Subtitle style. Each one is listed in the
// document's `normalizations`, and counted as clean (a spacer is exactly the
// space the margin made). Coverage also reports `cleanRatioStrict`, which
// counts them as lossy the way the 2026-11-06 prototype did.

import { splitButtonVariant } from '../figmaModeMapping';
import {
  BUTTON_COLORS, EXPORT_TO_TEXT_STYLE, LIB_DEFAULTS, RATIO_NAMES, SIZES, SIZING_TOKENS, SURFACES, TEXT_STYLE_TO_EXPORT, THEMES,
  iconGlyphFromComponent, invertVariantTable, normalizeStyleName, ratioName,
} from '../aaid/propTables';
import { LIBRARY, findComponent, findSet, hasTextStyle, hasVariantValue, propertyNames } from './library';
import type { RecordedNode, RecordedValue } from './record';
import { codeSignature, signature } from './roundTrip';
import {
  C2F_SCHEMA, type Align, type C2FDocument, type Coverage, type FrameNode, type ImageNode, type InstanceNode, type Layout,
  type Node, type PlaceholderNode, type ReportEntry, type Sizing, type Space, type Status, type TextNode,
} from './schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Tables owned by this direction (no Figma → code counterpart yet) ────────

/** Lib exports with a set in the template but no prop table yet → placeholder naming the set. */
export const NEEDS_TABLE: Record<string, string> = {
  TextInput: 'Input Field', TextArea: 'TextArea', NumberField: 'NumberField', Select: 'SelectField', Autocomplete: 'Input Field',
  Rating: 'Rating', Link: 'Link', LinkGroup: 'HotlinkGroup', Tabs: 'Tabs', Tab: 'Tab', Stepper: 'Stepper', Step: 'Count Step',
  Breadcrumbs: 'Breadcrumbs', BreadcrumbItem: '.Breadcrumb-Segments', Swatch: 'Swatch', SwatchField: 'SwatchField', Table: 'Data Table',
  Alert: 'Alert', Snackbar: 'Snackbar', Pagination: 'Pagination Strip', AppBar: 'AppBar', DesktopAppBar: 'AppBar', MobileAppBar: 'AppBar',
  Drawer: 'Drawer', Dialog: 'Dialog', AlertDialog: 'Dialog', FormDialog: 'Dialog', Modal: 'Modal', ToggleButtonGroup: 'ToggleButtonGroup', ButtonGroup: 'ButtonGroup',
  RangeSlider: 'Slider', Slider: 'Slider', SliderInput: 'SliderField', LinearProgress: 'Progress Bar', CircularProgress: 'ProgressRing',
  PageLoader: 'Fixed-Loader', Loader: 'Loader Styles', Accordion: 'Accordion Segment', AccordionGroup: 'Accordion Group',
  InputMessage: 'Form-Helper', FormHelper: 'Form-Helper', FormLabel: 'Form-Label', FieldGroup: 'Grouped Form Component',
  SwitchInput: 'Switch', Switch: 'Switch', Radio: 'Radio', RadioGroup: 'RadioField ', Tooltip: 'Tooltip', Popover: 'Popover',
  IconBadge: 'IconBadge', Footer: 'Footer', Fab: 'FAB', Badge: 'Badge Counter', CodeBlock: 'CodeBlock', DatePicker: 'Day Cell',
  DayCell: 'Day Cell', AvatarGroup: 'Avatar Group', BottomNavigation: 'Nav-Bar', Menu: 'Menu Item', MenuItem: 'Menu Item',
  SpeedDial: 'SpeedDial', Sheet: 'Sheet', TreeView: 'TreeView', ImagePlaceholder: 'Image Placeholder', Copyright: 'Copyright',
};

/** Draw nothing themselves; their children take their place. */
export const PASS_THROUGH = new Set([
  'OmniDesignProvider', 'HeadingLevel', 'ThemeProvider', 'ColorSchemeProvider', 'Suspense', 'Fragment',
  'TabList', 'TabPanel', 'DrawerContent', 'DrawerHeader', 'Dropdown',
]);

/** Render nothing visible on a page at rest. */
export const DRAWS_NOTHING = new Set(['SkipLink', 'DrawerClose', 'MenuButton']);

const STACKS: Record<string, { direction: 'row' | 'column'; align?: string; justify?: string; wrap?: boolean }> = {
  VStack: { direction: 'column' }, HStack: { direction: 'row', align: 'center' }, Stack: { direction: 'column' },
  DynoStack: { direction: 'column' }, InsetStack: { direction: 'column' },
  WrapStack: { direction: 'row', wrap: true }, GridStack: { direction: 'row', wrap: true },
  CenteredStack: { direction: 'column', align: 'center', justify: 'center' },
  SpaceBetweenStack: { direction: 'row', align: 'center', justify: 'space-between' },
};

/** Typography export aliases the lib defines (same style, second name). */
const TYPE_ALIASES: Record<string, string> = {
  BodyMedium: 'Body', SubtitleMedium: 'Subtitle', LabelMedium: 'Label', EyebrowMedium: 'Eyebrow',
  BodyBold: 'BodySemibold', BodySmallBold: 'BodySmallSemibold', BodyLargeBold: 'BodyLargeSemibold',
  Subtitle1: 'SubtitleLarge', Subtitle2: 'Subtitle',
};

/** Bold at body sizes is Subtitle (CLAUDE.md, Body weights); semibold is Body-*-Semibold. */
const BOLD_OF: Record<string, string> = { Body: 'Subtitle', BodySmall: 'SubtitleSmall', BodyLarge: 'SubtitleLarge', BodySemibold: 'Subtitle', BodySmallSemibold: 'SubtitleSmall', BodyLargeSemibold: 'SubtitleLarge' };
const SEMIBOLD_OF: Record<string, string> = { Body: 'BodySemibold', BodySmall: 'BodySmallSemibold', BodyLarge: 'BodyLargeSemibold' };

/** Typography `color` prop → the text-fill COLOR variable (inverse of textColorFromToken). */
const TEXT_FILL: Record<string, string> = {
  quiet: 'Quiet', primary: 'Text-Primary', secondary: 'Text-Secondary', tertiary: 'Text-Tertiary', neutral: 'Text-Neutral',
  info: 'Text-Info', success: 'Text-Success', warning: 'Text-Warning', error: 'Text-Error',
};

/** Section's named padding at Desktop (Section.js PAD_Y, first column). */
const SECTION_PAD_Y: Record<string, number> = { none: 0, small: 40, medium: 64, large: 96 };
/** Container maxWidth names (Container.js). */
const CONTAINER_MAX: Record<string, number> = { xs: 444, sm: 600, md: 900, lg: 1200, xl: 1536 };
/** MUI breakpoints, which Grid `size` and responsive props are keyed by. */
const BREAKPOINTS: Array<[string, number]> = [['xs', 0], ['sm', 600], ['md', 900], ['lg', 1200], ['xl', 1536]];

const INLINE_TAGS = new Set(['span', 'strong', 'b', 'em', 'i', 'small', 'code', 'br', 'sup', 'sub', 'u', 's', 'del']);
const RAW_CONTROLS = new Set(['button', 'a', 'input', 'select', 'textarea', 'svg', 'canvas', 'video', 'iframe', 'table']);

// ── Small helpers ───────────────────────────────────────────────────────────

export function space(px: number): Space {
  const variable = SIZING_TOKENS[px];
  return variable ? { px, variable } : { px };
}

const isObj = (v: unknown): v is Record<string, RecordedValue> => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (list: readonly string[], v: unknown): boolean => typeof v === 'string' && list.includes(v);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A responsive value ({ xs: 1, md: 2 }) read at the frame's width; plain values pass. */
export function atBreakpoint(v: RecordedValue | undefined, width: number): RecordedValue | undefined {
  if (!isObj(v)) return v;
  const keys = Object.keys(v);
  if (!keys.length || !keys.every((k) => BREAKPOINTS.some(([b]) => b === k))) return v;
  let out: RecordedValue | undefined;
  for (const [b, min] of BREAKPOINTS) if (width >= min && v[b] !== undefined) out = v[b];
  return out;
}

/** A CSS length as px when it is one: 16, "16px", "var(--Sizing-2)". */
function px(v: RecordedValue | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return undefined;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  if (m) return Number(m[1]);
  const t = /^var\(--(Sizing-[\w-]+)/.exec(v.trim());
  if (t) {
    const hit = Object.entries(SIZING_TOKENS).find(([, name]) => name === t[1]);
    if (hit) return Number(hit[0]);
  }
  if (/^0$/.test(v.trim())) return 0;
  return undefined;
}

/** A stack's gap in px: number × 8 (MUI spacing), or a length. */
function gapPx(v: RecordedValue | undefined): number | undefined {
  if (typeof v === 'number') return v * 8;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v) * 8;
  return px(v);
}

/** CSS padding shorthand → four px values, or undefined when not all are lengths. */
function paddingBox(v: RecordedValue | undefined): [number, number, number, number] | undefined {
  if (v === undefined) return undefined;
  let box: [number, number, number, number];
  if (typeof v === 'number') box = [v, v, v, v];
  else if (typeof v !== 'string') return undefined;
  else {
    const parts = v.trim().split(/\s+/).map((p) => px(p));
    if (parts.some((p) => p === undefined)) return undefined;
    const [t, r = t, b = t, l = r] = parts as number[];
    box = [t, r, b, l];
  }
  /* padding: 0 is the absence of padding, not a value to draw. */
  return box.some((x) => x !== 0) ? box : undefined;
}

const ALIGN: Record<string, Align> = {
  'flex-start': 'MIN', start: 'MIN', left: 'MIN', center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', right: 'MAX',
  baseline: 'BASELINE', 'space-between': 'SPACE_BETWEEN',
};

function textOf(nodes: RecordedNode[]): string {
  return nodes.map((n) => {
    if (n.kind === 'text') return n.text;
    if (n.kind === 'icon') return '';
    if (n.kind === 'html' && n.tag === 'br') return '\n';
    return textOf(n.children);
  }).join('');
}

/** Non-text parts inside a text run (Link, strong, an icon). */
function inlineParts(nodes: RecordedNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind === 'text') continue;
    if (n.kind === 'icon') out.push(`icon ${n.name}`);
    else if (n.kind === 'html') { if (n.tag !== 'br') out.push(`<${n.tag}>`); out.push(...inlineParts(n.children)); }
    else out.push(n.name);
  }
  return out;
}

function str(v: RecordedValue | undefined): string | undefined {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
}

// ── The mapper ──────────────────────────────────────────────────────────────

interface Parent {
  direction: 'row' | 'column';
  /** CSS align-items: stretch on the cross axis. */
  stretch: boolean;
  /** A block container (Section, Container, Box, div): block children fill its width. */
  block: boolean;
  grid?: boolean;
}

export interface MapOptions {
  app: string;
  state: C2FDocument['state'];
}

class Mapper {
  private readonly width: number;
  private tallies = new Map<string, Partial<Record<Status, number>>>();
  private normalizedCount = 0;
  readonly normalizations: ReportEntry[] = [];
  readonly placeholders: ReportEntry[] = [];

  readonly opts: MapOptions;

  constructor(opts: MapOptions) {
    this.opts = opts;
    this.width = opts.state.viewport.width;
  }

  // Counting ---------------------------------------------------------------

  private tally(source: string, status: Status): void {
    const t = this.tallies.get(source) ?? {};
    t[status] = (t[status] ?? 0) + 1;
    this.tallies.set(source, t);
  }

  /** The code's own signature for a lib component (what the round trip must give back). */
  private sigOf(n: Extract<RecordedNode, { kind: 'lib' }>, component: string): ReturnType<typeof codeSignature> {
    const props: Record<string, RecordedValue> = { ...n.props };
    const text = textOf(this.withSlots(n).filter((c) => c.kind !== 'icon')).trim();
    if (component === 'Chip' && props.label === undefined && text) props.label = text;
    if (component === 'Avatar' && props.initials === undefined && text) props.initials = text;
    if (component === 'Checkbox' && props.label === undefined && text) props.label = text;
    const withText = ['Button', 'Tag', 'ListItem'].includes(component);
    const iconOnly = component === 'Button' && (props.iconOnly === true || props.contentType === 'iconOnly');
    const t = component === 'ListItem' ? (typeof props.label === 'string' ? props.label : textOf(n.children).trim()) : textOf(n.children).trim();
    return codeSignature(component, props, withText && !iconOnly ? t : undefined);
  }

  private done<T extends Node>(node: T, notes: string[], opts: { status?: Status; lossy?: boolean; normalized?: string[] } = {}): T {
    const status: Status = opts.status ?? (opts.lossy ? 'lossy' : 'clean');
    node.status = status;
    for (const n of opts.normalized ?? []) {
      this.normalizations.push({ id: node.id, source: node.source, message: n });
      notes.push(`normalized: ${n}`);
    }
    if (opts.normalized?.length && status === 'clean') this.normalizedCount += 1;
    if (notes.length) node.notes = notes;
    this.tally(node.source, status);
    return node;
  }

  coverage(): Coverage {
    const c = { clean: 0, lossy: 0, needsTable: 0, unmapped: 0 };
    const byComponent: Coverage['byComponent'] = {};
    for (const k of [...this.tallies.keys()].sort()) {
      const t = this.tallies.get(k)!;
      byComponent[k] = t;
      for (const s of Object.keys(t) as Status[]) c[s] += t[s] ?? 0;
    }
    const counted = c.clean + c.lossy + c.needsTable + c.unmapped;
    const r = (x: number) => (counted ? Math.round((x / counted) * 1000) / 1000 : 0);
    return { ...c, counted, cleanRatio: r(c.clean), normalized: this.normalizedCount, cleanRatioStrict: r(c.clean - this.normalizedCount), byComponent };
  }

  // Children ---------------------------------------------------------------

  /**
   * Map a list of siblings. Pass-through components splice in their children,
   * margins become spacers, whitespace text disappears.
   */
  children(nodes: RecordedNode[], parent: Parent, idBase: string): Node[] {
    const out: Node[] = [];
    const next = () => `${idBase}${idBase ? '.' : ''}${out.length}`;
    for (const n of nodes) {
      if (n.kind === 'text' && !n.text.trim()) continue;
      if (n.kind === 'lib' && (PASS_THROUGH.has(this.canon(n)) || DRAWS_NOTHING.has(this.canon(n)))) {
        if (DRAWS_NOTHING.has(this.canon(n))) continue;
        for (const c of this.children(this.withSlots(n), parent, '')) out.push(this.reId(c, next()));
        continue;
      }
      if (n.kind === 'html' && n.tag === 'li' && n.children.filter((c) => !(c.kind === 'text' && !c.text.trim())).length === 1 && !n.style) {
        for (const c of this.children(n.children, parent, '')) out.push(this.reId(c, next()));
        continue;
      }
      if (n.kind === 'html' && n.tag === 'br') continue;
      const style = this.styleOf(n);
      const margins = this.margins(style, parent);
      if (margins.before) out.push(this.spacer(next(), margins.before, parent));
      const mapped = this.node(n, parent, next(), margins.normalized);
      if (mapped) out.push(mapped);
      if (margins.after) out.push(this.spacer(next(), margins.after, parent));
    }
    return out;
  }

  private reId(n: Node, id: string): Node {
    const walk = (x: Node, nid: string): Node => {
      const copy: any = { ...x, id: nid };
      if ('children' in x && x.children) copy.children = x.children.map((c, i) => walk(c, `${nid}.${i}`));
      if (x.kind === 'instance' && x.slots) {
        copy.slots = Object.fromEntries(Object.entries(x.slots).map(([k, v]) => [k, v.map((c, i) => walk(c, `${nid}.${k}.${i}`))]));
      }
      return copy;
    };
    return walk(n, id);
  }

  private withSlots(n: Extract<RecordedNode, { kind: 'lib' }>): RecordedNode[] {
    return [...Object.values(n.slots ?? {}).flat(), ...n.children];
  }

  private styleOf(n: RecordedNode): Record<string, string | number> {
    if (n.kind === 'html') return n.style ?? {};
    if (n.kind === 'lib' && isObj(n.props.style)) return n.props.style as Record<string, string | number>;
    return {};
  }

  private margins(style: Record<string, string | number>, parent: Parent): { before?: number; after?: number; normalized: string[] } {
    const out: { before?: number; after?: number; normalized: string[] } = { normalized: [] };
    const [beforeKey, afterKey] = parent.direction === 'column' ? ['marginTop', 'marginBottom'] : ['marginLeft', 'marginRight'];
    const b = px(style[beforeKey]);
    const a = px(style[afterKey]);
    if (b) { out.before = b; out.normalized.push(`${beforeKey} ${b}px → a ${b}px spacer${SIZING_TOKENS[b] ? ` (${SIZING_TOKENS[b]})` : ''} before it`); }
    if (a) { out.after = a; out.normalized.push(`${afterKey} ${a}px → a ${a}px spacer${SIZING_TOKENS[a] ? ` (${SIZING_TOKENS[a]})` : ''} after it`); }
    return out;
  }

  private spacer(id: string, size: number, parent: Parent): FrameNode {
    const sizing: Sizing = parent.direction === 'column' ? { h: 'FILL', v: 'FIXED', height: size } : { h: 'FIXED', width: size, v: 'FILL' };
    return { id, name: 'Spacer', kind: 'frame', status: 'clean', source: 'margin', layout: { mode: 'VERTICAL' }, sizing, children: [] };
  }

  /** The export name the tables know, through identity aliases when needed. */
  canon(n: Extract<RecordedNode, { kind: 'lib' }>): string {
    const known = (x: string) => KNOWN.has(x) || x in TYPE_ALIASES || x in NEEDS_TABLE || PASS_THROUGH.has(x) || DRAWS_NOTHING.has(x);
    if (known(n.name)) return TYPE_ALIASES[n.name] ?? n.name;
    for (const a of n.aliases ?? []) if (known(a)) return TYPE_ALIASES[a] ?? a;
    return n.name;
  }

  // One node ---------------------------------------------------------------

  node(n: RecordedNode, parent: Parent, id: string, normalized: string[]): Node | null {
    if (n.kind === 'text') return this.bareText(n.text, parent, id);
    if (n.kind === 'icon') return this.icon(n.name, n.props, parent, id, {});
    if (n.kind === 'html') return this.html(n, parent, id, normalized);
    const name = this.canon(n);
    if (STACKS[name] || name === 'Box' || name === 'Section' || name === 'Container' || name === 'Grid' || name === 'CardContent' || name === 'CardActions' || name === 'ThemedZone' || name === 'Paper' || name === 'Surfaced') {
      return this.layoutComponent(n, name, parent, id, normalized);
    }
    if (name in EXPORT_TO_TEXT_STYLE || name === 'AutoHeading' || name === 'Typography' || name === 'Heading') return this.typography(n, name, parent, id, normalized);
    switch (name) {
      case 'Button': return this.button(n, parent, id, normalized);
      case 'Checkbox': return this.checkbox(n, parent, id, normalized);
      case 'Divider': return this.divider(n, parent, id, normalized);
      case 'Avatar': return this.avatar(n, parent, id, normalized);
      case 'Chip': return this.chip(n, parent, id, normalized);
      case 'Tag': return this.tag(n, parent, id, normalized);
      case 'Card': return this.card(n, parent, id, normalized);
      case 'Ratio': return this.ratio(n, parent, id, normalized);
      case 'List': return this.list(n, parent, id, normalized);
      case 'ListItem': return this.listItem(n, parent, id, normalized);
      case 'Icon': {
        const glyph = this.withSlots(n).find((c) => c.kind === 'icon');
        if (glyph && glyph.kind === 'icon') return this.icon(glyph.name, glyph.props, parent, id, n.props, normalized);
        return this.placeholder(n, name, parent, id, 'unmapped', 'Icon wrapper without an icon inside');
      }
    }
    if (NEEDS_TABLE[name]) return this.placeholder(n, name, parent, id, 'needsTable', `Figma set "${NEEDS_TABLE[name].trim()}" exists; no prop table yet`, NEEDS_TABLE[name].trim());
    return this.placeholder(n, name, parent, id, 'unmapped', `${name} has no Figma component in the template`);
  }

  /** Sizing from the parent's rules plus the node's own style. */
  private sizing(style: Record<string, string | number>, parent: Parent, blockLevel: boolean, notes: string[]): Sizing | undefined {
    const s: Sizing = {};
    const cross = parent.direction === 'column' ? 'h' : 'v';
    const main = parent.direction === 'column' ? 'v' : 'h';
    if (parent.stretch && !parent.grid) s[cross] = 'FILL';
    else if (parent.block && blockLevel && parent.direction === 'column') s.h = 'FILL';
    const flex = style.flex;
    if (flex !== undefined) {
      const f = String(flex).trim().split(/\s+/);
      if (Number(f[0]) > 0) s[main] = 'FILL';
      const basis = f[2] ? px(f[2]) : undefined;
      if (basis && main === 'h') s.minWidth = basis;
    }
    if (Number(style.flexGrow) > 0) s[main] = 'FILL';
    const w = style.width;
    if (w === '100%') s.h = 'FILL';
    else if (px(w) !== undefined) { s.h = 'FIXED'; s.width = px(w); }
    else if (w !== undefined && w !== 'auto') notes.push(`width ${String(w)} not translated`);
    const hgt = style.height;
    if (hgt === '100%') s.v = 'FILL';
    else if (px(hgt) !== undefined) { s.v = 'FIXED'; s.height = px(hgt); }
    else if (hgt !== undefined && hgt !== 'auto') notes.push(`height ${String(hgt)} not translated`);
    if (px(style.minWidth) !== undefined) s.minWidth = px(style.minWidth);
    if (px(style.maxWidth) !== undefined) s.maxWidth = px(style.maxWidth);
    if (style.alignSelf === 'stretch') s[cross] = 'FILL';
    else if (typeof style.alignSelf === 'string' && s[cross] === 'FILL') delete s[cross];
    return Object.keys(s).length ? s : undefined;
  }

  /**
   * Style keys every node may carry that the sizing / margin / layout rules
   * already read. Anything else is reported by `restStyle`.
   */
  private restStyle(style: Record<string, string | number>, handled: string[], notes: string[]): boolean {
    const QUIET = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'height', 'minWidth', 'maxWidth', 'alignSelf', 'marginTop', 'marginBottom',
      'marginLeft', 'marginRight', 'cursor', 'listStyle', 'boxSizing', 'overflow', 'overflowX', 'overflowY', 'position', 'top', 'left', 'right', 'bottom',
      'zIndex', 'minHeight', 'maxHeight', 'textDecorationLine', 'outline', 'transition', 'whiteSpace', 'wordBreak', 'overflowWrap', ...handled]);
    let lossy = false;
    for (const [k, v] of Object.entries(style)) {
      if (QUIET.has(k)) continue;
      if ((k === 'margin' || k === 'padding') && (v === 0 || v === '0')) continue;
      if (k === 'margin' && /^0( auto)?$/.test(String(v))) continue;
      notes.push(`style ${k}: ${JSON.stringify(v)} not translated`);
      lossy = true;
    }
    if (style.minHeight !== undefined) notes.push(`minHeight ${String(style.minHeight)} not translated`);
    return lossy;
  }

  private absolute(style: Record<string, string | number>): { x?: number; y?: number } | undefined {
    if (style.position !== 'absolute') return undefined;
    const a: { x?: number; y?: number } = {};
    if (px(style.left) !== undefined) a.x = px(style.left);
    if (px(style.top) !== undefined) a.y = px(style.top);
    return a;
  }

  // Layout -----------------------------------------------------------------

  private themeModes(theme: RecordedValue | undefined, surface: RecordedValue | undefined, notes: string[]): Record<string, string> | undefined {
    const modes: Record<string, string> = {};
    if (theme !== undefined) {
      let t = String(theme);
      if (/-light$/i.test(t)) { notes.push(`theme "${t}" does not exist — drawn as ${t.replace(/-light$/i, '')} on Surface-Brightest`); t = t.replace(/-light$/i, ''); surface = surface ?? 'Surface-Brightest'; }
      if (has(THEMES, t) && LIBRARY.collections.find((c) => c.name === '.Theme')?.modes.includes(t)) modes['.Theme'] = t;
      else notes.push(`theme "${t}" has no mode in the template's .Theme collection`);
    }
    if (surface !== undefined) {
      const s = String(surface);
      if (has(SURFACES, s)) modes.Surface = s;
      else notes.push(`surface "${s}" is not a Surface mode`);
    }
    return Object.keys(modes).length ? modes : undefined;
  }

  private layoutComponent(n: Extract<RecordedNode, { kind: 'lib' }>, name: string, parent: Parent, id: string, normalized: string[]): FrameNode {
    const p = n.props;
    const style = this.styleOf(n);
    const notes: string[] = [];
    const handled: string[] = [];
    let layout: Layout;
    let self: Parent;
    let fill: FrameNode['fill'];
    let modes: Record<string, string> | undefined;
    const sizingExtra: Sizing = {};
    let gridColumnSpan: number | undefined;
    let lossy = false;

    if (STACKS[name]) {
      const base = STACKS[name];
      const dirRaw = atBreakpoint(p.direction, this.width);
      const direction = dirRaw === 'row' || dirRaw === 'row-reverse' ? 'row' : dirRaw === 'column' || dirRaw === 'column-reverse' ? 'column' : base.direction;
      if (typeof dirRaw === 'string' && /reverse/.test(dirRaw)) { notes.push(`direction ${dirRaw}: children drawn in source order`); lossy = true; }
      layout = { mode: direction === 'row' ? 'HORIZONTAL' : 'VERTICAL' };
      const gap = gapPx(atBreakpoint(p.gap ?? p.spacing, this.width));
      if (gap) layout.itemSpacing = space(gap);
      if (gap && !SIZING_TOKENS[gap]) notes.push(`gap ${gap}px is off the Sizing scale`);
      const align = String(atBreakpoint(p.alignItems, this.width) ?? style.alignItems ?? base.align ?? 'stretch');
      if (align !== 'stretch') { if (ALIGN[align]) { if (ALIGN[align] !== 'MIN') layout.counter = ALIGN[align]; } else { notes.push(`alignItems ${align} not translated`); lossy = true; } }
      const justify = String(atBreakpoint(p.justifyContent, this.width) ?? style.justifyContent ?? base.justify ?? 'flex-start');
      if (ALIGN[justify]) { if (ALIGN[justify] !== 'MIN') layout.primary = ALIGN[justify]; } else { notes.push(`justifyContent ${justify} has no auto-layout equivalent`); lossy = true; }
      const wrap = p.flexWrap ?? style.flexWrap;
      if (base.wrap || wrap === 'wrap') layout.wrap = true;
      handled.push('alignItems', 'justifyContent', 'flexWrap');
      const pad = paddingBox(style.padding as any);
      if (pad) { layout.padding = { top: space(pad[0]), right: space(pad[1]), bottom: space(pad[2]), left: space(pad[3]) }; handled.push('padding'); }
      if (p.divider !== undefined) { notes.push('divider between children not drawn'); lossy = true; }
      self = { direction, stretch: align === 'stretch', block: false };
      if (p.component && typeof p.component === 'string' && p.component !== 'div') notes.push(`semantic element <${p.component}> kept as the layer name only`);
    } else if (name === 'Section') {
      const padName = typeof p.padding === 'string' && p.padding in SECTION_PAD_Y ? p.padding : undefined;
      let py = padName ? SECTION_PAD_Y[padName] : 0;
      let pxSide = padName && padName !== 'none' ? 24 : 0;
      let pt = py; let pb = py;
      if (p.padding !== undefined && !padName) {
        const box = paddingBox(p.padding);
        if (box) { [pt, pxSide, pb] = [box[0], box[1], box[2]]; if (box[1] !== box[3]) { notes.push('uneven side padding drawn with the right value'); lossy = true; } }
        else { notes.push(`padding ${JSON.stringify(p.padding)} not translated`); lossy = true; }
      }
      if (typeof p.paddingTop === 'string' && p.paddingTop in SECTION_PAD_Y) pt = SECTION_PAD_Y[p.paddingTop];
      if (typeof p.paddingBottom === 'string' && p.paddingBottom in SECTION_PAD_Y) pb = SECTION_PAD_Y[p.paddingBottom];
      py = pt;
      layout = { mode: 'VERTICAL', counter: 'CENTER' };
      if (pt || pb || pxSide) layout.padding = { top: space(py), right: space(pxSide), bottom: space(pb), left: space(pxSide) };
      modes = this.themeModes(p.theme, p.surface ?? 'Surface', notes);
      fill = { variable: 'Background' };
      if (p.edgeTop || p.edgeBottom) { notes.push('section edge shape not drawn (Section Edge set exists; not wired)'); lossy = true; }
      self = { direction: 'column', stretch: false, block: true };
      sizingExtra.h = 'FILL';
    } else if (name === 'Container') {
      const max = CONTAINER_MAX[String(p.maxWidth ?? 'lg')];
      layout = { mode: 'VERTICAL' };
      if (!p.disableGutters) layout.padding = { top: space(0), right: space(24), bottom: space(0), left: space(24) };
      if (max) sizingExtra.maxWidth = max;
      sizingExtra.h = 'FILL';
      self = { direction: 'column', stretch: false, block: true };
    } else if (name === 'Grid') {
      if (p.container) {
        const gap = gapPx(atBreakpoint(p.spacing, this.width)) ?? 0;
        layout = { mode: 'GRID', columns: 12, gridFallback: { mode: 'HORIZONTAL', wrap: true } };
        if (gap) { layout.itemSpacing = space(gap); layout.rowSpacing = space(gap); }
        sizingExtra.h = 'FILL';
        self = { direction: 'row', stretch: false, block: false, grid: true };
      } else {
        layout = { mode: 'VERTICAL' };
        self = { direction: 'column', stretch: false, block: true };
      }
      if (parent.grid) {
        const size = atBreakpoint(p.size, this.width) ?? atBreakpoint({ ...(p.xs !== undefined ? { xs: p.xs } : {}), ...(p.sm !== undefined ? { sm: p.sm } : {}), ...(p.md !== undefined ? { md: p.md } : {}), ...(p.lg !== undefined ? { lg: p.lg } : {}) } as any, this.width);
        if (typeof size === 'number') gridColumnSpan = size;
        else if (size === 'grow') sizingExtra.h = 'FILL';
        else gridColumnSpan = undefined;
      }
    } else {
      /* Box, ThemedZone, Paper, Surfaced, CardContent, CardActions: block flow. */
      const row = name === 'CardActions';
      layout = { mode: row ? 'HORIZONTAL' : 'VERTICAL' };
      if (row) layout.itemSpacing = space(8);
      const display = style.display;
      if (display === 'flex' || display === 'inline-flex') {
        const dir = style.flexDirection === 'column' ? 'column' : 'row';
        layout = { mode: dir === 'row' ? 'HORIZONTAL' : 'VERTICAL' };
        const gap = px(style.gap as any);
        if (gap) layout.itemSpacing = space(gap);
        const ai = String(style.alignItems ?? 'stretch');
        if (ai !== 'stretch' && ALIGN[ai] && ALIGN[ai] !== 'MIN') layout.counter = ALIGN[ai];
        const jc = String(style.justifyContent ?? 'flex-start');
        if (ALIGN[jc] && ALIGN[jc] !== 'MIN') layout.primary = ALIGN[jc];
        if (style.flexWrap === 'wrap') layout.wrap = true;
        handled.push('display', 'flexDirection', 'gap', 'alignItems', 'justifyContent', 'flexWrap');
        self = { direction: dir, stretch: ai === 'stretch', block: false };
      } else {
        self = { direction: row ? 'row' : 'column', stretch: false, block: !row };
      }
      const pad = paddingBox(style.padding as any);
      if (pad) { layout.padding = { top: space(pad[0]), right: space(pad[1]), bottom: space(pad[2]), left: space(pad[3]) }; handled.push('padding'); }
      if (name === 'Box' || name === 'ThemedZone' || name === 'Paper' || name === 'Surfaced') {
        modes = this.themeModes(p.theme ?? p['data-theme'], p.surface ?? p['data-surface'], notes);
        if (modes && name !== 'ThemedZone') fill = { variable: 'Background' };
        const level = typeof p.elevation === 'number' ? p.elevation : 0;
        if (level > 0) { modes = { ...(modes ?? {}), '.Elevation': `Level-${level}` }; }
        if (p.radius && p.radius !== 'none') { notes.push(`radius "${String(p.radius)}" → bind the corner radius to the Card radius variable (not in the Figma → code tables)`); lossy = true; }
        if (p.ratio) { notes.push(`ratio ${String(p.ratio)} not drawn`); lossy = true; }
      }
    }
    if (this.restStyle(style, handled, notes)) lossy = true;
    const sizing = { ...(this.sizing(style, parent, true, notes) ?? {}), ...sizingExtra };
    const node: FrameNode = {
      id, name, kind: 'frame', status: 'clean', source: n.name, layout,
      children: [],
    };
    if (Object.keys(sizing).length) node.sizing = sizing;
    if (modes) node.modes = modes;
    if (fill) node.fill = fill;
    if (gridColumnSpan !== undefined) node.gridColumnSpan = gridColumnSpan;
    const abs = this.absolute(style);
    if (abs) node.absolute = abs;
    node.children = this.children(this.withSlots(n), self, id);
    return this.done(node, notes, { lossy, normalized });
  }

  private html(n: Extract<RecordedNode, { kind: 'html' }>, parent: Parent, id: string, normalized: string[]): Node | null {
    const style = n.style ?? {};
    const notes: string[] = [];
    if (n.tag === 'img') {
      const node: ImageNode = {
        id, name: String(n.attrs.alt || 'Image'), kind: 'image', status: 'clean', source: '<img>',
        image: { src: String(n.attrs.src ?? ''), scaleMode: style.objectFit === 'contain' ? 'FIT' : 'FILL', ...(n.attrs.alt ? { alt: String(n.attrs.alt) } : {}) },
      };
      const sizing = this.sizing(style, parent, true, notes);
      if (sizing) node.sizing = sizing;
      const lossy = this.restStyle(style, ['objectFit', 'display'], notes);
      return this.done(node, notes, { lossy, normalized });
    }
    if (RAW_CONTROLS.has(n.tag)) {
      return this.placeholderOf(`<${n.tag}>`, n.tag, n.children, parent, id, 'unmapped', `raw <${n.tag}> drawn by the app itself — no lib component`);
    }
    if (INLINE_TAGS.has(n.tag) && n.children.every((c) => c.kind === 'text' || (c.kind === 'html' && INLINE_TAGS.has(c.tag)))) {
      const t = this.bareText(textOf(n.children), parent, id, `<${n.tag}>`);
      if (t && (n.tag === 'strong' || n.tag === 'b')) { t.textStyle = 'Subtitle-Medium'; t.notes = [...(t.notes ?? []), 'bold run drawn as Subtitle-Medium']; }
      return t;
    }
    /* Everything else is a frame: a div's block flow, or its flex layout. */
    let layout: Layout = { mode: 'VERTICAL' };
    let self: Parent = { direction: 'column', stretch: false, block: true };
    const handled: string[] = ['display'];
    if (style.display === 'flex' || style.display === 'inline-flex' || style.display === 'grid') {
      const dir = style.display === 'grid' ? 'column' : style.flexDirection === 'column' ? 'column' : 'row';
      layout = { mode: dir === 'row' ? 'HORIZONTAL' : 'VERTICAL' };
      const gap = px(style.gap as any) ?? px(style.rowGap as any);
      if (gap) layout.itemSpacing = space(gap);
      const ai = String(style.alignItems ?? 'stretch');
      if (ai !== 'stretch' && ALIGN[ai] && ALIGN[ai] !== 'MIN') layout.counter = ALIGN[ai];
      const jc = String(style.justifyContent ?? 'flex-start');
      if (ALIGN[jc] && ALIGN[jc] !== 'MIN') layout.primary = ALIGN[jc];
      if (style.flexWrap === 'wrap') layout.wrap = true;
      if (style.display === 'grid') { notes.push(`CSS grid ${String(style.gridTemplateColumns ?? '')} drawn as a column`); handled.push('gridTemplateColumns'); }
      handled.push('flexDirection', 'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent', 'flexWrap');
      self = { direction: dir, stretch: ai === 'stretch', block: false };
    }
    const pad = paddingBox(style.padding as any);
    if (pad) { layout.padding = { top: space(pad[0]), right: space(pad[1]), bottom: space(pad[2]), left: space(pad[3]) }; handled.push('padding'); }
    if (n.attrs.class || n.attrs.className) notes.push(`className "${String(n.attrs.class ?? n.attrs.className)}" not read (no browser)`);
    let lossy = this.restStyle(style, handled, notes) || !!(n.attrs.class || n.attrs.className);
    if (style.display === 'grid') lossy = true;
    if (!['div', 'main', 'form', 'section', 'nav', 'header', 'footer', 'article', 'aside', 'ul', 'ol', 'li', 'span', 'p', 'fieldset', 'label'].includes(n.tag)) {
      notes.push(`<${n.tag}> drawn as a frame`);
      lossy = true;
    }
    const node: FrameNode = { id, name: n.tag, kind: 'frame', status: 'clean', source: `<${n.tag}>`, layout, children: [] };
    const sizing = this.sizing(style, parent, true, notes);
    if (sizing) node.sizing = sizing;
    const abs = this.absolute(style);
    if (abs) node.absolute = abs;
    node.children = this.children(n.children, self, id);
    return this.done(node, notes, { lossy, normalized });
  }

  // Type -------------------------------------------------------------------

  private bareText(text: string, parent: Parent, id: string, source = 'text'): TextNode | null {
    if (!text.trim()) return null;
    const node: TextNode = { id, name: text.trim().slice(0, 40), kind: 'text', status: 'clean', source, characters: text.trim(), textStyle: 'Body-Medium' };
    node.code = signature('Body', {}, text.trim());
    const s = this.sizing({}, parent, true, []);
    if (s) node.sizing = s;
    return this.done(node, ['text with no type style in the code — drawn as Body-Medium'], { lossy: true });
  }

  private typography(n: Extract<RecordedNode, { kind: 'lib' }>, name: string, parent: Parent, id: string, normalized: string[]): Node {
    const p = n.props;
    const style = this.styleOf(n);
    const notes: string[] = [];
    let lossy = false;
    const norm = [...normalized];
    let exp: string | undefined = name;
    if (name === 'AutoHeading') {
      const size = typeof p.size === 'string' ? p.size : `h${typeof p.$level === 'number' ? p.$level : 2}`;
      exp = TEXT_STYLE_TO_EXPORT[size];
    } else if (name === 'Typography' || name === 'Heading') {
      const ts = str(p.textStyle) ?? str(p.variant) ?? str(p.level !== undefined ? `h${String(p.level)}` : undefined);
      exp = ts ? TEXT_STYLE_TO_EXPORT[normalizeStyleName(ts)] : undefined;
    }
    if (!exp || !EXPORT_TO_TEXT_STYLE[exp]) {
      return this.placeholder(n, name, parent, id, 'unmapped', `type style for ${name} ${JSON.stringify(p.textStyle ?? p.variant ?? p.size ?? '')} is not in the Figma type ramp`);
    }
    const weight = style.fontWeight;
    if (weight !== undefined) {
      const w = String(weight);
      if ((w === '700' || w === 'bold' || w === '800') && BOLD_OF[exp]) { norm.push(`fontWeight ${w} on ${exp} → ${BOLD_OF[exp]} (Body has no bold; Subtitle is Body at 700)`); exp = BOLD_OF[exp]; }
      else if ((w === '600' || w === '500') && SEMIBOLD_OF[exp]) { norm.push(`fontWeight ${w} on ${exp} → ${SEMIBOLD_OF[exp]}`); exp = SEMIBOLD_OF[exp]; }
      else { notes.push(`fontWeight ${w} on ${exp} has no type style — dropped`); lossy = true; }
    }
    const textStyle = EXPORT_TO_TEXT_STYLE[exp];
    const kids = this.withSlots(n);
    const characters = textOf(kids).replace(/\s+\n/g, '\n').trim();
    const inline = inlineParts(kids);
    if (inline.length) { notes.push(`inline ${[...new Set(inline)].join(', ')} flattened into one text layer`); lossy = true; }
    const node: TextNode = { id, name: exp, kind: 'text', status: 'clean', source: n.name, characters, textStyle };
    /* The type style after any declared normalization — that difference is intended. */
    node.code = signature(exp, { color: p.color }, characters);
    if (!hasTextStyle(textStyle)) { notes.push(`text style "${textStyle}" is not in the template`); lossy = true; }
    const color = str(p.color);
    if (color && TEXT_FILL[color]) node.fill = { variable: TEXT_FILL[color] };
    else if (color && !['standard', 'default', 'inherit'].includes(color)) { notes.push(`color "${color}" has no text-fill variable mapped`); lossy = true; }
    const ta = style.textAlign ?? p.align ?? p.textAlign;
    if (ta === 'center') node.align = 'CENTER';
    else if (ta === 'right' || ta === 'end') node.align = 'RIGHT';
    const deco = style.textDecoration ?? style.textDecorationLine;
    if (typeof deco === 'string' && deco !== 'none') {
      node.decoration = /line-through/.test(deco) ? 'STRIKETHROUGH' : 'UNDERLINE';
      notes.push(`textDecoration ${deco} is an inline style, not a type style — drawn literally`);
      lossy = true;
    }
    if (this.restStyle(style, ['fontWeight', 'textAlign', 'textDecoration', 'display'], notes)) lossy = true;
    const sizing = this.sizing(style, parent, true, notes);
    if (sizing) node.sizing = sizing;
    if (!characters) { notes.push('no text content'); lossy = true; }
    return this.done(node, notes, { lossy, normalized: norm });
  }

  // Instances --------------------------------------------------------------

  private instance(setName: string, id: string, name: string, source: string, variant: Record<string, string>): InstanceNode {
    const set = findSet(setName);
    const comp = set ? undefined : findComponent(setName);
    const node: InstanceNode = {
      id, name, kind: 'instance', status: 'clean', source,
      component: { set: setName, ...(set?.key ?? comp?.key ? { key: set?.key ?? comp?.key } : {}) },
      variant,
    };
    return node;
  }

  /**
   * Variant via the shared table, limited to what the live set has. Rows that
   * are BOOLEAN component properties on the live set (Card Selected, Button
   * Badge) come back in `booleans`, to be set as properties, not variants.
   */
  private variantFor(table: string, setName: string, code: Record<string, unknown>): { variant: Record<string, string>; booleans: Record<string, boolean> } {
    const bools = new Set(propertyNames(setName, 'BOOLEAN'));
    const inv = invertVariantTable(table, code, (axis, value) => hasVariantValue(setName, axis, value) || (bools.has(axis) && (value === 'true' || value === 'false')));
    const variant: Record<string, string> = {};
    const booleans: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(inv.variant)) {
      if (bools.has(k)) booleans[k] = v === 'true';
      else variant[k] = v;
    }
    return { variant, booleans };
  }

  private icon(compName: string, props: Record<string, RecordedValue>, parent: Parent, id: string, wrapper: Record<string, RecordedValue>, normalized: string[] = []): InstanceNode | PlaceholderNode {
    const g = iconGlyphFromComponent(compName);
    const notes: string[] = [];
    if (!g) {
      return this.done(this.placeholderShell(id, `icon:${compName}`, compName, `icon ${compName} has no style in Figma's Icon set (Default · Round · Sharp)`), [], { status: 'unmapped' });
    }
    const node = this.instance('Icon', id, g.glyph, `icon:${compName}`, { Style: g.style });
    node.properties = { 'Icon name': g.glyph };
    node.code = signature('Icon', { glyph: compName });
    const color = str(wrapper.color) ?? str(props.color);
    let lossy = false;
    if (color && color !== 'inherit') {
      const mode = cap(color);
      if (LIBRARY.collections.find((c) => c.name === 'Icons')?.modes.includes(mode)) node.modes = { Icons: mode };
      else { notes.push(`icon color "${color}" has no Icons mode`); lossy = true; }
    }
    const size = str(wrapper.size) ?? str(props.fontSize);
    if (size && has(['small', 'medium', 'large'], size)) node.modes = { ...(node.modes ?? {}), 'Icons & Avatars': size };
    void parent;
    return this.done(node, notes, { lossy, normalized });
  }

  private decorator(nodes: RecordedNode[] | undefined, role: string, notes: string[]): { kind: 'icon' | 'avatar' | 'other'; nested?: { role: string; node: InstanceNode } } | undefined {
    const first = (nodes ?? []).find((x) => !(x.kind === 'text' && !x.text.trim()));
    if (!first) return undefined;
    if (first.kind === 'icon') {
      const ic = this.icon(first.name, first.props, { direction: 'row', stretch: false, block: false }, `${role}`, {});
      return { kind: 'icon', ...(ic.kind === 'instance' ? { nested: { role, node: ic } } : {}) };
    }
    if (first.kind === 'lib' && this.canon(first) === 'Icon') {
      const g = this.withSlots(first).find((c) => c.kind === 'icon');
      if (g && g.kind === 'icon') {
        const ic = this.icon(g.name, g.props, { direction: 'row', stretch: false, block: false }, role, first.props);
        return { kind: 'icon', ...(ic.kind === 'instance' ? { nested: { role, node: ic } } : {}) };
      }
    }
    if (first.kind === 'lib' && this.canon(first) === 'Avatar') {
      const av = this.avatar(first, { direction: 'row', stretch: false, block: false }, role, []);
      return { kind: 'avatar', nested: { role, node: av } };
    }
    notes.push(`${role} decorator ${first.kind === 'lib' ? first.name : first.kind} not drawn`);
    return { kind: 'other' };
  }

  private button(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    let variant = str(p.variant) ?? 'default';
    if (/-light$/.test(variant)) { notes.push(`variant "${variant}" has no -light shape — drawn solid (the lib does the same)`); variant = variant.replace(/-light$/, ''); lossy = true; }
    const split = splitButtonVariant(variant);
    let colorMode = split?.colorMode ?? 'default';
    let shape = split?.shape ?? 'solid';
    if (!split || !has(BUTTON_COLORS, colorMode)) { notes.push(`variant "${variant}" is not a Figma Style × Buttons mode — drawn as default solid`); colorMode = 'default'; shape = 'solid'; lossy = true; }
    const ct = str(p.contentType);
    const code: Record<string, unknown> = {
      iconOnly: p.iconOnly === true || ct === 'iconOnly', letterNumber: p.letterNumber === true || ct === 'letterNumber', avatar: p.avatar === true || ct === 'avatar',
      disabled: p.disabled === true, selected: p.selected === true, badge: p.badge === true,
    };
    const { variant: v, booleans: vb } = this.variantFor('Button', 'Button', code);
    v.Style = shape;
    const label = str(p['aria-label']);
    const node = this.instance('Button', id, (code.iconOnly || code.letterNumber || code.avatar) && label ? label : 'Button', n.name, sortKeys(v));
    node.code = this.sigOf(n, 'Button');
    const modes: Record<string, string> = {};
    if (colorMode !== 'default' && shape !== 'ghost') modes.Buttons = colorMode;
    const size = str(p.size);
    if (size && size !== 'medium' && has(SIZES, size)) modes['Component-Size'] = size;
    if (Object.keys(modes).length) node.modes = modes;
    const start = this.decorator(n.slots?.startDecorator ?? n.slots?.startIcon, 'start', notes);
    const end = this.decorator(n.slots?.endDecorator ?? n.slots?.endIcon, 'end', notes);
    node.properties = {
      'start-icon': start?.kind === 'icon', 'start-avatar': start?.kind === 'avatar',
      'end-icon': end?.kind === 'icon', 'end-avatar': end?.kind === 'avatar',
      ...vb,
    };
    if (start?.kind === 'other' || end?.kind === 'other') lossy = true;
    const nested: InstanceNode['nested'] = [];
    if (start?.nested) nested.push(start.nested);
    if (end?.nested) nested.push(end.nested);
    if (code.iconOnly) {
      const ic = this.decorator(n.children, 'icon', notes);
      if (ic?.nested) nested.push(ic.nested);
      if (!label) notes.push('icon-only button without aria-label');
    } else {
      const t = textOf(n.children).trim();
      if (t) node.text = { label: t };
      const other = inlineParts(n.children);
      if (other.length) { notes.push(`button content ${other.join(', ')} beside the label not drawn`); lossy = true; }
    }
    if (nested.length) node.nested = nested;
    if (p.fullWidth === true) node.sizing = { h: 'FILL' };
    else {
      const s = this.sizing(this.styleOf(n), parent, false, notes);
      if (s) node.sizing = s;
    }
    if (p.elevated === true) { notes.push('elevated: the live Button set has no elevation axis'); lossy = true; }
    const pd: Record<string, string> = {};
    if (label) pd.ariaLabel = label;
    if (typeof p.href === 'string') pd.href = p.href;
    if (typeof p.to === 'string') pd.href = p.to;
    if (Object.keys(pd).length) node.pluginData = pd;
    if (this.restStyle(this.styleOf(n), [], notes)) lossy = true;
    return this.done(node, notes, { lossy, normalized });
  }

  private checkbox(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const code = { defaultChecked: p.checked === true || p.defaultChecked === true, indeterminate: p.indeterminate === true, disabled: p.disabled === true, error: p.error === true || p.validation === 'error' };
    const { variant, booleans } = this.variantFor('Checkbox', 'Checkbox', code);
    const node = this.instance('Checkbox', id, str(p['aria-label']) ?? 'Checkbox', n.name, sortKeys(variant));
    if (Object.keys(booleans).length) node.properties = booleans;
    node.code = this.sigOf(n, 'Checkbox');
    const color = str(p.variant) ?? str(p.color);
    const modes: Record<string, string> = {};
    if (color && color !== 'default' && has(BUTTON_COLORS, color)) modes.Buttons = color;
    const size = str(p.size);
    if (size && size !== 'medium' && has(SIZES, size)) modes['Component-Size'] = size;
    if (Object.keys(modes).length) node.modes = modes;
    const label = str(p.label) ?? (textOf(n.children).trim() || undefined);
    if (label) {
      node.text = { label };
      notes.push('label: the live Checkbox set has no text layer — the plugin draws it in a Checkbox Field (Label=label-right); no Figma → code table reads that set yet');
      lossy = true;
    }
    const s = this.sizing(this.styleOf(n), parent, false, notes);
    if (s) node.sizing = s;
    return this.done(node, notes, { lossy, normalized });
  }

  private divider(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const { variant, booleans } = this.variantFor('Divider', 'Divider', { orientation: p.orientation, colored: p.colored === true });
    const node = this.instance('Divider', id, 'Divider', n.name, sortKeys(variant));
    if (Object.keys(booleans).length) node.properties = booleans;
    node.code = this.sigOf(n, 'Divider');
    if (typeof p.color === 'string' && p.color !== 'default') { notes.push(`color "${p.color}": the live Divider draws Default or Colored, not a palette`); lossy = true; }
    /* Thickness is the Component-Size mode; the lib's default is small and the
       collection's is medium, so it is always written. */
    const size = str(p.size) ?? String(LIB_DEFAULTS.Divider.size);
    node.modes = { 'Component-Size': has(SIZES, size) ? size : 'small' };
    if (p.indicatorText !== undefined || n.children.length) { notes.push('divider label (Pill) not drawn'); lossy = true; }
    node.sizing = p.orientation === 'vertical' ? { v: 'FILL' } : { h: 'FILL' };
    void parent;
    return this.done(node, notes, { lossy, normalized });
  }

  private avatar(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const initials = str(p.initials) ?? (textOf(n.children).trim() || undefined);
    const photo = typeof p.src === 'string' || p.defaultPhoto === true;
    const { variant } = this.variantFor('Avatar', 'Avatar', { defaultPhoto: photo });
    if (initials && !photo) variant.Style = 'Initials';
    const node = this.instance('Avatar', id, str(p.alt) ?? 'Avatar', n.name, sortKeys(variant));
    node.code = this.sigOf(n, 'Avatar');
    if (initials && !photo) node.text = { initials };
    if (typeof p.src === 'string') node.image = { src: p.src, scaleMode: 'FILL', ...(typeof p.alt === 'string' ? { alt: p.alt } : {}) };
    const modes: Record<string, string> = {};
    const size = str(p.size);
    if (size && size !== 'medium') modes['Icons & Avatars'] = size;
    const color = str(p.color);
    if (color && color !== 'default' && has(BUTTON_COLORS, color)) modes.Buttons = color;
    if (Object.keys(modes).length) node.modes = modes;
    if (p.shape && p.shape !== 'circle') { notes.push(`shape "${String(p.shape)}" (Avatar Shape) not drawn`); lossy = true; }
    void parent;
    return this.done(node, notes, { lossy, normalized });
  }

  private chip(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const { variant } = this.variantFor('Chip', 'Chip', { disabled: p.disabled === true, selected: p.selected === true });
    const node = this.instance('Chip', id, 'Chip', n.name, sortKeys(variant));
    node.code = this.sigOf(n, 'Chip');
    let color = str(p.variant) ?? String(LIB_DEFAULTS.Chip.variant);
    if (/-light$|-outline$/.test(color)) { notes.push(`variant "${color}": shape not drawn, palette kept`); color = color.replace(/-(light|outline)$/, ''); lossy = true; }
    if (has(BUTTON_COLORS, color)) node.modes = { Buttons: color };
    const label = str(p.label) ?? (textOf(n.children).trim() || undefined);
    if (label) node.text = { label };
    const start = this.decorator(n.slots?.startDecorator, 'start', notes);
    const end = this.decorator(n.slots?.endDecorator, 'end', notes);
    node.properties = {
      'Start-Icon': start?.kind === 'icon', 'Start-Avatar': start?.kind === 'avatar',
      'End-Icon': end?.kind === 'icon', 'End-Avatar': end?.kind === 'avatar',
      Deletable: isObj(p.onDelete),
    };
    const nested = [start?.nested, end?.nested].filter(Boolean) as NonNullable<InstanceNode['nested']>;
    if (nested.length) node.nested = nested;
    if (start?.kind === 'other' || end?.kind === 'other') lossy = true;
    const s = this.sizing(this.styleOf(n), parent, false, notes);
    if (s) node.sizing = s;
    return this.done(node, notes, { lossy, normalized });
  }

  private tag(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const color = str(p.color) ?? 'default';
    const theme = cap(color);
    const node = this.instance('Tag', id, 'Tag', n.name, {
      Fit: p.width === 'fill' ? 'Fill' : 'Hug',
      Theme: hasVariantValue('Tag', 'Theme', theme) ? theme : 'Default',
    });
    node.code = this.sigOf(n, 'Tag');
    if (!hasVariantValue('Tag', 'Theme', theme)) { notes.push(`color "${color}" is not a Tag Theme`); lossy = true; }
    const t = textOf(n.children).trim();
    if (t) node.text = { label: t };
    if (p.shape || p.allCaps) { notes.push('shape / allCaps not drawn'); lossy = true; }
    if (p.width === 'fill') node.sizing = { h: 'FILL' };
    void parent;
    return this.done(node, notes, { lossy, normalized });
  }

  private card(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const code = { disabled: p.disabled === true, draggable: p.draggable === true, selected: p.selected === true, orientation: p.orientation, elevated: p.elevated === true };
    const { variant, booleans } = this.variantFor('Card', 'Card', code);
    if ((p.clickable === true || isObj(p.onClick) || typeof p.href === 'string') && variant.State === 'Non-clickable') variant.State = 'Default';
    const node = this.instance('Card', id, 'Card', n.name, sortKeys(variant));
    if (Object.keys(booleans).length) node.properties = booleans;
    node.code = this.sigOf(n, 'Card');
    const modes = this.themeModes(p['data-theme'], p.surface, notes) ?? {};
    const size = str(p.size);
    if (size && size !== 'medium' && has(SIZES, size)) modes['Component-Size'] = size;
    if (Object.keys(modes).length) node.modes = modes;
    if (p.variant !== undefined && p.variant !== 'solid') { notes.push(`variant "${String(p.variant)}" not drawn`); lossy = true; }
    if (p.color !== undefined) { notes.push(`color "${String(p.color)}" not drawn (use data-theme)`); lossy = true; }
    const self: Parent = { direction: 'column', stretch: true, block: true };
    node.slots = { 'Padded Card Content': this.children(this.withSlots(n), self, `${id}.slot`) };
    const s = this.sizing(this.styleOf(n), parent, true, notes);
    if (s) node.sizing = s;
    if (typeof p.href === 'string') node.pluginData = { href: p.href };
    if (this.restStyle(this.styleOf(n), [], notes)) lossy = true;
    return this.done(node, notes, { lossy, normalized });
  }

  private ratio(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const vertical = p.fit === 'height';
    const setName = vertical ? 'Ratio - Fill Vertical' : 'Ratio - Fill Horizontal';
    const r = ratioName(str(p.ratio) ?? '1:1') ?? '1:1';
    if (str(p.ratio) && !ratioName(str(p.ratio))) { notes.push(`ratio "${String(p.ratio)}" is not a RatioName`); lossy = true; }
    void RATIO_NAMES;
    const node = this.instance(setName, id, 'Ratio', n.name, { Ratio: r });
    node.code = this.sigOf(n, 'Ratio');
    const kids = this.withSlots(n).filter((c) => !(c.kind === 'text' && !c.text.trim()));
    const img = kids.find((c) => c.kind === 'html' && c.tag === 'img') as Extract<RecordedNode, { kind: 'html' }> | undefined;
    if (img) {
      node.image = { src: String(img.attrs.src ?? ''), scaleMode: img.style?.objectFit === 'contain' ? 'FIT' : 'FILL', ...(img.attrs.alt ? { alt: String(img.attrs.alt) } : {}) };
      this.tally('<img> (Ratio fill)', 'clean');
    }
    const rest = kids.filter((c) => c !== img);
    if (rest.length) node.slots = { 'Ratio Slot': this.children(rest, { direction: 'column', stretch: false, block: true }, `${id}.slot`) };
    if (p.placeholder === true) notes.push('placeholder: drawn as the empty Ratio');
    node.sizing = vertical ? { v: 'FILL' } : { h: 'FILL' };
    const s = this.sizing(this.styleOf(n), parent, true, notes);
    if (s) node.sizing = { ...node.sizing, ...s };
    if (this.restStyle(this.styleOf(n), [], notes)) lossy = true;
    return this.done(node, notes, { lossy, normalized });
  }

  private list(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    const { variant } = this.variantFor('List', 'List', { clickable: p.clickable === true, orientation: p.orientation });
    const node = this.instance('List', id, 'List', n.name, sortKeys(variant));
    node.code = this.sigOf(n, 'List');
    const size = str(p.size);
    if (size && size !== 'medium' && has(SIZES, size)) node.modes = { 'Component-Size': size };
    node.slots = { 'List Slot': this.children(this.withSlots(n), { direction: p.orientation === 'horizontal' ? 'row' : 'column', stretch: true, block: false }, `${id}.slot`) };
    const s = this.sizing(this.styleOf(n), parent, true, notes);
    if (s) node.sizing = s;
    return this.done(node, notes, { normalized });
  }

  private listItem(n: Extract<RecordedNode, { kind: 'lib' }>, parent: Parent, id: string, normalized: string[]): InstanceNode {
    const p = n.props;
    const notes: string[] = [];
    let lossy = false;
    const code = { selected: p.selected === true, disabled: p.disabled === true, bottomBorder: p.bottomBorder === true, rightBorder: p.rightBorder === true };
    const { variant, booleans } = this.variantFor('ListItem', 'List Item', code);
    if ((p.clickable === true || isObj(p.onClick)) && variant.State === 'Non-clickable') variant.State = 'Default';
    const title = str(p.label) ?? (textOf(n.children).trim() || undefined);
    const node = this.instance('List Item', id, title ?? 'List Item', n.name, sortKeys(variant));
    node.code = this.sigOf(n, 'ListItem');
    const text: Record<string, string> = {};
    if (title) text.title = title;
    const secondary = str(p.secondary);
    if (secondary) text.secondary = secondary;
    const eyebrow = str(p.eyebrow) ?? str(p.overline);
    if (eyebrow) text.eyebrow = eyebrow;
    if (Object.keys(text).length) node.text = text;
    const size = str(p.size);
    if (size && size !== 'medium' && has(SIZES, size)) node.modes = { 'Component-Size': size };
    const slots: Record<string, any> = {};
    const row: Parent = { direction: 'row', stretch: false, block: false };
    if (n.slots?.startDecorator) slots['Start Decorator'] = this.children(n.slots.startDecorator, row, `${id}.start`);
    if (n.slots?.endDecorator) slots['End Decorator'] = this.children(n.slots.endDecorator, row, `${id}.end`);
    if (Object.keys(slots).length) node.slots = slots;
    node.properties = { ...booleans, Image: p.image !== undefined && p.image !== false };
    if (typeof p.image === 'string') node.image = { src: p.image, scaleMode: 'FILL' };
    const inline = inlineParts(n.children);
    if (inline.length) { notes.push(`row content ${inline.join(', ')} flattened into the title`); lossy = true; }
    node.sizing = { h: 'FILL' };
    void parent;
    return this.done(node, notes, { lossy, normalized });
  }

  // Placeholders -----------------------------------------------------------

  private placeholderShell(id: string, source: string, component: string, reason: string, figmaSet?: string): PlaceholderNode {
    return { id, name: component, kind: 'placeholder', status: 'unmapped', source, component, ...(figmaSet ? { figmaSet } : {}), reason, layout: { mode: 'VERTICAL', itemSpacing: space(8) }, children: [] };
  }

  private placeholderOf(source: string, component: string, kids: RecordedNode[], parent: Parent, id: string, status: Status, reason: string, figmaSet?: string): PlaceholderNode {
    const node = this.placeholderShell(id, source, component, reason, figmaSet);
    this.placeholders.push({ id, source, message: reason });
    node.children = this.children(kids, { direction: 'column', stretch: false, block: true }, id);
    const s = this.sizing({}, parent, true, []);
    if (s) node.sizing = s;
    return this.done(node, [], { status });
  }

  private placeholder(n: Extract<RecordedNode, { kind: 'lib' }>, name: string, parent: Parent, id: string, status: Status, reason: string, figmaSet?: string): PlaceholderNode {
    return this.placeholderOf(n.name, name, this.withSlots(n), parent, id, status, reason, figmaSet);
  }
}

/** Every lib export this mapper draws with a table or a layout rule. */
const KNOWN = new Set([
  ...Object.keys(STACKS), 'Box', 'Section', 'Container', 'Grid', 'CardContent', 'CardActions', 'ThemedZone', 'Paper', 'Surfaced',
  ...Object.keys(EXPORT_TO_TEXT_STYLE), 'AutoHeading', 'Typography', 'Heading',
  'Button', 'Checkbox', 'Divider', 'Avatar', 'Chip', 'Tag', 'Card', 'Ratio', 'List', 'ListItem', 'Icon',
]);

function sortKeys<T extends Record<string, string>>(o: T): T {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])) as T;
}

/**
 * Map one recorded state to the IR. `roots` is what the runner recorded (the
 * app's top-level output).
 */
export function mapRecorded(roots: RecordedNode[], opts: MapOptions): C2FDocument {
  const m = new Mapper(opts);
  const page: Parent = { direction: 'column', stretch: true, block: true };
  const children = m.children(roots, page, '');
  const v = opts.state.viewport;
  const root: FrameNode = {
    id: 'root',
    name: `${opts.state.name} — ${v.name}`,
    kind: 'frame',
    status: 'clean',
    source: 'page',
    layout: { mode: 'VERTICAL' },
    sizing: { h: 'FIXED', width: v.width },
    modes: { '.Modes': opts.state.mode === 'dark' ? 'Dark-Mode' : 'Light-Mode', 'Devices-Type': 'Desktop' },
    fill: { variable: 'Background' },
    children,
  };
  return {
    schema: C2F_SCHEMA,
    app: opts.app,
    state: opts.state,
    library: { fileKey: LIBRARY.fileKey, capturedAt: LIBRARY.capturedAt },
    root,
    coverage: m.coverage(),
    normalizations: m.normalizations,
    placeholders: m.placeholders,
  };
}

/** Pre-order walk over every node, slot and nested child included. */
export function walkC2F(n: Node, visit: (x: Node, depth: number) => void, depth = 0): void {
  visit(n, depth);
  if (n.kind === 'frame' || n.kind === 'placeholder') for (const c of n.children) walkC2F(c, visit, depth + 1);
  if (n.kind === 'instance') {
    for (const x of n.nested ?? []) walkC2F(x.node, visit, depth + 1);
    for (const kids of Object.values(n.slots ?? {})) for (const c of kids) walkC2F(c, visit, depth + 1);
  }
}
