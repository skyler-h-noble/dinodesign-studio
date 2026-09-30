/**
 * The map is hand-written, so it is checked against a capture of the real file.
 *
 * Every page and set name it claims must exist. A typo here does not error —
 * it produces a link that resolves to nothing, or a doc section that silently
 * has no Figma block, which is the failure this whole map exists to avoid.
 *
 * The fixture holds node ids too, but nothing matches on them: ids are per COPY
 * of the template and the plugin reports the user's own at link time. They are
 * captured so a drift in the capture itself is visible.
 */
import { describe, it, expect } from 'vitest';
import {
  FIGMA_COMPONENT_MAP, NO_FIGMA_PAGE, NO_LIBRARY_COMPONENT,
  NON_COMPONENT_PAGES, figmaMappingFor,
} from '../utils/figmaComponentMap';
import fixture from './__fixtures__/figmaComponentSets.json';

const REAL_SETS = fixture.sets as Array<{ page: string; name: string; variants: number }>;
/* Every page, not just the ones holding component sets: Typography and
   ToggleButton have pages and no sets, and deriving the page list from the sets
   made both look like typos. */
const REAL_PAGES = new Set(fixture.pages as string[]);
const setsOn = (page: string) => new Set(REAL_SETS.filter(s => s.page === page).map(s => s.name));
const entries = Object.entries(FIGMA_COMPONENT_MAP);

describe('every row points at something that exists', () => {
  it.each(entries)('%s: its page is a real page', (component, m) => {
    expect(REAL_PAGES.has(m.page), `${component} -> page "${m.page}"`).toBe(true);
  });

  it.each(entries)('%s: every set it names is on that page', (component, m) => {
    const real = setsOn(m.page);
    for (const s of m.sets) {
      expect(real.has(s), `${component}: "${s}" is not on the ${m.page} page`).toBe(true);
    }
  });

  it('claims no set that does not exist anywhere in the file', () => {
    const all = new Set(REAL_SETS.map(s => s.name));
    const invented = entries.flatMap(([, m]) => m.sets).filter(s => !all.has(s));
    expect(invented).toEqual([]);
  });
});

describe('the lists do not contradict each other', () => {
  it('no component is both mapped and listed as having no page', () => {
    const unmapped = [...NO_FIGMA_PAGE.undesigned, ...NO_FIGMA_PAGE.notDrawable,
      ...NO_FIGMA_PAGE.deferred];
    const both = unmapped.filter(c => c in FIGMA_COMPONENT_MAP);
    expect(both).toEqual([]);
  });

  it('no page is both mapped and listed as having no component', () => {
    const mapped = new Set(entries.map(([, m]) => m.page));
    expect([...NO_LIBRARY_COMPONENT].filter(p => mapped.has(p))).toEqual([]);
  });

  it('no page is both mapped and marked as not-a-component page', () => {
    /* Adaptive Templates, Brand, Hero, Shapes and the import landing page hold
       artwork, not components. Matching one would put a Figma link on a
       component that is not there. */
    const mapped = new Set(entries.map(([, m]) => m.page));
    expect([...NON_COMPONENT_PAGES].filter(p => mapped.has(p))).toEqual([]);
  });

  it('maps each page to at most one component', () => {
    /* A page backing two components would make the doc show the same Figma
       block twice and give neither reader the right one. */
    const byPage: Record<string, string[]> = {};
    for (const [c, m] of entries) (byPage[m.page] = byPage[m.page] || []).push(c);
    expect(Object.entries(byPage).filter(([, cs]) => cs.length > 1)).toEqual([]);
  });
});

describe('the pairs that are not name matches', () => {
  /* Each of these would be got wrong by any derivation, which is why the table
     is written out. Asserted individually so a "tidy-up" that collapses them
     fails loudly. */
  it('Fab is FAB in Figma, and deliberately so', () => {
    expect(figmaMappingFor('Fab')!.page).toBe('FAB');
    expect(FIGMA_COMPONENT_MAP.Fab.note).toMatch(/consumers/);
  });

  it('Charts lives on the Data Visualization page', () => {
    expect(figmaMappingFor('Charts')!.page).toBe('Data Visualization');
  });

  it('Menu lives on the Dropdown page', () => {
    expect(figmaMappingFor('Menu')!.page).toBe('Dropdown');
  });

  it('BottomNavigation lives on NavBar', () => {
    expect(figmaMappingFor('BottomNavigation')!.page).toBe('NavBar');
  });

  it('Progress covers one page for three exports', () => {
    expect(figmaMappingFor('Progress')!.sets).toEqual(['Progress Bar', 'Progress Dial']);
    expect(figmaMappingFor('CircularProgress')).toBeNull();
    expect(figmaMappingFor('LinearProgress')).toBeNull();
  });
});

describe('components made of several sets', () => {
  it('lists the whole thing before its parts', () => {
    /* A reader opening the Tabs doc wants the container first. Ordering is the
       only signal the table carries about which is which. */
    expect(figmaMappingFor('Tabs')!.sets).toEqual(['Tabs', 'Tab']);
    expect(figmaMappingFor('List')!.sets).toEqual(['List', 'List Item']);
    expect(figmaMappingFor('Rating')!.sets[0]).toBe('Rating');
  });

  it('keeps ButtonGroup both segment sets, which are different components', () => {
    const sets = figmaMappingFor('ButtonGroup')!.sets;
    expect(sets).toContain('Button-Group-Segments');
    expect(sets).toContain('Separated-Button-Segments');
  });

  it('allows a mapped page to hold no sets at all', () => {
    /* Typography is a FOUNDATION in Figma and a COMPONENT in code: text styles
       on the page, real exports in the library. An empty `sets` means "styles,
       not components", not "not built yet" — so the page is still worth
       linking, because that is where the type scale lives. */
    expect(figmaMappingFor('Typography')!.sets).toEqual([]);
    expect(REAL_PAGES.has('Typography')).toBe(true);
    expect(REAL_SETS.some(s => s.page === 'Typography')).toBe(false);
  });

  it('leaves ToggleButton unmapped while its design is unsettled', () => {
    /* It has a Figma page but no component set — drawn, not built. Documenting
       a component in flux teaches the wrong thing. */
    expect(figmaMappingFor('ToggleButton')).toBeNull();
    expect(NO_FIGMA_PAGE.deferred).toContain('ToggleButton');
  });

  it('covers the 21 multi-set pages rather than picking one each', () => {
    const multi = [...REAL_PAGES].filter(p => setsOn(p).size > 1);
    const mapped = entries.filter(([, m]) => multi.includes(m.page));
    for (const [component, m] of mapped) {
      expect(m.sets.length, `${component} covers only ${m.sets.length} of ${setsOn(m.page).size}`)
        .toBeGreaterThan(0);
    }
  });
});

describe('unknown components', () => {
  it('returns null rather than throwing, so a caller can say "no Figma page"', () => {
    expect(figmaMappingFor('Autocomplete')).toBeNull();
    expect(figmaMappingFor('NotAComponent')).toBeNull();
  });
});
