/**
 * Mode-scoped button metrics — the values that change with a component's SIZE
 * rather than with the brand.
 *
 * These come from the Figma "Button" collection, which has three modes
 * (medium = default, small, large). A component instance switches mode and
 * every one of these follows. CSS has no per-instance modes, so the same
 * choice is expressed the way the rest of this system already does it: a base
 * name for medium plus --Sm- / --Lg- siblings, and the component picks by size.
 *
 * ── Everything here is DERIVED from the brand's three button heights ────────
 *
 * The design's table is not a set of preferences: its three columns are the
 * three DEFAULT heights (32 / 24 / 56), so it is three samples of whatever
 * function the design intends. Fitting those samples gives two rules.
 *
 * TEXT is linear in height — one slope, 3/16 of a pixel of type per pixel of
 * button, with the three roles sitting 2px apart:
 *
 *     Button-Text(h)    = 3h/16 + 9.5
 *     Avatar-Text(h)    = 3h/16 + 7.5     (Button-Text - 2)
 *     Button-Numbers(h) = 3h/16 + 5.5     (Button-Text - 4)
 *
 * ICONS are a ratio of the height, SNAPPED to the icon ramp. Icon sizes are
 * drawn on a grid and go blurry off it, so they step rather than slide — which
 * is exactly why the design's icon rows are not linear (Button-Icon repeats 20
 * across small and medium, then jumps to 32) while the text rows are.
 *
 *     Button-Icon(h)      = snap(0.625h)
 *     Button-Icon-Only(h) = snap(0.70h)
 *
 * Thirteen of the design's fifteen sampled values reproduce exactly. The two
 * that move are called out on their rows below.
 *
 * Button-Text-Padding stays tabular: it is spacing, not a glyph size, and the
 * design repeats small and medium rather than scaling them, which no function
 * of height reproduces.
 *
 * ONE source of truth on purpose. --Button-Padding is currently declared
 * separately in componentStyleVars.ts (preview), exportToCSS.ts (CSS) and
 * generateFigmaJSON.ts (Figma) — three copies of one number, which is the
 * exact shape invariant 5 warns about. These import instead.
 */

export interface ButtonModeMetric {
  /** medium — the default mode */
  medium: number;
  small: number;
  large: number;
}

/** The three button heights a brand picks. Defaults match the studio's. */
export interface ButtonHeights {
  buttonHeight?: number;
  smallButtonHeight?: number;
  largeButtonHeight?: number;
}

/**
 * Type size roles, as their offset off the shared 3h/16 slope. The ladder is
 * evenly spaced by design: a button's number is 4px under its label, and an
 * avatar's initials sit halfway between.
 */
const TEXT_OFFSETS: Record<string, number> = {
  /** Label size for a text button. */
  'Button-Text': 9.5,
  /** Initials size for an avatar sitting in a button. */
  'Avatar-Text': 7.5,
  /**
   * Digit size for a counter or numeric button.
   * MOVED: the design's medium is 14; the shared slope puts it at 12. Small
   * (10) and large (16) reproduce exactly, so 14 was the outlier — it is the
   * only one of the three text rows whose medium sits off its own line.
   */
  'Button-Numbers': 5.5,
};

/**
 * Icon sizes as a fraction of the button height, before snapping.
 */
const ICON_RATIOS: Record<string, number> = {
  /**
   * Glyph beside a label.
   * MOVED: the design's small is 20; snapping puts it at 16. That also settles
   * an oddity in the table — at small the inline icon was LARGER (20) than the
   * icon-only one (16), which is backwards, since an icon-only button has the
   * whole button to fill and an inline icon is sharing it with text.
   */
  'Button-Icon': 0.625,
  /** Glyph for an icon-ONLY button, which owns the whole button. */
  'Button-Icon-Only': 0.70,
};

/**
 * The sizes icons are actually drawn at. An icon rendered between steps sits
 * off the pixel grid and softens, so these step rather than slide.
 */
export const ICON_RAMP = [16, 20, 24, 32, 40];

/** Values that are neither a glyph size nor a type size. */
export const BUTTON_MODE_METRICS: Record<string, ButtonModeMetric> = {
  /** Padding on the label wrapper — Figma's "Typography Holder". */
  'Button-Text-Padding': { medium: 4, small: 4, large: 8 },
};

/**
 * Type size for a given button height.
 *
 * Floored at 10px — the smallest size anywhere in the design's button group
 * and the point below which a label stops being readable. There is
 * deliberately no ceiling: the slope is gentle enough (3/16) that a very tall
 * button gets proportionally restrained type.
 */
const typeForHeight = (height: number, offset: number) =>
  Math.max(10, Math.round((3 * height) / 16 + offset));

/** Nearest rung of the icon ramp; ties go to the smaller, which never crowds. */
const snapIcon = (value: number) =>
  ICON_RAMP.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best, ICON_RAMP[0]);

/** Glyph size for a given button height. */
const iconForHeight = (height: number, ratio: number) => snapIcon(height * ratio);

const heightsOf = (h: ButtonHeights) => ({
  medium: h.buttonHeight ?? 32,
  small: h.smallButtonHeight ?? 24,
  large: h.largeButtonHeight ?? 56,
});

/** Every size that follows the brand's heights: the text ladder and the icons. */
export function derivedTextMetrics(h: ButtonHeights): Record<string, ButtonModeMetric> {
  const hs = heightsOf(h);
  const out: Record<string, ButtonModeMetric> = {};
  for (const [name, offset] of Object.entries(TEXT_OFFSETS)) {
    out[name] = {
      medium: typeForHeight(hs.medium, offset),
      small: typeForHeight(hs.small, offset),
      large: typeForHeight(hs.large, offset),
    };
  }
  for (const [name, ratio] of Object.entries(ICON_RATIOS)) {
    out[name] = {
      medium: iconForHeight(hs.medium, ratio),
      small: iconForHeight(hs.small, ratio),
      large: iconForHeight(hs.large, ratio),
    };
  }
  return out;
}

/** Every metric for one brand: the derived rows first, then the fixed table. */
export function buttonModeMetrics(h: ButtonHeights = {}): Record<string, ButtonModeMetric> {
  return { ...derivedTextMetrics(h), ...BUTTON_MODE_METRICS };
}

/** `--Name`, `--Sm-Name` and `--Lg-Name` for every metric, as CSS text. */
export function buttonModeMetricCSS(h: ButtonHeights = {}, indent = '  '): string[] {
  return Object.entries(buttonModeMetrics(h)).flatMap(([name, m]) => [
    `${indent}--${name}: ${m.medium}px;`,
    // Small is written out rather than aliased to the base even when the two
    // agree. The lib reads --Sm-* by name with no fallback, and an alias chain
    // is one more thing that can break; the numbers are the contract.
    `${indent}--Sm-${name}: ${m.small}px;`,
    `${indent}--Lg-${name}: ${m.large}px;`,
  ]);
}

/** The same set as a flat object for the preview's inline-style path. */
export function buttonModeMetricVars(h: ButtonHeights = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, m] of Object.entries(buttonModeMetrics(h))) {
    out[`--${name}`] = `${m.medium}px`;
    out[`--Sm-${name}`] = `${m.small}px`;
    out[`--Lg-${name}`] = `${m.large}px`;
  }
  return out;
}

/** The same set keyed the way the Figma Components.Button payload expects. */
export function buttonModeMetricFigma(h: ButtonHeights = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, m] of Object.entries(buttonModeMetrics(h))) {
    out[name] = m.medium;
    out[`Sm-${name}`] = m.small;
    out[`Lg-${name}`] = m.large;
  }
  return out;
}
