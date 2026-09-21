import { describe, it, expect } from 'vitest';
import {
  altDisplayColor, hueDelta, isAnalogous, ANALOGOUS_MAX_HUE_DELTA,
} from '../utils/altDisplayColor';

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

describe('the Alt Display colour', () => {
  it('gradients when Primary and Secondary are neighbours', () => {
    /* Purple and blue-violet — the case the rule exists for. */
    const c = altDisplayColor('#7b2d8e', '#5b2d9e');
    expect(c.kind).toBe('gradient');
    expect(c.delta).toBeLessThanOrEqual(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('goes solid when they are opposites', () => {
    /* Blending across the wheel passes through the desaturated middle, where
       both ends lose contrast at once. */
    const c = altDisplayColor('#7b2d8e', '#8e7b2d');
    expect(c.kind).toBe('solid');
    expect(c.delta).toBeGreaterThan(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('treats a grey as distant, not as a perfect match', () => {
    /* chroma gives a true grey a NaN hue. Read as 0 it would be the ONE value
       that switches the gradient on, and a grey-to-purple blend looks like a
       rendering fault rather than a decision. */
    expect(altDisplayColor('#7b2d8e', '#808080').kind).toBe('solid');
    expect(hueDelta('#808080', '#7b2d8e')).toBe(180);
  });

  it('falls back to solid rather than guessing', () => {
    /* A gradient's contrast varies along the text and has to clear 4.5:1 at
       BOTH ends; a solid has one known value. So an unanswerable question
       resolves to the treatment that can be checked. */
    expect(altDisplayColor(undefined, '#5b2d9e').kind).toBe('solid');
    expect(altDisplayColor('#7b2d8e', undefined).kind).toBe('solid');
    expect(altDisplayColor('not-a-colour', '#5b2d9e').kind).toBe('solid');
  });

  it('agrees with isAnalogous', () => {
    /* Two entry points, one threshold. */
    for (const [a, b] of [['#7b2d8e', '#5b2d9e'], ['#7b2d8e', '#8e7b2d'],
                          ['#ff0000', '#00ff00']] as const) {
      expect(altDisplayColor(a, b).kind === 'gradient').toBe(isAnalogous(a, b));
    }
  });
});
