// deviceChrome.ts — the system chrome each device reserves, and the overlay
// offsets computed from it.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// Figma cannot add two variables. A floating element's offset from a screen
// edge is `system chrome + clearance`, and both halves are per device, so the
// sum has to be computed here and shipped as one number — the same reason
// inputMetrics.ts exists, and the same reason the Number Field's stepper stack
// could not be expressed as a variable.
//
// ── Three insets, deliberately separate ─────────────────────────────────────
//
//   1. SYSTEM CHROME    the status bar, app bar, home indicator. The OS owns
//                       these; a brand cannot move them.
//   2. CONTENT COLUMN   Margin / Content-Window-*. Where the app's content
//                       region starts. A layout decision, and NOT what an
//                       overlay uses — a snackbar floats over the content
//                       rather than sitting in it.
//   3. FLOAT CLEARANCE  the gap that makes a floating thing read as floating
//                       and leaves its shadow somewhere to fall.
//
// Conflating 1 and 3 is the trap. Chrome legitimately goes to ZERO on Desktop,
// which has none; clearance never does. One combined hand-maintained number
// would have to be non-zero everywhere and would then be carrying two meanings,
// so nobody could safely change it. Generated, the formula guarantees the floor.

/** The seven Devices-Type modes, in the collection's order. */
export const DEVICE_MODES = [
  'Desktop',
  'IOS-Tablet-Vertical',
  'IOS-Tablet-Horizontal',
  'Android-Tablet-Vertical',
  'Android-Tablet-Horizontal',
  'IOS-Mobile',
  'Android-Mobile',
] as const;

export type DeviceMode = (typeof DEVICE_MODES)[number];

/**
 * Top chrome — status bar plus app bar, as the file already holds it in
 * `Devices-Type::App and Status`.
 *
 * Mirrored here rather than derived: Apple's and Google's bar heights are
 * specs, not ratios, exactly like PLATFORM_BUTTON_HEIGHT's 44 and 48. The
 * numbers are read from the Figma file so the two cannot disagree on import —
 * if they ever do, the file is the one that moved and this table is what the
 * generator will write back over it.
 */
export const APP_AND_STATUS: Record<DeviceMode, number> = {
  'Desktop': 0,
  'IOS-Tablet-Vertical': 74,
  'IOS-Tablet-Horizontal': 74,
  'Android-Tablet-Vertical': 88,
  'Android-Tablet-Horizontal': 88,
  'IOS-Mobile': 74,
  'Android-Mobile': 88,
};

/**
 * Bottom chrome with NO bottom navigation — the home indicator or gesture bar
 * alone.
 *
 * The default assumption is that a screen has no bottom nav, because a nav bar
 * is a choice a template makes rather than something the device imposes. When
 * the Adaptive-Navigation templates place one, they add its height on top of
 * this; the OS inset underneath does not change.
 *
 * Values are the platform specs: iPhone's home indicator is 34pt, iPad's 20pt,
 * Android's gesture bar 24dp. Desktop has none.
 *
 * NOTE this is deliberately NOT the file's current `Main-Content-Bottom-Padding`
 * of 83 on phones. That 83 is indicator PLUS a bottom tab bar (iOS 49 + 34),
 * which bakes the navigation choice into the device inset — so a screen with no
 * bottom nav reserves space for one that is not there.
 */
export const BOTTOM_INDICATOR: Record<DeviceMode, number> = {
  'Desktop': 0,
  'IOS-Tablet-Vertical': 20,
  'IOS-Tablet-Horizontal': 20,
  'Android-Tablet-Vertical': 24,
  'Android-Tablet-Horizontal': 24,
  'IOS-Mobile': 34,
  'Android-Mobile': 24,
};

/**
 * How far a floating element sits from the edge it is offset from, on top of
 * the chrome.
 *
 * One number for every device today, matching the `Sizing-3` the Snackbar shell
 * already uses on its free side. It is its own named constant rather than a
 * reach into the sizing scale because the two answer different questions: a
 * sizing step is a rhythm, this is "enough room for a shadow to fall". If a
 * phone ever wants a tighter float than a desktop, this is the table that gains
 * a column — the sizing scale should not.
 */
export const FLOAT_CLEARANCE: Record<DeviceMode, number> = {
  'Desktop': 24,
  'IOS-Tablet-Vertical': 24,
  'IOS-Tablet-Horizontal': 24,
  'Android-Tablet-Vertical': 24,
  'Android-Tablet-Horizontal': 24,
  'IOS-Mobile': 24,
  'Android-Mobile': 24,
};

/** Every overlay offset one device column carries, keyed by its Figma name. */
export function overlayOffsets(device: DeviceMode): Record<string, number> {
  const clearance = FLOAT_CLEARANCE[device];
  return {
    /* Top: below the status bar AND the app bar, because an overlay that
       starts under the status bar alone lands on top of the app bar's title. */
    'SnackBar-Top': APP_AND_STATUS[device] + clearance,
    /* Bottom: above the home indicator only. A bottom nav, where a template
       places one, is added by the template. */
    'SnackBar-Bottom': BOTTOM_INDICATOR[device] + clearance,
    /* Published on its own so a component that needs the gap WITHOUT the
       chrome — one floating inside a panel rather than against the screen —
       has the same number to read instead of typing 24. */
    'Overlay-Clearance': clearance,
  };
}

/** Names this module owns in the Devices-Type collection. */
export function overlayOffsetNames(): string[] {
  return Object.keys(overlayOffsets('Desktop'));
}

/* ── The CSS half ───────────────────────────────────────────────────────────
 *
 * Figma carries seven device modes; the stylesheet carries four platform
 * blocks. Everything above is keyed by device, so the collapse happens here
 * rather than in a second table — a second table is how the two sides come to
 * disagree, which is invariant 5 in its most ordinary form.
 *
 * It collapses cleanly TODAY: both iPad orientations reserve the same chrome,
 * and Android's phone and tablet both sit at 88/24. That is a fact about the
 * current numbers, not a guarantee — if Android tablets ever take a different
 * gesture bar from Android phones, one `[data-device="Android"]` block can no
 * longer say what both devices need, and the CSS would silently ship one
 * device's answer for both.
 *
 * So the collapse is CHECKED rather than assumed. `platformOverlayOffsets`
 * throws when the devices feeding a platform disagree, which turns a silent
 * wrong number into a failing build — and the fix at that point is a real
 * decision (split the block, or accept the coarser value), not something a
 * generator should make on its own.
 */

import { SEEDS_FROM } from './typographyPlatform';
import { CSS_PLATFORMS, type CSSPlatform } from './platformMetrics';

/** The devices that share one platform block. */
export function devicesFor(platform: CSSPlatform): DeviceMode[] {
  return DEVICE_MODES.filter((d) => SEEDS_FROM[d] === platform);
}

/**
 * One platform block's overlay offsets.
 *
 * Throws rather than picking a winner when its devices disagree — see the
 * note above. The message names both devices and the value they differ on,
 * because "the Android block is ambiguous" is not enough to act on.
 */
export function platformOverlayOffsets(platform: CSSPlatform): Record<string, number> {
  const devices = devicesFor(platform);
  if (devices.length === 0) throw new Error(`No device feeds [data-device="${platform}"]`);

  const [first, ...rest] = devices;
  const base = overlayOffsets(first);
  for (const device of rest) {
    const other = overlayOffsets(device);
    for (const name of Object.keys(base)) {
      if (base[name] !== other[name]) {
        throw new Error(
          `[data-device="${platform}"] cannot carry one ${name}: ` +
          `${first} needs ${base[name]}px, ${device} needs ${other[name]}px. ` +
          `Split the platform block or reconcile the device table in deviceChrome.ts.`
        );
      }
    }
  }
  return base;
}

/**
 * The declarations for one platform block.
 *
 * Desktop's are emitted too, at `:root`, even though its chrome is zero and
 * every value is therefore just the clearance. A consumer that never sets
 * data-device still needs `--SnackBar-Top` to resolve — an unset custom
 * property paints nothing and reports nothing, which is the failure mode
 * invariant 5 exists to catch.
 */
export function overlayOffsetCSS(platform: CSSPlatform, indent = '  '): string[] {
  const o = platformOverlayOffsets(platform);
  return [
    `${indent}/* Floating overlays — the platform's chrome plus room for a shadow */`,
    `${indent}--SnackBar-Top: ${o['SnackBar-Top']}px;`,
    `${indent}--SnackBar-Bottom: ${o['SnackBar-Bottom']}px;`,
    `${indent}--Overlay-Clearance: ${o['Overlay-Clearance']}px;`,
  ];
}

/** Every platform's block, for a test that walks all four. */
export function allPlatformOverlayOffsets(): Record<string, Record<string, number>> {
  return Object.fromEntries(CSS_PLATFORMS.map((p) => [p, platformOverlayOffsets(p)]));
}

/* `overlayOffsetTokens` was here, and went with the Platform section it fed.
 *
 * It rendered these three as design-token entries for `designSystemJSON.Platform`
 * — a THIRD surface, added so a consumer reading tokens.json for one platform
 * metric would not find the others missing. That reasoning held while Platform
 * existed. The collection has since been retired in favour of Devices-Type, and
 * the section with it, so the function had one caller and then none.
 *
 * The offsets still reach both surfaces that matter: foundation.css via
 * overlayOffsetCSS, and the Figma payload via overlayOffsets on each of the
 * seven device columns. Devices-Type holds SnackBar-Top, SnackBar-Bottom and
 * Overlay-Clearance directly, which is where they belong. */
