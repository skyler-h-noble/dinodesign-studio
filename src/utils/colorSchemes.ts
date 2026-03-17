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
function generateTonePalettes(colors: string[], maxChroma: number = 64) {
  return {
    primary: generateSemanticLightModeScale(colors[0], maxChroma),
    secondary: generateSemanticLightModeScale(colors[1], maxChroma),
    tertiary: generateSemanticLightModeScale(colors[2], maxChroma),
  };
}

/**
 * Generate dark mode tone palettes.
 */
function generateDarkModeTonePalettes(colors: string[], maxChroma: number = 50) {
  return {
    primary: generateSemanticDarkModeScale(colors[0], maxChroma),
    secondary: generateSemanticDarkModeScale(colors[1], maxChroma),
    tertiary: generateSemanticDarkModeScale(colors[2], maxChroma),
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
function buildScheme(
  name: string,
  colors: [string, string, string],
  lightMaxChroma: number = 62,
  darkMaxChroma: number = 36,
): ColorScheme {
  return {
    name,
    colors,
    originalColors: [...colors],
    extractedTones: calculateTones(colors),
    tonePalettes: generateTonePalettes(colors, lightMaxChroma),
    darkModeTonePalettes: generateDarkModeTonePalettes(colors, darkMaxChroma),
  };
}

/**
 * Find the color from the pool that is most complementary (furthest hue) from the given color.
 */
function findComplementary(base: string, pool: string[]): string {
  const [, , baseH] = chroma(base).lch();
  let best = pool[0];
  let bestDist = 0;
  for (const c of pool) {
    const [, , h] = chroma(c).lch();
    const dist = Math.min(Math.abs(h - baseH), 360 - Math.abs(h - baseH));
    if (dist > bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Find the color from the pool closest in hue to the given color.
 */
function findAnalogous(base: string, pool: string[]): string {
  const [, , baseH] = chroma(base).lch();
  let best = pool[0];
  let bestDist = Infinity;
  for (const c of pool) {
    const [, , h] = chroma(c).lch();
    const dist = Math.min(Math.abs(h - baseH), 360 - Math.abs(h - baseH));
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Generate 6 color scheme variations from the 6 top selected colors.
 * All schemes only use colors from the provided topColors array.
 * The first color in topColors is treated as primary.
 */
export function generateColorSchemes(
  topColors: string[],
  lightMaxChroma: number = 62,
  darkMaxChroma: number = 36,
): ColorScheme[] {
  const [c1, c2, c3] = topColors;
  const others = topColors.slice(1);

  // 1. Custom - primary + next two most prominent
  const custom: [string, string, string] = [c1, c2 || c1, c3 || c1];

  // 2. Monochromatic - primary + two others closest in hue
  const mono2 = findAnalogous(c1, others);
  const monoRest = others.filter(c => c !== mono2);
  const mono3 = findAnalogous(c1, monoRest.length ? monoRest : others);
  const monochromatic: [string, string, string] = [c1, mono2, mono3];

  // 3. Analogous - primary + two nearest hue neighbors
  const ana2 = findAnalogous(c1, others);
  const anaRest = others.filter(c => c !== ana2);
  const ana3 = findAnalogous(c1, anaRest.length ? anaRest : others);
  const analogous: [string, string, string] = [c1, ana2, ana3];

  // 4. Complementary - primary + most opposite hue + a bridge color
  const comp2 = findComplementary(c1, others);
  const compRest = others.filter(c => c !== comp2);
  const comp3 = compRest[0] || c3 || c2;
  const complementary: [string, string, string] = [c1, comp2, comp3];

  // 5. Triadic - primary + two colors spread widest in hue
  const tri2 = findComplementary(c1, others);
  const triRest = others.filter(c => c !== tri2);
  const tri3 = findComplementary(tri2, triRest.length ? triRest : others);
  const triadic: [string, string, string] = [c1, tri2, tri3];

  // 6. Split-Complementary - primary + two colors flanking the complement
  const splitComp = findComplementary(c1, others);
  const splitRest = others.filter(c => c !== splitComp);
  const split2 = findAnalogous(splitComp, splitRest.length ? splitRest : others);
  const splitRest2 = splitRest.filter(c => c !== split2);
  const split3 = splitRest2[0] || splitComp;
  const splitComplementary: [string, string, string] = [c1, split2, split3];

  return [
    buildScheme('Analogous', analogous, lightMaxChroma, darkMaxChroma),
    buildScheme('Monochromatic', monochromatic, lightMaxChroma, darkMaxChroma),
    buildScheme('Complementary', complementary, lightMaxChroma, darkMaxChroma),
    buildScheme('Triadic', triadic, lightMaxChroma, darkMaxChroma),
    buildScheme('Split-Complementary', splitComplementary, lightMaxChroma, darkMaxChroma),
    buildScheme('Custom', custom, lightMaxChroma, darkMaxChroma),
  ];
}
