/**
 * Chart colors — the eight generated hues, and the tone each of the sixteen
 * chart series takes on each ground.
 *
 * Full reasoning, the measurements and the rejected alternatives:
 * [docs/chart-colors.md](../../docs/chart-colors.md).
 *
 * The three facts this encodes, each of which took a measurement to establish:
 *
 * 1. Charts are drawn on exactly TWO grounds, Surface-Brightest and
 *    Surface-Dimmest, named by `--Chart-BG`. Not the ten surface levels.
 *
 * 2. Chart colors are THEME-INDEPENDENT. Ramps are per-mode, not per-theme, so
 *    one tone per series clears 3:1 on every theme's version of a ground. The
 *    caller passes every theme's ground and `solve` verifies against all of
 *    them — that verification is the claim, not an assumption.
 *
 * 3. Tones must be solved JOINTLY per ground. Picking a "home" tone for
 *    separability and letting a per-series 3:1 search re-tone it collapsed two
 *    series onto one color (dE 0.3) while every individual check passed.
 */

/** tone index (1-12) -> hex */
export type Ramp = Record<number, string>;

export interface ChartSolveInput {
  /** every palette's ramp for ONE mode, e.g. { Primary: {1:'#..',...}, ... } */
  ramps: Record<string, Ramp>;
  /** also offer the generated hues half-step tones (rampForHue's halfSteps) */
  halfSteps?: boolean;
  /**
   * The OTHER mode's ramps. A tone is only usable if it satisfies the contrast
   * and chroma rules in BOTH, because the tone is shared across modes and each
   * mode emits from its own ramp.
   *
   * Omitting this was a real bug: the light ramp's Primary at t4 is #3f4525,
   * chroma 20, which cleared an 18 floor — but the dark ramp's t4 is #2a2e1b,
   * chroma 13, nowhere near it. The solve validated one ramp and the payload
   * emitted the other, so a near-black landed in the dark palette unchecked.
   */
  altRamps?: Record<string, Ramp>;
  /** every theme's hex for this ground; the solve must clear 3:1 on all */
  grounds: string[];
  /** hues of the generated series, shared across modes and grounds */
  hues: number[];
  /** ramp whose lightness/chroma profile the generated hues borrow */
  profile: Ramp;
}

export const BRAND_SERIES = ['Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
export const STATE_SERIES = ['Error', 'Warning', 'Success', 'Info'] as const;

export const MIN_CONTRAST = 3.0;
/**
 * What "vivid" actually is: CHROMA, not nearness to the contrast threshold.
 *
 * A first attempt capped contrast at 4.5 to stop the solver overshooting 3:1
 * on a light ground. It worked and then backfired — on Surface-Brightest only
 * tone 6 lands under 4.5, so all sixteen series collapsed onto one tone, and
 * with lightness fixed, hue became the only separator (legend dE fell to 2.7).
 *
 * A chroma floor says the same thing better and is symmetric across grounds.
 * Set at 18, not 28. A higher floor was tried and it silently blocked the
 * thing it was meant to enable: Primary at t5 measures chroma 28 — right on a
 * 28 floor, excluded by a rounding hair — and t4 measures 20. Both are moves
 * that improve the brand's worst pair from dE 5.2 to 9.5 AND the whole set's
 * from 2.7 to 3.2, so the floor was costing separation to protect saturation
 * nobody was losing. The generated hues peak at 52 and are unaffected either
 * way; it is the brand ramps that run lower.
 *
 * In this brand's ramp the chroma runs 20 / 28 / 52 / 43 / 30 at tones 4-8, so
 * a floor near 18 leaves three usable tones on each ground — t4-t6 against a
 * near-white Surface-Brightest, t6-t8 against a near-black Surface-Dimmest —
 * which is enough room to separate on lightness again while every tone stays
 * saturated.
 *
 * Dropped for a series with no tone above the floor rather than failing it: a
 * dull colour beats a missing one, and the fallback is reported in `widened`.
 * Neutral is exempt — it is achromatic by definition.
 */
export const CHROMA_FLOOR = 28;
/**
 * The brand series get a LOWER floor than everything else, and only they do.
 *
 * Spending lightness is what separates colours, and the brand hues are the
 * ones that collide — 23/64/115 deg here, straddling the red-green axis. The
 * brand owner authorised them to move: a series may stop reading as the
 * literal brand colour as long as the hue is the same, because the hue is the
 * identity. Nobody authorised that for the rest.
 *
 * Dropping the floor for ALL sixteen was tried and it worked too well: global
 * dE went 2.7 -> 6.8, but Neutral landed on #2e2e2e, Error on #4f1f1c and
 * Chart-10 on #5b374c — the muddiness the whole design is trying to avoid. The
 * generated hues peak at chroma 52 and have no reason to leave t6; the brand
 * ramps run 20 / 28 / 52 at t4 / t5 / t6, so only they need the lower bar.
 */
export const BRAND_CHROMA_FLOOR = 18;
export const TONE_BAND: [number, number] = [3, 10];
export const REF_TONE = 5;
/** a pair closer than this in hue, and further than ORDINAL_L apart in L*,
 *  reads as one color at two lightnesses — a sequence, not two categories */
export const ORDINAL_HUE = 24;
export const ORDINAL_L = 20;
export const ORDINAL_CAP = 2;

/* ── color math, dependency-free so this stays unit-testable ─────────────── */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) =>
  Math.round(clamp01(c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => srgbToLinear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* CIE Lab / LCh, D65 */
const labCache = new Map<string, [number, number, number]>();
function rgbToLab(hex: string): [number, number, number] {
  const hit = labCache.get(hex);
  if (hit) return hit;
  const out = rgbToLabUncached(hex);
  labCache.set(hex, out);
  return out;
}
function rgbToLabUncached(hex: string): [number, number, number] {
  const [R, G, B] = hexToRgb(hex).map((c) => srgbToLinear(c / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 1.0;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L: number, a: number, bb: number): string {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const R = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const G = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const B = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  return toHex(linearToSrgb(R), linearToSrgb(G), linearToSrgb(B));
}
export function lch(hex: string): [number, number, number] {
  const [L, a, b] = rgbToLab(hex);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 0.5 ? 0 : H];
}
export function fromLch(L: number, C: number, H: number): string {
  const r = (H * Math.PI) / 180;
  return labToRgb(L, Math.cos(r) * C, Math.sin(r) * C);
}
export const hueArc = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** CIEDE2000, dependency-free so this module stays unit-testable without
 *  chroma-js (chartPalette.test checks it against chroma's implementation).
 *
 *  It was CIE76, on the reasoning that chart colours are saturated and well
 *  separated, where CIEDE2000's corrections are small. On a LIGHT chart ground
 *  they are neither: 3:1 forces every series below L* ~59, so the set is dark
 *  and muted, and that is where CIE76 overstates a difference. It rated Surf's
 *  Up's Chart-7 / Chart-8 (#2d454c slate, #2a2f38 near-black) as distinct
 *  enough; a red-green colour-blind reader got 5.8. */
function deltaE(a: string, b: string): number {
  const [L1, a1, b1] = rgbToLab(a), [L2, a2, b2] = rgbToLab(b);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cb7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (x: number, y: number) => (x === 0 && y === 0 ? 0 : ((Math.atan2(y, x) / rad) + 360) % 360);
  const h1p = hue(a1p, b1), h2p = hue(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2);
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Cbp7 = Cbp ** 7;
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
/** Exposed for the test that checks it against chroma-js. */
export const chartDeltaE = deltaE;

/* Machado 2009, severity 1.0, applied in linear RGB. CVD matters for the
 * LEGEND — adjacent segments are separated by a border in --Chart-BG, which
 * Understanding 1.4.11 accepts in place of adjacent-color contrast. */
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
} as const;
function simulate(hex: string, kind: keyof typeof CVD): string {
  const [r, g, b] = hexToRgb(hex).map((c) => srgbToLinear(c / 255));
  const M = CVD[kind];
  return toHex(...(M.map((w) => linearToSrgb(w[0] * r + w[1] * g + w[2] * b)) as [number, number, number]));
}

/** the worst of normal, deuteranopic and protanopic distance — what a reader
 *  with any of the three actually gets */
/* Memoised, and not as a micro-optimisation: the hue search evaluates the same
 * hex pairs millions of times, and each raw call is two CVD simulations plus
 * three Lab conversions. Unmemoised it took a 0.26s test to 45s — unacceptable
 * for something that runs in the browser during a regenerate. Hexes are the
 * natural key and the function is pure, so the cache cannot go stale. */
const simCache = new Map<string, string>();
const simOf = (hex: string, kind: keyof typeof CVD) => {
  const k = kind[0] + hex;
  let v = simCache.get(k);
  if (v === undefined) { v = simulate(hex, kind); simCache.set(k, v); }
  return v;
};
const sepCache = new Map<string, number>();
export function separation(a: string, b: string): number {
  const key = a < b ? a + b : b + a;
  let v = sepCache.get(key);
  if (v !== undefined) return v;
  v = Math.min(
    deltaE(a, b),
    deltaE(simOf(a, 'deuteranopia'), simOf(b, 'deuteranopia')),
    deltaE(simOf(a, 'protanopia'), simOf(b, 'protanopia')),
  );
  sepCache.set(key, v);
  return v;
}

export function isOrdinalPair(a: string, b: string): boolean {
  const A = lch(a), B = lch(b);
  return hueArc(A[2], B[2]) < ORDINAL_HUE && Math.abs(A[0] - B[0]) > ORDINAL_L;
}
const pairScore = (a: string, b: string) =>
  isOrdinalPair(a, b) ? Math.min(separation(a, b), ORDINAL_CAP) : separation(a, b);

/** a 12-tone ramp at `hue`, borrowing `profile`'s lightness and chroma */
export function rampForHue(hue: number, profile: Ramp, halfSteps = false): Ramp {
  const out: Ramp = {};
  for (let n = 1; n <= 12; n++) {
    const src = profile[n];
    if (!src) continue;
    const [L, C] = lch(src);
    out[n] = fromLch(L, C, hue);
    /* Optional HALF steps, at the midpoint of a tone and the next in lightness
       and chroma. The ladder jumps L 37 -> 58 between t5 and t6 — the band a
       light-ground chart lives in (3:1 caps it near L 59) — so on whole tones
       the solver could only separate generated hues by pushing them darker.
       Offered to the solver as an alternative, never forced: see
       solveChartPalette, which keeps them only where they measurably help. */
    const next = halfSteps ? profile[n + 1] : undefined;
    if (next) {
      const [L2, C2] = lch(next);
      out[n + 0.5] = fromLch((L + L2) / 2, (C + C2) / 2, hue);
    }
  }
  return out;
}

/**
 * The generated hues, chosen ONCE and never varying by ground or mode: a series
 * that changed hue between grounds would make the legend lie.
 *
 * Chosen by maximising the worst-case perceptual distance, NOT by hue angle.
 * Spacing by LCh degrees produced four indistinguishable cyans — the blue
 * region compresses, so equal angles are not equal differences. A hard minimum
 * hue separation was also tried and measured worse; see the doc.
 */
export function chooseHues(count: number, ramps: Record<string, Ramp>, profile: Ramp): number[] {
  const fixed = BRAND_SERIES.map((n) => ramps[n]?.[REF_TONE]).filter(Boolean) as string[];

  /* PRECOMPUTED SEPARATION.
   *
   * The search evaluates the same hue pairs over and over, and each raw
   * separation is two CVD simulations plus three Lab conversions. Computing
   * the 360x360 matrix once up front turns every inner-loop comparison into an
   * array read, which is what lets the budget be generous.
   *
   * The alternative was cutting the budget, and that was measured: 72 starts
   * took 21 SECONDS per call, 12 starts 442ms (still enough to time out
   * tokenParity's many-brand sweep), and 6 starts was fast but found a worse
   * answer — worst dE 2.8 against 5.2. Precomputing gets both. */
  const STEP = 2;                       // hue resolution; 180 candidates
  const N = 360 / STEP;
  const cand: string[] = [];
  for (let i = 0; i < N; i++) cand.push(rampForHue(i * STEP, profile)[REF_TONE]);

  /** min separation from each candidate to the fixed brand colours */
  const toFixed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let w = Infinity;
    for (const f of fixed) w = Math.min(w, separation(cand[i], f));
    toFixed[i] = w;
  }
  /** candidate-to-candidate */
  const between = new Float32Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const d = separation(cand[i], cand[j]);
      between[i * N + j] = d;
      between[j * N + i] = d;
    }
  /** the fixed colours' own pairwise distances never change — included so the
   *  comparison sees the whole set, not just the part being moved */
  const fixedPairs: number[] = [];
  for (let i = 0; i < fixed.length; i++)
    for (let j = i + 1; j < fixed.length; j++) fixedPairs.push(separation(fixed[i], fixed[j]));

  const scoreOf = (idx: number[]) => {
    const ds = fixedPairs.slice();
    for (let a2 = 0; a2 < idx.length; a2++) {
      ds.push(toFixed[idx[a2]]);
      for (let b2 = a2 + 1; b2 < idx.length; b2++) ds.push(between[idx[a2] * N + idx[b2]]);
    }
    return ds.sort((x, y) => x - y);
  };
  /** lexicographic: worst pair leads, the rest break ties — so an improvement
   *  behind the minimum is still visible */
  const better = (x: number[], y: number[]) => {
    for (let i = 0; i < Math.min(x.length, y.length); i++)
      if (Math.abs(x[i] - y[i]) > 1e-9) return x[i] - y[i];
    return 0;
  };

  /* Multi-start even seed, then hill-climb. Greedy farthest-point was the
   * first approach and it strands its last picks — it took the single best
   * spot each round, and on this brand left Chart-9 and Chart-10 thirteen
   * degrees apart, two mauves. An even seed cannot strand anything.
   *
   * Hues are compared perceptually, never by angle: LCh degrees are not evenly
   * spaced, and spacing by them produced four indistinguishable cyans. */
  let best: number[] | null = null;
  let bestScore: number[] | null = null;
  const span = Math.round(N / count);
  for (let rot = 0; rot < span; rot++) {
    let idx = Array.from({ length: count }, (_, k) => (rot + k * span) % N);
    let score = scoreOf(idx);
    for (let pass = 0; pass < 200; pass++) {
      let improved = false;
      for (let i = 0; i < count && !improved; i++)
        for (let d = -12; d <= 12; d++) {
          if (!d) continue;
          const trial = idx.slice();
          trial[i] = (trial[i] + d + N) % N;
          if (trial.some((v, k) => k !== i && v === trial[i])) continue;
          const q = scoreOf(trial);
          if (better(q, score) > 0) { idx = trial; score = q; improved = true; break; }
        }
      if (!improved) break;
    }
    if (!bestScore || better(score, bestScore) > 0) { bestScore = score; best = idx.slice(); }
  }
  return (best as number[]).map((i) => i * STEP).sort((x, y) => x - y);
}

export interface GroundSolution {
  /** series name -> { tone, hex } */
  picks: Record<string, { tone: number; hex: string }>;
  /** series with no tone clearing 3:1 on every ground given */
  unsolvable: string[];
  /** worst pairwise separation among the picks */
  worstSeparation: number;
  /** pairs that still read as one color at two lightnesses */
  ordinalPairs: string[];
  /** series with no tone inside the contrast band, allowed to overshoot */
  widened: string[];
}

/**
 * Solve one ground. `grounds` is every theme's hex for that ground; a tone is
 * only usable if it clears 3:1 against ALL of them, which is what makes the
 * result theme-independent rather than merely assumed to be.
 */
export function solveGround(input: ChartSolveInput): GroundSolution {
  const { ramps, grounds, hues, profile, altRamps } = input;
  const halfSteps = !!input.halfSteps;
  const series: Record<string, Ramp> = {};
  const altSeries: Record<string, Ramp> = {};
  if (altRamps) {
    const altProfile = altRamps.Primary || altRamps.Neutral;
    for (const n of BRAND_SERIES) if (altRamps[n]) altSeries['Chart-' + n] = altRamps[n];
    if (altProfile) hues.forEach((h, i) => { altSeries['Chart-' + (i + 5)] = rampForHue(h, altProfile, halfSteps); });
    for (const n of STATE_SERIES) if (altRamps[n]) altSeries['Chart-State-' + n] = altRamps[n];
  }
  for (const n of BRAND_SERIES) if (ramps[n]) series['Chart-' + n] = ramps[n];
  hues.forEach((h, i) => { series['Chart-' + (i + 5)] = rampForHue(h, profile, halfSteps); });
  for (const n of STATE_SERIES) if (ramps[n]) series['Chart-State-' + n] = ramps[n];

  const names = Object.keys(series);
  /** the worst contrast this tone has against any of the grounds */
  const worstContrast = (hex: string) => Math.min(...grounds.map((g) => contrast(g, hex)));

  const usable: Record<string, number[]> = {};
  const widened: string[] = [];
  for (const n of names) {
    const passing: number[] = [];
    const vivid: number[] = [];
    // With halfSteps the generated hues also have t + 0.5; a brand ramp has
    // no entry there and is skipped, as before.
    for (let t = TONE_BAND[0]; t <= TONE_BAND[1]; t += halfSteps ? 0.5 : 1) {
      const hex = series[n][t];
      if (!hex) continue;
      if (worstContrast(hex) < MIN_CONTRAST) continue;
      /* the other mode emits from ITS ramp at this same tone — it has to clear
         3:1 there too, or the shared tone is only valid for one of them */
      const alt = altSeries[n]?.[t];
      if (alt && worstContrast(alt) < MIN_CONTRAST) continue;
      passing.push(t);
      const floor = (BRAND_SERIES as readonly string[]).includes(n.replace('Chart-', ''))
        ? BRAND_CHROMA_FLOOR : CHROMA_FLOOR;
      if (lch(hex)[1] < floor) continue;
      if (alt && lch(alt)[1] < floor) continue;
      vivid.push(t);
    }
    if (vivid.length) usable[n] = vivid;
    else { usable[n] = passing; if (passing.length) widened.push(n); }
  }
  const unsolvable = names.filter((n) => !usable[n].length);
  const live = names.filter((n) => usable[n].length);

  /* TWO seeds, and the better one wins.
   *
   * Neither is right everywhere, which is why this tries both:
   *
   *   max-chroma   every series on its most saturated usable tone. Best on a
   *                LIGHT ground, where the usable tones all sit on the dark
   *                side — spreading there moves colours toward each other and
   *                strips chroma as lightness falls (measured: dE 2.7 -> 2.0,
   *                with picks like #2e2e2e and #8a4043).
   *
   *   spread       round-robin across the usable tones. Best on a DARK ground,
   *                where the usable range is wide enough that lightness is a
   *                real second axis (dE 4.7 -> 6.7).
   *
   * The hill-climb alone cannot get from one to the other: it accepts only a
   * move that improves the GLOBAL minimum, and a crowded tone has many
   * near-equal worst pairs, so fixing one leaves the number unchanged. */
  const seeds: Record<string, number>[] = [];
  seeds.push(Object.fromEntries(live.map((n) => [n,
    usable[n].reduce((a, b) => (lch(series[n][a])[1] >= lch(series[n][b])[1] ? a : b))])));
  seeds.push(Object.fromEntries(live.map((n, i) => {
    const byChroma = [...usable[n]].sort((a, b) => lch(series[n][b])[1] - lch(series[n][a])[1]);
    return [n, byChroma[i % byChroma.length]];
  })));
  /*   brand-spread  the brand series across tones, everything else at max
   *                 chroma. The brand hues are the ones that collide — this
   *                 palette's sit at 23/64/115 deg, straddling the red-green
   *                 axis — while the generated hues are placed to avoid each
   *                 other and need no help. Spreading ALL fourteen moved
   *                 colours that were already fine and cost chroma for it;
   *                 spreading just these took their worst pair from dE 5.2 to
   *                 14.1 for about 17% average chroma.
   *
   *                 A brand series may stop reading as the literal brand
   *                 colour, and that is allowed: the HUE is the series'
   *                 identity and it is preserved, because each draws from its
   *                 own ramp. Lightness is negotiable. */
  {
    const brandLive = live.filter((n) => (BRAND_SERIES as readonly string[]).includes(n.replace('Chart-', '')));
    const seed: Record<string, number> = {};
    for (const n of live) {
      const byChroma = [...usable[n]].sort((a, b) => lch(series[n][b])[1] - lch(series[n][a])[1]);
      const k = brandLive.indexOf(n);
      seed[n] = k >= 0 ? byChroma[k % byChroma.length] : byChroma[0];
    }
    seeds.push(seed);
  }

  /* Scored on the whole sorted distribution, not just the minimum.
   *
   * Comparing seeds on the worst pair alone made improvements invisible: the
   * brand-spread seed takes Primary/Secondary/Tertiary from dE 5.2 to 14.1,
   * but if the GLOBAL worst pair is elsewhere the number does not move, so the
   * better palette scored identical and lost the tiebreak. Lexicographic on
   * the ascending distances keeps the minimum as the primary objective and
   * lets everything behind it break ties. */
  const profileOf = (p: Record<string, number>) => {
    const ds: number[] = [];
    let w = Infinity;
    let pair: [string, string] | null = null;
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        /* The state four never share a chart with the categorical ten
           (docs/chart-colors.md), so a state-vs-anything pair must not set the
           floor the ten are judged by. */
        if (live[i].startsWith('Chart-State-') !== live[j].startsWith('Chart-State-')) continue;
        const d = pairScore(series[live[i]][p[live[i]]], series[live[j]][p[live[j]]]);
        ds.push(d);
        if (d < w) { w = d; pair = [live[i], live[j]]; }
      }
    ds.sort((a, b) => a - b);
    return { w, pair, ds };
  };
  /** >0 when a is better than b, comparing worst pair first, then the next */
  const better = (a: { ds: number[] }, b: { ds: number[] }) => {
    for (let i = 0; i < Math.min(a.ds.length, b.ds.length); i++) {
      const diff = a.ds[i] - b.ds[i];
      if (Math.abs(diff) > 1e-9) return diff;
    }
    return 0;
  };
  const worst = profileOf;

  /* Hill-climb: move whichever member of the worst pair improves the global
     minimum most. Exhaustive is 8^16; this converges in a few hundred steps and
     the result is reported so it can be checked rather than trusted. */
  let pick: Record<string, number> = {};
  let cur: { w: number; pair: [string, string] | null; ds: number[] } =
    { w: -Infinity, pair: null, ds: undefined as any };
  for (const seed of seeds) {
    const p = { ...seed };
    let c = worst(p);
    for (let step = 0; step < 400; step++) {
      let improved = false;
      for (const n of c.pair || []) {
        for (const t of usable[n]) {
          if (t === p[n]) continue;
          const trial = { ...p, [n]: t };
          const got = worst(trial);
          if (better(got, c) > 0) { p[n] = t; c = got; improved = true; break; }
        }
        if (improved) break;
      }
      if (!improved) break;
    }
    if (cur.ds === undefined || better(c, cur) > 0) { pick = p; cur = c; }
  }

  /* BRAND SPREAD — a focused pass after the general solve.
   *
   * The brand series are the ones that collide: this palette's hues sit at
   * 23/64/115 deg, straddling the red-green axis, so at a shared tone they
   * measure dE 5.2 while the generated hues are placed to avoid each other and
   * need no help. A seed that spread them lost the general comparison, because
   * that scores the WHOLE set and the brand pair is not the global worst — so
   * the improvement was invisible to it.
   *
   * This maximises the brand four's own worst pair, subject to a hard rule
   * that the GLOBAL worst must not get worse. Hue is untouched — each series
   * still draws from its own ramp, so a darker Primary is still Primary's hue.
   * Lightness is what is being spent, which is the trade the brand owner
   * agreed to: a series may stop reading as the literal brand colour as long
   * as the hue is the same. */
  {
    const brand = live.filter((n) => (BRAND_SERIES as readonly string[]).includes(n.replace('Chart-', '')));
    if (brand.length > 1) {
      const globalFloor = worst(pick).w;
      const brandWorst = (p: Record<string, number>) => {
        let w = Infinity;
        for (let i = 0; i < brand.length; i++)
          for (let j = i + 1; j < brand.length; j++)
            w = Math.min(w, pairScore(series[brand[i]][p[brand[i]]], series[brand[j]][p[brand[j]]]));
        return w;
      };
      let bw = brandWorst(pick);
      for (let step = 0; step < 300; step++) {
        let improved = false;
        for (const n of brand) {
          for (const t of usable[n]) {
            if (t === pick[n]) continue;
            const trial = { ...pick, [n]: t };
            if (worst(trial).w < globalFloor - 1e-9) continue;   // never trade the set for the brand
            const q = brandWorst(trial);
            if (q > bw + 1e-9) { pick[n] = t; bw = q; improved = true; break; }
          }
          if (improved) break;
        }
        if (!improved) break;
      }
      cur = worst(pick);
    }
  }

  const picks: GroundSolution['picks'] = {};
  for (const n of live) picks[n] = { tone: pick[n], hex: series[n][pick[n]] };
  const ordinalPairs: string[] = [];
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      // A state colour and a categorical one never share a chart — the same
      // exclusion the scoring makes — so they cannot read as one sequence.
      if (live[i].startsWith('Chart-State-') !== live[j].startsWith('Chart-State-')) continue;
      if (isOrdinalPair(picks[live[i]].hex, picks[live[j]].hex))
        ordinalPairs.push(`${live[i]}/${live[j]}`);
    }

  return { picks, unsolvable, worstSeparation: cur.w, ordinalPairs, widened };
}

/** Group per mode per ground: `{ 'Light-Mode': { 'Surface-Brightest': { 'Color-1': {value, type} } } }`. */
export type ChartGroundPalette = Record<string, Record<string, Record<string, { value: string; type: 'color' }>>>;

/**
 * The chart series, solved per ground — ONE implementation for both exporters.
 *
 * This was inline in generateFigmaJSON, writing straight into the Figma
 * payload, so the CSS export had no way to reach it and the code could not
 * paint the colors Figma shows (invariant 5). Moved here unchanged; the Figma
 * payload and the CSS mode sheets now read the same result.
 */
export function solveChartPalette(designSystemJSON: any, modesPresent: string[] = ['Light-Mode', 'Dark-Mode']): ChartGroundPalette {
  const out: ChartGroundPalette = {};
    /* ONE TONE PER SERIES PER GROUND, VALID IN BOTH MODES.
     *
     * Solved per GROUND rather than per mode, because the tone has to be the
     * same in light and dark or nothing can be an alias — an alias to
     * Primary-Color-6 is tone 6 in both modes, and an earlier version that
     * solved each mode separately produced t6 light / t3 dark and would have
     * forced a literal for all fourteen series.
     *
     * Two grounds, and they are not symmetric:
     *
     *   Chart-Light-BG   light mode's Surface-Brightest. Dark mode has no
     *                    light chart ground — its Surface-Brightest measures
     *                    L 0.62-0.74, a mid-tone, which is the worst case for
     *                    any mark: 3:1 forces everything dark and muddy. So a
     *                    chart on a dark page uses the dark ground.
     *
     *   Chart-DarkBG     Surface-Dimmest from BOTH modes, solved together.
     *                    They measure L 0.027 and 0.010 — near enough that one
     *                    tone clears 3:1 on all eighteen.
     *
     * ALL TEN categorical colours are written, brand four included.
     *
     * They were aliased to the Icons collection at first, which looked right —
     * Icons are already surface-scoped and contrast-tuned. Measured, it was the
     * worst part of the palette: Icons tunes for icon contrast ON each surface,
     * which drives everything dark on a light ground, and Primary/Tertiary
     * collapsed to dE 1.8 on Chart-Light-BG and 1.0 in dark mode. The same two
     * at their solved ramp tones measure 5.2.
     *
     * The state four stay as aliases — they have one meaning each and do not
     * have to be told apart from the categorical set.
     * Full reasoning: docs/chart-colors.md.
     */
    const CHART_HUE_COUNT = 6;
    const CHART_GROUNDS = {
      'Surface-Brightest': { levels: ['Surface-Brightest'], modes: ['Light-Mode'] },
      'Surface-Dimmest':   { levels: ['Surface-Dimmest'],   modes: ['Light-Mode', 'Dark-Mode'] },
    } as const;

    const chartDefN = designSystemJSON.Metadata?.['Default-Settings']?.['Default-Theme']?.N?.value || 12;
    const bgKeyFor = (mode: string) => `Background-${mode === 'Dark-Mode' ? 2 : chartDefN}`;

    /* Charts keep the dark ramps from BEFORE the dark-mode chroma ease.
     *
     * The brand dark ramps calm Color-6 … Color-11 (darkToneEase.ts) because
     * those tones paint large surfaces. A chart mark is the opposite case:
     * small, and it has to stay vivid enough to tell series apart. And the tone
     * is solved ONCE for both modes, so feeding the solver the calmer dark
     * tones re-solved the LIGHT-mode chart too — measured, 28 of 168 light-mode
     * exports moved two to nine series, some to near-white — a dark-mode
     * decision changing light mode.
     *
     * The export records each eased tone's pre-ease hex in
     * Metadata['Chart-Pre-Ease-Dark-Tones']; the chart reads those in place of
     * the eased ones. A system exported before the ease has no entry and its
     * ramps were never eased, so it reads exactly what it always did. */
    const preEase: Record<string, Record<string, { value?: string }>> =
      designSystemJSON.Metadata?.['Chart-Pre-Ease-Dark-Tones'] || {};
    const rampsFor = (mode: string): Record<string, Ramp> => {
      const out: Record<string, Ramp> = {};
      for (const [pal, tones] of Object.entries<any>(designSystemJSON.Modes?.[mode]?.Colors || {})) {
        const r: Ramp = {};
        const original = mode === 'Dark-Mode' ? preEase[pal] : undefined;
        for (let n = 1; n <= 12; n++) {
          const v = original?.[`Color-${n}`]?.value ?? tones?.[`Color-${n}`]?.value;
          if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) r[n] = v.toLowerCase();
        }
        if (Object.keys(r).length === 12) out[pal] = r;
      }
      return out;
    };
    const groundsFor = (mode: string, level: string): string[] => {
      const bgs = designSystemJSON.Modes?.[mode]?.Backgrounds || {};
      const want = bgKeyFor(mode);
      const out: string[] = [];
      for (const pal of Object.keys(bgs)) {
        const byKey = bgs[pal] || {};
        /* fall back to whatever Background-N a palette carries: the active
           number is a guess read from Metadata, and an exact-key miss used to
           skip the whole level silently. */
        const key = byKey[want] ? want
          : Object.keys(byKey).find((k) => /^Background-\d+$/.test(k) && byKey[k]?.Surfaces);
        if (!key) continue;
        const raw = byKey[key]?.Surfaces?.[level];
        const hex = typeof raw === 'string' ? raw : raw?.value;
        if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) out.push(hex.toLowerCase());
      }
      return [...new Set(out)];
    };

    const lightRamps = rampsFor('Light-Mode');
    const profile = lightRamps.Primary || lightRamps.Neutral;
    if (profile) {
      const hues = chooseHues(CHART_HUE_COUNT, lightRamps, profile);

      for (const [level, cfg] of Object.entries(CHART_GROUNDS)) {
        const grounds = cfg.modes.flatMap((m) => cfg.levels.flatMap((l) => groundsFor(m, l)));
        if (!grounds.length) {
          console.warn(`[figma] Chart: no ${level} backgrounds for ${cfg.modes.join('+')} — skipped.`);
          continue;
        }
        const solveInput = {
          ramps: lightRamps, grounds: [...new Set(grounds)], hues, profile,
          /* the dark ramps emit at the SAME tone, so they must clear the same
             bars — without this the light ramp was validated and the dark one
             shipped, putting a near-black #2a2e1b in the dark palette */
          altRamps: rampsFor('Dark-Mode'),
        };
        /* Whole tones, and again with half steps for the generated hues; the
           half-step solution is kept only when its worst pair is MEASURABLY
           better (> 0.5 CIEDE2000), so offering it can never make a palette
           worse and a near-tie keeps the simpler whole-tone answer. */
        const whole = solveGround(solveInput);
        const half = solveGround({ ...solveInput, halfSteps: true });
        const sol = half.worstSeparation > whole.worstSeparation + 0.5 ? half : whole;
        if (sol.unsolvable.length)
          console.warn(`[figma] Chart ${level}: no tone clears 3:1 on every ground for ` +
                       sol.unsolvable.join(', ') + ' — omitted rather than written failing.');

        /* the TONE is shared; the hex comes from each mode's own ramp */
        for (const mode of ['Light-Mode', 'Dark-Mode']) {
          if (modesPresent.indexOf(mode) === -1) continue;
          const modeRamps = rampsFor(mode);
          const modeProfile = modeRamps.Primary || modeRamps.Neutral;
          if (!modeProfile) continue;
          const group: any = {};
          /* Color-1..4 are the brand series, read from THIS mode's own ramp at
             the shared tone; Color-5..10 the generated hues. */
          BRAND_SERIES.forEach((name, i) => {
            const pick = sol.picks['Chart-' + name];
            const hex = pick && modeRamps[name]?.[pick.tone];
            if (hex) group[`Color-${i + 1}`] = { value: hex, type: 'color' };
          });
          hues.forEach((h, i) => {
            const pick = sol.picks['Chart-' + (i + 5)];
            if (!pick) return;
            const hex = rampForHue(h, modeProfile, true)[pick.tone];
            if (hex) group[`Color-${i + 5}`] = { value: hex, type: 'color' };
          });
          if (Object.keys(group).length) {
            (out[mode] ||= {})[level] = group;
          }
        }
      }
    } else {
      console.warn('[figma] Chart: no Primary or Neutral ramp in Light-Mode — section skipped.');
    }
  return out;
}
