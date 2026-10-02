import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * No theme means Default.
 *
 * Default's surface rules are emitted UNSCOPED as well as under
 * [data-theme="Default"], so an element that names no theme still gets a
 * complete set rather than nothing. Before this, `Default` existed only as an
 * attribute value: "no theme" inherited whatever an ancestor happened to carry,
 * so a picker could read Default while the box rendered Primary and neither
 * looked wrong.
 *
 * Asserted against the SOURCE rather than generated output, the same way
 * deviceChrome.test.ts does, because the thing being protected is that the
 * generator writes these selectors at all.
 */
const SRC = readFileSync(
  join(__dirname, '..', 'utils', 'cssgen', 'exportToCSS.ts'), 'utf8');

describe('the Default theme is also unscoped', () => {
  it('emits :root for the base surface', () => {
    expect(SRC).toContain("surfaceAttr === null ? ':root,");
  });

  it('emits a bare [data-surface] for the other four levels', () => {
    expect(SRC).toContain('`[data-surface="${surfaceAttr}"],');
  });

  it('only does it for Default', () => {
    /* A bare rule for Primary would paint every unthemed element in that
       palette. The guard is what keeps the unscoped forms a FLOOR rather than
       a second theme. */
    expect(SRC).toContain("const isDefaultTheme = themeName === 'Default';");
    expect(SRC).toContain('!isDefaultTheme');
  });

  it('keeps the bare rules at a specificity a real theme beats', () => {
    /* :root matches <html> only, so it cannot shadow a themed subtree, and a
       bare [data-surface="X"] is (0,1,0) while a themed ancestor's
       [data-theme="Primary"] [data-surface="X"] is (0,2,0). The comment states
       this because the whole design depends on it and a future edit that
       "tidies" the selectors would silently break it. */
    expect(SRC).toContain('matches <html> only');
  });
});
