/**
 * The FAB's bevel in CSS is the same number Figma holds.
 *
 * Figma: Devices-Type FAB-Bevel / FAB-Sm-Bevel / FAB-Lg-Bevel (bevelPairs,
 * from the FAB's own width), read per size through Component-Size ›
 * FAB/FAB-Bevel by the FAB-Bevel effect style.
 * CSS: --FAB-Bevel / --Sm-FAB-Bevel / --Lg-FAB-Bevel, which the lib's Fab reads.
 * Before these existed the lib derived its own (Button-Bevel% x height,
 * unrounded) and landed 9.6px where Figma drew 10.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { bevelPairs, fabBevelVars } from '../utils/bevelGeometry';
import { FAB_SIZE } from '../utils/componentSize';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';

describe('FAB bevel', () => {
  for (const pct of [0, 10, 20, 35]) {
    it(`CSS equals the Figma pair at ${pct}%`, () => {
      const css = fabBevelVars(FAB_SIZE, pct);
      const figma = {
        ...bevelPairs('FAB-', FAB_SIZE.medium, pct),
        ...bevelPairs('FAB-Sm-', FAB_SIZE.small, pct),
        ...bevelPairs('FAB-Lg-', FAB_SIZE.large, pct),
      };
      expect(css['--FAB-Bevel']).toBe(`${figma['FAB-Bevel']}px`);
      expect(css['--Sm-FAB-Bevel']).toBe(`${figma['FAB-Sm-Bevel']}px`);
      expect(css['--Lg-FAB-Bevel']).toBe(`${figma['FAB-Lg-Bevel']}px`);
    });
  }

  it('the exported CSS carries all three', () => {
    const c = ['#7b3f9d', '#2563eb', '#b8329b'];
    const l = (h: string) => generateSemanticLightModeScale(h, undefined, h);
    const d = (h: string) => generateSemanticDarkModeScale(h);
    const json = exportColorSystemToJSON(
      generateFullLightPalettes(l(c[0]) as never, l(c[1]) as never, l(c[2]) as never),
      generateFullDarkPalettes(d(c[0]) as never, d(c[1]) as never, d(c[2]) as never),
      'neutral', 'primary-fixed' as never,
      { primary: chroma(c[0]).lch()[0], secondary: chroma(c[1]).lch()[0], tertiary: chroma(c[2]).lch()[0] },
      'modern', { header: { family: 'Inter', weight: '600' }, decorative: { family: 'Inter', weight: '400' }, body: { family: 'Inter', weight: '400' } } as never,
      'FAB', undefined, undefined, undefined, 'light-tonal', undefined,
      { background: 'white', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' } as never,
    );
    // generateDesignSystem attaches the user's component style before export.
    (json as unknown as Record<string, unknown>)._componentStyle = { bevel: 20 };
    const bundle = Object.values(generateCSSFiles(json as never) as Record<string, string>).join('\n');
    // 20% of the 48 / 32 / 56 FAB, rounded, capped at a fifth: 10 / 6 / 11.
    expect(bundle).toMatch(/--FAB-Bevel:\s*10px;/);
    expect(bundle).toMatch(/--Sm-FAB-Bevel:\s*6px;/);
    expect(bundle).toMatch(/--Lg-FAB-Bevel:\s*11px;/);
  });
});
