import { describe, it, expect } from 'vitest';
import { isUsableBox, MIN_DRAWN_BOX } from '../utils/textDetection';

describe('isUsableBox', () => {
  it('rejects a stray click', () => {
    expect(isUsableBox({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 })).toBe(false);
  });

  it('rejects a box thinner than the minimum on either axis', () => {
    expect(isUsableBox({ x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.1005 })).toBe(false);
    expect(isUsableBox({ x0: 0.1, y0: 0.1, x1: 0.1005, y1: 0.9 })).toBe(false);
  });

  it('accepts a real selection', () => {
    expect(isUsableBox({ x0: 0.1, y0: 0.2, x1: 0.6, y1: 0.4 })).toBe(true);
  });

  it('accepts a box drawn up-and-left (reversed coordinates)', () => {
    // Dragging from bottom-right to top-left gives x1 < x0; the box is still
    // the same box and must not be rejected for having negative extent.
    expect(isUsableBox({ x0: 0.6, y0: 0.4, x1: 0.1, y1: 0.2 })).toBe(true);
  });

  it('accepts exactly the minimum', () => {
    expect(isUsableBox({ x0: 0, y0: 0, x1: MIN_DRAWN_BOX, y1: MIN_DRAWN_BOX })).toBe(true);
  });
});
