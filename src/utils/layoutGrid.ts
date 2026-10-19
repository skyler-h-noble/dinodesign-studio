/**
 * The layout grid: columns per device, and the width of a span of N of them.
 *
 * Figma variables cannot do arithmetic, so "four columns wide" can only be
 * bound to in Figma as a stored number per mode — the same reason ThemeBuddy
 * computed Col-1…Col-12. This module is where those numbers come from, for
 * BOTH targets: the Figma payload writes them as literals, the CSS writes the
 * same formula as calc(), and a test holds the two equal.
 *
 *   content = width − 2 × margin
 *   column  = (content − (columns − 1) × gutter) ÷ columns
 *   Col-N   = N × column + (N − 1) × gutter        — the full content once N > columns
 *
 * The inputs mirror Figma's Devices-Type {Class}/Device-Width, /Margin and
 * /Gutter (read 2026-10-14), the same way DEVICE_MARGIN does: hand-authored in
 * the file, so if the file moves, this table is what moves with it.
 *
 * ── Page layouts ─────────────────────────────────────────────────────────
 * A page beside a navigation rail has less room, so its columns are narrower.
 * Six layouts — a spacing style times a nav:
 *
 *   Standard   the device's gutter and margin   (a bento of Cards)
 *   NoGutter   no gutter, no margin              (a bento of Boxes, flush)
 *   × none / Rail (80, Material 3's rail) / Rail-Expanded (280, the labelled rail)
 *
 *   content = width − nav − 2 × margin
 *
 * In Figma the layout is a MODE of a Page-Layout collection, between
 * Devices-Type (which holds the numbers) and Device-Sizes (what layers bind
 * to), so a frame switches layout the way it switches device. In CSS nothing
 * is needed: the widths are measured from the container (cqw), so a page
 * beside a rail is already narrower, and NoGutter is a style of its own.
 */
import type { DeviceMode } from './deviceChrome';

export const SIZE_CLASSES = ['Default', 'Common', 'Wide', 'Narrow', 'Rare'] as const;
export type SizeClass = typeof SIZE_CLASSES[number];

/** Columns per device: 12 on desktop and landscape tablets, 8 on portrait
 *  tablets, 4 on phones — the Material 4 / 8 / 12. */
export const DEVICE_COLUMNS: Record<DeviceMode, number> = {
  'Desktop': 12,
  'IOS-Tablet-Vertical': 8,
  'IOS-Tablet-Horizontal': 12,
  'Android-Tablet-Vertical': 8,
  'Android-Tablet-Horizontal': 12,
  'IOS-Mobile': 4,
  'Android-Mobile': 4,
};

/** Gutter per device — the same in every size class. */
export const DEVICE_GUTTER: Record<DeviceMode, number> = {
  'Desktop': 32,
  'IOS-Tablet-Vertical': 24,
  'IOS-Tablet-Horizontal': 24,
  'Android-Tablet-Vertical': 24,
  'Android-Tablet-Horizontal': 24,
  'IOS-Mobile': 16,
  'Android-Mobile': 16,
};

const MODES: DeviceMode[] = ['Desktop', 'IOS-Tablet-Vertical', 'IOS-Tablet-Horizontal', 'Android-Tablet-Vertical', 'Android-Tablet-Horizontal', 'IOS-Mobile', 'Android-Mobile'];
const row = (vals: number[]) => Object.fromEntries(MODES.map((m, i) => [m, vals[i]])) as Record<DeviceMode, number>;

/** {Class}/Device-Width per device. */
export const CLASS_WIDTH: Record<SizeClass, Record<DeviceMode, number>> = {
  Default: row([1920, 820, 1180, 820, 1180, 393, 360]),
  Common: row([1536, 800, 1280, 800, 1280, 390, 393]),
  Wide: row([2560, 1024, 1366, 1024, 1366, 430, 412]),
  Narrow: row([1280, 600, 960, 600, 960, 375, 384]),
  Rare: row([1366, 744, 1133, 744, 1133, 440, 360]),
};

/** {Class}/Margin per device. */
export const CLASS_MARGIN: Record<SizeClass, Record<DeviceMode, number>> = {
  Default: row([64, 24, 24, 24, 24, 16, 16]),
  Common: row([40, 24, 24, 24, 24, 16, 16]),
  Wide: row([80, 24, 24, 24, 24, 20, 16]),
  Narrow: row([32, 24, 24, 24, 24, 16, 16]),
  Rare: row([32, 24, 24, 24, 24, 20, 16]),
};

export const MAX_COLUMNS = 12;

/** The navs a page can sit beside, and the width each takes from the grid.
 *  Rail is Component-Size Other/Rail-Width (80 at every size); the expanded
 *  rail is Material 3 Expressive's labelled rail, which replaced the drawer. */
export const NAV_WIDTH = { Rail: 80, 'Rail-Expanded': 280 } as const;
export type NavName = keyof typeof NAV_WIDTH;

export const PAGE_LAYOUTS = [
  'Standard', 'Standard-Rail', 'Standard-Rail-Expanded',
  'NoGutter', 'NoGutter-Rail', 'NoGutter-Rail-Expanded',
] as const;
export type PageLayout = typeof PAGE_LAYOUTS[number];

/** A layout's two halves: whether it keeps the gutter and margin, and its nav. */
export function layoutParts(layout: PageLayout): { gutters: boolean; nav: NavName | null } {
  const gutters = layout.startsWith('Standard');
  const nav = layout.endsWith('-Rail-Expanded') ? 'Rail-Expanded' : layout.endsWith('-Rail') ? 'Rail' : null;
  return { gutters, nav };
}

/** The Devices-Type name holding a layout's Col-N. Standard keeps the plain
 *  {Class}/Col-N it has always had, so nothing bound to it moves. */
export const colName = (cls: SizeClass, layout: PageLayout, n: number) =>
  layout === 'Standard' ? `${cls}/Col-${n}` : `${cls}/${layout}/Col-${n}`;

export interface GridInput { width: number; margin: number; gutter: number; columns: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The width of a span of n columns — the full content width once n passes
 *  the device's column count (a 6-column card is the whole row on a phone). */
export function spanWidth(n: number, g: GridInput): number {
  const content = g.width - 2 * g.margin;
  if (n >= g.columns) return round2(content);
  const column = (content - (g.columns - 1) * g.gutter) / g.columns;
  return round2(n * column + (n - 1) * g.gutter);
}

export function gridFor(cls: SizeClass, mode: DeviceMode, layout: PageLayout = 'Standard'): GridInput {
  const { gutters, nav } = layoutParts(layout);
  return {
    width: CLASS_WIDTH[cls][mode] - (nav ? NAV_WIDTH[nav] : 0),
    margin: gutters ? CLASS_MARGIN[cls][mode] : 0,
    gutter: gutters ? DEVICE_GUTTER[mode] : 0,
    columns: DEVICE_COLUMNS[mode],
  };
}

/**
 * The Devices-Type additions, per device mode: `Columns`, `Grid/12`, `Grid/8`,
 * `Grid/4`; every layout's Col-1…Col-12 for every size class (colName); and
 * `{Class}/{Nav}/Grid-Width`, the width left beside each nav — the shape the
 * plugin's Devices-Type import creates by name.
 */
type GridVar = { value: number; type: 'number' } | { value: boolean; type: 'boolean' };

/** Which column count a device is, as three booleans — what a Figma layer's
 *  visibility binds to, so a tile can show the width spacer for the grid the
 *  frame is in and hide the other two (the ThemeBuddy column pattern). */
export const GRID_FLAGS = [12, 8, 4] as const;

export function devicesTypeGridVariables(): Record<DeviceMode, Record<string, GridVar>> {
  const out = {} as Record<DeviceMode, Record<string, GridVar>>;
  for (const mode of MODES) {
    const bag: Record<string, GridVar> = { Columns: { value: DEVICE_COLUMNS[mode], type: 'number' } };
    for (const n of GRID_FLAGS) bag[`Grid/${n}`] = { value: DEVICE_COLUMNS[mode] === n, type: 'boolean' };
    for (const cls of SIZE_CLASSES) {
      for (const layout of PAGE_LAYOUTS) {
        const g = gridFor(cls, mode, layout);
        for (let n = 1; n <= MAX_COLUMNS; n++) bag[colName(cls, layout, n)] = { value: spanWidth(n, g), type: 'number' };
      }
      for (const nav of Object.keys(NAV_WIDTH) as NavName[]) {
        bag[`${cls}/${nav}/Grid-Width`] = { value: CLASS_WIDTH[cls][mode] - NAV_WIDTH[nav], type: 'number' };
      }
    }
    out[mode] = bag;
  }
  return out;
}

/** A Devices-Type name as the payload spells a reference: dots for slashes. */
const ref = (name: string) => `{${name.split('/').join('.')}}`;

/**
 * The Page-Layout collection, per layout mode: for every size class its
 * Col-1…Col-12, Gutter, Margin and Grid-Width. Each aliases the Devices-Type
 * variable for that layout (so it still follows the device), except a
 * NoGutter layout's Gutter and Margin, which are 0 outright.
 */
export function pageLayoutVariables(): Record<PageLayout, Record<string, string | number>> {
  const out = {} as Record<PageLayout, Record<string, string | number>>;
  for (const layout of PAGE_LAYOUTS) {
    const { gutters, nav } = layoutParts(layout);
    const bag: Record<string, string | number> = {};
    for (const cls of SIZE_CLASSES) {
      for (let n = 1; n <= MAX_COLUMNS; n++) bag[`${cls}/Col-${n}`] = ref(colName(cls, layout, n));
      bag[`${cls}/Gutter`] = gutters ? ref(`${cls}/Gutter`) : 0;
      bag[`${cls}/Margin`] = gutters ? ref(`${cls}/Margin`) : 0;
      bag[`${cls}/Grid-Width`] = nav ? ref(`${cls}/${nav}/Grid-Width`) : ref(`${cls}/Device-Width`);
    }
    out[layout] = bag;
  }
  return out;
}

/**
 * Device-Sizes, per class mode: `Columns` (from Devices-Type — every layout of
 * a device has the same count), and `Col-1`…`Col-12`, `Grid-Gutter`,
 * `Grid-Margin`, `Grid-Width` from Page-Layout's `{Class}/…`. These are what a
 * layer binds to: they follow the frame's device, size class and layout.
 *
 * `Page-Layout:` marks a reference into that collection; a bare one is
 * Devices-Type. Grid-Gutter and Grid-Margin are new names rather than a
 * re-point of Gutter and Margin, which are hand-authored and bound across the
 * file — a NoGutter layout should zero the grid, not every margin there is.
 */
export function deviceSizesGridAliases(): Record<SizeClass, Record<string, string>> {
  const out = {} as Record<SizeClass, Record<string, string>>;
  for (const cls of SIZE_CLASSES) {
    const bag: Record<string, string> = { Columns: '{Columns}' };
    for (let n = 1; n <= MAX_COLUMNS; n++) bag[`Col-${n}`] = `{Page-Layout:${cls}.Col-${n}}`;
    bag['Grid-Gutter'] = `{Page-Layout:${cls}.Gutter}`;
    bag['Grid-Margin'] = `{Page-Layout:${cls}.Margin}`;
    bag['Grid-Width'] = `{Page-Layout:${cls}.Grid-Width}`;
    out[cls] = bag;
  }
  return out;
}

/**
 * The CSS: the formula, once, on :root. --Columns, --Gutter and --Margin come
 * from the data-device block. The width is 100cqw — the nearest size
 * container, or the viewport when there is none — and a custom property's
 * units resolve where it is USED, so a --Col-N read inside a container beside
 * a rail is already that much narrower. That is the Rail layouts, for free.
 */
export function gridCSS(indent = '  '): string[] {
  const lines = [
    `${indent}--Grid-Content: calc(100cqw - 2 * var(--Margin, 64px));`,
    `${indent}--Grid-Column: calc((var(--Grid-Content) - (var(--Columns, 12) - 1) * var(--Gutter, 32px)) / var(--Columns, 12));`,
  ];
  for (let n = 1; n <= MAX_COLUMNS; n++) {
    lines.push(`${indent}--Col-${n}: min(calc(${n} * var(--Grid-Column) + ${n - 1} * var(--Gutter, 32px)), var(--Grid-Content));`);
  }
  return lines;
}
