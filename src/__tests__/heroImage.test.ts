import { describe, it, expect } from 'vitest';
import { scorePanel, pickHero, landscapeCrop, DEFAULT_HERO_ASPECT, type PanelStats } from '../utils/heroImage';

/** The three panel kinds a moodboard actually contains. */
const photo = (box: any): PanelStats =>
  ({ box, flatShare: 0.08, colourSpread: 0.72, edgeDensity: 0.20, saturation: 0.30 });
const typeSpecimen = (box: any): PanelStats =>
  ({ box, flatShare: 0.86, colourSpread: 0.04, edgeDensity: 0.42, saturation: 0.02 });
const swatchBlock = (box: any): PanelStats =>
  ({ box, flatShare: 0.34, colourSpread: 0.02, edgeDensity: 0.005, saturation: 0.28 });

describe('hero selection', () => {
  it('ranks a photograph above type and swatches', () => {
    expect(scorePanel(photo({ x: 0, y: 0, w: 400, h: 225 })))
      .toBeGreaterThan(scorePanel(typeSpecimen({ x: 0, y: 0, w: 400, h: 225 })));
    expect(scorePanel(photo({ x: 0, y: 0, w: 400, h: 225 })))
      .toBeGreaterThan(scorePanel(swatchBlock({ x: 0, y: 0, w: 400, h: 225 })));
  });

  it('prefers a landscape photo over a portrait one of the same quality', () => {
    const [best] = pickHero(
      [photo({ x: 0, y: 0, w: 200, h: 400 }), photo({ x: 0, y: 0, w: 400, h: 200 })],
      1_000_000,
    );
    expect(best.box.w).toBeGreaterThan(best.box.h);
  });

  it('picks a small photo over a large type specimen', () => {
    // Size is deliberately a weak term: a board's biggest panel is often the
    // type column, and returning it as the hero would be the obvious failure.
    const [best] = pickHero(
      [typeSpecimen({ x: 0, y: 0, w: 900, h: 700 }), photo({ x: 0, y: 0, w: 260, h: 150 })],
      1_000_000,
    );
    expect(best.photoScore).toBeGreaterThan(0.5);
    expect(best.box.w).toBe(260);
  });

  it('crops a portrait to a centred landscape band', () => {
    const crop = landscapeCrop({ x: 10, y: 100, w: 320, h: 480 }, DEFAULT_HERO_ASPECT);
    expect(crop.w).toBe(320);
    expect(crop.h).toBe(180);              // 320 / (16/9)
    expect(crop.y).toBe(100 + (480 - 180) / 2);  // centred, not top-anchored
    expect(crop.x).toBe(10);
  });

  it('trims the sides of an over-wide panel instead of its height', () => {
    const crop = landscapeCrop({ x: 0, y: 0, w: 1000, h: 200 }, DEFAULT_HERO_ASPECT);
    expect(crop.h).toBe(200);
    expect(crop.w).toBe(Math.round(200 * DEFAULT_HERO_ASPECT));
    expect(crop.x).toBeGreaterThan(0);
  });

  it('leaves a panel already at the target aspect alone', () => {
    const crop = landscapeCrop({ x: 0, y: 0, w: 1600, h: 900 }, DEFAULT_HERO_ASPECT);
    expect(crop).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  });

  it('still scores a near-monochrome photo as a photo', () => {
    // The case a strict rule gets wrong. A moody desaturated shot is a
    // legitimate hero, so the terms are weighted rather than gating.
    const moody: PanelStats = {
      box: { x: 0, y: 0, w: 400, h: 225 },
      flatShare: 0.22, colourSpread: 0.38, edgeDensity: 0.16, saturation: 0.05,
    };
    expect(scorePanel(moody)).toBeGreaterThan(scorePanel(typeSpecimen({ x: 0, y: 0, w: 400, h: 225 })));
  });
});
