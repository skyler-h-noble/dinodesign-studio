/** The state ramps hold one perceived hue: a blue that stays blue as it lightens. */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { semanticLightScale, semanticDarkScale } from '../utils/generateFullPalettes';
import { generateSemanticDarkModeScale } from '../utils/colorScale';

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
