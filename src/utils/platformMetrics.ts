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

/**
 * `--Platform-Spacer` — the gap between sibling controls, per platform.
 *
 * The unit of separation a platform expects between two things that belong
 * together: the gap in a ButtonGroup, a toolbar, a row of chips. It is NOT a
 * general spacing scale and should not grow into one — a layout that wants
 * four sizes of gap wants a scale, and this is the one value that changes when
 * the same layout is rendered on a phone instead of a laptop.
 *
 * Desktop is tightest because a pointer is precise. The touch platforms are
 * looser, and Android is loosest: Material's baseline grid is 4dp with 12dp
 * between grouped controls, against Apple's 8pt grid.
 *
 * These mirror the values hand-authored in the Figma file's Devices-Type
 * collection. Figma keeps its own copy on purpose — the payload does not write
 * this variable, exactly as it does not write the platform button columns.
 */
export const PLATFORM_SPACER: Record<CSSPlatform, number> = {
  'Desktop': 8,
  'IOS-Mobile': 10,
  'IOS-Tablet': 10,
  'Android': 12,
};

/** The declaration for one platform block, section comment included. */
export function platformMetricCSS(platform: CSSPlatform, indent = '  '): string[] {
  return [
    `${indent}/* Platform */`,
    `${indent}--Platform-Spacer: ${PLATFORM_SPACER[platform]}px;`,
  ];
}
