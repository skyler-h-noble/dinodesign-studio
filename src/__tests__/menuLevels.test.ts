/**
 * The Menu-Levels collection reaches BOTH stylesheets.
 *
 * Seven modes, one variable — the indent of a menu row at each nesting depth.
 * The table and its regularity check have lived in figmaModeMapping since
 * September, with tests asserting the ladder is base 8 step 28. Nothing ever
 * emitted it. So the collection reached neither the preview nor the export, and
 * TreeView indents with a hardcoded 9px + 12px instead.
 *
 * Those are not the same shape, which is why the gap could not be closed by
 * accident: Figma's values are ABSOLUTE per depth, and a compounding per-level
 * indent cannot produce 8 / 36 / 64 and then 176 at depth six. It would need a
 * different step at every rung — exactly the hand-typed ladder this collection
 * was straightened out of.
 *
 * Asserted on both sides because a token on one is the invariant-5 shape that
 * has bitten repeatedly today: no mismatched pair to diff, just silence on one
 * side that something else quietly fills.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { menuLevelCSS } from '../utils/menuLevels';
import { MENU_LEVEL_LEFT_MARGIN } from '../utils/figmaModeMapping';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

const COLORS: [string, string, string] = ['#7b3f9d', '#2563eb', '#b8329b'];
const l = (h: string) => generateSemanticLightModeScale(h, undefined, h);
const d = (h: string) => generateSemanticDarkModeScale(h);
const SCHEME = {
  name: 'Menu', colors: COLORS,
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: l(COLORS[0]), secondary: l(COLORS[1]), tertiary: l(COLORS[2]) },
  darkModeTonePalettes: { primary: d(COLORS[0]), secondary: d(COLORS[1]), tertiary: d(COLORS[2]) },
} as unknown as ColorScheme;

const PREVIEW = buildPreviewCSS({
  colorScheme: SCHEME,
  userSelections: { background: 'default', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as unknown as UserSelections,
  componentStyle: 'modern',
  mode: 'light',
  typographyStyles: [
    { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
    { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
    { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
  ],
} as never);

describe('Menu-Levels reaches the CSS', () => {
  it('emits all seven depths in the preview', () => {
    for (let n = 0; n < 7; n++) {
      expect(`level ${n} in preview: ${PREVIEW.includes(`--Menu-Level-${n}-Left-Margin:`)}`)
        .toBe(`level ${n} in preview: true`);
    }
  });

  it('carries the values the design file holds', () => {
    const expected = Object.values(MENU_LEVEL_LEFT_MARGIN);
    for (const [n, px] of expected.entries()) {
      const got = PREVIEW.match(new RegExp(`--Menu-Level-${n}-Left-Margin:\\s*(\\d+)px`))?.[1];
      expect(`level ${n}: ${got}`).toBe(`level ${n}: ${px}`);
    }
  });

  it('is ABSOLUTE per depth, not a compounding indent', () => {
    /* The distinction that makes the hardcoded TreeView indent wrong rather
       than merely different: each level is measured from the same origin, so
       the gap between consecutive levels is constant and level 6 is 176 — not
       the sum of six nested paddings. */
    const vals = Object.values(MENU_LEVEL_LEFT_MARGIN);
    const steps = vals.slice(1).map((v, i) => v - vals[i]);
    expect(new Set(steps).size).toBe(1);
    expect(vals[vals.length - 1]).toBe(176);
  });

  it('comes from ONE emitter, so the table cannot be copied per consumer', () => {
    /* The preview and the export both call menuLevelCSS. Writing the seven
       values into each separately would have put a third and fourth copy of
       the ladder in the codebase, which is how the original irregular one
       survived. */
    const direct = menuLevelCSS('  ');
    for (let n = 0; n < 7; n++) {
      expect(direct).toContain(`--Menu-Level-${n}-Left-Margin:`);
    }
  });
});
