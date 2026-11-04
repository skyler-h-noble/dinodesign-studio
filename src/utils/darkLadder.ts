/**
 * The dark-mode surface ladder and the cards that sit on it.
 *
 * ── The decision (owner, 2026-11-04) ───────────────────────────────────────
 * In DARK mode every theme — Default included — paints its five surface levels
 * like this, except the Primary, Secondary and Tertiary themes, which paint
 * their own lighter band (see Bands, at the end of this file):
 *
 *   Surface-Dimmest   tone 1
 *   Surface-Dim       tone 2
 *   Surface           tone 3      (so the dark PAGE is tone 3)
 *   Surface-Bright    tone 4
 *   Surface-Brightest tone 5
 *
 * of the theme's own palette (the Default theme: the page-background palette).
 * Strictly darkest to lightest, all inside the dark band. No pure black,
 * with one exception kept from the selection rules: a designer who CHOSE black
 * (a Black page or black cards, blackChosen) gets pure black where the Neutral
 * palette paints its tone 1. Cards are solid colors mixed from tone 4 and the
 * page, one set per theme (see Cards below). Light mode does not change.
 *
 * History: tones 1-5 with the page on tone 3 is the first dark ladder
 * (7ad2bf4); black + tones 1-4 with the page on tone 2 (ab8c3e6) replaced it
 * for a day and is gone. The index-map machinery below is unchanged by either.
 *
 * ── Why this needs an index map ────────────────────────────────────────────
 * The Theme layer is mode-independent: Figma builds it once, from Light-Mode,
 * and every role in it names a LIGHT-mode tone index — Primary's Surface reads
 * {Text.Surfaces.Neutral.Color-6} because in light mode it paints tone 6. In
 * dark mode that same reference has to answer for tone 3. So the per-mode
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
 * Black (only where chosen) has no row in the tables; it is filed under tone 1
 * by the same "lighter answers for darker" rule.
 */
import chroma from 'chroma-js';
import { blendColors } from './colorScale';

export const DARK_LADDER_LEVELS = [
  'Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest',
] as const;
export type DarkLadderLevel = typeof DARK_LADDER_LEVELS[number];

/** The dark-mode tone each surface level PAINTS, for every theme. */
export const DARK_LADDER_TONE: Record<DarkLadderLevel, number> = {
  'Surface-Dimmest': 1,
  'Surface-Dim': 2,
  'Surface': 3,
  'Surface-Bright': 4,
  'Surface-Brightest': 5,
};

/** The table tone a level's roles are answered from (black, where chosen, reads tone 1's). */
export function darkTableTone(level: DarkLadderLevel): number {
  return Math.max(1, DARK_LADDER_TONE[level]);
}

/**
 * Pure black is reserved for a designer who chose it: a Black page or black
 * cards. Then the Neutral palette's tone 1 (its Surface-Dimmest, and the
 * Default theme's when the page palette is Neutral) paints #000000. Otherwise
 * every tone 1 is the palette's own tinted tone 1. (The rule from 7ad2bf4.)
 */
export function blackChosen(sel?: { background?: unknown; cardColoring?: unknown } | null): boolean {
  return sel?.background === 'black' || sel?.background === 'Neutral/Surface-Dimmest' || sel?.cardColoring === 'black';
}
/** The export names a theme's sections in the plural. */
export const SECTION_LEVEL: Record<string, DarkLadderLevel> = {
  'Surfaces-Dimmest': 'Surface-Dimmest',
  'Surfaces-Dim': 'Surface-Dim',
  'Surfaces': 'Surface',
  'Surfaces-Bright': 'Surface-Bright',
  'Surfaces-Brightest': 'Surface-Brightest',
};

/** Where the windows are recorded in a mode's data (a plain array, not a token). */
export const LADDER_WINDOWS_KEY = 'Ladder-Windows';

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
  /* The band pass (cssgen/darkBandPass.ts) repoints the Primary, Secondary
     and Tertiary themes' references at the colors their lighter dark-mode
     surfaces need, so their Text references no longer name the table index
     their level uses. The windows are recorded before that, and every reader
     of the maps keeps seeing exactly the windows it saw before. */
  const stored = modeData?.[LADDER_WINDOWS_KEY];
  if (Array.isArray(stored)) return stored as ThemeWindow[];
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
 * A card (the five Container levels) in dark mode is the theme palette's
 * tone 4 MIXED with the PAGE (tone 3), with more tone 4 at each level:
 *
 *   Container-Lowest   50% tone 4, 50% page
 *   Container-Low      65% tone 4
 *   Container          75% tone 4
 *   Container-High     90% tone 4
 *   Container-Highest  tone 4 itself
 *
 * Owner, 2026-11-04: the card logic the generator had before the ladder work
 * (one tone above the page, mixed over the page at 50 / 65 / 75 / 90 / 100 —
 * then Color-3 over Color-2), shifted up one tone with the page. Tone 5 cards
 * (ab8c3e6 / 7ed5bc8) were too light.
 *
 * Every value is a SOLID color, mixed ahead of time with blendColors — the
 * same mix light-mode cards use (docs/container-logic.md). Nothing is painted
 * with opacity: "No opacity on containers — they should be solid colors."
 *
 * ONE set per theme. The mix is always against the page (tone 3), never
 * against the surface a card happens to sit on, so the five colors are the
 * same on Dimmest, Dim, Surface, Bright and Brightest. That is what lets the
 * CSS, the preview and Figma (whose Surface collection holds one value per
 * theme and level) hold exactly the same values.
 *
 * Known consequence (accepted by the owner): Surface-Bright IS tone 4 and
 * Surface-Brightest is tone 5, so on those two the cards sit level with or
 * darker than the surface. Cards belong on the page and the Dim levels in
 * dark mode. No workaround is applied.
 *
 * A card inside a card uses a HIGHER Container level (High or Highest inside a
 * Container card): the levels rise toward tone 4, so a higher one is lighter.
 *
 * Every role a card carries has to pass on every card color. For the light
 * foregrounds dark mode uses, the lightest card is the hardest, and no card is
 * lighter than tone 4 itself (Highest) — so a role that passes on tone 4
 * passes on every card.
 */
export const DARK_CARD_TONE = 4;
export const DARK_CARD_LEVELS = [
  'Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest',
] as const;
export type DarkCardLevel = typeof DARK_CARD_LEVELS[number];
/** The share of tone 4 in each card level; the rest is the page (tone 3). */
export const DARK_CARD_ALPHA: Record<DarkCardLevel, number> = {
  'Container-Lowest': 0.5,
  'Container-Low': 0.65,
  'Container': 0.75,
  'Container-High': 0.9,
  'Container-Highest': 1,
};

/** A card level's SOLID color: tone 4 (`face`) mixed with the page (tone 3). */
export function darkCardHex(face: string, page: string, level: DarkCardLevel): string {
  const f = chroma(face).hex('rgb').toLowerCase();
  if (DARK_CARD_ALPHA[level] >= 1) return f;
  return blendColors(f, chroma(page).hex('rgb'), DARK_CARD_ALPHA[level]).toLowerCase();
}

/** A theme's five card colors, lowest first. */
export function darkCardHexes(face: string, page: string): Record<DarkCardLevel, string> {
  return Object.fromEntries(DARK_CARD_LEVELS.map((l) => [l, darkCardHex(face, page, l)])) as Record<DarkCardLevel, string>;
}

/** A theme's five card colors off its 12-tone ramp (tone 1 first): tone 4 over the page, tone 3. */
export function darkCardHexesForRamp(ramp: string[]): Record<DarkCardLevel, string> {
  return darkCardHexes(ramp[DARK_CARD_TONE - 1], ramp[DARK_LADDER_TONE.Surface - 1]);
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

/* ─── Bands: the Primary, Secondary and Tertiary themes keep their color ────
 *
 * Owner decision, 2026-11-04 (Figma "Surf — dark mode colors (tones 1–5)",
 * node 10837:2): in dark mode a themed section keeps some of its color.
 *
 * For the Primary, Secondary and Tertiary THEMES only, the dark-mode Surface is
 *
 *   S = min(L, 8)
 *
 * where L is the tone that theme's Surface paints in LIGHT mode. A light tone
 * 1-7 "stays true" (same index, painted from the dark ramp); 8-12 is capped at
 * 8. The other levels are centred on it — Dimmest S-2, Dim S-1, Bright S+1,
 * Brightest S+2, clamped to 1..12 — and the cards keep the ladder's card
 * relationship, shifted: tone S+1 mixed over S at 50 / 65 / 75 / 90 / 100%,
 * one set per theme on every level.
 *
 * Everything else keeps the ladder above: the Default theme and the page
 * (tones 1-5, page 3, cards tone 4 over 3), Neutral, Info, Success, Warning,
 * Error, App-Bar, Nav-Bar, Status and the black rule.
 *
 * Example (Surf's published palettes): Primary light 9 -> dark 8, so its
 * levels are 6 / 7 / 8 / 9 / 10; Tertiary light 7 -> 7 (5 / 6 / 7 / 8 / 9).
 * cssgen/darkBandPass.ts puts it into the exported JSON.
 */
export const BAND_THEMES = ['Primary', 'Secondary', 'Tertiary'] as const;
export const BAND_MAX_TONE = 8;

const clampTone = (t: number) => Math.max(1, Math.min(12, t));

/** The dark-mode Surface tone of a band theme whose light Surface is tone `L`. */
export function bandSurfaceTone(L: number): number {
  return clampTone(Math.min(L, BAND_MAX_TONE));
}

/** A band theme's five dark-mode levels, centred on S. */
export function bandTones(S: number): Record<DarkLadderLevel, number> {
  return {
    'Surface-Dimmest': clampTone(S - 2),
    'Surface-Dim': clampTone(S - 1),
    'Surface': clampTone(S),
    'Surface-Bright': clampTone(S + 1),
    'Surface-Brightest': clampTone(S + 2),
  };
}

/** The dark ramp's light half starts here: tones 1-5 are dark, 6-12 light
 *  (DARK_TONE_SCALE jumps from L* 24 to 58 between them). */
export const DARK_RAMP_LIGHT_FROM = 6;

/**
 * The tone a band theme's cards are mixed from: one above the Surface.
 *
 * Two clamps, both falling back to one BELOW (S-1):
 *  - S+1 past the ramp (S = 12) — the owner's rule; cannot happen while S <= 8.
 *  - S+1 across the dark ramp's split (S = 5): tone 6 sits in the light half,
 *    so the five mixes run from L* ~41 to ~58, and no one text color clears
 *    4.5:1 on all of them (white fails from Container up, black on Lowest).
 *    Cards one tone darker keep every card on the surface's own side — the
 *    shape the ladder already accepts on its tone-5 Brightest, where the cards
 *    sit darker than the surface.
 */
export function bandCardTone(S: number): number {
  if (S + 1 > 12) return S - 1;
  if (S < DARK_RAMP_LIGHT_FROM && S + 1 >= DARK_RAMP_LIGHT_FROM) return S - 1;
  return S + 1;
}

/** A band theme's five card colors off its dark ramp (tone 1 first). */
export function bandCardHexesForRamp(ramp: string[], S: number): Record<DarkCardLevel, string> {
  return darkCardHexes(ramp[bandCardTone(S) - 1], ramp[S - 1]);
}

export interface BandInfo {
  theme: string;
  palette: string;
  /** the tone the theme's Surface paints in light mode */
  L: number;
  S: number;
  tones: Record<DarkLadderLevel, number>;
  cardTone: number;
}

/** Where the band pass records the bands, in each mode's data (plain JSON, not tokens). */
export const LADDER_BANDS_KEY = 'Ladder-Bands';

/** The bands recorded in a mode's data, by theme. */
export function recordedBands(modeData: any): Record<string, BandInfo> {
  const b = modeData?.[LADDER_BANDS_KEY];
  return b && typeof b === 'object' && !Array.isArray(b) ? b as Record<string, BandInfo> : {};
}
