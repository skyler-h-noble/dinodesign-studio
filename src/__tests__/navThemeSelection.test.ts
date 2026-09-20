/**
 * Nav theme selections — the vocabulary the studio actually writes.
 *
 * The App-Bar, Nav-Bar and Status themes were never generated: the studio
 * writes "<Theme>/<Surface-Level>" (e.g. "Tertiary/Surface-Bright") and the
 * mapper's switch only knew flat names like 'primary-light'. Everything fell
 * through to a catch-all default that passed the WHOLE string as a theme
 * name, themes['Tertiary/Surface-Bright'] was undefined, and the three themes
 * were dropped with an error nobody was reading.
 *
 * Third time this shape has appeared in this codebase. moodAxes.ts says it
 * best: "A catch-all default hides a vocabulary mismatch, because the fallback
 * is a real value that renders."
 */
import { describe, it, expect } from 'vitest';
import { generateAllThemesWithSurfacesAndContainers } from '../utils/cssgen/generateCompleteThemes';

/* The mapper is module-private, so this drives the real entry point and
   asserts on the themes that come out — which is the thing that was broken,
   not the parse. */
function themesFor(sel: Record<string, string>) {
  return generateAllThemesWithSurfacesAndContainers(
    'Light-Mode',
    { primary: 67, secondary: 71, tertiary: 63 },
    'light-tonal',
    'analogous',
    { ...sel } as never,
  ) as Record<string, unknown>;
}

describe('the Theme/Level vocabulary resolves', () => {
  it('builds App-Bar, Nav-Bar and Status from "<Theme>/<Surface-Level>"', () => {
    const t = themesFor({
      appBar: 'Tertiary/Surface-Bright',
      navBar: 'Primary/Surface-Dim',
      status: 'Secondary/Surface',
    });
    for (const name of ['App-Bar', 'Nav-Bar', 'Status']) {
      expect(`${name} built: ${t[name] !== undefined}`).toBe(`${name} built: true`);
    }
  });

  it('promotes the named level to be that theme\'s Surface', () => {
    /* The level has to be translated too: a theme keys its levels
       Surfaces-Bright (plural) while the user-facing name is Surface-Bright. */
    const t = themesFor({ appBar: 'Tertiary/Surface-Bright' }) as never as
      Record<string, { Surfaces?: unknown }>;
    const tertiary = t['Tertiary'] as unknown as Record<string, unknown>;
    expect(JSON.stringify(t['App-Bar'].Surfaces))
      .toBe(JSON.stringify(tertiary['Surfaces-Bright']));
  });

  it('still honours the older flat names', () => {
    /* Saved systems predate the Theme/Level form. */
    const t = themesFor({ appBar: 'primary-light', navBar: 'black', status: 'white' });
    for (const name of ['App-Bar', 'Nav-Bar', 'Status']) {
      expect(`${name}: ${t[name] !== undefined}`).toBe(`${name}: true`);
    }
  });

  it('does not silently invent a theme for an unknown shape', () => {
    /* It falls back, because a missing nav theme is worse than a wrong one —
       but it WARNS, which is the half that was missing. */
    const warn = console.warn;
    const seen: string[] = [];
    console.warn = (...a: unknown[]) => { seen.push(a.join(' ')); };
    try { themesFor({ appBar: 'not-a-real-selection' }); } finally { console.warn = warn; }
    expect(seen.some((l) => l.includes('not-a-real-selection'))).toBe(true);
  });
});
