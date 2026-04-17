/**
 * Accessibility contrast tests.
 * Verifies all design system tokens meet WCAG 2.1 contrast requirements.
 *
 * Rules:
 *   4.5:1 — Text, Quiet, Hotlink, Hotlink-Visited, Buttons-{Theme}-Text vs Button/Hover/Active
 *   3.1:1 — Header, Border, Icons, Focus-Visible, Buttons-{Theme}-Border vs Background/Hover/Active
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import {
  generateSemanticLightModeScale,
  toneToColorNumber,
  getLightness,
} from '../utils/colorScale';

// ─── Helpers ───

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = chroma(hex1).luminance();
  const l2 = chroma(hex2).luminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function assertContrast(fg: string, bg: string, minRatio: number, label: string) {
  const ratio = contrastRatio(fg, bg);
  expect(ratio, `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need ${minRatio}:1)`).toBeGreaterThanOrEqual(minRatio);
}

// Tone lookup tables — starting points (from buildPreviewCSS)
// The real app uses findAccessibleTone to nudge these if contrast fails
const TEXT_LOOKUP = [9, 9, 9, 9, 11, 1, 1, 2, 2, 3, 4, 4];
const HEADER_LOOKUP = [10, 10, 10, 10, 8, 2, 3, 4, 5, 5, 5, 5];
const QUIET_LOOKUP = [6, 6, 7, 8, 9, 2, 3, 4, 5, 5, 5, 5];
const BORDER_LOOKUP = [6, 6, 7, 9, 10, 2, 4, 4, 5, 5, 5, 5];
const HOVER_MAP = [1, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 12];

/** Find an accessible tone by nudging from start until contrast passes */
function findAccessibleTone(
  bgHex: string,
  palette: Array<{ hex: string }>,
  startN: number,
  minContrast: number,
): number {
  const bgIsLight = chroma(bgHex).luminance() > 0.3;
  const startHex = palette[startN - 1]?.hex;
  if (startHex && contrastRatio(startHex, bgHex) >= minContrast) return startN;
  if (bgIsLight) {
    for (let n = startN - 1; n >= 1; n--) {
      if (palette[n - 1]?.hex && contrastRatio(palette[n - 1].hex, bgHex) >= minContrast) return n;
    }
  } else {
    for (let n = startN + 1; n <= 12; n++) {
      if (palette[n - 1]?.hex && contrastRatio(palette[n - 1].hex, bgHex) >= minContrast) return n;
    }
  }
  return startN;
}

// ─── Test with real palettes ───

// Generate a test palette from a representative color
const TEST_COLORS = [
  { name: 'Warm brown', hex: '#c07854' },
  { name: 'Cool blue', hex: '#4a7a9b' },
  { name: 'Forest green', hex: '#486048' },
  { name: 'Deep purple', hex: '#6b4a8a' },
  { name: 'Neutral gray', hex: '#888888' },
];

TEST_COLORS.forEach(({ name, hex }) => {
  const palette = generateSemanticLightModeScale(hex, 62);
  const p = (n: number) => palette[n - 1]?.hex || '#000000';

  describe(`Accessibility: ${name} (${hex})`, () => {
    // Test each surface tone as a background
    [9, 10, 11, 12].forEach(surfaceN => {
      const bg = p(surfaceN);
      const textN = findAccessibleTone(bg, palette, TEXT_LOOKUP[surfaceN - 1], 4.5);
      const headerN = findAccessibleTone(bg, palette, HEADER_LOOKUP[surfaceN - 1], 3.1);
      const quietN = findAccessibleTone(bg, palette, QUIET_LOOKUP[surfaceN - 1], 3.1);
      const borderN = findAccessibleTone(bg, palette, BORDER_LOOKUP[surfaceN - 1], 3.1);
      const hoverN = HOVER_MAP[surfaceN - 1];

      describe(`Surface Color-${surfaceN} (${bg})`, () => {
        // ── 4.5:1 requirements ──

        it(`Text (Color-${textN}) has 4.5:1 contrast to background`, () => {
          assertContrast(p(textN), bg, 4.5, 'Text vs Background');
        });

        it(`Quiet (Color-${quietN}) has 3.1:1 contrast to background`, () => {
          assertContrast(p(quietN), bg, 3.1, 'Quiet vs Background');
        });

        // ── 3.1:1 requirements ──

        it(`Header (Color-${headerN}) has 3.1:1 contrast to background`, () => {
          assertContrast(p(headerN), bg, 3.1, 'Header vs Background');
        });

        it(`Border (Color-${borderN}) has 3.1:1 contrast to background`, () => {
          assertContrast(p(borderN), bg, 3.1, 'Border vs Background');
        });
      });
    });

    // ── Button contrast tests ──
    // Buttons use the extracted tone color as background
    const PC = toneToColorNumber(getLightness(hex));
    const OB = PC >= 9 ? 6 : 5;

    describe('Button contrast', () => {
      const btnBg = p(PC);
      const btnTextN = findAccessibleTone(btnBg, palette, TEXT_LOOKUP[PC - 1], 4.5);
      const btnHoverN = HOVER_MAP[PC - 1];
      const btnBorderN = findAccessibleTone(p(11), palette, BORDER_LOOKUP[PC - 1], 3.1);

      it(`Button text (Color-${btnTextN}) has 4.5:1 contrast to button bg (Color-${PC})`, () => {
        assertContrast(p(btnTextN), btnBg, 4.5, 'Button Text vs Button');
      });

      it(`Button text (Color-${btnTextN}) has 4.5:1 contrast to hover (Color-${btnHoverN})`, () => {
        assertContrast(p(btnTextN), p(btnHoverN), 4.5, 'Button Text vs Hover');
      });

      it(`Button border (Color-${btnBorderN}) has 3.1:1 contrast to background (Color-11)`, () => {
        // Border contrast checked against a light surface (Color-11)
        assertContrast(p(btnBorderN), p(11), 3.1, 'Button Border vs Surface');
      });
    });

    // ── Semantic button contrast ──
    describe('Semantic button contrast (OB)', () => {
      const semBg = p(OB);
      const semTextN = findAccessibleTone(semBg, palette, TEXT_LOOKUP[OB - 1], 4.5);

      it(`Semantic button text (Color-${semTextN}) has 4.5:1 contrast to button (Color-${OB})`, () => {
        assertContrast(p(semTextN), semBg, 4.5, 'Semantic Button Text vs Button');
      });
    });

    // ── Container contrast ──
    describe('Container contrast (Color-10)', () => {
      const containerBg = p(10);
      const contTextN = findAccessibleTone(containerBg, palette, TEXT_LOOKUP[10 - 1], 4.5);
      const contHeaderN = findAccessibleTone(containerBg, palette, HEADER_LOOKUP[10 - 1], 3.1);

      it(`Container text (Color-${contTextN}) has 4.5:1 contrast to container bg`, () => {
        assertContrast(p(contTextN), containerBg, 4.5, 'Container Text vs Container');
      });

      it(`Container header (Color-${contHeaderN}) has 3.1:1 contrast to container bg`, () => {
        assertContrast(p(contHeaderN), containerBg, 3.1, 'Container Header vs Container');
      });
    });
  });
});

// ── BW text contrast ──

describe('BW text contrast', () => {
  it('Black text (#1a1a1a) has 4.5:1 on white (#ffffff)', () => {
    assertContrast('#1a1a1a', '#ffffff', 4.5, 'Black on White');
  });

  it('White text (#ffffff) has 4.5:1 on black (#1a1a1a)', () => {
    assertContrast('#ffffff', '#1a1a1a', 4.5, 'White on Black');
  });

  it('Black text has 4.5:1 on Primary-Light surface (Color-11)', () => {
    // Color-11 is typically very light — black text should pass
    TEST_COLORS.forEach(({ name, hex }) => {
      const palette = generateSemanticLightModeScale(hex, 62);
      const bg = palette[10]?.hex || '#f0f0f0'; // Color-11
      assertContrast('#1a1a1a', bg, 4.5, `Black text on ${name} Color-11`);
    });
  });
});

// ── Neutral scale contrast ──

describe('Neutral scale contrast', () => {
  const NEUTRAL = [
    '#050505', '#1a1a1a', '#2e2e2e', '#434343', '#585858',
    '#8e8e8e', '#a3a3a3', '#b8b8b8', '#cccccc', '#e0e0e0',
    '#f0f0f0', '#ffffff',
  ];

  it('Neutral Color-12 (white) — black text passes 4.5:1', () => {
    assertContrast('#1a1a1a', NEUTRAL[11], 4.5, 'Black on Neutral-12');
  });

  it('Neutral Color-1 (near-black) — white text passes 4.5:1', () => {
    assertContrast('#ffffff', NEUTRAL[0], 4.5, 'White on Neutral-1');
  });

  it('Neutral Color-11 — dark text passes 4.5:1', () => {
    assertContrast(NEUTRAL[3], NEUTRAL[10], 4.5, 'Neutral-4 on Neutral-11');
  });
});

// ── Tag contrast ──

describe('Tag text vs Tag BG contrast', () => {
  // Tags use Color-8 (Vibrant mapped to Color-8) for BG
  // Tag text uses the Text lookup for that Color-N
  const TAG_BG_N = 8; // Color-Vibrant = Color-8

  TEST_COLORS.forEach(({ name, hex }) => {
    const palette = generateSemanticLightModeScale(hex, 62);
    const p = (n: number) => palette[n - 1]?.hex || '#000000';
    const tagBg = p(TAG_BG_N);
    const tagTextN = TEXT_LOOKUP[TAG_BG_N - 1];

    it(`${name}: Tag text (Color-${tagTextN}) has 4.5:1 contrast to Tag BG (Color-${TAG_BG_N})`, () => {
      assertContrast(p(tagTextN), tagBg, 4.5, `Tag Text vs Tag BG (${name})`);
    });
  });

  // BW tag text — white on dark tag backgrounds
  TEST_COLORS.forEach(({ name, hex }) => {
    const palette = generateSemanticLightModeScale(hex, 62);
    const tagBg = palette[TAG_BG_N - 1]?.hex || '#000000';
    const isLightBg = chroma(tagBg).luminance() > 0.3;

    it(`${name}: BW tag text has 4.5:1 contrast to Tag BG`, () => {
      const textColor = isLightBg ? '#000000' : '#ffffff';
      assertContrast(textColor, tagBg, 4.5, `BW Tag Text vs Tag BG (${name})`);
    });
  });
});

// ── Focus-Visible contrast ──

describe('Focus-Visible contrast', () => {
  const focusColor = '#3b82f6';

  it('Focus-Visible (#3b82f6) has 3.1:1 on white', () => {
    assertContrast(focusColor, '#ffffff', 3.1, 'Focus on White');
  });

  it('Focus-Visible (#3b82f6) has 3.1:1 on light surfaces', () => {
    TEST_COLORS.forEach(({ name, hex }) => {
      const palette = generateSemanticLightModeScale(hex, 62);
      const bg = palette[10]?.hex || '#f0f0f0';
      assertContrast(focusColor, bg, 3.1, `Focus on ${name} Color-11`);
    });
  });
});
