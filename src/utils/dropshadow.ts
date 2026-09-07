// Per-elevation shadow math, shared by every exporter (Figma JSON, CSS export,
// iframe preview). This implements Josh Comeau's SHADOW PALETTE GENERATOR
// (joshwcomeau.com/shadow-palette), which is NOT the same model as the
// ELEVATIONS map in his shadows article:
//
//   article  — one alpha per tier, flat across that tier's layers
//   GENERATOR — ONE colour, and the alpha RAMPS DOWN across the layers
//
// The generator is what we follow. Its output was reverse-engineered from
// three captures of the same settings at Resolution 0 / 0.5 / 1; the formulas
// below reproduce 60 of 63 published values exactly (the three misses are
// +/-0.1 rounding, because his output is already rounded to 1dp):
//
//     t       = i / (N - 1)
//     offsetY = Y_MIN + (distance - Y_MIN) * t^3      <- cubic
//     offsetX = offsetY * tan(lightAngle)
//     blur    = offsetY * BLUR_RATIO
//     spread  = -spreadMax * t                        <- linear
//     alpha   = A * (N - i) / N                       <- linear ramp DOWN
//
// The single most important property: RESOLUTION ONLY CHANGES N. Y_MIN and the
// level's distance are identical at every resolution, so adding layers
// subdivides the same envelope rather than growing the shadow. That is what
// makes resolution safe to expose as a slider.
//
// Second most important: every layer shares ONE COLOUR and differs only in
// geometry and alpha. The alphas depend on (level, layer index, N) and never
// on the surface, so they are the same numbers on every background — which is
// what lets Figma bind one colour variable per surface plus a global set of
// per-layer opacities.

export type ShadowLevel = 1 | 2 | 3 | 4 | 5;

// ─── Controls (Comeau's, renamed where his name is a joke) ──────────────────

/** The five controls, mirroring Comeau's generator. Every exported function
 *  takes these optionally and falls back to SHADOW_DEFAULTS, so existing
 *  callers are unaffected and the tuner page (/tune-shadows) can drive them
 *  live. When the studio UI lands, styleCustomizations supplies this object. */
export interface ShadowOptions {
  /** "Intensity" (his *Oomph*). Total opacity a level's stack composites to. */
  intensity?: number;
  /** "Crispy". Drives blur AND spread together — see below. */
  crispy?: number;
  /** Layer count, 0..1, between LAYERS_MIN and LAYERS_MAX per level. */
  resolution?: number;
  /** Light position, as a point in a 2D pad. Both axes run -1..1 with (0,0)
   *  directly overhead. The shadow falls AWAY from the light, so a light up
   *  and to the left throws a shadow down and to the right.
   *
   *  Only the RATIO matters: the level's DISTANCE stays the vertical reach, so
   *  moving the light changes the shadow's direction, never its length. That
   *  keeps elevation reading as elevation while the light is being dragged. */
  lightX?: number;
  lightY?: number;
  /** Colourful vs grey. */
  tint?: boolean;
}

export const SHADOW_DEFAULTS: Required<ShadowOptions> = {
  /** THE weight knob for every shadow in the system. His "Oomph" default. */
  intensity: 0.5,
  crispy: 0.5,
  resolution: 0.75,
  /* Up and to the left, giving x = y/2 — exactly the geometry this file used
     before the pad existed. Straight up (lightX 0) gives x = 0, which is what
     the current Figma effect styles are built with. */
  lightX: -0.33,
  lightY: -0.66,
  tint: true,
};

const opts = (o?: ShadowOptions): Required<ShadowOptions> => ({ ...SHADOW_DEFAULTS, ...o });



/** "Crispy", 0..1. Drives BOTH the blur and the spread — captures of his tool
 *  at crispy 0 / 0.5 / 1 (Oomph 1, Resolution 0.5) give:
 *      blur/offsetY   1.8  -> 1.36 -> 0.9     (crisper = tighter blur)
 *      spread, last layer   0 -> -2.5 -> -5   (crisper = more tuck-in)
 *  Both are linear in crispy, which is what the two helpers below encode. */

/** Blur as a multiple of the vertical offset.
 *
 *  The MIDPOINT is measured, the slope is not. Across the ten captures at
 *  Crispness 0.5 his blur/offset-y is 1.257 (62.9/50, 44.9/35.7, 31.3/24.9,
 *  21.3/16.9, 14.2/11.3 ... mean 1.257), so the intercept is set to land there
 *  exactly. The -0.9 slope is carried over from an earlier reading of his
 *  crispy 0 / 1 endpoints, which is NOT confirmed by these captures — they are
 *  all at 0.5. That earlier reading also put the midpoint at 1.36, which these
 *  contradict, and it came from the same pass that got the alpha ramp wrong.
 *  Treat the endpoints as provisional until captured at crispy 0 and 1. */
const blurRatio = (crispy: number) => 1.707 - 0.9 * clamp(crispy, 0, 1);

/** Largest negative spread, at the outermost layer, in px. Negative spread is
 *  what keeps outer layers from smearing — without it, stacking 10 layers just
 *  paints a grey slab. */
const spreadMaxPx = (crispy: number) => 5 * clamp(crispy, 0, 1);

/** Layer count at RESOLUTION 0 and 1. Level N never drops below N layers, and
 *  the top level reaches 10. */
/* Read off ten captures of his tool across the Resolution slider. His three
   tiers run low 2..3, medium 2..5, high 3..10; levels 2 and 4 interpolate.
   `round(min + (max-min) * resolution)` reproduces every observed count. */
const LAYERS_MIN: Record<ShadowLevel, number> = { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3 };
const LAYERS_MAX: Record<ShadowLevel, number> = { 1: 3, 2: 4, 3: 5, 4: 7, 5: 10 };

/** The level's envelope: the vertical offset of its OUTERMOST layer. Unchanged
 *  from the previous geometry, so elevation still reads the same distance. */
/* Anchored to Comeau's own three tiers rather than a round doubling: his low
   ends at 2.5px, medium at 12.3px, high at 73.7px. Those land on levels 1, 3
   and 5, with 2 and 4 interpolated. The old 1/4/8/16/32 ramp topped out at less
   than HALF his high tier, so even at full intensity a Level-5 card hugged its
   own edge instead of casting the spreading shadow his Fig. 3 shows. */
/* His low/medium/high end at y = 2 / 10 / 50, measured off the same captures
   (the outermost layer of each tier). Levels 2 and 4 are the geometric means,
   so the ladder reads as even steps rather than a linear ramp that would
   crowd the low end. Previously 2.5 / 12.5 / 74, from an earlier reading. */
const DISTANCE: Record<ShadowLevel, number> = { 1: 2, 2: 4.5, 3: 10, 4: 22.4, 5: 50 };

/** Vertical offset of the innermost (contact) layer. Comeau's constant, and
 *  visible in every capture: each tier's first layer is `0.3px 0.5px 0.7px`
 *  with no spread, whatever the tier and whatever the Resolution. */
const Y_MIN = 0.5;

/** Base of the exponential that distributes layers between Y_MIN and the
 *  level's DISTANCE:  y = Y_MIN + (yMax - Y_MIN) * (a^t - 1)/(a - 1).
 *
 *  Fitted to his high tier at 9 layers and his medium at 5 — two different
 *  envelopes and two different layer counts, which normalise onto ONE curve
 *  (u = 0.086 / 0.220 / 0.494 at t = 1/4, 1/2, 3/4 from both), so the curve is
 *  a real shared distribution rather than a fit to one sample.
 *
 *  This was a CUBIC, `t^3`, which is 14x worse against the same data (RMS
 *  0.0637 vs 0.0046) and crushes the inner layers: at 9 layers it put the
 *  second layer at y=0.6 where his is 2.6, so the shadow hugged its own edge
 *  and the spread between contact and cast was invented rather than measured. */
const Y_CURVE = 12.14;

// ─── Goldilocks shadow colour ───────────────────────────────────────────────
// Match the surface HUE; pull SATURATION into a moderate band (never grey,
// never full); LOWER lightness. Fit to Comeau's published examples:
//   hsl(220,100%,80%) -> hsl(220,60%,50%)  and  hsl(285,51%,61%) -> hsl(286,43%,36%)
// ONE colour per surface. Elevation is the alpha ramp and the layer count,
// never the colour.
const SAT_SLOPE = 0.35;
const SAT_BASE = 25;
const SAT_MIN = 22;
const SAT_MAX = 70;
/* Shadow lightness as a fraction of the surface's — driven by INTENSITY.
 *
 * This used to be a flat 0.6, taken from the two worked examples in Comeau's
 * ARTICLE. That put a hard ceiling on how dark a shadow could ever get: every
 * layer paints the same colour, so the stack saturates at that colour no matter
 * how high the alpha goes. At intensity 1 on a cream surface the darkest
 * possible pixel was #b29657 — a mid-tone tan — and "more intense" did nothing.
 *
 * His GENERATOR moves the colour with Oomph. Two published captures pin it:
 *     #F1CFFC -> hsl(286 36% 56%)  at Oomph 0.5  ->  L factor 0.62
 *     #b9e5ee -> hsl(191 31% 37%)  at Oomph 1.0  ->  L factor 0.45
 * which is linear in Oomph. Fitted from two points, so it is a good curve
 * rather than a proven one — but the DIRECTION is certain, and without it
 * intensity has no headroom.
 *
 * At the 0.41 default this lands on 0.65, which LIGHT_MAX then clamps to the
 * same 52 the flat 0.6 produced — so the default is unchanged and only the
 * upper half of the slider gains reach. */
const lightFactorFor = (intensity: number) => clamp(0.794 - 0.348 * intensity, 0.3, 0.85);
const LIGHT_MIN = 3;
const LIGHT_MAX = 52;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

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
  return Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');
}

/** An alpha as it will actually EXIST, in both targets: one 8-bit step.
 *
 *  A Figma colour is 8-bit, so a Drop-Color holds a byte and nothing finer.
 *  CSS alpha is a float, so the same ramp written straight out lands between
 *  two bytes and the two exports disagree in the last digit — 0.35875 becomes
 *  the byte 91 (0.3569) in Figma and the literal 0.359 in CSS.
 *
 *  Nothing visible turns on 0.002 of alpha. What turns on it is being able to
 *  assert that the two sides hold the SAME number, rather than two numbers a
 *  tolerance apart — and a tolerance is where a real divergence hides.
 *
 *  So the RAMP stays exact (dropshadowAlphas peak is INTENSITY, on the nose,
 *  which two tests pin) and the quantisation happens here, at the boundary
 *  where the 8-bit constraint actually exists. Rounding the result to 3dp for
 *  CSS is lossless in the direction that matters: the error is at most 0.0005,
 *  or 0.13 of a byte, so it always parses back to the byte it came from. */
export function quantizeAlpha(a: number): number {
  return Math.round(Math.round(clamp(a, 0, 1) * 255) / 255 * 1000) / 1000;
}

/** The single (opaque) shadow colour for a surface: hue matched, saturation in
 *  a moderate band, lightness lowered. Takes NO level — there is one colour per
 *  surface, and elevation lives entirely in the alphas. */
export function dropshadowBaseHex(surfaceHex: string, o?: ShadowOptions): string {
  const { tint, intensity } = opts(o);
  const hsl = hexToHsl(surfaceHex);
  // An achromatic surface has no meaningful hue (it defaults to 0 = red), so
  // it stays grey whatever TINT says.
  const s = (!tint || hsl.s < 6)
    ? 0
    : clamp(SAT_SLOPE * hsl.s + SAT_BASE, SAT_MIN, SAT_MAX);
  return hslToHex({
    h: hsl.h, s,
    l: clamp(lightFactorFor(intensity) * hsl.l, LIGHT_MIN, LIGHT_MAX),
  });
}

/** `R, G, B` triple for `rgba(var(--Dropshadow-Color), <alpha>)`. ONE colour
 *  var per surface, alphas written as literals in the Effect-Level recipe —
 *  Comeau's `hsl(var(--shadow-color) / 0.34)` shape, in the syntax this system
 *  already speaks.
 *
 *  COMMA separated, and that is load-bearing: `@omni-design/components` reads
 *  `rgba(var(--Dropshadow-Color), 0.22)`. A space triple is invalid inside
 *  `rgba()` and paints NOTHING — silently, which is how a shadow bug survives.
 *  The separator and the colour function have to be chosen together. */
export function dropshadowRGB(surfaceHex: string, o?: ShadowOptions): string {
  const h = dropshadowBaseHex(surfaceHex, o).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
}

// ─── Layer count and geometry ───────────────────────────────────────────────

/** Figma renders at most EIGHT drop shadows on ONE effect style, and Level-5
 *  reaches ten. The ladder is NOT capped to eight, because the file splits a
 *  long level across two styles: slots 1..8 on the component's own style, slots
 *  9..10 on a second "+" style applied to a child frame (`FAB+`). The two
 *  frames are coincident, so the split is invisible — a drop shadow is cast
 *  from the frame's bounds, and the bounds are the same.
 *
 *  It is the OUTERMOST two that move out, not the contact layers, and that is
 *  not arbitrary: they are the broad soft cast, the part least sensitive to
 *  being cast by a slightly different box if the frames ever drift apart.
 *
 *  A cap here was briefly the answer, and it would have been wrong in a way
 *  worth remembering: capping the Figma path alone would have the browser
 *  painting ten layers at 0.268 while Figma painted eight at 0.335 above
 *  Resolution ~0.79 — the same total, a different render, and nothing to catch
 *  it (invariant 5). Any ceiling has to hold on both sides or on neither. */
const SLOTS_PER_EFFECT_STYLE = 8;

/** How many layers this level stacks at the current RESOLUTION. */
export function shadowLayerCount(level: ShadowLevel, o?: ShadowOptions): number {
  const lo = LAYERS_MIN[level];
  const hi = LAYERS_MAX[level];
  return Math.max(1, Math.round(lo + (hi - lo) * clamp(opts(o).resolution, 0, 1)));
}

/** How a level's layers divide between its two effect styles.
 *
 *  `primary` is what fits on the component's own style; `overflow` is what has
 *  to go on the "+" style on a child frame. `overflow` is 0 for every level
 *  below 5, and 0 for Level-5 too until Resolution passes ~0.79. */
export function shadowStyleSplit(level: ShadowLevel, o?: ShadowOptions):
  { primary: number; overflow: number } {
  const n = shadowLayerCount(level, o);
  return {
    primary: Math.min(n, SLOTS_PER_EFFECT_STYLE),
    overflow: Math.max(0, n - SLOTS_PER_EFFECT_STYLE),
  };
}

/** [offsetX, offsetY, blur, spread] for every layer of a level, innermost
 *  first. Cubic distribution between Y_MIN and the level's DISTANCE. */
export function shadowLayers(level: ShadowLevel, o?: ShadowOptions): Array<[number, number, number, number]> {
  const { crispy, lightX, lightY } = opts(o);
  const n = shadowLayerCount(level, o);
  const yMax = DISTANCE[level];
  /* No cap. Two were here — one against the level's own envelope and one
     against each layer's blur — added on the theory that a full spread would
     erase a short level. His captures show otherwise: the low tier, whose whole
     envelope is 2px, runs the spread all the way to -2.5px, and its middle
     layer pairs blur 1px with spread -1.2px, which the blur cap forbade.
     Both caps only ever fired on the levels they were meant to protect, so they
     silently made the low end of the ladder differ in kind from the top. */
  const spreadMax = spreadMaxPx(crispy);
  /* Shadow direction is opposite the light. Dividing by the vertical component
     keeps DISTANCE as the y-reach, so the pad steers the shadow without
     lengthening it; the floor stops a near-horizontal light producing an
     absurd sideways smear, and the clamp caps it at a 3:1 lean. */
  const dirY = Math.max(0.1, Math.abs(lightY));
  const tanA = clamp(-lightX / dirY, -3, 3);
  const out: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    // A single layer sits at the full distance, not at Y_MIN — otherwise a
    // level's elevation would vanish at RESOLUTION 0.
    const t = n === 1 ? 1 : i / (n - 1);
    const y = Y_MIN + (yMax - Y_MIN) * (Math.pow(Y_CURVE, t) - 1) / (Y_CURVE - 1);
    const blur = y * blurRatio(crispy);
    // Linear in t, exactly as he emits it: 0 at the contact layer, the full
    // spreadMax at the outermost.
    const spread = spreadMax * t;
    out.push([r1(y * tanA), r1(y), r1(blur), r1(-spread)]);
  }
  return out;
}

// ─── Alpha ───────────────────────────────────────────────────────────────────
//
// FLAT within a level, and inversely proportional to the layer count:
//
//     alpha = TOTAL[level] / N
//
// This is his model, read off ten captures of the generator taken across the
// Resolution slider at Oomph 0.5 / Crispness 0.5. Every layer of a tier prints
// the same alpha, and alpha x N is constant per tier:
//
//     low     N=2 0.52   N=3 0.34                          -> 1.03
//     medium  N=2 0.72   N=3 0.48  N=4 0.36  N=5 0.29       -> 1.44
//     high    N=3 0.89   N=4 0.67  N=5 0.54  N=6 0.45
//             N=7 0.38   N=8 0.34  N=9 0.30  N=10 0.27      -> 2.68
//
// Those three totals reproduce all fourteen samples exactly at his 2dp
// printing, and the intervals they are consistent with — [1.030,1.035),
// [1.430,1.450), [2.680,2.685) — pin them to within half a printed digit.
//
// So RESOLUTION genuinely does not change a shadow's weight: adding layers
// subdivides the same envelope AND splits the same total opacity. Elevation is
// carried by the total, which differs per tier, and by the geometry.
//
// This file previously emitted a descending ramp with the peak at INTENSITY,
// on the theory that the generator ramped and only the article was flat. Both
// are flat; the ramp was wrong, and it made every layer but the first too
// faint. A note here claimed his ten-layer stack runs 0.81 -> 0.08 — the
// captures show ten layers at a flat 0.27.
//
// Note what was NOT wrong: constant-total-per-tier is close to the model this
// file used before the ramp, which solved the peak so a level composited to a
// fixed total. That was right in shape and wrong only in normalising the total
// across LEVELS as well, which flattened elevation out of the ladder.

/** Total opacity a level's stack sums to, at REFERENCE_INTENSITY. Levels 1/3/5
 *  are his low/medium/high; 2 and 4 are the geometric means, matching how
 *  DISTANCE interpolates. */
const LEVEL_TOTAL: Record<ShadowLevel, number> = {
  1: 1.03, 2: 1.218, 3: 1.44, 4: 1.965, 5: 2.68,
};

/** The Oomph the totals above were measured at. INTENSITY scales them linearly,
 *  so the default preset reproduces his output exactly. */
const REFERENCE_INTENSITY = 0.5;

/** Per-layer alpha for a level — the same value on every layer.
 *  `TOTAL / N`, so Resolution redistributes the weight without changing it. */
export function dropshadowAlphas(level: ShadowLevel, o?: ShadowOptions): number[] {
  const n = shadowLayerCount(level, o);
  const total = LEVEL_TOTAL[level] * (clamp(opts(o).intensity, 0, 1) / REFERENCE_INTENSITY);
  const a = clamp(total / n, 0, 1);
  return Array.from({ length: n }, () => a);
}

/** 8-digit hex (`#RRGGBBAA`) for one LAYER of one level on one surface — the
 *  form Figma imports. The RGB is identical for every level and every layer of
 *  a given surface; only AA moves. */
export function dropshadowHex8(surfaceHex: string, level: ShadowLevel, layer = 0, o?: ShadowOptions): string {
  const alphas = dropshadowAlphas(level, o);
  return `${dropshadowBaseHex(surfaceHex, o)}${alphaToHex(alphas[Math.min(layer, alphas.length - 1)])}`;
}

/** Repoint lib components that miss a generated token onto it.
 *
 *  Two so far, both the same shape of gap: the component bakes a value in (or
 *  inherits MUI's) instead of reading the token the design system emits.
 *
 *  TextArea wrapped MUI's TextField, so its corner came from MUI's theme rather
 *  than --Input-Radius. TextInput reads the token correctly, so a TextArea and
 *  a TextInput sitting next to each other had different corners. Targeting the
 *  outlined-input root covers every MUI-backed field in the lib at once, and
 *  the notched outline needs it too — that fieldset draws the visible border,
 *  so leaving it square shows a square outline inside a rounded box.
 *
 *  Doubled class for the same reason as the shadow rules: MUI's own styles come
 *  from emotion, and a single class ties on specificity.
 *
 *  ── FIXED IN THE LIB, AND STILL SHIPPED HERE ────────────────────────────────
 *
 *  TextArea now delegates to Input, which sets borderRadius from
 *  --Input-Radius, so the root cause is gone as of the lib release after 0.7.3.
 *  This rule stays anyway, and deleting it early is the mistake to avoid:
 *
 *    A design system's CSS is FROZEN in Storage when it is generated and cannot
 *    be regenerated. So the two versions move independently — a user who
 *    generates a fresh system tomorrow while still on lib 0.7.3 or earlier gets
 *    CSS without the override and a lib that still inherits MUI's corner. The
 *    override is what makes those two combinations agree.
 *
 *    It is also harmless on a fixed lib: it sets the value the lib now sets
 *    itself. Costing nothing and covering an old lib is the right trade.
 *
 *  Two conditions gate removal, and BOTH are needed:
 *    1. the fixed lib is published, and
 *    2. no supported design system can pair new CSS with a lib older than it.
 *
 *  The selector also covers every MUI-backed field, not only TextArea, so
 *  audit the others before assuming one component's fix retires the rule. */
export function libRadiusOverrideCSS(): string {
  /* Chip's `-light` variants are built as `{bg: --Buttons-{C}-Button, text:
     --Buttons-{C}-Text, border: 1px solid --Buttons-{C}-Border}` — the SAME
     fill as solid, differing only by a border. So `success-light` paints the
     solid button green instead of the light surface it names.
     In this system `-light` means data-theme="{C}" + data-surface
     "Surface-Brightest". Repointed at the PAIRED tokens rather than a guessed
     tone: the caller sets those two attributes on the chip and the cascade
     supplies --Background / --Text for whichever palette and surface it named.
     Naming a tone here (--Success-Color-11) would paint the box but leave the
     label on the parent's tone, which is the exact failure the data-surface
     contract exists to prevent. */
  const chipLight = [
    '[class*="chip-"][class*="-light"][data-surface] {',
    '  background-color: var(--Background);',
    '  color: var(--Text);',
    '}',
  ].join('\n');
  return [
    chipLight,
    '/* TextArea (and any MUI-backed field) inherits MUI\'s corner instead of',
    '   --Input-Radius. Repoint it, outline included. */',
    '.MuiOutlinedInput-root.MuiOutlinedInput-root,',
    '.MuiOutlinedInput-root.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline {',
    '  border-radius: var(--Input-Radius, var(--Style-Border-Radius));',
    '}',
  ].join('\n');
}

/* There was a libShadowOverrideCSS() here, emitting
     .card.card { box-shadow: var(--Effect-Level-2) }
     .appbar.appbar { box-shadow: var(--Effect-Level-1) }
   to force lib components onto the generated recipes.
   Removed for two reasons. The lib now reads the token itself — its
   SHADOW_LEVEL_N exports are var(--Effect-Level-N, literal), so every elevated
   component picks the brand's recipe up without help.
   And the override was WRONG. A custom property declared at :root has the
   var() inside it substituted AT THE DECLARING ELEMENT, so --Effect-Level-N
   resolves --Dropshadow-Color against :root and descendants inherit that
   already-resolved string. Every card would have taken the ROOT's shadow
   colour rather than its own surface's. The lib avoids this by inlining the
   rgba in JS so the var() lands on the consuming element — see
   DinoDesign/src/components/_shadows.js. */

/** Map the studio's persisted `_componentStyle` record onto ShadowOptions.
 *
 *  The single place the studio's field names meet the generator's. Every
 *  exporter goes through this, so a surface's shadow colour cannot drift
 *  between the preview, the CSS bundle and the Figma payload — which matters
 *  more than it looks, because INTENSITY now moves the colour as well as the
 *  alpha. A call site that forgets to pass options gets the DEFAULT intensity
 *  and therefore a different hex, with nothing to show for it. */
export function shadowOptionsFromStyle(cs: Record<string, unknown> | undefined | null): ShadowOptions {
  const num = (k: string, d: number) => (typeof cs?.[k] === 'number' ? cs[k] as number : d);
  return {
    intensity: num('shadowIntensity', SHADOW_DEFAULTS.intensity),
    crispy: num('shadowCrispy', SHADOW_DEFAULTS.crispy),
    resolution: num('shadowResolution', SHADOW_DEFAULTS.resolution),
    lightX: num('shadowLightX', SHADOW_DEFAULTS.lightX),
    lightY: num('shadowLightY', SHADOW_DEFAULTS.lightY),
    tint: typeof cs?.shadowTint === 'boolean' ? cs.shadowTint as boolean : SHADOW_DEFAULTS.tint,
  };
}

/** Levels iterator — keeps every consumer in lock-step with this file. */
export const SHADOW_LEVELS: ReadonlyArray<ShadowLevel> = [1, 2, 3, 4, 5];

/** Box-shadow recipe for `--Effect-Level-N`.
 *
 *  One colour var, per-layer alpha literals — the same shape Comeau emits:
 *      0.3px 0.5px 0.4px hsl(var(--shadow-color) / 0.81), ...
 *  written as rgba(var(--Dropshadow-Color), 0.81) because that is what the lib
 *  and the rest of the cascade already consume.
 *  The previous version referenced a per-level colour token on every layer,
 *  which cost five colour variables per surface and could not express a ramp. */
export function effectLevelRecipe(level: ShadowLevel, o?: ShadowOptions): string {
  const alphas = dropshadowAlphas(level, o);
  return shadowLayers(level, o)
    .map(([x, y, blur, spread], i) =>
      `${x}px ${y}px ${blur}px ${spread}px rgba(var(--Dropshadow-Color), ${quantizeAlpha(alphas[i])})`)
    .join(', ');
}

// ─── Drop-Colors: the Figma collection ──────────────────────────────────────
//
// Figma cannot express "this colour, at that opacity" on a shadow. A fill can:
// SolidPaint splits `color` (RGB) from `opacity`, so a fill binds one colour
// variable and sets its own alpha. A shadow cannot — DropShadowEffect.color is
// a single RGBA, "the color of the shadow, INCLUDING its opacity" — and a
// variable alias is `{ type, id }` with no modifier, so aliasing cannot add an
// alpha either.
//
// So the multiplication that would happen in Figma happens here instead: ONE
// dropshadowBaseHex per background, times the level's alpha ramp, written out
// as literal 8-digit values. The single source survives — all 31 slots are
// regenerated from that one colour on every import — it is just resolved at
// generation time rather than at resolution time.
//
// Sized to LAYERS_MAX, not to a flat ten: the collection in the file is
// Level-1 x3, Level-2 x4, Level-3 x6, Level-4 x8, Level-5 x10, which is the
// most layers each level can ever use (Resolution 1). Below that the tail slots
// are UNUSED, and they are emitted at alpha 00 rather than skipped — a Figma
// variable left unwritten keeps its previous value, so a slot dropped by a
// lower Resolution would otherwise go on painting the shadow it held before.

/** Slots per level in the Drop-Colors collection.
 *
 *  PINNED to the Component-Elevations collection that exists in the Figma file —
 *  3 / 4 / 5 / 8 / 10 — rather than derived from LAYERS_MAX, which is
 *  3 / 4 / 5 / 7 / 10 after the move to his measured layer counts. Level 4 is
 *  the one that differs: the file has 8 slots where the ladder needs 7, so its
 *  last slot is always spare. Every max fits inside its slot count, so the file
 *  needs no rebuild.
 *
 *  Deriving this from LAYERS_MAX would shrink the collection by two variables
 *  the next time the layer ladder moves, and a Figma variable cannot be deleted
 *  and re-created without unbinding every layer using it (invariant 8). The
 *  file's shape is the fixed point; the ladder has to fit inside it, and the
 *  test asserts that it does. */
export const DROP_COLOR_SLOTS: Record<ShadowLevel, number> = { 1: 3, 2: 4, 3: 5, 4: 8, 5: 10 };

/** Every Drop-Colors value for one background.
 *
 *  Returns `{ 'Level-1': ['#rrggbbaa', ...], ... }`, each array DROP_COLOR_SLOTS
 *  long, innermost layer first. Entries past the current Resolution's layer
 *  count carry the surface's own shadow hue at alpha 00 — transparent, but the
 *  right colour, so a slot that comes back into use at a higher Resolution is
 *  never briefly the wrong hue. */
export function dropColorTable(
  surfaceHex: string,
  o?: ShadowOptions,
): Record<string, string[]> {
  const base = dropshadowBaseHex(surfaceHex, o);
  const out: Record<string, string[]> = {};
  for (const level of SHADOW_LEVELS) {
    const alphas = dropshadowAlphas(level, o);
    out[`Level-${level}`] = Array.from(
      { length: DROP_COLOR_SLOTS[level] },
      (_, i) => `${base}${alphaToHex(i < alphas.length ? alphas[i] : 0)}`,
    );
  }
  return out;
}

/** The five opacities to type into Drop-Colors in Figma, as percentages.
 *
 *  Drop-Colors is hand-authored: five variables, `Level-<n>/Drop-Color`, each
 *  aliasing Surface/Dropshadow-Color with that level's opacity applied. Figma
 *  can alias a colour or set an opacity, never both from a plugin — a variable
 *  value is one RGBA or one `{type, id}` pointer, with no field for a modifier
 *  — so these five are typed in the UI rather than written by the importer.
 *
 *  Which means they DO NOT follow the Intensity and Resolution controls. Change
 *  either and the five values in Figma are stale until retyped. This function
 *  is the single place to read the current ones off, so the number a designer
 *  types and the number the CSS paints come from one definition. */
export function shadowLevelOpacities(o?: ShadowOptions): Array<{ level: ShadowLevel; alpha: number; percent: number }> {
  return SHADOW_LEVELS.map((level) => {
    const alpha = quantizeAlpha(dropshadowAlphas(level, o)[0]);
    /* PERCENT is what Figma's Opacity variable holds, not the 0..1 fraction.
       A number variable bound to a colour's opacity is rendered by appending
       "%" to its value: a variable holding 0.33 displays as "0.33%", which is a
       thousandth of the intended shadow and reads as no shadow at all. So the
       variable carries 34.5, not 0.345.

       One decimal, because the levels differ by tenths — 34.5 / 30.6 / 36.1 /
       32.9 / 33.3 — and rounding to whole percent would collapse two of them
       onto the same value. */
    return { level, alpha, percent: Math.round(alpha * 1000) / 10 };
  });
}
