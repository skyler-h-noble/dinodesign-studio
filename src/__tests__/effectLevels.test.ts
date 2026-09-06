/**
 * There is ONE definition of what an elevation level is.
 *
 * There were three. dropshadow.ts computed the levels from LEVEL_LAYERS,
 * exportColorSystem.ts restated them as a two-layer straight-down recipe, and
 * the lib rebuilt the same geometry again in _shadows.js. Both studio copies
 * reached the published CSS, both at :root in base.css, and the correct one
 * won only because it was emitted second.
 *
 * The model is Josh Comeau's SHADOW PALETTE GENERATOR — one colour, alpha
 * ramping down across the layers — and NOT the ELEVATIONS map in his article,
 * which holds one flat alpha per tier. The two disagree and we follow the
 * generator; see the header of src/utils/dropshadow.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  effectLevelRecipe, shadowLayers, shadowLayerCount, dropshadowBaseHex,
  dropshadowAlphas, dropshadowHex8, dropshadowRGB, SHADOW_LEVELS,
} from '../utils/dropshadow';

const LEVELS = SHADOW_LEVELS;
const lum = (hex: string) => {
  const h = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('layer counts follow the resolution ramp', () => {
  /* Level N never drops below N layers, and the top level reaches 10. At
     RESOLUTION 0 the counts are exactly [1,2,3,4,5] — the geometry this file
     had before the generator model — so resolution 0 is a no-op migration. */
  it('stays within the level\'s min and max', () => {
    const MIN = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } as const;
    const MAX = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 10 } as const;
    for (const l of LEVELS) {
      const n = shadowLayerCount(l);
      expect(`L${l}: ${n >= MIN[l] && n <= MAX[l]}`).toBe(`L${l}: true`);
    }
  });

  it('never gives a higher level fewer layers than a lower one', () => {
    const counts = LEVELS.map((l) => shadowLayerCount(l));
    expect(counts.every((v, i) => i === 0 || v >= counts[i - 1])).toBe(true);
  });

  it('emits exactly that many layers, alphas and recipe entries', () => {
    for (const l of LEVELS) {
      const n = shadowLayerCount(l);
      const parts = effectLevelRecipe(l).split(/,(?![^()]*\))/).length;
      expect(`L${l}: ${shadowLayers(l).length}/${dropshadowAlphas(l).length}/${parts}`)
        .toBe(`L${l}: ${n}/${n}/${n}`);
    }
  });
});

describe('geometry — cubic inside a fixed envelope', () => {
  /* THE property that makes resolution safe to expose as a slider: raising it
     subdivides the same envelope instead of growing the shadow. Comeau's
     captures at resolution 0 / 0.5 / 1 all start at 0.5px and end at the same
     max, which is what this pins. */
  it('starts at the contact offset and ends at the level\'s distance', () => {
    // Anchored to Comeau's own tiers: his low 2.5px, medium 12.3px, high 73.7px
    // land on levels 1, 3 and 5. The old 1/4/8/16/32 topped out below half his
    // high tier, which is why Level 5 hugged its own edge.
    const DISTANCE = { 1: 2.5, 2: 6, 3: 12.5, 4: 30, 5: 74 } as const;
    for (const l of LEVELS) {
      const ys = shadowLayers(l).map(([, y]) => y);
      expect(`L${l} last: ${ys[ys.length - 1]}`).toBe(`L${l} last: ${DISTANCE[l]}`);
      if (ys.length > 1) expect(`L${l} first: ${ys[0]}`).toBe('L' + l + ' first: 0.5');
    }
  });

  it('grows monotonically outward on every axis', () => {
    for (const l of LEVELS) {
      const layers = shadowLayers(l);
      for (const axis of [0, 1, 2] as const) {
        const v = layers.map((t) => t[axis]);
        expect(`L${l}[${axis}]: ${v.every((x, i) => i === 0 || x >= v[i - 1])}`)
          .toBe(`L${l}[${axis}]: true`);
      }
    }
  });

  /* Negative spread is what stops a 10-layer stack reading as a grey slab.
     It must never exceed the shadow it is shrinking — a flat 5px would erase
     Level-1, whose whole envelope is 1px. */
  it('tucks outer layers in without erasing small levels', () => {
    for (const l of LEVELS) {
      const layers = shadowLayers(l);
      expect(`L${l} first spread: ${layers[0][3]}`).toBe(`L${l} first spread: 0`);
      for (const [, , blur, spread] of layers) {
        expect(`L${l} spread ${spread} vs blur ${blur}: ${Math.abs(spread) <= blur}`)
          .toBe(`L${l} spread ${spread} vs blur ${blur}: true`);
      }
    }
  });

  // The stale copy that used to live in exportColorSystem.ts. If any of these
  // reappear, a second definition has been reintroduced.
  it('is not the old straight-down two-layer recipe', () => {
    const all = LEVELS.map((l) => effectLevelRecipe(l)).join(' ');
    for (const dead of ['0 4px 8px', '0 2px 4px', '0 16px 32px']) {
      expect(`${dead}: ${all.includes(dead)}`).toBe(`${dead}: false`);
    }
  });
});

describe('one colour, alpha ramping down the stack', () => {
  /* The whole point. Every layer of every level on a surface is the SAME
     colour; only the alpha moves. That is what lets a Figma effect style bind
     one colour variable per surface plus a set of per-layer opacities, and it
     is why --Dropshadow-Color-1..5 could collapse. */
  it('uses one colour for every level and every layer', () => {
    for (const surface of ['#a3b8fc', '#8a9a5b', '#f5f5f5', '#2b1a3d']) {
      const seen = new Set<string>();
      for (const l of LEVELS) {
        dropshadowAlphas(l).forEach((_, i) => seen.add(dropshadowHex8(surface, l, i).slice(0, 7)));
      }
      expect(`${surface}: ${seen.size} distinct`).toBe(`${surface}: 1 distinct`);
    }
  });

  it('ramps the alpha DOWN from the contact layer outward', () => {
    for (const l of LEVELS) {
      const a = dropshadowAlphas(l);
      if (a.length === 1) continue;
      expect(`L${l}: ${a.every((v, i) => i === 0 || v < a[i - 1])}`).toBe(`L${l}: true`);
    }
  });

  /* The alphas are a function of (level, layer, N) alone — never of the
     surface. If that ever stops being true, the per-layer opacities can no
     longer be global in Figma and every background needs its own set. */
  it('produces identical alphas on every background', () => {
    const ref = LEVELS.map((l) => dropshadowAlphas(l).join(','));
    for (const surface of ['#ffffff', '#000000', '#c0392b', '#1f4d3a']) {
      const here = LEVELS.map((l) => dropshadowAlphas(l).join(','));
      expect(`${surface}: ${here.join('|') === ref.join('|')}`).toBe(`${surface}: true`);
    }
  });

  /* INTENSITY is the peak alpha and the stack ramps down linearly from it —
     Comeau's model, where Oomph 1 gives a ten-layer stack running 0.81 -> 0.08.
     This used to SOLVE the peak so every level composited to one total. That
     read tidily but is not his, and it drove Level 5's outermost layer — the
     one casting the large soft shadow — to 0.014 against his 0.08, which is
     why our shadows came out so much tighter and weaker than his. */
  it('uses INTENSITY as the peak alpha, on every level', () => {
    for (const intensity of [0.3, 0.8]) {
      for (const l of LEVELS) {
        expect(`L${l}@${intensity}: ${dropshadowAlphas(l, { intensity })[0].toFixed(3)}`)
          .toBe(`L${l}@${intensity}: ${intensity.toFixed(3)}`);
      }
    }
  });

  it('ramps linearly to peak/N at the outermost layer', () => {
    for (const l of LEVELS) {
      const a = dropshadowAlphas(l, { intensity: 0.8 });
      const n = a.length;
      expect(`L${l}: ${a.map((v) => v.toFixed(3)).join(',')}`)
        .toBe(`L${l}: ${Array.from({ length: n }, (_, i) => (0.8 * (n - i) / n).toFixed(3)).join(',')}`);
    }
  });

  it('keeps the shadow darker than the surface it falls on', () => {
    for (const surface of ['#a3b8fc', '#8a9a5b', '#f5f5f5']) {
      expect(`${surface}: ${lum(dropshadowBaseHex(surface)) < lum(surface)}`)
        .toBe(`${surface}: true`);
    }
  });

  /* The recipe references ONE colour var and writes the alphas as literals —
     Comeau's own shape, hsl(var(--shadow-color) / 0.34). A per-level colour
     token on every layer is the old model and cannot express a ramp. */
  it('emits one colour var with literal alphas', () => {
    const recipe = effectLevelRecipe(5);
    expect(`per-level token: ${/--Dropshadow-Color-\d/.test(recipe)}`).toBe('per-level token: false');
    const vars = [...recipe.matchAll(/rgba\(var\(--Dropshadow-Color\), /g)].length;
    expect(`refs: ${vars}`).toBe(`refs: ${shadowLayerCount(5)}`);
  });
});

describe('tint follows the surface, and stays grey when it should', () => {
  const sat = (hex: string) => {
    const h = hex.replace('#', '').slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };

  /* A Containers group names its background "Container", not "Background". The
     emitter once looked only for Background/Surface, fell through to a white
     fallback and produced #858585 — the same flat grey for every theme. */
  it('tints a chromatic surface rather than falling back to grey', () => {
    for (const bg of ['#2b1a3d', '#201326', '#3d1a1a']) {
      expect(`${bg}: ${sat(dropshadowBaseHex(bg)) > 0.05}`).toBe(`${bg}: true`);
    }
  });

  // Injecting a hue into a neutral paints a pink shadow under a white card.
  it('keeps a neutral surface neutral', () => {
    expect(sat(dropshadowBaseHex('#f2f2f2'))).toBeLessThan(0.05);
  });

  it('exposes the colour as an R G B triple for rgb(... / alpha)', () => {
    expect(/^\d{1,3}, \d{1,3}, \d{1,3}$/.test(dropshadowRGB('#8a9a5b'))).toBe(true);
  });
});
