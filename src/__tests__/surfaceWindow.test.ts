import { describe, it, expect } from 'vitest';
import {
  surfaceWindow, neutralSurfaceWindow, SURFACE_LEVELS,
  MIN_SURFACE_TONE, MAX_SURFACE_TONE,
} from '../utils/surfaceWindow';

/** Compact view: tone number, or 'black' / 'white'. */
const shape = (w: ReturnType<typeof surfaceWindow>) =>
  w.map((s) => (s.paint.kind === 'tone' ? s.paint.tone : s.paint.kind));

describe('surfaceWindow', () => {
  it('names the six levels in order', () => {
    expect(surfaceWindow(6).map((s) => s.level)).toEqual([...SURFACE_LEVELS]);
  });

  it('matches the measured palettes from the shipped systems', () => {
    // These are the real Surface tones read out of Sage and Harvest.
    expect(shape(surfaceWindow(5))).toEqual([3, 4, 5, 6, 11]);   // the four states
    expect(shape(surfaceWindow(6))).toEqual([3, 5, 6, 7, 11]);   // Primary
    expect(shape(surfaceWindow(7))).toEqual([3, 6, 7, 8, 11]);   // Secondary, Harvest Tertiary
    expect(shape(surfaceWindow(9))).toEqual([3, 8, 9, 10, 11]);  // Sage Tertiary
  });

  it('lands Brightest on 11 — the tone -Light\'s Surface used', () => {
    // This is what makes the merge a replacement rather than an approximation:
    // <Palette>-Light's Surface was tone 11, so Brightest is the same colour.
    for (const s of [5, 6, 7, 8, 9]) {
      expect(shape(surfaceWindow(s))[4]).toBe(11);
    }
  });

  it('steps Brightest to 12 when Bright has taken 11', () => {
    // Dropping Surface-Brighter removed the S=9 collision entirely — that
    // level was the one competing for tone 11. The step-up now only fires
    // when Surface itself sits at 10.
    expect(shape(surfaceWindow(10))).toEqual([3, 9, 10, 11, 12]);
  });

  it('falls back to white when the ramp runs out at the top', () => {
    expect(shape(surfaceWindow(11))).toEqual([3, 10, 11, 12, 'white']);
  });

  it('squeezes Dimmest under Dim, then to black', () => {
    expect(shape(surfaceWindow(4))).toEqual([2, 3, 4, 5, 11]);       // Dim hit 3
    expect(shape(surfaceWindow(3))).toEqual([1, 2, 3, 4, 11]);       // squeezed again
    expect(shape(surfaceWindow(2))).toEqual(['black', 1, 2, 3, 11]); // nothing under 1
  });

  it('is strictly ascending and distinct at every usable tone', () => {
    for (let s = MIN_SURFACE_TONE; s <= MAX_SURFACE_TONE; s++) {
      const w = shape(surfaceWindow(s));
      expect(new Set(w).size, `duplicate level at S=${s}: ${w}`).toBe(5);
      const tones = w.filter((v): v is number => typeof v === 'number');
      expect(tones, `not ascending at S=${s}: ${w}`).toEqual([...tones].sort((a, b) => a - b));
    }
  });

  it('never emits a tone outside 1-12', () => {
    for (let s = MIN_SURFACE_TONE; s <= MAX_SURFACE_TONE; s++) {
      for (const step of surfaceWindow(s)) {
        if (step.paint.kind !== 'tone') continue;
        expect(step.paint.tone, `out of range at S=${s}`).toBeGreaterThanOrEqual(1);
        expect(step.paint.tone).toBeLessThanOrEqual(12);
      }
    }
  });

  it('throws rather than clamping outside the usable range', () => {
    // Clamping would emit Color-13, which resolves to nothing and paints
    // transparent — a silent failure. Stopping is the point.
    for (const bad of [0, 1, 12, 13, 6.5, NaN]) {
      expect(() => surfaceWindow(bad), `should have thrown for ${bad}`).toThrow(RangeError);
    }
  });

  it('keeps a tone index on every level, including the black/white anchors', () => {
    // Every foreground table is keyed by this. A level without one has nothing
    // to look up, which invalidates Text/Quiet/Header/Border/Eyebrow at once.
    for (let s = MIN_SURFACE_TONE; s <= MAX_SURFACE_TONE; s++) {
      for (const step of surfaceWindow(s)) {
        expect(Number.isInteger(step.toneIndex)).toBe(true);
        expect(step.toneIndex).toBeGreaterThanOrEqual(1);
        expect(step.toneIndex).toBeLessThanOrEqual(12);
      }
    }
    const w = surfaceWindow(2);
    expect(w[0].paint.kind).toBe('black');
    expect(w[0].toneIndex).toBe(1);       // black indexes as tone 1
    const t = surfaceWindow(11);
    expect(t[4].paint.kind).toBe('white');
    expect(t[4].toneIndex).toBe(12);      // white indexes as tone 12
  });
});

describe('neutralSurfaceWindow', () => {
  it('spans black to white, replacing the White / Light-Gray / Black themes', () => {
    expect(shape(neutralSurfaceWindow())).toEqual(['black', 9, 10, 11, 'white']);
  });

  it('indexes its anchors so foreground lookup still works', () => {
    const w = neutralSurfaceWindow();
    expect(w[0].toneIndex).toBe(1);
    expect(w[4].toneIndex).toBe(12);
  });

  it('uses the same level names as every other theme', () => {
    expect(neutralSurfaceWindow().map((s) => s.level)).toEqual([...SURFACE_LEVELS]);
  });
});
