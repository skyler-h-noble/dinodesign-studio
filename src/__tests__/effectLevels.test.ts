/**
 * There is ONE definition of what an elevation level is.
 *
 * There were three. dropshadow.ts computed the levels from LEVEL_LAYERS —
 * angled, N layers for level N, each with its own --Dropshadow-Color-(i+1).
 * exportColorSystem.ts restated them as a two-layer straight-down recipe. The
 * lib rebuilds the same geometry again in _shadows.js.
 *
 * Both studio copies reached the published CSS, both at :root in base.css, and
 * the correct one won only because it was emitted second. Nothing was wrong on
 * screen, so nothing reported it — and a reorder would have changed every
 * shadow in every system with no diff to point at.
 */
import { describe, it, expect } from 'vitest';
import { effectLevelRecipe, shadowLayers, dropshadowBaseHex, dropshadowAlpha } from '../utils/dropshadow';

describe('effect level recipes', () => {
  it('emit one layer per level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const layers = effectLevelRecipe(level).split(/,(?![^(]*\))/).length;
      expect(`level ${level}: ${layers} layers`).toBe(`level ${level}: ${level} layers`);
    }
  });

  /* N is the ELEVATION, not the layer.
     Each layer used to take its own token by index, so the five tokens were
     alpha steps of one colour and a Level-3 card was a Level-1 card with
     extras. Comeau's stack uses ONE opacity for every layer — depth comes from
     how many layers there are and how dark the colour is, not from fading each
     layer out. So Level-3 draws three layers, all in Dropshadow-Color-3. */
  it('use that level\'s colour token on every one of its layers', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const recipe = effectLevelRecipe(level);
      const uses = [...recipe.matchAll(/--Dropshadow-Color-(\d)/g)].map((m) => m[1]);
      expect(`L${level}: ${[...new Set(uses)].join(',')} x${uses.length}`)
        .toBe(`L${level}: ${level} x${level}`);
    }
  });

  it('match shadowLayers geometry exactly', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const recipe = effectLevelRecipe(level);
      for (const [x, y, blur] of shadowLayers(level)) {
        expect(`L${level} has ${x}px ${y}px ${blur}px: ${recipe.includes(`${x}px ${y}px ${blur}px`)}`)
          .toBe(`L${level} has ${x}px ${y}px ${blur}px: true`);
      }
    }
  });

  // The stale copy that used to live in exportColorSystem.ts. If any of these
  // reappear, a second definition has been reintroduced.
  it('are not the old straight-down two-layer recipe', () => {
    const all = [1, 2, 3, 4, 5].map((l) => effectLevelRecipe(l as 1)).join(' ');
    expect(all).not.toContain('0 4px 8px');
    expect(all).not.toContain('0 2px 4px');
    expect(all).not.toContain('0 16px 32px');
  });
});

// ─── Elevation lives in the colour ────────────────────────────────────────────
//
// The five tokens used to be one colour at five opacities, so a higher
// elevation read as WEAKER — the opposite of what elevation means, and the
// thing that sent us round in circles on a card whose shadow would not deepen.
describe('the shadow colour deepens with elevation', () => {
  const lum = (hex: string) => {
    const h = hex.replace('#', '').slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('gets strictly darker from level 1 to 5', () => {
    for (const surface of ['#a3b8fc', '#8a9a5b', '#f5f5f5', '#2b1a3d']) {
      const l = [1, 2, 3, 4, 5].map((n) => lum(dropshadowBaseHex(surface, n as 1)));
      const monotonic = l.every((v, i) => i === 0 || v <= l[i - 1]);
      expect(`${surface}: ${monotonic}`).toBe(`${surface}: true`);
      // And meaningfully, not by a rounding error.
      expect(`${surface} span: ${l[0] - l[4] > 8}`).toBe(`${surface} span: true`);
    }
  });

  it('keeps every level darker than the surface it falls on', () => {
    for (const surface of ['#a3b8fc', '#8a9a5b', '#f5f5f5']) {
      for (const n of [1, 2, 3, 4, 5] as const) {
        const ok = lum(dropshadowBaseHex(surface, n)) < lum(surface);
        expect(`${surface} L${n} darker: ${ok}`).toBe(`${surface} L${n} darker: true`);
      }
    }
  });

  it('uses ONE alpha for every layer, as Comeau does', () => {
    const alphas = [1, 2, 3, 4, 5].map((n) => dropshadowAlpha(n as 1));
    expect(new Set(alphas).size).toBe(1);
  });

  it('keeps the doubling geometry at every level', () => {
    // Level 3's third layer was [3,6,6], breaking the 1/2/4/8/16 progression
    // that levels 4 and 5 follow.
    for (const level of [3, 4, 5] as const) {
      const ys = shadowLayers(level).map(([, y]) => y);
      expect(`L${level} y: ${ys.join(',')}`).toBe(`L${level} y: ${ys.map((_, i) => 2 * 2 ** i).join(',')}`);
    }
  });
});

// ─── Container shadows take the brand's hue ───────────────────────────────────
//
// A Containers group names its background "Container", not "Background". The
// emitter looked only for Background/Surface, found nothing, fell through to a
// white fallback and produced #858585 — the same flat grey for every theme. So
// a card on a purple system cast the same shadow as one on a red system, and
// it never looked wrong enough to chase.
describe('container shadows follow their own background', () => {
  const lum = (hex: string) => {
    const h = hex.replace('#', '').slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const sat = (hex: string) => {
    const h = hex.replace('#', '').slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };

  // A chromatic container must not produce a grey shadow — that is the exact
  // signature of the white fallback firing.
  it('tints a chromatic container, and does not fall back to grey', () => {
    for (const bg of ['#2b1a3d', '#201326', '#3d1a1a']) {
      for (const n of [1, 5] as const) {
        const s = sat(dropshadowBaseHex(bg, n));
        expect(`${bg} L${n} chromatic: ${s > 0.05}`).toBe(`${bg} L${n} chromatic: true`);
      }
    }
  });

  // Achromatic containers SHOULD be grey — injecting a hue there paints a pink
  // shadow under a white card.
  it('keeps a neutral container neutral', () => {
    expect(sat(dropshadowBaseHex('#f2f2f2', 3))).toBeLessThan(0.05);
  });

  it('deepens with the level, like every other surface', () => {
    const l = [1, 2, 3, 4, 5].map((n) => lum(dropshadowBaseHex('#201326', n as 1)));
    expect(l.every((v, i) => i === 0 || v <= l[i - 1])).toBe(true);
  });
});
