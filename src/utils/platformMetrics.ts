import { SEEDS_FROM, type DeviceType } from './typographyPlatform';
import { PLATFORM_BUTTON_HEIGHT, type SizeTriple } from './bevelGeometry';
import { DEVICE_BUTTON_NAMES, SIZE_MODES } from './componentSize';

/**
 * Metrics that follow the DEVICE rather than the brand.
 *
 * The studio owns how tall a brand's own buttons are; Apple and Google own how
 * far apart things sit on their platforms. Those are different authorities, so
 * they are different tables — see componentSize.ts, which keeps the same split
 * for button heights and writes only the Desktop column to Figma so an import
 * cannot overwrite the platform columns.
 *
 * This file holds the CSS half. The four keys are the PLATFORM blocks the
 * stylesheet actually has, not the seven device modes Figma has: the two
 * tablet orientations and the two Android form factors share a block, because
 * nothing here changes when a tablet is turned on its side.
 */

/** The platform blocks `typography-tokens.css` declares. */
export type CSSPlatform = 'Desktop' | 'IOS-Mobile' | 'IOS-Tablet' | 'Android';

export const CSS_PLATFORMS: readonly CSSPlatform[] =
  ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android'] as const;

/* --Platform-Spacer is NOT here.
 *
 * It already existed, in bevelGeometry.ts, and generateDesignSystem emits it
 * into foundation.css beside --Target, --Min-Stack-Gap and the per-platform
 * button height. A second copy was added here with a DIFFERENT Desktop value
 * (8 against the incumbent's 4), so the stylesheet declared the same custom
 * property twice and which one won depended on load order.
 *
 * The incumbent's 4 is deliberate and documented where it lives: Desktop
 * "carries 4px of breathing room even though its target already equals the
 * button height". Import it from there; do not restate it. */

/** The platforms whose metrics are specified by Apple or Google, not by the brand. */
export type TouchPlatform = Exclude<CSSPlatform, 'Desktop'>;

/**
 * Button height and glyph size, per touch platform.
 *
 * Desktop is deliberately absent. Its heights are the user's slider picks and
 * its icons are DERIVED from them (`snapIcon(height * 0.625)` in
 * buttonSizing.ts) — the studio owns that column and always has. These six
 * numbers are the columns it does not own.
 *
 * The icons are stated, not derived, because the ratio does not describe them:
 * Android's 48px button carries an 18px glyph where the ratio would give 32,
 * and 18 is not even a rung of ICON_RAMP. Material draws 18dp and 24dp icons;
 * Apple draws 20pt and 24pt. Those are two published tables, not one curve, so
 * running either through a brand ratio produces a number neither vendor
 * specifies.
 *
 * Transcribed from the Devices-Type collection in the Figma file, which is the
 * authority for them. All three iOS modes hold one column and all three
 * Android modes another — a tablet turned on its side changes nothing here —
 * which is why this is keyed by platform and not by the seven device modes.
 */
export const PLATFORM_BUTTON: Record<TouchPlatform, { height: SizeTriple; icon: SizeTriple }> = {
  /* Heights come from bevelGeometry's PLATFORM_BUTTON_HEIGHT rather than being
     restated. The bevel is a fraction of the height, so the two tables
     disagreeing would put a button's bevel out of proportion with the button —
     and a duplicated constant is how that happens. */
  'IOS-Mobile': {
    height: PLATFORM_BUTTON_HEIGHT['IOS-Mobile'],
    icon:   { medium: 20, small: 16, large: 24 },
  },
  'IOS-Tablet': {
    height: PLATFORM_BUTTON_HEIGHT['IOS-Tablet'],
    icon:   { medium: 20, small: 16, large: 24 },
  },
  'Android': {
    height: PLATFORM_BUTTON_HEIGHT.Android,
    icon:   { medium: 18, small: 18, large: 24 },
  },
};

export function isTouchPlatform(p: CSSPlatform): p is TouchPlatform {
  return p !== 'Desktop';
}

/**
 * The CSS names for one platform's button metrics.
 *
 * NOT CURRENTLY CALLED, and that is not an oversight to fix by wiring it in.
 * The `:root[data-platform="…"]` button blocks live at the bottom of the
 * static `typography-tokens.css`, hand-written, and `buildTypographyTokensCSS`
 * carries them through untouched — it only splices the Desktop TYPE block.
 * `platformMetrics.test.ts` ("ships the same numbers to the CSS and to Figma")
 * parses those blocks back out and compares them to PLATFORM_BUTTON, so the
 * two copies cannot drift even though only one of them is generated.
 *
 * Kept because it is what a move to generating those blocks would use, and
 * because the selector rule below is worth stating somewhere in code. If you
 * do wire it in, the asset's hand-written blocks have to come OUT in the same
 * pass — two sources for one declaration is decided by load order, which is
 * exactly what --Platform-Spacer did.
 *
 * Only the six base names are written. `--Small-Button-Height` and
 * `--Large-Button-Height` are declared in :root as `var(--Sm-Button-Height)`
 * and `var(--Lg-Button-Height)`, and a var() in a custom property resolves
 * against the element it is used on — so the back-compat spellings follow a
 * platform override without being restated here. Restating them would create
 * a second place to keep in step.
 */
export function platformButtonCSS(platform: TouchPlatform, indent = '  '): string[] {
  const { height, icon } = PLATFORM_BUTTON[platform];
  return [
    `${indent}/* Buttons — the platform's, not the brand's */`,
    `${indent}--Button-Height: ${height.medium}px;`,
    `${indent}--Sm-Button-Height: ${height.small}px;`,
    `${indent}--Lg-Button-Height: ${height.large}px;`,
    `${indent}--Button-Icon: ${icon.medium}px;`,
    `${indent}--Sm-Button-Icon: ${icon.small}px;`,
    `${indent}--Lg-Button-Icon: ${icon.large}px;`,
  ];
}

/**
 * One device's worth of the Devices-Type button variables, Figma's names.
 *
 * The counterpart to componentSize's desktopButtonMetrics. Together they cover
 * all seven modes, which reverses the earlier policy of writing Desktop alone:
 * the platform numbers now live in this file, so an import states them rather
 * than preserving whatever the Figma file happened to hold.
 *
 * That is a deliberate trade, not an oversight corrected. Leaving them
 * unwritten protected hand-authored values from being overwritten, and that
 * protection mattered while the numbers lived nowhere else. Now that one table
 * feeds both the CSS and the payload, the bigger risk is the two disagreeing.
 *
 * Returns {} for Desktop, whose column the studio owns.
 */
export function platformButtonMetrics(device: DeviceType): Record<string, number> {
  const platform = SEEDS_FROM[device] as CSSPlatform;
  if (!isTouchPlatform(platform)) return {};
  const { height, icon } = PLATFORM_BUTTON[platform];
  const byBase: Record<string, SizeTriple> = { 'Button-Height': height, 'Button-Icon': icon };
  const out: Record<string, number> = {};
  for (const [base, names] of Object.entries(DEVICE_BUTTON_NAMES)) {
    const triple = byBase[base];
    if (!triple) continue;
    for (const mode of SIZE_MODES) out[names[mode]] = triple[mode];
  }
  return out;
}
