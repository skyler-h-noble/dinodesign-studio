import { describe, it, expect } from 'vitest';
import {
  dropColorTable, DROP_COLOR_SLOTS, dropshadowBaseHex, dropshadowAlphas,
  shadowLayers, shadowLayerCount, effectLevelRecipe, quantizeAlpha,
  SHADOW_LEVELS, SHADOW_DEFAULTS, type ShadowLevel,
} from '../utils/dropshadow';
import {
  componentElevationGeometryFigma, componentElevationSlotCount,
  COMPONENT_ELEVATIONS, elevationFor,
} from '../utils/componentElevation';

/* The Figma collection this pins, written out longhand rather than derived, so
   a change to LAYERS_MAX cannot silently resize the file's collection:

     Component-Elevations, slots per level:  3 / 4 / 5 / 8 / 10

   Pinned to the file rather than derived from LAYERS_MAX (3/4/5/7/10), because
   a Figma variable cannot be deleted and re-created without unbinding every
   layer using it. Level 4 is the one that differs — the file has 8 slots where
   the ladder needs 7, so its last slot is always spare. */
const COLLECTION: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 8, 5: 10 };

const SURFACE = '#faf6f0';      // a warm light surface — tinted, not grey
const alphaOf = (hex8: string) => hex8.slice(7, 9).toLowerCase();
const rgbOf = (hex8: string) => hex8.slice(0, 7).toLowerCase();

describe('Drop-Colors — shape', () => {
  it('has exactly the slots the Figma collection has', () => {
    const t = dropColorTable(SURFACE);
    expect(Object.keys(t).sort()).toEqual(
      ['Level-1', 'Level-2', 'Level-3', 'Level-4', 'Level-5']);
    for (const level of SHADOW_LEVELS) {
      expect(t[`Level-${level}`]).toHaveLength(COLLECTION[level]);
      expect(DROP_COLOR_SLOTS[level]).toBe(COLLECTION[level]);
    }
  });

  it('emits 8-digit hex in every slot', () => {
    for (const hexes of Object.values(dropColorTable(SURFACE)))
      for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{8}$/i);
  });
});

describe('Drop-Colors — one colour per background', () => {
  /* The whole point of the collection: 31 values, ONE hue. Figma cannot alias a
     colour and add an alpha (a shadow's colour is a single RGBA, unlike a fill,
     which splits RGB from opacity), so the multiplication happens in the
     generator — and this is what proves it stayed a single source. */
  it('gives every slot of every level the same RGB, equal to dropshadowBaseHex', () => {
    for (const surface of ['#faf6f0', '#f0f4fa', '#1e1e1e', '#ffffff']) {
      const base = dropshadowBaseHex(surface).toLowerCase();
      for (const hexes of Object.values(dropColorTable(surface)))
        for (const h of hexes) expect(rgbOf(h)).toBe(base);
    }
  });

  it('moves every slot together when the background changes', () => {
    const warm = dropColorTable('#faf6f0')['Level-3'];
    const cool = dropColorTable('#f0f4fa')['Level-3'];
    expect(rgbOf(warm[0])).not.toBe(rgbOf(cool[0]));
    // ...and only the hue moved: the alphas are background-independent.
    expect(warm.map(alphaOf)).toEqual(cool.map(alphaOf));
  });
});

describe('Drop-Colors — the unused tail', () => {
  /* An unused slot must be transparent, not merely zero-geometry: a 0/0/0/0
     shadow still paints the element's silhouette at full strength behind it. */
  it('zeroes the alpha of every slot past the current layer count', () => {
    for (const resolution of [0, 0.25, 0.5, 0.75, 1]) {
      const o = { ...SHADOW_DEFAULTS, resolution };
      for (const level of SHADOW_LEVELS) {
        const used = shadowLayerCount(level, o);
        const hexes = dropColorTable(SURFACE, o)[`Level-${level}`];
        hexes.forEach((h, i) => {
          if (i >= used) expect(alphaOf(h)).toBe('00');
          else expect(alphaOf(h)).not.toBe('00');
        });
      }
    }
  });

  it('never needs more layers than the collection has slots', () => {
    /* The slot counts are PINNED to the collection in the Figma file, not
       derived from the layer ladder — a Figma variable cannot be deleted and
       re-created without unbinding every layer using it (invariant 8), so the
       file's shape is the fixed point and the ladder has to fit inside it.
       After the move to his measured counts the maxes are 3/4/5/7/10 against
       slots of 3/4/6/8/10, so levels 3 and 4 leave one spare. */
    const o = { ...SHADOW_DEFAULTS, resolution: 1 };
    for (const level of SHADOW_LEVELS) {
      const used = shadowLayerCount(level, o);
      expect(used, `Level-${level} at Resolution 1`).toBeLessThanOrEqual(COLLECTION[level]);
      const hexes = dropColorTable(SURFACE, o)[`Level-${level}`];
      hexes.forEach((h, i) => {
        if (i < used) expect(alphaOf(h)).not.toBe('00');
        else expect(alphaOf(h), `Level-${level} spare slot ${i + 1}`).toBe('00');
      });
    }
  });
});

describe('Component-Elevations — geometry written, colour aliased', () => {
  const ce = componentElevationGeometryFigma();

  it('emits both modes and nothing else', () => {
    expect(Object.keys(ce).sort()).toEqual(['Elevated', 'Standard']);
  });

  it('gives every shadow slot four numbers and one colour alias', () => {
    for (const mode of ['Standard', 'Elevated'] as const) {
      for (const [name, entry] of Object.entries(ce[mode])) {
        if (name.endsWith('/Level')) { expect((entry as any).type).toBe('number'); continue; }
        const e = entry as any;
        if (name.endsWith('/Drop-Color')) {
          expect(e.type).toBe('color');
          // A live slot aliases its level's ONE colour; a dead one is transparent.
          expect(e.value).toMatch(/^(\{Drop-Colors\.Level-[1-5]\.Drop-Color\}|#00000000)$/);
        } else {
          expect(name).toMatch(/\/(x|y|Blur|Spread)$/);
          expect(e.type).toBe('number');
          expect(typeof e.value).toBe('number');
        }
      }
    }
  });

  it('aliases live slots to its level, and marks the rest transparent', () => {
    /* Drop-Colors is ONE colour per level — the alpha is flat across a level's
       layers, so there is nothing per-slot to point at. Which slots are LIVE at
       the current Resolution is encoded HERE instead, as a transparent literal
       on the spares. Transparent rather than merely zero-geometry: a 0/0/0/0
       shadow still paints the silhouette at full strength behind the element. */
    const opts = SHADOW_DEFAULTS;
    for (const mode of ['Standard', 'Elevated'] as const) {
      for (const c of COMPONENT_ELEVATIONS) {
        for (const state of (c.hasHover ? ['Default', 'Hover'] : ['Default']) as Array<'Default' | 'Hover'>) {
          const level = elevationFor(c, state, mode);
          if (level === 0) continue;
          const live = shadowLayerCount(level as ShadowLevel, opts);
          for (let i = 1; i <= DROP_COLOR_SLOTS[level as ShadowLevel]; i++) {
            const entry = ce[mode][`${c.group}/${state}/Shadow-${i}/Drop-Color`] as any;
            expect(entry, `${c.group}/${state} slot ${i}`).toBeDefined();
            expect(entry.value, `${c.group}/${state} slot ${i}`).toBe(
              i <= live ? `{Drop-Colors.Level-${level}.Drop-Color}` : '#00000000');
          }
        }
      }
    }
  });

  it('emits no shadow at all for a level-0 row', () => {
    // Button/Outlined Cards rests flat in Standard mode.
    expect(ce.Standard['Button, Outlined Cards/Default/Shadow-1/y']).toBeUndefined();
    expect(ce.Standard['Button, Outlined Cards/Default/Shadow-1/Drop-Color']).toBeUndefined();
    // ...and the Elevated lift gives it one.
    expect(ce.Elevated['Button, Outlined Cards/Default/Shadow-1/Drop-Color']).toBeDefined();
  });

  it('emits no Level variable — the collection carries geometry only', () => {
    /* Five children per Shadow-N and nothing else, matching the file. A Level
       variable would be an unmatched key on every row. */
    for (const mode of ['Standard', 'Elevated'] as const)
      for (const name of Object.keys(ce[mode]))
        expect(name.endsWith('/Level'), name).toBe(false);
  });

  it('has as many slots as the levels it references', () => {
    /* Sum across both modes. Moves whenever the level ladder or the slot counts
       move, so it is here to catch a silent change, not as a magic number. */
    expect(componentElevationSlotCount()).toBe(93);
  });
});

describe('Component-Elevations — geometry matches the ladder and the CSS', () => {
  /* Invariant 5: the Figma payload and the CSS export are separate
     implementations of one value. Asserting that both emit SOMETHING would pass
     while one drifted, so assert the number a slot actually resolves to. */
  it('writes shadowLayers() verbatim into each slot', () => {
    const o = SHADOW_DEFAULTS;
    const ce = componentElevationGeometryFigma(o);
    for (const mode of ['Standard', 'Elevated'] as const) {
      for (const c of COMPONENT_ELEVATIONS) {
        for (const state of (c.hasHover ? ['Default', 'Hover'] : ['Default']) as Array<'Default' | 'Hover'>) {
          const level = elevationFor(c, state, mode);
          if (level === 0) continue;
          const layers = shadowLayers(level as ShadowLevel, o);
          for (let i = 0; i < DROP_COLOR_SLOTS[level as ShadowLevel]; i++) {
            const [x, y, blur, spread] = layers[i] ?? [0, 0, 0, 0];
            const at = (f: string) =>
              (ce[mode][`${c.group}/${state}/Shadow-${i + 1}/${f}`] as any).value;
            expect(at('x')).toBe(x);
            expect(at('y')).toBe(y);
            expect(at('Blur')).toBe(blur);
            expect(at('Spread')).toBe(spread);
          }
        }
      }
    }
  });

  it('resolves to the same shadow the CSS recipe composes', () => {
    /* Figma: base hex + baked alpha, per slot.
       CSS:   rgba(var(--Dropshadow-Color), <alpha>) with the same geometry.
       Same pixels by two routes — this is the pair that can drift.

       Asserted EXACTLY, not within a tolerance. The two used to disagree in the
       last digit — CSS rounded the alpha to three decimals (0.35875 -> 0.359)
       while a Figma colour is 8-bit (0.35875 -> byte 91 -> 0.3569) — and the
       obvious repair, allowing one 8-bit step of slack, would have been the
       wrong one: a tolerance is exactly where a real divergence hides. Both
       sides now quantise through quantizeAlpha() at the emission boundary, so
       they hold the same number and this can demand equality. */
    const o = SHADOW_DEFAULTS;
    const base = dropshadowBaseHex(SURFACE, o).toLowerCase();

    for (const level of SHADOW_LEVELS) {
      const layers = shadowLayers(level, o);
      const drops = dropColorTable(SURFACE, o)[`Level-${level}`];
      expect(dropshadowAlphas(level, o)).toHaveLength(shadowLayerCount(level, o));

      /* Matched rather than split: the recipe's own `rgba(var(--X), 0.41)`
         contains the `), ` that separates layers, so splitting on it shreds
         each layer into pieces. */
      const cssLayers = [...effectLevelRecipe(level, o).matchAll(
        /(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px rgba\(var\(--Dropshadow-Color\), ([\d.]+)\)/g)];
      expect(cssLayers).toHaveLength(layers.length);

      cssLayers.forEach((m, i) => {
        const [, x, y, blur, spread, alpha] = m;

        /* Geometry is one shared function, so it must agree exactly — modulo
           signed zero. shadowLayers negates the spread, so a zero spread comes
           back as -0 while parsing "0px" gives +0, and toEqual separates them.
           JSON.stringify writes both as `0`, so nothing downstream can see the
           difference. */
        const unsign = (n: number) => (n === 0 ? 0 : n);
        expect([+x, +y, +blur, +spread]).toEqual(layers[i].map(unsign));

        // Hue is the single per-background colour on both sides.
        expect(rgbOf(drops[i])).toBe(base);

        // Alpha is the same number on both sides, not merely a close one:
        // the CSS literal parses back to exactly the byte Figma stores.
        expect(Math.round(parseFloat(alpha) * 255)).toBe(parseInt(alphaOf(drops[i]), 16));
        expect(parseFloat(alpha)).toBe(quantizeAlpha(dropshadowAlphas(level, o)[i]));
      });

      // ...and the slots the CSS does not use are the transparent ones.
      for (let i = layers.length; i < DROP_COLOR_SLOTS[level]; i++)
        expect(alphaOf(drops[i])).toBe('00');
    }
  });
});
