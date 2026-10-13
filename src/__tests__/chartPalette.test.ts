import { describe, it, expect } from 'vitest';
import {
  chooseHues, solveGround, rampForHue, contrast, separation, isOrdinalPair,
  lch, hueArc, fromLch, MIN_CONTRAST, TONE_BAND, REF_TONE,
  CHROMA_FLOOR, BRAND_CHROMA_FLOOR, BRAND_SERIES, type Ramp,
} from '../utils/chartPalette';

/* A stand-in brand with the shape the real one has: 12 tones running dark to
   light, three chromatic brand hues plus a grey, and the four state hues. The
   numbers do not need to be this brand's — what is under test is the contract,
   which has to hold for any brand the studio generates. */
function ramp(hue: number, chroma: number): Ramp {
  const out: Ramp = {};
  for (let n = 1; n <= 12; n++) {
    const L = 8 + (n - 1) * (92 - 8) / 11;
    const C = chroma * Math.sin((Math.PI * (n - 1)) / 11);
    out[n] = fromLch(L, C, hue);
  }
  return out;
}
const RAMPS: Record<string, Ramp> = {
  Primary: ramp(115, 40), Secondary: ramp(23, 45), Tertiary: ramp(64, 48),
  Neutral: ramp(0, 0),
  Error: ramp(30, 65), Warning: ramp(77, 60), Success: ramp(150, 55), Info: ramp(289, 70),
};
const PROFILE = RAMPS.Primary;

/* Every theme's version of a ground. Brightest is light, Dimmest is dark. */
const BRIGHTEST = ['#ffffff', '#fdf6f6', '#f7f9f0', '#f4f7fb'];
const DIMMEST = ['#121212', '#1a1010', '#101a12', '#10131a'];

const HUES = chooseHues(8, RAMPS, PROFILE);
const solve = (grounds: string[]) => solveGround({ ramps: RAMPS, grounds, hues: HUES, profile: PROFILE });

describe('chart palette — the contract', () => {
  it('places every one of the sixteen series', () => {
    for (const grounds of [BRIGHTEST, DIMMEST]) {
      const s = solve(grounds);
      expect(s.unsolvable).toEqual([]);
      expect(Object.keys(s.picks)).toHaveLength(16);
    }
  });

  /* THE claim the whole design rests on. Chart colours are theme-independent,
     and this is what makes that true rather than assumed: a tone is only
     usable if it clears 3:1 against EVERY theme's version of the ground. */
  it('clears 3:1 against every theme of a ground, not just one', () => {
    for (const grounds of [BRIGHTEST, DIMMEST]) {
      const s = solve(grounds);
      for (const [name, { hex }] of Object.entries(s.picks))
        for (const g of grounds)
          expect(contrast(g, hex), `${name} on ${g}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  /* Tones 1-2 and 11-12 carry almost no chroma. A series pushed there reads as
     "black" rather than as itself, and stops being recognisable across grounds. */
  it('keeps every tone inside the chromatic band', () => {
    for (const grounds of [BRIGHTEST, DIMMEST])
      for (const { tone } of Object.values(solve(grounds).picks)) {
        expect(tone).toBeGreaterThanOrEqual(TONE_BAND[0]);
        expect(tone).toBeLessThanOrEqual(TONE_BAND[1]);
      }
  });

  /* Enforced, not merely reported: unconstrained, the real brand produced
     eleven pairs that read as one colour at two lightnesses. */
  it('leaves no ordinal-looking pairs', () => {
    for (const grounds of [BRIGHTEST, DIMMEST])
      expect(solve(grounds).ordinalPairs).toEqual([]);
  });

  /* A series must keep one hue on every ground — if it changed, the legend
     would name a colour the chart does not use. */
  it('chooses hues once, independently of any ground', () => {
    expect(chooseHues(8, RAMPS, PROFILE)).toEqual(HUES);
    expect(HUES).toHaveLength(8);
  });

  it('separates the generated hues from the brand hues', () => {
    const brand = ['Primary', 'Secondary', 'Tertiary'].map((n) => lch(RAMPS[n][REF_TONE])[2]);
    for (const h of HUES)
      expect(Math.min(...brand.map((b) => hueArc(h, b))), `hue ${h}`).toBeGreaterThan(5);
  });

  it('reports a series that cannot be placed rather than placing it badly', () => {
    /* A mid-grey ground nothing in a grey ramp can clear 3:1 against. */
    const s = solveGround({ ramps: { Neutral: RAMPS.Neutral }, grounds: ['#777777'],
                            hues: [], profile: PROFILE });
    expect(s.unsolvable).toContain('Chart-Neutral');
    expect(s.picks['Chart-Neutral']).toBeUndefined();
  });
});

describe('chart palette — colour maths', () => {
  it('measures contrast the way WCAG does', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('takes the WORST of normal and the two CVD simulations', () => {
    /* red vs green survives normal vision and collapses under deuteranopia —
       which is why separation() cannot just be deltaE */
    const s = separation('#d02020', '#20a040');
    expect(s).toBeLessThan(40);
  });

  it('calls a shared hue at distant lightness ordinal, and similar lightness not', () => {
    expect(isOrdinalPair('#f0c0c8', '#3a1016')).toBe(true);
    expect(isOrdinalPair('#c0607a', '#b06a70')).toBe(false);
  });

  it('keeps a generated ramp on its hue', () => {
    const r = rampForHue(200, PROFILE);
    for (const n of [4, 6, 8]) {
      const [, C, H] = lch(r[n]);
      if (C > 2) expect(hueArc(H, 200)).toBeLessThan(12);
    }
  });
});

/* ── The two ramps must BOTH be sound ──────────────────────────────────────
 *
 * The tone is shared across modes and each mode emits from its own ramp, so a
 * tone validated against one ramp and emitted from the other is only half
 * checked. That shipped: the real brand's Primary is #3f4525 at t4 in light
 * (chroma 20, clears an 18 floor) and #2a2e1b in dark (chroma 13, nowhere near
 * it), and a near-black landed in the dark palette unverified.
 *
 * The fixture above cannot catch this — it gives both modes identical ramps —
 * so these build a pair that genuinely diverges, the way a real brand's do:
 * the dark ramp loses chroma at the low tones while the light one keeps it.
 */
describe('a tone must satisfy BOTH modes ramps', () => {
  /** chroma peaks mid-ramp, as the light ramps do */
  const lightRamp = (hue: number, c: number): Ramp => {
    const out: Ramp = {};
    for (let n = 1; n <= 12; n++)
      out[n] = fromLch(8 + ((n - 1) * 84) / 11, c * Math.sin((Math.PI * (n - 1)) / 11), hue);
    return out;
  };
  /** chroma collapses below t6, as the real dark ramps do */
  const darkRamp = (hue: number, c: number): Ramp => {
    const out: Ramp = {};
    for (let n = 1; n <= 12; n++) {
      const base = c * Math.sin((Math.PI * (n - 1)) / 11);
      out[n] = fromLch(8 + ((n - 1) * 84) / 11, n < 6 ? base * 0.35 : base, hue);
    }
    return out;
  };
  const build = (f: (h: number, c: number) => Ramp): Record<string, Ramp> => ({
    Primary: f(115, 40), Secondary: f(23, 45), Tertiary: f(64, 48), Neutral: f(0, 0),
    Error: f(30, 65), Warning: f(77, 60), Success: f(150, 55), Info: f(289, 70),
  });
  const LIGHT = build(lightRamp);
  const DARK = build(darkRamp);
  const BRIGHTEST = ['#ffffff', '#fdf6f6', '#f7f9f0'];

  const floorFor = (name: string) =>
    (BRAND_SERIES as readonly string[]).includes(name.replace('Chart-', ''))
      ? BRAND_CHROMA_FLOOR : CHROMA_FLOOR;

  const hues = chooseHues(6, LIGHT, LIGHT.Primary);
  const altRampOf = (name: string) =>
    DARK[name.replace('Chart-', '').replace('State-', '')]
    ?? rampForHue(hues[Number(name.replace('Chart-', '')) - 5], DARK.Primary);

  it('the alt ramp clears 3:1 at the chosen tone', () => {
    const sol = solveGround({ ramps: LIGHT, grounds: BRIGHTEST, hues, profile: LIGHT.Primary, altRamps: DARK });
    for (const [name, pick] of Object.entries(sol.picks)) {
      const alt = altRampOf(name)[pick.tone];
      for (const g of BRIGHTEST)
        expect(contrast(g, alt), `${name} t${pick.tone} dark ${alt} on ${g}`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  /* `widened` is the escape hatch for a series with no tone above the floor —
     Neutral is grey, chroma ~0, and can never meet one. So the contract is not
     "every series clears the floor" but "every series either clears it or is
     reported as not having", and the report is what a reader can act on. */
  it('the alt ramp clears the chroma floor, or the series is reported widened', () => {
    const sol = solveGround({ ramps: LIGHT, grounds: BRIGHTEST, hues, profile: LIGHT.Primary, altRamps: DARK });
    for (const [name, pick] of Object.entries(sol.picks)) {
      if (sol.widened.includes(name)) continue;
      const alt = altRampOf(name)[pick.tone];
      expect(lch(alt)[1], `${name} t${pick.tone} dark ${alt}`)
        .toBeGreaterThanOrEqual(floorFor(name));
    }
  });

  it('reports Neutral as widened rather than silently dropping its floor', () => {
    const sol = solveGround({ ramps: LIGHT, grounds: BRIGHTEST, hues, profile: LIGHT.Primary, altRamps: DARK });
    expect(sol.widened).toContain('Chart-Neutral');
  });

  /* Teeth: without altRamps the solver is free to pick a tone the dark ramp
     cannot carry. If this ever stops finding one, the two fixtures have
     stopped diverging and the two tests above are no longer proving anything. */
  it('would pick an unsound tone if the alt ramp were not checked', () => {
    const sol = solveGround({ ramps: LIGHT, grounds: BRIGHTEST, hues, profile: LIGHT.Primary });
    const unsound = Object.entries(sol.picks).filter(([name, pick]) => {
      if (sol.widened.includes(name)) return false;
      const alt = altRampOf(name)[pick.tone];
      return lch(alt)[1] < floorFor(name);
    });
    expect(unsound.length, 'the fixtures no longer diverge — this guard is inert')
      .toBeGreaterThan(0);
  });
});
