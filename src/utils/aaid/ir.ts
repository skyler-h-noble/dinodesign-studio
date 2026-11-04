// ir.ts — the canonical intermediate representation the deterministic Figma
// compiler works from.
//
// ── Why an IR at all ────────────────────────────────────────────────────────
//
// A Figma frame reaches the studio in three shapes, and all three carry the
// same facts in different places:
//
//   REST           GET /v1/files/:key/nodes?plugin_data=shared. Types upper
//                  case, the plugin's note is a JSON STRING at
//                  sharedPluginData.dino.aaid, sizes in absoluteBoundingBox.
//   enriched tree  the plugin's own "copy data" payload (aaidEnrichedTree):
//                  the note's keys spread straight onto each node.
//   lifted REST    REST after figmaToCode's attachAaidNotes: the note parsed
//                  onto node._aaid.
//
// The compiler should not care which one it got, and it must not be able to
// read the same fact two ways in two places. So everything is normalized once,
// here, into one record per node with sorted keys and every default stripped.
// Two frames that mean the same thing produce byte-identical IR, which is what
// makes the emitted code byte-identical too.
//
// ── What "default-stripped" means here ──────────────────────────────────────
//
//   sizing HUG       dropped — HUG emits nothing (rule 2d)
//   gap 0, pad 0     dropped
//   align MIN        dropped — MIN is the absence of an alignment
//   mode "Auto …"    dropped — the plugin records only explicit modes, and an
//                    "Auto" value is inheritance, which the tree reconstructs
//   hidden nodes     dropped entirely (rule 0b), except a node whose
//                    visibility is BOUND to a variable (visibleWhen) — that is
//                    a condition, not a decision, and is kept
//
// The IR is pure data: no functions, no parent pointers, nothing that depends
// on object identity. Parent lookups live in a side table built by buildIR.

import { resolveMode, type ModeNode } from '../figmaModeMapping';

// ── Public shapes ───────────────────────────────────────────────────────────

export type AlignValue = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'BASELINE';

export interface IRLayout {
  direction: 'row' | 'column';
  gap?: number;
  /** top, right, bottom, left — omitted when all four are zero. */
  padding?: [number, number, number, number];
  primary?: AlignValue;
  counter?: AlignValue;
  wrap?: true;
}

export interface IRSizing {
  h?: 'FIXED' | 'FILL';
  v?: 'FIXED' | 'FILL';
}

export interface IRListInfo {
  type?: 'ORDERED' | 'UNORDERED';
  indent?: number;
  lines?: Array<{ t: string; i: number }>;
}

export interface IRText {
  content: string;
  /** The named text style, when the file says which one. */
  style?: string;
  list?: IRListInfo;
}

export type IRFill = 'solid' | 'image' | 'gradient';

export interface IRNode {
  id: string;
  name: string;
  /** Upper-case Figma node type (FRAME, INSTANCE, TEXT, VECTOR, …). */
  type: string;
  /** Resolved component-set (or component) name, for instances. */
  component?: string;
  /** Instance variant / component properties, '#id' suffix stripped. */
  props?: Record<string, string>;
  /** EXPLICIT modes only, bare collection names, "Auto" removed. */
  modes?: Record<string, string>;
  layout?: IRLayout;
  sizing?: IRSizing;
  /** Rounded pixel box — the source of every FIXED size. */
  box?: { w: number; h: number };
  /** Rounded position — only used to put absolutely placed siblings in
   *  reading order (top to bottom, then left to right). */
  at?: { x: number; y: number };
  /** Bound-variable NAMES by property (fills, itemSpacing, …). */
  tokens?: Record<string, string>;
  text?: IRText;
  /** Visible paints, by kind. Absent = unknown (the enriched tree has none). */
  fills?: IRFill[];
  radius?: number;
  /** layoutPositioning ABSOLUTE inside an auto-layout parent. */
  absolute?: true;
  /** Visibility bound to this variable — render behind a condition. */
  visibleWhen?: string;
  /** The plugin stamped a note on this node. */
  note?: true;
  children?: IRNode[];
}

export interface IRStats {
  /** Nodes in the input, hidden ones included. */
  nodes: number;
  /** Nodes that carried a plugin note. */
  withNote: number;
  /** Hidden nodes dropped (their subtrees are not counted separately). */
  pruned: number;
}

export interface IRDocument {
  root: IRNode;
  stats: IRStats;
}

/** Side data for a REST payload: the file's style and component tables. */
export interface IROptions {
  /** styleId -> { name } — json.nodes[id].styles on a REST response. */
  styles?: Record<string, { name?: string }>;
  /** componentId -> { name, componentSetId } — json.nodes[id].components. */
  components?: Record<string, { name?: string; componentSetId?: string }>;
  /** componentSetId -> { name } — json.nodes[id].componentSets. */
  componentSets?: Record<string, { name?: string }>;
}

// ── Reading one raw node ────────────────────────────────────────────────────

/** Keys the plugin's note can carry (aaidNodeRecord in the plugin). */
const NOTE_KEYS = ['modes', 'boundVars', 'visible', 'visibleWhen', 'visibleNow', 'sizingH', 'sizingV', 'layout', 'variant', 'component', 'list'];

/**
 * The plugin note for a node, from whichever of the three shapes it arrived in.
 * Returns null when the node carries none.
 */
export function readNote(raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  const shared = raw.sharedPluginData?.dino?.aaid;
  if (typeof shared === 'string' && shared) {
    try {
      const parsed = JSON.parse(shared);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* a malformed note is no note */ }
  }
  if (raw._aaid && typeof raw._aaid === 'object') return raw._aaid;
  /* The enriched tree spreads the note onto the node. `visible` alone is not
     enough to call it a note — REST nodes carry their own `visible` — so only
     the keys REST never uses count. */
  const inline: Record<string, any> = {};
  let found = false;
  for (const k of NOTE_KEYS) {
    if (k in raw && k !== 'visible') {
      inline[k] = raw[k];
      found = true;
    }
  }
  if (found && raw.visible === false) inline.visible = false;
  return found ? inline : null;
}

function bareCollection(name: string): string {
  return name.replace(/^[._]+/, '');
}

function isAuto(value: string): boolean {
  return /^auto\b/i.test(value.trim());
}

function readModes(note: Record<string, any> | null): Record<string, string> | undefined {
  const m = note?.modes;
  if (!m || typeof m !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (typeof v !== 'string' || !v || isAuto(v)) continue;
    const bare = bareCollection(k);
    /* A bare key wins over a dotted duplicate — the newer plugin writes bare. */
    if (bare in out && bare !== k) continue;
    out[bare] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function readProps(raw: any, note: Record<string, any> | null): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  const vp = note?.variant;
  if (vp && typeof vp === 'object') {
    for (const k of Object.keys(vp)) {
      const v = vp[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[stripHash(k)] = String(v);
    }
  } else if (raw.componentProperties && typeof raw.componentProperties === 'object') {
    for (const k of Object.keys(raw.componentProperties)) {
      const v = raw.componentProperties[k]?.value;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[stripHash(k)] = String(v);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function stripHash(key: string): string {
  const i = key.indexOf('#');
  return i >= 0 ? key.slice(0, i) : key;
}

function readComponent(raw: any, note: Record<string, any> | null, opts: IROptions): string | undefined {
  if (typeof note?.component === 'string' && note.component) return note.component;
  const cid = raw.componentId;
  if (typeof cid === 'string' && opts.components?.[cid]) {
    const c = opts.components[cid];
    const set = c.componentSetId ? opts.componentSets?.[c.componentSetId]?.name : undefined;
    return set || c.name || undefined;
  }
  return undefined;
}

const ALIGN: Record<string, AlignValue> = {
  MIN: 'MIN', CENTER: 'CENTER', MAX: 'MAX', SPACE_BETWEEN: 'SPACE_BETWEEN', BASELINE: 'BASELINE',
};

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
}

function readLayout(raw: any, note: Record<string, any> | null): IRLayout | undefined {
  const nl = note?.layout;
  let mode: string | undefined;
  let gap = 0;
  let pad: [number, number, number, number] = [0, 0, 0, 0];
  let primary: string | undefined;
  let counter: string | undefined;
  let wrap = false;
  if (nl && typeof nl === 'object' && nl.mode) {
    mode = nl.mode;
    gap = num(nl.gap);
    pad = [num(nl.padTop), num(nl.padRight), num(nl.padBottom), num(nl.padLeft)];
    primary = nl.primaryAxis;
    counter = nl.counterAxis;
    wrap = nl.wrap === 'WRAP';
  } else if (raw.layoutMode && raw.layoutMode !== 'NONE') {
    mode = raw.layoutMode;
    gap = num(raw.itemSpacing);
    pad = [num(raw.paddingTop), num(raw.paddingRight), num(raw.paddingBottom), num(raw.paddingLeft)];
    primary = raw.primaryAxisAlignItems;
    counter = raw.counterAxisAlignItems;
    wrap = raw.layoutWrap === 'WRAP';
  }
  if (mode !== 'VERTICAL' && mode !== 'HORIZONTAL') return undefined;
  const out: IRLayout = { direction: mode === 'VERTICAL' ? 'column' : 'row' };
  if (gap) out.gap = gap;
  if (pad.some((p) => p !== 0)) out.padding = pad;
  const p = primary ? ALIGN[primary] : undefined;
  if (p && p !== 'MIN') out.primary = p;
  const c = counter ? ALIGN[counter] : undefined;
  if (c && c !== 'MIN') out.counter = c;
  if (wrap) out.wrap = true;
  return out;
}

function readSizing(raw: any, note: Record<string, any> | null): IRSizing | undefined {
  const h = note?.sizingH ?? raw.layoutSizingHorizontal;
  const v = note?.sizingV ?? raw.layoutSizingVertical;
  const out: IRSizing = {};
  if (h === 'FIXED' || h === 'FILL') out.h = h;
  if (v === 'FIXED' || v === 'FILL') out.v = v;
  return out.h || out.v ? out : undefined;
}

function readBox(raw: any): { w: number; h: number } | undefined {
  const bb = raw.absoluteBoundingBox;
  if (bb && typeof bb.width === 'number') return { w: Math.round(bb.width), h: Math.round(bb.height) };
  if (raw.size && typeof raw.size.x === 'number') return { w: Math.round(raw.size.x), h: Math.round(raw.size.y) };
  if (typeof raw.width === 'number' && typeof raw.height === 'number') return { w: Math.round(raw.width), h: Math.round(raw.height) };
  return undefined;
}

function readTokens(note: Record<string, any> | null): Record<string, string> | undefined {
  const bv = note?.boundVars;
  if (!bv || typeof bv !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(bv)) if (typeof bv[k] === 'string' && bv[k]) out[k] = bv[k];
  return Object.keys(out).length ? out : undefined;
}

function readFills(raw: any): IRFill[] | undefined {
  if (!Array.isArray(raw.fills)) return undefined;
  const out: IRFill[] = [];
  for (const f of raw.fills) {
    if (!f || f.visible === false) continue;
    if (f.type === 'SOLID') out.push('solid');
    else if (f.type === 'IMAGE') out.push('image');
    else if (typeof f.type === 'string' && f.type.startsWith('GRADIENT')) out.push('gradient');
  }
  return out;
}

function readText(raw: any, note: Record<string, any> | null, opts: IROptions): IRText | undefined {
  if (normalizeType(raw.type) !== 'TEXT') return undefined;
  const content = typeof raw.characters === 'string' ? raw.characters : '';
  const out: IRText = { content };
  const styleId = raw.styles?.text;
  const style = (typeof raw.styleName === 'string' && raw.styleName)
    || (typeof styleId === 'string' ? opts.styles?.[styleId]?.name : undefined);
  if (style) out.style = style;
  const list = note?.list;
  if (list && typeof list === 'object') {
    const l: IRListInfo = {};
    if (list.type === 'ORDERED' || list.type === 'UNORDERED') l.type = list.type;
    if (typeof list.indent === 'number' && list.indent) l.indent = list.indent;
    if (Array.isArray(list.lines)) l.lines = list.lines.map((x: any) => ({ t: String(x?.t ?? 'N'), i: num(x?.i) }));
    if (l.type || l.lines) out.list = l;
  }
  return out;
}

export function normalizeType(t: unknown): string {
  return typeof t === 'string' ? t.toUpperCase() : 'UNKNOWN';
}

function isHidden(raw: any, note: Record<string, any> | null): boolean {
  if (note?.visibleWhen) return false; // a condition, never a decision
  return raw.visible === false || raw.hidden === true || note?.visible === false;
}

// ── Building the tree ───────────────────────────────────────────────────────

function countNodes(raw: any): number {
  if (!raw || typeof raw !== 'object') return 0;
  let n = 1;
  if (Array.isArray(raw.children)) for (const c of raw.children) n += countNodes(c);
  return n;
}

function build(raw: any, stats: IRStats, opts: IROptions): IRNode {
  const note = readNote(raw);
  if (note) stats.withNote += 1;
  const node: IRNode = {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: normalizeType(raw.type),
  };
  const component = readComponent(raw, note, opts);
  if (component) node.component = component;
  const props = readProps(raw, note);
  if (props) node.props = props;
  const modes = readModes(note);
  if (modes) node.modes = modes;
  const layout = readLayout(raw, note);
  if (layout) node.layout = layout;
  const sizing = readSizing(raw, note);
  if (sizing) node.sizing = sizing;
  const box = readBox(raw);
  if (box) node.box = box;
  const bb = raw.absoluteBoundingBox;
  if (bb && typeof bb.x === 'number' && typeof bb.y === 'number') node.at = { x: Math.round(bb.x), y: Math.round(bb.y) };
  else if (typeof raw.x === 'number' && typeof raw.y === 'number') node.at = { x: Math.round(raw.x), y: Math.round(raw.y) };
  const tokens = readTokens(note);
  if (tokens) node.tokens = tokens;
  const text = readText(raw, note, opts);
  if (text) node.text = text;
  const fills = readFills(raw);
  if (fills) node.fills = fills;
  if (typeof raw.cornerRadius === 'number' && raw.cornerRadius > 0) node.radius = Math.round(raw.cornerRadius);
  if (raw.layoutPositioning === 'ABSOLUTE') node.absolute = true;
  if (typeof note?.visibleWhen === 'string' && note.visibleWhen) node.visibleWhen = note.visibleWhen;
  if (note) node.note = true;
  if (Array.isArray(raw.children) && raw.children.length) {
    const kids: IRNode[] = [];
    for (const c of raw.children) {
      if (!c || typeof c !== 'object') continue;
      const cn = readNote(c);
      if (isHidden(c, cn)) {
        stats.pruned += 1;
        /* The hidden subtree's notes still count as notes that arrived. */
        stats.withNote += countNotes(c);
        continue;
      }
      kids.push(build(c, stats, opts));
    }
    if (kids.length) node.children = kids;
  }
  return node;
}

function countNotes(raw: any): number {
  if (!raw || typeof raw !== 'object') return 0;
  let n = readNote(raw) ? 1 : 0;
  if (Array.isArray(raw.children)) for (const c of raw.children) n += countNotes(c);
  return n;
}

/**
 * Normalize a Figma frame (any of the three shapes) into the canonical IR.
 *
 * Pure: the input is never mutated, and the output depends on nothing but the
 * input — no clock, no randomness, no iteration over unordered state.
 */
export function buildIR(frame: unknown, opts: IROptions = {}): IRDocument {
  const raw: any = frame && typeof frame === 'object' && (frame as any).document && !(frame as any).type
    ? (frame as any).document // a REST `nodes[id]` entry rather than its document
    : frame;
  const stats: IRStats = { nodes: countNodes(raw), withNote: 0, pruned: 0 };
  /* The root is never pruned: a hidden root means the caller selected a hidden
     frame, and converting what they pointed at beats returning nothing. */
  const root = canonical(build(raw ?? {}, stats, opts)) as IRNode;
  return { root, stats };
}

/** Recursively sort object keys. Arrays keep their order — order is meaning. */
export function canonical<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => canonical(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonical(v);
    }
    return out as T;
  }
  return value;
}

/** The IR as canonical JSON — the thing two equal frames agree on byte for byte. */
export function irToJSON(doc: IRDocument): string {
  return JSON.stringify(canonical(doc));
}

// ── Walking it ──────────────────────────────────────────────────────────────

/** Parent lookups for an IR tree, kept OUT of the tree so the tree stays data. */
export class IRIndex {
  private parents = new Map<IRNode, IRNode | null>();
  private modeNames: Record<string, string> = {};

  readonly root: IRNode;

  constructor(root: IRNode) {
    this.root = root;
    const walk = (n: IRNode, parent: IRNode | null) => {
      this.parents.set(n, parent);
      if (n.modes) for (const v of Object.values(n.modes)) this.modeNames[v] = v;
      for (const c of n.children ?? []) walk(c, n);
    };
    walk(root, null);
  }

  parent(n: IRNode): IRNode | null {
    return this.parents.get(n) ?? null;
  }

  private modeNode(n: IRNode | null): ModeNode | null {
    if (!n) return null;
    const up = () => this.modeNode(this.parent(n));
    return {
      explicitVariableModes: n.modes,
      get parent() { return up(); },
    };
  }

  /**
   * The nearest ancestor-or-self's mode for a collection, or the default.
   * Same walk as figmaModeMapping.resolveMode — the IR's modes are keyed by
   * bare collection NAME, so the name doubles as the collection id.
   */
  mode(n: IRNode, collection: string, defaultMode: string): string;
  mode(n: IRNode, collection: string): string | undefined;
  mode(n: IRNode, collection: string, defaultMode?: string): string | undefined {
    const sentinel = '\u0000none';
    const got = resolveMode(this.modeNode(n), collection, this.modeNames, sentinel);
    return got === sentinel ? defaultMode : got;
  }
}

/** Every node in document order (pre-order). */
export function walkIR(n: IRNode, visit: (node: IRNode, depth: number) => void, depth = 0): void {
  visit(n, depth);
  for (const c of n.children ?? []) walkIR(c, visit, depth + 1);
}

/** Node count of a subtree, the node included. */
export function subtreeSize(n: IRNode): number {
  let k = 1;
  for (const c of n.children ?? []) k += subtreeSize(c);
  return k;
}
