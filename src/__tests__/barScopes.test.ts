/**
 * The preview must define the bar themes the LIB actually sets.
 *
 * Every App-Bar and Nav-Bar selector in buildPreviewCSS sat inside a
 * [data-theme="Brand-App-Bar"] / [data-theme="Brand-Nav-Bar"] wrapper. That
 * wrapper exists only in the PhonePreview. The lib's AppBar, BottomNavigation
 * and Sidebar set a BARE data-theme on their own roots, so on a real page
 * nothing matched — --Background and --Text fell through to the page scope and
 * the header rendered white with a wordmark in the page's text colour.
 *
 * It read as a contrast bug. It was a missing selector, and the published CSS
 * had the rules all along: 12 bare [data-theme="App-Bar"] blocks against zero
 * in the preview. Invariant 5, exactly.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

const COLORS: [string, string, string] = ['#7b3f9d', '#2563eb', '#b8329b'];
const l = (h: string) => generateSemanticLightModeScale(h, undefined, h);
const d = (h: string) => generateSemanticDarkModeScale(h);
const SCHEME = {
  name: 'Bars', colors: COLORS,
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: l(COLORS[0]), secondary: l(COLORS[1]), tertiary: l(COLORS[2]) },
  darkModeTonePalettes: { primary: d(COLORS[0]), secondary: d(COLORS[1]), tertiary: d(COLORS[2]) },
} as unknown as ColorScheme;

const css = (mode: 'light' | 'dark') => buildPreviewCSS({
  colorScheme: SCHEME,
  userSelections: { background: 'default', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as unknown as UserSelections,
  componentStyle: 'modern',
  mode,
  typographyStyles: [
    { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
    { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
    { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
  ],
} as never);

describe('preview defines the bar themes the lib sets', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const bar of ['App-Bar', 'Nav-Bar']) {
      it(`${mode}: a bare [data-theme="${bar}"] gets its own tokens`, () => {
        const out = css(mode);
        // The selector must appear NOT preceded by a descendant combinator —
        // i.e. at the start of a selector, not only as "Brand-X ... [X]".
        const bare = new RegExp(`(^|[,{}\\n])\\s*\\[data-theme="${bar}"\\]`, 'm');
        expect(`${mode}/${bar} bare selector: ${bare.test(out)}`)
          .toBe(`${mode}/${bar} bare selector: true`);
      });

      it(`${mode}: that scope sets both a Background and a Text`, () => {
        const out = css(mode);
        const i = out.search(new RegExp(`(^|[,{}\\n])\\s*\\[data-theme="${bar}"\\]`, 'm'));
        const block = out.slice(i, out.indexOf('}', i));
        // A background with no paired text is the failure mode itself: the bar
        // paints and the label keeps the page's colour.
        expect(`${mode}/${bar} bg+text: ${/--Background:/.test(block)} ${/--Text:/.test(block)}`)
          .toBe(`${mode}/${bar} bg+text: true true`);
      });
    }
  }
});
