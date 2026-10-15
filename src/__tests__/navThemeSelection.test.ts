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
import { toneFor } from '../utils/backgroundSelection';

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

  it('paints a Theme/Level pick at the background-selection grid\'s tone, as the preview does', () => {
    /* "Tertiary/Surface-Bright" is the grid's tone — the midpoint of the
       theme's core and 11 (docs/background-selection.md) — not the theme's
       own component level of that name. This used to promote the component
       level, so Popsicles' bar exported at tone 7 while the preview, which
       reads the grid, showed tone 9. Both now go through toneFor. */
    const t = themesFor({ appBar: 'Tertiary/Surface-Bright' }) as never as
      Record<string, { Surfaces: { Background: { value: string } } }>;
    const core = Number(/Background-(\d+)/.exec(t['Tertiary'].Surfaces.Background.value)![1]);
    const n = toneFor('Tertiary', 'Surface-Bright', core);
    expect(t['App-Bar'].Surfaces.Background.value).toBe(`{Backgrounds.Tertiary.Background-${n}.Surfaces.Surface}`);
    // And it is brighter than the theme's base, as a Bright pick must be.
    expect(n).toBeGreaterThan(core);
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
