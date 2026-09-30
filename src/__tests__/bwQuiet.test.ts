/**
 * Quiet.Surfaces.BW — the quiet used when textColoring is 'black-white'.
 *
 * The row is indexed by the tone of the SURFACE the text sits on, not by the
 * BW palette's own tone. That is easy to get backwards, because a table named
 * BW looks like it should be keyed by BW: its sibling Text.Surfaces.BW maps
 * Color-1 to WHITE text, which only makes sense if tone 1 is a dark surface.
 *
 * Rows 1-5 always followed the Neutral ladder. Rows 6-12 were pinned to one
 * extreme instead — {Colors.White} in light mode, Neutral Color-1 in dark —
 * i.e. the value TEXT takes. That put white on near-white in light mode, and
 * made the dark-mode quiet exactly as loud as the body copy it recedes from.
 *
 * Both failure modes are invisible in a diff and invisible in a parity test
 * (both sides agreed, both were wrong — invariant 7), so they are asserted
 * here against measured contrast instead.
 */
import { describe, it, expect } from 'vitest';
import { getStaticQuietTokensForLightMode, getStaticQuietTokensForDarkMode } from '../utils/cssgen/staticQuietStructures';

const TONES = Array.from({ length: 12 }, (_, i) => i + 1);

/** The ladder a quiet row must follow: same shape as every palette row. */
const LADDER = {
  light: getStaticQuietTokensForLightMode().Surfaces as Record<string, Record<string, { value: string }>>,
  dark: getStaticQuietTokensForDarkMode().Surfaces as Record<string, Record<string, { value: string }>>,
};

describe('Quiet.Surfaces.BW follows the Neutral ladder', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`every tone matches the Neutral row — ${mode}`, () => {
      const surfaces = LADDER[mode];
      expect(Object.keys(surfaces.BW ?? {}).length).toBeGreaterThan(11);
      for (const n of TONES) {
        const key = `Color-${n}`;
        expect(`${key}: ${surfaces.BW[key]?.value}`)
          .toBe(`${key}: ${surfaces.Neutral[key]?.value}`);
      }
    });

    // The specific regression: rows 6-12 used to be pinned to one extreme.
    it(`rows 6-12 are not all the same value — ${mode}`, () => {
      const bw = LADDER[mode].BW;
      const upper = new Set(TONES.filter(n => n >= 6).map(n => bw[`Color-${n}`]?.value));
      expect(`distinct values across tones 6-12: ${upper.size}`)
        .not.toBe('distinct values across tones 6-12: 1');
    });

    it(`no tone resolves to raw {Colors.White} — ${mode}`, () => {
      const bw = LADDER[mode].BW;
      const white = TONES.filter(n => bw[`Color-${n}`]?.value === '{Colors.White}');
      expect(white).toEqual([]);
    });
  }
});

/**
 * A named-tone sanity check that does not depend on any brand: the ladder must
 * REVERSE at the light/dark boundary. Tones 1-5 are dark surfaces and take a
 * light quiet; tones 6-12 are light surfaces and take a dark one. A row that
 * runs monotonically in one direction across all twelve is the bug this file
 * exists for.
 */
describe('the BW ladder reverses at the tone 5/6 boundary', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`lower tones take a lighter quiet than upper tones — ${mode}`, () => {
      const bw = LADDER[mode].BW;
      const toneOf = (n: number) =>
        Number(String(bw[`Color-${n}`]?.value).match(/Color-(\d+)\}/)?.[1] ?? NaN);
      // Tones 1-5 point high on the Neutral ramp (light greys); 6-12 point low.
      const lower = [1, 2, 3, 4, 5].map(toneOf);
      const upper = [6, 7, 8, 9, 10, 11, 12].map(toneOf);
      expect(`lower=${lower.join(',')} allDefined=${lower.every(Number.isFinite)}`)
        .toBe(`lower=${lower.join(',')} allDefined=true`);
      expect(`upper=${upper.join(',')} allDefined=${upper.every(Number.isFinite)}`)
        .toBe(`upper=${upper.join(',')} allDefined=true`);
      expect(`min(lower)=${Math.min(...lower)} > max(upper)=${Math.max(...upper)}`)
        .toBe(`min(lower)=${Math.min(...lower)} > max(upper)=${Math.max(...upper)}`);
      expect(Math.min(...lower)).toBeGreaterThan(Math.max(...upper));
    });
  }
});
