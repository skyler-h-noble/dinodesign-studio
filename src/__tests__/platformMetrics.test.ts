/**
 * --Platform-Spacer reaches every platform block of the SHIPPED stylesheet.
 *
 * Built through buildTypographyTokensCSS, not read off the static asset: the
 * Desktop block is spliced away and regenerated per design, so a spacer added
 * to the asset by hand would be silently dropped from the one platform most
 * users are on. That is the same shape as the Display-Medium bug — a value
 * present in the file, absent from the download.
 */
import { describe, it, expect } from 'vitest';
import { buildTypographyTokensCSS } from '../utils/typographyTokens';
import { CSS_PLATFORMS, PLATFORM_SPACER } from '../utils/platformMetrics';
import { parsePlatformBlock } from '../utils/typographyPlatform';

const CSS = buildTypographyTokensCSS([
  { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
  { type: 'header', family: 'Poppins', weight: '600' },
  { type: 'body', family: 'Inter', weight: '400' },
] as never);

const spacerIn = (platform: string): string | undefined => {
  const block = CSS.match(new RegExp(`\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  return block?.[1].match(/--Platform-Spacer:\s*([^;]+);/)?.[1];
};

describe('--Platform-Spacer', () => {
  it('is declared in every platform block, at the table\'s value', () => {
    for (const platform of CSS_PLATFORMS) {
      expect(`${platform}: ${spacerIn(platform)}`)
        .toBe(`${platform}: ${PLATFORM_SPACER[platform]}px`);
    }
  });

  it('is not the same number everywhere', () => {
    /* A per-platform variable that holds one value is a constant wearing a
       cascade. If these ever collapse, the [data-platform] blocks are dead
       weight and the token should be a plain :root declaration instead. */
    expect(new Set(Object.values(PLATFORM_SPACER)).size).toBeGreaterThan(1);
  });

  it('is invisible to the typography parser', () => {
    /* parsePlatformBlock reads this same block for type styles. It matches on
       a Font-Size / Font-Weight / Line-Height / Letter-Spacing suffix, so a
       non-typographic property must not register as a style — a bogus
       "Platform" style would ship to Figma as a variable group. */
    for (const platform of CSS_PLATFORMS) {
      const { styles, families } = parsePlatformBlock(CSS, platform);
      expect(Object.keys(styles)).not.toContain('Platform');
      expect(Object.keys(families)).not.toContain('Platform');
    }
  });
});
