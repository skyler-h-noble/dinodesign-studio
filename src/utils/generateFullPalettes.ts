import { generateSemanticLightModeScale, generateSemanticDarkModeScale, type HueEasing } from './colorScale';

/**
 * Generate all 9 palettes needed by the CSS generation pipeline.
 * Primary, Secondary, Tertiary come from the user's color scheme.
 * Neutral, Info, Success, Warning, Error, Hotlink-Visited are generated
 * from fixed hues at the same chroma/lightness structure.
 */

// Fixed seed colors for semantic palettes
export const SEMANTIC_SEEDS: Record<string, string> = {
  neutral: '#808080',           // Pure gray
  /* #3B82F6, not the earlier #4A7BF7: that blue's light tones climbed to
     OKLCH hue 276–287 and read lavender, its dark ones 270–279 indigo. See
     SEMANTIC_HUE_EASING for the other half of the fix. */
  info: '#3B82F6',             // Blue
  /* Success and Warning are now set tone by tone (SEMANTIC_TONES); the seeds
     still drive the generated tone metadata. */
  success: '#2E9E5A',          // Green
  warning: '#D4941A',          // Amber/Orange
  error: '#D44040',            // Red
  'hotlink-visited': '#8B5CF6', // Purple
};

/**
 * Hue bends for the semantic ramps (see HueEasing in colorScale.ts — hues in
 * CIE LCH, at Color-1 and Color-12). A ramp built at one constant CIE LCH hue
 * does not hold one PERCEIVED hue: blue drifts toward violet as it lightens.
 * Info is pinned so every tone stays within ±5° of OKLCH 258, a true blue,
 * in both modes (it spread 25° before). Measured, not guessed — the search
 * scored seeds × easings on OKLCH hue across all 24 tones.
 */
export const SEMANTIC_HUE_EASING: Record<string, { light?: HueEasing; dark?: HueEasing } | undefined> = {
  info: { light: { darkHue: 275, lightHue: 275 }, dark: { darkHue: 275, lightHue: 275 } },
  /* Light mode only: the light tones drifted to OKLCH 30–39, peach rather than
     red; held at 25 they stay within ±4.4° of 27. The dark-mode ramp was
     already right and is left exactly as it was. */
  error: { light: { darkHue: 25, lightHue: 25 } },
};

/**
 * Success and Warning, tone by tone (Color-1..12), light and dark — chosen
 * 2026-10-22 rather than generated, because the change is per tone and a seed
 * plus a hue bend cannot express it.
 *
 * Every tone keeps the generated ramp's LIGHTNESS, so each still carries the
 * same black or white label at the same contrast (within ±0.07); only hue and
 * vividness moved:
 *   Success  hue 150° → 160° (CIE LCH): a bluer green that red-green
 *            colour-blind readers tell apart from Error and Warning (button tone
 *            8.7 → 10.0 from Error, 9.8 → 13.6 from Warning, worst of deutan /
 *            protan). Tone 6, the button, near full vividness; dark-mode 9–12
 *            (text and icons on dark surfaces) raised to ~60% of the gamut so
 *            they read green, not mint-grey.
 *   Warning  hue 77° → 68° for tones 2–8: amber-orange instead of mustard /
 *            khaki; tones 2–5 ~45% more vivid. Tones 9–12 keep the generated
 *            cream — an orange hue that light turns peach.
 * Tone 1 is unchanged in both.
 */
export const SEMANTIC_TONES: Record<string, { light: string[]; dark: string[] } | undefined> = {
  success: {
    light: ['#000700', '#0b1f16', '#093623', '#004c31', '#016442', '#139e6c', '#57c190', '#8fd8b3', '#bfedd4', '#dbf8e8', '#e9fef3', '#f3fff8'],
    dark: ['#010e03', '#00150b', '#092418', '#073221', '#04422a', '#139e6c', '#33af7c', '#53bf8e', '#75cca2', '#80dfb1', '#86e7b8', '#8df4c1'],
  },
  warning: {
    light: ['#0a0300', '#26190a', '#412911', '#5f390e', '#804a02', '#c77815', '#f4992e', '#ffbb7a', '#ffdcaa', '#ffedd1', '#fff7e7', '#fffbf1'],
    dark: ['#110a01', '#1b0f00', '#2e1c04', '#422502', '#563000', '#c77815', '#de8617', '#e89a47', '#e5b36c', '#efc58e', '#f2cfa3', '#f7dbba'],
  },
};

/** Swap in a palette's chosen tones, keeping the generated tone metadata. */
function withTones<T extends { hex: string }>(scale: T[], tones: string[] | undefined): T[] {
  return tones ? scale.map((t, i) => ({ ...t, hex: tones[i] ?? t.hex })) : scale;
}

/** A semantic palette's light-mode ramp, with its hue easing (or its chosen tones). */
export const semanticLightScale = (key: string) => withTones(generateSemanticLightModeScale(SEMANTIC_SEEDS[key], undefined, undefined, SEMANTIC_HUE_EASING[key]?.light), SEMANTIC_TONES[key]?.light);
/** A semantic palette's dark-mode ramp, with its hue easing (or its chosen tones). */
export const semanticDarkScale = (key: string) => withTones(generateSemanticDarkModeScale(SEMANTIC_SEEDS[key], undefined, SEMANTIC_HUE_EASING[key]?.dark, { easeLightTones: false }), SEMANTIC_TONES[key]?.dark);

interface ToneEntry {
  tone: number;
  color: string;
  /** The dark-mode tone before the chroma ease, when the ease changed it
   *  (ToneStep.preEaseHex). Not a token — exportColorSystemToJSON records it
   *  in Metadata for the chart solver only. */
  preEaseColor?: string;
}

function convertPalette(palette: Array<{ tone: number; lightness: number; hex: string; colorNumber: number; preEaseHex?: string }>): ToneEntry[] {
  return palette.map(t => (t.preEaseHex
    ? { tone: t.tone, color: t.hex, preEaseColor: t.preEaseHex }
    : { tone: t.tone, color: t.hex }));
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
    neutral: convertPalette(semanticLightScale('neutral')),
    info: convertPalette(semanticLightScale('info')),
    success: convertPalette(semanticLightScale('success')),
    warning: convertPalette(semanticLightScale('warning')),
    error: convertPalette(semanticLightScale('error')),
    'hotlink-visited': convertPalette(semanticLightScale('hotlink-visited')),
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
    neutral: convertPalette(semanticDarkScale('neutral')),
    info: convertPalette(semanticDarkScale('info')),
    success: convertPalette(semanticDarkScale('success')),
    warning: convertPalette(semanticDarkScale('warning')),
    error: convertPalette(semanticDarkScale('error')),
    'hotlink-visited': convertPalette(semanticDarkScale('hotlink-visited')),
  };
}
