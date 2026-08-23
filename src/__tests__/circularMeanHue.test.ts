import { describe, it, expect } from 'vitest';
import { circularMeanHue } from '../utils/imageAnalysis';

const near = (a: number, b: number, tol = 0.02) =>
  Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) < tol;

describe('circularMeanHue', () => {
  it('averages two reds to red, not cyan', () => {
    // The regression: the arithmetic mean of 0.02 and 0.98 is 0.50 — cyan,
    // the opposite colour. Both inputs are red; the mean must be red.
    const m = circularMeanHue([0.02, 0.98]);
    expect(near(m, 0)).toBe(true);
  });

  it('handles the wrap in either direction', () => {
    expect(near(circularMeanHue([0.95, 0.05]), 0)).toBe(true);
    expect(near(circularMeanHue([0.90, 0.10]), 0)).toBe(true);
  });

  it('matches the arithmetic mean when hues do not wrap', () => {
    // No wrap involved, so the two statistics should agree.
    const hues = [0.30, 0.34, 0.38];
    expect(near(circularMeanHue(hues), 0.34)).toBe(true);
  });

  it('reports no mean for an evenly spread rainbow', () => {
    // Eight hues spread around the wheel cancel out. There is no meaningful
    // average direction, and inventing one is what produced "green" for a
    // board with no green in it.
    const rainbow = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
    expect(Number.isNaN(circularMeanHue(rainbow))).toBe(true);
  });

  it('still finds a direction when a rainbow is weighted', () => {
    // Mostly pinks with one stray green: the mean should sit in the pinks.
    const hues = [0.88, 0.90, 0.92, 0.94, 0.33];
    const m = circularMeanHue(hues);
    expect(Number.isNaN(m)).toBe(false);
    expect(m > 0.82 || m < 0.02).toBe(true);
  });

  it('returns NaN for an empty set', () => {
    expect(Number.isNaN(circularMeanHue([]))).toBe(true);
  });

  it('is stable under rotation', () => {
    // Rotating every input by the same amount must rotate the mean by it too.
    const base = [0.10, 0.14, 0.18];
    const rot = base.map((h) => (h + 0.4) % 1);
    expect(near((circularMeanHue(base) + 0.4) % 1, circularMeanHue(rot))).toBe(true);
  });
});

describe('hue spread', () => {
  it('reports a monochrome board as 0', async () => {
    const { circularHueStats } = await import('../utils/imageAnalysis');
    expect(circularHueStats([0.6, 0.6, 0.6, 0.6]).spread).toBeCloseTo(0, 2);
  });

  it('reports a rainbow as ~1, where the mean is meaningless', async () => {
    const { circularHueStats } = await import('../utils/imageAnalysis');
    const rainbow = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
    const s = circularHueStats(rainbow);
    expect(s.spread).toBeGreaterThan(0.95);
    // The distinction the old code could not make: a rainbow and a grey board
    // both have no mean direction, but only one of them is colourful.
    expect(Number.isNaN(s.mean)).toBe(true);
  });

  it('puts a two-tone board between the extremes', async () => {
    const { circularHueStats } = await import('../utils/imageAnalysis');
    const s = circularHueStats([0.60, 0.62, 0.05, 0.03]).spread;
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.95);
  });

  it('rises as hues fan out', async () => {
    const { circularHueStats } = await import('../utils/imageAnalysis');
    const tight = circularHueStats([0.50, 0.51, 0.52]).spread;
    const loose = circularHueStats([0.40, 0.50, 0.60]).spread;
    const wide = circularHueStats([0.20, 0.50, 0.80]).spread;
    expect(tight).toBeLessThan(loose);
    expect(loose).toBeLessThan(wide);
  });

  it('is 0 for an empty set rather than NaN', async () => {
    const { circularHueStats } = await import('../utils/imageAnalysis');
    expect(circularHueStats([]).spread).toBe(0);
  });
});
