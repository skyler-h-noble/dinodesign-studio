import { describe, it, expect } from 'vitest';
import { computeRadii } from '../utils/componentRadii';

const base = {
  buttonRadius: 20, iconButtonRadius: 50, inputRadius: 20,
  cardPadding: 16, buttonHeight: 44, smallButtonHeight: 32, largeButtonHeight: 56,
};

describe('Dropdown-Frame-Radius', () => {
  it('follows the input at ordinary radii', () => {
    const r = computeRadii({ ...base, inputRadius: 18 });
    expect(r.dropdownFrameRadius).toBe(r.inputRadius);
    expect(r.dropdownFrameRadius).toBeLessThanOrEqual(16);
  });

  it('never exceeds 16px, however round the input is', () => {
    // A pill input: 50% of a 44px field = 22px, well over the ceiling.
    const r = computeRadii({ ...base, inputRadius: 50 });
    expect(r.inputRadius).toBeGreaterThan(16);
    expect(r.dropdownFrameRadius).toBe(16);
  });

  it('is never rounder than a card', () => {
    // Square-ish cards with a round input: the card is the binding constraint,
    // so a floating panel does not out-round the surfaces beneath it.
    const r = computeRadii({ ...base, buttonRadius: 5, inputRadius: 50, cardPadding: 0 });
    expect(r.dropdownFrameRadius).toBeLessThanOrEqual(r.cardRadius);
  });

  it('goes square when the system is square', () => {
    const r = computeRadii({ ...base, buttonRadius: 0, inputRadius: 0, cardPadding: 0 });
    expect(r.dropdownFrameRadius).toBe(0);
  });

  it('is always the min of its three bounds', () => {
    for (const inputRadius of [0, 10, 25, 50, 100]) {
      for (const cardPadding of [0, 8, 24]) {
        for (const buttonRadius of [0, 20, 50]) {
          const r = computeRadii({ ...base, inputRadius, cardPadding, buttonRadius });
          expect(r.dropdownFrameRadius).toBe(Math.min(r.inputRadius, r.cardRadius, 16));
        }
      }
    }
  });
});
