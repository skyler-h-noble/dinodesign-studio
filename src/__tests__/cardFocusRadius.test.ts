/**
 * A card's focus ring is concentric with the card, at EVERY size.
 *
 * Figma held Card-Radius = 14 / 18 / 23 and Card-Focus-Radius = 21 / 21 / 21,
 * because the payload emitted one focus radius and componentSizeGroup repeated
 * it into all three size modes. The small card drew a 21px ring around a 14px
 * corner. It survived review because a single number IS correct for one of the
 * three sizes — the medium card looked right, so the other two read as a
 * rendering artefact rather than a wrong token.
 *
 * Asserted as a RELATIONSHIP (ring = corner + 3) rather than against fixed
 * numbers, so it still holds when a brand moves its card radius.
 */
import { describe, it, expect } from 'vitest';
import { computeRadii } from '../utils/componentRadii';
import { componentSizePayload } from '../utils/componentSize';

/* buttonRadius is a PERCENT of the button height, not pixels — varying it as
   pixels moves nothing and makes the four cases one case. */
const INPUTS = [
  { label: 'compact', buttonHeight: 32, buttonRadius: 12, cardPadding: 8 },
  { label: 'default', buttonHeight: 40, buttonRadius: 25, cardPadding: 16 },
  { label: 'pill',    buttonHeight: 48, buttonRadius: 50, cardPadding: 24 },
  { label: 'square',  buttonHeight: 44, buttonRadius: 0,  cardPadding: 12 },
] as const;

const radiiFor = (i: typeof INPUTS[number]) =>
  computeRadii({
    buttonHeight: i.buttonHeight,
    smallButtonHeight: Math.round(i.buttonHeight * 0.75),
    largeButtonHeight: Math.round(i.buttonHeight * 1.25),
    buttonRadius: i.buttonRadius,
    iconButtonRadius: i.buttonRadius,
    inputRadius: 4,
    cardPadding: i.cardPadding,
  });

describe('card focus radius follows the card at every size', () => {
  it.each(INPUTS)('$label: each ring is its own corner + 3', (input) => {
    const r = radiiFor(input);
    expect(r.cardFocusRadius).toBe(r.cardRadius + 3);
    expect(r.smCardFocusRadius).toBe(r.smCardRadius + 3);
    expect(r.lgCardFocusRadius).toBe(r.lgCardRadius + 3);
  });

  it.each(INPUTS)('$label: the three are NOT one number repeated', (input) => {
    const r = radiiFor(input);
    /* Not "all three differ" — a brand whose radii collapse (square, or capped
       at CARD_RADIUS_MAX) legitimately produces ties. The claim is narrower and
       is the one that failed: the small/large ring tracks the small/large CARD,
       not the medium one. */
    if (r.smCardRadius !== r.cardRadius) {
      expect(r.smCardFocusRadius).not.toBe(r.cardFocusRadius);
    }
    if (r.lgCardRadius !== r.cardRadius) {
      expect(r.lgCardFocusRadius).not.toBe(r.cardFocusRadius);
    }
  });

  it('is ordered the way the cards are', () => {
    const r = radiiFor(INPUTS[1]);
    expect(r.smCardFocusRadius).toBeLessThanOrEqual(r.cardFocusRadius);
    expect(r.cardFocusRadius).toBeLessThanOrEqual(r.lgCardFocusRadius);
  });
});

describe('the Figma payload carries a ring per size MODE', () => {
  const r = radiiFor(INPUTS[1]);
  /* componentSizePayload already returns the mode-keyed shape — it runs the
     groups through componentSizeFigma itself. Feeding its output back in
     produces keys like `medium/Card/Card-Radius`, which is how this test
     first "failed". */
  const byMode = componentSizePayload(r as never, {}, {} as never);
  const NAME = 'Card/Card-Focus-Radius';

  it('writes the name into all three modes', () => {
    /* The Sm-/Lg- prefix is what BECOMES the mode — componentSizeGroup strips
       it. A missing prefixed name does not error: the column silently keeps
       whatever it held, which here was medium. Hence presence, not just value. */
    for (const mode of ['medium', 'small', 'large'] as const) {
      expect(byMode[mode], mode).toHaveProperty(NAME);
    }
  });

  it('sends the numbers computeRadii produced, not medium three times', () => {
    expect(byMode.medium[NAME]).toBe(r.cardFocusRadius);
    expect(byMode.small[NAME]).toBe(r.smCardFocusRadius);
    expect(byMode.large[NAME]).toBe(r.lgCardFocusRadius);
    expect(byMode.small[NAME]).not.toBe(byMode.medium[NAME]);
    expect(byMode.large[NAME]).not.toBe(byMode.medium[NAME]);
  });

  it('stays concentric with the card in every mode', () => {
    const CARD = 'Card/Card-Radius';
    for (const mode of ['medium', 'small', 'large'] as const) {
      expect(byMode[mode][NAME], mode).toBe((byMode[mode][CARD] as number) + 3);
    }
  });
});
