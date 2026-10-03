/**
 * The preview must define the bar themes the LIB actually sets.
 *
 * Every App-Bar and Nav-Bar selector in buildPreviewCSS sat inside a
 * [data-theme="Brand-App-Bar"] / [data-theme="Brand-Nav-Bar"] wrapper. That
 * wrapper exists only in the PhonePreview. The lib's AppBar, BottomNavigation
 * and Sidebar set a BARE data-theme on their own roots, so on a real page
 * nothing matched — --Background and --Text fell through to the page scope and
 * the header rendered white with a wordmark in the page's text color.
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

const css = (mode: 'light' | 'dark', sel: Record<string, string> = {}) => buildPreviewCSS({
  colorScheme: SCHEME,
  userSelections: { background: 'default', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal', ...sel } as unknown as UserSelections,
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
        // paints and the label keeps the page's color.
        expect(`${mode}/${bar} bg+text: ${/--Background:/.test(block)} ${/--Text:/.test(block)}`)
          .toBe(`${mode}/${bar} bg+text: true true`);
      });
    }
  }
});

/**
 * A bar on a non-Primary palette must take its STATES from that palette.
 *
 * Each bar resolved its own hover/pressed ramp with a two-branch ternary that
 * fell back to the primary for anything that was not Primary or Neutral. The
 * line's own comment said it existed to stop "Primary-Light leaking through",
 * and it was the leak.
 *
 * It hides well. --Background is computed separately and stayed correct, so the
 * bar looked right and only the controls inside it did not: SearchField rests
 * on --Hover, so a blue tertiary app bar carried a search field in the primary's
 * color. Most brands put the bar on Primary, where the bug cannot show.
 *
 * Asserting the token RESOLVES to the right ramp, not merely that both sides
 * emit something — invariant 5 and invariant 7 in one.
 */
describe('a bar on a non-Primary palette takes its states from that palette', () => {
  const scopeOf = (out: string, bar: string) => {
    const i = out.search(new RegExp(`(^|[,{}\\n])\\s*\\[data-theme="${bar}"\\]`, 'm'));
    return out.slice(i, out.indexOf('}', i));
  };
  const hexesIn = (block: string, prop: string) =>
    (block.match(new RegExp(`--${prop}:\\s*([^;]+);`)) || [])[1]?.trim();

  for (const [bar, key] of [['App-Bar', 'appBar'], ['Nav-Bar', 'navBar']] as const) {
    it(`${bar}: --Hover moves when the bar's palette changes`, () => {
      /* The only thing that differs between these two runs is which palette the
         bar sits on. If --Hover is identical across them it is not reading the
         bar's palette at all, which is precisely the old behaviour. */
      const onSecondary = hexesIn(scopeOf(css('light', { [key]: 'Secondary/Surface' }), bar), 'Hover');
      const onTertiary  = hexesIn(scopeOf(css('light', { [key]: 'Tertiary/Surface' }), bar), 'Hover');
      expect(onSecondary).toBeTruthy();
      expect(`${bar} hover secondary===tertiary: ${onSecondary === onTertiary}`)
        .toBe(`${bar} hover secondary===tertiary: false`);
    });

    it(`${bar}: --Pressed moves too`, () => {
      const onSecondary = hexesIn(scopeOf(css('light', { [key]: 'Secondary/Surface' }), bar), 'Pressed');
      const onTertiary  = hexesIn(scopeOf(css('light', { [key]: 'Tertiary/Surface' }), bar), 'Pressed');
      expect(onSecondary).toBeTruthy();
      expect(`${bar} pressed secondary===tertiary: ${onSecondary === onTertiary}`)
        .toBe(`${bar} pressed secondary===tertiary: false`);
    });
  }
});

/**
 * A solid button in the App Bar is painted, so it can be bevelled.
 *
 * The scope emitted --Buttons-Default-Button: transparent while also emitting
 * --Buttons-Default-Highlight and -Lowlight — the two tokens whose only job is
 * to bevel a fill. Every variant="default" button in the bar therefore came out
 * flat and unfilled, looking like an outline button.
 *
 * Both the design and the published CSS say otherwise: Figma's AppBar binds its
 * solid button to Buttons::Button with two INNER_SHADOWs, and the exported
 * [data-theme="App-Bar"] sets the fill to the button palette's tone.
 */
describe('the App Bar paints its default button', () => {
  const appBarScope = (out: string) => {
    const i = out.search(/(^|[,{}\n])\s*\[data-theme="App-Bar"\]/m);
    return out.slice(i, out.indexOf('}', i));
  };

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: --Buttons-Default-Button is a color, not transparent`, () => {
      const v = appBarScope(css(mode)).match(/--Buttons-Default-Button:\s*([^;]+);/)?.[1].trim();
      expect(`${mode} fill: ${v}`).not.toBe(`${mode} fill: transparent`);
      expect(v).toMatch(/^(#|var\(|rgb)/);
    });

    it(`${mode}: it emits a bevel only alongside a fill`, () => {
      /* The pair is the invariant. A highlight with nothing under it is the
         exact state this scope shipped in, and it is invisible: the tokens
         resolve, the button just never uses them. */
      const block = appBarScope(css(mode));
      const fill = block.match(/--Buttons-Default-Button:\s*([^;]+);/)?.[1].trim();
      const hasBevel = /--Buttons-Default-Highlight:/.test(block);
      expect(`bevel:${hasBevel} fill-painted:${fill !== 'transparent' && !!fill}`)
        .toBe(`bevel:${hasBevel} fill-painted:${hasBevel}`);
    });
  }
});
