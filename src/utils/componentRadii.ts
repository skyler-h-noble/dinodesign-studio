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
  cardRadius: number;
  cardInnerRadius: number;
  cardFocusRadius: number;

  // Modal
  modalPadding: number;
  modalRadius: number;

  /** The floating frame of a dropdown / menu panel. Pixels, not a percent —
   *  see the derivation note in computeRadii(). */
  dropdownFrameRadius: number;
  modalInnerRadius: number;
  modalFocusRadius: number;
}

const pct = (percent: number, height: number) =>
  Math.round(Math.max(0, Math.min(100, percent)) * height / 100);

const inner = (r: number) => Math.max(0, r - 1);
const focus = (r: number) => r + 3;

export function computeRadii(cs: RadiiInput): ComputedRadii {
  const buttonRadius = pct(cs.buttonRadius, cs.buttonHeight);
  const smButtonRadius = pct(cs.buttonRadius, cs.smallButtonHeight);
  const lgButtonRadius = pct(cs.buttonRadius, cs.largeButtonHeight);

  const iconButtonRadius = pct(cs.iconButtonRadius, cs.buttonHeight);
  const smIconButtonRadius = pct(cs.iconButtonRadius, cs.smallButtonHeight);
  const lgIconButtonRadius = pct(cs.iconButtonRadius, cs.largeButtonHeight);

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
  const CARD_RADIUS_MAX = 24;
  const cardRadius = Math.min(cardCornerBase + cardPadding, CARD_RADIUS_MAX);

  // Modals take the same ceiling. Their padding is 1.5x a card's, so an uncapped
  // modal corner reached ~66px — and leaving it uncapped while the card is
  // capped at 24 would make a modal visibly rounder than the cards inside it.
  const modalPadding = Math.round(cardPadding * 1.5);
  const modalRadius = Math.min(cardCornerBase + modalPadding, CARD_RADIUS_MAX);

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
    cardRadius,
    cardInnerRadius: inner(cardRadius),
    cardFocusRadius: focus(cardRadius),

    modalPadding,
    modalRadius,
    dropdownFrameRadius,
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
