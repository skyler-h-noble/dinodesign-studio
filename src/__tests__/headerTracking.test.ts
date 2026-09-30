/**
 * Header tracking follows optical size.
 *
 * H1..H6 spans 48px to 18px by default and every step used to take the SAME
 * letter-spacing — the user's pick, applied flat. No single number is right
 * across a 2.7x range: type tightens as it grows.
 */
import { describe, it, expect } from 'vitest';
import {
  suggestedHeaderTracking, HEADER_TRACKING_ANCHOR_PX, HEADER_STEPS, buildTypeScale,
  faceTrackingDelta,
} from '../utils/typeScale';
import { MOOD_AXES } from '../utils/moodAxes';
import { buildTypographyTokensCSS } from '../utils/typographyTokens';

const mixed = { caps: false, opszTracksSize: false };
const caps = { caps: true, opszTracksSize: false };
const em = (v: string) => parseFloat(v);

describe('the anchor', () => {
  it('applies no SIZE delta at the anchor size', () => {
    /* With no face axes in play this is the user's value verbatim. With axes
       it is the baseline the face delta is measured from — the anchor is
       where the size curve is zero, not where the output equals the input. */
    expect(suggestedHeaderTracking('0.02em', HEADER_TRACKING_ANCHOR_PX, mixed)).toBe('0.02em');
    expect(suggestedHeaderTracking('0em', HEADER_TRACKING_ANCHOR_PX, mixed)).toBe('0em');
  });

  it('is the SMALLEST header, so larger steps tighten', () => {
    /* Anchoring at H1 instead would loosen the small headers, and a wrong
       value costs more readability at 18px than at 48px. */
    expect(HEADER_TRACKING_ANCHOR_PX).toBe(18);
    expect(HEADER_STEPS[HEADER_STEPS.length - 1].size).toBe(HEADER_TRACKING_ANCHOR_PX);
  });
});

describe('mixed-case headers tighten as they grow', () => {
  it('is monotonically tighter up the ramp', () => {
    const vals = HEADER_STEPS.map((s) => em(suggestedHeaderTracking('0em', s.size, mixed)));
    // HEADER_STEPS runs H1 (largest) to H6 (smallest)
    for (let i = 1; i < vals.length; i++) {
      expect(`${HEADER_STEPS[i].token} looser than ${HEADER_STEPS[i - 1].token}: ${vals[i] > vals[i - 1]}`)
        .toBe(`${HEADER_STEPS[i].token} looser than ${HEADER_STEPS[i - 1].token}: true`);
    }
  });

  it('takes about -0.02em off a 48px H1', () => {
    expect(suggestedHeaderTracking('0em', 48, mixed)).toBe('-0.02em');
  });

  it('carries the user value through as an offset, not a replacement', () => {
    /* A loose pick stays loose, just less so at the top. */
    expect(em(suggestedHeaderTracking('0.05em', 48, mixed)))
      .toBeCloseTo(0.05 - 0.02, 4);
  });
});

describe('all-caps flattens the curve rather than inverting it', () => {
  it('barely moves across the whole ramp', () => {
    /* Capitals are uniform in width and have no descenders, so they read
       CRAMPED at the tracking that suits mixed case — they want air at every
       size. Tightening them like mixed case would undo the one thing caps
       actually need. */
    const h1 = em(suggestedHeaderTracking('0.06em', 48, caps));
    const h6 = em(suggestedHeaderTracking('0.06em', 18, caps));
    expect(Math.abs(h1 - h6)).toBeLessThan(0.005);
  });

  it('keeps a positive anchor positive at the largest size', () => {
    expect(em(suggestedHeaderTracking('0.06em', 48, caps))).toBeGreaterThan(0.05);
  });

  it('moves far less than mixed case at the same size', () => {
    const capsDelta = Math.abs(em(suggestedHeaderTracking('0em', 48, caps)));
    const mixedDelta = Math.abs(em(suggestedHeaderTracking('0em', 48, mixed)));
    expect(capsDelta * 5).toBeLessThan(mixedDelta);
  });
});

describe('a face whose opsz follows the size is left alone', () => {
  it('returns the anchor unchanged at every size', () => {
    /* Only when the axis TRACKS the size. The header role pins one opsz for
       the whole ramp, so nothing passes true today — but the day opsz is
       emitted per step, this curve has to back off or the two corrections
       stack. */
    for (const s of HEADER_STEPS) {
      expect(suggestedHeaderTracking('0.01em', s.size, { caps: false, opszTracksSize: true }))
        .toBe('0.01em');
    }
  });
});

describe('units survive', () => {
  it('px in, px out', () => {
    /* em is the better unit for tracking and px is what the export emits
       today. Switching it here would change every brand's stylesheet SHAPE on
       top of changing the number. One change at a time. */
    expect(suggestedHeaderTracking('1.25px', 18, mixed)).toBe('1.25px');
    expect(suggestedHeaderTracking('1.25px', 48, mixed)).toMatch(/px$/);
  });

  it('a flat px anchor was already size-dependent, by accident', () => {
    /* 1.25px is 0.069em at 18px and 0.026em at 48px. Applying one px value
       across the ramp tracked in the right direction for the wrong reason,
       and by far too much. */
    const at48 = parseFloat(suggestedHeaderTracking('1.25px', 48, mixed));
    expect(at48 / 48).toBeLessThan(1.25 / 18);
  });

  it('handles a bare number and junk without throwing', () => {
    expect(suggestedHeaderTracking('0', 18, mixed)).toBe('0em');
    expect(suggestedHeaderTracking('', 18, mixed)).toBe('0em');
  });
});

describe('the real ramp', () => {
  /* buildTypeScale takes the raw picks, keyed by `type` — header / body /
     decorative — not resolved roles. */
  const styles = (headerFamily: string) => ([
    { type: 'header', family: headerFamily, weight: '600', letterSpacing: '0em', allCaps: false },
    { type: 'body', family: 'Lato', weight: '400', letterSpacing: '0em', allCaps: false },
    { type: 'decorative', family: headerFamily, weight: '600', letterSpacing: '0em', allCaps: false },
  ] as never);

  const headersOf = (family: string) =>
    buildTypeScale(styles(family)).filter((s) => s.group === 'Header');

  it('gives the six headers six different values', () => {
    /* The whole point. They were one value before. */
    const headers = headersOf('Lato');
    expect(headers.length).toBe(6);
    expect(new Set(headers.map((h) => h.letterSpacing)).size).toBe(6);
  });

  it('still adjusts a face that HAS an opsz axis but pins it', () => {
    /* Every header face carries opsz — it is always Google Sans Flex and the
       axes come from the mood. But the value is pinned for the whole role, so
       the font is held at one optical size across 48px to 18px and
       compensates for nothing. An early-out on `axes.opsz !== undefined`
       made this feature a no-op for every brand; this is the test that
       would have caught it. */
    expect(new Set(headersOf('Fraunces').map((h) => h.letterSpacing)).size).toBe(6);
  });

  it('tightens monotonically down the ramp', () => {
    /* H6 is where the SIZE delta is zero, NOT where the output equals the
       user's input: the face adjustment applies at every step including this
       one, because it is about the face and not the size. Exempting H6 would
       make it the only header ignoring the weight. */
    const byToken = Object.fromEntries(
      headersOf('Lato').map((h) => [h.token, parseFloat(h.letterSpacing)]));
    expect(byToken.H1).toBeLessThan(byToken.H3);
    expect(byToken.H3).toBeLessThan(byToken.H6);
  });
});

/* ── The face's own settings ─────────────────────────────────────────────
 *
 * The Header is always Google Sans Flex, so "which face did the user pick" is
 * really "where are wght, wdth and GRAD set" — the mood moves the axes.
 */
describe('the face axes shift the tracking', () => {
  it('a heavier face asks for MORE air, not less', () => {
    /* The opposite of the usual shorthand about tightening bold headlines —
       that advice is about SIZE, which the size curve already handles.
       Picture "AV" at 48px in Thin and in Black: in Black the stems are thick
       and the letters nearly touch, so pulling them closer makes them
       collide; in Thin the gap yawns and wants closing. The sidebearings are
       drawn for the middle of the range and the stroke eats into them as
       weight climbs. */
    expect(faceTrackingDelta(MOOD_AXES.Bold))
      .toBeGreaterThan(faceTrackingDelta(MOOD_AXES.Elegant));
    expect(faceTrackingDelta({ wght: 800 })).toBeGreaterThan(0);
    expect(faceTrackingDelta({ wght: 250 })).toBeLessThan(0);
  });

  it('a condensed face asks for more air too', () => {
    /* Narrower letterforms come with proportionally tighter sidebearings, so
       they crowd sooner. Tech sits at wdth 72, the most condensed setting any
       mood uses. */
    expect(MOOD_AXES.Tech.wdth).toBe(72);
    expect(faceTrackingDelta({ wdth: 72 })).toBeGreaterThan(faceTrackingDelta({ wdth: 108 }));
  });

  it('grade counts for more per unit than weight does', () => {
    /* Grade thickens the stems WITHOUT changing the advance width — that is
       the point of the axis. So nothing compensates: the ink grows and the
       gap shrinks by exactly that much, where a weight change at least moves
       the metrics with it. */
    expect(faceTrackingDelta({ GRAD: 100 })).toBeGreaterThan(faceTrackingDelta({ wght: 500 }));
  });

  it('defaults to no shift when there are no axes', () => {
    expect(faceTrackingDelta(undefined)).toBe(0);
    expect(faceTrackingDelta({ wght: 400, wdth: 100, GRAD: 0 })).toBe(0);
  });

  it('stays smaller than the size curve, so size still leads', () => {
    /* These are heuristics with a defensible direction, not measured values.
       If the face could out-vote the optical curve, a Bold mood would undo
       the tightening a 48px heading needs. */
    const sizeSpan = Math.abs(parseFloat(suggestedHeaderTracking('0em', 48, mixed)));
    for (const axes of Object.values(MOOD_AXES)) {
      expect(`${Math.abs(faceTrackingDelta(axes)) < sizeSpan}`).toBe('true');
    }
  });

  it('reaches the built ramp', () => {
    /* Asserting the OUTPUT, not the helper. */
    const withAxes = (axes: Record<string, number>) => buildTypeScale([
      { type: 'header', family: 'X', weight: String(axes.wght), letterSpacing: '0em',
        allCaps: false, axes },
      { type: 'body', family: 'Lato', weight: '400', letterSpacing: '0em', allCaps: false },
      { type: 'decorative', family: 'Lato', weight: '600', letterSpacing: '0em', allCaps: false },
    ] as never).filter((s) => s.group === 'Header');

    const bold = withAxes(MOOD_AXES.Bold).find((h) => h.token === 'H1')!;
    const elegant = withAxes(MOOD_AXES.Elegant).find((h) => h.token === 'H1')!;
    expect(parseFloat(bold.letterSpacing)).toBeGreaterThan(parseFloat(elegant.letterSpacing));
  });
});

describe('every Google Sans Flex axis reaches the stylesheet', () => {
  /* font-variation-settings references these by var(). An undefined custom
     property with no fallback invalidates the WHOLE declaration — the browser
     drops it — so a missing axis variable does not lose one axis, it loses
     the face's entire variation string. */
  const css = buildTypographyTokensCSS([
    { type: 'header', family: 'X', weight: '800', letterSpacing: '0em', allCaps: false,
      axes: { wght: 800, wdth: 104, opsz: 144, slnt: 0, GRAD: 80, ROND: 0 } },
    { type: 'body', family: 'Lato', weight: '400', letterSpacing: '0em', allCaps: false },
    { type: 'decorative', family: 'Lato', weight: '600', letterSpacing: '0em', allCaps: false },
  ] as never);

  it.each([
    ['--Font-Weight-Header', '800'],
    ['--Font-Width-Header', '104'],
    ['--Font-Optical-Size-Header', '144'],
    ['--Font-Slant-Header', '0'],
    ['--Font-Grade-Header', '80'],
    ['--Font-Roundness-Header', '0'],
  ])('%s is defined as %s', (name, value) => {
    const decl = css.split('\n').map((l) => l.trim()).find((l) => l.startsWith(name + ':'));
    expect(decl).toBe(`${name}: ${value};`);
  });

  it('builds the variation string out of those variables', () => {
    const decl = css.split('\n').map((l) => l.trim())
      .find((l) => l.startsWith('--Font-Variation-Header:'));
    for (const tag of ['wdth', 'opsz', 'slnt', 'GRAD', 'ROND']) {
      expect(`${tag} in string: ${decl?.includes(`"${tag}"`)}`).toBe(`${tag} in string: true`);
    }
    /* wght is deliberately absent: it is spelled as font-weight, which maps to
       the same axis. Putting it in both places lets them disagree. */
    expect(decl).not.toContain('"wght"');
  });

  it('actually applies the string somewhere', () => {
    expect(css).toContain('font-variation-settings: var(--Font-Variation-Header);');
  });
});
