import { describe, it, expect } from 'vitest';
import { componentSizeGroup, componentSizeFigma, componentSizeNames, SIZE_MODES } from '../utils/componentSize';

/* Component-Size carries medium/small/large as MODES, so one library component
   needs one variant and the size switches the mode. The payload has always
   held the same numbers as flat Sm-/Lg- triples, because the old Components
   collection had a single mode and the size had to live in the name.

   This regroups; it must never recompute. A second implementation of the
   sizing rules would drift from the CSS, which is the failure this codebase
   keeps hitting. */

const BUTTON = {
  'Button-Height': 32, 'Sm-Button-Height': 24, 'Lg-Button-Height': 56,
  'Button-Radius': 32, 'Sm-Button-Radius': 12, 'Lg-Button-Radius': 28,
  'Button-Border-Width': 1,                       // no size siblings
};

describe('the numbers survive regrouping', () => {
  it('puts each triple on its own mode', () => {
    const g = componentSizeGroup('Button', BUTTON);
    expect(g.medium['Button/Button-Height']).toBe(32);
    expect(g.small['Button/Button-Height']).toBe(24);
    expect(g.large['Button/Button-Height']).toBe(56);
  });

  it('changes no value, only where it sits', () => {
    // Every number in must appear somewhere out. Regrouping that alters a
    // value is a sizing change disguised as a refactor.
    const g = componentSizeGroup('Button', BUTTON);
    const out = SIZE_MODES.flatMap((m) => Object.values(g[m]));
    for (const v of Object.values(BUTTON)) expect(out).toContain(v);
  });

  it('names are grouped, and carry no collection prefix', () => {
    /* Figma renders "/" as a group and the plugin indexes by the full name.
       The collection is not part of it — the mistake that made the first
       add-on import bind nothing. */
    const names = componentSizeNames(componentSizeGroup('Button', BUTTON));
    expect(names).toContain('Button/Button-Height');
    expect(names.filter((n) => n.startsWith('Component-Size/'))).toEqual([]);
  });
});

describe('a metric with no size siblings', () => {
  it('is repeated across all three modes rather than dropped', () => {
    /* A variable with no value in a mode resolves to nothing at that size,
       which is worse than one that is simply equal everywhere. */
    const g = componentSizeGroup('Button', BUTTON);
    for (const mode of SIZE_MODES) {
      expect(g[mode]['Button/Button-Border-Width'], mode).toBe(1);
    }
  });

  it('leaves every mode holding the same key set', () => {
    const g = componentSizeGroup('Button', BUTTON);
    const keys = SIZE_MODES.map((m) => Object.keys(g[m]).sort().join('|'));
    expect(new Set(keys).size).toBe(1);
  });
});

describe('prefixes are not mistaken for metrics', () => {
  it('emits one variable per base name, not three', () => {
    // Sm-/Lg- are the SAME metric at another size. Treating them as separate
    // names is what the mode structure exists to stop.
    const names = componentSizeNames(componentSizeGroup('Button', BUTTON));
    expect(names.filter((n) => n.includes('/Sm-') || n.includes('/Lg-'))).toEqual([]);
    expect(names).toEqual([
      'Button/Button-Border-Width',
      'Button/Button-Height',
      'Button/Button-Radius',
    ]);
  });
});

describe('several groups merge into one payload', () => {
  it('keeps each group in its own namespace', () => {
    const p = componentSizeFigma({
      Button: { 'Button-Height': 32, 'Sm-Button-Height': 24 },
      Card: { 'Card-Radius': 8 },
    });
    expect(p.medium['Button/Button-Height']).toBe(32);
    expect(p.small['Button/Button-Height']).toBe(24);
    expect(p.medium['Card/Card-Radius']).toBe(8);
    expect(p.small['Card/Card-Radius']).toBe(8);
  });
});
