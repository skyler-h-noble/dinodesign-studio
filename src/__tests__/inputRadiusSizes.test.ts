/**
 * The preview emits every per-SIZE input radius, not just the medium one.
 *
 * Input.js reads --Sm-Input-Radius / --Lg-Input-Radius FIRST and falls back to
 * --Input-Radius only when they are undefined. They were defined — by the lib's
 * own base.css, at 3px and 7px — so the fallback never fired, and every small
 * or large input kept the library default wherever the Border Radius slider was
 * dragged. Only medium inputs tracked it, and the demo shows the other two, so
 * from the studio it read as "the slider does nothing".
 *
 * This is the quiet half of invariant 5. The usual divergence is both sides
 * emitting a value and disagreeing, which a value-for-value diff catches. Here
 * the EXPORT emitted all three and the PREVIEW emitted one: there was no pair
 * to compare, and the library's default filled the silence.
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
  name: 'Radii', colors: COLORS,
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

const valueOf = (token: string) => CSS.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1].trim();

describe('per-size input radii reach the preview', () => {
  it('emits all three', () => {
    for (const t of ['Input-Radius', 'Sm-Input-Radius', 'Lg-Input-Radius']) {
      expect(`${t} emitted: ${CSS.includes(`--${t}:`)}`).toBe(`${t} emitted: true`);
    }
  });

  it('gives the small and large sizes their OWN value', () => {
    /* A per-size token that equals the medium one is the same bug wearing a
       different shape: present, resolvable, and carrying no size information.
       The three scale off the small / medium / large button heights, so they
       must differ. */
    const med = valueOf('Input-Radius');
    expect(med).toBeTruthy();
    expect(`small differs: ${valueOf('Sm-Input-Radius') !== med}`).toBe('small differs: true');
    expect(`large differs: ${valueOf('Lg-Input-Radius') !== med}`).toBe('large differs: true');
  });

  it('orders them small < medium < large', () => {
    const n = (t: string) => parseFloat(valueOf(t) || 'NaN');
    expect(`${n('Sm-Input-Radius')} < ${n('Input-Radius')} < ${n('Lg-Input-Radius')}`)
      .toBe(`${n('Sm-Input-Radius')} < ${n('Input-Radius')} < ${n('Lg-Input-Radius')}`);
    expect(n('Sm-Input-Radius')).toBeLessThan(n('Input-Radius'));
    expect(n('Lg-Input-Radius')).toBeGreaterThan(n('Input-Radius'));
  });
});
