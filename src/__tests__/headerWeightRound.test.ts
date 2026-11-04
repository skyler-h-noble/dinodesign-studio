/* The Header's weight publishes as a standard weight (100-900). Google serves
   a standard weight as a static instance and an in-between one as the
   variable file: Cocktails' latin file is 61 KB at 600 and 136 KB at 640
   (measured 2026-11-04). */
import { describe, it, expect } from 'vitest';
import { roundHeaderWeight, moodToAxes, MOODS, pinnedHeaderFontQueryParam } from '../utils/moodAxes';
import { resolveRoles } from '../utils/typeScale';

describe('header weight rounds to a standard weight', () => {
  it('rounds to the nearest 100 within 100..900', () => {
    expect(roundHeaderWeight(640)).toBe(600);
    expect(roundHeaderWeight(650)).toBe(700);
    expect(roundHeaderWeight(250)).toBe(300);
    expect(roundHeaderWeight(1000)).toBe(900);
    expect(roundHeaderWeight(1)).toBe(100);
  });

  it('every mood recommends a standard weight', () => {
    for (const m of MOODS) {
      for (const displayWeight of [undefined, 'heavy', 'thin'] as const) {
        expect(moodToAxes(m, { displayWeight }).wght % 100).toBe(0);
      }
    }
  });

  it('a design saved at 640 resolves (preview + CSS) at 600, axis and weight together', () => {
    const roles = resolveRoles([{ type: 'header', family: 'Google Sans Flex', weight: '640', axes: { ...moodToAxes('Modern'), wght: 640 } } as any]);
    expect(roles.header.weight).toBe(600);
    expect(roles.header.axes?.wght).toBe(600);
  });

  it('with one standard weight, the published font request is one static weight', () => {
    const typo = ':root{--Font-Weight-Header: 600; --Header-Clamped-Weight: 600; --H1-Font-Weight: 600; --Font-Optical-Size-Header: 96;}';
    expect(pinnedHeaderFontQueryParam(typo)).toMatch(/,600$/);
  });
});
