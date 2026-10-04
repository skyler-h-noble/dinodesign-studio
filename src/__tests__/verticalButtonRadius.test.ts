/**
 * Vertical-Button-Radius is half the button's radius, per writer.
 *
 * A vertical button group rounds the top of its first segment and the bottom
 * of its last, and those corners take HALF the button's corner: the full
 * radius is drawn for a control as wide as a button is, and on the short edge
 * of a stacked segment it reads as a pill cap.
 *
 * The trap is that "the button's radius" is not one number. Four writers emit
 * it and two of them CAP it:
 *
 *   componentSize.ts        Figma payload   uncapped
 *   generateDesignSystem.ts downloaded CSS  uncapped
 *   exportToCSS.ts          export bundle   capped at the large button height
 *   buildPreviewCSS.ts      preview         capped at the large button height
 *
 * So taking the half from the computed radii everywhere would make a
 * pill-radius brand draw a vertical cap of half an uncapped number beside a
 * button that had been capped — and they would disagree by more the rounder
 * the brand got, which is the direction nobody checks. Each writer halves
 * what IT emits.
 *
 * This is invariant 5 in its usual shape: one value, several implementations,
 * and nothing in the type system coupling them.
 */
import { describe, it, expect } from 'vitest';
import { computeRadii } from '../utils/componentRadii';

/* `buttonRadius` is a PERCENT (0-100) of the button's height, not a pixel
   value — the heights are what turn it into one. A fixture passing pixels
   produced NaN, which is the useful kind of wrong: it fails loudly rather
   than computing a plausible number from the wrong units. */
const radiiFor = (pct: number) => computeRadii({
  buttonRadius: pct,
  iconButtonRadius: pct,
  inputRadius: pct,
  cardPadding: 16,
  buttonHeight: 48,
  smallButtonHeight: 32,
  largeButtonHeight: 64,
});

describe('the computed value', () => {
  it('is half the button radius, rounded', () => {
    for (const sr of [0, 5, 10, 25, 50, 75, 100]) {
      const r = radiiFor(sr);
      expect(`${sr}: ${r.verticalButtonRadius}`)
        .toBe(`${sr}: ${Math.round(r.buttonRadius / 2)}`);
      expect(`${sr}sm: ${r.smVerticalButtonRadius}`)
        .toBe(`${sr}sm: ${Math.round(r.smButtonRadius / 2)}`);
      expect(`${sr}lg: ${r.lgVerticalButtonRadius}`)
        .toBe(`${sr}lg: ${Math.round(r.lgButtonRadius / 2)}`);
    }
  });

  /* The ring is +3 on the HALVED corner, not half of the focus radius. The
     ring tracks the corner it surrounds, so halving first and re-deriving is
     the only order that keeps the 3px gap even. Half of buttonFocusRadius
     would give a different number and a gap that narrows as the corner grows. */
  it('derives the focus ring from the halved corner, not from the focus radius', () => {
    for (const sr of [0, 10, 25, 50, 100]) {
      const r = radiiFor(sr);
      expect(r.verticalButtonFocusRadius).toBe(r.verticalButtonRadius + 3);
      expect(r.smVerticalButtonFocusRadius).toBe(r.smVerticalButtonRadius + 3);
      expect(r.lgVerticalButtonFocusRadius).toBe(r.lgVerticalButtonRadius + 3);
    }
  });

  it('keeps the ring outside the corner at every radius', () => {
    for (const sr of [0, 1, 5, 10, 20, 25, 40, 50, 75, 90, 100]) {
      const r = radiiFor(sr);
      expect(r.verticalButtonFocusRadius).toBeGreaterThan(r.verticalButtonRadius);
    }
  });

  /* Never rounder than the button it caps. A vertical end cap at MORE than
     the button's own corner would bulge past the group's outline. */
  it('is never larger than the button radius it halves', () => {
    for (const sr of [0, 5, 15, 33, 50, 80, 100]) {
      const r = radiiFor(sr);
      expect(r.verticalButtonRadius).toBeLessThanOrEqual(r.buttonRadius);
      expect(r.smVerticalButtonRadius).toBeLessThanOrEqual(r.smButtonRadius);
      expect(r.lgVerticalButtonRadius).toBeLessThanOrEqual(r.lgButtonRadius);
    }
  });

  it('is zero when the brand asks for square corners', () => {
    const r = radiiFor(0);
    expect(r.buttonRadius).toBe(0);
    expect(r.verticalButtonRadius).toBe(0);
    /* The RING still stands off, because a focus indicator on a square
       corner is still a focus indicator. */
    expect(r.verticalButtonFocusRadius).toBe(3);
  });
});

describe('every writer emits it', () => {
  /* A source check: the four writers have no shared type coupling them, so a
     new one (or a deleted line) is otherwise silent. */
  const fs = require('fs');
  const path = require('path');
  const read = (f: string) =>
    fs.readFileSync(path.join(__dirname, '..', 'utils', f), 'utf8');

  it.each([
    ['componentSize.ts', "'Vertical-Button-Radius'"],
    ['componentSize.ts', "'Vertical-Button-Focus-Radius'"],
    ['generateDesignSystem.ts', '--Vertical-Button-Radius'],
    ['generateDesignSystem.ts', '--Vertical-Button-Focus-Radius'],
    ['cssgen/exportToCSS.ts', '--Vertical-Button-Radius'],
    ['cssgen/exportToCSS.ts', '--Vertical-Button-Focus-Radius'],
    ['buildPreviewCSS.ts', '--Vertical-Button-Radius'],
    ['buildPreviewCSS.ts', '--Vertical-Button-Focus-Radius'],
  ])('%s emits %s', (file, token) => {
    expect(read(file)).toContain(token);
  });

  it.each([
    ['componentSize.ts', "'Sm-Vertical-Button-Radius'", "'Lg-Vertical-Button-Radius'"],
    ['generateDesignSystem.ts', '--Sm-Vertical-Button-Radius', '--Lg-Vertical-Button-Radius'],
    ['cssgen/exportToCSS.ts', '--Sm-Vertical-Button-Radius', '--Lg-Vertical-Button-Radius'],
    ['buildPreviewCSS.ts', '--Sm-Vertical-Button-Radius', '--Lg-Vertical-Button-Radius'],
  ])('%s covers all three sizes', (file, sm, lg) => {
    const src = read(file);
    expect(src).toContain(sm);
    expect(src).toContain(lg);
  });

  /* The two CAPPING writers must halve the capped value. Asserted on the
     source because the cap is computed inline from brand input the test
     cannot easily reproduce — what is being pinned is that neither reaches
     for `r.verticalButtonRadius`, which would be half the UNCAPPED number. */
  it.each(['cssgen/exportToCSS.ts', 'buildPreviewCSS.ts'])(
    '%s halves its capped radius rather than the authored one', (file) => {
      const src = read(file);
      const block = src.slice(src.indexOf('--Vertical-Button-Radius') - 400,
                              src.indexOf('--Lg-Vertical-Button-Focus-Radius') + 120);
      expect(block).toMatch(/capped/i);
      expect(block).not.toContain('r.verticalButtonRadius');
    });
});
