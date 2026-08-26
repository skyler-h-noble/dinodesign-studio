// Per-elevation shadow color math, shared by every exporter (Figma JSON,
// CSS export, iframe preview). Follows Josh Comeau's "Designing Beautiful
// Shadows in CSS" approach: shadow hue matches the surface, lightness drops
// and saturation rises progressively with elevation, and alpha climbs so
// higher elevations read as more dramatic — not weaker.
//
// ALL surfaces: drop L (darken), boost S, climb alpha. We deliberately do NOT
// lift L for dark surfaces anymore — the shadow is uniformly darker regardless
// of the surface tone.

export type ShadowLevel = 1 | 2 | 3 | 4 | 5;

/** Per-LAYER alpha for each level's single shared color token. Lower than the
 *  old 2-layer curve because a level now stacks 3–8 layers that composite —
 *  higher levels use a touch less per-layer alpha so they don't go muddy.
 *  TUNABLE: bump these if shadows read too faint, drop them if too heavy. */
const ALPHA = 0.16;
const ALPHAS = [ALPHA, ALPHA, ALPHA, ALPHA, ALPHA];

/* One alpha for EVERY layer of EVERY level.
 *
 * This was a per-layer ladder — 0.20, 0.17, 0.15, 0.13, 0.11 — which is not
 * what Comeau does. His stack is five layers at an identical opacity:
 *     0 1px 1px   hsl(0deg 0% 0% / 0.075),
 *     0 2px 2px   hsl(0deg 0% 0% / 0.075), ... 0 16px 16px  ... / 0.075
 * The ladder made every shadow read as FADING OUT as it spread, and made the
 * five Dropshadow-Color tokens differ only in transparency — so a higher
 * elevation looked weaker, which is the opposite of what elevation means.
 *
 * Depth now comes from two things instead, both of which increase with the
 * level: how many layers stack, and how dark the colour is (LIGHT_FACTORS).
 * TUNABLE: raise if shadows read too faint, lower if too heavy. */

// ── Goldilocks shadow color (Comeau "Designing Beautiful Shadows") ──────────
// Match the surface HUE; pull SATURATION into a moderate band (never grey,
// never full); LOWER lightness. Fit to Comeau's own published examples:
//   hsl(220,100%,80%) → hsl(220,60%,50%)   and   hsl(285,51%,61%) → hsl(286,43%,36%)
//   S ≈ SAT_SLOPE·surfaceS + SAT_BASE   ·   L ≈ LIGHT_FACTOR·surfaceL
// One color per surface — elevation comes from ALPHAS + the layered geometry,
// NOT from per-level color shifts. All values TUNABLE.
const SAT_SLOPE = 0.35;
const SAT_BASE = 25;
const SAT_MIN = 22;
const SAT_MAX = 70;
// LIGHT_FACTOR drives the core rule: shadow lightness is a fraction of the
// surface lightness, so the DARKER the surface, the DARKER the shadow. The
// floor is kept very low (a hint of the hue, never pure black) so even
// near-black surfaces still get a darker-than-surface shadow rather than
// clamping up to a lighter grey.
/* Lightness factor PER LEVEL — the shadow colour deepens as elevation rises.
 *
 * dropshadowBaseHex used one factor for every level and said so in its
 * signature: "Level-independent: elevation is expressed through ALPHAS + the
 * layered geometry, not color." With the alpha ladder gone, colour is where
 * elevation now lives. Level 1 is a light contact shadow; level 5 is a deep
 * one, and the same surface produces five genuinely different mixes.
 * Index is level-1. TUNABLE. */
const LIGHT_FACTORS = [0.62, 0.55, 0.48, 0.41, 0.34];
/** Level 1's factor, for callers that ask for a base colour with no level. */
const LIGHT_FACTOR = LIGHT_FACTORS[0];
const LIGHT_MIN = 3;
const LIGHT_MAX = 52;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface HSL { h: number; s: number; l: number }

function hexToHsl(hex: string): HSL {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.slice(0, 6);
  const n = parseInt(full, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const hN = (h % 360 + 360) % 360 / 360;
  const sN = Math.max(0, Math.min(100, s)) / 100;
  const lN = Math.max(0, Math.min(100, l)) / 100;
  let r: number; let g: number; let b: number;
  if (sN === 0) {
    r = g = b = lN;
  } else {
    const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
    const p = 2 * lN - q;
    const hue2rgb = (pp: number, qq: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return pp + (qq - pp) * 6 * tt;
      if (tt < 1 / 2) return qq;
      if (tt < 2 / 3) return pp + (qq - pp) * (2 / 3 - tt) * 6;
      return pp;
    };
    r = hue2rgb(p, q, hN + 1 / 3);
    g = hue2rgb(p, q, hN);
    b = hue2rgb(p, q, hN - 1 / 3);
  }
  const to2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function alphaToHex(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
}

/** Return the base (opaque) "goldilocks" shadow hex for a surface: hue matched,
 *  saturation pulled into a moderate band, lightness lowered — the authentic,
 *  non-washed-out shadow color from Comeau's article. Level-independent:
 *  elevation is expressed through ALPHAS + the layered geometry, not color.
 *  `level` is accepted for signature compatibility / future per-level tuning. */
export function dropshadowBaseHex(surfaceHex: string, level?: ShadowLevel): string {
  const hsl = hexToHsl(surfaceHex);
  // Achromatic surfaces (white / grey / black) have no meaningful hue — their
  // hue defaults to 0 (red). Injecting SAT_BASE there paints a pink/red shadow
  // on a white card. Only tint the shadow when the surface actually carries
  // color; otherwise keep it a neutral grey (saturation 0).
  const s = hsl.s < 6 ? 0 : clamp(SAT_SLOPE * hsl.s + SAT_BASE, SAT_MIN, SAT_MAX);
  // Always darken — lower the lightness regardless of the surface tone. (No
  // more lift-for-dark; the shadow is uniformly darker for every color.)
  const factor = level ? LIGHT_FACTORS[level - 1] : LIGHT_FACTOR;
  return hslToHex({ h: hsl.h, s, l: clamp(factor * hsl.l, LIGHT_MIN, LIGHT_MAX) });
}

/** Per-level alpha for the dropshadow token. */
export function dropshadowAlpha(level: ShadowLevel): number {
  return ALPHAS[level - 1];
}

/** 8-digit hex (`#RRGGBBAA`) for a shadow token at a given surface + level.
 *  This is the form Figma imports as a tinted-with-opacity fill, and the
 *  form CSS can drop straight into `box-shadow`. */
export function dropshadowHex8(surfaceHex: string, level: ShadowLevel): string {
  return `${dropshadowBaseHex(surfaceHex, level)}${alphaToHex(ALPHAS[level - 1])}`;
}

/** Levels iterator — keeps every consumer in lock-step with this file's
 *  constants. */
export const SHADOW_LEVELS: ReadonlyArray<ShadowLevel> = [1, 2, 3, 4, 5];

// ─── Layered shadow geometry (Shadow Palette model, as built in Figma) ───────
// Level N stacks N layers with growing offset (angled light: offsetX = offsetY/2,
// blur = offsetY, NO spread). Layer i is colored with --Dropshadow-Color-i, so
// the tight contact layer is the strongest token (Color-1) and larger/farther
// layers use higher, fainter tokens. This MUST stay identical to the Figma
// effect styles AND the lib's components/_shadows.js. Tuples are
// [offsetX, offsetY, blur].
const LEVEL_LAYERS: Record<ShadowLevel, Array<[number, number, number]>> = {
  1: [[0.5, 1, 1]],
  2: [[1, 2, 2], [2, 4, 4]],
  3: [[1, 2, 2], [2, 4, 4], [4, 8, 8]],
  4: [[1, 2, 2], [2, 4, 4], [4, 8, 8], [8, 16, 16]],
  5: [[1, 2, 2], [2, 4, 4], [4, 8, 8], [8, 16, 16], [16, 32, 32]],
};

/** [offsetX, offsetY, blur] tuples for a level; layer i (0-based) is colored
 *  with --Dropshadow-Color-(i+1). */
export function shadowLayers(level: ShadowLevel): Array<[number, number, number]> {
  return LEVEL_LAYERS[level];
}

/** Box-shadow recipe for `--Effect-Level-N`: the N layered drop shadows, ALL
 *  using that LEVEL's colour token --Dropshadow-Color-N.
 *
 *  Each layer used to take its own token by layer index, which is why the five
 *  tokens were alpha steps of one colour and why a Level-3 card looked like a
 *  Level-1 card with extras. N is the ELEVATION: Level-3 draws three layers,
 *  all in Dropshadow-Color-3, and Level-5 draws five in the darker
 *  Dropshadow-Color-5. */
export function effectLevelRecipe(level: ShadowLevel): string {
  return LEVEL_LAYERS[level]
    .map(([x, y, blur]) => `${x}px ${y}px ${blur}px var(--Dropshadow-Color-${level})`)
    .join(', ');
}
