import chroma from 'chroma-js';
import {
  generateSemanticLightModeScale,
  generateSemanticDarkModeScale,
  getLightness,
} from './colorScale';
import type { ColorScheme } from '../types';

/**
 * Generate tone palettes for an array of 3 colors (primary, secondary, tertiary).
 */
function generateTonePalettes(colors: string[]) {
  return {
    primary: generateSemanticLightModeScale(colors[0]),
    secondary: generateSemanticLightModeScale(colors[1]),
    tertiary: generateSemanticLightModeScale(colors[2]),
  };
}

/**
 * Generate dark mode tone palettes (chroma capped at 50).
 */
function generateDarkModeTonePalettes(colors: string[]) {
  return {
    primary: generateSemanticDarkModeScale(colors[0]),
    secondary: generateSemanticDarkModeScale(colors[1]),
    tertiary: generateSemanticDarkModeScale(colors[2]),
  };
}

/**
 * Calculate extracted tones (LCH lightness) for 3 colors.
 */
function calculateTones(colors: string[]) {
  return {
    primary: getLightness(colors[0]),
    secondary: getLightness(colors[1]),
    tertiary: getLightness(colors[2]),
  };
}

/**
 * Build a full ColorScheme object from a name and 3 colors.
 */
function buildScheme(name: string, colors: [string, string, string]): ColorScheme {
  return {
    name,
    colors,
    originalColors: [...colors],
    extractedTones: calculateTones(colors),
    tonePalettes: generateTonePalettes(colors),
    darkModeTonePalettes: generateDarkModeTonePalettes(colors),
  };
}

/**
 * Adjust lightness of a color by a relative amount.
 */
function adjustLightness(hex: string, targetLightness: number): string {
  const [, c, h] = chroma(hex).lch();
  try {
    return chroma.lch(targetLightness, c, h).hex();
  } catch {
    return chroma.lch(targetLightness, 0, h).hex();
  }
}

/**
 * Rotate hue of a color by degrees.
 */
function rotateHue(hex: string, degrees: number): string {
  const [l, c, h] = chroma(hex).lch();
  try {
    return chroma.lch(l, c, (h + degrees) % 360).hex();
  } catch {
    return chroma.lch(l, 0, (h + degrees) % 360).hex();
  }
}

/**
 * Generate 6 color scheme variations from extracted colors.
 */
export function generateColorSchemes(extractedColors: string[]): ColorScheme[] {
  const [c1, c2, c3] = extractedColors;

  const l1 = getLightness(c1);

  return [
    // 1. Custom - uses the top 3 extracted colors as-is
    buildScheme('Custom', [c1, c2, c3]),

    // 2. Monochromatic - same hue, different lightness
    buildScheme('Monochromatic', [
      c1,
      adjustLightness(c1, Math.min(l1 + 20, 90)),
      adjustLightness(c1, Math.max(l1 - 20, 20)),
    ]),

    // 3. Analogous - adjacent hues (±30°)
    buildScheme('Analogous', [
      c1,
      rotateHue(c1, 30),
      rotateHue(c1, -30),
    ]),

    // 4. Complementary - opposite hue (180°)
    buildScheme('Complementary', [
      c1,
      rotateHue(c1, 180),
      c2 || rotateHue(c1, 90),
    ]),

    // 5. Triadic - three equally spaced hues (120° apart)
    buildScheme('Triadic', [
      c1,
      rotateHue(c1, 120),
      rotateHue(c1, 240),
    ]),

    // 6. Split-Complementary - opposite hue split (±150°)
    buildScheme('Split-Complementary', [
      c1,
      rotateHue(c1, 150),
      rotateHue(c1, 210),
    ]),
  ];
}
