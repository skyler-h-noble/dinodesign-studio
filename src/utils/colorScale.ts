import chroma from 'chroma-js';

/** The 14-tone scale mapped to LCH lightness values */
export const TONE_SCALE = [1, 10, 19, 28, 37, 46.6, 53, 62, 71, 81, 90, 95, 98, 99] as const;

/** Color-N position (1-14) labels */
export const COLOR_POSITIONS = Array.from({ length: 14 }, (_, i) => i + 1);

export interface ToneStep {
  tone: number;
  lightness: number;
  hex: string;
  colorNumber: number; // 1-14
}

/**
 * Generate a 14-tone light mode scale from a hex color.
 * Full chroma (no capping).
 */
export function generateSemanticLightModeScale(hex: string): ToneStep[] {
  const [, c, h] = chroma(hex).lch();

  return TONE_SCALE.map((targetTone, index) => {
    const adjustedL = targetTone;
    const adjustedC = c;
    let result: string;
    try {
      result = chroma.lch(adjustedL, adjustedC, h).hex();
    } catch {
      result = chroma.lch(adjustedL, 0, h).hex();
    }
    return {
      tone: targetTone,
      lightness: adjustedL,
      hex: result,
      colorNumber: index + 1,
    };
  });
}

/**
 * Generate a 14-tone dark mode scale from a hex color.
 * Chroma capped at 50 to prevent oversaturation.
 */
export function generateSemanticDarkModeScale(hex: string): ToneStep[] {
  const [, c, h] = chroma(hex).lch();

  return TONE_SCALE.map((targetTone, index) => {
    const adjustedL = targetTone;
    const adjustedC = Math.min(c, 50);
    let result: string;
    try {
      result = chroma.lch(adjustedL, adjustedC, h).hex();
    } catch {
      result = chroma.lch(adjustedL, 0, h).hex();
    }
    return {
      tone: targetTone,
      lightness: adjustedL,
      hex: result,
      colorNumber: index + 1,
    };
  });
}

/**
 * Convert an LCH lightness value (0-100) to a Color-N position (1-14).
 */
export function toneToColorNumber(tone: number): number {
  // Find exact match (within 0.1 tolerance)
  const exactIndex = TONE_SCALE.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) {
    return exactIndex + 1;
  }

  // Find closest match
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
 * Light mode: Color-11 (tone 90), Dark mode: Color-5 (tone 37)
 */
export function getVibrantColorNumber(mode: 'light' | 'dark'): number {
  return mode === 'light' ? 11 : 5;
}

/**
 * Calculate the OB (Other Buttons) Color-N.
 * If Primary is light (>=Color-11), OB = Color-10.
 * If Primary is medium/dark (<Color-11), OB = Color-8.
 */
export function calculateOB(primaryTone: number): number {
  const PC = toneToColorNumber(primaryTone);
  return PC >= 11 ? 10 : 8;
}

/**
 * Get the LCH lightness of a hex color.
 */
export function getLightness(hex: string): number {
  return chroma(hex).get('lch.l');
}
