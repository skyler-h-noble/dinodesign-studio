/**
 * Plain Surface has no descendant arm, so nothing may re-declare it.
 *
 * The brand's CSS gives every theme a descendant arm for Surface-Dim,
 * -Dimmest, -Bright and -Brightest, and NONE for plain Surface. That is
 * deliberate: Surface is the default level, so an element marked Surface has
 * not opted into anything, and custom properties already inherit.
 *
 * The consequence is easy to trip over and was: an element carrying
 * data-surface="Surface" but no data-theme matches neither
 * [data-theme="X"][data-surface="Surface"] nor any descendant arm, so it falls
 * through to base.css's generic mapping — near-white. It renders a panel the
 * user never chose, in a colour that appears nowhere in their brand, and the
 * attribute that caused it looks like the one thing making it correct.
 *
 * This asserts the emission rule so the arm is not "helpfully" added later.
 * Adding it would score (0,2,0) — the same as
 * [data-theme="App-Bar"][data-surface="Surface"] — and, emitted further down
 * the file, would win on source order and repaint the app bar with the page's
 * surface.
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
  name: 'Surfaces', colors: COLORS,
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: l(COLORS[0]), secondary: l(COLORS[1]), tertiary: l(COLORS[2]) },
  darkModeTonePalettes: { primary: d(COLORS[0]), secondary: d(COLORS[1]), tertiary: d(COLORS[2]) },
} as unknown as ColorScheme;

const CSS = buildPreviewCSS({
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

describe('plain Surface is inherited, never re-declared', () => {
  it('emits a descendant arm for the OPT-IN surface levels', () => {
    /* The contrast is the point: those levels are opt-in, so they need one.
       Surface-Brightest is absent from the preview and present in the published
       CSS — a real divergence, noted here rather than asserted, because fixing
       it is a separate change from the one this file is about. */
    for (const level of ['Surface-Dim', 'Surface-Dimmest', 'Surface-Bright']) {
      const arm = new RegExp(`\\[data-theme="Brand"\\]\\s+\\[data-surface="${level}"\\]`);
      expect(`${level} descendant arm: ${arm.test(CSS)}`).toBe(`${level} descendant arm: true`);
    }
  });

  it('emits NO descendant arm for plain Surface', () => {
    /* A space between the two attribute selectors is the descendant form.
       [data-theme="Brand"][data-surface="Surface"] — no space — is the element
       itself and is correct; it is the descendant arm that must not exist. */
    const descendant = /\[data-theme="Brand"\]\s+\[data-surface="Surface"\]/;
    expect(`plain Surface descendant arm: ${descendant.test(CSS)}`)
      .toBe('plain Surface descendant arm: false');
  });

  it('still scopes plain Surface on the element that carries both attributes', () => {
    expect(CSS).toMatch(/\[data-theme="Brand"\]\[data-surface="Surface"\]/);
  });
});
