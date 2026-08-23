import { describe, it, expect } from 'vitest';
import { saturationFromPixels } from '../utils/imageAnalysis';

/** A board: `cov` of it vivid, the rest a pale ground. */
function board(cov: number, vivid = 0.78, ground = 0.12, n = 4000) {
  const sats = new Float64Array(n);
  const k = Math.floor(n * cov);
  for (let i = 0; i < n; i++) sats[i] = i < k ? vivid : ground;
  return sats;
}

describe('saturation statistic', () => {
  it('reports a vivid subject as vivid, not as its area share', () => {
    // The regression: 30% vivid coverage measured 0.32 — nearer the pale
    // ground than the subject — and handed the board to the mood that
    // rewards low saturation.
    expect(saturationFromPixels(board(0.30))).toBeCloseTo(0.78, 2);
  });

  it('degrades as the colourful area shrinks', () => {
    const a = saturationFromPixels(board(0.30));
    const b = saturationFromPixels(board(0.10));
    const c = saturationFromPixels(board(0.05));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('does not let one vivid dot read as a vivid board', () => {
    const dot = saturationFromPixels(board(0.02));
    expect(dot).toBeLessThan(0.4);
  });

  it('reports a flat pale board as pale', () => {
    expect(saturationFromPixels(board(0))).toBeCloseTo(0.12, 2);
  });

  it('reports a fully vivid board at full chroma', () => {
    expect(saturationFromPixels(board(1))).toBeCloseTo(0.78, 2);
  });

  it('is order-independent', () => {
    const a = board(0.3);
    const shuffled = Float64Array.from([...a].reverse());
    expect(saturationFromPixels(a)).toBeCloseTo(saturationFromPixels(shuffled), 6);
  });
});
