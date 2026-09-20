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
} from '../utils/typeScale';

const mixed = { caps: false, opszTracksSize: false };
const caps = { caps: true, opszTracksSize: false };
const em = (v: string) => parseFloat(v);

describe('the anchor', () => {
  it('returns the user value untouched at the anchor size', () => {
    /* The user sees the number they typed on at least one step, which is what
       keeps "anchor" an honest description of it. */
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

  it('tightens down the ramp for a face without opsz', () => {
    const headers = headersOf('Lato');
    const byToken = Object.fromEntries(headers.map((h) => [h.token, parseFloat(h.letterSpacing)]));
    expect(byToken.H6).toBe(0);
    expect(byToken.H1).toBeLessThan(byToken.H3);
    expect(byToken.H3).toBeLessThan(byToken.H6);
  });
});
