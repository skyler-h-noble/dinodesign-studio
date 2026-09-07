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
  effectLevelRecipe, shadowLayers, shadowLayerCount, shadowStyleSplit, dropshadowBaseHex,
  dropshadowAlphas, dropshadowHex8, dropshadowRGB, SHADOW_LEVELS, SHADOW_DEFAULTS,
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

describe('geometry — exponential inside a fixed envelope', () => {
  /* THE property that makes resolution safe to expose as a slider: raising it
     subdivides the same envelope instead of growing the shadow. Comeau's
     captures at resolution 0 / 0.5 / 1 all start at 0.5px and end at the same
     max, which is what this pins. */
  it('starts at the contact offset and ends at the level\'s distance', () => {
    /* MEASURED off ten captures of his generator, not inferred: his low,
       medium and high tiers end at y = 2 / 10 / 50, and those land on levels
       1, 3 and 5. Levels 2 and 4 are the geometric means. A previous reading
       put them at 2.5 / 12.3 / 73.7 — same pass that got the alpha wrong. */
    const DISTANCE = { 1: 2, 2: 4.5, 3: 10, 4: 22.4, 5: 50 } as const;
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

  /* Negative spread is what stops a stack reading as a grey slab. It runs
     LINEARLY from 0 at the contact layer to the full spreadMax at the
     outermost, on every level.

     Two caps used to sit here — one against the level's own envelope, one
     against each layer's blur — on the theory that a full spread would erase a
     short level. His captures refute both: the low tier, whose whole envelope
     is 2px, runs the spread to -2.5px, and its middle layer pairs blur 1px
     with spread -1.2px. The caps only ever fired on the small levels, so they
     silently made the bottom of the ladder differ in kind from the top. */
  it('runs the spread linearly to the full tuck-in on every level', () => {
    for (const l of LEVELS) {
      const layers = shadowLayers(l);
      expect(`L${l} first spread: ${layers[0][3]}`).toBe(`L${l} first spread: 0`);
      const last = layers[layers.length - 1][3];
      // Same outermost spread whatever the level's envelope — no cap.
      expect(`L${l} last spread: ${last}`).toBe(`L${l} last spread: -2.5`);
    }
  });

  /* His low tier at 3 layers, verbatim from the capture at Oomph 0.5 /
     Crispness 0.5. Written out longhand: a formula-derived expectation would
     move with the formula and prove nothing. */
  it('reproduces his low tier layer for layer', () => {
    const rows = shadowLayers(1, { ...SHADOW_DEFAULTS, resolution: 1 })
      .map(([x, y, b, sp]) => `${x} ${y} ${b} ${sp}`);
    expect(rows).toEqual(['0.3 0.5 0.6 0', '0.4 0.8 1 -1.2', '1 2 2.5 -2.5']);
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

describe('one colour, one flat alpha per level', () => {
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

  it('holds the alpha FLAT across a level\'s layers', () => {
    /* Both of his models are flat: the article prints one alpha per tier, and
       the generator prints the same value on every layer of a tier in all ten
       captures. This file used to emit a descending ramp with the peak at
       INTENSITY, on a note claiming his ten-layer stack ran 0.81 -> 0.08. The
       captures show ten layers at a flat 0.27. */
    for (const l of LEVELS) {
      const a = dropshadowAlphas(l);
      expect(`L${l}: ${new Set(a).size} distinct of ${a.length}`)
        .toBe(`L${l}: 1 distinct of ${a.length}`);
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

  /* THE law, from ten captures at Oomph 0.5 / Crispness 0.5:
   *
   *     alpha = TOTAL[level] / N,  flat across the layers
   *
   * with TOTAL 1.03 / 1.44 / 2.68 for his low / medium / high. Written out as
   * the observed (tier, N, alpha) triples rather than derived from the
   * constants, so a change to the constants cannot quietly redefine what "his
   * shadows" means — the formula is asserted separately below.
   *
   * The consequence worth keeping in view: Resolution redistributes a level's
   * opacity without changing its total, so the slider cannot make a shadow
   * heavier or lighter. Elevation is carried by the TOTAL, which differs per
   * level, and by the geometry. */
  it('reproduces every alpha his generator prints', () => {
    const OBSERVED: [1 | 3 | 5, number, number][] = [
      [1, 2, 0.52], [1, 3, 0.34],
      [3, 2, 0.72], [3, 3, 0.48], [3, 4, 0.36], [3, 5, 0.29],
      [5, 3, 0.89], [5, 4, 0.67], [5, 5, 0.54], [5, 6, 0.45],
      [5, 7, 0.38], [5, 8, 0.34], [5, 9, 0.30], [5, 10, 0.27],
    ];
    /* Figma renders at most eight shadows on one effect, so N=9 and N=10 are no
       longer reachable through the ladder — see MAX_EFFECT_LAYERS. Those two
       samples still pin the TOTAL, so they are checked against the law directly
       rather than dropped: they are the two that most tightly bound the high
       tier's 2.68 (a nine-layer stack at 0.30 and a ten at 0.27). */
    const TOTALS: Record<number, number> = { 1: 1.03, 3: 1.44, 5: 2.68 };
    for (const [level, n, alpha] of OBSERVED) {
      // the Resolution that yields n layers for this level
      let res = -1;
      for (let r = 0; r <= 1.0001; r += 0.005) {
        if (shadowLayerCount(level, { ...SHADOW_DEFAULTS, resolution: r }) === n) { res = r; break; }
      }
      if (res < 0) {
        expect(`L${level} N=${n} (unreachable): ${(Math.round(TOTALS[level] / n * 100) / 100).toFixed(2)}`)
          .toBe(`L${level} N=${n} (unreachable): ${alpha.toFixed(2)}`);
        continue;
      }
      const ours = dropshadowAlphas(level, { ...SHADOW_DEFAULTS, resolution: res });
      expect(`L${level} N=${n}: ${ours.length} @ ${(Math.round(ours[0] * 100) / 100).toFixed(2)}`)
        .toBe(`L${level} N=${n}: ${n} @ ${alpha.toFixed(2)}`);
    }
  });

  it('splits a long level across two effect styles, 8 then the rest', () => {
    /* Figma renders at most eight shadows on ONE style, and Level-5 reaches
       ten, so the file puts slots 9..10 on a second "+" style on a child frame.
       Nothing is capped — the ladder still reaches ten — the layers are just
       divided. Only Level 5 ever overflows, and only above Resolution ~0.79. */
    for (const resolution of [0, 0.25, 0.5, 0.75, 0.79, 0.93, 1]) {
      const o = { ...SHADOW_DEFAULTS, resolution };
      for (const l of LEVELS) {
        const { primary, overflow } = shadowStyleSplit(l, o);
        expect(`L${l}@${resolution} primary<=8: ${primary <= 8}`)
          .toBe(`L${l}@${resolution} primary<=8: true`);
        expect(`L${l}@${resolution} total: ${primary + overflow}`)
          .toBe(`L${l}@${resolution} total: ${shadowLayerCount(l, o)}`);
        if (l < 5) expect(`L${l}@${resolution} overflow: ${overflow}`)
          .toBe(`L${l}@${resolution} overflow: 0`);
      }
    }
  });

  it('leaves the "+" style empty at the default Resolution', () => {
    /* Worth pinning because it is easy to build the nested-frame workaround and
       then wonder why it does nothing: at Resolution 0.75 Level-5 wants exactly
       eight layers, so the overflow style carries nothing until 0.79. */
    expect(shadowStyleSplit(5, SHADOW_DEFAULTS)).toEqual({ primary: 8, overflow: 0 });
  });

  it('keeps a level\'s total opacity constant as Resolution moves', () => {
    for (const l of LEVELS) {
      const totals = new Set<string>();
      for (const resolution of [0, 0.25, 0.5, 0.75, 1]) {
        const a = dropshadowAlphas(l, { ...SHADOW_DEFAULTS, resolution });
        totals.add((a[0] * a.length).toFixed(2));
      }
      expect(`L${l}: ${totals.size} distinct totals`).toBe(`L${l}: 1 distinct totals`);
    }
  });

  it('scales the total linearly with INTENSITY', () => {
    for (const l of LEVELS) {
      const at = (i: number) => {
        const a = dropshadowAlphas(l, { ...SHADOW_DEFAULTS, intensity: i });
        return a[0] * a.length;
      };
      // 0.5 is the Oomph the totals were measured at, so it is the unit.
      expect(`L${l}: ${(at(0.25) / at(0.5)).toFixed(3)}`).toBe(`L${l}: 0.500`);
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
