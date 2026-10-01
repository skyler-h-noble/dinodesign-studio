import { describe, it, expect } from 'vitest';
import { systemCssUrls, SYSTEM_CSS_FILES } from '../utils/docs/systemCss';

describe('the stylesheets a docs page loads', () => {
  const urls = systemCssUrls('abc-123');

  it('names all seven, so a component does not paint its fallbacks', () => {
    /* A missing stylesheet does not error. It leaves tokens unresolved and the
       component renders whatever its var() fallback says — which looks like a
       brand that happens to be grey rather than like a bug. */
    expect(Object.keys(urls)).toHaveLength(7);
    expect(SYSTEM_CSS_FILES).toHaveLength(7);
  });

  it('names the type ramp — the worse failure, where tokens ARE defined', () => {
    /* typography-tokens.css was the one sheet nobody passed, and it fails in the
       opposite direction from the test above: the lib bundles its own copy, so
       every token stayed DEFINED and simply carried the bundled brand's ramp.
       Nothing was grey and nothing was unresolved — a hosted design system just
       quietly wore one specific brand's type. Asserted by name because a count
       alone would pass again the moment a seventh sheet of any kind appeared. */
    expect(SYSTEM_CSS_FILES).toContain('typography-tokens.css');
    expect(urls.typographyCSS).toContain('typography-tokens.css');
  });

  it('points every one at the same design system', () => {
    for (const url of Object.values(urls)) expect(url).toContain('abc-123');
  });

  it('keeps light and dark separate', () => {
    expect(urls.lightModeCSS).not.toBe(urls.darkModeCSS);
    expect(urls.lightModeCSS).toContain('Light-Mode');
    expect(urls.darkModeCSS).toContain('Dark-Mode');
  });
});
