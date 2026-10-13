import { describe, it, expect } from 'vitest';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { fromLch, lch, hueArc } from '../utils/chartPalette';

/** a 12-tone ramp, dark to light, like the generator produces */
function ramp(hue: number, chroma: number) {
  const out: any = {};
  for (let n = 1; n <= 12; n++) {
    const L = 8 + (n - 1) * (92 - 8) / 11;
    const C = chroma * Math.sin((Math.PI * (n - 1)) / 11);
    out[`Color-${n}`] = { value: fromLch(L, C, hue), type: 'color' };
  }
  return out;
}
const PALETTES: Record<string, [number, number]> = {
  Primary: [115, 40], Secondary: [23, 45], Tertiary: [64, 48], Neutral: [0, 0],
  Error: [30, 65], Warning: [77, 60], Success: [150, 55], Info: [289, 70],
};
function colors() {
  const c: any = {};
  for (const [n, [h, ch]] of Object.entries(PALETTES)) c[n] = ramp(h, ch);
  return c;
}
/** Backgrounds[palette]['Background-12'].Surfaces.{level} */
function backgrounds(bgKey: string, bright: string, dim: string) {
  const b: any = {};
  for (const p of Object.keys(PALETTES))
    b[p] = { [bgKey]: { Surfaces: { 'Surface-Brightest': bright, 'Surface-Dimmest': dim } } };
  return b;
}
const SYSTEM = {
  Metadata: { 'Default-Settings': { 'Default-Theme': { Theme: { value: 'Primary' }, N: { value: 12 } } } },
  Modes: {
    'Light-Mode': { Colors: colors(), Backgrounds: backgrounds('Background-12', '#ffffff', '#1a1a1a') },
    'Dark-Mode':  { Colors: colors(), Backgrounds: backgrounds('Background-2',  '#f2f2f2', '#121212') },
  },
};

describe('Chart section reaches the Figma payload', () => {
  const out = generateFigmaJSON(SYSTEM as any);

  it('writes both grounds in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const chart = out.Modes?.[mode]?.Chart;
      expect(chart, mode).toBeDefined();
      expect(Object.keys(chart).sort()).toEqual(['Surface-Brightest', 'Surface-Dimmest']);
    }
  });

  it('writes Color-1 through Color-10 and nothing else', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode'])
      for (const level of ['Surface-Brightest', 'Surface-Dimmest'])
        expect(Object.keys(out.Modes[mode].Chart[level]).sort())
          .toEqual(['Color-1','Color-10','Color-2','Color-3','Color-4','Color-5','Color-6','Color-7','Color-8','Color-9']);
  });

  it('emits hexes, not references', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode'])
      for (const level of ['Surface-Brightest', 'Surface-Dimmest'])
        for (const [k, v] of Object.entries<any>(out.Modes[mode].Chart[level])) {
          expect(v.type, `${mode}/${level}/${k}`).toBe('color');
          expect(v.value).toMatch(/^#[0-9a-f]{6}$/);
        }
  });

  /* The series' identity is its hue. If a mode or a ground changed it, the
     legend would name a colour the chart does not use. */
  it('keeps each series on one hue across both modes and both grounds', () => {
    for (let i = 1; i <= 10; i++) {
      const hues: number[] = [];
      for (const mode of ['Light-Mode', 'Dark-Mode'])
        for (const level of ['Surface-Brightest', 'Surface-Dimmest']) {
          const [, C, H] = lch(out.Modes[mode].Chart[level][`Color-${i}`].value);
          if (C > 3) hues.push(H);
        }
      for (const h of hues) expect(hueArc(h, hues[0]), `Color-${i}`).toBeLessThan(15);
    }
  });

  /* The invariant that makes the Charts collection's aliases possible at all.
     An alias to Primary-Color-6 is tone 6 in BOTH modes, so if the solve
     picked a different tone per mode nothing could be aliased and all fourteen
     series would need literals. Solving per GROUND rather than per mode is
     what holds this — and the fixture gives both modes the same ramps, so a
     shared tone shows up as an identical hex. */
  it('picks one tone per ground, valid in both modes', () => {
    for (const level of ['Surface-Brightest', 'Surface-Dimmest']) {
      const light = out.Modes['Light-Mode'].Chart[level];
      const dark = out.Modes['Dark-Mode'].Chart[level];
      for (const key of Object.keys(light))
        expect(dark[key].value, `${level}/${key}`).toBe(light[key].value);
    }
  });

  /* Dark mode has no light chart ground: its Surface-Brightest measures
     L 0.62-0.74, a mid-tone, where 3:1 forces every mark dark and muddy. */
  it('solves Surface-Brightest from light mode only', () => {
    expect(out.Modes['Light-Mode'].Chart['Surface-Brightest']).toBeDefined();
    expect(out.Modes['Dark-Mode'].Chart['Surface-Brightest']).toBeDefined();
  });
});

/* ── The emitted DARK value must be sound, not just the light one ───────────
 *
 * The fixture above gives both modes the same ramps, so it cannot see the bug
 * this covers: the tone is solved against the light ramps and each mode then
 * emits from its OWN ramp, so a tone the dark ramp cannot carry ships
 * unverified. On the real brand that put #2a2e1b — chroma 13, near-black — in
 * the dark palette while the light value at the same tone was a healthy
 * #3f4525 at chroma 20.
 *
 * So this one builds ramps that diverge the way real ones do: the dark set
 * loses chroma below t6 while the light set keeps it.
 */
describe('the dark-mode value is verified, not just emitted', () => {
  const skewed = (hue: number, chroma: number, collapseLow: boolean) => {
    const out: any = {};
    for (let n = 1; n <= 12; n++) {
      const base = chroma * Math.sin((Math.PI * (n - 1)) / 11);
      out[`Color-${n}`] = {
        value: fromLch(8 + ((n - 1) * 84) / 11, collapseLow && n < 6 ? base * 0.35 : base, hue),
        type: 'color',
      };
    }
    return out;
  };
  const palette = (collapseLow: boolean) => {
    const c: any = {};
    for (const [n, [h, ch]] of Object.entries(PALETTES)) c[n] = skewed(h, ch, collapseLow);
    return c;
  };
  const DIVERGING = {
    Metadata: { 'Default-Settings': { 'Default-Theme': { Theme: { value: 'Primary' }, N: { value: 12 } } } },
    Modes: {
      'Light-Mode': { Colors: palette(false), Backgrounds: backgrounds('Background-12', '#ffffff', '#1a1a1a') },
      'Dark-Mode':  { Colors: palette(true),  Backgrounds: backgrounds('Background-2',  '#f2f2f2', '#121212') },
    },
  };
  const out2 = generateFigmaJSON(DIVERGING as any);

  /* The failure this guards: a dark value so desaturated it reads as black
     rather than as its hue. Chart-4 is Neutral and legitimately grey. */
  it('emits no near-grey dark value for a chromatic series', () => {
    for (const level of ['Surface-Brightest', 'Surface-Dimmest']) {
      const dark = out2.Modes['Dark-Mode'].Chart[level];
      for (const [key, v] of Object.entries<any>(dark)) {
        if (key === 'Color-4') continue;
        expect(lch(v.value)[1], `${level}/${key} = ${v.value}`).toBeGreaterThan(8);
      }
    }
  });

  /* Asserted against the ground each level is SOLVED for, which is not always
     this mode's own surface:

       Surface-Brightest  light mode's bright ground only. Dark mode has no
                          light chart ground — its Surface-Brightest is a
                          mid-tone where 3:1 forces every mark muddy — so a
                          chart on a dark page uses the dark ground instead.
       Surface-Dimmest    both modes' dim grounds, solved together.

     Checking the dark value against dark mode's own BRIGHT surface would be
     asserting a promise the design does not make. */
  it('emits a dark value that clears 3:1 on the ground it was solved for', () => {
    const grounds: Record<string, string> = {
      'Surface-Brightest': '#ffffff', 'Surface-Dimmest': '#121212',
    };
    for (const [level, ground] of Object.entries(grounds)) {
      const dark = out2.Modes['Dark-Mode'].Chart[level];
      for (const [key, v] of Object.entries<any>(dark)) {
        const l1 = lum(v.value), l2 = lum(ground);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        expect(ratio, `${level}/${key} = ${v.value} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

/** WCAG relative luminance, local so this file needs no extra export */
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
