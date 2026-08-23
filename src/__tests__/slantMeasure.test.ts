/**
 * The slant measurement, verified on actual pixels rather than on a stubbed
 * value.
 *
 * It is the ONLY signal that separates a formal copperplate script from hand
 * printing, and it was ported from omni-type-studio rather than written here —
 * a ported function that silently returns 0 for everything would still let all
 * the classification tests pass, because those feed `slant` in directly.
 *
 * The 25-degree cut is what the classifier keys on: Great Vibes, Allura,
 * Parisienne, Pinyon Script and Alex Brush measure 20-35; Caveat, Indie Flower,
 * Patrick Hand, Architects Daughter and Shadows Into Light measure -5 to 20.
 */
import { describe, it, expect, vi } from 'vitest';
import { analyzeStrokes } from '../utils/textDetection';

/** Bars leaning by `deg`, dark on light. Positive deg leans one way. */
function pixels(w: number, h: number, deg: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  const t = Math.tan((deg * Math.PI) / 180);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const shift = Math.round((y - h / 2) * t);
      const xs = x - shift;
      const inBar = xs >= 10 && xs < 110 && (xs - 10) % 20 < 8;
      const c = inBar ? 20 : 245;
      const p = (y * w + x) * 4;
      d[p] = c; d[p + 1] = c; d[p + 2] = c; d[p + 3] = 255;
    }
  }
  return d;
}

function slantOf(deg: number) {
  const w = 160, h = 80;
  const data = pixels(w, h, deg);
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ imageSmoothingQuality: '', drawImage: () => {}, getImageData: () => ({ data }) }),
    }),
  });
  return analyzeStrokes({} as any, { x0: 0, y0: 0, x1: w, y1: h }).slant;
}

describe('measureSlant (ported from omni-type-studio)', () => {
  it('reports ~0 for upright strokes', () => {
    expect(Math.abs(slantOf(0) ?? 99)).toBeLessThanOrEqual(5);
  });

  it('tracks a real lean, and distinguishes the two pools across the 25 cut', () => {
    const upright = Math.abs(slantOf(10) ?? 99);   // hand printing territory
    const steep   = Math.abs(slantOf(30) ?? 0);    // copperplate territory
    expect(upright).toBeLessThan(25);
    expect(steep).toBeGreaterThanOrEqual(25);
  });
});
