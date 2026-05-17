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

  const cardPadding = cs.cardPadding;
  const cardRadius = buttonRadius + cardPadding;

  const modalPadding = Math.round(cardPadding * 1.5);
  const modalRadius = buttonRadius + modalPadding;

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
