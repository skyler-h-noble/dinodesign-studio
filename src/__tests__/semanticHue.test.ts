/** The state ramps hold one perceived hue: a blue that stays blue as it lightens. */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { semanticLightScale, semanticDarkScale } from '../utils/generateFullPalettes';
import { generateSemanticDarkModeScale, generateSemanticLightModeScale } from '../utils/colorScale';

const hdiff = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

describe('Info is blue at every tone', () => {
  it('stays within ±6° of OKLCH 258 in light and dark mode', () => {
    for (const scale of [semanticLightScale('info'), semanticDarkScale('info')]) {
      for (const t of scale) {
        const [, c, h] = chroma(t.hex).oklch();
        if (c < 0.012) continue;   // near-white and near-black tones carry no readable hue
        // 276+ reads lavender and was where the old blue's light tones landed.
        expect(hdiff(h, 258), `${t.hex} at hue ${h.toFixed(0)}`).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('Error is red at every tone', () => {
  it('light mode stays within ±6° of OKLCH 27 — not peach at the light end', () => {
    for (const t of semanticLightScale('error')) {
      const [, c, h] = chroma(t.hex).oklch();
      if (c < 0.012) continue;
      expect(hdiff(h, 27), `${t.hex} at hue ${h.toFixed(0)}`).toBeLessThanOrEqual(6);
    }
  });

  it('dark mode is left exactly as it was', () => {
    expect(semanticDarkScale('error').map((t) => t.hex)).toEqual(generateSemanticDarkModeScale('#D44040').map((t) => t.hex));
  });
});

/* Success and Warning are set tone by tone (SEMANTIC_TONES). They moved hue and
   vividness only: every tone keeps the generated lightness, so the label a tone
   carries and its contrast are unchanged. */
describe('Success and Warning keep their labels', () => {
  const label = (hex: string) => Math.max(chroma.contrast(hex, '#ffffff'), chroma.contrast(hex, '#1a1a1a'));
  const generated = {
    success: { light: generateSemanticLightModeScale('#2E9E5A'), dark: generateSemanticDarkModeScale('#2E9E5A') },
    warning: { light: generateSemanticLightModeScale('#D4941A'), dark: generateSemanticDarkModeScale('#D4941A') },
  };
  for (const key of ['success', 'warning'] as const) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${key} ${mode}: every tone's label contrast within 0.1 of the generated ramp`, () => {
        const scale = (mode === 'light' ? semanticLightScale : semanticDarkScale)(key);
        scale.forEach((t, i) => {
          expect(Math.abs(label(t.hex) - label(generated[key][mode][i].hex)), `${key} ${mode} tone ${i + 1} ${t.hex}`).toBeLessThanOrEqual(0.1);
        });
      });
    }
  }
  it('Success is a bluer green (CIE LCH 155–165) wherever it carries hue', () => {
    for (const scale of [semanticLightScale('success'), semanticDarkScale('success')]) for (const t of scale) {
      const [, c, h] = chroma(t.hex).lch(); if (c < 6) continue;
      expect(h, t.hex).toBeGreaterThanOrEqual(155); expect(h, t.hex).toBeLessThanOrEqual(165);
    }
  });
  it('Warning tones 2–8 are amber-orange (CIE LCH 62–74)', () => {
    for (const scale of [semanticLightScale('warning'), semanticDarkScale('warning')]) for (const t of scale.slice(1, 8)) {
      const [, , h] = chroma(t.hex).lch();
      expect(h, t.hex).toBeGreaterThanOrEqual(62); expect(h, t.hex).toBeLessThanOrEqual(74);
    }
  });
});
