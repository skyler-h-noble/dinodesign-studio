/**
 * The dark-mode surface ladder and the cards that sit on it.
 *
 * ── The decision (owner, from the Figma mockups) ───────────────────────────
 * In DARK mode every theme — Default included, no special case — paints its
 * five surface levels on tones 1-5 of its own palette:
 *
 *   Surface-Dimmest   tone 1
 *   Surface-Dim       tone 2
 *   Surface           tone 3      (so the dark PAGE is tone 3)
 *   Surface-Bright    tone 4
 *   Surface-Brightest tone 5
 *
 * Strictly darkest to lightest, all inside the dark band. Light mode does not
 * change.
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
 *               Two themes can name the same index for different tones (Info's
 *               Bright and Primary's Surface are both 6). The entry then holds
 *               the answer for the LIGHTER tone: every dark-mode foreground is
 *               lighter than its surface, and contrast against a lighter
 *               foreground only grows as the surface gets darker, so an answer
 *               that passes on the lighter tone passes on the darker one too.
 */
import chroma from 'chroma-js';

export const DARK_LADDER_LEVELS = [
  'Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest',
] as const;
export type DarkLadderLevel = typeof DARK_LADDER_LEVELS[number];

/** The dark-mode tone of each surface level, for every theme. */
export const DARK_LADDER_TONE: Record<DarkLadderLevel, number> = {
  'Surface-Dimmest': 1,
  'Surface-Dim': 2,
  'Surface': 3,
  'Surface-Bright': 4,
  'Surface-Brightest': 5,
};

/**
 * Pure black is reserved for a designer who chose it: a Black page or black
 * cards. Otherwise tone 1 — Neutral's Surface-Dimmest included — is the
 * palette's own tinted tone 1.
 */
export function blackChosen(sel?: { background?: unknown; cardColoring?: unknown }): boolean {
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
  byPalette: Record<string, Record<number, number>>;
  global: Record<number, number>;
}

export function darkIndexMaps(windows: ThemeWindow[]): DarkIndexMaps {
  const byPalette: DarkIndexMaps['byPalette'] = {};
  const global: DarkIndexMaps['global'] = {};
  for (const w of windows) {
    const pal = (byPalette[w.palette] ??= {});
    for (const [level, n] of Object.entries(w.index) as [DarkLadderLevel, number][]) {
      const tone = DARK_LADDER_TONE[level];
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

/* ─── Cards ───────────────────────────────────────────────────────────────
 *
 * Cards (the five Container levels) LIFT above the surface they sit on,
 * Lowest to Highest, along the surface's own palette ramp — hue-preserving,
 * because each step blends toward the next lighter tone of the same palette
 * (the same sRGB blend the light-mode card ladders use).
 *
 * How far they lift, per surface tone:
 *   tones 1-2  two tones up      (the darkest grounds have the most room)
 *   tones 3-4  one tone up
 *   tone 5     toward tone 6, only as far as every card role still passes
 *
 * The lift is measured in perceived lightness (CIELAB L*), not in tones,
 * because palettes space their tones differently — Popsicle's Secondary 3→4
 * gains far less than its Primary does. If a span would give the five levels
 * less than MIN_CARD_STEP_L each, the lift extends further up the ramp until it
 * does, but never out of the dark band (tone 5) on tones 1-4. The five levels
 * then take the rounded colors nearest equal L* steps that keep the minimum
 * (a short dark lift passes through few distinct 8-bit colors).
 */
export const MIN_CARD_STEP_L = 0.9;
/**
 * Brightest (tone 5) is the exception: its cards may only lift as far as the
 * card roles still pass, so its step is whatever that allows. The card roles
 * are held to at least this much per level on that surface — every card role
 * that would fail on a card MIN_BRIGHTEST_STEP_L x 5 above tone 5 moves up its
 * own palette until it passes there (darkLadderPass, step 6). Roles that pass
 * are left alone, so the actual cap is usually higher.
 */
export const MIN_BRIGHTEST_STEP_L = 0.5;
/** How far 8-bit rounding can move a dark color's L* — room left in a span so
 *  five rounded steps still clear the minimum. */
const ROUNDING_MARGIN_L = 1.5;
const SPAN_TONES: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 };

export function labL(hex: string): number {
  try { return chroma(hex).lab()[0]; } catch { return NaN; }
}

/** The color at a fractional position on a 12-tone ramp (1-based). */
function along(ramp: string[], p: number): string {
  const lo = Math.max(1, Math.min(12, Math.floor(p)));
  const hi = Math.min(12, lo + 1);
  const f = Math.max(0, Math.min(1, p - lo));
  if (f === 0 || lo === hi) return chroma(ramp[lo - 1]).hex();
  return chroma.mix(ramp[lo - 1], ramp[hi - 1], f, 'rgb').hex();
}

/** The position in [a, b] whose L* is `target` (L* rises along the ramp). */
function positionForL(ramp: string[], a: number, b: number, target: number): number {
  let lo = a, hi = b;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (labL(along(ramp, mid)) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface CardLadder {
  /** Container-Lowest, -Low, Container, -High, -Highest. */
  cards: [string, string, string, string, string];
  /** How far up the ramp Highest sits (e.g. 5.085 = 8.5% toward tone 6). */
  top: number;
  /** True when role contrast, not the span, set the top. */
  capped: boolean;
}

/**
 * The five cards on a dark surface at `tone` of `ramp` (12 hexes, tone 1
 * first). `fits` says whether every role a card carries still passes on a
 * candidate card color; it is consulted for the top of the lift (on tone 5 it
 * is what stops the lift — without it tone 5's cards would climb to tone 6).
 */
export function darkCardLadder(
  ramp: string[],
  tone: number,
  fits?: (cardHex: string) => boolean,
): CardLadder {
  const t = Math.max(1, Math.min(5, Math.round(tone)));
  const ceiling = t <= 4 ? 5 : 6;
  const L0 = labL(ramp[t - 1]);
  /* The span must leave room for five visible steps after 8-bit rounding,
     which moves a dark color's L* by up to ~0.3 — hence the margin. */
  const need = 5 * MIN_CARD_STEP_L + ROUNDING_MARGIN_L;
  let top = Math.min(t + SPAN_TONES[t], ceiling);
  if (labL(along(ramp, top)) - L0 < need) {
    top = labL(along(ramp, ceiling)) - L0 >= need
      ? positionForL(ramp, top, ceiling, L0 + need)
      : ceiling;
  }
  let capped = false;
  if (fits && !fits(along(ramp, top))) {
    capped = true;
    let lo = t, hi = top;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(along(ramp, mid))) lo = mid; else hi = mid;
    }
    top = lo;
  }
  /* A short lift between two dark tones only passes through a couple of dozen
     distinct 8-bit colors, so the step five levels can actually clear may come
     out under the minimum even when the L* span is wide enough. While it does,
     and there is dark band left, the top moves a little further up. A capped
     top (tone 5) never moves: role contrast set it. */
  const minStep = t === 5 ? MIN_BRIGHTEST_STEP_L : MIN_CARD_STEP_L;
  let picked = pickCards(ramp, t, L0, top);
  while (!capped && picked.step < minStep && top < ceiling) {
    top = Math.min(ceiling, top + 0.05);
    picked = pickCards(ramp, t, L0, top);
  }
  return { cards: picked.cards, top, capped };
}

/**
 * The four inner cards and the top, from the ROUNDED colors that exist on the
 * lift: the largest step every level can clear is found first, then each
 * level takes the color nearest its equal share of the lift that still keeps
 * that step. Highest is the top itself.
 */
function pickCards(ramp: string[], t: number, L0: number, top: number): { cards: CardLadder['cards']; step: number } {
  const topHex = along(ramp, top);
  const L1 = labL(topHex);
  const cands: Array<{ hex: string; L: number }> = [];
  for (let i = 1; i < 600; i++) {
    const h = along(ramp, t + ((top - t) * i) / 600);
    const L = labL(h);
    if (L > L0 && L < L1 && (!cands.length || L > cands[cands.length - 1].L)) cands.push({ hex: h, L });
  }
  const pickWith = (d: number, aimEqual: boolean): string[] | null => {
    const out: string[] = [];
    let prev = L0;
    for (let k = 1; k <= 4; k++) {
      const want = aimEqual ? Math.max(L0 + (k / 5) * (L1 - L0), prev + d) : prev + d;
      const c = cands.find((x) => x.L >= want - 1e-9);
      if (!c) return null;
      out.push(c.hex);
      prev = c.L;
    }
    return L1 - prev >= d - 1e-9 ? [...out, topHex] : null;
  };
  let lo = 0, hi = (L1 - L0) / 5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (pickWith(mid, false)) lo = mid; else hi = mid;
  }
  const cards = pickWith(lo, true) ?? pickWith(lo, false)
    ?? [1, 2, 3, 4].map((k) => along(ramp, t + ((top - t) * k) / 5)).concat(topHex);
  return { cards: cards as CardLadder['cards'], step: lo };
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
function over(fg: string, bg: string): string {
  const c = chroma(fg);
  const a = c.alpha();
  return a >= 1 ? c.hex('rgb') : chroma.mix(bg, c.alpha(1).hex('rgb'), a, 'rgb').hex();
}

export function cardRolesFit(decls: Record<string, string | undefined>): (cardHex: string) => boolean {
  const has = (k: string) => typeof decls[k] === 'string' && chroma.valid(decls[k] as string);
  return (card: string) => {
    for (const k of TEXT_45) if (has(k) && ratio(over(decls[k]!, card), card) < 4.5) return false;
    for (const k of NON_TEXT_3) if (has(k) && ratio(over(decls[k]!, card), card) < 3) return false;
    for (const b of BTNS) {
      const p = `--Buttons-${b}`;
      const edges = [`${p}-Border`, `${p}-Button`].filter(has).map((k) => ratio(over(decls[k]!, card), card));
      if (edges.length && Math.max(...edges) < 3) return false;
      for (const k of [`${p}-Outline-Text`, `${p}-Outline-Quiet`]) {
        if (has(k) && ratio(over(decls[k]!, card), card) < 4.5) return false;
      }
    }
    return true;
  };
}
