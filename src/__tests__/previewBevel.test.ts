/**
 * The preview's bevel has to be paintable by the lib.
 *
 * The lib's Button draws the bevel as
 *   inset var(--Button-Highlight-Offset-x) … rgb(var(--Buttons-X-Highlight))
 * so two things must hold in what the studio emits:
 *   1. every --Buttons-*-Highlight / -Lowlight is a COMMA RGB TRIPLET, as in
 *      the published CSS — a hex inside rgb() is invalid and drops the shadow;
 *   2. the per-size geometry (--Button- / --Sm-Button- / --Lg-Button-
 *      Highlight-Offset-x …) is emitted, or the lib's core.css 0px wins and the
 *      bevel is zero wide whatever the slider says.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { componentStyleVars } from '../utils/componentStyleVars';
import { bevelSize } from '../utils/bevelGeometry';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

function makeScheme(colors: [string, string, string]): ColorScheme {
  const light = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
  const dark = (hex: string) => generateSemanticDarkModeScale(hex);
  return {
    name: 'Test',
    colors,
    extractedTones: {
      primary: chroma(colors[0]).lch()[0],
      secondary: chroma(colors[1]).lch()[0],
      tertiary: chroma(colors[2]).lch()[0],
    },
    tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
    darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
  } as unknown as ColorScheme;
}

const SEL = {
  background: 'primary-light',
  appBar: 'Tertiary/Surface-Bright',
  navBar: 'Tertiary/Surface',
  button: 'secondary',
  buttonTone: 'fixed',
} as UserSelections;

describe('preview bevel colours', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`every --Buttons-*-Highlight / -Lowlight is an RGB triplet (${mode})`, () => {
      const css = buildPreviewCSS({
        colorScheme: makeScheme(['#5b2a86', '#8ec5ea', '#e07aa8']),
        userSelections: SEL,
        componentStyle: 'modern',
        mode,
        typographyStyles: [],
      } as never);
      const values = [...css.matchAll(/--[\w-]*Buttons-[\w-]+-(?:Highlight|Lowlight):\s*([^;]+);/g)].map((m) => m[1].trim());
      expect(values.length).toBeGreaterThan(20);
      const bad = values.filter((v) => !/^\d{1,3}, \d{1,3}, \d{1,3}$/.test(v) && !v.startsWith('var('));
      expect(bad).toEqual([]);
    });
  }
});

describe('preview bevel geometry', () => {
  it('emits all three sizes, from each size\'s own height', () => {
    const vars = componentStyleVars('modern', {
      buttonHeight: 40, smallButtonHeight: 28, largeButtonHeight: 56, bevel: 10,
    } as never);
    for (const [prefix, h] of [['', 40], ['Sm-', 28], ['Lg-', 56]] as const) {
      const b = bevelSize(h, 10);
      expect(b).toBeGreaterThan(0);
      expect(vars[`--${prefix}Button-Highlight-Offset-x`]).toBe(`${b}px`);
      expect(vars[`--${prefix}Button-Highlight-Spread`]).toBe(`${-b}px`);
      expect(vars[`--${prefix}Button-Lowlight-Offset-y`]).toBe(`${-b}px`);
      expect(vars[`--${prefix}Button-Lowlight-Blur-Radius`]).toBe(`${b}px`);
    }
  });

  it('is zero when the bevel is off', () => {
    const vars = componentStyleVars('modern', { bevel: 0 } as never);
    expect(vars['--Button-Highlight-Offset-x']).toBe('0px');
  });
});
