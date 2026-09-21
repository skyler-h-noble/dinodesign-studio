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
import {
  CSS_PLATFORMS, PLATFORM_SPACER, PLATFORM_BUTTON, platformButtonMetrics,
} from '../utils/platformMetrics';
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

describe('platform button metrics', () => {
  const CSS_NAME: Record<string, string> = {
    'Medium Button': '--Button-Height', 'Small Button': '--Sm-Button-Height',
    'Large Button': '--Lg-Button-Height', 'Medium Button Icon': '--Button-Icon',
    'Small Button Icon': '--Sm-Button-Icon', 'Large Button Icon': '--Lg-Button-Icon',
  };

  it('overrides base.css on SPECIFICITY, not on load order', () => {
    /* The provider injects this file at slot 3 and base.css at slot 5, and
       base.css declares --Button-Height at :root. A bare [data-platform="…"]
       ties with :root at (0,1,0), so the later file would win and these
       overrides would do nothing — silently, because an override that loses
       looks exactly like one that was never written.

       :root[data-platform="…"] scores (0,2,0) and wins wherever it loads. If
       this ever regresses to the bare selector, buttons quietly return to the
       brand's desktop heights on every phone. */
    for (const platform of CSS_PLATFORMS) {
      if (platform === 'Desktop') continue;
      const hiSpec = new RegExp(`:root\\[data-platform="${platform}"\\]\\s*\\{[^}]*--Button-Height`);
      expect(`${platform}: ${hiSpec.test(CSS)}`).toBe(`${platform}: true`);
    }
    /* And never in a bare block, where it would lose. */
    const bareWithButtons = CSS.split('\n\n').some((chunk) =>
      /^\[data-platform="[^"]+"\]/.test(chunk) && /--Button-Height/.test(chunk));
    expect(bareWithButtons).toBe(false);
  });

  it('gives Desktop no override — the brand owns that column', () => {
    expect(/:root\[data-platform="Desktop"\]\s*\{[^}]*--Button-Height/.test(CSS)).toBe(false);
    expect(platformButtonMetrics('Desktop' as never)).toEqual({});
  });

  it('ships the same numbers to the CSS and to Figma', () => {
    /* One table, two emitters. The web and Figma disagreeing about how tall a
       button is would be invisible until someone measured a screenshot. */
    for (const device of ['IOS-Mobile', 'Android-Mobile', 'IOS-Tablet-Vertical',
                          'IOS-Tablet-Horizontal', 'Android-Tablet-Vertical',
                          'Android-Tablet-Horizontal'] as const) {
      const figma = platformButtonMetrics(device);
      expect(Object.keys(figma).sort()).toEqual(Object.keys(CSS_NAME).sort());
      const platform = device.startsWith('IOS-Mobile') ? 'IOS-Mobile'
        : device.startsWith('IOS') ? 'IOS-Tablet' : 'Android';
      const block = CSS.match(
        new RegExp(`:root\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      for (const [figmaName, cssName] of Object.entries(CSS_NAME)) {
        const inCSS = block.match(new RegExp(`${cssName}:\\s*(\\d+)px;`))?.[1];
        expect(`${device} ${figmaName}: ${inCSS}`).toBe(`${device} ${figmaName}: ${figma[figmaName]}`);
      }
    }
  });

  it('states the icons rather than deriving them', () => {
    /* buttonSizing derives icons as snapIcon(height * 0.625) off ICON_RAMP
       [16,20,24,32,40]. Android's 48px button carries an 18px glyph — the
       ratio gives 32, and 18 is not a rung at all. Two published vendor
       tables, not one curve; anything that "simplifies" these back into the
       ratio changes every touch platform's icons. */
    expect(PLATFORM_BUTTON.Android.icon.medium).toBe(18);
    expect(PLATFORM_BUTTON.Android.height.medium).toBe(48);
    expect(Math.round(48 * 0.625)).not.toBe(PLATFORM_BUTTON.Android.icon.medium);
  });
});
