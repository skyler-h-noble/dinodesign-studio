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
  /** THE weight knob for every shadow in the system. */
  intensity: 0.41,
  crispy: 0.5,
  resolution: 0.5,
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

/** Blur as a multiple of the vertical offset. */
const blurRatio = (crispy: number) => 1.8 - 0.9 * clamp(crispy, 0, 1);

/** Largest negative spread, at the outermost layer, in px. Negative spread is
 *  what keeps outer layers from smearing — without it, stacking 10 layers just
 *  paints a grey slab. */
const spreadMaxPx = (crispy: number) => 5 * clamp(crispy, 0, 1);

/** Layer count at RESOLUTION 0 and 1. Level N never drops below N layers, and
 *  the top level reaches 10. */
const LAYERS_MIN: Record<ShadowLevel, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const LAYERS_MAX: Record<ShadowLevel, number> = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 10 };

/** The level's envelope: the vertical offset of its OUTERMOST layer. Unchanged
 *  from the previous geometry, so elevation still reads the same distance. */
/* Anchored to Comeau's own three tiers rather than a round doubling: his low
   ends at 2.5px, medium at 12.3px, high at 73.7px. Those land on levels 1, 3
   and 5, with 2 and 4 interpolated. The old 1/4/8/16/32 ramp topped out at less
   than HALF his high tier, so even at full intensity a Level-5 card hugged its
   own edge instead of casting the spreading shadow his Fig. 3 shows. */
const DISTANCE: Record<ShadowLevel, number> = { 1: 2.5, 2: 6, 3: 12.5, 4: 30, 5: 74 };

/** Vertical offset of the innermost (contact) layer. Comeau's constant. */
const Y_MIN = 0.5;

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

/** How many layers this level stacks at the current RESOLUTION. */
export function shadowLayerCount(level: ShadowLevel, o?: ShadowOptions): number {
  const lo = LAYERS_MIN[level];
  const hi = LAYERS_MAX[level];
  return Math.max(1, Math.round(lo + (hi - lo) * clamp(opts(o).resolution, 0, 1)));
}

/** [offsetX, offsetY, blur, spread] for every layer of a level, innermost
 *  first. Cubic distribution between Y_MIN and the level's DISTANCE. */
export function shadowLayers(level: ShadowLevel, o?: ShadowOptions): Array<[number, number, number, number]> {
  const { crispy, lightX, lightY } = opts(o);
  const n = shadowLayerCount(level, o);
  const yMax = DISTANCE[level];
  // Never let the spread exceed the shadow it is shrinking — a flat 5px would
  // erase Level-1 entirely.
  // Cap against the shadow being shrunk: a flat 5px would erase Level-1, whose
  // whole envelope is 1px. Comeau does not need this — his smallest tier is
  // 2.5px tall where ours is 1px.
  const spreadMax = Math.min(spreadMaxPx(crispy), yMax * 0.5);
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
    const y = Y_MIN + (yMax - Y_MIN) * Math.pow(t, 3);
    const blur = y * blurRatio(crispy);
    /* Spread grows linearly while the offset grows cubically, so on the inner
       layers the tuck-in outruns the shadow and swallows it: Level-2's middle
       layer lands at y=0.9 with a -1 spread and renders NOTHING. Comeau's tool
       has the same hole (his low tier pairs y=0.7 with spread=-2.5), but a dead
       layer costs a real paint and a real Figma slot for nothing, so the spread
       is capped against the layer's own blur — never tuck in further than the
       blur can reach back out. */
    const spread = Math.min(spreadMax * t, blur * 0.9);
    out.push([r1(y * tanA), r1(y), r1(blur), r1(-spread)]);
  }
  return out;
}

// ─── Alpha ramp ─────────────────────────────────────────────────────────────

/** Per-layer alphas for a level, innermost first — the linear ramp
 *  `A * (N - i) / N`. These depend only on the level and the layer count, never
 *  on the surface, so they are identical on every background. */
export function dropshadowAlphas(level: ShadowLevel, o?: ShadowOptions): number[] {
  const n = shadowLayerCount(level, o);
  /* INTENSITY is the peak alpha — the contact layer — and the stack ramps down
     linearly from it, which is what Comeau's generator emits: at Oomph 1 his
     ten-layer stack runs 0.81 -> 0.08, i.e. A*(N-i)/N with A ~ 0.8.
     This previously SOLVED A so every level composited to the same total. That
     gave the tidy property that Resolution never changed a shadow's weight, but
     it is not his model and it is why our shadows were so much weaker than his:
     at Level 5 it drove A to 0.112 and the outermost layer — the one that
     actually casts the large soft shadow — to 0.014 against his 0.08. */
  const A = clamp(opts(o).intensity, 0, 1);
  return Array.from({ length: n }, (_, i) => clamp((A * (n - i)) / n, 0, 1));
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
 *  TextArea wraps MUI's TextField, so its corner comes from MUI's theme rather
 *  than --Input-Radius. TextInput reads the token correctly, so a TextArea and
 *  a TextInput sitting next to each other had different corners. Targeting the
 *  outlined-input root covers every MUI-backed field in the lib at once, and
 *  the notched outline needs it too — that fieldset draws the visible border,
 *  so leaving it square shows a square outline inside a rounded box.
 *
 *  Doubled class for the same reason as the shadow rules: MUI's own styles come
 *  from emotion, and a single class ties on specificity.
 *
 *  The real fix is for the lib to read the token; this is the override until it
 *  does. */
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
      `${x}px ${y}px ${blur}px ${spread}px rgba(var(--Dropshadow-Color), ${Math.round(alphas[i] * 1000) / 1000})`)
    .join(', ');
}
