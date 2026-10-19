/**
 * Bento Grid — the spec: tiles on the layout grid, each on its own surface.
 *
 * Designed once at 12 columns; tablet (8) and phone (4) spans are derived by
 * rule and can be overridden per tile. Every tile wears a theme + surface
 * level, so its Header, Text, Eyebrow and links are the system's own paired
 * colors for that surface — accessible by construction, nothing to solve.
 *
 * Plain data, like the chart and hero specs: the studio renders code from it
 * and the Figma plugin builds from it. The block between the markers is
 * copied into the plugin and held identical by chartLayoutSync.test.ts.
 */

// <bento-spec>
const BENTO_SPEC_VERSION = 'bento1';
const BENTO_KINDS = ['text', 'stat', 'image'] as const;
const BENTO_THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
const BENTO_SURFACES = ['Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest'] as const;
/** Cards: tiles with the grid's gutter and margin between them. Boxes: flush
 *  tiles, no gutter or margin, separated by their surfaces alone. */
const BENTO_STYLES = ['cards', 'boxes'] as const;
/** Desktop spans that divide a 12-column row cleanly. */
const BENTO_DESKTOP_SPANS = [3, 4, 6, 8, 12] as const;

type BentoKind = typeof BENTO_KINDS[number];
type BentoTheme = typeof BENTO_THEMES[number];
type BentoSurface = typeof BENTO_SURFACES[number];
type BentoDevice = 'desktop' | 'tablet' | 'mobile';
type BentoStyle = typeof BENTO_STYLES[number];

interface BentoTile {
  kind: BentoKind;
  eyebrow: string;
  title: string;
  body: string;
  /** A link at the foot of a text tile; '' for none. */
  action: string;
  /** A stat tile's figure and its label. */
  stat: string;
  statLabel: string;
  /** An image tile's description — '' marks it decorative. */
  alt: string;
  theme: BentoTheme;
  surface: BentoSurface;
  /** Columns of 12 on desktop, and rows (1 or 2). */
  span: number;
  rows: number;
  /** Per-device overrides; null = derived (bentoSpan). */
  tabletSpan: number | null;
  mobileSpan: number | null;
}

interface BentoSpec {
  version: string;
  name: string;
  designSystem: { id: string | null };
  style: BentoStyle;
  /** The shortest a row may be, px — rows grow to fit their content. */
  rowHeight: number;
  tiles: BentoTile[];
}

const bentoPick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const bentoNum = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};
const bentoStr = (v: unknown, d: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);

/** A tile's span on a device. Overrides win; otherwise the rule:
 *    tablet (8 columns)  half or a full row — wide tiles (6+) take the row
 *    phone (4 columns)   a full row, except the narrowest tiles (3), which pair up */
function bentoSpan(tile: BentoTile, device: BentoDevice): number {
  if (device === 'desktop') return tile.span;
  if (device === 'tablet') return tile.tabletSpan ?? (tile.span >= 6 ? 8 : 4);
  return tile.mobileSpan ?? (tile.span <= 3 ? 2 : 4);
}

/** Rows on a device: a phone keeps two-row tiles only for images, where the
 *  height is the point; text and stats sit in one row and grow to fit. */
function bentoRows(tile: BentoTile, device: BentoDevice): number {
  return device === 'mobile' && tile.kind !== 'image' ? 1 : tile.rows;
}

const BENTO_COLUMNS: Record<BentoDevice, number> = { desktop: 12, tablet: 8, mobile: 4 };

/** Where each tile lands on a device, as CSS grid places it (grid-auto-flow:
 *  row, sparse): a cursor walks the rows, each tile takes the first free area
 *  of its size at or after the cursor, and the cursor never goes back. Figma's
 *  grid needs explicit cells, so the plugin uses this to land every tile
 *  exactly where the browser does. */
function bentoPlace(tiles: BentoTile[], device: BentoDevice): { row: number; col: number; span: number; rows: number }[] {
  const cols = BENTO_COLUMNS[device];
  const taken: boolean[][] = [];
  const free = (r: number, c: number, w: number, h: number) => {
    if (c + w > cols) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken[y] && taken[y][x]) return false;
    return true;
  };
  let cr = 0; let cc = 0;
  return tiles.map((t) => {
    const w = Math.min(bentoSpan(t, device), cols);
    const h = bentoRows(t, device);
    let r = cr; let c = cc;
    while (!free(r, c, w, h)) { c++; if (c + w > cols) { c = 0; r++; } }
    for (let y = r; y < r + h; y++) { taken[y] = taken[y] || []; for (let x = c; x < c + w; x++) taken[y][x] = true; }
    cr = r; cc = c + w;
    return { row: r, col: c, span: w, rows: h };
  });
}

/** One item of a bento as a flowing (wrapping) layout: a tile, or a STACK —
 *  the one-row tiles that sit beside a two-row tile on desktop, which Figma's
 *  wrapping rows cannot place there on their own. A stack is a wrapping group
 *  with its own width per device: as wide as its column on desktop, so its
 *  tiles sit on top of each other; as wide as its tiles together elsewhere, so
 *  they sit side by side — exactly where CSS grid puts them. */
type BentoFlowItem =
  | { kind: 'tile'; index: number }
  | { kind: 'stack'; indices: number[]; widths: Record<BentoDevice, number> };

function bentoFlow(tiles: BentoTile[]): BentoFlowItem[] {
  const placed = bentoPlace(tiles, 'desktop');
  const inStack = new Set<number>();
  const stacks = new Map<number, number[]>();   // first member -> members
  tiles.forEach((t, i) => {
    if (bentoRows(t, 'desktop') !== 2) return;
    const p = placed[i];
    // One-row tiles beside it, grouped by the column range they share.
    const byRange = new Map<string, number[]>();
    placed.forEach((q, j) => {
      if (j === i || inStack.has(j) || q.rows !== 1) return;
      if (q.row !== p.row && q.row !== p.row + 1) return;
      if (q.col < p.col + p.span && q.col + q.span > p.col) return;
      const k = `${q.col}:${q.span}`;
      byRange.set(k, [...(byRange.get(k) || []), j]);
    });
    for (const members of byRange.values()) {
      if (members.length < 2) continue;
      members.sort((a, b) => a - b);
      members.forEach((j) => inStack.add(j));
      stacks.set(members[0], members);
    }
  });
  const out: BentoFlowItem[] = [];
  tiles.forEach((_, i) => {
    if (stacks.has(i)) {
      const members = stacks.get(i)!;
      const sum = (d: BentoDevice) => members.reduce((n, j) => n + bentoSpan(tiles[j], d), 0);
      out.push({ kind: 'stack', indices: members, widths: {
        desktop: placed[members[0]].span,
        tablet: Math.min(BENTO_COLUMNS.tablet, sum('tablet')),
        mobile: Math.min(BENTO_COLUMNS.mobile, sum('mobile')),
      } });
    } else if (!inStack.has(i)) out.push({ kind: 'tile', index: i });
  });
  return out;
}

function normalizeBentoTile(raw: unknown): BentoTile {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    kind: bentoPick(t.kind, BENTO_KINDS, 'text'),
    eyebrow: bentoStr(t.eyebrow, '', 40),
    title: bentoStr(t.title, '', 80),
    body: bentoStr(t.body, '', 240),
    action: bentoStr(t.action, '', 40),
    stat: bentoStr(t.stat, '', 12),
    statLabel: bentoStr(t.statLabel, '', 60),
    alt: bentoStr(t.alt, '', 120),
    theme: bentoPick(t.theme, BENTO_THEMES, 'Default'),
    surface: bentoPick(t.surface, BENTO_SURFACES, 'Surface'),
    span: (BENTO_DESKTOP_SPANS as readonly number[]).includes(Number(t.span)) ? Number(t.span) : 4,
    rows: bentoNum(t.rows, 1, 1, 2),
    tabletSpan: t.tabletSpan === 4 || t.tabletSpan === 8 ? t.tabletSpan : null,
    mobileSpan: t.mobileSpan === 2 || t.mobileSpan === 4 ? t.mobileSpan : null,
  };
}

/** A tile's minimum height on a device: its rows at the row height, with
 *  that device's gutter between them — what CSS grid does by spanning rows,
 *  and what the Figma build stores per device so a two-row tile is exactly
 *  as tall as the two one-row tiles stacked beside it. */
function bentoMinHeight(rows: number, rowHeight: number, gutter: number): number {
  return rows * rowHeight + Math.max(0, rows - 1) * gutter;
}

function normalizeBentoSpec(raw: unknown): BentoSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const tiles = Array.isArray(r.tiles) ? r.tiles.slice(0, 16) : [];
  return {
    version: BENTO_SPEC_VERSION,
    name: bentoStr(r.name, 'Bento grid', 60),
    designSystem: { id: r.designSystem && typeof r.designSystem.id === 'string' ? r.designSystem.id : null },
    // A spec from before styles is a bento of cards, which is what it drew.
    style: bentoPick(r.style, BENTO_STYLES, 'cards'),
    rowHeight: bentoNum(r.rowHeight, 200, 120, 400),
    tiles: tiles.map(normalizeBentoTile),
  };
}
// </bento-spec>

export {
  BENTO_SPEC_VERSION, BENTO_KINDS, BENTO_THEMES, BENTO_SURFACES, BENTO_STYLES, BENTO_DESKTOP_SPANS, BENTO_COLUMNS,
  bentoSpan, bentoRows, bentoPlace, bentoFlow, bentoMinHeight, normalizeBentoTile, normalizeBentoSpec,
};
export type { BentoKind, BentoTheme, BentoSurface, BentoDevice, BentoStyle, BentoTile, BentoSpec, BentoFlowItem };

/**
 * Tiles that touch and wear the same theme and surface, on a device — pairs of
 * indices, earlier first. With Boxes there is no gutter, so two such tiles read
 * as one block; the studio warns and offers to change the second one's surface.
 * (Cards have a gap between them, so this only matters for Boxes.)
 */
export function bentoTouchingSame(tiles: BentoTile[], device: BentoDevice): [number, number][] {
  const placed = bentoPlace(tiles, device);
  const cell: number[][] = [];
  placed.forEach((p, i) => { for (let y = p.row; y < p.row + p.rows; y++) { cell[y] = cell[y] || []; for (let x = p.col; x < p.col + p.span; x++) cell[y][x] = i; } });
  const pairs = new Set<string>();
  const same = (a: number, b: number) => a !== b && tiles[a].theme === tiles[b].theme && tiles[a].surface === tiles[b].surface;
  // An image covers its surface, so it never merges with a neighbor.
  const flat = (i: number) => tiles[i].kind !== 'image';
  cell.forEach((row, y) => row && row.forEach((i, x) => {
    if (i === undefined || !flat(i)) return;
    for (const j of [row[x + 1], cell[y + 1] && cell[y + 1][x]]) {
      if (j !== undefined && flat(j) && same(i, j)) pairs.add([Math.min(i, j), Math.max(i, j)].join(','));
    }
  }));
  return [...pairs].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** A surface for tile `i` that differs from every tile it touches — the
 *  nearest level to its current one, so the change is as small as it can be. */
export function bentoDistinctSurface(tiles: BentoTile[], i: number, device: BentoDevice): BentoSurface {
  const placed = bentoPlace(tiles, device);
  const me = placed[i];
  const neighbors = placed.map((p, j) => ({ p, j })).filter(({ p, j }) => j !== i
    && p.col <= me.col + me.span && me.col <= p.col + p.span
    && p.row <= me.row + me.rows && me.row <= p.row + p.rows
    && tiles[j].theme === tiles[i].theme);
  const taken = new Set(neighbors.map(({ j }) => tiles[j].surface));
  const at = BENTO_SURFACES.indexOf(tiles[i].surface);
  const order = [...BENTO_SURFACES].map((s, k) => ({ s, d: Math.abs(k - at) })).sort((a, b) => a.d - b.d).map((x) => x.s);
  return order.find((s) => s !== tiles[i].surface && !taken.has(s)) || tiles[i].surface;
}

/**
 * Spans for a device with no gaps left at the ends of rows: lay the tiles out
 * as CSS would, and wherever a tile has empty cells to its right all the way
 * to the row's end (in every row it covers), widen it to fill them. Repeat
 * until nothing moves — widening one tile can pull the next onto a new row.
 * The desktop layout is the design, so this is for tablet and phone.
 */
export function bentoAutoFit(tiles: BentoTile[], device: 'tablet' | 'mobile'): number[] {
  const cols = BENTO_COLUMNS[device];
  const key = device === 'tablet' ? 'tabletSpan' : 'mobileSpan';
  let work = tiles.map((t) => ({ ...t }));
  for (let pass = 0; pass < 32; pass++) {
    const placed = bentoPlace(work, device);
    const taken: boolean[][] = [];
    placed.forEach((p) => { for (let y = p.row; y < p.row + p.rows; y++) { taken[y] = taken[y] || []; for (let x = p.col; x < p.col + p.span; x++) taken[y][x] = true; } });
    const grow = placed.findIndex((p) => {
      if (p.col + p.span >= cols) return false;
      for (let y = p.row; y < p.row + p.rows; y++) for (let x = p.col + p.span; x < cols; x++) if (taken[y] && taken[y][x]) return false;
      return true;
    });
    if (grow < 0) return placed.map((p) => p.span);
    work = work.map((t, i) => (i === grow ? { ...t, [key]: cols - placed[i].col } : t));
  }
  return bentoPlace(work, device).map((p) => p.span);
}

/** The geometry a suggestion reads, per device: the content width inside the
 *  margins, the gutter, and the type sizes the tiles use there. The preview's
 *  tablet (768) and phone (320), and Omni's iOS ramp. Boxes have no margin or
 *  gutter, so a half-width box is a little wider than a half-width card. */
const SUGGEST_GEOMETRY: Record<'tablet' | 'mobile', { width: number; margin: number; gutter: number; title: number; display: number }> = {
  tablet: { width: 768, margin: 24, gutter: 24, title: 20, display: 34 },
  mobile: { width: 320, margin: 16, gutter: 16, title: 20, display: 34 },
};
function suggestGeometry(device: 'tablet' | 'mobile', style: BentoStyle) {
  const g = SUGGEST_GEOMETRY[device];
  const flush = style === 'boxes';
  const gutter = flush ? 0 : g.gutter;
  return { content: g.width - 2 * (flush ? 0 : g.margin), gutter, title: g.title, display: g.display };
}
const TILE_PAD = 24;
const BODY = 16;
const BODY_LH = 24;
const CHAR = 0.55;          // average glyph width, in ems, for a UI sans
const MIN_MEASURE = 28;     // fewer characters per line than this reads as broken

/** Lines a string needs at a given width and size — words never split. */
function linesFor(text: string, width: number, size: number): number {
  if (!text) return 0;
  const perLine = Math.max(1, Math.floor(width / (CHAR * size)));
  let lines = 1; let used = 0;
  for (const w of text.split(/\s+/)) {
    const len = w.length + (used ? 1 : 0);
    if (used + len > perLine) { lines++; used = w.length; } else used += len;
  }
  return lines;
}

/** Whether a tile's content sits comfortably at a width on a device: a
 *  readable measure, no word wider than its line, and everything inside the
 *  tile's height. */
function fitsAt(t: BentoTile, width: number, device: 'tablet' | 'mobile', rowHeight: number, style: BentoStyle): boolean {
  const g = suggestGeometry(device, style);
  const inner = width - 2 * TILE_PAD;
  const rows = bentoRows(t, device);
  const height = rows * rowHeight + (rows - 1) * g.gutter - 2 * TILE_PAD;
  if (t.kind === 'image') return true;
  if (t.kind === 'stat') {
    const figure = t.stat.length * 0.6 * g.display;
    const label = linesFor(t.statLabel, inner, BODY) * BODY_LH;
    return figure <= inner && g.display * 1.2 + 8 + label <= height;
  }
  const longest = Math.max(0, ...t.title.split(/\s+/).map((w) => w.length));
  if (longest * CHAR * g.title > inner) return false;
  if (t.body && inner / (CHAR * BODY) < MIN_MEASURE) return false;
  const need = (t.eyebrow ? 20 + 8 : 0)
    + (t.title ? linesFor(t.title, inner, g.title) * g.title * 1.3 + 8 : 0)
    + (t.body ? linesFor(t.body, inner, BODY) * BODY_LH + 8 : 0)
    + (t.action ? 24 : 0);
  return need <= height;
}

/**
 * Suggested tablet and phone spans from each tile's CONTENT: half a row where
 * the content still reads well at half width — a short stat, an image, a tile
 * with little text — and the full row where it would not: a long paragraph, a
 * title that would break mid-thought, more text than the tile can hold. Then
 * any half left alone in a row is widened (bentoAutoFit), so rows stay full.
 * A wide desktop image (8+ columns) is a feature, and stays the full row.
 */
export function bentoSuggest(tiles: BentoTile[], device: 'tablet' | 'mobile', rowHeight: number, style: BentoStyle = 'cards'): number[] {
  const g = suggestGeometry(device, style);
  const cols = BENTO_COLUMNS[device];
  const half = (g.content - g.gutter) / 2;
  const key = device === 'tablet' ? 'tabletSpan' : 'mobileSpan';
  const chosen = tiles.map((t) => {
    const wantsFull = t.kind === 'image' ? t.span >= 8 : !fitsAt(t, half, device, rowHeight, style);
    return { ...t, [key]: wantsFull ? cols : cols / 2 };
  });
  return bentoAutoFit(chosen, device);
}

/** A starting layout that shows what a bento does: one wide feature, a stat,
 *  an image and two smaller features, on different surfaces. */
export const BENTO_STARTER: BentoTile[] = [
  { kind: 'text', eyebrow: 'New', title: 'Built from your design system', body: 'Every tile wears your own surfaces, type and colors, so it fits the page it lands on.', action: 'See how it works', stat: '', statLabel: '', alt: '', theme: 'Primary', surface: 'Surface-Dimmest', span: 8, rows: 2, tabletSpan: null, mobileSpan: null },
  { kind: 'stat', eyebrow: '', title: '', body: '', action: '', stat: '4.5:1', statLabel: 'contrast on every tile, by construction', alt: '', theme: 'Secondary', surface: 'Surface-Bright', span: 4, rows: 1, tabletSpan: null, mobileSpan: null },
  { kind: 'image', eyebrow: '', title: '', body: '', action: '', stat: '', statLabel: '', alt: '', theme: 'Neutral', surface: 'Surface', span: 4, rows: 1, tabletSpan: null, mobileSpan: null },
  { kind: 'text', eyebrow: 'Responsive', title: 'Reflows on every device', body: '12 columns on desktop, 8 on tablet, 4 on phones.', action: '', stat: '', statLabel: '', alt: '', theme: 'Tertiary', surface: 'Surface-Brightest', span: 6, rows: 1, tabletSpan: null, mobileSpan: null },
  { kind: 'text', eyebrow: 'Figma', title: 'And in Figma', body: 'The same grid, bound to your Gutter and Margin.', action: 'Open the plugin', stat: '', statLabel: '', alt: '', theme: 'Default', surface: 'Surface-Bright', span: 6, rows: 1, tabletSpan: null, mobileSpan: null },
];
