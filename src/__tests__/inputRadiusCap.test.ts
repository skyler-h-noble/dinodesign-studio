/**
 * An input never gets as round as a button can.
 *
 * The radius is a PERCENT of the control's height, so at the round end of the
 * scale a button becomes a pill — a shape a button carries and a text field
 * cannot. A pill-shaped field pushes its own text away from the leading edge,
 * and the taller the field the worse it gets: the corner grows with the
 * height while the text stays put.
 *
 * 16px, and the number is not new. --Dropdown-Frame-Radius has capped there
 * since it was written, on the reasoning that a panel opening from an input
 * must not be rounder than the input. Capping the input at the same place
 * makes that rule hold from both ends rather than only the panel's.
 *
 * Capped at SOURCE rather than at the writers, which is the lesson
 * --Button-Radius already paid for: it is capped in exportToCSS and
 * buildPreviewCSS and not in the Figma payload or generateDesignSystem, so
 * "the button's radius" is two different numbers depending which file you
 * ask. One cap here, applied once, and every writer carries the same value.
 */
import { describe, it, expect } from 'vitest';
import { computeRadii, INPUT_RADIUS_MAX } from '../utils/componentRadii';

const radiiFor = (inputPct: number, heights = {}) => computeRadii({
  buttonRadius: 100,
  iconButtonRadius: 100,
  inputRadius: inputPct,
  cardPadding: 16,
  buttonHeight: 48,
  smallButtonHeight: 32,
  largeButtonHeight: 64,
  ...heights,
});

describe('the cap', () => {
  it('is 16', () => {
    expect(INPUT_RADIUS_MAX).toBe(16);
  });

  it('holds at every percent, for all three sizes', () => {
    for (const pct of [0, 10, 25, 33, 50, 75, 90, 100]) {
      const r = radiiFor(pct);
      expect(`${pct}%: ${r.inputRadius}`).toBe(`${pct}%: ${Math.min(r.inputRadius, 16)}`);
      expect(r.inputRadius).toBeLessThanOrEqual(INPUT_RADIUS_MAX);
      expect(r.smInputRadius).toBeLessThanOrEqual(INPUT_RADIUS_MAX);
      expect(r.lgInputRadius).toBeLessThanOrEqual(INPUT_RADIUS_MAX);
    }
  });

  /* The cap must not become a floor. Below it the value still tracks the
     percent, or the control would do nothing until it hit the ceiling. */
  it('leaves everything below it alone', () => {
    const r = radiiFor(10);                       // 10% of 48 = 5
    expect(r.inputRadius).toBe(5);
    expect(r.inputRadius).toBeLessThan(INPUT_RADIUS_MAX);
  });

  it('still moves with the percent below the cap', () => {
    const seen = [5, 10, 20, 25].map((p) => radiiFor(p).inputRadius);
    /* Strictly increasing until it clamps — a cap applied too early would
       flatten the usable part of the range. */
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  it('caps a tall field, which is where a percent bites hardest', () => {
    /* 100% of a 64px field is 32 — twice the cap. The taller the control, the
       more the percent model overshoots, which is the case the cap is for. */
    const r = radiiFor(100, { buttonHeight: 64, largeButtonHeight: 96 });
    expect(r.inputRadius).toBe(INPUT_RADIUS_MAX);
    expect(r.lgInputRadius).toBe(INPUT_RADIUS_MAX);
  });

  it('does not touch the BUTTON, which is allowed to be a pill', () => {
    const r = radiiFor(100);
    expect(r.buttonRadius).toBeGreaterThan(INPUT_RADIUS_MAX);
  });
});

describe('the focus ring follows the corner', () => {
  /* The ring is the corner +3, so capping the corner has to move the ring
     with it or the gap opens as the cap bites. Capping at SOURCE is what
     makes this automatic: focus() reads the already-capped value, so there is
     no second place to remember. */
  it('is derived from the CAPPED corner, not the one the percent asked for', () => {
    const r = radiiFor(100);
    expect(r.inputRadius).toBe(INPUT_RADIUS_MAX);
    expect(r.inputFocusRadius).toBe(INPUT_RADIUS_MAX + 3);
  });

  it('keeps an even 3px gap at every percent and size', () => {
    for (const pct of [0, 10, 25, 50, 100]) {
      const r = radiiFor(pct);
      expect(r.inputFocusRadius).toBe(r.inputRadius + 3);
      expect(r.smInputFocusRadius).toBe(r.smInputRadius + 3);
      expect(r.lgInputFocusRadius).toBe(r.lgInputRadius + 3);
    }
  });

  /* There was ONE focus radius against THREE input radii, so the ring matched
     the medium field and was wrong on the other two. Below the cap the three
     corners differ, which is exactly where a single ring showed. */
  it('differs per size where the corners do', () => {
    const r = radiiFor(10, { buttonHeight: 48, smallButtonHeight: 32, largeButtonHeight: 64 });
    expect(new Set([r.smInputRadius, r.inputRadius, r.lgInputRadius]).size)
      .toBeGreaterThan(1);
    expect(new Set([r.smInputFocusRadius, r.inputFocusRadius, r.lgInputFocusRadius]).size)
      .toBeGreaterThan(1);
  });

  it('converges once the cap binds all three', () => {
    const r = radiiFor(100);
    expect([r.smInputRadius, r.inputRadius, r.lgInputRadius])
      .toEqual([INPUT_RADIUS_MAX, INPUT_RADIUS_MAX, INPUT_RADIUS_MAX]);
    expect([r.smInputFocusRadius, r.inputFocusRadius, r.lgInputFocusRadius])
      .toEqual([19, 19, 19]);
  });
});

describe('every writer emits the focus radius', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (f: string) =>
    fs.readFileSync(path.join(__dirname, '..', 'utils', f), 'utf8');

  /* Four writers, no shared type coupling them. The preview emitted NO focus
     radius at all before this — three input radii and not one ring to go
     round them — which is invariant 5 in its quiet form: not two sides
     disagreeing, but one side silent. */
  it.each([
    ['componentSize.ts', "'Input-Focus-Radius'"],
    ['componentSize.ts', "'Sm-Input-Focus-Radius'"],
    ['componentSize.ts', "'Lg-Input-Focus-Radius'"],
    ['generateDesignSystem.ts', '--Input-Focus-Radius'],
    ['generateDesignSystem.ts', '--Sm-Input-Focus-Radius'],
    ['generateDesignSystem.ts', '--Lg-Input-Focus-Radius'],
    ['cssgen/exportToCSS.ts', '--Input-Focus-Radius'],
    ['cssgen/exportToCSS.ts', '--Sm-Input-Focus-Radius'],
    ['cssgen/exportToCSS.ts', '--Lg-Input-Focus-Radius'],
    ['buildPreviewCSS.ts', '--Input-Focus-Radius'],
    ['buildPreviewCSS.ts', '--Sm-Input-Focus-Radius'],
    ['buildPreviewCSS.ts', '--Lg-Input-Focus-Radius'],
  ])('%s emits %s', (file, token) => {
    expect(read(file)).toContain(token);
  });
});

describe('the dropdown rule it completes', () => {
  /* --Dropdown-Frame-Radius is min(Input-Radius, Card-Radius, 16). With the
     input capped at the same 16, the panel can never be rounder than the
     field it opens from at either end of the scale. */
  it('never leaves the frame rounder than the input', () => {
    for (const pct of [0, 25, 50, 100]) {
      const r = radiiFor(pct);
      expect(r.dropdownFrameRadius).toBeLessThanOrEqual(r.inputRadius);
    }
  });
});
