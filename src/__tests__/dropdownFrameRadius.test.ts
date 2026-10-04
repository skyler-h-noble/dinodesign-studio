import { describe, it, expect } from 'vitest';
import { computeRadii } from '../utils/componentRadii';

const base = {
  buttonRadius: 20, iconButtonRadius: 50, inputRadius: 20,
  cardPadding: 16, buttonHeight: 44, smallButtonHeight: 32, largeButtonHeight: 56,
};

describe('Dropdown-Frame-Radius', () => {
  it('follows the input at ordinary radii', () => {
    const r = computeRadii({ ...base, inputRadius: 18 });
    expect(r.dropdownFrameRadius).toBe(r.inputRadius);
    expect(r.dropdownFrameRadius).toBeLessThanOrEqual(16);
  });

  it('never exceeds 16px, however round the input is asked to be', () => {
    /* This asserted the INPUT came out over 16 — a pill field at 50% of 44px
       is 22 — and that the frame capped anyway. The input is capped at 16 at
       source now, so that premise is gone by construction: the frame can no
       longer be pulled past the ceiling by the input, because the input
       cannot get there.
       The guarantee is unchanged and still worth asserting; what changed is
       that it now holds for a second reason. Kept rather than deleted,
       because a ceiling that is only redundant while another rule happens to
       agree is one worth keeping a test on — the input cap could be raised by
       someone who never reads this file. */
    const r = computeRadii({ ...base, inputRadius: 50 });
    expect(r.inputRadius).toBeLessThanOrEqual(16);
    expect(r.dropdownFrameRadius).toBe(16);
  });

  it('is never rounder than a card', () => {
    // Square-ish cards with a round input: the card is the binding constraint,
    // so a floating panel does not out-round the surfaces beneath it.
    const r = computeRadii({ ...base, buttonRadius: 5, inputRadius: 50, cardPadding: 0 });
    expect(r.dropdownFrameRadius).toBeLessThanOrEqual(r.cardRadius);
  });

  it('goes square when the system is square', () => {
    const r = computeRadii({ ...base, buttonRadius: 0, inputRadius: 0, cardPadding: 0 });
    expect(r.dropdownFrameRadius).toBe(0);
  });

  it('is always the min of its three bounds', () => {
    for (const inputRadius of [0, 10, 25, 50, 100]) {
      for (const cardPadding of [0, 8, 24]) {
        for (const buttonRadius of [0, 20, 50]) {
          const r = computeRadii({ ...base, inputRadius, cardPadding, buttonRadius });
          expect(r.dropdownFrameRadius).toBe(Math.min(r.inputRadius, r.cardRadius, 16));
        }
      }
    }
  });
});

/* The row and its ring are SQUARE, and that is a rule rather than a number.
 *
 * The rows run full-bleed inside the panel, so the panel's own clip rounds the
 * first and last of them — a radius on the row itself draws a second curve
 * inside the first.
 *
 * This previously derived `max(0, frame - 8)`, on the assumption the rows sat
 * 8px inside the panel. For a square-ish brand that returned 0 and looked
 * right; for a rounder one it would have started returning 4, 6, 8 and brought
 * the double curve back. So the assertions below are that it is zero ACROSS
 * THE RANGE, not that it is zero for the fixture — a derivation that happens to
 * agree at one brand is exactly what was wrong before.
 */
describe('Menu-Item-Radius and Menu-Focus-Radius', () => {
  it('is square at every frame radius, including the roundest', () => {
    for (const inputRadius of [0, 4, 9, 12, 18, 50, 100]) {
      for (const cardPadding of [0, 8, 24]) {
        const r = computeRadii({ ...base, inputRadius, cardPadding });
        expect(`${inputRadius}/${cardPadding}: ${r.menuItemRadius}/${r.menuFocusRadius}`)
          .toBe(`${inputRadius}/${cardPadding}: 0/0`);
      }
    }
  });

  it('does not track the frame', () => {
    /* The specific regression: a rounder brand quietly giving the rows a
       corner. The frame must be free to move without the row following. */
    const square = computeRadii({ ...base, inputRadius: 0, cardPadding: 0 });
    const round = computeRadii({ ...base, inputRadius: 50, cardPadding: 24 });
    expect(round.dropdownFrameRadius).toBeGreaterThan(square.dropdownFrameRadius);
    expect(round.menuItemRadius).toBe(square.menuItemRadius);
  });

  it('keeps the 16px frame ceiling, which full-bleed rows are the reason for', () => {
    /* The cap and the square row are one decision. While the rows were inset
       the cap had no justification; asserting them together means neither can
       be changed without meeting the other. */
    const r = computeRadii({ ...base, inputRadius: 100, cardPadding: 24 });
    expect(r.dropdownFrameRadius).toBe(16);
    expect(r.menuItemRadius).toBe(0);
  });
});

/* A modal's corner is a card's corner.
 *
 * This suite passed unchanged while Modal-Radius was 24 for every brand, and
 * again after it started tracking the card — nothing asserted it either way.
 * That is the gap being closed: the old value was not wrong in an obvious
 * place, it simply never moved, and a constant wearing a derivation looks
 * exactly like a derivation.
 *
 * The rule is the one Dropdown-Frame-Radius already states above: a floating
 * surface must not be rounder than the cards it sits on top of. A modal is the
 * other floating surface.
 */
describe('Modal-Radius', () => {
  const at = (buttonRadius: number) => computeRadii({ ...base, buttonRadius });

  it('equals Card-Radius at every brand radius', () => {
    for (const buttonRadius of [0, 4, 8, 16, 20, 28, 50, 100]) {
      const r = at(buttonRadius);
      expect(`${buttonRadius}%: ${r.modalRadius}`).toBe(`${buttonRadius}%: ${r.cardRadius}`);
    }
  });

  it('MOVES with the brand — it is not a constant', () => {
    /* The actual defect. `min(cardCornerBase + modalPadding, 24)` could only
       ever return 24, because modalPadding floors at 24 (cardPadding floors at
       16, times 1.5). Asserting it equals Card-Radius would pass on a table
       where both were pinned, so assert the range too. */
    const seen = new Set([0, 8, 20, 100].map((b) => at(b).modalRadius));
    expect(seen.size).toBeGreaterThan(1);
    expect(at(0).modalRadius).toBeLessThan(at(100).modalRadius);
  });

  it('is never rounder than the cards inside it, at EITHER end', () => {
    /* The old cap held this at the round end and broke it at the square one:
       a square brand drew 16px cards inside a 24px modal. Both ends, or the
       assertion is the one that was already passing. */
    for (const buttonRadius of [0, 4, 8, 16, 20, 28, 50, 100]) {
      const r = at(buttonRadius);
      expect(`${buttonRadius}%: ${r.modalRadius <= r.cardRadius}`).toBe(`${buttonRadius}%: true`);
    }
  });

  it('keeps the padding at 1.5x a card\'s — only the CORNER changed', () => {
    /* Modal-Padding was not part of this and should not have moved. It is the
       one modal value that reaches Figma now. */
    for (const buttonRadius of [0, 20, 100]) {
      const r = at(buttonRadius);
      expect(`${buttonRadius}%: ${r.modalPadding}`).toBe(`${buttonRadius}%: ${Math.round(r.cardPadding * 1.5)}`);
    }
  });

  it('carries the inner and focus radii with it', () => {
    /* Both derive from modalRadius, so they were frozen too — 23 and 27 for
       every brand. Neither reaches Figma any more (a modal does not take
       focus), but both are still in the CSS. */
    const square = at(0);
    const round = at(100);
    expect(square.modalInnerRadius).toBeLessThan(round.modalInnerRadius);
    expect(square.modalFocusRadius).toBeLessThan(round.modalFocusRadius);
  });
});
