/**
 * The dark-mode surface ladder and the cards that sit on it.
 *
 * ── The decision (owner) ───────────────────────────────────────────────────
 * In DARK mode every theme — Default included, no special case — paints its
 * five surface levels like this:
 *
 *   Surface-Dimmest   pure black #000000   (deliberate: not a tinted tone 1)
 *   Surface-Dim       tone 1
 *   Surface           tone 2      (so the dark PAGE is tone 2)
 *   Surface-Bright    tone 3
 *   Surface-Brightest tone 4
 *
 * of the theme's own palette (the Default theme: the page-background palette).
 * Strictly darkest to lightest, all inside the dark band. Cards are tone 5 at
 * five opacities laid over whatever surface they sit on (see Cards below).
 * Light mode does not change.
 *
 * This replaces the first dark ladder (tones 1-5, page on tone 3, cards
 * lifted along each surface's ramp). The index-map machinery below is the
 * same; only the tones and the cards changed.
 *
 * ── Why this needs an index map ────────────────────────────────────────────
 * The Theme layer is mode-independent: Figma builds it once, from Light-Mode,
 * and every role in it names a LIGHT-mode tone index — Primary's Surface reads
 * {Text.Surfaces.Neutral.Color-6} because in light mode it paints tone 6. In
 * dark mode that same reference has to answer for tone 2. So the per-mode
 * difference has to live where the references point, in the Modes layer: in
 * dark mode, the table entry at index 6 holds the answer for the tone index 6
 * is painted at.
 *
 * Each theme's window says which index each level uses. Read from the Themes
 * themselves (the Text reference of each level), so the map can be rebuilt
 * from a stored system and never disagrees with what the themes point at.
 *
 * Two shapes of map come out of the windows:
 *   byPalette — for tables keyed by the BACKGROUND's palette (Backgrounds rows,
 *               Hover, Pressed): exact, because one palette has one window.
 *   global    — for tables keyed by the FOREGROUND's palette (Text, Header,
 *               Border, Icon, …), which every theme reads at its own indices.
 *               Two themes can name the same index for different tones. The
 *               entry then holds the answer for the LIGHTER tone: every
 *               dark-mode foreground is lighter than its surface, and contrast
 *               against a lighter foreground only grows as the surface gets
 *               darker, so an answer that passes on the lighter tone passes on
 *               the darker one too.
 *
 * Black has no row in the tables (they are keyed by tones 1-12), so the maps
 * file Surface-Dimmest under tone 1 — the same "lighter answers for darker"
 * rule: whatever passes on tone 1 passes on black.
 */
import chroma from 'chroma-js';

export const DARK_LADDER_LEVELS = [
  'Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest',
] as const;
export type DarkLadderLevel = typeof DARK_LADDER_LEVELS[number];

/** The dark-mode tone each surface level PAINTS, for every theme. 0 = pure black. */
export const DARK_LADDER_TONE: Record<DarkLadderLevel, number> = {
  'Surface-Dimmest': 0,
  'Surface-Dim': 1,
  'Surface': 2,
  'Surface-Bright': 3,
  'Surface-Brightest': 4,
};

/** The table tone a level's roles are answered from: black reads tone 1's. */
export function darkTableTone(level: DarkLadderLevel): number {
  return Math.max(1, DARK_LADDER_TONE[level]);
}

/** The export names a theme's sections in the plural. */
export const SECTION_LEVEL: Record<string, DarkLadderLevel> = {
  'Surfaces-Dimmest': 'Surface-Dimmest',
  'Surfaces-Dim': 'Surface-Dim',
  'Surfaces': 'Surface',
  'Surfaces-Bright': 'Surface-Bright',
  'Surfaces-Brightest': 'Surface-Brightest',
};

export interface ThemeWindow {
  theme: string;
  palette: string;
  /** The light-mode tone index each level's roles are keyed by. */
  index: Partial<Record<DarkLadderLevel, number>>;
}

const val = (node: any): string => String(node && typeof node === 'object' ? node.value ?? '' : node ?? '');

/**
 * Every theme's window, read from its own references.
 *
 * The Default theme contributes only the levels it does NOT route through
 * Default-Background — today its Surface-Dimmest, whose roles still name a
 * tone index directly. Its other levels are expanded per mode by the CSS and
 * Figma generators, which in dark mode read the window of the page's palette.
 *
 * The palette comes from the level's Hover reference ({Hover.<P>.Color-N} is
 * keyed by the background's palette), falling back to the Background
 * reference, so the window can still be read after the pass has pointed a
 * Background somewhere else.
 */
export function themeWindows(modeData: any): ThemeWindow[] {
  const out: ThemeWindow[] = [];
  for (const [theme, sections] of Object.entries<any>(modeData?.Themes ?? {})) {
    if (!sections || typeof sections !== 'object') continue;
    const index: ThemeWindow['index'] = {};
    let palette = '';
    for (const [section, level] of Object.entries(SECTION_LEVEL)) {
      const node = sections[section];
      if (!node) continue;
      const tableRef = /^\{[\w-]+\.Surfaces\.[\w-]+\.Color-(\d+)\}$/;
      const n = val(node['Text-Match']).match(tableRef)?.[1] ?? val(node.Text).match(tableRef)?.[1];
      if (!n) continue;
      index[level] = Number(n);
      if (!palette) {
        palette = val(node.Hover).match(/^\{Hover\.([\w-]+)\.Color-\d+\}$/)?.[1]
          ?? val(node.Background).match(/^\{(?:Backgrounds|Colors)\.([\w-]+)\./)?.[1] ?? '';
      }
    }
    if (palette && Object.keys(index).length) out.push({ theme, palette, index });
  }
  return out;
}

export interface DarkIndexMaps {
  /** index -> the TABLE tone (1-4) it answers for; black is filed as 1. */
  byPalette: Record<string, Record<number, number>>;
  global: Record<number, number>;
}

export function darkIndexMaps(windows: ThemeWindow[]): DarkIndexMaps {
  const byPalette: DarkIndexMaps['byPalette'] = {};
  const global: DarkIndexMaps['global'] = {};
  for (const w of windows) {
    const pal = (byPalette[w.palette] ??= {});
    for (const [level, n] of Object.entries(w.index) as [DarkLadderLevel, number][]) {
      const tone = darkTableTone(level);
      pal[n] = Math.max(pal[n] ?? 0, tone);
      global[n] = Math.max(global[n] ?? 0, tone);
    }
  }
  return { byPalette, global };
}

/**
 * An index whose global entry answers for exactly `tone`, preferring
 * `preferred`. The Default theme's roles are expanded per mode (it has no
 * Theme-layer index of its own), so it can read the exact answer for the tone
 * it paints rather than an entry another theme shares at a lighter tone.
 * Falls back to `preferred` when no index is painted at exactly that tone.
 */
export function exactIndexForTone(global: Record<number, number>, tone: number, preferred: number): number {
  if (global[preferred] === tone) return preferred;
  const hit = Object.keys(global).map(Number).sort((a, b) => a - b).find((i) => global[i] === tone);
  return hit ?? preferred;
}

/** The maps for one mode's data (call with the Dark-Mode section). */
export function darkLadderMaps(modeData: any): DarkIndexMaps {
  return darkIndexMaps(themeWindows(modeData));
}

/** A palette's window, by palette name, from the themes that paint with it. */
export function windowForPalette(modeData: any, palette: string): ThemeWindow['index'] | null {
  const all = themeWindows(modeData).filter((w) => w.theme !== 'Default');
  const own = all.find((w) => w.theme === palette) ?? all.find((w) => w.palette === palette);
  return own ? own.index : null;
}

/** A dark surface level's color on a 12-tone ramp (tone 1 first). */
export function darkSurfaceHex(ramp: string[], level: DarkLadderLevel): string {
  const t = DARK_LADDER_TONE[level];
  return t === 0 ? '#000000' : chroma(ramp[t - 1]).hex('rgb').toLowerCase();
}

/* ─── Cards ───────────────────────────────────────────────────────────────
 *
 * A card (the five Container levels) in dark mode is ONE color, the theme
 * palette's tone 5, painted at an opacity that rises with the level:
 *
 *   Container-Lowest   tone 5 at 45%
 *   Container-Low      tone 5 at 60%
 *   Container          tone 5 at 75%
 *   Container-High     tone 5 at 88%
 *   Container-Highest  tone 5 at 100%  (solid)
 *
 * laid over whatever surface the card sits on. The surface shows through, so
 * the same card is darker on black than on tone 4, and always lighter than the
 * surface under it because tone 5 is lighter than every surface.
 *
 * Why opacity rather than a color computed per surface: it is one mechanism
 * that the CSS and Figma can both express without knowing the surface. In CSS
 * the card's --Background is an 8-digit hex and the browser composites it; in
 * Figma it is the same RGBA in the Container variable and Figma composites the
 * fill over the frame below. Nothing has to be generated per surface.
 *
 * Known limit: on Surface-Brightest (tone 4) the cards sit between tone 4 and
 * tone 5, so the low levels barely separate from the surface.
 *
 * Every role a card carries has to pass on every composite a level can
 * produce. For the light foregrounds dark mode uses, the lightest composite is
 * the hardest, and no composite is lighter than solid tone 5 — so a role that
 * passes on tone 5 passes on every card, nested cards included (a card inside
 * a card composites between the outer card and tone 5, never past it).
 *
 * The opacities are stored as an 8-bit alpha, the precision both an 8-digit
 * hex and Figma's RGBA hold, so CSS and Figma paint the same number.
 */
export const DARK_CARD_TONE = 5;
export const DARK_CARD_LEVELS = [
  'Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest',
] as const;
export type DarkCardLevel = typeof DARK_CARD_LEVELS[number];
export const DARK_CARD_ALPHA: Record<DarkCardLevel, number> = {
  'Container-Lowest': 0.45,
  'Container-Low': 0.6,
  'Container': 0.75,
  'Container-High': 0.88,
  'Container-Highest': 1,
};

/** The alpha byte a card level is written with (115 for 45%, 255 for 100%). */
export function darkCardAlphaByte(level: DarkCardLevel): number {
  return Math.round(DARK_CARD_ALPHA[level] * 255);
}

/** A card level's color: tone 5 with the level's alpha (8-digit hex below 100%). */
export function darkCardHex(tone5: string, level: DarkCardLevel): string {
  const base = chroma(tone5).hex('rgb').toLowerCase();
  const a = darkCardAlphaByte(level);
  return a >= 255 ? base : `${base}${a.toString(16).padStart(2, '0')}`;
}

export function labL(hex: string): number {
  try { return chroma(hex).lab()[0]; } catch { return NaN; }
}

/* ─── Which roles a card has to carry ──────────────────────────────────────
 *
 * The same roles and thresholds the rendered accessibility report grades
 * (WCAG 2.2 AA): text-sized roles 4.5:1, headers 3:1, borders / icons / focus
 * 3:1, a button's edge 3:1 by its fill OR its border, an outline label 4.5:1.
 * `decls` is the card scope's resolved declarations (name → hex). */
const PALS = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
const BTNS = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'BlackWhite', 'Info', 'Success', 'Warning', 'Error'];
const TEXT_45 = ['--Text', ...PALS.map((p) => `--Text-${p}`), '--Text-Match', '--Text-BW', '--Quiet',
  '--Hotlink', '--Hotlink-Visited', '--Eyebrow'];
const NON_TEXT_3 = ['--Header', ...PALS.map((p) => `--Header-${p}`), '--Header-Match', '--Border', '--Focus-Visible',
  '--Icons-Default', ...PALS.map((p) => `--Icons-${p}`)];

function lum(hex: string): number { return chroma(hex).luminance(); }
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** `fg` (alpha allowed) laid over the opaque `bg`. */
export function over(fg: string, bg: string): string {
  const c = chroma(fg);
  const a = c.alpha();
  return a >= 1 ? c.hex('rgb') : chroma.mix(bg, c.alpha(1).hex('rgb'), a, 'rgb').hex('rgb');
}

/** The roles on a card that fail on `cardHex` (opaque), as `role ratio` strings. */
export function cardRoleFailures(decls: Record<string, string | undefined>, card: string): string[] {
  const has = (k: string) => typeof decls[k] === 'string' && chroma.valid(decls[k] as string);
  const out: string[] = [];
  const check = (k: string, need: number) => {
    const r = ratio(over(decls[k]!, card), card);
    if (r < need) out.push(`${k} ${r.toFixed(2)}`);
  };
  for (const k of TEXT_45) if (has(k)) check(k, 4.5);
  for (const k of NON_TEXT_3) if (has(k)) check(k, 3);
  for (const b of BTNS) {
    const p = `--Buttons-${b}`;
    const edges = [`${p}-Border`, `${p}-Button`].filter(has).map((k) => ratio(over(decls[k]!, card), card));
    if (edges.length && Math.max(...edges) < 3) out.push(`${p} edge ${Math.max(...edges).toFixed(2)}`);
    for (const k of [`${p}-Outline-Text`, `${p}-Outline-Quiet`]) if (has(k)) check(k, 4.5);
  }
  return out;
}

export function cardRolesFit(decls: Record<string, string | undefined>): (cardHex: string) => boolean {
  return (card: string) => cardRoleFailures(decls, card).length === 0;
}
