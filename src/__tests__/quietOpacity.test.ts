import { describe, it, expect } from 'vitest';
import {
  alphaForContrast, quietOpacityFor, compositeOver, contrastRatio, quantizeAlpha,
} from '../utils/quietOpacity';

/* Values measured off the real brand, so the fixtures are the shape the
   generator actually sees rather than invented ones. */
const BG = '#fcfcfc';                    // Default / Surface
const TEXTS = {
  Text: '#424242', 'Text-Primary': '#3f4525', 'Text-Secondary': '#673334',
  'Text-Tertiary': '#553d2b', 'Text-Neutral': '#424242', 'Text-Info': '#253e82',
  'Text-Success': '#0f4c28', 'Text-Warning': '#543e1e', 'Text-Error': '#772624',
};

describe('quiet opacity — the contract', () => {
  it('lands at or above 4.5, never below', () => {
    for (const hex of Object.values(TEXTS)) {
      const a = alphaForContrast(hex, BG, 4.5)!;
      expect(contrastRatio(compositeOver(hex, BG, a), BG)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /* The whole point: a ramp overshoots because it has twelve steps and none
     sits on the line. An alpha should land close. */
  it('lands close to 4.5, not far above it', () => {
    for (const hex of Object.values(TEXTS)) {
      const a = alphaForContrast(hex, BG, 4.5)!;
      expect(contrastRatio(compositeOver(hex, BG, a), BG)).toBeLessThan(4.7);
    }
  });

  /* ONE opacity serves every Quiet-* on a surface. That only works because
     the max is taken — the mean would put the members below it under 4.5. */
  it('one shared opacity clears 4.5 for every palette', () => {
    const q = quietOpacityFor(TEXTS, BG)!;
    expect(q.unsolvable).toEqual([]);
    for (const hex of Object.values(TEXTS))
      expect(contrastRatio(compositeOver(hex, BG, q.alpha), BG),
        `${hex} at ${q.alpha}`).toBeGreaterThanOrEqual(4.5);
    expect(q.worstRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('takes the maximum, so no member is left short', () => {
    const q = quietOpacityFor(TEXTS, BG)!;
    const each = Object.values(TEXTS).map((h) => alphaForContrast(h, BG, 4.5)!);
    expect(q.alpha).toBe(Math.max(...each));
  });

  /* Alpha moves the foreground TOWARD the background, so it lowers contrast
     and can never raise it. A caller that gets null has to keep the solid. */
  it('returns null when the solid already fails, rather than something dimmer', () => {
    expect(alphaForContrast('#999999', '#ffffff', 4.5)).toBeNull();
    const q = quietOpacityFor({ Text: '#999999' }, '#ffffff');
    expect(q).toBeNull();
  });

  it('reports the members it could not solve instead of dropping them', () => {
    const q = quietOpacityFor({ ok: '#424242', bad: '#d0d0d0' }, BG)!;
    expect(q.unsolvable).toEqual(['bad']);
    expect(q.alpha).toBeGreaterThan(0);
  });

  /* Quantising rounds to 1/255 and can round DOWN through the threshold —
     the implementation steps back up, and this is what proves it. */
  it('stays above the target after quantising', () => {
    for (const hex of Object.values(TEXTS)) {
      const a = alphaForContrast(hex, BG, 4.5)!;
      expect(a).toBe(quantizeAlpha(a));
      expect(contrastRatio(compositeOver(hex, BG, a), BG)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('works on a dark ground as well as a light one', () => {
    const dark = '#2e2e2e';
    const a = alphaForContrast('#ffffff', dark, 4.5)!;
    expect(contrastRatio(compositeOver('#ffffff', dark, a), dark)).toBeGreaterThanOrEqual(4.5);
    expect(a).toBeLessThan(0.7);           // dark grounds need far less opacity
  });
});

describe('quiet opacity — the maths', () => {
  it('composites the way a browser does, in sRGB bytes', () => {
    expect(compositeOver('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(compositeOver('#000000', '#ffffff', 1)).toBe('#000000');
    expect(compositeOver('#000000', '#ffffff', 0)).toBe('#ffffff');
  });

  it('measures contrast the way WCAG does', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('is monotonic in alpha, which is what makes the search valid', () => {
    let prev = 0;
    for (let a = 0.1; a <= 1; a += 0.1) {
      const r = contrastRatio(compositeOver('#424242', BG, a), BG);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
});

/* ── The payload emits what the module computes ────────────────────────────
 *
 * Asserted against generateFigmaJSON rather than the module alone, because the
 * value that matters is the one Figma receives — a percent, not a fraction.
 * Drop-Colors learned this the hard way: a number bound to a colour's opacity
 * renders by appending "%", so 0.728 paints as 0.728% and shows nothing.
 */
import { generateFigmaJSON } from '../utils/generateFigmaJSON';

function ramp(hue: number, chroma: number) {
  const out: any = {};
  for (let n = 1; n <= 12; n++) {
    const L = 8 + ((n - 1) * 84) / 11;
    const C = chroma * Math.sin((Math.PI * (n - 1)) / 11);
    const r = (hue * Math.PI) / 180;
    const a = Math.cos(r) * C, b2 = Math.sin(r) * C;
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b2 / 200;
    const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
    const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
    const hex = '#' + lin.map((c) => {
      const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
    }).join('');
    out[`Color-${n}`] = { value: hex, type: 'color' };
  }
  return out;
}
/* All eight — the generator walks a standard palette list and a short fixture
   trips it on a palette it expects to exist. */
const PALS: Record<string, [number, number]> = {
  Primary: [115, 40], Secondary: [23, 45], Tertiary: [64, 48], Neutral: [0, 0],
  Error: [30, 65], Warning: [77, 60], Success: [150, 55], Info: [289, 70],
};
const colors = () => Object.fromEntries(Object.entries(PALS).map(([n, [h, c]]) => [n, ramp(h, c)]));

/** Text = the far end of the same palette, which is what the real table does */
function textsFor(cols: any) {
  const out: any = {};
  for (const pal of Object.keys(cols)) {
    out[pal] = {};
    for (let n = 1; n <= 12; n++)
      out[pal][`Color-${n}`] = { value: n <= 6 ? cols[pal]['Color-12'].value : cols[pal]['Color-1'].value, type: 'color' };
  }
  return out;
}

/** Containers are measured against Container-Highest, not the palette tone —
 *  a container is its own colour derived from the background, so the tone is a
 *  ground that is never painted. */
function containerGrounds(cols: any) {
  const b: any = {};
  for (const pal of Object.keys(cols)) {
    b[pal] = {};
    for (let n = 1; n <= 12; n++)
      b[pal][`Background-${n}`] = {
        Containers: { 'Container-Highest': cols[pal][`Color-${n <= 6 ? 11 : 2}`].value },
      };
  }
  return b;
}

/** text for a container ground, which is the opposite end from the container */
function containerTexts(cols: any) {
  const out: any = {};
  for (const pal of Object.keys(cols)) {
    out[pal] = {};
    for (let n = 1; n <= 12; n++)
      out[pal][`Color-${n}`] = { value: cols[pal][`Color-${n <= 6 ? 1 : 12}`].value, type: 'color' };
  }
  return out;
}

describe('Quiet-Opacity reaches the Figma payload', () => {
  const cols = colors();
  const SYSTEM = {
    Metadata: { 'Default-Settings': { 'Default-Theme': { Theme: { value: 'Primary' }, N: { value: 12 } } } },
    Modes: {
      'Light-Mode': { Colors: cols, Text: { Surfaces: textsFor(cols), Containers: containerTexts(cols) }, Backgrounds: containerGrounds(cols) },
      'Dark-Mode': { Colors: cols, Text: { Surfaces: textsFor(cols), Containers: containerTexts(cols) }, Backgrounds: containerGrounds(cols) },
    },
  };
  const out = generateFigmaJSON(SYSTEM as any);

  /* Twelve floats, flat — one per tone, shared across palettes AND across
     Surfaces and Containers. Not a branch in sight; that is the shape. */
  it('writes twelve flat opacities in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const q = out.Modes[mode].Quiet;
      expect(q, mode).toBeDefined();
      expect(Object.keys(q).length, mode).toBeLessThanOrEqual(12);
      for (const k of Object.keys(q)) expect(k).toMatch(/^Color-\d+-Opacity$/);
    }
  });

  /* The 240 COLOUR variables must NOT ship any more: a resolvedType is fixed at
     creation, so they would be recreated beside the floats rather than
     replaced, and the group would go back to 264. */
  it('ships no Quiet colours alongside the floats', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode'])
      for (const v of Object.values<any>(out.Modes[mode].Quiet))
        expect(v.type, mode).toBe('number');
  });

  it('emits a PERCENT, not a fraction', () => {
    const q = out.Modes['Light-Mode'].Quiet;
    for (const [key, v] of Object.entries<any>(q)) {
      expect(v.type, key).toBe('number');
      expect(v.value, key).toBeGreaterThan(1);     // a fraction would be < 1
      expect(v.value, key).toBeLessThanOrEqual(100);
    }
  });

  /* The claim the whole 24-float table rests on: one value per TONE serves
     every palette. If a tone can't, the generator omits it and warns rather
     than shipping a value that leaves a palette under 4.5. */
  /* The claim the whole twelve-float table rests on: one value per tone clears
     4.5 for every palette on BOTH grounds. Containers are measured against
     Container-Highest, not the palette tone — a container is its own colour,
     so the tone is a ground that is never painted. */
  it('every emitted opacity clears 4.5 on both grounds, every palette', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const q = out.Modes[mode].Quiet;
      for (const [key, v] of Object.entries<any>(q)) {
        const alpha = (v.value as number) / 100;
        const tone = key.replace('-Opacity', '');
        const n = Number(tone.replace('Color-', ''));
        for (const branch of ['Surfaces', 'Containers'])
          for (const pal of Object.keys(PALS)) {
            const M = (SYSTEM.Modes as any)[mode];
            const bg = branch === 'Surfaces'
              ? M.Colors[pal][tone].value
              : M.Backgrounds[pal][`Background-${n}`].Containers['Container-Highest'];
            const tx = M.Text[branch][pal][tone].value;
            expect(contrastRatio(compositeOver(tx, bg, alpha), bg), `${mode} ${branch} ${pal}/${key}`)
              .toBeGreaterThanOrEqual(4.5);
          }
      }
    }
  });

  it('is far smaller than the colour table it replaces', () => {
    /* 240 colours -> 12 floats */
    expect(Object.keys(out.Modes['Light-Mode'].Quiet).length).toBeLessThanOrEqual(12);
  });
});
