/**
 * A list row's corner, and the ring that has to stay concentric with it.
 *
 * Both were literals in Figma: the row's radius was bound to `Sizing-1` — a
 * SPACING token, which also drove its padding, so the two could never move
 * independently — and the focus ring was a hand-typed 6 with no binding at all.
 * 6 happened to be right; nothing would have kept it right.
 *
 * Asserted as relationships, not numbers, so a brand changing its card radius
 * or a future padding control moves both together.
 */
import { describe, it, expect } from 'vitest';
import { computeRadii } from '../utils/componentRadii';
import { componentSizePayload } from '../utils/componentSize';

const INPUTS = [
  { label: 'square',  buttonHeight: 44, buttonRadius: 0,  cardPadding: 12 },
  { label: 'compact', buttonHeight: 32, buttonRadius: 12, cardPadding: 8 },
  { label: 'default', buttonHeight: 40, buttonRadius: 25, cardPadding: 16 },
  { label: 'pill',    buttonHeight: 48, buttonRadius: 50, cardPadding: 24 },
] as const;

const radiiFor = (i: typeof INPUTS[number]) => computeRadii({
  buttonHeight: i.buttonHeight,
  smallButtonHeight: Math.round(i.buttonHeight * 0.75),
  largeButtonHeight: Math.round(i.buttonHeight * 1.25),
  buttonRadius: i.buttonRadius,
  iconButtonRadius: i.buttonRadius,
  inputRadius: 4,
  cardPadding: i.cardPadding,
});

/* The density floor the padding never drops below, per size. Restated here so
   a change in componentRadii fails loudly rather than moving quietly. */
const FLOOR = { small: 8, medium: 12, large: 16 };
const FOCUS_INSET = 2;

describe('the list row corner', () => {
  it('ACTUALLY MOVES with the brand — it is not a constant in disguise', () => {
    /* One earlier version was min(cardRadius, padding), which returns 8 on
       EVERY brand: cardRadius has a floor of 16, so the cap always won. It
       looked like a derivation, reproduced the drawn value, and would have
       frozen the corner for every user of the studio. This is the assertion
       that would have caught it. */
    const values = INPUTS.map((i) => radiiFor(i).listItemRadius);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it('IS the button corner, per size — uncapped', () => {
    /* Uncapped on purpose. While the padding capped it AND the padding derived
       from it, the two defined each other. The radius is the input. */
    for (const i of INPUTS) {
      const r = radiiFor(i);
      expect(r.listItemRadius).toBe(r.buttonRadius);
      expect(r.smListItemRadius).toBe(r.smButtonRadius);
      expect(r.lgListItemRadius).toBe(r.lgButtonRadius);
    }
  });

  it('is square on a square brand, like the accordion it sits beside', () => {
    const square = radiiFor(INPUTS[0]);
    expect(square.buttonRadius).toBe(0);
    expect(square.listItemRadius).toBe(0);
    expect(square.accordionRadius).toBe(0);
  });
});

describe('the padding follows the corner', () => {
  it.each(INPUTS)('$label: never sits below the corner it wraps', (input) => {
    /* The old "radius <= padding" cap, now a CONSEQUENCE rather than a rule:
       max() cannot return less than its argument. Content near a corner has to
       clear the curve, so a rounder row is a roomier one. */
    const r = radiiFor(input);
    expect(r.listItemPadding).toBeGreaterThanOrEqual(r.listItemRadius);
    expect(r.smListItemPadding).toBeGreaterThanOrEqual(r.smListItemRadius);
    expect(r.lgListItemPadding).toBeGreaterThanOrEqual(r.lgListItemRadius);
  });

  it.each(INPUTS)('$label: never sits below the density floor', (input) => {
    const r = radiiFor(input);
    expect(r.smListItemPadding).toBeGreaterThanOrEqual(FLOOR.small);
    expect(r.listItemPadding).toBeGreaterThanOrEqual(FLOOR.medium);
    expect(r.lgListItemPadding).toBeGreaterThanOrEqual(FLOOR.large);
  });

  it('is exactly the floor on a square brand — the ladder the design draws', () => {
    const r = radiiFor(INPUTS[0]);
    expect([r.smListItemPadding, r.listItemPadding, r.lgListItemPadding]).toEqual([8, 12, 16]);
  });

  it('GROWS past the floor when the brand is round', () => {
    /* The point of deriving it. A stated ladder would leave a 24px corner with
       12px of padding and the content sitting inside the curve. */
    const pill = radiiFor(INPUTS[3]);
    expect(pill.listItemRadius).toBeGreaterThan(FLOOR.medium);
    expect(pill.listItemPadding).toBe(pill.listItemRadius);
  });
});

describe('the ring stays concentric', () => {
  it.each(INPUTS)('$label: ring = row - its inset', (input) => {
    const r = radiiFor(input);
    expect(r.listItemFocusRadius).toBe(Math.max(0, r.listItemRadius - FOCUS_INSET));
  });

  it('never goes negative', () => {
    for (const i of INPUTS) expect(radiiFor(i).listItemFocusRadius).toBeGreaterThanOrEqual(0);
  });

  it('the ring is SMALLER than the row — it is inset, not outset', () => {
    /* The opposite of the Card, whose ring sits 3px OUTSIDE and is therefore
       radius + 3. Getting the sign wrong looks plausible in a diff and draws a
       ring that crosses the row's own curve. */
    const r = radiiFor(INPUTS[2]);
    expect(r.listItemFocusRadius).toBeLessThan(r.listItemRadius);
    expect(r.cardFocusRadius).toBeGreaterThan(r.cardRadius);
  });
});

describe('the Figma payload', () => {
  const r = radiiFor(INPUTS[2]);
  const byMode = componentSizePayload(r as never, {}, {} as never);
  /* Lowercase `i`, because that is what the FILE calls the group. The payload
     said `List` first; the writer is update-only and matches by name, so every
     one of these would have been skipped in SILENCE, leaving the variables
     holding whatever was last typed by hand. */
  const G = 'List-item/';

  it.each([
    'List-Item-Radius',
    'List-Item-Focus-Radius',
    'List-Item-Padding',
    'List-Item-Image-Radius',
    'List-Item-Default-Image-Width',
  ])('writes %s into every size mode', (name) => {
    for (const mode of ['medium', 'small', 'large'] as const) {
      expect(byMode[mode], mode).toHaveProperty(G + name);
    }
  });

  it('uses the group name the file has, not the one that reads better', () => {
    expect(Object.keys(byMode.medium).some((k) => k.startsWith('List/'))).toBe(false);
  });

  it('repeats only what genuinely has no size of its own', () => {
    /* Image-Radius is the last one without Sm-/Lg- siblings. Padding, gap,
       radius and focus radius all spread now — a metric listed here by mistake
       would be silently flattened to medium in all three modes. */
    const name = 'List-Item-Image-Radius';
    const v = byMode.medium[G + name];
    expect(byMode.small[G + name]).toBe(v);
    expect(byMode.large[G + name]).toBe(v);
  });

  it.each(['List-Item-Padding', 'List-Item-Gap'])('%s spreads across the modes', (name) => {
    /* Figma holds 8 / 12 / 16 here. The studio emitted ONE constant, which
       componentSizeGroup repeats into all three modes — a legal write that
       would have flattened the ladder to 8/8/8 and left no trace. */
    const r2 = radiiFor(INPUTS[0]); // square brand: the floor, undisturbed
    const flat = componentSizePayload(r2 as never, {}, {} as never);
    expect([flat.small[G + name], flat.medium[G + name], flat.large[G + name]])
      .toEqual([8, 12, 16]);
  });

  it('spreads the image width across the modes, because it HAS siblings', () => {
    // 48 / 64 / 80 — the Sm-/Lg- prefix is what becomes the mode.
    expect(byMode.small['List-item/List-Item-Default-Image-Width']).toBe(r.smListItemImageWidth);
    expect(byMode.medium['List-item/List-Item-Default-Image-Width']).toBe(r.listItemImageWidth);
    expect(byMode.large['List-item/List-Item-Default-Image-Width']).toBe(r.lgListItemImageWidth);
    expect(byMode.small['List-item/List-Item-Default-Image-Width'])
      .not.toBe(byMode.large['List-item/List-Item-Default-Image-Width']);
  });

  it('sends what computeRadii produced', () => {
    expect(byMode.medium[G + 'List-Item-Radius']).toBe(r.listItemRadius);
    expect(byMode.medium[G + 'List-Item-Focus-Radius']).toBe(r.listItemFocusRadius);
    expect(byMode.medium[G + 'List-Item-Image-Radius']).toBe(r.listItemImageRadius);
  });
});

describe('the thumbnail', () => {
  it('is half the row corner — and moves with it', () => {
    /* Not `row - padding`: the image is inset by the FULL padding, so that
       gives 0 and square thumbnails. Half reproduces the drawn 4 and still
       tracks the brand. */
    for (const i of INPUTS) {
      const r = radiiFor(i);
      expect(r.listItemImageRadius).toBe(Math.round(r.listItemRadius / 2));
    }
  });

  it('is never rounder than the row it sits in', () => {
    for (const i of INPUTS) {
      const r = radiiFor(i);
      expect(r.listItemImageRadius).toBeLessThanOrEqual(r.listItemRadius);
    }
  });

  it('has a stated width ladder, not a derived one', () => {
    /* A media slot's size is a density decision, like FAB_SIZE. Running it
       through the brand's radius or button height gives a number nothing
       specifies. Asserted as the ladder so a change is deliberate. */
    const r = radiiFor(INPUTS[2]);
    expect([r.smListItemImageWidth, r.listItemImageWidth, r.lgListItemImageWidth]).toEqual([48, 64, 80]);
  });

  it('is the same ladder on every brand', () => {
    for (const i of INPUTS) expect(radiiFor(i).listItemImageWidth).toBe(64);
  });
});

describe('the gap between rows', () => {
  it('equals the padding inside one, by rule and not by coincidence', () => {
    /* Both were Sizing-1 in Figma, so they moved together — until someone
       pointed one at another rung. Stated here, the padding is the hinge. */
    for (const i of INPUTS) {
      const r = radiiFor(i);
      expect(r.listItemGap).toBe(r.listItemPadding);
      expect(r.smListItemGap).toBe(r.smListItemPadding);
      expect(r.lgListItemGap).toBe(r.lgListItemPadding);
    }
  });

  it('is the SEPARATED value — a joined list is 0, which is not derived', () => {
    /* `gap: clickable ? var(--Sizing-1) : 0` in the library, and
       `Type=non-clickable|clickable` in Figma. Zero is the absence of a gap,
       not a smaller one; deriving it would invent a spacing nobody asked for. */
    expect(radiiFor(INPUTS[2]).listItemGap).toBeGreaterThan(0);
  });

  it('reaches Figma under the name the file has', () => {
    const byMode = componentSizePayload(radiiFor(INPUTS[2]) as never, {}, {} as never);
    expect(byMode.medium).toHaveProperty('List-item/List-Item-Gap');
    expect(byMode.medium['List-item/List-Item-Gap'])
      .toBe(byMode.medium['List-item/List-Item-Padding']);
  });
});
