/**
 * --Header-Clamped-Weight — the floor small headers read instead of the brand's
 * own header weight.
 *
 * A 250 that reads elegant at 48px reads washed out at 18px, so H4-H6 take
 * max(brand's pick, floor) while H1-H3 keep the brand's weight untouched.
 *
 * The name matches the Figma variable exactly. If one side is renamed and the
 * other is not, the CSS still parses and Figma still imports — they just stop
 * describing the same thing, which is the failure this whole file guards.
 */
import { describe, it, expect } from 'vitest';
import { typographyDeclarations } from '../utils/cssgen/generateTypographyTokensCSS';
import { HEADER_CLAMPED_WEIGHT_FLOOR, CLAMPED_HEADER_STEPS } from '../utils/typeScale';

const css = (headerWeight: string, family = 'Inter') =>
  typographyDeclarations([
    { type: 'header', family, weight: headerWeight, letterSpacing: '0em', allCaps: false },
    { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
    { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
  ] as never);

const read = (text: string, token: string) =>
  (text.match(new RegExp(`--${token}:\\s*([^;]+);`)) || [])[1]?.trim() ?? null;

describe('--Header-Clamped-Weight', () => {
  it('is emitted, under the name Figma uses', () => {
    expect(read(css('400'), 'Header-Clamped-Weight')).not.toBeNull();
  });

  it('raises a light brand weight to the floor', () => {
    expect(read(css('250'), 'Header-Clamped-Weight')).toBe(String(HEADER_CLAMPED_WEIGHT_FLOOR));
  });

  // A floor, not a fixed value. This exists to strengthen small headers, so
  // applying it to a bold brand would be the opposite of the intent.
  it('leaves a brand heavier than the floor alone', () => {
    expect(read(css('700'), 'Header-Clamped-Weight')).toBe('700');
  });

  it('H1-H3 keep the brand weight; H4-H6 link to the clamp', () => {
    const text = css('250');
    for (const step of ['H1', 'H2', 'H3']) {
      expect(`${step}=${read(text, `${step}-Font-Weight`)}`)
        .toBe(`${step}=var(--Font-Weight-Header)`);
    }
    for (const step of CLAMPED_HEADER_STEPS) {
      expect(`${step}=${read(text, `${step}-Font-Weight`)}`)
        .toBe(`${step}=var(--Header-Clamped-Weight)`);
    }
  });

  // The failure you would otherwise only notice by eye, on one brand, later:
  // asking a static 400/700 face for 500 snaps somewhere, and if it snaps to
  // the same place as the unclamped weight the clamp does nothing at all.
  it('still differs from the face weight after snapping, on a light brand', () => {
    const text = css('250');
    const face = read(text, 'Font-Weight-Header');
    const clamped = read(text, 'Header-Clamped-Weight');
    expect(`face=${face} clamped=${clamped} distinct=${face !== clamped}`)
      .toBe(`face=${face} clamped=${clamped} distinct=true`);
  });

  // The property that defines this token: it RAISES or it does nothing. At or
  // above the floor the brand's value must pass through byte-identical — not
  // snapped, since snapping a value we are not changing can move it.
  it('is a no-op at or above the floor, on every face', () => {
    for (const family of ['Inter', 'Anton', 'Caveat', 'Public Sans']) {
      for (const w of ['500', '600', '700', '800', '900']) {
        const text = css(w, family);
        expect(`${family}/${w} -> ${read(text, 'Header-Clamped-Weight')}`)
          .toBe(`${family}/${w} -> ${w}`);
      }
    }
  });

  it('raises every weight below the floor, on every face', () => {
    for (const family of ['Inter', 'Anton', 'Caveat']) {
      for (const w of ['100', '200', '250', '300', '400']) {
        const v = Number(read(css(w, family), 'Header-Clamped-Weight'));
        expect(`${family}/${w} raised=${v > Number(w)}`).toBe(`${family}/${w} raised=true`);
      }
    }
  });

  it('never emits a weight outside the CSS range', () => {
    for (const w of ['1', '100', '250', '400', '700', '900', '1000']) {
      const v = Number(read(css(w), 'Header-Clamped-Weight'));
      expect(`${w}->${v} inRange=${v >= 100 && v <= 1000}`).toBe(`${w}->${v} inRange=true`);
    }
  });
});
