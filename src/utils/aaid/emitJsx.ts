// emitJsx.ts — IR → element tree → TSX text, plus the coverage report.
//
// Three jobs, in order:
//
//   1. DISPATCH  each IR node to its table mapper (propTables.ts), or to the
//                layout rules for auto-layout frames, or to a FALLBACK.
//   2. LAYOUT    decide, once per auto-layout parent, how its children align —
//                rules 2a / 2b / 2d — and hand each child the style it must
//                carry (flexGrow, alignSelf, FIXED px).
//   3. PRINT     with one deterministic printer: attributes and style keys in
//                code-point order, imports sorted, one fixed line width.
//
// ── Why not Prettier ───────────────────────────────────────────────────────
//
// Prettier 3's API is async and its standalone build is ~1 MB of parser, which
// this module would drag into the studio's browser bundle. And the promise is
// byte-identical output for identical input: output that depends on which
// Prettier version is installed breaks that the day someone bumps it. The
// printer below has no options and no version.
//
// ── FALLBACK markers ───────────────────────────────────────────────────────
//
// Anything not mappable with certainty becomes
//
//     {/* FALLBACK: <reason> · node <id> · <name> */}
//
// in place of the element, and an entry in report.fallbacks. A later, much
// smaller model call handles exactly those nodes (figmaToCode.ts,
// buildFallbackPrompt). The compiler never guesses: a guess here would be a
// confident wrong answer with no marker, which is the worst outcome.

import { IRIndex, subtreeSize, walkIR, type IRDocument, type IRNode } from './ir';
import { el, LIB_MODULE, str, n as num, style as styleProp, type JsxElement, type JsxFallback, type JsxNode, type PropValue } from './jsx';
import {
  componentKindFromName, DETACHED_NAMES, elevationFromMode, isListRow, listProps, mapAvatar, mapButton, mapCard,
  mapCheckbox, mapChip, mapDivider, mapIcon, mapListItem, mapRatio, mapTag, mapTypography, paddingShorthand,
  spacing, themeAndSurface, applyVariantTable, type MapCtx, type Slot,
} from './propTables';

// ── Report shapes ───────────────────────────────────────────────────────────

export interface FallbackEntry {
  id: string;
  name: string;
  reason: string;
  /** 'self' = only this node's own layout is unresolved; its children were
   *  compiled and are in the code. Absent = the whole subtree is the fallback. */
  scope?: 'self';
}
export interface NoteEntry { id: string; name: string; message: string }

export interface CompileTree {
  root: JsxNode;
  fallbacks: FallbackEntry[];
  notes: NoteEntry[];
  derived: string[];
  coverage: { compiled: number; visible: number; ratio: number };
}

// ── Layout (rules 2a, 2b, 2d) ───────────────────────────────────────────────

interface ParentLayout {
  direction: 'row' | 'column';
  /** alignSelf each child must carry, when it differs from the parent's alignItems. */
  childAlign: Map<IRNode, string>;
}

const COUNTER_CSS: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };
const PRIMARY_CSS: Record<string, string> = { CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };

/**
 * How a stack aligns its children on the cross axis.
 *
 * Figma states alignment per CHILD (Fill container vs Hug) on top of one
 * counter-axis setting; CSS states it once on the parent, overridable per
 * child. Both representations below are faithful — pick the one needing fewer
 * per-child overrides, ties going to stretch. Deterministic either way.
 */
function crossAlignment(n: IRNode): { parentAlign: string; childAlign: Map<IRNode, string> } {
  const kids = n.children ?? [];
  const axis = n.layout!.direction === 'column' ? 'h' : 'v';
  const counter = COUNTER_CSS[n.layout!.counter ?? 'MIN'];
  const fill = kids.filter((k) => k.sizing?.[axis] === 'FILL');
  const nonFill = kids.filter((k) => k.sizing?.[axis] !== 'FILL');
  /* Under stretch, a HUG child needs alignSelf to stop stretching; a FIXED one
     only when the counter axis is not the start (a sized box sits at start). */
  const needsUnderStretch = nonFill.filter((k) => k.sizing?.[axis] !== 'FIXED' || counter !== 'flex-start');
  const costStretch = needsUnderStretch.length;
  const costCounter = fill.length;
  const childAlign = new Map<IRNode, string>();
  if (!kids.length) return { parentAlign: 'stretch', childAlign };
  if (fill.length && costStretch <= costCounter) {
    for (const k of needsUnderStretch) childAlign.set(k, counter);
    return { parentAlign: 'stretch', childAlign };
  }
  for (const k of fill) childAlign.set(k, 'stretch');
  return { parentAlign: counter, childAlign };
}

// ── The compiler ────────────────────────────────────────────────────────────

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'REGULAR_POLYGON']);
const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'SLOT']);
const PAGE_FRAME = /^(mobile|tablet|tab|web|desktop)\b/i;

class Compiler implements MapCtx {
  readonly index: IRIndex;
  readonly fallbacks: FallbackEntry[] = [];
  readonly notes: NoteEntry[] = [];
  readonly derivedLines: string[] = [];
  private fallbackIds = new Set<string>();
  private parentLayout = new Map<IRNode, ParentLayout>();
  private readonly hasNotes: boolean;

  readonly doc: IRDocument;

  constructor(doc: IRDocument) {
    this.doc = doc;
    this.index = new IRIndex(doc.root);
    this.hasNotes = doc.stats.withNote > 0;
  }

  // MapCtx ------------------------------------------------------------------

  mode(n: IRNode, collection: string, defaultMode: string): string;
  mode(n: IRNode, collection: string): string | undefined;
  mode(n: IRNode, collection: string, defaultMode?: string): string | undefined {
    return defaultMode === undefined ? this.index.mode(n, collection) : this.index.mode(n, collection, defaultMode);
  }

  fallback(n: IRNode, reason: string, scope?: 'self'): JsxFallback {
    const key = `${n.id}\u0000${reason}`;
    if (!this.fallbackIds.has(key)) {
      this.fallbackIds.add(key);
      this.fallbacks.push(scope ? { id: n.id, name: n.name, reason, scope } : { id: n.id, name: n.name, reason });
    }
    return { kind: 'fallback', id: n.id, name: n.name, reason };
  }

  note(n: IRNode, message: string): void {
    if (!this.notes.some((x) => x.id === n.id && x.message === message)) this.notes.push({ id: n.id, name: n.name, message });
  }

  derived(line: string): void {
    if (!this.derivedLines.includes(line)) this.derivedLines.push(line);
  }

  layoutStyle(n: IRNode, opts: { box?: boolean } = {}): Array<[string, string | number]> {
    const s: Array<[string, string | number]> = [];
    const pl = this.parentLayout.get(n);
    if (pl) {
      const main = pl.direction === 'column' ? 'v' : 'h';
      if (n.sizing?.[main] === 'FILL') s.push(['flexGrow', 1]);
      const a = pl.childAlign.get(n);
      if (a) s.push(['alignSelf', a]);
    }
    if (opts.box && n.box) {
      if (n.sizing?.h === 'FIXED') s.push(['width', n.box.w]);
      if (n.sizing?.v === 'FIXED') s.push(['height', n.box.h]);
    }
    return s;
  }

  compile(n: IRNode, slot: Slot): JsxNode | null {
    if (n.visibleWhen) return this.fallback(n, `visibility bound to variable "${n.visibleWhen}" — needs a breakpoint or prop decision`);
    if (n.absolute) return this.fallback(n, 'absolute positioning inside auto-layout');

    const kind = componentKindFromName(n.component ?? (n.type === 'INSTANCE' ? n.name : undefined));
    if (n.type === 'INSTANCE' || n.component) {
      if (!kind) {
        return this.fallback(n, n.component
          ? `unknown component "${n.component}"`
          : 'instance without a resolved component (no plugin note — re-run Export to Code)');
      }
      switch (kind) {
        case 'button': return mapButton(n, this);
        case 'checkbox': return mapCheckbox(n, this);
        case 'divider': return mapDivider(n, this);
        case 'ratio': return mapRatio(n, this, slot);
        case 'avatar': return mapAvatar(n, this);
        case 'typography': return mapTypography(n, this);
        case 'chip': return mapChip(n, this);
        case 'tag': return mapTag(n, this);
        case 'card': return mapCard(n, this);
        case 'icon': return mapIcon(n, this);
        case 'box': return this.container(n, true);
        case 'list':
        case 'listItem':
          if (isListRow(n)) return el('List', this.layoutStyleProps(n), [mapListItem(n, this)]);
          if (kind === 'list') {
            /* The live List set holds its rows in a "List Slot"; older files
               put the rows directly under the instance. */
            const kids = n.children ?? [];
            const rows = kids.length === 1 && /^list slot$/i.test(kids[0].name) ? kids[0].children ?? [] : kids;
            return el('List', [...listProps(n, this), ...this.layoutStyleProps(n)], this.children(n, true, rows));
          }
          return this.fallback(n, 'list item without start / text / end slots');
      }
    }
    if (n.type === 'TEXT') return mapTypography(n, this);
    if (CONTAINER_TYPES.has(n.type)) {
      if (n.type === 'FRAME' && DETACHED_NAMES.includes(n.name)) return this.fallback(n, `looks like a detached instance of ${n.name}`);
      return this.container(n, false);
    }
    if (n.type === 'RECTANGLE') {
      if (n.fills?.includes('image')) return this.fallback(n, 'image fill outside a Ratio slot');
      return this.fallback(n, n.tokens?.fills ? 'raw rectangle (bound fill) — not a lib component' : 'raw rectangle with a literal fill');
    }
    if (VECTOR_TYPES.has(n.type)) return this.fallback(n, 'vector artwork');
    return this.fallback(n, `unsupported node type ${n.type}`);
  }

  private layoutStyleProps(n: IRNode): Array<[string, PropValue]> {
    const s = this.layoutStyle(n, { box: false });
    return s.length ? [['style', styleProp(s)]] : [];
  }

  /** Children of a stack, with consecutive list rows grouped into one <List>. */
  private children(n: IRNode, insideList = false, kids: IRNode[] = n.children ?? []): JsxNode[] {
    const out: JsxNode[] = [];
    let run: IRNode[] = [];
    const flush = () => {
      if (!run.length) return;
      const items = run.map((r) => mapListItem(r, this));
      if (insideList) out.push(...items);
      else {
        /* The group takes the first row's place in the parent's layout. */
        const s = this.layoutStyle(run[0], { box: false });
        if (run.length > 1 && n.layout?.gap) this.note(run[0], `${run.length} rows grouped into one <List>; the parent's ${n.layout.gap}px gap between them is not applied`);
        out.push(el('List', s.length ? [['style', styleProp(s)]] : [], items));
      }
      run = [];
    };
    for (const k of kids) {
      if (isListRow(k)) { run.push(k); continue; }
      flush();
      if (insideList) this.note(k, 'non-row child inside a List — emitted as-is');
      const c = this.compile(k, 'flow');
      if (c) out.push(c);
    }
    flush();
    return out;
  }

  /** Auto-layout frames, Box instances, and the frames that are neither. */
  private container(n: IRNode, isBoxInstance: boolean): JsxNode | null {
    const ts = themeAndSurface(n.modes?.Theme, n.modes?.Surface);
    for (const p of ts.problems) this.note(n, p);
    const level = elevationFromMode(n.modes?.Elevation ?? n.modes?.Effects);
    const paints = !!(ts.theme || ts.surface || (level && level > 0));
    const kids = n.children ?? [];
    const isRoot = this.index.parent(n) === null;

    if (n.fills?.includes('solid') && !n.tokens?.fills && !ts.theme && !ts.surface) {
      this.note(n, this.hasNotes
        ? 'literal fill with no Theme/Surface mode — not expressed (rule 0: absent modes mean Default)'
        : 'fill with no plugin note — the fill-colour theme guess (rule 3a) is not made deterministically');
    }
    if (n.radius && !isBoxInstance) this.note(n, `corner radius ${n.radius}px not expressed — Box radius takes Card radius steps, never a literal`);
    if (n.fills?.includes('image')) return this.fallback(n, 'image fill on a frame (no Ratio slot)');

    const boxProps = (): Array<[string, PropValue]> => {
      const p: Array<[string, PropValue]> = [];
      if (ts.theme) p.push(['theme', str(ts.theme)]);
      if (ts.surface) p.push(['surface', str(ts.surface)]);
      if (level) p.push(['elevation', num(level)]);
      if (isBoxInstance) {
        const mapped = applyVariantTable('Box', n.props);
        for (const u of mapped.unmapped) this.note(n, `variant ${u} not mapped`);
        p.push(...mapped.props);
      }
      return p;
    };

    if (!n.layout) {
      if (kids.length > 1) {
        /* Positions are not layout the lib can express, but the children
           are still components the tables CAN map. So only this frame's own
           arrangement is the fallback; its children compile, in reading
           order (top to bottom, then left to right — never z-order). */
        const marker = this.fallback(n, 'frame without auto-layout — children are absolutely placed; arrange them', 'self');
        const ordered = kids.map((k, i) => ({ k, i })).sort((a, b) => {
          const ay = a.k.at?.y ?? 0; const by = b.k.at?.y ?? 0;
          if (ay !== by) return ay - by;
          const ax = a.k.at?.x ?? 0; const bx = b.k.at?.x ?? 0;
          return ax !== bx ? ax - bx : a.i - b.i;
        }).map((x) => x.k);
        const compiled = this.children(n, false, ordered);
        const s = this.layoutStyle(n, { box: true });
        return el('Box', [...boxProps(), ...(s.length ? [['style', styleProp(s)] as [string, PropValue]] : [])], [marker, ...compiled]);
      }
      if (kids.length === 1 && !paints && !isBoxInstance) {
        /* A wrapper with no layout and no paint is transparent: the child
           takes its place (and its slot in the grandparent's layout). */
        const pl = this.parentLayout.get(n);
        if (pl) this.parentLayout.set(kids[0], pl);
        return this.compile(kids[0], 'flow');
      }
      const s = this.layoutStyle(n, { box: true });
      const child = kids.length === 1 ? this.compile(kids[0], 'flow') : null;
      return el('Box', [...boxProps(), ...(s.length ? [['style', styleProp(s)] as [string, PropValue]] : [])], child ? [child] : []);
    }

    const layout = n.layout;
    const { parentAlign, childAlign } = crossAlignment(n);
    for (const k of kids) this.parentLayout.set(k, { direction: layout.direction, childAlign });
    const children = this.children(n);
    const gap = layout.gap ? spacing(layout.gap, n.tokens?.itemSpacing) : undefined;
    if (gap && !gap.onScale) this.note(n, `gap ${layout.gap}px is off the Sizing scale — kept as a literal`);
    const pad = layout.padding ? paddingShorthand(layout.padding, n.tokens ?? {}) : undefined;
    if (pad?.offScale.length) this.note(n, `padding ${pad.offScale.join('/')}px is off the Sizing scale — kept as a literal`);
    const justify = layout.primary ? PRIMARY_CSS[layout.primary] : undefined;
    const own = this.layoutStyle(n, { box: true });

    const isPage = isRoot && PAGE_FRAME.test(n.name);
    let result: JsxElement;
    if ((paints || isBoxInstance) && !isPage) {
      /* rule 4h: a container that paints is a Box carrying the frame's real
         spec. A frame that sets a theme but has NO fill and no shadow paints
         nothing — that is ThemedZone (attributes only). */
      const attrsOnly = !isBoxInstance && !level && Array.isArray(n.fills) && n.fills.length === 0;
      const s: Array<[string, string | number]> = [['display', 'flex'], ['flexDirection', layout.direction]];
      if (gap) s.push(['gap', gap.css]);
      if (pad) s.push(['padding', pad.css]);
      if (parentAlign !== 'stretch') s.push(['alignItems', parentAlign]);
      if (justify) s.push(['justifyContent', justify]);
      if (layout.wrap) s.push(['flexWrap', 'wrap']);
      s.push(...own);
      const props = attrsOnly
        ? [ts.theme ? ['theme', str(ts.theme)] : null, ts.surface ? ['surface', str(ts.surface)] : null].filter(Boolean) as Array<[string, PropValue]>
        : boxProps();
      result = el(attrsOnly ? 'ThemedZone' : 'Box', [...props, ['style', styleProp(s)]], children);
      return result;
    }

    const tag = layout.direction === 'column' ? 'VStack' : 'HStack';
    const props: Array<[string, PropValue]> = [];
    if (gap) props.push(['gap', str(gap.css)]);
    const defaultAlign = tag === 'HStack' ? 'center' : 'stretch';
    if (parentAlign !== defaultAlign) props.push(['alignItems', str(parentAlign)]);
    if (justify) props.push(['justifyContent', str(justify)]);
    if (layout.wrap) props.push(['flexWrap', str('wrap')]);
    const s: Array<[string, string | number]> = [];
    if (pad) s.push(['padding', pad.css]);
    s.push(...(isPage ? own.filter(([k]) => k !== 'width') : own));
    if (s.length) props.push(['style', styleProp(s)]);
    result = el(tag, props, children);
    if (isPage) {
      /* rule 1: a page frame is Section (paint) > Container (width) > content. */
      const sp: Array<[string, PropValue]> = [];
      if (ts.theme) sp.push(['theme', str(ts.theme)]);
      if (ts.surface) sp.push(['surface', str(ts.surface)]);
      return el('Section', sp, [el('Container', [], [result])]);
    }
    return result;
  }

  run(): CompileTree {
    const root = this.compile(this.doc.root, 'flow') ?? this.fallback(this.doc.root, 'nothing to render');
    /* Coverage: visible nodes not inside any FALLBACK subtree. */
    const failed = new Set(this.fallbacks.filter((f) => !f.scope).map((f) => f.id));
    const selfOnly = new Set(this.fallbacks.filter((f) => f.scope === 'self').map((f) => f.id));
    let visible = 0;
    let uncovered = 0;
    walkIR(this.doc.root, () => { visible += 1; });
    const skip = (x: IRNode) => {
      if (failed.has(x.id)) { uncovered += subtreeSize(x); return; }
      if (selfOnly.has(x.id)) uncovered += 1;
      for (const c of x.children ?? []) skip(c);
    };
    skip(this.doc.root);
    const compiled = visible - uncovered;
    return {
      root,
      fallbacks: this.fallbacks,
      notes: this.notes,
      derived: this.derivedLines,
      coverage: { compiled, visible, ratio: visible ? Math.round((compiled / visible) * 10000) / 10000 : 0 },
    };
  }
}

export function compileTree(doc: IRDocument): CompileTree {
  return new Compiler(doc).run();
}

// ── Printer ─────────────────────────────────────────────────────────────────

const WIDTH = 100;
const IND = '  ';

/** Code-point order — never localeCompare, whose answer depends on the machine. */
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function jsString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`;
}

function commentSafe(s: string): string {
  return s.replace(/\*\//g, '* /').replace(/\n/g, ' ');
}

function fallbackText(f: JsxFallback): string {
  return `FALLBACK: ${commentSafe(f.reason)} · node ${commentSafe(f.id)} · ${commentSafe(f.name)}`;
}

function styleText(entries: Array<[string, string | number]>): string {
  const sorted = [...entries].sort((a, b) => byCodePoint(a[0], b[0]));
  return `{{ ${sorted.map(([k, v]) => `${k}: ${typeof v === 'number' ? String(v) : jsString(v)}`).join(', ')} }}`;
}

/** An attribute as lines (most are one line; a nested element may be several). */
function attrLines(name: string, v: PropValue, indent: string): string[] {
  switch (v.kind) {
    case 'true': return [name];
    case 'number': return [`${name}={${v.value}}`];
    case 'string':
      return /["\n\r]/.test(v.value) ? [`${name}={${jsString(v.value)}}`] : [`${name}="${v.value}"`];
    case 'style': {
      const one = `${name}=${styleText(v.value)}`;
      if (indent.length + one.length <= WIDTH) return [one];
      const sorted = [...v.value].sort((a, b) => byCodePoint(a[0], b[0]));
      return [`${name}={{`, ...sorted.map(([k, x]) => `${IND}${k}: ${typeof x === 'number' ? String(x) : jsString(x)},`), '}}'];
    }
    case 'node': {
      if (v.value.kind === 'fallback') return [`${name}={null /* ${fallbackText(v.value)} */}`];
      if (v.value.kind === 'text') return [`${name}={${jsString(v.value.value)}}`];
      if (v.value.kind === 'comment') return [`${name}={null /* ${commentSafe(v.value.value)} */}`];
      const inner = printNode(v.value, indent).map((l) => l.slice(indent.length));
      if (inner.length === 1) return [`${name}={${inner[0].trimStart()}}`];
      return [`${name}={`, ...inner.map((l) => IND + l), '}'];
    }
  }
}

function textChild(s: string): string {
  if (s.length && /^[^{}<>\n\r&]*$/.test(s) && s.trim() === s) return s;
  return `{${jsString(s)}}`;
}

/** Print a node; returned lines already carry `indent`. */
export function printNode(nd: JsxNode, indent = ''): string[] {
  if (nd.kind === 'text') return [indent + textChild(nd.value)];
  if (nd.kind === 'fallback') return [`${indent}{/* ${fallbackText(nd)} */}`];
  if (nd.kind === 'comment') return [`${indent}{/* ${commentSafe(nd.value)} */}`];
  const tag = nd.tag;
  const props = [...nd.props].sort((a, b) => {
    if (a[0] === 'style') return 1;
    if (b[0] === 'style') return -1;
    return byCodePoint(a[0], b[0]);
  });
  const attrs = props.map(([k, v]) => attrLines(k, v, indent + IND));
  const flat = attrs.every((a) => a.length === 1);
  const attrInline = flat ? attrs.map((a) => ' ' + a[0]).join('') : '';
  const open = `<${tag}`;

  const childLines = nd.children.flatMap((c) => printNode(c, indent + IND));
  const onlyText = nd.children.length === 1 && nd.children[0].kind === 'text';

  if (!nd.children.length) {
    const one = `${indent}${open}${attrInline} />`;
    if (flat && one.length <= WIDTH) return [one];
    return [`${indent}${open}`, ...attrs.flatMap((a) => a.map((l) => indent + IND + l)), `${indent}/>`];
  }
  const close = `</${tag}>`;
  if (flat) {
    const head = `${indent}${open}${attrInline}>`;
    if (onlyText) {
      const one = `${head}${childLines[0].trim()}${close}`;
      if (one.length <= WIDTH) return [one];
    }
    if (head.length <= WIDTH) return [head, ...childLines, indent + close];
  }
  return [`${indent}${open}`, ...attrs.flatMap((a) => a.map((l) => indent + IND + l)), `${indent}>`, ...childLines, indent + close];
}

// ── The file ────────────────────────────────────────────────────────────────

function collectImports(nd: JsxNode, lib: Set<string>, defaults: Map<string, string>): void {
  if (nd.kind !== 'element') return;
  if (nd.tag) {
    if (nd.module && nd.module !== LIB_MODULE) defaults.set(nd.module, nd.tag);
    else lib.add(nd.tag);
  }
  for (const [, v] of nd.props) if (v.kind === 'node') collectImports(v.value, lib, defaults);
  for (const c of nd.children) collectImports(c, lib, defaults);
}

/** A valid component identifier from a frame name. */
export function componentName(frameName: string): string {
  const words = frameName.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!name) return 'FigmaFrame';
  return /^[0-9]/.test(name) ? `Figma${name}` : name;
}

export interface EmitMeta {
  rootId: string;
  rootName: string;
  coverage: CompileTree['coverage'];
  fallbackCount: number;
  derived: string[];
}

export const COMPILER_VERSION = 1;

/** The whole TSX file. Valid as .jsx too — it carries no type syntax (rule 5). */
export function emitFile(tree: JsxNode, meta: EmitMeta): string {
  const lib = new Set<string>();
  const defaults = new Map<string, string>();
  collectImports(tree, lib, defaults);

  const lines: string[] = [];
  lines.push(`// Generated by the DinoDesign deterministic Figma compiler v${COMPILER_VERSION}. Same input, same bytes.`);
  lines.push(`// Source: node ${commentSafe(meta.rootId)} · ${commentSafe(meta.rootName)}`);
  lines.push(`// Coverage: ${meta.coverage.compiled}/${meta.coverage.visible} visible nodes compiled · ${meta.fallbackCount} FALLBACK`);
  for (const d of meta.derived) lines.push(`// DERIVED-ARIA-LABEL: ${commentSafe(d)}`);

  const libNames = [...lib].sort(byCodePoint);
  if (libNames.length) {
    const one = `import { ${libNames.join(', ')} } from '${LIB_MODULE}';`;
    if (one.length <= WIDTH) lines.push(one);
    else lines.push('import {', ...libNames.map((x) => `${IND}${x},`), `} from '${LIB_MODULE}';`);
  }
  /* A module written as "path#Export" is a NAMED import — @omni-design/icons
     0.2.0 serves its non-filled styles as one module per style
     (`import { AddRounded as AddRoundedIcon } from '@omni-design/icons/rounded'`). */
  for (const mod of [...defaults.keys()].sort(byCodePoint)) {
    const hash = mod.indexOf('#');
    lines.push(hash < 0
      ? `import ${defaults.get(mod)} from '${mod}';`
      : `import { ${mod.slice(hash + 1)} as ${defaults.get(mod)} } from '${mod.slice(0, hash)}';`);
  }

  lines.push('');
  lines.push(`export default function ${componentName(meta.rootName)}() {`);
  const body = tree.kind === 'element' ? tree : el('', [], [tree]);
  lines.push(`${IND}return (`);
  lines.push(...printNode(body, IND + IND));
  lines.push(`${IND});`);
  lines.push('}');
  return lines.join('\n') + '\n';
}
