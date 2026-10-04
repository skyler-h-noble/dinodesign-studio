// Single source of truth for computing per-component pixel radii from the
// percentage-based fields on StyleCustomizations / _componentStyle.
//
// Model:
//   - buttonRadius / iconButtonRadius / inputRadius are stored as PERCENT (0–100)
//     of their respective component heights. Same percent applies to all three
//     sizes (Sm/Md/Lg) of the same component, scaling each to its own height.
//   - cardPadding is stored in PIXELS. Card-Radius = Button-Radius + cardPadding.
//   - Modal-Padding = cardPadding × 1.5. Modal-Radius = Button-Radius + Modal-Padding.
//   - Inner radius = radius − 1 (floored at 0). Focus radius = radius + 3.
//
// Both the CSS export and the Figma JSON export should call computeRadii() so
// they always agree, and the live preview should use the same numbers.

export interface RadiiInput {
  buttonRadius: number;        // percent 0–100
  iconButtonRadius: number;    // percent 0–100
  inputRadius: number;         // percent 0–100
  cardPadding: number;         // pixels
  buttonHeight: number;        // pixels (medium)
  smallButtonHeight: number;   // pixels
  largeButtonHeight: number;   // pixels
}

export interface ComputedRadii {
  // Buttons
  buttonRadius: number;
  smButtonRadius: number;
  lgButtonRadius: number;
  buttonInnerRadius: number;
  smButtonInnerRadius: number;
  lgButtonInnerRadius: number;
  buttonFocusRadius: number;
  smButtonFocusRadius: number;
  lgButtonFocusRadius: number;

  /* The end segments of a VERTICAL button group.
     A vertical group rounds the top of its first segment and the bottom of
     its last, and those corners take HALF the button's radius rather than all
     of it: the full corner is drawn for a control as wide as a button is, and
     on the short edge of a stacked segment it reads as a pill cap. */
  verticalButtonRadius: number;
  smVerticalButtonRadius: number;
  lgVerticalButtonRadius: number;
  verticalButtonFocusRadius: number;
  smVerticalButtonFocusRadius: number;
  lgVerticalButtonFocusRadius: number;

  // Icon Buttons (icon button is square — height = corresponding button height)
  iconButtonRadius: number;
  smIconButtonRadius: number;
  lgIconButtonRadius: number;
  iconButtonInnerRadius: number;
  smIconButtonInnerRadius: number;
  lgIconButtonInnerRadius: number;
  iconButtonFocusRadius: number;
  smIconButtonFocusRadius: number;
  lgIconButtonFocusRadius: number;

  // Input (matches button heights per size)
  inputRadius: number;
  smInputRadius: number;
  lgInputRadius: number;
  inputInnerRadius: number;
  inputFocusRadius: number;

  // Input swatch — square swatch rendered inside an input (e.g. Select
  // color swatch). Size = input height − 6 (3px gap on every side, matching
  // the button-swatch pattern). Radius uses the same inputRadius % applied
  // to its own size, so 100% gives a circle.
  inputSwatchRadius: number;
  smInputSwatchRadius: number;
  lgInputSwatchRadius: number;

  // Card
  cardPadding: number;
  smCardPadding: number;
  lgCardPadding: number;
  accordionRadius: number;
  accordionFocusRadius: number;
  accordionInnerFocusRadius: number;
  cardRadius: number;
  smCardRadius: number;
  lgCardRadius: number;
  cardInnerRadius: number;
  smCardInnerRadius: number;
  lgCardInnerRadius: number;
  cardFocusRadius: number;
  smCardFocusRadius: number;
  lgCardFocusRadius: number;

  // Modal
  modalPadding: number;
  modalRadius: number;
  smModalPadding: number;
  lgModalPadding: number;

  /** The floating frame of a dropdown / menu panel. Pixels, not a percent —
   *  see the derivation note in computeRadii(). */
  dropdownFrameRadius: number;

  /** A bordered LIST row: its corner, the ring inset inside it, its padding,
   *  and the thumbnail it can carry. */
  listItemRadius: number;
  smListItemRadius: number;
  lgListItemRadius: number;
  listItemFocusRadius: number;
  smListItemFocusRadius: number;
  lgListItemFocusRadius: number;
  listItemPadding: number;
  smListItemPadding: number;
  lgListItemPadding: number;
  listItemGap: number;
  smListItemGap: number;
  lgListItemGap: number;
  listItemImageRadius: number;
  listItemImageWidth: number;
  smListItemImageWidth: number;
  lgListItemImageWidth: number;

  /** A menu ROW inside that frame, inset by the panel's padding. */
  menuItemRadius: number;
  /** The row's inset focus ring. */
  menuFocusRadius: number;
  modalInnerRadius: number;
  modalFocusRadius: number;
}

/** A radius stated as a percent of a height. Exported so anything deriving a
 *  radius from a height uses this one rather than repeating the arithmetic —
 *  inputMetrics.ts needs it for the per-device input ladders. */
export const pctRadius = (percent: number, height: number) =>
  Math.round(Math.max(0, Math.min(100, percent)) * height / 100);

const pct = (percent: number, height: number) =>
  Math.round(Math.max(0, Math.min(100, percent)) * height / 100);

const inner = (r: number) => Math.max(0, r - 1);
const focus = (r: number) => r + 3;
/* Half, rounded. The focus ring is then the usual +3 ON THE HALVED value, not
   half of the focus radius — the ring tracks the corner it surrounds, so
   halving the corner and re-deriving is the only order that keeps the 3px
   gap even. */
const half = (r: number) => Math.round(r / 2);

export function computeRadii(cs: RadiiInput): ComputedRadii {
  /**
   * One radius for every size — EXCEPT when the base is asking for a pill.
   *
   * Two rules, because a single one is wrong at one end or the other:
   *
   *   a constant corner   8px on a 48px button and on a 112px button are the
   *                       same shape, which is what "same radius" means and
   *                       what proportional scaling got wrong.
   *
   *   a pill is a ratio   a pill is height/2 BY DEFINITION. Hand a 112px
   *                       button the base's 20px and it is a rounded
   *                       rectangle, not a pill.
   *
   * The base's own pill point is the switch. Below it the value is a corner and
   * copies across unchanged; at or above it the value is an intent — "fully
   * round" — and each size resolves that against its own height.
   *
   * Sm/Lg stay as tokens rather than being deleted: they already ship to Figma,
   * and a deleted Figma variable cannot be recovered by re-importing, because a
   * recreated variable gets a new id and every layer bound to the old one stays
   * unbound (invariant 8).
   */
  const sized = (basePx: number, height: number, baseHeight: number) =>
    basePx >= baseHeight / 2 ? Math.round(height / 2) : basePx;

  const buttonRadius = pct(cs.buttonRadius, cs.buttonHeight);
  const smButtonRadius = sized(buttonRadius, cs.smallButtonHeight, cs.buttonHeight);
  const lgButtonRadius = sized(buttonRadius, cs.largeButtonHeight, cs.buttonHeight);

  const iconButtonRadius = pct(cs.iconButtonRadius, cs.buttonHeight);
  const smIconButtonRadius = sized(iconButtonRadius, cs.smallButtonHeight, cs.buttonHeight);
  const lgIconButtonRadius = sized(iconButtonRadius, cs.largeButtonHeight, cs.buttonHeight);

  const inputRadius = pct(cs.inputRadius, cs.buttonHeight);
  const smInputRadius = pct(cs.inputRadius, cs.smallButtonHeight);
  const lgInputRadius = pct(cs.inputRadius, cs.largeButtonHeight);

  // Swatch sizes derived from the input height per size (same -6 pattern
  // the Figma button swatch already uses).
  const SWATCH_INSET = 6;
  const inputSwatchSize = Math.max(0, cs.buttonHeight - SWATCH_INSET);
  const smInputSwatchSize = Math.max(0, cs.smallButtonHeight - SWATCH_INSET);
  const lgInputSwatchSize = Math.max(0, cs.largeButtonHeight - SWATCH_INSET);
  const inputSwatchRadius = pct(cs.inputRadius, inputSwatchSize);
  const smInputSwatchRadius = pct(cs.inputRadius, smInputSwatchSize);
  const lgInputSwatchRadius = pct(cs.inputRadius, lgInputSwatchSize);

  // Card padding is derived from the resolved button radius:
  //   radius <  24px  → 16px fixed (small radii get a comfy minimum)
  //   24px ≤ r < 32px → padding == radius (concentric look, padding scales)
  //   radius ≥ 32px  → padding == radius / 2 (cap so very rounded cards
  //                                            don't get pushed to absurd insets)
  const cardPadding =
    buttonRadius < 24
      ? 16
      : buttonRadius < 32
        ? buttonRadius
        : Math.round(buttonRadius / 2);
  // Cap the button radius's contribution to the card/modal CORNER so a pill
  // button (very large radius) doesn't balloon the container into a stadium.
  // Buttons can go full-pill; cards/containers stay tasteful. Padding still
  // scales with the button radius — only the corner rounding is capped. The
  // nesting rule (inner = outer − padding) still holds below the cap.
  const CARD_CORNER_CAP = 20;
  const cardCornerBase = Math.min(buttonRadius, CARD_CORNER_CAP);

  // Then cap the RESULT.
  //
  // Capping only the corner term did not do what its comment claimed: above a
  // 24px button radius `cardPadding` is the larger of the two and was added on
  // top uncapped, so cards landed at 44-51px — several times a conventional
  // card. It was also non-monotonic, because cardPadding switches from
  // `buttonRadius` to `buttonRadius / 2` at 32: one notch on the slider (65% to
  // 66%) dropped the card from 51px to 36px, making cards LESS round as the
  // button got rounder.
  //
  // Capping the total fixes both — above the cap the curve is flat, so the
  // cliff has nothing to fall off.
  /* Accordion corner — follows the button radius, capped at half the summary's
   * height so it cannot saturate into a stadium.
   *
   * An accordion summary is about one button tall, so a pill-able
   * --Button-Radius rounds it into a lozenge; buttons are deliberately
   * pill-able, accordions are not. Half the height is the point at which a
   * corner stops being a corner, which makes it the right maximum.
   *
   * This lived inline in buildPreviewCSS, so --Accordion-Radius reached the
   * studio preview and nothing else — not the CSS export, not Figma. The lib
   * therefore fell back to --Button-Radius everywhere real, which is the pill
   * the token exists to prevent. */
  const accordionRadius = Math.min(buttonRadius, Math.floor(cs.buttonHeight / 2));

  /* The accordion's focus ring, for FIGMA's benefit only.
   *
   * CSS needs neither of these: the ring is an `outline`, and a browser draws
   * an outline concentric with the element's border-radius, so an inset ring
   * inside an 8px corner emerges at 5px with nobody computing it. Figma cannot
   * do arithmetic on a variable, so the two values have to be stated.
   *
   * The inset is 3, not the 1 that `inner()` applies to Input. Input's inner
   * focus sits 1px in; the accordion's sits 3px in, matching the lib's
   * outlineOffset: -3px. Reusing inner() here would emit 7 and put Figma's
   * ring a step off what the CSS actually draws — the two would look
   * concentric in neither place. */
  const ACCORDION_FOCUS_INSET = 3;
  const accordionFocusRadius = accordionRadius + ACCORDION_FOCUS_INSET;
  const accordionInnerFocusRadius = Math.max(0, accordionRadius - ACCORDION_FOCUS_INSET);

  const CARD_RADIUS_MAX = 24;
  const cardRadius = Math.min(cardCornerBase + cardPadding, CARD_RADIUS_MAX);

  /* Small and large cards, scaled PROPORTIONALLY off the resolved medium.
   *
   * The obvious derivation — run the cardCornerBase + padding formula again
   * with a smaller and larger padding — collapses: CARD_RADIUS_MAX already
   * binds at anything above the Pro preset, so Modern would give 20/24/24 and
   * Bold 24/24/24. Three names for one number.
   *
   * Scaling the resolved value keeps the three distinct and monotonic at every
   * preset, and keeps the cap meaningful by applying it only to the large end.
   * The 0.75 / 1.25 pair mirrors the modal's own 1.5x padding relationship. */
  const smCardRadius = Math.max(2, Math.round(cardRadius * 0.75));
  const lgCardRadius = Math.min(Math.round(cardRadius * 1.25), CARD_RADIUS_MAX + 8);

  /* Card PADDING at the three sizes, on the same 0.75 / 1.25 pair.
   *
   * It was flat: `Card-Padding` had no Sm-/Lg- siblings, so componentSizeGroup
   * repeated medium into all three modes — correct behaviour for a metric with
   * no siblings, and invisible while only the corner changed with the size.
   * It stops being invisible once the TYPE inside a card follows the size
   * mode: a small card would have held 14px type inside 24px of padding.
   *
   * Scaled off the resolved padding rather than re-derived, for the same
   * reason the radii above are — one number, three sizes, monotonic by
   * construction. And the radii are NOT recomputed from these: cardRadius is
   * cardCornerBase + cardPadding capped at 24, so feeding it a smaller padding
   * collapses the three corners to one value at every preset above Pro. The
   * two scale in parallel; neither derives from the other's small/large. */
  const smCardPadding = Math.round(cardPadding * 0.75);
  const lgCardPadding = Math.round(cardPadding * 1.25);

  /* A modal's padding is 1.5x a card's. Its CORNER is a card's exactly.
   *
   * This used to be `min(cardCornerBase + modalPadding, CARD_RADIUS_MAX)`, and
   * the comment justified the cap by saying an uncapped modal corner reached
   * ~66px and "would make a modal visibly rounder than the cards inside it".
   *
   * Both halves of that were true and the result was still wrong, because
   * modalPadding can never fall below 24 — cardPadding floors at 16, times 1.5
   * — so `min(anything + 24, 24)` is 24 for EVERY brand. Measured across button
   * radii from 0 to 100% at three button heights: 24, every time. The cap did
   * not bound the value, it replaced it.
   *
   * So the rule it was written to protect was the one it broke. At a square
   * brand the cards came out at 16 inside a 24px modal — the modal rounder than
   * its contents, which is precisely what the cap exists to prevent. It only
   * ever held at the round end, where the two agreed anyway.
   *
   * Equal to Card-Radius fixes both ends and drops a second ceiling doing the
   * same job: CARD_RADIUS_MAX now applies once, through cardRadius. It is also
   * the rule Dropdown-Frame-Radius already follows a few lines down — "a
   * floating surface must not be rounder than the cards it sits on top of" —
   * and a modal is the other floating surface.
   *
   * The concentric reading (outer = inner + padding, so a modal SHOULD be
   * rounder) is the one being set aside, deliberately. It applies to a box
   * nested inside another box. A modal and a card are siblings in the surface
   * family: a card sits ON a modal, it is not inset into its corner. */
  /* A modal's padding is 1.5x a card's, at EVERY size.
   *
   * Three values rather than one, added 2026-09-29. Component-Size has three
   * modes and the library's Modal has three sizes, so a single number meant a
   * 720px-wide modal wearing a 400px one's inset. Modal.js had noticed and
   * routed around it with a hardcoded SIZE_MAP of 24 / 32 / 40, which is the
   * shape of a component solving in code what the system failed to give it —
   * and those three numbers tracked no brand at all.
   *
   * Derived from the card's own triple, so the ratio holds across the range
   * instead of only at medium. At the default 12 / 16 / 20 this gives
   * 18 / 24 / 30 — tighter than the literals it replaces, and moving with the
   * brand where they did not. */
  const modalPadding = Math.round(cardPadding * 1.5);
  const smModalPadding = Math.round(smCardPadding * 1.5);
  const lgModalPadding = Math.round(lgCardPadding * 1.5);
  const modalRadius = cardRadius;

  // Dropdown / menu frame.
  //
  // Derived rather than authored, from three bounds in priority order:
  //   1. Input-Radius — a menu is visually a continuation of the field it
  //      opens from, so at ordinary radii the two should agree. This is why it
  //      keys off the input and not the card.
  //   2. Card-Radius — the same rule modals already follow above: a floating
  //      surface must not be rounder than the cards it sits on top of.
  //   3. A hard 16px ceiling. The panel scrolls (overflow-y: auto) with
  //      full-bleed rows, so a large corner clips the first and last item's
  //      hover highlight into a visible crescent.
  //
  // PIXELS, deliberately, unlike buttonRadius / inputRadius. The percent model
  // works for those because their heights are fixed and known. A dropdown's
  // height is content-driven up to DROPDOWN_MAX_HEIGHT, so the same percent
  // would make a long menu absurdly round and a short one nearly square.
  const DROPDOWN_FRAME_RADIUS_MAX = 16;
  const dropdownFrameRadius = Math.min(
    inputRadius,
    cardRadius,
    DROPDOWN_FRAME_RADIUS_MAX,
  );

  // Menu row, and the ring inside it — SQUARE, by construction.
  //
  // The rows are FULL-BLEED: they run edge to edge inside the panel, and the
  // panel's own `overflow: hidden` rounds the first and last of them. So the
  // row's corner is the panel's corner, and giving the row a radius of its own
  // draws a second curve inside the first — the "visible crescent" the
  // Dropdown-Frame-Radius note above describes.
  //
  // ZERO BY CONSTRUCTION, NOT A DERIVATION THAT LANDS ON ZERO.
  //
  // This was `max(0, dropdownFrameRadius - 8)`, which assumed the rows sat 8px
  // inside the panel and stayed concentric with it. For a square-ish brand that
  // returned 0 anyway and looked correct; for a rounder one it would quietly
  // start returning 4, 6, 8 and reintroduce the double curve. A value that is
  // right only for the brands that happen to be square is not the rule.
  //
  // It also puts the 16px ceiling on the frame back on solid ground. That cap
  // exists BECAUSE the rows are full-bleed; while they were inset, the cap was
  // resting on a premise that was no longer true.
  //
  // The FOCUS ring follows the row, so it is square too. An inset ring on a
  // full-bleed row is the conventional shape — macOS menus and most dropdowns
  // do exactly this. If the ring should keep some softness the row does not,
  // that is a deliberate exception rather than a derivation: the ring is inset,
  // so it can carry a corner the row lacks without anything clipping.
  const menuItemRadius = 0;
  const menuFocusRadius = 0;

  /* A LIST row is not a menu row, and the difference decides its corner.
   *
   * A menu row is FULL-BLEED inside the dropdown panel, so the panel's corner
   * IS the row's corner and a radius of its own draws a second curve — hence
   * the zero above. A list row draws its own 1px border on all four sides, so
   * it is a small surface in its own right and needs a corner.
   *
   * min(BUTTON radius, padding) — not min(cardRadius, padding).
   *
   * The card version was written first and is a CONSTANT in disguise: cardRadius
   * is never below 16 (its padding floor is 16 and the corner adds to it), so
   * min(cardRadius, 8) returns 8 on every brand from square to pill. It looked
   * like a derivation, tested green, and reproduced the drawn value — and would
   * have frozen the row's corner for every user of the studio.
   *
   * Off buttonRadius it actually moves: 0 / 2 / 8 / 8 across square / subtle /
   * default / pill. That also lines the row up with the accordion, which is the
   * same object — a bordered row in a stack — and derives from the same control.
   *
   * The cap is the constraint that binds at the top end: a radius larger than
   * the row's own padding puts the content's corner inside the curve.
   *
   * The padding is a constant here rather than a user input because the row
   * has no padding control; if one is added, this reads it and the cap moves
   * with it. Radius and padding were BOTH bound to `Sizing-1` in Figma, which
   * is why the radius could not be raised without the padding following — one
   * token standing for two independent axes. */
  /* The row's corner IS the brand's button corner, per size.
   *
   * Uncapped. An earlier version capped it at the padding, which made the two
   * define each other once the padding started deriving from the radius — the
   * radius is the input, so it cannot also be the thing being limited. */
  const listItemRadius = buttonRadius;
  const smListItemRadius = smButtonRadius;
  const lgListItemRadius = lgButtonRadius;

  /* The padding is DERIVED FROM the corner, with a density floor per size.
   *
   * A rounder box needs more padding, because content near a corner has to
   * clear the curve. So `radius <= padding` is no longer a cap imposed on the
   * radius — it falls out of max(): the padding grows to meet a large corner
   * and never sits below it.
   *
   * The floor is what a row carries when the brand is square, which is a
   * density decision and the only part that is stated: 8 / 12 / 16.
   *
   * Same shape as cardPadding above, which derives from buttonRadius with a
   * 16px floor. A row is a denser surface than a card, hence the lower floor. */
  const LIST_ITEM_PADDING_FLOOR = { small: 8, medium: 12, large: 16 };
  const padFor = (floor: number, radius: number) => Math.max(floor, radius);

  /* The gap BETWEEN rows equals the padding INSIDE one.
   *
   * A clickable list separates its rows so each reads as its own tappable
   * surface; a non-clickable one keeps them at 0 and joins them with hairlines.
   * The library already draws exactly that — `gap: clickable ? var(--Sizing-1)
   * : 0` — and Figma's List has the matching `Type=non-clickable|clickable`.
   *
   * Equal, not merely both-8. Today they are both Sizing-1 and so move
   * together, but only by coincidence: point either at another rung and the
   * relationship breaks with nothing to catch it. Stated here, the padding is
   * the hinge and the gap follows by construction.
   *
   * The gap is the SEPARATED value. A non-clickable list is 0 and does not read
   * this — zero is the absence of a gap, not a smaller one, so deriving it
   * would invent a spacing nobody asked for. */
  const listItemPadding = padFor(LIST_ITEM_PADDING_FLOOR.medium, listItemRadius);
  const smListItemPadding = padFor(LIST_ITEM_PADDING_FLOOR.small, smListItemRadius);
  const lgListItemPadding = padFor(LIST_ITEM_PADDING_FLOOR.large, lgListItemRadius);

  const listItemGap = listItemPadding;
  const smListItemGap = smListItemPadding;
  const lgListItemGap = lgListItemPadding;

  /* The ring is inset 2: 1px clear of the drawn edge, plus the row's own 1px
     border. Concentric means the ring's radius drops by the same 2 — the
     Accordion does this with its own inset of 3. A hand-typed ring stops being
     concentric the first time the row's radius moves. */
  const LIST_ITEM_FOCUS_INSET = 2;
  const inset = (r: number) => Math.max(0, r - LIST_ITEM_FOCUS_INSET);
  const listItemFocusRadius = inset(listItemRadius);
  const smListItemFocusRadius = inset(smListItemRadius);
  const lgListItemFocusRadius = inset(lgListItemRadius);

  /* The thumbnail's corner: HALF the row's.
   *
   * Not `inner()` and not `row - padding`. The image is inset by the full
   * padding, so a concentric derivation gives max(0, 8 - 8) = 0 — square
   * thumbnails, which is not what the design draws. Half reproduces the drawn 4
   * and, unlike a literal, moves with the row: it goes to 1 on a nearly-square
   * brand and 4 at the cap.
   *
   * Stated as a ratio rather than a constant for the reason the note above
   * gives: a number that is right only for the brand in front of you is not a
   * rule. */
  const listItemImageRadius = Math.round(listItemRadius / 2);

  /* The default thumbnail width, per size.
   *
   * A stated ladder, not a derivation — the same treatment FAB_SIZE gets. A
   * list thumbnail is a media slot whose size is a density decision, not a
   * function of the brand's radius or its button height; running it through
   * either produces a number nothing specifies. 16px steps.
   *
   * It is a DEFAULT: the name says so, and a consumer passing a real image
   * size overrides it. */
  const listItemImageWidth = 64;
  const smListItemImageWidth = 48;
  const lgListItemImageWidth = 80;

  return {
    buttonRadius,
    smButtonRadius,
    lgButtonRadius,
    buttonInnerRadius: inner(buttonRadius),
    smButtonInnerRadius: inner(smButtonRadius),
    lgButtonInnerRadius: inner(lgButtonRadius),
    buttonFocusRadius: focus(buttonRadius),
    smButtonFocusRadius: focus(smButtonRadius),
    lgButtonFocusRadius: focus(lgButtonRadius),

    verticalButtonRadius: half(buttonRadius),
    smVerticalButtonRadius: half(smButtonRadius),
    lgVerticalButtonRadius: half(lgButtonRadius),
    verticalButtonFocusRadius: focus(half(buttonRadius)),
    smVerticalButtonFocusRadius: focus(half(smButtonRadius)),
    lgVerticalButtonFocusRadius: focus(half(lgButtonRadius)),

    iconButtonRadius,
    smIconButtonRadius,
    lgIconButtonRadius,
    iconButtonInnerRadius: inner(iconButtonRadius),
    smIconButtonInnerRadius: inner(smIconButtonRadius),
    lgIconButtonInnerRadius: inner(lgIconButtonRadius),
    iconButtonFocusRadius: focus(iconButtonRadius),
    smIconButtonFocusRadius: focus(smIconButtonRadius),
    lgIconButtonFocusRadius: focus(lgIconButtonRadius),

    inputRadius,
    smInputRadius,
    lgInputRadius,
    inputInnerRadius: inner(inputRadius),
    inputFocusRadius: focus(inputRadius),

    inputSwatchRadius,
    smInputSwatchRadius,
    lgInputSwatchRadius,

    cardPadding,
    smCardPadding,
    lgCardPadding,
    accordionRadius,
    accordionFocusRadius,
    accordionInnerFocusRadius,
    cardRadius,
    smCardRadius,
    lgCardRadius,
    cardInnerRadius: inner(cardRadius),
    smCardInnerRadius: inner(smCardRadius),
    lgCardInnerRadius: inner(lgCardRadius),
    /* A focus ring per SIZE, not medium repeated three times.
     *
     * The inner radius was already computed per size and the focus radius was
     * not, so Figma's Card-Focus-Radius held 21 in all three size modes while
     * Card-Radius held 14 / 18 / 23. A small card drew a 21px ring around a
     * 14px corner — the ring cut across the card's own curve, which is what a
     * concentric ring is defined not to do.
     *
     * The failure survived because a single number IS right for one of the
     * three sizes, so the medium card looked correct and the bug read as a
     * rendering artefact on the other two. */
    cardFocusRadius: focus(cardRadius),
    smCardFocusRadius: focus(smCardRadius),
    lgCardFocusRadius: focus(lgCardRadius),

    modalPadding,
    modalRadius,
    smModalPadding,
    lgModalPadding,
    dropdownFrameRadius,
    listItemRadius,
    smListItemRadius,
    lgListItemRadius,
    listItemFocusRadius,
    smListItemFocusRadius,
    lgListItemFocusRadius,
    listItemPadding,
    smListItemPadding,
    lgListItemPadding,
    listItemGap,
    smListItemGap,
    lgListItemGap,
    listItemImageRadius,
    listItemImageWidth,
    smListItemImageWidth,
    lgListItemImageWidth,
    menuItemRadius,
    menuFocusRadius,
    modalInnerRadius: inner(modalRadius),
    modalFocusRadius: focus(modalRadius),
  };
}

// Detects the legacy shape: pre-refactor designs stored `radius` (pixels) and
// buttonRadius/iconButtonRadius/inputRadius as pixels too. Converts in place.
// Heuristic: if `cardPadding` is missing OR any of the percent fields exceeds
// 100, it's legacy.
export function migrateLegacyRadii<T extends Partial<RadiiInput> & { radius?: number }>(
  cs: T,
): T & RadiiInput {
  const buttonHeight = cs.buttonHeight ?? 32;
  const isLegacy =
    cs.cardPadding === undefined ||
    (cs.buttonRadius !== undefined && cs.buttonRadius > 100) ||
    (cs.iconButtonRadius !== undefined && cs.iconButtonRadius > 100) ||
    (cs.inputRadius !== undefined && cs.inputRadius > 100);

  if (!isLegacy) return cs as T & RadiiInput;

  const pxToPct = (px: number | undefined) =>
    px === undefined ? 0 : Math.min(100, Math.round((px / buttonHeight) * 100));

  const cardPadding = cs.cardPadding ?? cs.radius ?? 16;

  return {
    ...cs,
    cardPadding,
    buttonRadius: pxToPct(cs.buttonRadius),
    iconButtonRadius: pxToPct(cs.iconButtonRadius),
    inputRadius: pxToPct(cs.inputRadius),
    buttonHeight,
    smallButtonHeight: cs.smallButtonHeight ?? 24,
    largeButtonHeight: cs.largeButtonHeight ?? 56,
  } as T & RadiiInput;
}
