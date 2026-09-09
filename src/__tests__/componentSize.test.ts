import { describe, it, expect } from 'vitest';
import { componentSizeGroup, componentSizeFigma, componentSizeNames, componentSizePayload, SIZE_MODES } from '../utils/componentSize';

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

describe('the payload uses the names that are IN THE FILE', () => {
  /* A "correct" name that matches nothing silently leaves the variable at
     whatever was last typed by hand — which is how a Button-Focus-Radius of
     3125 stood where the rule gives 31. Matching the file is the entire job. */
  const R = {
    buttonRadius: 32, smButtonRadius: 12, lgButtonRadius: 28,
    buttonInnerRadius: 31, smButtonInnerRadius: 11, lgButtonInnerRadius: 27,
    buttonFocusRadius: 35, smButtonFocusRadius: 15, lgButtonFocusRadius: 31,
    iconButtonRadius: 32, smIconButtonRadius: 32, lgIconButtonRadius: 32,
    iconButtonFocusRadius: 35, smIconButtonFocusRadius: 35, lgIconButtonFocusRadius: 35,
    cardRadius: 16, smCardRadius: 8, lgCardRadius: 24,
    cardInnerRadius: 15, smCardInnerRadius: 7, lgCardInnerRadius: 23,
    cardFocusRadius: 19, cardPadding: 16,
    inputRadius: 4, smInputRadius: 4, lgInputRadius: 4,
    inputFocusRadius: 7, inputInnerRadius: 2,
    accordionRadius: 8, modalRadius: 32, dropdownFrameRadius: 0,
  };

  it('Card focus is Card-Focus-Radius, not Card-Focus-Border-Radius', () => {
    // The flat payload used the longer name; the file does not have it.
    const p = componentSizePayload(R, {});
    expect(p.medium['Card/Card-Focus-Radius']).toBe(19);
    expect(p.medium['Card/Card-Focus-Border-Radius']).toBeUndefined();
  });

  it('Accordion keeps the file typo, Accordian', () => {
    /* Deliberate. Renaming the Figma variable to fix the spelling would
       unbind every layer using it, so that rename is a decision to make in
       Figma — not one to force from here by writing a name that matches
       nothing. The GROUP is spelt correctly; only the variable carries it. */
    const p = componentSizePayload(R, {});
    expect(p.medium['Accordion/Accordian-Radius']).toBe(8);
    expect(p.medium['Accordion/Accordion-Radius']).toBeUndefined();
  });

  it('computes the focus radius rather than trusting the file', () => {
    // r + 3. The file had 3125 at large where this gives 31 — a hand-typed
    // value that no import would have corrected while nothing wrote to it.
    const p = componentSizePayload(R, {});
    expect(p.large['Button/Button-Focus-Radius']).toBe(31);
    expect(p.large['Button/Button-Radius']).toBe(28);
  });

  it('every mode carries the same names', () => {
    const p = componentSizePayload(R, {});
    const keys = (['medium', 'small', 'large'] as const).map((m) => Object.keys(p[m]).sort().join('|'));
    expect(new Set(keys).size).toBe(1);
  });
});
