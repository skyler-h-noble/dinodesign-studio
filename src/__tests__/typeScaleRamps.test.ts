/**
 * Where a type group's STEPS end and its variants begin.
 *
 * Two groups reshaped in the same pass, for the same underlying reason: a
 * group only reads as a scale when every entry in it is a size. Caption had
 * one size pretending to be a ramp; Label had a case variant pretending to be
 * a fourth step. Both distorted the "how many sizes does this group have"
 * question that decides which groups can carry a Dynamic twin against
 * Component-Size's three modes.
 *
 * ── Caption is a three-step ramp, one step below Body at every mode ───────
 *
 * It used to be a single 14 — which was fine while it sat beside Body-Medium's
 * 16 and nothing scaled. It stops being fine once a card's size mode drives the
 * type inside it: Body-Small is ALSO 14, so a small card would have rendered
 * its caption and its body at the same size, same leading, separated only by a
 * 100-weight step and a 0.1px nudge of tracking. The hierarchy would have
 * disappeared exactly where a small card needs it most.
 *
 * So the assertions here are about the GAP, not about three numbers. The
 * numbers are Body's, shifted; what has to hold is that the shift holds at
 * every step.
 */
import { describe, it, expect } from 'vitest';
import { buildTypeScale, BODY_SIZES, BODY_LINE_HEIGHT } from '../utils/typeScale';

const scale = buildTypeScale(null);
const byToken = (token: string) => scale.find((s) => s.token === token);

const CAPTION_STEPS = ['Caption-Small', 'Caption', 'Caption-Large'] as const;

describe('the Caption ramp', () => {
  it('has three steps', () => {
    for (const token of CAPTION_STEPS) {
      expect(`${token}: ${byToken(token) !== undefined}`).toBe(`${token}: true`);
    }
  });

  it('keeps the bare name as the MIDDLE step', () => {
    /* The lib reads `--Caption-Font-Size` with no step (Typography.js:339) and
       generated CSS is frozen per design system, so an old stylesheet and the
       shipped component both depend on the unsuffixed name resolving. Renaming
       it to Caption-Medium for tidiness is the Button-Standard trap: the var()
       goes undefined and the component falls through to nothing. */
    expect(byToken('Caption')?.size).toBe(14);
    expect(byToken('Caption-Medium')).toBeUndefined();
  });

  it('sits exactly one step below Body at every mode', () => {
    /* The whole reason the ramp exists. Asserted against BODY_SIZES rather
       than against 12/14/16 so that moving Body moves this test's expectation
       with it — a caption that stopped tracking body would otherwise pass
       here while the gap silently closed. */
    const body = BODY_SIZES.map((b) => b.size);          // 14 / 16 / 18
    const caption = CAPTION_STEPS.map((t) => byToken(t)!.size);
    expect(caption).toEqual(body.map((s) => s - 2));
  });

  it('is never the same size as any Body step it shares a mode with', () => {
    /* The specific failure: flat Caption 14 == Body-Small 14. At small they
       were one style wearing two names. */
    for (let i = 0; i < CAPTION_STEPS.length; i++) {
      expect(byToken(CAPTION_STEPS[i])!.size).not.toBe(BODY_SIZES[i].size);
    }
  });

  it('carries Body leading — 1.5 — at every step', () => {
    for (const token of CAPTION_STEPS) {
      const s = byToken(token)!;
      expect(`${token}: ${s.lineHeight / s.size}`).toBe(`${token}: ${BODY_LINE_HEIGHT}`);
    }
  });

  it('scales paragraph spacing with the size', () => {
    /* A multiple of the type (2x, which the original 14/28 already was), so
       the vertical rhythm survives a size change instead of a small caption
       carrying a medium caption's gap. */
    const sizes = CAPTION_STEPS.map((t) => byToken(t)!.size);
    const spacing = CAPTION_STEPS.map((t) => byToken(t)!.paragraphSpacing);
    expect(spacing).toEqual(sizes.map((s) => s * 2));
  });

  it('tracks the smaller steps MORE, because the px nudge is constant', () => {
    /* The scale stores character spacing in px and converts to em on the way
       out, so one flat 0.1px becomes 0.0083 / 0.0071 / 0.0063em — more
       relative air at 12 than at 16.
     *
     * That direction is the optical rule Eyebrow states explicitly (smaller
     * type needs more air) and it arrives here for free from the unit
     * conversion rather than from a hand-tuned ramp. Asserted as ORDERING, not
     * as three numbers: the values follow from the sizes, and pinning them
     * would mean editing this test every time Body moves. */
    const em = CAPTION_STEPS.map((t) => parseFloat(String(byToken(t)!.letterSpacing)));
    expect(em[0]).toBeGreaterThan(em[1]);
    expect(em[1]).toBeGreaterThan(em[2]);
  });

  it('carries Bold at every step, with the TOKEN unchanged', () => {
    /* Three styles, and they cost no new weight variable in Figma — 700 is
       size-independent, so each composes its own step's size, leading and
       tracking with the weight.

       The tokens are what must not move: the middle step's is `Caption-Bold`
       because its base token is the bare `Caption`, and the lib resolves
       `fw('Caption-Bold')` -> --Caption-Bold-Font-Weight (Typography.js:350).
       Renaming the STEP to Medium changes the Figma style name and leaves that
       token alone, which is the whole reason the rename was cheap. */
    for (const token of CAPTION_STEPS) {
      expect(`${token}: ${JSON.stringify(byToken(token)?.extraWeights)}`)
        .toBe(`${token}: [{"suffix":"Bold","weight":700}]`);
    }
  });

  it('names the middle step Medium while its token stays bare', () => {
    /* The step and the token deliberately disagree. `step` names the Figma
       style — Caption/Medium, the middle of three, which is what a designer
       reads. `token` names the CSS custom property, and --Caption-* is what the
       lib and every frozen stylesheet already resolve.

       Legal and Badge keep `Standard` on purpose: there it means "one size",
       and Medium would advertise siblings that do not exist. */
    const mid = byToken('Caption')!;
    expect(`${mid.step} / ${mid.token} / ${mid.name}`)
      .toBe('Medium / Caption / Caption/Medium');
    for (const t of ['Legal', 'Badge'] as const) {
      expect(`${t} step: ${byToken(t)?.step}`).toBe(`${t} step: Standard`);
    }
  });
});

/* Label's All-Caps entries are CASE VARIANTS, not steps.
 *
 * Medium All Caps shipped alone for a long time, which made the group read as
 * four sizes and one oddity — and made the "four sizes against three modes"
 * problem look real when the actual shape is three sizes x two cases.
 *
 * The assertion is that a variant differs from its base in the transform and
 * in NOTHING else. That is what makes it a variant: if a caps style drifted to
 * its own size or its own tracking it would be a step, and the group would be
 * back to reading as five or six sizes.
 */
describe('Label All-Caps mirrors its base step', () => {
  const PAIRS = [
    ['Label-Small', 'Label-Small-All-Caps'],
    ['Label-Medium', 'Label-Medium-All-Caps'],
    ['Label-Large', 'Label-Large-All-Caps'],
  ] as const;

  it('exists at all three sizes', () => {
    for (const [, caps] of PAIRS) {
      expect(`${caps}: ${byToken(caps) !== undefined}`).toBe(`${caps}: true`);
    }
  });

  it('differs from its base ONLY in the transform', () => {
    for (const [base, caps] of PAIRS) {
      const b = byToken(base)!;
      const c = byToken(caps)!;
      expect(b.textTransform).toBe('none');
      expect(c.textTransform).toBe('uppercase');
      /* Compared as a whole object minus the two fields that are allowed to
         differ, so a property added to the scale later is covered without this
         test being updated to know about it. */
      const strip = (s: typeof b) => {
        const { token, name, textTransform, step, ...rest } = s as Record<string, unknown> & typeof b;
        return rest;
      };
      expect(strip(c)).toEqual(strip(b));
    }
  });

  it('inherits the base step tracking rather than adding a caps bump', () => {
    /* Uppercase usually wants more air, and Eyebrow does exactly that. Label
       does not: it already tracks its small steps (0.0455 / 0.02 / 0) for the
       same optical reason, and Medium All Caps has always matched Medium. A
       bump here would be a rule of thumb overriding the design, and it would
       make two cases of ONE step disagree about something that is not what
       distinguishes them. */
    for (const [base, caps] of PAIRS) {
      expect(byToken(caps)!.letterSpacing).toBe(byToken(base)!.letterSpacing);
    }
  });

  it('keeps ExtraSmall out of the pairing', () => {
    /* The off-ramp step, like Button-ExtraSmall: the lib reads it
       (Typography.js:361) but the design does not offer it as one of the three
       sizes, so it has no caps twin and is not part of the Dynamic mapping. */
    expect(byToken('Label-ExtraSmall')).toBeDefined();
    expect(byToken('Label-ExtraSmall-All-Caps')).toBeUndefined();
  });
});
