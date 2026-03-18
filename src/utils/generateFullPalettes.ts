import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from './colorScale';

/**
 * Generate all 9 palettes needed by the CSS generation pipeline.
 * Primary, Secondary, Tertiary come from the user's color scheme.
 * Neutral, Info, Success, Warning, Error, Hotlink-Visited are generated
 * from fixed hues at the same chroma/lightness structure.
 */

// Fixed seed colors for semantic palettes
const SEMANTIC_SEEDS: Record<string, string> = {
  neutral: '#808080',           // Pure gray
  info: '#4A7BF7',             // Blue
  success: '#2E9E5A',          // Green
  warning: '#D4941A',          // Amber/Orange
  error: '#D44040',            // Red
  'hotlink-visited': '#8B5CF6', // Purple
};

interface ToneEntry {
  tone: number;
  color: string;
}

function convertPalette(palette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>): ToneEntry[] {
  return palette.map(t => ({ tone: t.tone, color: t.hex }));
}

export function generateFullLightPalettes(
  primaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
  secondaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
  tertiaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
) {
  return {
    primary: convertPalette(primaryPalette),
    secondary: convertPalette(secondaryPalette),
    tertiary: convertPalette(tertiaryPalette),
    neutral: convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS.neutral)),
    info: convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS.info)),
    success: convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS.success)),
    warning: convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS.warning)),
    error: convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS.error)),
    'hotlink-visited': convertPalette(generateSemanticLightModeScale(SEMANTIC_SEEDS['hotlink-visited'])),
  };
}

export function generateFullDarkPalettes(
  primaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
  secondaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
  tertiaryPalette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>,
) {
  return {
    primary: convertPalette(primaryPalette),
    secondary: convertPalette(secondaryPalette),
    tertiary: convertPalette(tertiaryPalette),
    neutral: convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS.neutral)),
    info: convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS.info)),
    success: convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS.success)),
    warning: convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS.warning)),
    error: convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS.error)),
    'hotlink-visited': convertPalette(generateSemanticDarkModeScale(SEMANTIC_SEEDS['hotlink-visited'])),
  };
}
