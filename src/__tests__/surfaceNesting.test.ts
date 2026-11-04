/**
 * A Surface nested inside a themed section takes that theme's Surface.
 *
 * Each theme's Surface rule matched only the same-element form
 * ([data-theme="X"][data-surface="Surface"]), while Dim / Dimmest / Bright /
 * Brightest also matched the descendant form. So
 *   <section data-theme="Primary"><div data-surface="Surface">
 * fell through to the bare Default rule and painted the PAGE's Surface:
 * every theme's nested Surface was one page color (found 2026-11-03 reading
 * the dark ladder through cssCascade).
 */
import { describe, it, expect } from 'vitest';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import { buildSystem, quietly, BACKGROUNDS } from './__fixtures__/renderedSystem';

const root: CascadeElement = { attrs: {}, root: true };
const { files } = quietly(() => buildSystem(['#b771c6', '#00a8cc', '#d565a0'],
  { background: BACKGROUNDS.find((b) => b.startsWith('Neutral')) ?? BACKGROUNDS[0], button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never));

describe.each(['Light', 'Dark'] as const)('%s mode', (mode) => {
  const c = new Cascade(orderSheets(files, mode));
  const bg = (el: CascadeElement) => c.computed(el)['--Background'];
  for (const theme of ['Primary', 'Secondary', 'Tertiary']) {
    it(`${theme}: nested Surface equals the theme's own Surface, not the page's`, () => {
      const section: CascadeElement = { attrs: { 'data-theme': theme }, parent: root };
      const nested = bg({ attrs: { 'data-surface': 'Surface' }, parent: section });
      const sameElement = bg({ attrs: { 'data-theme': theme, 'data-surface': 'Surface' }, parent: root });
      const page = bg({ attrs: { 'data-surface': 'Surface' }, parent: root });
      expect(nested).toBe(sameElement);
      expect(nested).not.toBe(page);
    });
  }
});

/* An element with its OWN data-theme inside another theme's section takes its
   own theme. The descendant form ([data-theme="Secondary"] [data-surface=…])
   used to match it too, at the same specificity as its same-element rule, so
   whichever theme came later in the file won: a Primary Surface-Brightest
   block in a Secondary band painted Secondary (found 2026-11-04 on a
   clean-room store). The descendant forms now carry :not([data-theme]). */
describe.each(['Light', 'Dark'] as const)('%s mode · a themed element inside another theme', (mode) => {
  const c = new Cascade(orderSheets(files, mode));
  const bg = (el: CascadeElement) => c.computed(el)['--Background'];
  const pairs = [['Secondary', 'Primary'], ['Primary', 'Secondary'], ['Tertiary', 'Primary'], ['Primary', 'Neutral']];
  for (const [outer, inner] of pairs) {
    for (const surface of ['Surface', 'Surface-Bright', 'Surface-Brightest', 'Container', 'Container-High']) {
      it(`${inner} ${surface} inside a ${outer} section paints ${inner}`, () => {
        const section: CascadeElement = { attrs: { 'data-theme': outer, 'data-surface': 'Surface' }, parent: root };
        const nested = bg({ attrs: { 'data-theme': inner, 'data-surface': surface }, parent: section });
        const alone = bg({ attrs: { 'data-theme': inner, 'data-surface': surface }, parent: root });
        expect(nested).toBe(alone);
      });
    }
  }
});
