/**
 * Design A: the page background is Primary or Neutral; the bars are any theme
 * at any surface level.
 *
 * The two halves have opposite arguments. A page background is the surface
 * every other colour is judged against, so it is the brand's colour or a
 * neutral — an accent page leaves the palette nothing to push off. A bar is a
 * band ON the page, so an accent reads as intended there because it has the
 * background to sit against.
 *
 * The bar mapping is implemented TWICE — resolveNavOption in buildPreviewCSS
 * and getNavThemeAndN in exportColorSystem — which is the shape invariant 5 is
 * about. These assert they agree, and that the legacy strings have not moved.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import {
  BACKGROUND_THEMES, BAR_THEMES, SURFACE_LEVELS,
  parseBar, formatBar, toneFor,
} from '../utils/backgroundSelection';
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

const preview = (sel: Partial<UserSelections>) =>
  buildPreviewCSS({
    colorScheme: SCHEME,
    userSelections: {
      background: 'white', appBar: 'primary-light', navBar: 'primary-light',
      status: 'primary-light', button: 'primary-fixed',
      cardColoring: 'tonal', textColoring: 'tonal', ...sel,
    } as UserSelections,
    componentStyle: 'modern',
    mode: 'light',
    typographyStyles: [
      { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    ],
  } as never);

/** The --Background a given selector block resolves to in the preview CSS. */
function bgOf(css: string, selector: string): string | null {
  const i = css.indexOf(selector);
  if (i < 0) return null;
  const block = css.slice(i, css.indexOf('}', i));
  const m = block.match(/--Background:\s*([^;]+);/);
  return m ? m[1].trim() : null;
}

describe('Design A / pickers', () => {
  it('the background offers Primary or Neutral only', () => {
    expect([...BACKGROUND_THEMES]).toEqual(['Primary', 'Neutral']);
  });

  it('the bars offer every theme', () => {
    expect([...BAR_THEMES]).toEqual(['Primary', 'Secondary', 'Tertiary', 'Neutral']);
  });

  it('a bar round-trips through its serialised form', () => {
    for (const theme of BAR_THEMES) {
      for (const surface of SURFACE_LEVELS) {
        expect(parseBar(formatBar({ theme, surface }))).toEqual({ theme, surface });
      }
    }
  });
});

describe('Design A / legacy bars have not moved', () => {
  // Published systems store these. A bar that shifts a tone on reload is a
  // brand change nobody asked for.
  it.each([
    ['white', 'Neutral', 'Surface-Brightest'],
    ['black', 'Neutral', 'Surface-Dimmest'],
    ['primary-light', 'Primary', 'Surface-Brightest'],
    ['primary', 'Primary', 'Surface'],
  ])('%s still means %s / %s', (legacy, theme, surface) => {
    expect(parseBar(legacy)).toEqual({ theme, surface });
  });

  it('an unknown value falls back to the old default, not to white', () => {
    expect(parseBar(undefined)).toEqual({ theme: 'Primary', surface: 'Surface-Brightest' });
  });
});

describe('Design A / the preview paints the chosen bar theme', () => {
  it('a Secondary app bar does not render in Primary', () => {
    // The preview used to send every non-neutral palette through the PRIMARY
    // ramp. Harmless while the picker could only say Primary; silently wrong
    // the moment it could say Secondary.
    const secondary = bgOf(preview({ appBar: 'Secondary/Surface' }), '[data-theme="App-Bar"]');
    const primary = bgOf(preview({ appBar: 'Primary/Surface' }), '[data-theme="App-Bar"]');
    expect(secondary).toBeTruthy();
    expect(secondary).not.toBe(primary);
  });

  it('each theme gives the app bar a distinct colour', () => {
    const seen = new Set(
      BAR_THEMES.map((t) => bgOf(preview({ appBar: `${t}/Surface` }), '[data-theme="App-Bar"]')),
    );
    expect(seen.size).toBe(BAR_THEMES.length);
  });

  it('the surface level moves the bar within one theme', () => {
    const dim = bgOf(preview({ navBar: 'Primary/Surface-Dim' }), '[data-theme="Nav-Bar"]');
    const bright = bgOf(preview({ navBar: 'Primary/Surface-Bright' }), '[data-theme="Nav-Bar"]');
    expect(dim).toBeTruthy();
    expect(bright).toBeTruthy();
    expect(chroma(dim!).luminance()).toBeLessThan(chroma(bright!).luminance());
  });

  it('a chromatic Surface-Brightest stays tinted rather than going white', () => {
    // Colour-12 on a chromatic ramp is so desaturated it reads as white, which
    // throws away the tint that makes the bar branded. Capped at 11.
    expect(toneFor('Primary', 'Surface-Brightest', 6)).toBe(11);
    expect(toneFor('Neutral', 'Surface-Brightest', 6)).toBe(12);
  });
});
