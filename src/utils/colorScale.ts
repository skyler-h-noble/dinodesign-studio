import chroma from 'chroma-js';

/** The 12-tone light mode scale mapped to LCH lightness values */
export const TONE_SCALE = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99] as const;

/** The 12-tone dark mode scale — shifted darker for dark mode surfaces */
export const DARK_TONE_SCALE = [1, 5, 12, 18, 24, 58, 64, 70, 76, 82, 85, 89] as const;

/** Color-N position (1-12) labels */
export const COLOR_POSITIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface ToneStep {
  tone: number;
  lightness: number;
  hex: string;
  colorNumber: number; // 1-12
}

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
 * Generate a 12-tone scale using a bell-curve chroma distribution.
 * maxChroma controls the peak. The peak position shifts based on hue.
 * Each tone is also clamped to the gamut limit at that lightness/hue.
 */
function generateScaledTones(hex: string, maxChroma: number, toneScale: readonly number[] = TONE_SCALE, isDarkMode: boolean = false, lockedHex?: string): ToneStep[] {
  const [, , h] = chroma(hex).lch();
  const { steps } = generateNaturalScale(hex, toneScale);
  const bellCurve = getChromaBellCurve(h, isDarkMode);

  // Generate all tones normally first
  const tones: ToneStep[] = steps.map((step, index) => {
    const desiredC = Math.min(maxChroma * bellCurve[index], step.chroma);

    let result: string;
    try {
      const generated = chroma.lch(step.tone, desiredC, h);
      const [, , gh] = generated.lch();
      if (!isNaN(h) && !isNaN(gh) && Math.abs(gh - h) > 10 && desiredC > 0.5) {
        result = chroma.lch(step.tone, desiredC * 0.9, h).hex();
      } else {
        result = generated.hex();
      }
    } catch {
      result = chroma.lch(step.tone, 0, h).hex();
    }

    return {
      tone: step.tone,
      lightness: step.tone,
      hex: result,
      colorNumber: index + 1,
    };
  });

  // If a locked hex is provided, replace the closest tone with the exact hex
  if (lockedHex) {
    const [lockedL] = chroma(lockedHex).lch();
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < tones.length; i++) {
      const dist = Math.abs(tones[i].tone - lockedL);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    tones[closestIdx] = {
      ...tones[closestIdx],
      hex: lockedHex,
    };
  }

  return tones;
}

/**
 * Generate a 12-tone light mode scale from a hex color.
 * maxChroma is the desired peak chroma across all tones.
 * Default: uses the natural peak chroma of the color.
 */
export function generateSemanticLightModeScale(hex: string, maxChroma?: number, lockedHex?: string): ToneStep[] {
  // Always derive peak from the extracted color's position on the bell curve
  const [l, c, h] = chroma(hex).lch();
  const colorNumber = toneToColorNumber(l);
  const bellCurve = getChromaBellCurve(h);
  const multiplierAtTone = bellCurve[colorNumber - 1] || 1;
  const derivedPeak = multiplierAtTone > 0 ? c / multiplierAtTone : c;

  // Cap: use maxChroma as a ceiling if provided, default 64
  const cap = maxChroma !== undefined ? maxChroma : 64;
  const peakChroma = Math.min(derivedPeak, cap);

  return generateScaledTones(hex, peakChroma, undefined, false, lockedHex);
}

/**
 * Generate a 12-tone dark mode scale from a hex color.
 * Peak derived from extracted color, capped at maxChroma (default 42).
 */
export function generateSemanticDarkModeScale(hex: string, maxChroma?: number): ToneStep[] {
  const [l, c, h] = chroma(hex).lch();
  const colorNumber = toneToColorNumber(l);
  const bellCurve = getChromaBellCurve(h);
  const multiplierAtTone = bellCurve[colorNumber - 1] || 1;
  const derivedPeak = multiplierAtTone > 0 ? c / multiplierAtTone : c;

  const cap = maxChroma !== undefined ? maxChroma : 42;
  const peakChroma = Math.min(derivedPeak, cap);

  return generateScaledTones(hex, peakChroma, DARK_TONE_SCALE, true);
}

/**
 * Get the natural peak chroma achievable across all 12 tones for a color.
 */
export function getNaturalPeakChroma(hex: string): number {
  const { peakChroma } = generateNaturalScale(hex);
  return Math.round(peakChroma);
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
  return PC >= 9 ? 8 : 6;
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
