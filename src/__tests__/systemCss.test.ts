import { describe, it, expect } from 'vitest';
import { systemCssUrls, SYSTEM_CSS_FILES } from '../utils/docs/systemCss';

describe('the stylesheets a docs page loads', () => {
  const urls = systemCssUrls('abc-123');

  it('names all six, so a component does not paint its fallbacks', () => {
    /* A missing stylesheet does not error. It leaves tokens unresolved and the
       component renders whatever its var() fallback says — which looks like a
       brand that happens to be grey rather than like a bug. */
    expect(Object.keys(urls)).toHaveLength(6);
    expect(SYSTEM_CSS_FILES).toHaveLength(6);
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
