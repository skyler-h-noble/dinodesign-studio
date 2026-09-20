import { describe, it, expect } from 'vitest';
import { componentSizeGroup, componentSizeFigma, componentSizeNames, componentSizePayload, lineMetricsVars, selectionMetricsVars, SIZE_MODES } from '../utils/componentSize';

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
    accordionRadius: 8, accordionFocusRadius: 11, accordionInnerFocusRadius: 5,
    modalRadius: 32, dropdownFrameRadius: 0,
  };

  it('writes the accordion radii under the CORRECTED spelling', () => {
    /* The file carried "Accordian-Radius" (sic) and this writer deliberately
       matched it, because populateComponentSize is UPDATE-ONLY: it writes by
       name, and a name the file does not have is skipped in silence. The Figma
       rename landed on 2026-09-18, so the misspelling here had to go with it —
       otherwise the writer would have kept looking for a variable that no
       longer exists and quietly stopped updating the value. */
    const p = componentSizePayload(R, {});
    expect(p.medium['Accordion/Accordion-Radius']).toBe(8);
    expect(p.medium['Accordion/Accordian-Radius']).toBeUndefined();
  });

  it('emits the focus radii Figma cannot derive for itself', () => {
    /* CSS needs neither: an outline is drawn concentric with the border
       radius, so the browser works them out. Figma cannot do arithmetic on a
       variable, so both were hand-typed — and would have drifted the moment
       the brand radius moved. 8 + 3 and 8 - 3, matching the lib's
       outlineOffset: -3px. */
    const p = componentSizePayload(R, {});
    expect(p.medium['Accordion/Accordion-Focus-Radius']).toBe(11);
    expect(p.medium['Accordion/Accordion-Inner-Focus-Radius']).toBe(5);
  });

  it('Card focus is Card-Focus-Radius, not Card-Focus-Border-Radius', () => {
    // The flat payload used the longer name; the file does not have it.
    const p = componentSizePayload(R, {});
    expect(p.medium['Card/Card-Focus-Radius']).toBe(19);
    expect(p.medium['Card/Card-Focus-Border-Radius']).toBeUndefined();
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

/* Divider / Step bar / No Count Step live in Component-Size → Other, and the
 * LIB carries the same three numbers as literals (Divider.js SIZE_MAP,
 * Stepper.js connectorThickness and dot). That is one value in two places,
 * three times over — and they were caught disagreeing: the lib's Divider was
 * wearing the STEP BAR's 1/2/4 while the connector sat pinned at 2 for every
 * size. Nothing could detect it because nothing wrote them.
 *
 * These names are the ones IN THE FILE, spaces included. populateComponentSize
 * is UPDATE-ONLY and writes by name, so a "tidier" Step-Bar or NoCountStep
 * would match nothing and silently leave the value at whatever was last typed
 * by hand — which is the failure this whole file exists to avoid.
 */
describe('the Other group writes the line and dot weights', () => {
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
    accordionRadius: 8, accordionFocusRadius: 11, accordionInnerFocusRadius: 5,
    modalRadius: 32, dropdownFrameRadius: 0,
  };

  const payload = () => componentSizePayload(R, {});

  it('carries all three at every size', () => {
    const p = payload() as unknown as Record<string, Record<string, number>>;
    for (const name of ['Other/Divider', 'Other/Step bar', 'Other/No Count Step']) {
      for (const mode of ['small', 'medium', 'large'] as const) {
        expect(`${mode} ${name}: ${typeof p[mode][name]}`)
          .toBe(`${mode} ${name}: number`);
      }
    }
  });

  it('matches the ramps the lib renders', () => {
    const p = payload() as unknown as Record<string, Record<string, number>>;
    expect([p.small['Other/Divider'], p.medium['Other/Divider'], p.large['Other/Divider']])
      .toEqual([0.5, 1, 2]);
    expect([p.small['Other/Step bar'], p.medium['Other/Step bar'], p.large['Other/Step bar']])
      .toEqual([1, 2, 4]);
    expect([p.small['Other/No Count Step'], p.medium['Other/No Count Step'], p.large['Other/No Count Step']])
      .toEqual([8, 12, 16]);
  });

  it('and the two ramps are not swapped', () => {
    /* The specific mistake that was shipped: Divider wearing the step bar's
       weights. They must differ at small and large. */
    const p = payload() as unknown as Record<string, Record<string, number>>;
    expect(p.small['Other/Divider']).not.toBe(p.small['Other/Step bar']);
    expect(p.large['Other/Divider']).not.toBe(p.large['Other/Step bar']);
  });
});

const R2 = {
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
    accordionRadius: 8, accordionFocusRadius: 11, accordionInnerFocusRadius: 5,
    modalRadius: 32, dropdownFrameRadius: 0,
  };

/* The line weights have to reach BOTH sides.
 *
 * The lib reads --Divider / --Step-Bar / --No-Count-Step by name (Divider.js
 * SIZE_MAP, Stepper.js connectorThickness and dot) with the design's numbers
 * as fallbacks. If nothing emits them the fallback paints forever and the
 * brand cannot move the weight — which looks identical to working.
 *
 * Preview and export are separate implementations and have diverged before
 * while both looked self-consistent (invariant 5), so they read one table.
 * This asserts the table, the CSS spelling, and that a Figma name carrying
 * SPACES does not leak into a custom property.
 */
describe('the line weights emit as CSS custom properties', () => {
  it('names them the way the lib reads them', () => {
    expect(Object.keys(lineMetricsVars()).sort()).toEqual([
      '--Divider', '--Lg-Divider', '--Lg-No-Count-Step', '--Lg-Step-Bar',
      '--No-Count-Step', '--Sm-Divider', '--Sm-No-Count-Step', '--Sm-Step-Bar',
      '--Step-Bar',
    ]);
  });

  it('carries the design ramps, with units', () => {
    const v = lineMetricsVars();
    expect([v['--Sm-Divider'], v['--Divider'], v['--Lg-Divider']])
      .toEqual(['0.5px', '1px', '2px']);
    expect([v['--Sm-Step-Bar'], v['--Step-Bar'], v['--Lg-Step-Bar']])
      .toEqual(['1px', '2px', '4px']);
    expect([v['--Sm-No-Count-Step'], v['--No-Count-Step'], v['--Lg-No-Count-Step']])
      .toEqual(['8px', '12px', '16px']);
  });

  it('never emits a property name containing a space', () => {
    /* The Figma variables are "Step bar" and "No Count Step". A custom
       property with a space in it is invalid and silently dropped, so a
       derivation that just prefixed the Figma name would produce tokens that
       never resolve and a fallback that never stops painting. */
    for (const name of Object.keys(lineMetricsVars())) {
      expect(`${name} has a space: ${name.includes(' ')}`).toBe(`${name} has a space: false`);
    }
  });

  it('matches the values written to Figma', () => {
    /* Same numbers on both routes — the Figma payload and the stylesheet. If
       these ever disagree, one of the two is lying about the design. */
    const p = componentSizePayload(R2, {}) as unknown as Record<string, Record<string, number>>;
    const v = lineMetricsVars();
    const pairs: Array<[string, string]> = [
      ['Other/Divider', 'Divider'],
      ['Other/Step bar', 'Step-Bar'],
      ['Other/No Count Step', 'No-Count-Step'],
    ];
    for (const [figma, css] of pairs) {
      expect(`${css} small`).toBe(`${css} small`);
      expect(v[`--Sm-${css}`]).toBe(`${p.small[figma]}px`);
      expect(v[`--${css}`]).toBe(`${p.medium[figma]}px`);
      expect(v[`--Lg-${css}`]).toBe(`${p.large[figma]}px`);
    }
  });
});

/* Radio and Checkbox. The writer is UPDATE-ONLY and matches by name, so these
 * names have to be the ones in the file — a group Figma does not have is not
 * an error, it is a silent no-op, and the value stays at whatever was last
 * typed by hand while the run reports success.
 */
describe('the Radio and Checkbox groups', () => {
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
    accordionRadius: 8, accordionFocusRadius: 11, accordionInnerFocusRadius: 5,
    modalRadius: 32, dropdownFrameRadius: 0,
  };

  it('writes the ramps under the component group names', () => {
    const p = componentSizePayload(R, {});
    expect(p.small['Radio/Radio-Size']).toBe(16);
    expect(p.medium['Radio/Radio-Size']).toBe(20);
    expect(p.large['Radio/Radio-Size']).toBe(24);
    expect(p.small['Radio/Radio-Dot']).toBe(8);
    expect(p.large['Radio/Radio-Dot']).toBe(9.5);
    expect(p.small['Checkbox/Checkbox-Icon']).toBe(12);
    expect(p.large['Checkbox/Checkbox-Icon']).toBe(18);
  });

  it('gives the two controls the same box and gap at every size', () => {
    /* One literal, two names. Checkbox shipped a 6/8/10 gap against Radio's
       4/8/12 for as long as both were hand-typed. */
    const p = componentSizePayload(R, {});
    for (const mode of SIZE_MODES) {
      expect(p[mode]['Radio/Radio-Size']).toBe(p[mode]['Checkbox/Checkbox-Size']);
      expect(p[mode]['Radio/Radio-Gap']).toBe(p[mode]['Checkbox/Checkbox-Gap']);
    }
  });

  it('puts the touch target in Other, at one value for all three modes', () => {
    const p = componentSizePayload(R, {});
    for (const mode of SIZE_MODES) expect(p[mode]['Other/Touch-Target']).toBe(24);
  });

  it('Figma and CSS carry the same numbers', () => {
    /* Invariant 5 in its narrowest form: the payload and the stylesheet are
       two emitters reading one table, and this is the assertion that they did
       not each read it their own way. */
    const p = componentSizePayload(R, {});
    const css = selectionMetricsVars();
    const pairs: [string, string][] = [
      ['Radio/Radio-Size', 'Radio-Size'], ['Radio/Radio-Dot', 'Radio-Dot'],
      ['Radio/Radio-Gap', 'Radio-Gap'], ['Checkbox/Checkbox-Size', 'Checkbox-Size'],
      ['Checkbox/Checkbox-Icon', 'Checkbox-Icon'], ['Checkbox/Checkbox-Gap', 'Checkbox-Gap'],
    ];
    for (const [figma, base] of pairs) {
      expect(`${base} sm ${css[`--Sm-${base}`]}`).toBe(`${base} sm ${p.small[figma]}px`);
      expect(`${base} md ${css[`--${base}`]}`).toBe(`${base} md ${p.medium[figma]}px`);
      expect(`${base} lg ${css[`--Lg-${base}`]}`).toBe(`${base} lg ${p.large[figma]}px`);
    }
  });

  it('every mode still carries the same names', () => {
    const p = componentSizePayload(R, {});
    const keys = SIZE_MODES.map((m) => Object.keys(p[m]).sort().join('|'));
    expect(new Set(keys).size).toBe(1);
  });
});
