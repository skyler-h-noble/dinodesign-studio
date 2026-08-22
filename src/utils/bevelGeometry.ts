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
 * Medium (default) button height per platform, in px.
 *
 * Desktop is absent on purpose: it uses the design system's own chosen button
 * height, whatever the user picked. The others are the platform touch
 * minimums and are fixed.
 */
export const PLATFORM_BUTTON_HEIGHT: Record<Exclude<Platform, 'Desktop'>, number> = {
  'IOS-Mobile': 44,
  'IOS-Tablet': 44,
  Android: 48,
};

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

/** The medium button's height on a platform, given the system's own height. */
export function platformButtonHeight(platform: Platform, desktopHeight: number): number {
  return platform === 'Desktop' ? desktopHeight : PLATFORM_BUTTON_HEIGHT[platform];
}
