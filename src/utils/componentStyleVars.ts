/**
 * The component-style custom properties — button radii, heights, padding,
 * bevel, card radius — derived ONCE from the user's slider values.
 *
 * Why this is a module rather than a few lines inside App.tsx: it was those
 * few lines inside App.tsx, and the design-system detail page never got them.
 * The create flow rendered the user's 86%-radius buttons as near-pills and the
 * detail page rendered the same system's buttons at the lib's default 4px,
 * because the detail page's brand CSS carried colour and typography only. Both
 * pages looked deliberate; neither showed an error. That is invariant 5 — the
 * preview and the export are separate implementations and diverge silently —
 * playing out between two previews.
 *
 * The radius inputs are PERCENTS of a button's own height (0–100), not pixels.
 * Each size is measured against ITS OWN height, which is what `computeRadii`
 * in the export does; measuring all three against the standard height is how
 * small buttons end up over-rounded and large ones under-rounded.
 */

// Reuse the shared union rather than restating it — a second copy here is the
// same duplicate-declaration trap this module exists to close.
import type { ComponentStyle } from '../types';
export type { ComponentStyle };

/** The flat per-style customization object, as stored in a system's snapshot. */
export interface StyleCustomizations {
  radius?: number;
  cardPadding?: number;
  buttonRadius?: number;
  iconButtonRadius?: number;
  inputRadius?: number;
  inputPadding?: number;
  buttonHeight?: number;
  smallButtonHeight?: number;
  largeButtonHeight?: number;
  minButtonWidth?: number;
  bevel?: number;
  bevelOpacity?: number;
}

/** Preset fallbacks for a style whose sliders the user never touched. */
const CARD_RADIUS_BY_STYLE: Record<ComponentStyle, number> = {
  professional: 4, modern: 8, bold: 16, playful: 24,
};
const BUTTON_RADIUS_BY_STYLE: Record<ComponentStyle, number> = {
  professional: 6, modern: 12, bold: 25, playful: 100,
};

/**
 * One padding at every size (8px), with the size-specific names kept as
 * aliases because the lib's Button reads them with NO fallback — an undefined
 * `--Sm-Button-Padding` invalidates the whole `padding: 0 var(…)` shorthand and
 * the browser drops it, so the button renders with no side padding at all.
 * Mirrors BUTTON_PADDING / LG_BUTTON_PADDING in exportToCSS.ts.
 */
const BUTTON_PADDING = 8;
const LG_BUTTON_PADDING = 16;
/** Large's minimum width is the standard floor + 40, the same relationship the
 *  CSS export and the Figma payload emit. */
const LG_BUTTON_MIN_WIDTH_OFFSET = 40;

/** A radius percent against one height, in px, capped at that height. */
const pct = (percent: number, height: number) =>
  Math.min(Math.round((height * percent) / 100), height);

/**
 * Every component-style variable for one style + its customizations.
 *
 * Returned as plain strings so the same object can be spread into a React
 * inline style (the create flow) or serialised into a stylesheet (the detail
 * page, which needs the values to reach portalled content like Modal — an
 * inline style on a wrapper div cannot, since a portal renders outside it).
 */
export function componentStyleVars(
  componentStyle: ComponentStyle,
  custom?: StyleCustomizations | null,
): Record<string, string> {
  const cardRadius = custom?.radius ?? CARD_RADIUS_BY_STYLE[componentStyle] ?? CARD_RADIUS_BY_STYLE.modern;
  const buttonRadius = custom?.buttonRadius ?? BUTTON_RADIUS_BY_STYLE[componentStyle] ?? BUTTON_RADIUS_BY_STYLE.modern;
  const iconButtonRadius = custom?.iconButtonRadius ?? buttonRadius;
  const buttonHeight = custom?.buttonHeight ?? 32;
  const smallButtonHeight = custom?.smallButtonHeight ?? 24;
  const largeButtonHeight = custom?.largeButtonHeight ?? 56;
  const minButtonWidth = custom?.minButtonWidth ?? 60;
  const bevel = custom?.bevel ?? 0;
  const bevelOpacity = custom?.bevelOpacity ?? 50;

  // Standard and icon are capped at the LARGE height (they can exceed their own
  // height and still read as a pill); small and large are each capped at their
  // own. This is the shape App.tsx already used and the export agrees with.
  const buttonRadiusPx = Math.min(Math.round((buttonHeight * buttonRadius) / 100), largeButtonHeight);
  const iconButtonRadiusPx = Math.min(Math.round((buttonHeight * iconButtonRadius) / 100), largeButtonHeight);
  const smButtonRadiusPx = pct(buttonRadius, smallButtonHeight);
  const lgButtonRadiusPx = pct(buttonRadius, largeButtonHeight);
  const bevelPx = Math.round((buttonHeight * bevel) / 100);

  return {
    '--Style-Border-Radius': `${buttonRadiusPx}px`,
    '--Button-Padding': `${BUTTON_PADDING}px`,
    '--Sm-Button-Padding': 'var(--Button-Padding)',
    '--Lg-Button-Padding': `${LG_BUTTON_PADDING}px`,
    '--Large-Button-Padding': 'var(--Lg-Button-Padding)',
    '--Button-Radius': `${buttonRadiusPx}px`,
    '--Sm-Button-Radius': `${smButtonRadiusPx}px`,
    '--Lg-Button-Radius': `${lgButtonRadiusPx}px`,
    '--Button-Icon-Radius': `${iconButtonRadiusPx}px`,
    '--Button-Bevel': `${bevel}`,
    '--Button-Bevel-Opacity': `${bevelOpacity / 100}`,
    '--Button-Bevel-Px': `${bevelPx}px`,
    '--Button-Height': `${buttonHeight}px`,
    '--Small-Button-Height': `${smallButtonHeight}px`,
    '--Large-Button-Height': `${largeButtonHeight}px`,
    '--Button-Min-Width': `${minButtonWidth}px`,
    '--Lg-Button-Min-Width': `${minButtonWidth + LG_BUTTON_MIN_WIDTH_OFFSET}px`,
    '--Card-Radius': `${cardRadius}px`,
    '--Card-Padding': `${cardRadius >= 16 ? 20 : 16}px`,
  };
}

/**
 * The same variables as a stylesheet block.
 *
 * Emitted at `:root` on purpose. The obvious alternative — scoping to
 * `[data-theme="Brand"]` — does not reach a Modal or any other portalled
 * panel, because a portal renders into document.body, outside whatever element
 * carries the theme. That is exactly how the detail page's "Got it" button
 * stayed square while the page behind it was themed. The style tag that
 * carries this is mounted per page, so `:root` is scoped by the injector's
 * lifetime rather than leaking across the app.
 */
export function componentStyleCSS(
  componentStyle: ComponentStyle,
  custom?: StyleCustomizations | null,
): string {
  const vars = componentStyleVars(componentStyle, custom);
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `/* Component style — the user's button/card sliders. At :root so\n   portalled content (Modal, dropdown panels) inherits them too. */\n:root {\n${body}\n}`;
}
