import { describe, it, expect } from 'vitest';
import { effectiveBranchAndStyle } from '../components/TypographyTestPage';

/**
 * Formal copperplate vs hand printing, decided on SLANT.
 *
 * Measured across both pools (omni-type-studio, matchtest.html): Great Vibes,
 * Allura, Parisienne, Pinyon Script and Alex Brush land at 20-35 degrees;
 * Caveat, Indie Flower, Patrick Hand, Architects Daughter and Shadows Into
 * Light land at -5 to 20. The cut is 25.
 *
 * Two other signals were tried in this spot first and neither separates the
 * pools — stroke WEIGHT (handwriting often yields too few stems to measure it
 * at all) and CONNECTEDNESS (half the joined faces break into one mark per
 * letter, their hairline connectors falling below the ink threshold). Both are
 * why a marker-lettered cover kept coming back as copperplate.
 */
const region = (o: { slant?: number | null; caps?: boolean; stems?: number }) => ({
  isAllCaps: o.caps ?? false,
  stroke: {
    isLikelyScript: true, isLikelyHand: false,
    weight: 'regular', measurementFailed: false,
    strokeCount: o.stems ?? 1, weightRatio: 0.2,
    hasSerifFeet: false, serifFootRatio: 0,
    slant: o.slant === undefined ? 5 : o.slant,
  },
}) as any;

describe('formal script vs hand printing', () => {
  it('sends near-upright cursive to the hand pool', () => {
    // Busyhead: marker printing, barely any lean.
    const r = effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 5 }));
    expect(r).toEqual({ branch: 'Expressive', style: 'Hand', pixelOverride: true });
  });

  it('keeps steeply leaning cursive on Formal Script', () => {
    const r = effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 30 }));
    expect(r.style).toBe('Formal Script');
  });

  it('treats the cut as 25 degrees', () => {
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 24 })).style).toBe('Hand');
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 26 })).style).toBe('Formal Script');
  });

  it('reads a right lean the same as a left one', () => {
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: -30 })).style)
      .toBe('Formal Script');
  });

  // 'Hand' is the pool key's own suffix, so it matches Expressive / Hand
  // exactly. 'Handwritten / Informal' — which this used to return — matches no
  // pool at all and resolved to Expressive / Display, i.e. block display faces
  // for marker lettering. Once the slant is measured, case is irrelevant.
  it('returns the pool key suffix, and ignores case once slant is known', () => {
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 5, caps: true })).style)
      .toBe('Hand');
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: 5, caps: false })).style)
      .toBe('Hand');
  });

  it('falls back to all-caps only when the slant could not be measured', () => {
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: null, caps: true })).style)
      .toBe('Hand');
    expect(effectiveBranchAndStyle('Display', 'Decorative', region({ slant: null, caps: false })).style)
      .toBe('Formal Script');
  });

  it('still defers to CLIP when CLIP already said a script', () => {
    const r = effectiveBranchAndStyle('Expressive', 'Handwritten Script', region({ slant: 5 }));
    expect(r).toEqual({ branch: 'Expressive', style: 'Handwritten Script', pixelOverride: false });
  });
});
