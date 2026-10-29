/**
 * The color-combo cards paint each role from its GENERATED ramp, not from the
 * picked color: schemeCoreToneHex reads the role's core tone — the index every
 * downstream reader uses, toneToColorNumber(extractedTones[role]) — out of
 * tonePalettes. A pick above the palette's chroma cap is calmed in the ramp, so
 * the raw pick previewed a color the design system never produces.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { schemeCoreToneHex } from '../utils/colorSchemes';
import { generateSemanticLightModeScale, getLightness, toneToColorNumber } from '../utils/colorScale';
import type { ColorScheme } from '../types';

/** As ColorStage's refinement builds a role: capped at 70, pinned to the pick. */
const ramp = (hex: string) => generateSemanticLightModeScale(hex, 70, hex);

function scheme(colors: [string, string, string]): ColorScheme {
  return {
    name: 'Test',
    colors,
    originalColors: [...colors],
    extractedTones: { primary: getLightness(colors[0]), secondary: getLightness(colors[1]), tertiary: getLightness(colors[2]) },
    tonePalettes: { primary: ramp(colors[0]), secondary: ramp(colors[1]), tertiary: ramp(colors[2]) },
    darkModeTonePalettes: {},
  } as unknown as ColorScheme;
}

describe('schemeCoreToneHex', () => {
  const s = scheme(['#f5e08a', '#b5e61d', '#e8a26a']);

  it('paints the generated core tone, which differs from a pick above the chroma cap', () => {
    // #b5e61d is chroma ~89; the ramp is capped at 70, so its core tone is calmer.
    const painted = schemeCoreToneHex(s, 1);
    expect(painted).not.toBe('#b5e61d');
    expect(chroma(painted).lch()[1]).toBeLessThan(chroma('#b5e61d').lch()[1]);
    expect(painted).toBe(s.tonePalettes.secondary[toneToColorNumber(s.extractedTones.secondary) - 1].hex);
  });

  it('a pick that fits its ramp paints as itself', () => {
    expect(schemeCoreToneHex(s, 0)).toBe('#f5e08a');
  });

  it('follows the ramp when the ramp changes (an edited palette)', () => {
    const edited = { ...s, tonePalettes: { ...s.tonePalettes, tertiary: generateSemanticLightModeScale('#e8a26a', 20, '#e8a26a') } };
    expect(schemeCoreToneHex(edited, 2)).not.toBe(schemeCoreToneHex(s, 2));
  });

  it('falls back to the picked color when the scheme has no ramp for the role', () => {
    const bare = { ...s, tonePalettes: {} } as unknown as ColorScheme;
    expect(schemeCoreToneHex(bare, 1)).toBe('#b5e61d');
  });
});
