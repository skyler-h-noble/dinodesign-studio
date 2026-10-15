/** Hero Generator: the spec's rules and the two solvers. */
import { describe, it, expect } from 'vitest';
import { normalizeHeroSpec, allowedTones } from '../utils/addOns/hero/heroSpec';
import { solveOverlay, worstOverGradient, ratio, requiredRatio } from '../utils/addOns/hero/heroContrast';
import { heroHTML } from '../utils/addOns/hero/heroCode';

describe('hero spec', () => {
  it('keeps every gradient stop on the first stop\'s side of the 5/6 line', () => {
    const s = normalizeHeroSpec({ mode: 'gradient', gradient: { stops: [{ family: 'Primary', tone: 3, pos: 0 }, { family: 'Secondary', tone: 9, pos: 1 }] } });
    expect(s.gradient.stops[1].tone).toBe(5);
    expect(allowedTones(7)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('writes tokens, never hex, and carries its spec', () => {
    const s = normalizeHeroSpec({ mode: 'gradient' });
    const html = heroHTML(s);
    expect(html).toContain('var(--Primary-Color-3)');
    // Over a gradient the hero is a themed surface: the system's own Header and Text.
    expect(html).toContain('data-theme="Primary" data-surface="Surface-Dimmest"');
    expect(html).toContain('var(--Header)');
    expect(html).toMatch(/data-omni-hero="/);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe('hero solvers', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 4, g: 4, b: 4 };
  const mid = { r: 128, g: 128, b: 128 };

  it('finds the lightest overlay that lifts every pixel to the ratio', () => {
    const samples = [{ ...white, px: 0.5, py: 0.9 }, { ...mid, px: 0.4, py: 0.9 }];
    const r = solveOverlay(samples, black, white, 4.5, 'solid', 'bottom', 'left');
    expect(r.ok).toBe(true);
    expect(r.ratio).toBeGreaterThanOrEqual(4.5);
    const less = solveOverlay(samples, black, white, 4.5, 'solid', 'bottom', 'left');
    expect(less.alpha).toBeGreaterThan(0.4);
  });

  it('samples the whole gradient, and large text needs 3:1', () => {
    expect(worstOverGradient([{ rgb: black, pos: 0 }, { rgb: black, pos: 1 }], white)).toBeCloseTo(ratio(black, white));
    expect(requiredRatio(32)).toBe(3);
    expect(requiredRatio(16)).toBe(4.5);
  });
});

describe('hero code — margin and Display-Alt', () => {
  it('takes its padding from the device margin, never a number', () => {
    const html = heroHTML(normalizeHeroSpec({ padding: 48 }));
    expect(html).toContain('padding: var(--Margin, var(--omni-hero-margin))');
    expect(html).not.toMatch(/padding: \d+px/);
  });

  it('sets consecutive Alt words in one span at the paired Alt step', () => {
    const spec = normalizeHeroSpec({ mode: 'gradient', text: { headline: 'Made for long summer days', altWords: [3, 4, 9, -1], headlineStyle: 'Display-Large' } });
    expect(spec.text.altWords).toEqual([3, 4]);
    const html = heroHTML(spec);
    expect(html.match(/omni-hero__alt/g)).toHaveLength(1);
    expect(html).toContain('var(--Alt-Display-Large-Font-Family)');
    expect(html).toMatch(/>summer days<\/span><\/h1>/);
  });

  it('sets Alt words only over a gradient, never over a photo', () => {
    const base = { text: { altWords: [0], altColor: 'alt' } };
    expect(heroHTML(normalizeHeroSpec({ ...base, mode: 'gradient' }))).toContain('color: var(--Alt-Display-Color)');
    expect(heroHTML(normalizeHeroSpec({ ...base, mode: 'image' }))).not.toContain('omni-hero__alt');
  });
});

describe('hero mesh', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 4, g: 4, b: 4 };
  it('is the ground away from the blobs and the blob at its center', async () => {
    const { meshColorAt, worstOverMesh } = await import('../utils/addOns/hero/heroContrast');
    const stops = [{ rgb: black, x: 0, y: 0, spread: 1 }, { rgb: white, x: 0.9, y: 0.9, spread: 0.2 }];
    expect(meshColorAt(stops, 0.1, 0.1)).toEqual(black);
    expect(meshColorAt(stops, 0.9, 0.9)).toEqual(white);
    // White text fails at the white blob's center, however small the blob.
    expect(worstOverMesh(stops, white)).toBeCloseTo(1);
  });

  it('paints the ground last and each blob as an ellipse', () => {
    const html = heroHTML(normalizeHeroSpec({ mode: 'gradient', gradient: { variant: 'mesh', stops: [
      { family: 'Primary', tone: 2, pos: 0 }, { family: 'Secondary', tone: 3, pos: 1, x: 0.8, y: 0.2, spread: 0.5 },
    ] } }));
    expect(html).toContain('radial-gradient(ellipse 50% 50% at 80% 20%, var(--Secondary-Color-3) 0%, transparent 100%), var(--Primary-Color-2)');
  });
});

describe('hero over a photo — surface colors', () => {
  it('wears the solved surface, with dropped roles in BW', () => {
    const html = heroHTML(normalizeHeroSpec({ mode: 'image', image: { solvedText: 'light', theme: 'Neutral', surface: 'Surface-Dimmest', bwRoles: ['eyebrow', 'buttons'] } }));
    expect(html).toContain('data-theme="Neutral" data-surface="Surface-Dimmest"');
    expect(html).toContain('color: var(--Header)');
    expect(html).toMatch(/omni-hero__eyebrow" style="[^"]*color: var\(--BW-Color-1\)/);
    expect(html).toContain('--omni-hero-btn: var(--BW-Color-1)');
  });

  it('stays black and white when no surface was found', () => {
    const html = heroHTML(normalizeHeroSpec({ mode: 'image', image: { solvedText: 'light' } }));
    expect(html).not.toContain('data-surface');
    expect(html).not.toContain('var(--Header)');
  });
});

describe('hero import', () => {
  it('reads a hero back from its HTML, its link and its spec', async () => {
    const { extractHeroSpec, encodeHeroSpec } = await import('../utils/addOns/hero/heroShare');
    const spec = normalizeHeroSpec({ mode: 'gradient', text: { headline: 'Back again', altWords: [1] } });
    expect(normalizeHeroSpec(extractHeroSpec(heroHTML(spec)))).toEqual(spec);
    expect(normalizeHeroSpec(extractHeroSpec(`https://x/add-ons/hero/id#spec=${encodeHeroSpec(spec)}`))).toEqual(spec);
    expect(normalizeHeroSpec(extractHeroSpec(JSON.stringify(spec)))).toEqual(spec);
    expect(() => extractHeroSpec('{"version":"chart1"}')).toThrow(/Charts/);
  });
});
