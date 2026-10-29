/**
 * DARK MODE: calm the light end of the ramp.
 *
 * Applied in colorScale.ts (generateSemanticDarkModeScale) and re-exported
 * from there. Kept in its own leaf module so the curve can be read and tuned
 * without wading through the ramp generator.
 *
 * In dark mode, Color-6 … Color-12 (L 58 … 89) are the tones that land on big
 * areas — Color-6 IS a themed section's Surface, Color-7 its Surface-Bright,
 * Color-11 its Surface-Brightest — and they are also the text, header and
 * border tones on the dark surfaces. Color-6 shares light mode's lightness and
 * bell value (0.90), so a brand's full-strength mid tone was painted across a
 * whole dark-mode section: far louder against a dark page than the same color
 * is in light mode.
 *
 * So the chroma of those tones is multiplied by an ease: Color-6 the calmest,
 * rising smoothly back to today's saturation at Color-12 (multiplier 1.0).
 * Lightness is never touched — CIE L* fixes relative luminance, so every
 * contrast pairing that uses these tones keeps its ratio (only 8-bit rounding
 * can move it, and lowering chroma moves a color further INTO gamut).
 *
 * The multiplier applies to each tone's CURRENT chroma (after the bell curve
 * and the gamut clip), so "1.0 at Color-12" means exactly today's tone.
 * Tones 1-5 and light mode are untouched, as are the fixed-seed semantic
 * ramps (Neutral, Info, Success, Warning, Error, Hotlink-Visited).
 *
 * Charts are deliberately NOT eased: their tones are solved once for both
 * modes, so the export records the pre-ease tones (ToneStep.preEaseHex →
 * Metadata['Chart-Pre-Ease-Dark-Tones']) and solveChartPalette reads those.
 *
 * Tune here: `startMultiplier` is Color-6's share of its current chroma.
 */
export const DARK_LIGHT_TONE_CHROMA_EASE = {
  /** First tone eased (1-based Color-N). */
  fromColorN: 6,
  /** Tone where the ease is back to today's chroma (multiplier 1.0). */
  toColorN: 12,
  /** Color-6's multiplier: 0.6 keeps 60% of today's chroma. */
  startMultiplier: 0.6,
} as const;

/**
 * Chroma multiplier for a dark-mode tone (1-based Color-N).
 * 1 outside the eased range; inside it, a smoothstep (ease-in-out) from
 * `startMultiplier` at `fromColorN` to 1.0 at `toColorN`. Smoothstep rather
 * than linear so Color-7 — Surface-Bright, the other large surface — stays
 * nearly as calm as Color-6, while the text tones (9-12) are back near today's
 * saturation.
 */
export function darkLightToneChromaMultiplier(
  colorN: number,
  ease: { fromColorN: number; toColorN: number; startMultiplier: number } = DARK_LIGHT_TONE_CHROMA_EASE,
): number {
  if (colorN < ease.fromColorN || colorN >= ease.toColorN) return 1;
  const t = (colorN - ease.fromColorN) / (ease.toColorN - ease.fromColorN);
  const s = t * t * (3 - 2 * t);
  return ease.startMultiplier + (1 - ease.startMultiplier) * s;
}
