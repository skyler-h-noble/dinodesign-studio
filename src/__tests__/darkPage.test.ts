import { describe, it, expect } from 'vitest';
import { darkPageTheme, DARK_PAGE_N } from '../utils/backgroundSelection';
import { defaultBackgroundTone } from '../utils/cssgen/exportToCSS';

/* docs/background-selection.md: in dark mode "the theme carries over, the tone
   does not". One rule, used by the preview, the CSS export and the Figma
   payload — they had three copies that kept the theme only for the primary
   strings, and the preview's lacked plain 'primary' altogether. */
describe('the dark Default page', () => {
  it.each([
    ['white', 'Neutral'], ['black', 'Neutral'],
    ['primary', 'Primary'], ['primary-base', 'Primary'], ['primary-light', 'Primary'],
    ['Secondary/Surface-Bright', 'Secondary'], ['Tertiary/Surface-Dim', 'Tertiary'],
    ['Neutral/Surface', 'Neutral'],
  ])('%s → %s at Color-2', (bg, theme) => {
    expect(darkPageTheme(bg)).toBe(theme);
    const meta = { Metadata: { Background: { value: bg } } };
    expect(defaultBackgroundTone(meta, {}, 'Dark-Mode')).toEqual({ defPal: theme, defN: DARK_PAGE_N });
  });
});
