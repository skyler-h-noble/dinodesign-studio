import { describe, it, expect } from 'vitest';
import {
  altDisplayGradient, altDisplayWeight, hueDelta, isAnalogous,
  ANALOGOUS_MAX_HUE_DELTA, ALT_DISPLAY_MIN_WEIGHT,
} from '../utils/altDisplay';

describe('the analogous test', () => {
  it('measures the SHORT way round the wheel', () => {
    /* 350 and 10 are 20 apart, not 340. A subtraction without the wrap calls
       every red-to-magenta pair opposite, which is the pair most likely to be
       analogous in a warm brand. */
    expect(Math.round(hueDelta('#ff0033', '#ff0088'))).toBeLessThan(60);
    expect(hueDelta('#ff0000', '#ff0000')).toBe(0);
  });

  it('is symmetric — order cannot change the answer', () => {
    const pairs: [string, string][] = [
      ['#7b2d8e', '#2d6f8e'], ['#ff8800', '#0088ff'], ['#123456', '#654321'],
    ];
    for (const [a, b] of pairs) {
      expect(hueDelta(a, b)).toBeCloseTo(hueDelta(b, a), 6);
    }
  });

  it('never exceeds half the wheel', () => {
    for (const [a, b] of [['#ff0000', '#00ffff'], ['#00ff00', '#ff00ff']] as const) {
      expect(hueDelta(a, b)).toBeLessThanOrEqual(180);
    }
  });
});

describe('which gradient the Alt Display gets', () => {
  it('blends two hues when Primary and Secondary are neighbours', () => {
    /* Purple and blue-violet — the case the rule exists for. */
    const c = altDisplayGradient('#7b2d8e', '#5b2d9e');
    expect(c.kind).toBe('duo');
    expect(c.delta).toBeLessThanOrEqual(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('ramps ONE hue when they are opposites', () => {
    /* Blending across the wheel passes through the desaturated middle, where
       both ends lose contrast at once. A same-hue ramp still gives the brand a
       gradient — the treatment is never denied, only changed. */
    const c = altDisplayGradient('#7b2d8e', '#8e7b2d');
    expect(c.kind).toBe('mono');
    expect(c.delta).toBeGreaterThan(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('treats a grey as distant, not as a perfect match', () => {
    /* chroma gives a true grey a NaN hue. Read as 0 it would be the ONE value
       that switches the gradient on, and a grey-to-purple blend looks like a
       rendering fault rather than a decision. */
    expect(altDisplayGradient('#7b2d8e', '#808080').kind).toBe('mono');
    expect(hueDelta('#808080', '#7b2d8e')).toBe(180);
  });

  it('falls back to the one-hue ramp rather than guessing', () => {
    /* mono needs only ONE hue to be known, so it is the answer that survives a
       missing or unparseable palette. */
    expect(altDisplayGradient(undefined, '#5b2d9e').kind).toBe('mono');
    expect(altDisplayGradient('#7b2d8e', undefined).kind).toBe('mono');
    expect(altDisplayGradient('not-a-colour', '#5b2d9e').kind).toBe('mono');
  });

  it('agrees with isAnalogous', () => {
    /* Two entry points, one threshold. */
    for (const [a, b] of [['#7b2d8e', '#5b2d9e'], ['#7b2d8e', '#8e7b2d'],
                          ['#ff0000', '#00ff00']] as const) {
      expect(altDisplayGradient(a, b).kind === 'duo').toBe(isAnalogous(a, b));
    }
  });
});

describe('the Alt Display weight', () => {
  it('drops to a markedly lighter weight the family actually ships', () => {
    expect(altDisplayWeight(800, [100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(500);
    expect(altDisplayWeight(700, [400, 500, 600, 700, 800, 900])).toBe(400);
  });

  it('returns undefined for a one-weight family', () => {
    /* The COMMON case, not an edge: 56% of the curated display pool ships one
       weight — Anton, Bangers, Lobster, Great Vibes, Alfa Slab One. Returning
       a number here would mean a synthesised thin on the web and a font Figma
       refuses to load. Colour is what distinguishes the Alt; weight only
       sharpens it where the family can. */
    expect(altDisplayWeight(400, [400])).toBeUndefined();
    expect(altDisplayWeight(700, [700])).toBeUndefined();
    expect(altDisplayWeight(400, undefined)).toBeUndefined();
    expect(altDisplayWeight(400, [])).toBeUndefined();
  });

  it('never goes heavier, and never below the legibility floor', () => {
    /* Heavier would read as emphasis, which is the opposite of the intent. */
    expect(altDisplayWeight(300, [300, 400, 500])).toBeUndefined();
    const w = altDisplayWeight(400, [100, 400]);
    expect(w === undefined || w >= ALT_DISPLAY_MIN_WEIGHT).toBe(true);
  });

  it('breaks a tie toward the lighter weight', () => {
    /* 300 either side of the target: the point is to be visibly different, and
       the lighter of two equals is more different. */
    expect(altDisplayWeight(700, [300, 500])).toBe(300);
  });
});
