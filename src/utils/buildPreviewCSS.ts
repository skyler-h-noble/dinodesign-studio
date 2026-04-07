import chroma from 'chroma-js';
import type { ColorScheme, UserSelections, ComponentStyle } from '../types';
import { toneToColorNumber } from './colorScale';

/**
 * Builds the complete CSS for the phone preview iframe.
 * Follows the real DynoDesign token cascade.
 * Called every time the user changes a selection or toggles light/dark.
 */

interface BuildInput {
  colorScheme: ColorScheme;
  userSelections: UserSelections;
  componentStyle: ComponentStyle;
  mode: 'light' | 'dark';
  typographyStyles?: import('../types').TypographyStyle[];
}

// Neutral gray scale (12 tones) for black/white card coloring
const NEUTRAL = [
  '#050505', '#1a1a1a', '#2e2e2e', '#434343', '#585858',
  '#8e8e8e', '#a3a3a3', '#b8b8b8', '#cccccc', '#e0e0e0',
  '#f0f0f0', '#ffffff',
];

// ── Contrast-checked tone lookup ──
// Starting points from neutral lightness calculations.
// These are verified and nudged against actual palette hex values.

// Tone lookup tables — all tonal, always uses the theme palette (never neutral)
// Index = surface Color-N (0-based), value = foreground Color-N (1-based)

// For 4.5:1 contrast (Text, Quiet, Hotlink, Visited-Hotlink, Buttons-{Theme}-Text)
// Starting points — less extreme than the absolute minimum contrast pass.
// findAccessibleTone() will nudge further if these don't meet 4.5:1.
const TEXT_LOOKUP_LIGHT_BG: number[] = [
  9, 9, 9, 9, 11, 1, 1, 2, 2, 3, 4, 4,
];

const HEADER_LOOKUP_LIGHT_BG: number[] = [
  10, 10, 10, 10, 8, 2, 3, 4, 5, 5, 5, 5,
];

const QUIET_LOOKUP_LIGHT_BG: number[] = [
  6, 6, 7, 8, 9, 2, 3, 4, 5, 5, 5, 5,
];

// Border lookup: index = surface Color-N (0-based), value = border Color-N (1-based)
const BORDER_LOOKUP_LIGHT_BG: number[] = [
  6, 6, 7, 9, 10, 2, 4, 4, 5, 5, 5, 5,
];

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = chroma(hex1).luminance();
  const l2 = chroma(hex2).luminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Find the accessible foreground color-N for a given background.
 * Starts from the lookup table suggestion, then nudges if the actual
 * palette hex values don't meet the required contrast ratio.
 */
function findAccessibleTone(
  bgHex: string,
  palette: Array<{ hex: string }>,
  startN: number,
  minContrast: number,
): number {
  const bgIsLight = isLight(bgHex);

  // Check if the starting suggestion meets contrast
  const startHex = palette[startN - 1]?.hex;
  if (startHex && contrastRatio(bgHex, startHex) >= minContrast) {
    return startN;
  }

  // Nudge: search toward higher contrast (darker for light bg, lighter for dark bg)
  if (bgIsLight) {
    // Try darker tones (lower N)
    for (let n = startN - 1; n >= 1; n--) {
      const hex = palette[n - 1]?.hex;
      if (hex && contrastRatio(bgHex, hex) >= minContrast) return n;
    }
  } else {
    // Try lighter tones (higher N)
    for (let n = startN + 1; n <= 12; n++) {
      const hex = palette[n - 1]?.hex;
      if (hex && contrastRatio(bgHex, hex) >= minContrast) return n;
    }
  }

  // Fallback: return the starting suggestion anyway
  return startN;
}

function isLight(hex: string): boolean {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

function textFor(hex: string) { return isLight(hex) ? '#1a1a1a' : '#ffffff'; }

/** Derive highlight (lighter) or lowlight (darker) from a hex color via HSL shift */
function deriveHex(hex: string, lightOffset: number, satMul: number): string {
  try {
    const c = hex.replace('#', '');
    const n = parseInt(c.substring(0, 6), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h /= 6;
    }
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const ns = clamp(s * 100 * satMul, 0, 100) / 100;
    const nl = clamp(l * 100 + lightOffset, 8, 92) / 100;
    if (ns === 0) {
      const v = Math.round(nl * 255);
      return '#' + [v, v, v].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns;
    const p = 2 * nl - q;
    const h2r = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
    return '#' + [h2r(h + 1/3), h2r(h), h2r(h - 1/3)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  } catch { return hex; }
}
/**
 * Compute highlight/lowlight that guarantee 4.5:1 text contrast is preserved.
 *
 * Given a button BG and its text color, the bevel overlay (at any opacity) must not
 * push the perceived color past the point where text contrast drops below 4.5:1.
 *
 * We find the max lightness shift where contrast(mix(bg, shifted, opacity), textColor) >= 4.5.
 * Since opacity is user-controlled (0-100%), we compute for worst case (100% opacity).
 */
function highlightFor(hex: string): string {
  // Try progressively smaller shifts until contrast is safe
  const textColor = isLight(hex) ? '#1a1a1a' : '#ffffff';
  for (let shift = 25; shift >= 2; shift -= 2) {
    const candidate = deriveHex(hex, shift, 0.7);
    if (contrastRatio(candidate, textColor) >= 4.5) return candidate;
  }
  return hex; // No shift if nothing passes
}

function lowlightFor(hex: string): string {
  const textColor = isLight(hex) ? '#1a1a1a' : '#ffffff';
  for (let shift = 25; shift >= 2; shift -= 2) {
    const candidate = deriveHex(hex, -shift, 1.3);
    if (contrastRatio(candidate, textColor) >= 4.5) return candidate;
  }
  return hex;
}

/** Mix two hex colors at 50% */
function mixHex(hex1: string, hex2: string): string {
  const parse = (h: string) => {
    const c = h.replace('#', '');
    const n = parseInt(c.substring(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const m = (a: number, b: number) => Math.round((a + b) / 2);
  return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Compute dropshadow color: same hue/chroma, L * 0.625 */
function dropshadowFor(hex: string): string {
  try {
    const [l, c, h] = chroma(hex).lch();
    return chroma.lch(l * 0.625, c, h).hex();
  } catch {
    return 'rgba(0,0,0,0.15)';
  }
}
function quietFor(hex: string) { return isLight(hex) ? '#777777' : '#aaaaaa'; }

/** Convert hex to RGB triplet string for use in rgba() */
function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  const n = parseInt(c.substring(0, 6), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
function borderFor(hex: string) { return isLight(hex) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)'; }

/**
 * Get accessible text/header/quiet/border tone numbers for a given surface,
 * verified against the actual palette colors.
 */
function getAccessibleTones(
  bgHex: string,
  surfaceN: number,
  palette: Array<{ hex: string }>,
): { text: number; header: number; quiet: number; border: number } {
  const idx = surfaceN - 1; // 0-based index into lookup tables
  const safeIdx = Math.max(0, Math.min(idx, 11));

  const textStart = TEXT_LOOKUP_LIGHT_BG[safeIdx];
  const headerStart = HEADER_LOOKUP_LIGHT_BG[safeIdx];
  const quietStart = QUIET_LOOKUP_LIGHT_BG[safeIdx];
  const borderStart = BORDER_LOOKUP_LIGHT_BG[safeIdx];

  return {
    text: findAccessibleTone(bgHex, palette, textStart, 4.5),
    header: findAccessibleTone(bgHex, palette, headerStart, 3.1),
    quiet: findAccessibleTone(bgHex, palette, quietStart, 3.1),
    border: findAccessibleTone(bgHex, palette, borderStart, 3.1),
  };
}

export function buildPreviewCSS(input: BuildInput): string {
  const { colorScheme, userSelections: sel, mode } = input;
  const isDark = mode === 'dark';

  // Light palettes — used for vibrant elements (buttons, tags, icons) in ALL modes
  const lightPalettes = colorScheme.tonePalettes || {};
  const primaryLight = lightPalettes.primary || [];
  const secondaryLight = lightPalettes.secondary || [];
  const tertiaryLight = lightPalettes.tertiary || [];

  // Dark palettes — used only for surfaces/containers in dark mode
  const darkPalettes = colorScheme.darkModeTonePalettes || colorScheme.tonePalettes || {};
  const primaryDark = darkPalettes.primary || [];
  const secondaryDark = darkPalettes.secondary || [];
  const tertiaryDark = darkPalettes.tertiary || [];

  // Surface palette — switches based on mode
  const primary = isDark ? primaryDark : primaryLight;
  const secondary = isDark ? secondaryDark : secondaryLight;
  const tertiary = isDark ? tertiaryDark : tertiaryLight;

  // Vibrant palette — always light mode (for buttons, tags, icons)
  const vPrimary = primaryLight;
  const vSecondary = secondaryLight;
  const vTertiary = tertiaryLight;

  const p = (arr: typeof primary, n: number) => arr[n - 1]?.hex || '#888';
  const neutral = (n: number) => NEUTRAL[n - 1] || '#888';

  const PC = toneToColorNumber(colorScheme.extractedTones?.primary || 60);
  const SC = toneToColorNumber(colorScheme.extractedTones?.secondary || 60);
  const TC = toneToColorNumber(colorScheme.extractedTones?.tertiary || 60);

  // ── Resolve surface background ──
  let surfaceBg: string;
  // Track whether dark mode uses primary or neutral palette for surface
  let darkUsePrimary = false;
  if (isDark) {
    switch (sel.background) {
      case 'white': surfaceBg = neutral(2); break;
      case 'black': surfaceBg = neutral(2); break;
      case 'primary-base': surfaceBg = p(primary, 2); darkUsePrimary = true; break;
      case 'primary-light': surfaceBg = p(primary, 2); darkUsePrimary = true; break;
      default: surfaceBg = neutral(3);
    }
  } else {
    switch (sel.background) {
      case 'black': surfaceBg = '#1a1a1a'; break;
      case 'primary-base': surfaceBg = p(primary, PC); break;
      case 'primary-light': surfaceBg = p(primary, 11); break;
      default: surfaceBg = '#ffffff';
    }
  }

  // ── Resolve nav colors using adjacent palette tones ──
  // Determine surface palette, Color-N, and palette name for CSS var references
  let surfacePalette: typeof primary;
  let surfaceN: number;
  let surfacePaletteName: string;
  const neutralPaletteArr = Array.from({ length: 12 }, (_, i) => ({
    hex: NEUTRAL[i], tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
  })) as typeof primary;
  if (isDark) {
    surfacePalette = darkUsePrimary ? primary : neutralPaletteArr;
    surfacePaletteName = darkUsePrimary ? 'Primary' : 'Neutral';
    surfaceN = 2;
  } else {
    switch (sel.background) {
      case 'black': surfacePalette = neutralPaletteArr; surfacePaletteName = 'Neutral'; surfaceN = 1; break;
      case 'primary-base': surfacePalette = primary; surfacePaletteName = 'Primary'; surfaceN = PC; break;
      case 'primary-light': surfacePalette = primary; surfacePaletteName = 'Primary'; surfaceN = 11; break;
      default: surfacePalette = neutralPaletteArr; surfacePaletteName = 'Neutral'; surfaceN = 12; break;
    }
  }

  // Hover map — index 0 = Color-1's hover target, etc.
  const hoverMap = [1, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 12];

  // Map nav option → { palette, n, theme, surface }
  function resolveNavOption(opt: string): { palette: string; n: number; theme: string; surface: string } {
    switch (opt) {
      case 'black': return { palette: 'Neutral', n: 1, theme: 'Black', surface: 'Surface' };
      case 'white': return { palette: 'Neutral', n: 12, theme: 'White', surface: 'Surface' };
      case 'primary-light': return { palette: 'Primary', n: 11, theme: 'Primary-Light', surface: 'Surface' };
      case 'primary-light-bright': return { palette: 'Primary', n: 12, theme: 'Primary-Light', surface: 'Surface-Bright' };
      case 'primary-light-dim': return { palette: 'Primary', n: 10, theme: 'Primary-Light', surface: 'Surface-Dim' };
      case 'primary': return { palette: 'Primary', n: PC, theme: 'Primary', surface: 'Surface' };
      case 'primary-bright': return { palette: 'Primary', n: Math.min(PC + 1, 12), theme: 'Primary', surface: 'Surface-Bright' };
      case 'primary-dim': return { palette: 'Primary', n: Math.max(PC - 1, 1), theme: 'Primary', surface: 'Surface-Dim' };
      default: return { palette: 'Neutral', n: 12, theme: 'White', surface: 'Surface' };
    }
  }

  function navColor(opt: string) {
    const { palette, n } = resolveNavOption(opt);
    if (palette === 'Neutral') return neutral(n);
    return p(primary, n);
  }

  const statusConfig = resolveNavOption(sel.status);
  const appBarConfig = resolveNavOption(sel.appBar);
  const navBarConfig = resolveNavOption(sel.navBar);
  const statusBg = navColor(sel.status);
  const appBarBg = navColor(sel.appBar);
  const navBarBg = navColor(sel.navBar);

  // ── Card coloring ──
  // Tonal light: Color-12 of theme palette
  // Tonal dark:  Color-3 of theme palette (or Neutral-3 if surface is neutral)
  // White: Neutral Color-12
  // Black: Neutral Color-2
  let containerBg: string;
  let containerLow: string;
  let tertiaryContainerBg: string;

  // Dark mode is ALWAYS tonal for both cards and text, regardless of user settings
  const effectiveCardColoring = isDark ? 'tonal' : sel.cardColoring;
  const effectiveTextColoring = isDark ? 'tonal' : sel.textColoring;

  // White/Black card coloring ONLY applies to Default theme containers
  // Tertiary (and other themed containers) always keep their palette color
  if (effectiveCardColoring === 'white') {
    containerBg = '#ffffff';
  } else if (effectiveCardColoring === 'black') {
    containerBg = neutral(3);
  } else {
    // Tonal
    if (isDark) {
      containerBg = darkUsePrimary ? p(primary, 3) : neutral(3);
    } else {
      containerBg = p(primary, 10);
    }
  }

  // Tertiary container always uses its own palette — never white/black
  if (isDark) {
    tertiaryContainerBg = darkUsePrimary ? p(tertiary, 3) : p(tertiary, 3);
  } else {
    tertiaryContainerBg = p(tertiary, 10);
  }

  // ── Text coloring (always tonal in dark mode) ──
  // surfaceN already computed above for nav color resolution
  // containerN must match the actual container background, not the mode
  const containerN = effectiveCardColoring === 'white' ? 12
    : effectiveCardColoring === 'black' ? 3
    : isDark ? 3 : 10;
  const tertiaryContainerN = isDark ? 3 : 10;

  let surfaceText: string;
  let surfaceHeader: string;
  let surfaceQuiet: string;
  let surfaceBorder: string;
  let containerText: string;
  let containerHeader: string;
  let containerQuiet: string;
  let containerBorder: string;

  // Accessible tone numbers for surface and container — used in CSS var refs
  const textPalette = primaryLight;
  const surfaceTones = getAccessibleTones(surfaceBg, surfaceN, textPalette);
  const containerTones = getAccessibleTones(containerBg, containerN, textPalette);

  // Container palette name for CSS var references
  // Tonal always uses Primary palette for the tint; White/Black use Neutral
  const containerPaletteName = effectiveCardColoring === 'white' ? 'Neutral'
    : effectiveCardColoring === 'black' ? 'Neutral'
    : 'Primary';

  if (effectiveTextColoring === 'tonal') {
    surfaceText = p(textPalette, surfaceTones.text);
    surfaceHeader = p(textPalette, surfaceTones.header);
    surfaceQuiet = p(textPalette, surfaceTones.quiet);
    surfaceBorder = p(textPalette, surfaceTones.border);

    containerText = p(textPalette, containerTones.text);
    containerHeader = p(textPalette, containerTones.header);
    containerQuiet = p(textPalette, containerTones.quiet);
    containerBorder = p(textPalette, containerTones.border);
  } else {
    // BW (light mode only) — text is black/white, but borders still need 3:1 contrast
    const neutralPalette = NEUTRAL.map(h => ({ hex: h }));
    const surfaceBorderTones = getAccessibleTones(surfaceBg, surfaceN, neutralPalette);
    const containerBorderTones = getAccessibleTones(containerBg, containerN, neutralPalette);

    surfaceText = textFor(surfaceBg);
    surfaceHeader = textFor(surfaceBg);
    surfaceQuiet = quietFor(surfaceBg);
    surfaceBorder = neutral(surfaceBorderTones.border);
    containerText = textFor(containerBg);
    containerHeader = textFor(containerBg);
    containerQuiet = quietFor(containerBg);
    containerBorder = neutral(containerBorderTones.border);
  }

  // ── Buttons ──
  // Primary: uses actual Primary extracted color
  // Secondary: uses actual Secondary extracted color
  // Tonal: uses actual Primary extracted color (same as primary — the tone IS the color)
  // Laddered: Primary, Secondary, Tertiary cascade
  // Black/White: pure contrast — switches to Laddered in dark mode
  // Buttons always use light/vibrant palette so they stay bright in dark mode
  const effectiveButton = (isDark && sel.button === 'black-white') ? 'laddered' : sel.button;
  // Button text uses contrast-verified tones against the button background
  // Buttons always use vibrant (light) palette
  // btnBg = button fill color (RESOLVED hex from palette, not var() reference)
  // btnText = accessible text on btnBg (resolved hex)
  // btnBorder = border with 3.1:1 contrast to SURFACE (resolved hex)
  let btnBg: string, btnText: string, btnBorder: string;

  // On Primary/Primary-Light backgrounds, primary/tonal buttons use border color
  // (primary color too similar to background)
  const isPrimaryBg = sel.background === 'primary-light' || sel.background === 'primary-base';
  const borderToneN = getAccessibleTones(surfaceBg, surfaceN, primaryLight).border;

  switch (effectiveButton) {
    case 'tonal': {
      // Tonal: button fill = border color (has 3.1:1 contrast to surface)
      btnBg = p(primaryLight, borderToneN);
      const tonalTones = getAccessibleTones(btnBg, borderToneN, primaryLight);
      btnText = p(primaryLight, tonalTones.text);
      btnBorder = p(primaryLight, getAccessibleTones(surfaceBg, surfaceN, primaryLight).border);
      break;
    }
    case 'secondary': {
      btnBg = p(vSecondary, SC);
      const scTones = getAccessibleTones(btnBg, SC, vSecondary);
      btnText = p(vSecondary, scTones.text);
      btnBorder = p(vSecondary, getAccessibleTones(surfaceBg, surfaceN, vSecondary).border);
      break;
    }
    case 'laddered': {
      btnBg = p(vSecondary, SC);
      const ladTones = getAccessibleTones(btnBg, SC, vSecondary);
      btnText = p(vSecondary, ladTones.text);
      btnBorder = p(vSecondary, getAccessibleTones(surfaceBg, surfaceN, vSecondary).border);
      break;
    }
    case 'black-white':
      btnBg = isLight(surfaceBg) ? '#1a1a1a' : '#ffffff';
      btnText = isLight(surfaceBg) ? '#ffffff' : '#1a1a1a';
      btnBorder = surfaceBorder;
      break;
    default: {
      // Primary: use border color on primary backgrounds, PC on other backgrounds
      if (isPrimaryBg) {
        btnBg = p(primaryLight, borderToneN);
        const bgTones = getAccessibleTones(btnBg, borderToneN, primaryLight);
        btnText = p(primaryLight, bgTones.text);
      } else {
        btnBg = p(vPrimary, PC);
        const defTones = getAccessibleTones(btnBg, PC, vPrimary);
        btnText = p(vPrimary, defTones.text);
      }
      btnBorder = p(primaryLight, getAccessibleTones(surfaceBg, surfaceN, primaryLight).border);
    }
  }

  const defaultBtnText = containerText;
  const defaultBtnBorder = borderFor(containerBg);

  // ── Tertiary tag + text — always vibrant (light palette) ──
  const tagN = Math.max(TC - 2, 1);
  const tagBg = `var(--Tertiary-Color-${tagN})`;
  const tagTones = getAccessibleTones(p(vTertiary, tagN), tagN, vTertiary);
  const tagText = `var(--Tertiary-Color-${tagTones.text})`;

  let tertiaryText: string;
  let tertiaryHeader: string;
  let tertiaryQuiet: string;
  if (effectiveTextColoring === 'tonal') {
    // Always use light palette for text accessibility checks
    const tertiaryTextPalette = tertiaryLight;
    const tertiaryTones = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryTextPalette);
    tertiaryText = `var(--Tertiary-Color-${tertiaryTones.text})`;
    tertiaryHeader = `var(--Tertiary-Color-${tertiaryTones.header})`;
    tertiaryQuiet = `var(--Tertiary-Color-${tertiaryTones.quiet})`;
  } else {
    tertiaryText = textFor(tertiaryContainerBg);
    tertiaryHeader = textFor(tertiaryContainerBg);
    tertiaryQuiet = quietFor(tertiaryContainerBg);
  }

  // ── Build CSS ──
  return `
/* ══ Palette Colors — always light (vibrant) palette ══ */
/* Surfaces/containers use direct hex values from dark palette when in dark mode */
/* Text, buttons, tags, icons reference these vibrant variables */
:root {
${primaryLight.map((t, i) => `  --Primary-Color-${i + 1}: ${t.hex};`).join('\n')}
${secondaryLight.map((t, i) => `  --Secondary-Color-${i + 1}: ${t.hex};`).join('\n')}
${tertiaryLight.map((t, i) => `  --Tertiary-Color-${i + 1}: ${t.hex};`).join('\n')}
${NEUTRAL.map((h, i) => `  --Neutral-Color-${i + 1}: ${h};`).join('\n')}
}

/* ══ Status Bar ══ */
${(() => {
  const sc = statusConfig;
  const tones = getAccessibleTones(statusBg, sc.n, primaryLight);
  return `[data-theme="Brand-Status"] {
  --Background: ${statusBg};
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(statusBg))};
  --Text: var(--${sc.palette}-Color-${tones.text});
}`;
})()}

/* ══ App Bar ══ */
${(() => {
  const ac = appBarConfig;
  const tones = getAccessibleTones(appBarBg, ac.n, primaryLight);
  // App bar hover/active for buttons — swapped: Active=oldHover, Hover=mix(button,oldHover)
  const abOldHoverMap = [1,1,2,3,4,7,8,9,10,11,12,12];
  let abPal = 'Primary', abN = PC;
  switch (effectiveButton) {
    case 'secondary': case 'laddered': abPal = 'Secondary'; abN = SC; break;
    case 'black-white': abPal = 'Neutral'; abN = isLight(appBarBg) ? 1 : 12; break;
    default: abPal = 'Primary'; abN = PC; break;
  }
  const abOldHover = abOldHoverMap[abN - 1] || Math.min(abN + 1, 12);
  const abPalArr = abPal === 'Secondary' ? secondaryLight : abPal === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight;
  const abOldHoverHex = p(abPalArr, abOldHover);
  const abHoverHex = mixHex(btnBg, abOldHoverHex);

  return `[data-theme="Brand-App-Bar"],
  [data-theme="Brand-App-Bar"][data-surface="Surface"] {
  --Background: ${appBarBg};
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(appBarBg))};
  --Text: var(--${ac.palette}-Color-${tones.text});
  --Header: var(--${ac.palette}-Color-${tones.header});
  --Quiet: var(--${ac.palette}-Color-${tones.quiet});
  --Border: var(--${ac.palette}-Color-${tones.border});
  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: ${btnBorder};
  --Buttons-Primary-Hover: ${abHoverHex};
  --Buttons-Primary-Active: ${abOldHoverHex};
  --Buttons-Default-Button: transparent;
  --Buttons-Default-Text: var(--${ac.palette}-Color-${tones.text});
  --Buttons-Default-Border: var(--${ac.palette}-Color-${tones.border});
  --Buttons-Default-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Default-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
  --Buttons-Default-Hover: ${abHoverHex};
  --Buttons-Default-Active: ${abOldHoverHex};
  --Buttons-Primary-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Primary-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
}`;
})()}

/* ══ Brand Theme — Color-N scales + semantic variables ══ */
[data-theme="Brand"],
[data-theme="Brand"][data-surface="Surface"] {
  /* Color scales */
${primaryLight.map((c, i) => `  --Primary-Color-${i + 1}: ${c.hex};`).join('\n')}
${secondaryLight.map((c, i) => `  --Secondary-Color-${i + 1}: ${c.hex};`).join('\n')}
${tertiaryLight.map((c, i) => `  --Tertiary-Color-${i + 1}: ${c.hex};`).join('\n')}
${NEUTRAL.map((hex, i) => `  --Neutral-Color-${i + 1}: ${hex};`).join('\n')}

  --Background: var(--${surfacePaletteName}-Color-${surfaceN});
  --Container: var(--${containerPaletteName}-Color-${containerN});
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(surfaceBg))};
  --Text: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.text})` : surfaceText};
  --Header: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.header})` : surfaceHeader};
  --Quiet: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.quiet})` : surfaceQuiet};
  --Border: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.border})` : surfaceBorder};
  --Border-Variant: ${effectiveTextColoring === 'tonal' ? `${p(surfacePalette, surfaceTones.border)}26` : `${surfaceBorder}26`};
  --Hover: var(--${surfacePaletteName}-Color-${hoverMap[surfaceN - 1] || surfaceN});
  --Active: var(--${surfacePaletteName}-Color-${hoverMap[surfaceN - 1] || surfaceN});
  --Focus-Visible: #3b82f6;
  --Effect-Level-0: none;
  --Effect-Level-1: 0 1px 2px rgba(var(--Dropshadow-Color), 0.28);
  --Effect-Level-2: 0 2px 4px rgba(var(--Dropshadow-Color), 0.22), 0 1px 2px rgba(var(--Dropshadow-Color), 0.28);
  --Effect-Level-3: 0 4px 8px rgba(var(--Dropshadow-Color), 0.17), 0 2px 4px rgba(var(--Dropshadow-Color), 0.22);
  --Effect-Level-4: 0 8px 16px rgba(var(--Dropshadow-Color), 0.13), 0 4px 8px rgba(var(--Dropshadow-Color), 0.17);
  --Effect-Level-5: 0 16px 32px rgba(var(--Dropshadow-Color), 0.1), 0 8px 16px rgba(var(--Dropshadow-Color), 0.13);

${(() => {
    // Generate all button palette tokens
    const allPalettes = [
      { name: 'Primary', palette: vPrimary, n: PC, paletteName: 'Primary' },
      { name: 'Secondary', palette: vSecondary, n: SC, paletteName: 'Secondary' },
      { name: 'Tertiary', palette: vTertiary, n: TC, paletteName: 'Tertiary' },
    ];
    return allPalettes.map(({ name, palette: pal, n }) => {
      const bg = p(pal, n);
      const tones = getAccessibleTones(bg, n, pal);
      const palBorder = p(pal, getAccessibleTones(surfaceBg, surfaceN, pal).border);
      const oldHoverN = hoverMap[n - 1] || Math.min(n + 1, 12);
      const oldHoverHex = p(pal, oldHoverN);
      return `  --Buttons-${name}-Button: ${p(pal, n)};
  --Buttons-${name}-Text: ${p(pal, tones.text)};
  --Buttons-${name}-Border: ${palBorder};
  --Buttons-${name}-Hover: ${mixHex(p(pal, n), oldHoverHex)};
  --Buttons-${name}-Active: ${oldHoverHex};
  --Buttons-${name}-Highlight: ${hexToRgb(highlightFor(bg))};
  --Buttons-${name}-Lowlight: ${hexToRgb(lowlightFor(bg))};`;
    }).join('\n');
  })()}
${(() => {
    // Default button uses the selected button mode's palette and tones
    const hoverMap = [1,1,2,3,4,7,8,9,10,11,12,12];

    // Determine which palette/N the default button resolves to
    let defPal: typeof vPrimary = vPrimary;
    let defN = PC;
    switch (effectiveButton) {
      case 'secondary': case 'laddered': defPal = vSecondary; defN = SC; break;
      case 'tonal': defPal = vPrimary; defN = PC; break;
      case 'black-white': defPal = NEUTRAL.map(h => ({ hex: h })) as any; defN = isLight(surfaceBg) ? 1 : 12; break;
      default: defPal = vPrimary; defN = PC; break;
    }
    const defOldHover = hoverMap[defN - 1] || Math.min(defN + 1, 12);
    const defOldHoverHex = p(defPal, defOldHover);
    return `  --Buttons-Default-Button: ${btnBg};
  --Buttons-Default-Text: ${btnText};
  --Buttons-Default-Border: ${btnBorder};
  --Buttons-Default-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Default-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
  --Buttons-Default-Hover: ${mixHex(btnBg, defOldHoverHex)};
  --Buttons-Default-Active: ${defOldHoverHex};`;
  })()}

  --Container: ${containerBg};
  --Container-Low: ${containerBg};
  --Container-Lowest: ${containerBg};
  --Container-High: ${containerBg};
  --Container-Highest: ${containerBg};
  --Container-Dropshadow-Color: ${hexToRgb(dropshadowFor(containerBg))};
  --Container-Text: ${containerText};
  --Container-Header: ${containerHeader};
  --Container-Quiet: ${containerQuiet};
  --Container-Border: ${containerBorder};
${(() => {
    const hm = [1,1,2,3,4,7,8,9,10,11,12,12];

    let cp = 'Primary', cn = PC;
    switch (effectiveButton) {
      case 'secondary': case 'laddered': cp = 'Secondary'; cn = SC; break;
      case 'black-white': cp = 'Neutral'; cn = isLight(containerBg) ? 1 : 12; break;
      default: cp = 'Primary'; cn = PC; break;
    }
    // Container button border uses the button mode's palette
    let contBtnBorder = containerBorder;
    if (cp !== 'Neutral') {
      const contPal = cp === 'Secondary' ? vSecondary : cp === 'Tertiary' ? vTertiary : vPrimary;
      contBtnBorder = p(contPal, getAccessibleTones(containerBg, containerN, contPal).border);
    }
    const cpArr = cp === 'Secondary' ? secondaryLight : cp === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight;
    const contOldHoverHex = p(cpArr, hm[cn - 1] || cn);
    return `  --Container-Buttons-Default-Button: ${btnBg};
  --Container-Buttons-Default-Text: ${btnText};
  --Container-Buttons-Default-Border: ${contBtnBorder};
  --Container-Buttons-Default-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Container-Buttons-Default-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
  --Container-Buttons-Default-Hover: ${mixHex(btnBg, contOldHoverHex)};
  --Container-Buttons-Default-Active: ${contOldHoverHex};`;
  })()}
}

/* ══ Container Surface ══ */
[data-theme="Brand"][data-surface="Container"],
[data-theme="Brand"] [data-surface="Container"],
[data-surface] [data-surface="Container"] {
  --Background: var(--${containerPaletteName}-Color-${containerN});
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(containerBg))};
  --Text: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.text})` : containerText};
  --Header: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.header})` : containerHeader};
  --Quiet: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.quiet})` : containerQuiet};
  --Border: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.border})` : containerBorder};
  --Border-Variant: ${effectiveTextColoring === 'tonal' ? `${p(surfacePalette, containerTones.border)}26` : `${containerBorder}26`};
  --Hover: var(--${containerPaletteName}-Color-${hoverMap[containerN - 1] || containerN});
  --Active: var(--${containerPaletteName}-Color-${hoverMap[containerN - 1] || containerN});
  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: var(--${containerPaletteName}-Color-${containerTones.border});
  --Buttons-Default-Button: ${btnBg};
  --Buttons-Default-Text: ${btnText};
  --Buttons-Default-Border: var(--${containerPaletteName}-Color-${containerTones.border});
  --Buttons-Default-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Default-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
  --Buttons-Default-Hover: ${mixHex(btnBg, p(primaryLight, hoverMap[containerN - 1] || containerN))};
  --Buttons-Default-Active: ${p(primaryLight, hoverMap[containerN - 1] || containerN)};
  --Buttons-Primary-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Primary-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
}

/* ══ Tertiary Theme ══ */
[data-theme="Tertiary"] {
  --Container: ${tertiaryContainerBg};
  --Container-Text: ${tertiaryText};
  --Container-Header: ${tertiaryHeader};
  --Container-Quiet: ${tertiaryQuiet};
  --Container-Border: var(--Tertiary-Color-${(() => { const t = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryLight); return t.border; })()});
  --Container-Buttons-Default-Text: ${tertiaryText};
  --Container-Buttons-Default-Border: var(--Tertiary-Color-${(() => { const t = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryLight); return t.border; })()});
  --Tag-Tertiary-BG: ${tagBg};
  --Tag-Tertiary-Text: ${tagText};
}

/* ══ Nav Bar ══ */
${(() => {
  const nc = navBarConfig;
  const tones = getAccessibleTones(navBarBg, nc.n, primaryLight);
  const hoverMap = [1,1,2,3,4,7,8,9,10,11,12,12];
  // Use the button mode's palette for hover/active
  let navDefPal: typeof vPrimary = vPrimary;
  let navDefN = PC;
  switch (effectiveButton) {
    case 'secondary': case 'laddered': navDefPal = vSecondary; navDefN = SC; break;
    case 'black-white': navDefPal = NEUTRAL.map(h => ({ hex: h })) as any; navDefN = isLight(navBarBg) ? 1 : 12; break;
    default: navDefPal = vPrimary; navDefN = PC; break;
  }
  const navDefOldHover = hoverMap[navDefN - 1] || Math.min(navDefN + 1, 12);
  const navDefOldHoverHex = p(navDefPal, navDefOldHover);
  const navDefHoverHex = mixHex(btnBg, navDefOldHoverHex);
  const navBorderN = tones.border;

  return `[data-theme="Brand-Nav-Bar"],
  [data-theme="Brand-Nav-Bar"][data-surface="Surface"] {
  --Background: ${navBarBg};
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(navBarBg))};
  --Text: ${p(primaryLight, tones.text)};
  --Header: ${p(primaryLight, tones.header)};
  --Quiet: ${p(primaryLight, tones.quiet)};
  --Border: ${p(primaryLight, navBorderN)};
  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: ${p(primaryLight, navBorderN)};
  --Buttons-Primary-Hover: ${navDefHoverHex};
  --Buttons-Primary-Active: ${navDefOldHoverHex};
  --Buttons-Default-Button: ${btnBg};
  --Buttons-Default-Text: ${btnText};
  --Buttons-Default-Border: ${p(primaryLight, navBorderN)};
  --Buttons-Default-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Default-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
  --Buttons-Default-Hover: ${navDefHoverHex};
  --Buttons-Default-Active: ${navDefOldHoverHex};
  --Buttons-Primary-Highlight: ${hexToRgb(highlightFor(btnBg))};
  --Buttons-Primary-Lowlight: ${hexToRgb(lowlightFor(btnBg))};
}`;
})()}

/* ══ Surface Resolution — Background already set by theme selectors ══ */

/* ══ Clickable Elements — border inherits 3.1:1 contrast from context ══ */
.clickable { border-color: var(--Border); }

/* ══ Typography ══ */
${(() => {
  const header = input.typographyStyles?.find(t => t.type === 'header');
  const decorative = input.typographyStyles?.find(t => t.type === 'decorative');
  const body = input.typographyStyles?.find(t => t.type === 'body');
  if (!header && !body) return '';
  const headerFamily = `'${header?.family || 'sans-serif'}', serif`;
  const decorativeFamily = `'${decorative?.family || header?.family || 'sans-serif'}', sans-serif`;
  const bodyFamily = `'${body?.family || 'sans-serif'}', sans-serif`;
  return `[data-theme="Brand"], [data-theme="Brand"] * {
  --Set-Font-Family-Header: ${headerFamily};
  --Set-Font-Family-Header-Weight: ${header?.weight || '700'};
  --Set-Font-Family-Decorative: ${decorativeFamily};
  --Set-Font-Family-Body: ${bodyFamily};
  --Set-Font-Family-Body-Weight: ${body?.weight || '400'};
  --Font-Family-Header: ${headerFamily};
  --Body-Font-Family: ${bodyFamily};
  --Font-Family-Body: ${bodyFamily};
}`;
})()}

/* ══ Component Style ══ */
${(() => {
  const RADII: Record<string, number> = { professional: 4, modern: 12, bold: 2, playful: 24 };
  const r = RADII[input.componentStyle] || 12;
  return `:root {
  --Style-Border-Radius: ${r}px;
  --Card-Radius: ${Math.round(r * 1.33)}px;
}`;
})()}
`;
}
