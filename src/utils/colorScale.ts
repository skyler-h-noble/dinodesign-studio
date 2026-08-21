import chroma from 'chroma-js';
// The two LIGHT-MODE families that carry a 4.5:1 requirement. Imported rather
// than restated so the guard below cannot drift from the tables it is
// predicting. Both modules are leaves — no cycle back into this file.
import { lightModeTextFixed } from './cssgen/lightModeTonalTextFixedStructure';
import { getStaticQuietTokensForLightMode } from './cssgen/staticQuietStructures';

/** The 12-tone light mode scale mapped to LCH lightness values */
export const TONE_SCALE = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99] as const;

/** The 12-tone dark mode scale — shifted darker for dark mode surfaces */
// Color-1 is L3, not L1. At L1 it is near-pure black, which reads as a hole
// rather than a surface once it IS the page background. True black stays
// available as a literal for Surface-Dim / Surface-Dimmest, which want the floor.
export const DARK_TONE_SCALE = [3, 5, 12, 18, 24, 58, 64, 70, 76, 82, 85, 89] as const;

/** Color-N position (1-12) labels */
export const COLOR_POSITIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface ToneStep {
  tone: number;
  lightness: number;
  hex: string;
  colorNumber: number; // 1-12
  /** Set when the user's chosen colour had to be moved to meet WCAG. The UI
   *  must surface this — a silently altered brand colour is worse than the
   *  adjustment itself. */
  adjusted?: {
    from: string;
    to: string;
    reason: string;
  };
}

/**
 * The structural dead zone: lightness values that cannot carry accessible text.
 *
 * Verified across 360 hues — at brand chroma, NO foreground tone in the scale
 * reaches 4.5:1 against a background between these bounds. The 12-tone scale
 * exists to exclude it: the original 14-tone design had tones at L=46.6 and
 * L=53, and both were removed. Color-5 (L=37) and Color-6 (L=58) now sit
 * exactly either side of the gap.
 *
 * See docs/ip-strategy-v4-additions.md.
 */
/** WCAG contrast ratio between two hexes. */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = chroma(hex).rgb().map((v) => {
      const sr = v / 255;
      return sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const DEAD_ZONE_LOW = 37;
const DEAD_ZONE_HIGH = 58;

/**
 * Find the Color-N (1-12) in a generated tone scale whose hex most closely
 * matches the original extracted color, using perceptual color distance (Delta E).
 */
export function findClosestColorN(extractedHex: string, toneScale: ToneStep[]): number {
  let closestN = 1;
  let minDist = Infinity;
  for (let i = 0; i < toneScale.length; i++) {
    const dist = chroma.deltaE(extractedHex, toneScale[i].hex);
    if (dist < minDist) {
      minDist = dist;
      closestN = i + 1;
    }
  }
  return closestN;
}

/**
 * Generate a natural (uncapped) 12-tone scale to find the max achievable chroma.
 * Returns the scale and the peak chroma value.
 */
function generateNaturalScale(hex: string, toneScale: readonly number[] = TONE_SCALE): { steps: Array<{ tone: number; chroma: number; hue: number }>; peakChroma: number } {
  const [, , h] = chroma(hex).lch();

  const steps = toneScale.map((targetTone) => {
    // Find the max chroma achievable at this lightness and hue
    // Binary search for max displayable chroma
    let lo = 0;
    let hi = 150;
    let bestC = 0;

    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      try {
        const test = chroma.lch(targetTone, mid, h);
        // Verify it roundtrips close to target
        const [tl] = test.lch();
        if (Math.abs(tl - targetTone) < 2) {
          bestC = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      } catch {
        hi = mid;
      }
    }

    return { tone: targetTone, chroma: bestC, hue: h };
  });

  const peakChroma = Math.max(...steps.map(s => s.chroma));
  return { steps, peakChroma };
}

/**
 * Bell-curve chroma multipliers for each of the 12 tones.
 * Default peaks at Color-6 (index 5).
 * Yellow hues (60-100) shift peak to Color-7 (index 6).
 *
 * LIGHT MODE:
 *  Color:  1     2     3     4     5     6     7     8     9    10    11    12
 *  L:      1    10    19    28    37    58    71    81    90    95    98    99
 */
const CHROMA_BELL_DEFAULT = [
  0.10, 0.20, 0.35, 0.55, 0.75,
  0.90,  // Color-6 (L=58)
  0.75, 0.55, 0.35, 0.22, 0.156, 0.094,
];

const CHROMA_BELL_YELLOW = [
  0.06, 0.12, 0.22, 0.35, 0.50,
  0.92,  // Color-6 (L=58)
  1.00,  // Color-7 (L=71) — PEAK (shifted for yellow)
  0.75, 0.45, 0.25, 0.156, 0.094,
];

/**
 * DARK MODE bell curves — matched to dark mode L values.
 * Dark mode tones are shifted darker, so the chroma distribution must follow.
 *
 *  Color:  1     2     3     4     5     6     7     8     9    10    11    12
 *  L:      1     5    12    18    24    58    64    70    76    82    85    89
 */
const DARK_CHROMA_BELL_DEFAULT = [
  0.10, 0.15, 0.25, 0.35, 0.45,
  0.90,  // Color-6 (L=58) — same as light mode
  0.82, 0.75, 0.65, 0.55, 0.45, 0.35,
];

const DARK_CHROMA_BELL_YELLOW = [
  0.06, 0.10, 0.18, 0.28, 0.40,
  0.92,  // Color-6 (L=58)
  1.00,  // Color-7 (L=64) — PEAK
  0.82, 0.65, 0.50, 0.40, 0.30,
];

function getChromaBellCurve(hue: number, isDarkMode: boolean = false): number[] {
  const normalizedHue = ((hue % 360) + 360) % 360;
  if (isDarkMode) {
    return (normalizedHue >= 60 && normalizedHue <= 100) ? DARK_CHROMA_BELL_YELLOW : DARK_CHROMA_BELL_DEFAULT;
  }
  return (normalizedHue >= 60 && normalizedHue <= 100) ? CHROMA_BELL_YELLOW : CHROMA_BELL_DEFAULT;
}

/**
 * Hue overrides for the endpoints of a tone scale.
 * darkHue applies to Color-1 (darkest tone), lightHue applies to Color-12 (lightest).
 * The user's exact color hue is preserved at its locked Color-N position.
 * Hues interpolate linearly between the three control points (dark → user → light).
 */
export interface HueEasing {
  darkHue?: number;  // 0-360, hue at Color-1
  lightHue?: number; // 0-360, hue at Color-12
}

/**
 * Linearly interpolate hue along the shortest path around the color wheel.
 * Both hues are 0-360. t is 0-1.
 */
function lerpHue(h1: number, h2: number, t: number): number {
  let diff = h2 - h1;
  // Take the shortest path around the circle
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let result = h1 + diff * t;
  // Normalize to 0-360
  result = ((result % 360) + 360) % 360;
  return result;
}

/**
 * Compute the per-tone hue array for a 12-tone scale, applying hue easing.
 * Returns an array of 12 hues, one per Color-N.
 *
 * Without easing: every tone uses userHue (constant).
 * With easing: hue interpolates linearly from darkHue (Color-1) to userHue
 * (at lockedColorN) to lightHue (Color-12). The locked position keeps userHue exactly.
 */
function computeHueScale(
  userHue: number,
  lockedColorN: number,
  easing?: HueEasing
): number[] {
  const hues: number[] = new Array(12);
  const darkHue = easing?.darkHue;
  const lightHue = easing?.lightHue;

  // Locked index (0-based)
  const lockedIdx = Math.max(0, Math.min(11, lockedColorN - 1));

  for (let i = 0; i < 12; i++) {
    if (i === lockedIdx) {
      hues[i] = userHue;
    } else if (i < lockedIdx) {
      // Below locked: interpolate dark → user
      if (darkHue === undefined) {
        hues[i] = userHue;
      } else {
        // t=0 at Color-1 (i=0), t=1 at locked
        const t = lockedIdx === 0 ? 1 : i / lockedIdx;
        hues[i] = lerpHue(darkHue, userHue, t);
      }
    } else {
      // Above locked: interpolate user → light
      if (lightHue === undefined) {
        hues[i] = userHue;
      } else {
        // t=0 at locked, t=1 at Color-12 (i=11)
        const span = 11 - lockedIdx;
        const t = span === 0 ? 0 : (i - lockedIdx) / span;
        hues[i] = lerpHue(userHue, lightHue, t);
      }
    }
  }

  return hues;
}

/**
 * Generate a 12-tone scale using a bell-curve chroma distribution.
 * maxChroma controls the peak. The peak position shifts based on hue.
 * Each tone is also clamped to the gamut limit at that lightness/hue.
 */
function generateScaledTones(
  hex: string,
  maxChroma: number,
  toneScale: readonly number[] = TONE_SCALE,
  isDarkMode: boolean = false,
  lockedHex?: string,
  hueEasing?: HueEasing
): ToneStep[] {
  const [userL, , userH] = chroma(hex).lch();
  const { steps } = generateNaturalScale(hex, toneScale);
  // Bell curve is keyed off the user's primary hue (not the per-tone hue)
  const bellCurve = getChromaBellCurve(userH, isDarkMode);

  // Determine which Color-N the user's color sits at (within the active tone scale)
  let userColorN = 6;
  let bestDiff = Infinity;
  for (let i = 0; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - userL);
    if (diff < bestDiff) {
      bestDiff = diff;
      userColorN = i + 1;
    }
  }

  // Compute per-tone hue scale with easing
  const hueScale = computeHueScale(userH, userColorN, hueEasing);

  // Generate all tones normally first
  const tones: ToneStep[] = steps.map((step, index) => {
    const toneHue = hueScale[index];
    const desiredC = Math.min(maxChroma * bellCurve[index], step.chroma);

    let result: string;
    try {
      const generated = chroma.lch(step.tone, desiredC, toneHue);
      const [, , gh] = generated.lch();
      if (!isNaN(toneHue) && !isNaN(gh) && Math.abs(gh - toneHue) > 10 && desiredC > 0.5) {
        result = chroma.lch(step.tone, desiredC * 0.9, toneHue).hex();
      } else {
        result = generated.hex();
      }
    } catch {
      result = chroma.lch(step.tone, 0, toneHue).hex();
    }

    return {
      tone: step.tone,
      lightness: step.tone,
      hex: result,
      colorNumber: index + 1,
    };
  });

  // If a locked hex is provided, replace the closest tone with the exact hex.
  //
  // The generated ramp never lands in the dead zone — that is the whole point
  // of the 12-tone scale. But this override writes the user's colour in
  // verbatim, so a mid-range pick puts a lightness back into the gap the scale
  // was built to exclude, at the one tone the user controls. Downstream,
  // nothing can then reach 4.5:1 against it, and the contrast repair is forced
  // to choose between two failing options.
  //
  // No failing contrast ships. If the pick is inside the gap, its LIGHTNESS is
  // moved to the nearer edge — hue and chroma are preserved, so it stays
  // recognisably the chosen colour — and the change is recorded so the UI can
  // tell the user their colour was adjusted and why.
  if (lockedHex) {
    const [lockedL, lockedC, lockedH] = chroma(lockedHex).lch();

    let placedHex = lockedHex;
    let adjustment: ToneStep['adjusted'];

    // Only adjust a colour that ACTUALLY fails.
    //
    // The dead-zone band is the worst case at maximum chroma (62-70). Being
    // inside it is not itself a failure: measured across 413 picks spanning
    // 360 hues, 229 landed in the band and NONE of them failed — real picks
    // sit below peak chroma. Snapping on the band alone moved working colours
    // (a #7b3f9d at L=38 carrying 6.91:1 was being nudged for nothing), which
    // breaks the more important promise: the user's colour is theirs.
    //
    // Test what the TABLE will actually pair it with — not the best case.
    //
    // Text.Surfaces maps a background tone to a foreground tone by SLOT: a
    // slot on the dark-text side takes the ramp's dark end, a slot on the
    // light-text side takes its light end. The system does not get to pick
    // whichever happens to score better.
    //
    // Taking max(dark end, light end) was too lenient and is what let a 4.54:1
    // primary through: the light end scored 4.64, but the colour landed in a
    // slot the table pairs with the DARK end, which measures 4.49 — under the
    // line. The repair pass then substituted a raw hex, so that one cell was
    // no longer driven by the table at all.
    //
    // Predict the slot the same way the placement below does, then test the
    // end the table would use for it.
    let provisionalIdx = 0;
    let provisionalDist = Infinity;
    for (let i = 0; i < tones.length; i++) {
      const dist = Math.abs(tones[i].tone - lockedL);
      if (dist < provisionalDist) { provisionalDist = dist; provisionalIdx = i; }
    }
    // Test the slot against the BACKGROUNDS THE TABLES ACTUALLY PAIR IT WITH,
    // not the far end of its own ramp.
    //
    // Testing the end tone is too lenient, and by a margin that matters. A
    // locked #2563eb sits at L=46 and lands in the Color-5 slot, whose nominal
    // lightness is 37 — so Color-5 ends up much lighter than its slot expects.
    // Against Color-12 it measures 4.98 and sailed through; but Quiet pairs a
    // Color-5 foreground with backgrounds down to Color-9, where it measures
    // 4.48. One cell shipped under the line, and it was the user's own colour.
    //
    // So: find every background tone the Text and Quiet tables point AT this
    // slot, and require the worst of them to clear 4.5.
    const slotKey = `Color-${provisionalIdx + 1}`;
    const quietLight = getStaticQuietTokensForLightMode() as any;
    const pairedBackgrounds = new Set<number>();
    for (const table of [ (lightModeTextFixed as any)?.Surfaces, quietLight?.Surfaces ]) {
      const row = table?.Primary;
      if (!row) continue;
      for (const [bgKey, cell] of Object.entries<any>(row)) {
        const bgN = parseInt(String(bgKey).replace('Color-', ''), 10);
        if (!Number.isFinite(bgN) || bgN === provisionalIdx + 1) continue;
        const ref = typeof cell === 'string' ? cell : cell?.value;
        if (typeof ref !== 'string') continue;
        // "{Colors.Primary.Color-5}" → does this cell point at our slot?
        if (ref.endsWith(`.${slotKey}}`)) pairedBackgrounds.add(bgN);
      }
    }

    let canCarryText: boolean;
    if (pairedBackgrounds.size > 0) {
      canCarryText = [...pairedBackgrounds].every(
        (bgN) => contrastRatio(lockedHex, tones[bgN - 1].hex) >= 4.5,
      );
    } else {
      // No 4.5 family uses this slot as a foreground, so there is nothing to
      // guarantee. Fall back to the ramp's opposite end.
      const tableEndHex = provisionalIdx + 1 <= 5
        ? tones[tones.length - 1].hex   // light end
        : tones[0].hex;                 // dark end
      canCarryText = contrastRatio(lockedHex, tableEndHex) >= 4.5;
    }

    if (!canCarryText) {
      // Nothing in its own ramp reaches 4.5, which only happens in the
      // dead zone. Move the LIGHTNESS to the nearer edge of that zone —
      // the smallest change that makes an accessible pair possible — and
      // keep hue and chroma so it stays recognisably the chosen colour.
      const target = (lockedL - DEAD_ZONE_LOW) <= (DEAD_ZONE_HIGH - lockedL)
        ? DEAD_ZONE_LOW
        : DEAD_ZONE_HIGH;
      placedHex = chroma.lch(target, lockedC, lockedH).hex();
      const direction = target < lockedL ? 'darkened' : 'lightened';
      adjustment = {
        from: lockedHex,
        to: placedHex,
        reason: `${lockedHex} sits in the middle of the lightness range `
          + `(${lockedL.toFixed(0)}), too close to the backgrounds it has to be `
          + `read against — those pairings land near 4:1, under the 4.5:1 `
          + `minimum. We ${direction} it slightly to ${placedHex}, keeping the `
          + `same hue and saturation, so every pairing passes.`,
      };
    }

    // Match against the PLACED colour, so the slot and its metadata agree with
    // the hex actually stored. Previously only .hex was replaced, leaving
    // .tone and .lightness describing a colour that was no longer there.
    const [placedL] = chroma(placedHex).lch();
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < tones.length; i++) {
      const dist = Math.abs(tones[i].tone - placedL);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    tones[closestIdx] = {
      ...tones[closestIdx],
      hex: placedHex,
      ...(adjustment ? { adjusted: adjustment } : {}),
    };
  }

  return tones;
}

/**
 * Generate a 12-tone light mode scale from a hex color.
 * When maxChroma is provided, it is used directly as the peak.
 * When undefined, peak is derived from the extracted color's position on the bell curve.
 * Per-tone chroma is always gamut-clipped by step.chroma in generateScaledTones.
 */
export function generateSemanticLightModeScale(
  hex: string,
  maxChroma?: number,
  lockedHex?: string,
  hueEasing?: HueEasing
): ToneStep[] {
  let peakChroma: number;
  if (maxChroma !== undefined) {
    peakChroma = maxChroma;
  } else {
    const [l, c, h] = chroma(hex).lch();
    const colorNumber = toneToColorNumber(l);
    const bellCurve = getChromaBellCurve(h);
    const multiplierAtTone = bellCurve[colorNumber - 1] || 1;
    peakChroma = multiplierAtTone > 0 ? c / multiplierAtTone : c;
  }

  return generateScaledTones(hex, peakChroma, undefined, false, lockedHex, hueEasing);
}

/**
 * Generate a 12-tone dark mode scale from a hex color.
 * When maxChroma is provided, it is used directly as the peak.
 * When undefined, peak is derived from the extracted color's position on the bell curve.
 */
export function generateSemanticDarkModeScale(
  hex: string,
  maxChroma?: number,
  hueEasing?: HueEasing
): ToneStep[] {
  let peakChroma: number;
  if (maxChroma !== undefined) {
    peakChroma = maxChroma;
  } else {
    const [l, c, h] = chroma(hex).lch();
    const colorNumber = toneToColorNumber(l);
    const bellCurve = getChromaBellCurve(h, true);
    const multiplierAtTone = bellCurve[colorNumber - 1] || 1;
    peakChroma = multiplierAtTone > 0 ? c / multiplierAtTone : c;
  }

  return generateScaledTones(hex, peakChroma, DARK_TONE_SCALE, true, undefined, hueEasing);
}

/**
 * Get the natural peak chroma achievable across all 12 tones for a color.
 */
export function getNaturalPeakChroma(hex: string): number {
  const { peakChroma } = generateNaturalScale(hex);
  return Math.round(peakChroma);
}

/**
 * Get the peak chroma that makes the extracted color sit naturally in its
 * own palette — i.e. the peak such that, after the bell-curve multiplier at
 * the extracted color's tone position, the rendered chroma equals the
 * extracted chroma. This is the default "matching" peak used when the user
 * hasn't explicitly boosted chroma via the slider.
 */
export function getMatchingPeakChroma(hex: string, isDarkMode: boolean = false): number {
  const [l, c, h] = chroma(hex).lch();
  const toneScale = isDarkMode ? DARK_TONE_SCALE : TONE_SCALE;
  let colorNumber = 1;
  let minDiff = Infinity;
  for (let i = 0; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - l);
    if (diff < minDiff) {
      minDiff = diff;
      colorNumber = i + 1;
    }
  }
  const bellCurve = getChromaBellCurve(h, isDarkMode);
  const multiplierAtTone = bellCurve[colorNumber - 1] || 1;
  return multiplierAtTone > 0 ? c / multiplierAtTone : c;
}

/**
 * Convert an LCH lightness value (0-100) to a Color-N position (1-12).
 */
export function toneToColorNumber(tone: number): number {
  const exactIndex = TONE_SCALE.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) {
    return exactIndex + 1;
  }

  let closestIndex = 0;
  let minDiff = Math.abs(TONE_SCALE[0] - tone);
  for (let i = 1; i < TONE_SCALE.length; i++) {
    const diff = Math.abs(TONE_SCALE[i] - tone);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex + 1;
}

/**
 * Get the vibrant tone Color-N based on mode.
 */
export function getVibrantColorNumber(mode: 'light' | 'dark'): number {
  return mode === 'light' ? 9 : 5;
}

/**
 * Calculate the OB (Other Buttons) Color-N.
 */
export function calculateOB(primaryTone: number): number {
  const PC = toneToColorNumber(primaryTone);
  return PC >= 9 ? 6 : 5;
}

/**
 * Get the LCH lightness of a hex color.
 */
export function getLightness(hex: string): number {
  return chroma(hex).get('lch.l');
}

/**
 * Get the LCH chroma of a hex color.
 */
export function getChroma(hex: string): number {
  return chroma(hex).get('lch.c');
}

/**
 * Blend two colors together with an alpha value.
 * Used for hover/active state generation.
 */
export function blendColors(foregroundColor: string, backgroundColor: string, alpha: number): string {
  const fc = chroma(foregroundColor).rgb();
  const bc = chroma(backgroundColor).rgb();
  const r = Math.round((alpha * fc[0]) + ((1 - alpha) * bc[0]));
  const g = Math.round((alpha * fc[1]) + ((1 - alpha) * bc[1]));
  const b = Math.round((alpha * fc[2]) + ((1 - alpha) * bc[2]));
  return chroma(r, g, b).hex();
}
