/**
 * The Theme collection's modes — one list, every target.
 *
 * This existed three times: `THEMES` in generateFigmaJSON, a hand-written
 * selector array in exportToCSS, and the keys of two maps in
 * exportColorSystem. They drifted, and the drift was invisible from either
 * side because each copy was self-consistent:
 *
 *   Figma named nine and the generator produced four of them (Info, Success,
 *   Warning and Error were in the mode list and built by nobody), so the
 *   collection imported four modes short.
 *
 *   CSS emitted thirty-three, twenty-four of which named shades that had been
 *   removed, and none of which was a bare state palette — so
 *   data-theme="Info" painted nothing while data-theme="Info-Medium" painted
 *   a theme Figma no longer had.
 *
 * Invariant 5 in its purest form: both sides present, both self-consistent,
 * neither agreeing. So there is one list now and everything reads it.
 *
 * ── Why the shades are gone ───────────────────────────────────────────────
 * A shade and a surface level were two ways of saying one thing. What used to
 * be `Primary-Light` is `data-theme="Primary"` with
 * `data-surface="Surface-Brightest"` — the surface ladder already walks that
 * axis, and it walks it per theme rather than needing a named mode per step.
 *
 * The cost of keeping both was structural, not aesthetic: four modes per
 * palette is thirty-three, and Figma caps a collection at ten. Nine fits.
 */

/** The palettes, in the order the Theme collection carries them. */
export const THEME_PALETTES = [
  'Primary', 'Secondary', 'Tertiary', 'Neutral',
  'Info', 'Success', 'Warning', 'Error',
] as const;

/** Every mode, Default first.
 *
 *  Default LEADS, and the order is load-bearing on the Figma side: the plugin
 *  reads the keys in order and makes the first one the collection's default
 *  mode. See themeOrder(), which moves the user's pick to second. */
export const THEME_MODES = ['Default', ...THEME_PALETTES] as const;

/**
 * Themes the CSS has and Figma does not, deliberately.
 *
 * A bar is a COMPOSITION of a user pick — "the app bar is Primary at tone 4" —
 * rather than a palette of its own. Figma expresses that by pinning a mode on
 * the bar's frame, which needs no extra mode; CSS has no frame to pin, so it
 * needs a name to put in data-theme.
 *
 * This asymmetry is the reason a plain "the two lists must match" test would
 * be wrong, and why it is written down rather than discovered again.
 */
export const CSS_ONLY_THEMES = ['App-Bar', 'Nav-Bar', 'Status'] as const;

/** Every data-theme value the CSS export emits a block for, Default aside. */
export const CSS_THEME_NAMES = [...THEME_PALETTES, ...CSS_ONLY_THEMES];

/**
 * The tone a state palette's theme resolves at.
 *
 * 6 — what the removed `-Medium` held; both theme maps carried the comment
 * "Medium always uses Color-6". A brand palette's bare theme uses the tone the
 * USER picked, and a state palette has no pick, so full strength is the
 * sensible bare reading. Surface-Brightest then reaches the tint `-Light`
 * used to name.
 */
export const STATE_THEME_TONE = 6;

/** Shade suffixes that no longer exist, for tests and migration checks. */
export const REMOVED_THEME_SHADES = ['-Light', '-Medium', '-Dark'] as const;
