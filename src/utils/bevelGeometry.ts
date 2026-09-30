// src/utils/bevelGeometry.ts
//
// ONE source of truth for the button bevel's shadow geometry and for the
// per-platform button sizing that goes with it. Both the CSS export
// (generateDesignSystem.ts) and the Figma export (generateFigmaJSON.ts) build
// their values from here, so the two artifacts cannot drift — the numbers are
// identical, and only the units differ: CSS gets px, Figma JSON gets bare
// numbers.
//
// ── The bevel ────────────────────────────────────────────────────────────────
// Two inset shadows: a HIGHLIGHT on the top-left inner edge and a LOWLIGHT on
// the bottom-right. In CSS and in Figma alike, an inset/inner shadow offset by
// +x/+y leaves its visible band on the TOP-LEFT — which is why the highlight
// carries the POSITIVE offsets and the lowlight the negative ones.
//
// Spread is NEGATIVE, and that is load-bearing. At spread 0 the inset blooms
// out to offset+blur (~2× the bevel) and reads far too large. The consuming
// lib says the same thing at DinoDesign/src/components/_shadows.js.
//
// ── Sizes ────────────────────────────────────────────────────────────────────
// Small and large keep one geometry each (their heights don't vary by
// platform). Medium is the default size and its height DOES vary by platform,
// so its geometry is emitted per platform — into the CSS [data-platform]
// blocks and into the Figma Platform collection.

export const PLATFORMS = ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android'] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * Button height per platform, per size, in px.
 *
 * Desktop is absent on purpose: it uses the design system's own chosen
 * heights, whatever the user picked. The others are the platforms' own — 44pt
 * on iOS and 48dp on Android at medium are the published touch minimums, and
 * the small and large steps are the design's, transcribed from the file's
 * Devices-Type columns.
 *
 * This used to be medium alone, which meant the SMALL and LARGE bevels were
 * computed from Desktop's heights on every platform: a 50px iOS large button
 * wearing the bevel of a 56px Desktop one, and a 32px iOS small wearing a
 * 24px Desktop one. The bevel is a fraction of the height, so a height table
 * missing two thirds of its rows produces a bevel that is wrong by the same
 * fraction.
 */
export const PLATFORM_BUTTON_HEIGHT: Record<Exclude<Platform, 'Desktop'>, SizeTriple> = {
  'IOS-Mobile': { medium: 44, small: 32, large: 50 },
  'IOS-Tablet': { medium: 44, small: 32, large: 50 },
  Android: { medium: 48, small: 32, large: 56 },
};

/** A metric that has a value per button size. */
export interface SizeTriple { medium: number; small: number; large: number }

/** The three size prefixes, in the spelling every Button token already uses. */
export const SIZE_PREFIX = { medium: '', small: 'Sm-', large: 'Lg-' } as const;
export type ButtonSize = keyof typeof SIZE_PREFIX;

/**
 * Minimum hit target per platform, in px. The SMALL button keeps its visual
 * size on every platform — a wrapper around it grows to this instead, so the
 * button looks identical while the tappable area meets the platform minimum.
 */
export const PLATFORM_TARGET: Record<Platform, number> = {
  Desktop: 24,
  'IOS-Mobile': 44,
  'IOS-Tablet': 44,
  Android: 48,
};

/**
 * Padding the wrapper adds on each side of a small button to reach
 * PLATFORM_TARGET, in px. Kept as its own table rather than derived from
 * (Target - smallHeight) / 2 because Desktop deliberately carries 4px of
 * breathing room even though its target already equals the button height.
 */
export const PLATFORM_SPACER: Record<Platform, number> = {
  Desktop: 4,
  'IOS-Mobile': 10,
  'IOS-Tablet': 10,
  Android: 12,
};

/**
 * The bevel's magnitude for a given button height: a percentage of the
 * height, capped at 20% so a design system that dials the bevel way up still
 * reads as an edge rather than a gradient.
 *
 * Rounded to a whole pixel so the CSS value and the Figma value are the same
 * number — sub-pixel differences here are invisible, but a mismatch between
 * the two artifacts is exactly what this module exists to prevent.
 */
export function bevelSize(height: number, percent: number): number {
  return Math.round(Math.min((height * percent) / 100, height / 5));
}

/** The eight numbers, keyed by their Figma variable-name suffix. */
export function bevelGeometry(height: number, percent: number): Record<string, number> {
  const b = bevelSize(height, percent);
  return {
    'Highlight-Offset-x': b,
    'Highlight-Offset-y': b,
    'Highlight-Blur-Radius': b,
    'Highlight-Spread': -b,
    'Lowlight-Offset-x': -b,
    'Lowlight-Offset-y': -b,
    'Lowlight-Blur-Radius': b,
    'Lowlight-Spread': -b,
  };
}

/**
 * The eight CSS custom properties for one size.
 * `prefix` is '' for medium, 'Sm-' for small, 'Lg-' for large — matching the
 * existing --Sm-Button-Radius / --Button-Radius / --Lg-Button-Radius naming.
 */
export function bevelCSS(prefix: string, height: number, percent: number, indent = '  '): string {
  return Object.entries(bevelGeometry(height, percent))
    .map(([suffix, value]) => `${indent}--${prefix}Button-${suffix}: ${value}px;`)
    .join('\n');
}

/** The same eight values as bare numbers, keyed for the Figma JSON. */
export function bevelJSON(prefix: string, height: number, percent: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [suffix, value] of Object.entries(bevelGeometry(height, percent))) {
    out[`${prefix}Button-${suffix}`] = value;
  }
  return out;
}

/**
 * A button's height on a platform, given the system's own height for that size.
 *
 * `size` defaults to medium so the existing two-argument callers keep working
 * unchanged — the signature grew rather than moved.
 */
export function platformButtonHeight(
  platform: Platform,
  desktopHeight: number,
  size: ButtonSize = 'medium',
): number {
  return platform === 'Desktop' ? desktopHeight : PLATFORM_BUTTON_HEIGHT[platform][size];
}

/** The system's own three button heights, as the user picked them. */
export interface DesktopHeights { medium: number; small: number; large: number }

/**
 * All THREE sizes' bevel geometry for one platform — 24 custom properties.
 *
 * Emitted per size because the bevel is a fraction of the button's height and
 * the three heights differ; emitted per platform because those heights differ
 * again per platform. Only the medium set used to be re-emitted per platform,
 * so a small or large button wore Desktop's bevel everywhere — an iOS large
 * (50px) carrying the geometry of a Desktop large (56px), and an iOS small
 * (32px) carrying a Desktop small's (24px).
 *
 * Desktop passes the user's own heights straight through; every other
 * platform substitutes its own from PLATFORM_BUTTON_HEIGHT.
 */
export function platformBevelCSS(
  platform: Platform,
  heights: DesktopHeights,
  percent: number,
  indent = '  ',
): string {
  return (Object.keys(SIZE_PREFIX) as ButtonSize[])
    .map((size) => bevelCSS(
      SIZE_PREFIX[size],
      platformButtonHeight(platform, heights[size], size),
      percent,
      indent,
    ))
    .join('\n');
}

/** The same 24 values as bare numbers, for the Figma payload. */
export function platformBevelJSON(
  platform: Platform,
  heights: DesktopHeights,
  percent: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const size of Object.keys(SIZE_PREFIX) as ButtonSize[]) {
    Object.assign(out, bevelJSON(
      SIZE_PREFIX[size],
      platformButtonHeight(platform, heights[size], size),
      percent,
    ));
  }
  return out;
}

/**
 * The bevel as the file now stores it: one number and its negative.
 *
 * `bevelGeometry` returns eight values, and all eight are `b` or `-b` —
 * Highlight offsets and blur are `b`, its spread is `-b`, Lowlight offsets and
 * spread are `-b`, its blur is `b`. So the eight are a presentation of two.
 *
 * Figma now holds the two, per size, per device, in Devices-Type, and
 * Component-Size's eight `Button-Highlight-*` / `Button-Lowlight-*` variables
 * ALIAS into them. That is 12 numbers per device instead of 48, and — the part
 * that matters — the alias is what makes a bevel follow the device at all. A
 * literal written into Component-Size would DETACH it, which is the one thing
 * that must not happen here.
 *
 * Names are the file's, including the trailing `-Negative` rather than a
 * leading one: `Button-Bevel-Negative`, `FAB-Sm-Bevel-Negative`. The writer is
 * update-only and matches on the full name, so a tidier spelling would be
 * skipped in silence.
 */
export function bevelPairs(prefix: string, height: number, percent: number): Record<string, number> {
  const b = bevelSize(height, percent);
  return { [`${prefix}Bevel`]: b, [`${prefix}Bevel-Negative`]: -b };
}

