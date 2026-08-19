import chroma from 'chroma-js';
import type { ColorScheme, UserSelections, ComponentStyle } from '../types';
import { toneToColorNumber } from './colorScale';
import { computeRadii, migrateLegacyRadii } from './componentRadii';
import { dropshadowHex8, dropshadowBaseHex, SHADOW_LEVELS, effectLevelRecipe } from './dropshadow';
// Contrast lookup tables for per-palette Text and Header tokens — the
// lib's defaults for these resolve to {palette}-Color-9 regardless of the
// surface tone, which fails WCAG on light surfaces. These helpers return
// design-token references (e.g. "{Colors.Primary.Color-8}") that we then
// convert to CSS var() form below.
import { getFixedTextToken, getFixedHeaderToken } from './cssgen/exportColorSystem';
import { typographyDeclarations, generateTypographyRules } from './cssgen/generateTypographyTokensCSS';
import { resolveRoles } from './typeScale';

/** Convert a `{Colors.Palette.Color-N}` token reference (returned by
 *  getFixedTextToken / getFixedHeaderToken) into a CSS `var(--Palette-Color-N)`
 *  reference. Hex strings (when the table returns a raw `#fff` etc.) pass
 *  through unchanged. */
function tokenRefToVar(ref: string): string {
  if (ref.startsWith('#')) return ref;
  const m = ref.match(/^\{Colors\.([^.]+)\.Color-([^}]+)\}$/);
  if (!m) return ref;
  return `var(--${m[1]}-Color-${m[2]})`;
}

/** Build the eight per-palette Text-* token lines for a surface or
 *  container with the given background tone. */
function buildTextPaletteLines(backgroundN: number, isContainer: boolean): string {
  const palettes: Array<['Primary' | 'Secondary' | 'Tertiary' | 'Neutral' | 'Info' | 'Success' | 'Warning' | 'Error', string]> = [
    ['Primary',   'Text-Primary'],
    ['Secondary', 'Text-Secondary'],
    ['Tertiary',  'Text-Tertiary'],
    ['Neutral',   'Text-Neutral'],
    ['Info',      'Text-Info'],
    ['Success',   'Text-Success'],
    ['Warning',   'Text-Warning'],
    ['Error',     'Text-Error'],
  ];
  return palettes
    .map(([palette, varName]) => `  --${varName}: ${tokenRefToVar(getFixedTextToken(backgroundN, isContainer, palette))};`)
    .join('\n');
}

function buildHeaderPaletteLines(backgroundN: number, isContainer: boolean): string {
  const palettes: Array<['Primary' | 'Secondary' | 'Tertiary' | 'Neutral' | 'Info' | 'Success' | 'Warning' | 'Error', string]> = [
    ['Primary',   'Header-Primary'],
    ['Secondary', 'Header-Secondary'],
    ['Tertiary',  'Header-Tertiary'],
    ['Neutral',   'Header-Neutral'],
    ['Info',      'Header-Info'],
    ['Success',   'Header-Success'],
    ['Warning',   'Header-Warning'],
    ['Error',     'Header-Error'],
  ];
  return palettes
    .map(([palette, varName]) => `  --${varName}: ${tokenRefToVar(getFixedHeaderToken(backgroundN, isContainer, palette))};`)
    .join('\n');
}

/**
 * Builds the complete CSS for the phone preview iframe.
 * Follows the real DynoDesign token cascade.
 * Called every time the user changes a selection or toggles light/dark.
 */

interface BuildInput {
  colorScheme: ColorScheme;
  userSelections: UserSelections;
  componentStyle: ComponentStyle;
  // User's per-component customizations (sliders). When present, the preview
  // emits the same pixel tokens that the foundation CSS and Figma JSON do
  // (via computeRadii). When absent, falls back to preset defaults.
  styleCustomizations?: Partial<{
    cardPadding: number;
    buttonRadius: number;
    iconButtonRadius: number;
    inputRadius: number;
    buttonHeight: number;
    smallButtonHeight: number;
    largeButtonHeight: number;
    radius?: number; // legacy pixel-shaped card radius
  }>;
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

/** BW text on a background. `white` is 70% white in dark mode — the export
 *  emits #ffffffb3 for Text.*.BW there, and pure white reads as glare. */
function textFor(hex: string, white = '#ffffff') { return isLight(hex) ? '#1a1a1a' : white; }

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

/** Aggregate `--Dropshadow-Color` tint. Uses the shared Comeau math
 *  (`dropshadowBaseHex`, level 2 = standard card elevation) so the live
 *  preview matches the CSS export and the per-level Dropshadow-Color-N tokens
 *  exactly — one model for every shadow color. */
function dropshadowFor(hex: string): string {
  try {
    return dropshadowBaseHex(hex, 2);
  } catch {
    return '#202020';
  }
}
function quietFor(hex: string) { return isLight(hex) ? '#777777' : '#aaaaaa'; }

/** Convert hex to RGB triplet string for use in rgba() */
function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  const n = parseInt(c.substring(0, 6), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Emit `  --Dropshadow-Color-N: #RRGGBBAA;` lines for a given surface
 *  background. Used at every scope that emits a `--Dropshadow-Color` so
 *  Effect-Level recipes inside that scope pick up the per-level colors
 *  derived from the surface's own hue. */
function emitDropshadowLevelLines(bgHex: string): string {
  return SHADOW_LEVELS
    .map(level => `  --Dropshadow-Color-${level}: ${dropshadowHex8(bgHex, level)};`)
    .join('\n');
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
    header: findAccessibleTone(bgHex, palette, headerStart, 3),
    // Quiet is muted but still body-size text → must clear AA (4.5:1), not 3:1.
    quiet: findAccessibleTone(bgHex, palette, quietStart, 4.5),
    border: findAccessibleTone(bgHex, palette, borderStart, 3),
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

  // Vibrant palette — the palette buttons, tags and icons are drawn from.
  //
  // This used to be pinned to the LIGHT palettes in both modes, so a dark-mode
  // button rendered the same hex as a light-mode one (29 of 35 button tokens
  // were byte-identical across modes) while text, borders and surfaces all
  // switched — the preview looked half-converted, and it disagreed with the
  // export, which draws dark-mode buttons from the dark palettes.
  const vPrimary = isDark ? primaryDark : primaryLight;
  const vSecondary = isDark ? secondaryDark : secondaryLight;
  const vTertiary = isDark ? tertiaryDark : tertiaryLight;

  const p = (arr: typeof primary, n: number) => arr[n - 1]?.hex || '#888';
  const neutral = (n: number) => NEUTRAL[n - 1] || '#888';

  const PC = toneToColorNumber(colorScheme.extractedTones?.primary || 60);
  const SC = toneToColorNumber(colorScheme.extractedTones?.secondary || 60);
  const TC = toneToColorNumber(colorScheme.extractedTones?.tertiary || 60);
  // Button tones. In dark mode every button sits at Color-12 of its palette —
  // the same rule generateButtonsSimplified applies (DARK_BUTTON_N).
  // Surfaces keep the extracted tones, so these are separate from PC/SC/TC.
  // White as TEXT is 70% in dark mode; white as a SURFACE stays opaque. The
  // export makes the same distinction (#ffffffb3 for Text.*.BW in Dark-Mode).
  const WHITE_TEXT = isDark ? '#ffffffb3' : '#ffffff';
  // Dark-mode buttons are pinned to the LIGHT ramp's Color-8 — see the
  // matching block in generateButtonsSimplified.ts. That means both halves
  // change in dark mode: the tone becomes 8, AND the palette the tone is read
  // from becomes the light one. Getting only the tone right would produce a
  // dark-ramp Color-8, which is a different colour entirely.
  const DARK_BUTTON_N = 8;
  const btnPC = isDark ? DARK_BUTTON_N : PC;
  const btnSC = isDark ? DARK_BUTTON_N : SC;
  const btnTC = isDark ? DARK_BUTTON_N : TC;
  // Button palettes: always the light ramps, in both modes. Surfaces keep
  // using v* (dark ramps in dark mode) — only buttons cross over.
  const bPrimary = primaryLight;
  const bSecondary = secondaryLight;
  const bTertiary = tertiaryLight;

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

  // Hover/Pressed calculation (per spec):
  //   tone 1     → Pressed = #000000,           Hover = mix(palette[0], #000)
  //   tones 2-5  → Pressed = palette[N-2],      Hover = mix(palette[N-1], palette[N-2])
  //   tones 6-11 → Pressed = palette[N],        Hover = mix(palette[N-1], palette[N])
  //   tone 12    → Pressed = #ffffff,           Hover = mix(palette[11], #fff)
  // Endpoints clamp to pure black/white because there's no tone-1 of tone-1
  // and no tone+1 of tone-12 — the palette tops out at 12.
  function activeAndHoverFor(palette: Array<{ hex: string }>, n: number): { active: string; hover: string } {
    const baseHex = palette[n - 1]?.hex || '#888888';
    // Pressed/hover move ALONG the palette, away from the text sitting on the
    // button, so contrast is preserved or grows. Hover = mix(base, pressed).
    //
    // Direction keys on the TONE INDEX, matching buildHoverForPalette() in
    // staticTokenStructures.ts — the implementation that bakes the real
    // Hover/Pressed tokens. It previously keyed on the fill's LUMINANCE, which
    // looks equivalent and is not: a saturated mid-tone like Success Color-6
    // (#2f9e5a) measures "light" by brightness while carrying light text, so
    // the preview stepped it toward its own label while the export stepped it
    // away. Tones 1-5 carry light text and 6-12 carry dark text, so the tone
    // split is what keeps the state moving away from the label.
    //
    // BOTH ENDS INVERT, because neither has headroom:
    //   tone 1  → lighter. Stepping darker meant #000000, and from a fill
    //             already at #040404 that is 1.02:1 against itself — invisible.
    //   tone 12 → darker. Near-white already; a step toward #ffffff goes
    //             nowhere.
    // Direction is decided by the LABEL: light text steps darker, dark text
    // steps lighter, so the state always moves AWAY from the text on it. This
    // used to key on the tone index, which assumed every palette's text table
    // flips at tone 6. Most do; an olive primary whose Color-6 still carries a
    // light label does not, and there the index rule stepped INTO the label.
    const labelIdx = getAccessibleTones(baseHex, n, palette).text;
    const labelHex = palette[Math.max(0, Math.min(labelIdx - 1, 11))]?.hex || baseHex;
    let labelIsLight: boolean;
    try {
      labelIsLight = chroma(labelHex).luminance() > chroma(baseHex).luminance();
    } catch {
      labelIsLight = n <= 5; // fall back to the tone split
    }
    // Both ends invert — neither has headroom.
    const activeN = Math.min(Math.max(labelIsLight ? n - 1 : n + 1, 1), 12);
    const stepHex = palette[activeN - 1]?.hex || baseHex;
    // Color-1 moves a HALF step. Its gap to Color-2 is a tenfold luminance
    // change, so a full step reads as the button changing colour rather than
    // responding. Matches the export.
    const active = n === 1 ? mixHex(baseHex, stepHex) : stepHex;
    return { active, hover: mixHex(baseHex, active) };
  }

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
    if (palette === 'Neutral') {
      // In dark mode a neutral nav goes DARK, the same way the page background
      // does ('white' → neutral(2) above). Without this the light-mode ramp is
      // read in dark mode and a White nav renders pure #ffffff on a dark page.
      //
      // The nav sits one step lighter than the surface so the two stay
      // distinguishable — the page is neutral(2), so a white nav is neutral(2).
      if (isDark) return neutral(opt === 'black' ? 1 : 2);
      return neutral(n);
    }
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

  // Card coloring in dark mode: 'black' stays 'black' (dark cards on dark
  // background reads as intentional), 'tonal' stays 'tonal', but 'white'
  // cards on a dark page are jarring — fall back to 'tonal' for that combo.
  // Text coloring follows the user's pick in both modes.
  const effectiveCardColoring = (isDark && sel.cardColoring === 'white')
    ? 'tonal'
    : sel.cardColoring;
  const effectiveTextColoring = sel.textColoring;

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

    // When textFor would return white on a dark surface, output
    // var(--White) instead of the literal #ffffff. --White is set to
    // #ffffff in light mode and rgba(255,255,255,0.7) in dark mode, so
    // headings and body text on dark surfaces automatically dim for
    // visual comfort instead of glaring at full white. Black text on
    // light surfaces stays #1a1a1a — no adaptive equivalent needed.
    surfaceText = isLight(surfaceBg) ? '#1a1a1a' : 'var(--White)';
    surfaceHeader = isLight(surfaceBg) ? '#1a1a1a' : 'var(--White)';
    surfaceQuiet = quietFor(surfaceBg);
    surfaceBorder = neutral(surfaceBorderTones.border);
    containerText = isLight(containerBg) ? '#1a1a1a' : 'var(--White)';
    containerHeader = isLight(containerBg) ? '#1a1a1a' : 'var(--White)';
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
  // btnBorder = border with 3:1 contrast to SURFACE (resolved hex)
  let btnBg: string, btnText: string, btnBorder: string;

  // On Primary/Primary-Light backgrounds, primary/tonal buttons use border color
  // (primary color too similar to background)
  const isPrimaryBg = sel.background === 'primary-light' || sel.background === 'primary-base';
  const borderToneN = getAccessibleTones(surfaceBg, surfaceN, primaryLight).border;

  switch (effectiveButton) {
    case 'tonal': {
      // Tonal: button fill = border color (has 3:1 contrast to surface)
      btnBg = p(primaryLight, borderToneN);
      const tonalTones = getAccessibleTones(btnBg, borderToneN, primaryLight);
      btnText = p(primaryLight, tonalTones.text);
      btnBorder = p(primaryLight, getAccessibleTones(surfaceBg, surfaceN, primaryLight).border);
      break;
    }
    case 'secondary': {
      btnBg = p(bSecondary, btnSC);
      const scTones = getAccessibleTones(btnBg, btnSC, bSecondary);
      btnText = p(vSecondary, scTones.text);
      btnBorder = p(vSecondary, getAccessibleTones(surfaceBg, surfaceN, vSecondary).border);
      break;
    }
    case 'laddered': {
      btnBg = p(bSecondary, btnSC);
      const ladTones = getAccessibleTones(btnBg, btnSC, bSecondary);
      btnText = p(vSecondary, ladTones.text);
      btnBorder = p(vSecondary, getAccessibleTones(surfaceBg, surfaceN, vSecondary).border);
      break;
    }
    case 'black-white':
      btnBg = isLight(surfaceBg) ? '#1a1a1a' : '#ffffff';
      btnText = isLight(surfaceBg) ? WHITE_TEXT : '#1a1a1a';
      btnBorder = btnBg;
      break;
    default: {
      // Primary: use border color on primary backgrounds, PC on other backgrounds
      if (isPrimaryBg) {
        btnBg = p(primaryLight, borderToneN);
        const bgTones = getAccessibleTones(btnBg, borderToneN, primaryLight);
        btnText = p(primaryLight, bgTones.text);
      } else {
        btnBg = p(bPrimary, btnPC);
        const defTones = getAccessibleTones(btnBg, btnPC, bPrimary);
        btnText = p(vPrimary, defTones.text);
      }
      btnBorder = p(primaryLight, getAccessibleTones(surfaceBg, surfaceN, primaryLight).border);
    }
  }

  const defaultBtnText = containerText;
  const defaultBtnBorder = borderFor(containerBg);

  // ── Default-button palette per surface theme + button mode ──
  // The lib's CSS hardcodes --Buttons-Default-Hover etc. under every
  // [data-theme="Primary"|"Secondary"|"Tertiary"][data-surface="Surface"]
  // selector (specificity 0,2,0). So a Card with color="tertiary" sets its
  // inner content to [data-theme="Tertiary"], and the lib's hardcoded pink
  // hover wins over the brand's main block (different selector, closer
  // ancestor). We re-emit the Default-button tokens inside each per-palette
  // surface block below using the same mode logic the main block uses, but
  // anchored to that surface's palette per the user's cascade rules:
  //   primary mode   → all surfaces use Primary
  //   secondary mode → all surfaces use Secondary
  //   tonal mode     → button palette matches the surface palette
  //   laddered mode  → Primary surface→Secondary, Secondary→Tertiary, Tertiary→Primary
  //   black-white    → B/W based on surface lightness
  type SurfaceTheme = 'Primary' | 'Secondary' | 'Tertiary';
  const palFor = (name: SurfaceTheme): typeof vPrimary =>
    name === 'Secondary' ? vSecondary : name === 'Tertiary' ? vTertiary : vPrimary;
  const nFor = (name: SurfaceTheme): number =>
    name === 'Secondary' ? SC : name === 'Tertiary' ? TC : PC;
  // Button equivalents of palFor/nFor. Tonal and laddered buttons take their
  // colour from a surface's palette, but they are still buttons — in dark mode
  // that has to resolve to the light ramp at Color-8, not the dark surface tone.
  const btnPalFor = (name: SurfaceTheme): typeof bPrimary =>
    name === 'Secondary' ? bSecondary : name === 'Tertiary' ? bTertiary : bPrimary;
  const btnNFor = (name: SurfaceTheme): number =>
    isDark ? DARK_BUTTON_N : nFor(name);
  const getDefaultBtnPalForSurface = (surfaceTheme: SurfaceTheme): { pal: typeof vPrimary; n: number } => {
    switch (effectiveButton) {
      case 'primary': return { pal: bPrimary, n: btnPC };
      case 'secondary': return { pal: bSecondary, n: btnSC };
      case 'tonal': return { pal: btnPalFor(surfaceTheme), n: btnNFor(surfaceTheme) };
      case 'laddered': {
        const next: SurfaceTheme = surfaceTheme === 'Primary' ? 'Secondary'
          : surfaceTheme === 'Secondary' ? 'Tertiary' : 'Primary';
        return { pal: btnPalFor(next), n: btnNFor(next) };
      }
      case 'black-white': {
        const bg = p(palFor(surfaceTheme), nFor(surfaceTheme));
        return { pal: NEUTRAL.map(h => ({ hex: h })) as any, n: isLight(bg) ? 1 : 12 };
      }
      default: return { pal: bPrimary, n: btnPC };
    }
  };
  // Emit the per-palette button tokens (Buttons-Primary-*, Buttons-Secondary-*,
  // Buttons-Tertiary-*). The lib's Light-Mode.css hardcodes these under every
  // theme/surface combo (including pink #f5dddd for every -Hover token), so
  // a secondary-variant button INSIDE a tertiary-themed Card otherwise falls
  // through to the lib's pink. Re-emitting these inside each per-palette
  // theme block at matching specificity makes the studio brand values win.
  const emitPerPaletteButtonTokens = (surfaceBgForBorder: string, surfaceNForBorder: number): string => {
    const palettes = [
      { name: 'Primary', pal: bPrimary, n: btnPC },
      { name: 'Secondary', pal: bSecondary, n: btnSC },
      { name: 'Tertiary', pal: bTertiary, n: btnTC },
    ];
    return palettes.map(({ name, pal, n }) => {
      const bg = p(pal, n);
      const tones = getAccessibleTones(bg, n, pal);
      const palBorder = p(pal, getAccessibleTones(surfaceBgForBorder, surfaceNForBorder, pal).border);
      const { active, hover } = activeAndHoverFor(pal, n);
      return `  --Buttons-${name}-Button: ${bg};
  --Buttons-${name}-Text: ${p(pal, tones.text)};
  --Buttons-${name}-Border: ${palBorder};
  --Buttons-${name}-Hover: ${hover};
  --Buttons-${name}-Pressed: ${active};
  --Buttons-${name}-Highlight: ${highlightFor(bg)};
  --Buttons-${name}-Lowlight: ${lowlightFor(bg)};`;
    }).join('\n');
  };

  // Tag-{Color}-Text contrast-aware emission. The lib hardcodes this token
  // under every theme/surface combo using a tone-table lookup (Color-4 or
  // BW-Color-1) that assumes a standard palette. For low-chroma or pastel
  // palettes those tones fail 4.5:1 against the Color-8 tag bg. We rank
  // four candidates (white, near-black, palette's darkest tone, palette's
  // lightest tone) by actual computed contrast and emit the best.
  // Reusable so we can inject the same override at every per-palette theme
  // block where the lib's hardcoded value would otherwise shadow the main
  // Brand block's value.
  const emitTagTextTokens = (): string => {
    const TAG_BG_N = 8;
    const palettes = [
      { name: 'Primary',   pal: vPrimary   },
      { name: 'Secondary', pal: vSecondary },
      { name: 'Tertiary',  pal: vTertiary  },
    ];
    return palettes.map(({ name, pal }) => {
      const bg = p(pal, TAG_BG_N);
      const candidates: Array<{ css: string; hex: string }> = [
        { css: '#ffffff', hex: '#ffffff' },
        { css: '#1a1a1a', hex: '#1a1a1a' },
        { css: `var(--${name}-Color-12)`, hex: pal[11]?.hex ?? '#000' },
        { css: `var(--${name}-Color-1)`,  hex: pal[0]?.hex  ?? '#fff' },
      ];
      const ranked = candidates
        .map(c => ({ ...c, ratio: contrastRatio(bg, c.hex) }))
        .sort((a, b) => b.ratio - a.ratio);
      const pick = ranked.find(c => c.ratio >= 4.5) ?? ranked[0];
      return `  --Tag-${name}-Text: ${pick.css};`;
    }).join('\n');
  };

  const emitDefaultBtnTokens = (surfaceTheme: SurfaceTheme): string => {
    const { pal, n } = getDefaultBtnPalForSurface(surfaceTheme);
    const sbg = p(palFor(surfaceTheme), nFor(surfaceTheme));
    const sn = nFor(surfaceTheme);
    const bg = p(pal, n);
    const tones = getAccessibleTones(bg, n, pal);
    // black-white: NEUTRAL is ordered dark→light (opposite the brand palettes),
    // so the tone-table math mis-resolves the text/hover. BW is definitionally
    // black-or-white, so derive text + hover explicitly from the bg's lightness:
    // a black button gets white text and a subtle lighter hover (NOT a near-white
    // scrim); a white button gets dark text and a subtle darker hover.
    const isBW = effectiveButton === 'black-white';
    const txt = isBW ? (isLight(bg) ? '#1a1a1a' : WHITE_TEXT) : p(pal, tones.text);
    const palBorder = p(pal, getAccessibleTones(sbg, sn, pal).border);
    const { hover, active } = isBW
      ? (isLight(bg) ? { hover: '#e0e0e0', active: '#cccccc' } : { hover: '#1a1a1a', active: '#2e2e2e' })
      : activeAndHoverFor(pal, n);
    return `  --Buttons-Default-Button: ${bg};
  --Buttons-Default-Text: ${txt};
  --Buttons-Default-Border: ${palBorder};
  --Buttons-Default-Hover: ${hover};
  --Buttons-Default-Pressed: ${active};
  --Buttons-Default-Highlight: ${highlightFor(bg)};
  --Buttons-Default-Lowlight: ${lowlightFor(bg)};`;
  };

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
    tertiaryText = textFor(tertiaryContainerBg, WHITE_TEXT);
    tertiaryHeader = textFor(tertiaryContainerBg, WHITE_TEXT);
    tertiaryQuiet = quietFor(tertiaryContainerBg);
  }

  // Builds the surface-N-dependent token block for a given scope (Surface,
  // Surface-Dim, Surface-Bright, Surface-Dimmest). The main Brand block emits
  // these for `surfaceN`; the variant scopes re-emit them for their own tone
  // so descendants don't inherit text/border tuned for the parent surface.
  // Required because the lib's Light-Mode.css sets Default-theme values for
  // every variant at matching specificity (0,2,0) — without these overrides
  // those Default values leak through for everything except --Background.
  function buildScopeTokens(scopeBg: string, scopeN: number): string {
    const scopeTones = getAccessibleTones(scopeBg, scopeN, textPalette);
    const { active: scopeActive, hover: scopeHover } = activeAndHoverFor(surfacePalette, scopeN);
    const scopeBtnBorderPrimary = p(primaryLight, getAccessibleTones(scopeBg, scopeN, primaryLight).border);
    const scopeBtnBorderSecondary = p(vSecondary, getAccessibleTones(scopeBg, scopeN, vSecondary).border);
    const scopeBtnBorderTertiary = p(vTertiary, getAccessibleTones(scopeBg, scopeN, vTertiary).border);
    let scopeDefaultBtnBorder: string;
    switch (effectiveButton) {
      case 'tonal':
        scopeDefaultBtnBorder = p(primaryLight, getAccessibleTones(scopeBg, scopeN, primaryLight).border); break;
      case 'secondary': case 'laddered':
        scopeDefaultBtnBorder = p(vSecondary, getAccessibleTones(scopeBg, scopeN, vSecondary).border); break;
      case 'black-white':
        scopeDefaultBtnBorder = btnBg; break;
      default:
        scopeDefaultBtnBorder = p(primaryLight, getAccessibleTones(scopeBg, scopeN, primaryLight).border); break;
    }
    const neutralPalette = NEUTRAL.map(h => ({ hex: h }));
    const neutralBorderN = getAccessibleTones(scopeBg, scopeN, neutralPalette).border;
    const tonal = effectiveTextColoring === 'tonal';
    const textVal = tonal
      ? `var(--${surfacePaletteName}-Color-${scopeTones.text})`
      : (isLight(scopeBg) ? '#1a1a1a' : 'var(--White)');
    const headerVal = tonal
      ? `var(--${surfacePaletteName}-Color-${scopeTones.header})`
      : (isLight(scopeBg) ? '#1a1a1a' : 'var(--White)');
    const quietVal = tonal
      ? `var(--${surfacePaletteName}-Color-${scopeTones.quiet})`
      : quietFor(scopeBg);
    const borderVal = tonal
      ? `var(--${surfacePaletteName}-Color-${scopeTones.border})`
      : neutral(neutralBorderN);
    const borderVariantVal = tonal
      ? `${p(surfacePalette, scopeTones.border)}33`
      : `${neutral(neutralBorderN)}33`;
    // Hotlink / Link use the SAME tone number as Text (just the Info palette),
    // so the link tone tracks the text tone exactly. The lib's Link component
    // reads --Link / --Link-Hover / --Link-Visited (separate from --Hotlink) —
    // those vars aren't defined in the lib's CSS, so we set both here.
    const hotlinkColorN = scopeTones.text;
    return `  --Dropshadow-Color: ${hexToRgb(dropshadowFor(scopeBg))};
${emitDropshadowLevelLines(scopeBg)}
  --Text: ${textVal};
  --Header: ${headerVal};
  --Quiet: ${quietVal};
  --Border: ${borderVal};
  --Border-Variant: ${borderVariantVal};
  --Hover: ${scopeHover};
  --Pressed: ${scopeActive};
  --Hotlink: ${tokenRefToVar(getFixedTextToken(scopeN, false, 'Info'))};
  --Hotlink-Visited: var(--Hotlink-Visited-Color-${hotlinkColorN});
  --Link: ${tokenRefToVar(getFixedTextToken(scopeN, false, 'Info'))};
  --Link-Hover: var(--Info-Color-${Math.max(1, Math.min(12, hotlinkColorN + (scopeN <= 5 ? -1 : 1)))});
  --Link-Visited: var(--Hotlink-Visited-Color-${hotlinkColorN});
  --Buttons-Primary-Border: ${scopeBtnBorderPrimary};
  --Buttons-Secondary-Border: ${scopeBtnBorderSecondary};
  --Buttons-Tertiary-Border: ${scopeBtnBorderTertiary};
  --Buttons-Default-Border: ${scopeDefaultBtnBorder};
${(() => {
    // Defensive Default-button emission for the surface variant scopes
    // (Surface-Dim / Bright / Dimmest). Without these, Buttons-Default-*
    // inherit from the parent Brand block which is correct IN THEORY, but
    // ANY same-or-higher-specificity rule injected by a downstream stylesheet
    // (a Container override, a theme inside the scope, the lib's
    // [data-surface] rules) would shadow the inherited value at this scope.
    // Explicit at-scope values make the studio's chosen button mode stick
    // through to ButtonGroup / Slider / etc. controls inside Surface-Dim
    // panels like the ComponentStyleStage left nav.
    let defPal: typeof vPrimary = vPrimary;
    let defN = btnPC;
    switch (effectiveButton) {
      case 'secondary': case 'laddered': defPal = bSecondary; defN = btnSC; break;
      case 'tonal': defPal = bPrimary; defN = btnPC; break;
      case 'black-white': defPal = NEUTRAL.map(h => ({ hex: h })) as any; defN = isLight(scopeBg) ? 1 : 12; break;
      default: defPal = bPrimary; defN = btnPC; break;
    }
    const defBg = p(defPal, defN);
    const defTones = getAccessibleTones(defBg, defN, defPal);
    // black-white: explicit contrast text + subtle hover (NEUTRAL tone math is inverted).
    const defIsBW = effectiveButton === 'black-white';
    const defTxt = defIsBW ? (isLight(defBg) ? '#1a1a1a' : WHITE_TEXT) : p(defPal, defTones.text);
    const { hover, active } = defIsBW
      ? (isLight(defBg) ? { hover: '#e0e0e0', active: '#cccccc' } : { hover: '#1a1a1a', active: '#2e2e2e' })
      : activeAndHoverFor(defPal, defN);
    return `  --Buttons-Default-Button: ${defBg};
  --Buttons-Default-Text: ${defTxt};
  --Buttons-Default-Hover: ${hover};
  --Buttons-Default-Pressed: ${active};
  --Buttons-Default-Highlight: ${highlightFor(defBg)};
  --Buttons-Default-Lowlight: ${lowlightFor(defBg)};`;
  })()}`;
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
${emitDropshadowLevelLines(statusBg)}
  --Text: var(--${sc.palette}-Color-${tones.text});
}`;
})()}

/* ══ App Bar ══ */
${(() => {
  const ac = appBarConfig;
  const tones = getAccessibleTones(appBarBg, ac.n, primaryLight);
  let abPal = 'Primary', abN = btnPC;
  switch (effectiveButton) {
    case 'secondary': case 'laddered': abPal = 'Secondary'; abN = btnSC; break;
    case 'black-white': abPal = 'Neutral'; abN = isLight(appBarBg) ? 1 : 12; break;
    default: abPal = 'Primary'; abN = btnPC; break;
  }
  const abPalArr = abPal === 'Secondary' ? secondaryLight : abPal === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight;
  const { active: abOldHoverHex, hover: abHoverHex } = activeAndHoverFor(abPalArr, abN);
  // Surface --Hover / --Pressed for the App Bar context: based on the App Bar's
  // own BG tone, not whatever is inherited from the page surface (Primary-Light
  // would otherwise leak through and make ghost-button hovers look near-white).
  const appBarSurfacePalette = ac.palette === 'Primary' ? primaryLight : (ac.palette === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight);
  const { active: appBarActive, hover: appBarHover } = activeAndHoverFor(appBarSurfacePalette, ac.n);

  // Library components like AppBar set their own data-theme="App-Bar" on their
  // root element, which would otherwise override these vars. The nested
  // descendant selector lets that inner element still inherit the branded
  // tokens. Keep this narrow — matching [data-theme="Brand"] descendants would
  // also catch sibling content inside shared-wrapper layouts (e.g. PhonePreview
  // wraps App-Bar and Brand-main under one Brand-Nav-Bar frame).
  return `[data-theme="Brand-App-Bar"],
  [data-theme="Brand-App-Bar"][data-surface="Surface"],
  [data-theme="Brand-App-Bar"] [data-theme="App-Bar"],
  [data-theme="Brand-App-Bar"] [data-theme="App-Bar"][data-surface="Surface-Bright"] {
  --Background: ${appBarBg};
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(appBarBg))};
${emitDropshadowLevelLines(appBarBg)}
  --Text: var(--${ac.palette}-Color-${tones.text});
  --Header: var(--${ac.palette}-Color-${tones.header});
  --Quiet: var(--${ac.palette}-Color-${tones.quiet});
  --Border: var(--${ac.palette}-Color-${tones.border});
  --Hover: ${appBarHover};
  --Pressed: ${appBarActive};
  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: ${btnBorder};
  --Buttons-Primary-Hover: ${abHoverHex};
  --Buttons-Primary-Pressed: ${abOldHoverHex};
  --Buttons-Default-Button: transparent;
  --Buttons-Default-Text: var(--${ac.palette}-Color-${tones.text});
  --Buttons-Default-Border: var(--${ac.palette}-Color-${tones.border});
  --Buttons-Default-Highlight: ${highlightFor(btnBg)};
  --Buttons-Default-Lowlight: ${lowlightFor(btnBg)};
  --Buttons-Default-Hover: ${abHoverHex};
  --Buttons-Default-Pressed: ${abOldHoverHex};
  --Buttons-Primary-Highlight: ${highlightFor(btnBg)};
  --Buttons-Primary-Lowlight: ${lowlightFor(btnBg)};
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
  --Surface: var(--${surfacePaletteName}-Color-${surfaceN});
  --Surface-Dim: var(--${surfacePaletteName}-Color-${Math.max(surfaceN - 1, 1)});
  --Surface-Bright: var(--${surfacePaletteName}-Color-${Math.min(surfaceN + 1, 12)});
  --Container: var(--${containerPaletteName}-Color-${containerN});
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(surfaceBg))};
${emitDropshadowLevelLines(surfaceBg)}
  --Text: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.text})` : surfaceText};
  --Header: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.header})` : surfaceHeader};
  --Quiet: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.quiet})` : surfaceQuiet};
  --Border: ${effectiveTextColoring === 'tonal' ? `var(--${surfacePaletteName}-Color-${surfaceTones.border})` : surfaceBorder};
  --Border-Variant: ${effectiveTextColoring === 'tonal' ? `${p(surfacePalette, surfaceTones.border)}33` : `${surfaceBorder}33`};
  --Hover: ${activeAndHoverFor(surfacePalette, surfaceN).hover};
  --Pressed: ${activeAndHoverFor(surfacePalette, surfaceN).active};
  /* --Hotlink and friends share the contrast-tuned Info text mapping so
     ghost-variant buttons (which inherit color from --Hotlink) read on
     any surface tone. Same getFixedTextToken lookup as --Text-Info above. */
  --Hotlink: ${tokenRefToVar(getFixedTextToken(surfaceN, false, 'Info'))};
  --Hotlink-Visited: var(--Hotlink-Visited-Color-${surfaceTones.text});
  --Link: ${tokenRefToVar(getFixedTextToken(surfaceN, false, 'Info'))};
  --Link-Hover: var(--Info-Color-${Math.max(1, Math.min(12, surfaceTones.text + (surfaceN <= 5 ? -1 : 1)))});
  --Link-Visited: var(--Hotlink-Visited-Color-${surfaceTones.text});
${buildTextPaletteLines(surfaceN, false)}
${buildHeaderPaletteLines(surfaceN, false)}
  --Focus-Visible: #3b82f6;
  --Effect-Level-0: none;
  --Effect-Level-1: ${effectLevelRecipe(1)};
  --Effect-Level-2: ${effectLevelRecipe(2)};
  --Effect-Level-3: ${effectLevelRecipe(3)};
  --Effect-Level-4: ${effectLevelRecipe(4)};
  --Effect-Level-5: ${effectLevelRecipe(5)};

${(() => {
    // Generate all button palette tokens
    const allPalettes = [
      { name: 'Primary', palette: bPrimary, n: btnPC, paletteName: 'Primary' },
      { name: 'Secondary', palette: bSecondary, n: btnSC, paletteName: 'Secondary' },
      { name: 'Tertiary', palette: bTertiary, n: btnTC, paletteName: 'Tertiary' },
    ];
    return allPalettes.map(({ name, palette: pal, n }) => {
      const bg = p(pal, n);
      const tones = getAccessibleTones(bg, n, pal);
      const palBorder = p(pal, getAccessibleTones(surfaceBg, surfaceN, pal).border);
      const { active, hover } = activeAndHoverFor(pal, n);
      return `  --Buttons-${name}-Button: ${p(pal, n)};
  --Buttons-${name}-Text: ${p(pal, tones.text)};
  --Buttons-${name}-Border: ${palBorder};
  --Buttons-${name}-Hover: ${hover};
  --Buttons-${name}-Pressed: ${active};
  --Buttons-${name}-Highlight: ${highlightFor(bg)};
  --Buttons-${name}-Lowlight: ${lowlightFor(bg)};`;
    }).join('\n');
  })()}
${(() => {
    // Default button uses the selected button mode's palette and tones
    let defPal: typeof vPrimary = vPrimary;
    let defN = btnPC;
    switch (effectiveButton) {
      case 'secondary': case 'laddered': defPal = bSecondary; defN = btnSC; break;
      case 'tonal': defPal = bPrimary; defN = btnPC; break;
      case 'black-white': defPal = NEUTRAL.map(h => ({ hex: h })) as any; defN = isLight(surfaceBg) ? 1 : 12; break;
      default: defPal = bPrimary; defN = btnPC; break;
    }
    const { active: defActive, hover: defHover } = activeAndHoverFor(defPal, defN);
    return `  --Buttons-Default-Button: ${btnBg};
  --Buttons-Default-Text: ${btnText};
  --Buttons-Default-Border: ${btnBorder};
  --Buttons-Default-Highlight: ${highlightFor(btnBg)};
  --Buttons-Default-Lowlight: ${lowlightFor(btnBg)};
  --Buttons-Default-Hover: ${defHover};
  --Buttons-Default-Pressed: ${defActive};`;
  })()}
${emitTagTextTokens()}

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
    let cp = 'Primary', cn = btnPC;
    switch (effectiveButton) {
      case 'secondary': case 'laddered': cp = 'Secondary'; cn = btnSC; break;
      case 'black-white': cp = 'Neutral'; cn = isLight(containerBg) ? 1 : 12; break;
      default: cp = 'Primary'; cn = btnPC; break;
    }
    // Container button border uses the button mode's palette.
    // For black-white mode the border must match the button fill (so a black
    // button has a black border, a white button has a white border) — never
    // the container's neutral border tone.
    let contBtnBorder = containerBorder;
    if (cp === 'Neutral') {
      contBtnBorder = btnBg;
    } else {
      const contPal = cp === 'Secondary' ? vSecondary : cp === 'Tertiary' ? vTertiary : vPrimary;
      contBtnBorder = p(contPal, getAccessibleTones(containerBg, containerN, contPal).border);
    }
    const cpArr = cp === 'Secondary' ? secondaryLight : cp === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight;
    const { active: contActive, hover: contHover } = activeAndHoverFor(cpArr, cn);
    return `  --Container-Buttons-Default-Button: ${btnBg};
  --Container-Buttons-Default-Text: ${btnText};
  --Container-Buttons-Default-Border: ${contBtnBorder};
  --Container-Buttons-Default-Highlight: ${highlightFor(btnBg)};
  --Container-Buttons-Default-Lowlight: ${lowlightFor(btnBg)};
  --Container-Buttons-Default-Hover: ${contHover};
  --Container-Buttons-Default-Pressed: ${contActive};`;
  })()}
}

/* ══ Container Surface ══ */
${(() => {
  // The button border must follow the chosen button-mode palette (so it
  // matches Button / Text), not the container surface's palette. Mirrors the
  // logic in the --Container-Buttons-Default-Border block above.
  let buttonModePaletteName: 'Primary' | 'Secondary' | 'Tertiary' | 'Neutral' = 'Primary';
  let buttonModePalette: typeof vPrimary = vPrimary;
  let buttonModeN: number = btnPC;
  switch (effectiveButton) {
    case 'secondary': case 'laddered': buttonModePaletteName = 'Secondary'; buttonModePalette = bSecondary; buttonModeN = btnSC; break;
    case 'black-white': buttonModePaletteName = 'Neutral'; buttonModePalette = NEUTRAL.map(h => ({ hex: h })) as any; buttonModeN = isLight(containerBg) ? 1 : 12; break;
    default: buttonModePaletteName = 'Primary'; buttonModePalette = bPrimary; buttonModeN = btnPC; break;
  }
  const buttonModeBorderN = getAccessibleTones(containerBg, containerN, buttonModePalette).border;
  // In black-white mode the border must match the button fill itself (black
  // button → black border, white button → white border), regardless of the
  // accessible-border tone the surface would normally derive.
  const buttonBorderCss = effectiveButton === 'black-white'
    ? btnBg
    : `var(--${buttonModePaletteName}-Color-${buttonModeBorderN})`;
  // Default button hover/active — based on the button's OWN palette tone (the
  // button is filled with btnBg = palette[buttonModeN]), not the container's
  // surface tone. Otherwise on a white card (containerN=12) the hover would
  // resolve to ~white via the activeAndHoverFor endpoint rule.
  const { active: contBtnActive, hover: contBtnHover } = activeAndHoverFor(buttonModePalette, buttonModeN);
  // Black-White buttons must contrast with the CARD they sit on, not the page
  // surface. A BW button inside a BLACK card must be WHITE — the surface-based
  // btnBg would make it black (invisible on the card). Derive from the
  // container's own lightness; non-BW buttons keep their surface-based color.
  const contIsBW = effectiveButton === 'black-white';
  const contDefBg = contIsBW ? (isLight(containerBg) ? NEUTRAL[0] : NEUTRAL[NEUTRAL.length - 1]) : btnBg;
  const contDefText = contIsBW ? (isLight(containerBg) ? '#ffffff' : '#1a1a1a') : btnText;
  const contDefBorder = contIsBW ? contDefBg : buttonBorderCss;
  const contDefHover = contIsBW ? (isLight(contDefBg) ? '#e0e0e0' : '#1a1a1a') : contBtnHover;
  const contDefActive = contIsBW ? (isLight(contDefBg) ? '#cccccc' : '#2e2e2e') : contBtnActive;
  return `[data-theme="Brand"][data-surface="Container"],
[data-theme="Brand"][data-surface="Container-High"],
[data-theme="Brand"][data-surface="Container-Highest"],
[data-theme="Brand"][data-surface="Container-Low"],
[data-theme="Brand"][data-surface="Container-Lowest"],
[data-theme="Brand"] [data-surface="Container"],
[data-theme="Brand"] [data-surface="Container-High"],
[data-theme="Brand"] [data-surface="Container-Highest"],
[data-theme="Brand"] [data-surface="Container-Low"],
[data-theme="Brand"] [data-surface="Container-Lowest"],
[data-surface] [data-surface="Container"],
[data-surface] [data-surface="Container-High"],
[data-surface] [data-surface="Container-Highest"],
[data-surface] [data-surface="Container-Low"],
[data-surface] [data-surface="Container-Lowest"] {
  --Background: var(--${containerPaletteName}-Color-${containerN});
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(containerBg))};
${emitDropshadowLevelLines(containerBg)}
  --Text: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.text})` : containerText};
  --Header: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.header})` : containerHeader};
  --Quiet: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.quiet})` : containerQuiet};
  --Border: ${effectiveTextColoring === 'tonal' ? `var(--${containerPaletteName}-Color-${containerTones.border})` : containerBorder};
  --Border-Variant: ${effectiveTextColoring === 'tonal' ? `${p(surfacePalette, containerTones.border)}33` : `${containerBorder}33`};
  --Hover: ${activeAndHoverFor(containerPaletteName === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : containerPaletteName === 'Primary' ? primaryLight : containerPaletteName === 'Secondary' ? secondaryLight : tertiaryLight, containerN).hover};
  --Pressed: ${activeAndHoverFor(containerPaletteName === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : containerPaletteName === 'Primary' ? primaryLight : containerPaletteName === 'Secondary' ? secondaryLight : tertiaryLight, containerN).active};
  /* Hotlink / Link use the SAME getFixedTextToken('Info') call as Text-Info
     emitted by buildTextPaletteLines below — they ARE the same color in
     this design system, the lib just exposes them under different names.
     Without emitting at Container scope, Ghost-variant buttons inside a
     Card inherit Hotlink from the parent Surface scope (often wrong tone)
     or from the lib's Light-Mode.css [data-surface^="Container"] default. */
  --Hotlink: ${tokenRefToVar(getFixedTextToken(containerN, true, 'Info'))};
  --Hotlink-Visited: var(--Hotlink-Visited-Color-${containerTones.text});
  --Link: ${tokenRefToVar(getFixedTextToken(containerN, true, 'Info'))};
  --Link-Hover: var(--Info-Color-${Math.max(1, Math.min(12, containerTones.text + (containerN <= 5 ? -1 : 1)))});
  --Link-Visited: var(--Hotlink-Visited-Color-${containerTones.text});
${buildTextPaletteLines(containerN, true)}
${buildHeaderPaletteLines(containerN, true)}
  --Buttons-Primary-Button: ${contDefBg};
  --Buttons-Primary-Text: ${contDefText};
  --Buttons-Primary-Border: ${contDefBorder};
  --Buttons-Default-Button: ${contDefBg};
  --Buttons-Default-Text: ${contDefText};
  --Buttons-Default-Border: ${contDefBorder};
  --Buttons-Default-Highlight: ${highlightFor(contDefBg)};
  --Buttons-Default-Lowlight: ${lowlightFor(contDefBg)};
  --Buttons-Default-Hover: ${contDefHover};
  --Buttons-Default-Pressed: ${contDefActive};
  --Buttons-Primary-Highlight: ${highlightFor(contDefBg)};
  --Buttons-Primary-Lowlight: ${lowlightFor(contDefBg)};
  /* Light-Mode.css's [data-theme="Default"] [data-surface^="Container"]
     rule writes --Buttons-Primary-Hover / -Pressed straight onto every Card
     in the studio (because the outer App <main> still has
     data-theme="Default"), which beats the value inherited from this
     scope. Re-set them here so primary buttons inside branded Cards keep
     their primary-tinted hover/active. */
  --Buttons-Primary-Hover: ${contDefHover};
  --Buttons-Primary-Pressed: ${contDefActive};
  /* Per-palette button overrides inside container scope.
     Lib's Light-Mode.css writes hardcoded values onto every Card via
     [data-theme="Default"] [data-surface^="Container"] for Secondary,
     Tertiary, Neutral — including Hover/Pressed hexes from its OWN old
     design system (e.g. --Buttons-Secondary-Hover: #b0ebff, a blue from
     when that snapshot was generated). That rule's (0,2,0) specificity
     beats the brand's (0,1,0) at the <main> level, so without these
     explicit re-overrides at matching specificity the secondary button
     hover stays blue regardless of brand. Emit Button / Text / Border /
     Hover / Pressed / Highlight / Lowlight for each palette so every slot
     a variant button could read points at the brand's palette. */
${(() => {
    const perPalette = [
      { name: 'Secondary', pal: bSecondary, n: btnSC },
      { name: 'Tertiary',  pal: bTertiary,  n: btnTC },
      { name: 'Neutral',   pal: NEUTRAL.map(h => ({ hex: h })) as any, n: 8 },
    ];
    return perPalette.map(({ name, pal, n }) => {
      const bg = p(pal, n);
      const tones = getAccessibleTones(bg, n, pal);
      const palBorder = p(pal, getAccessibleTones(containerBg, containerN, pal).border);
      const { active, hover } = activeAndHoverFor(pal, n);
      return `  --Buttons-${name}-Button: ${bg};
  --Buttons-${name}-Text: ${p(pal, tones.text)};
  --Buttons-${name}-Border: ${palBorder};
  --Buttons-${name}-Hover: ${hover};
  --Buttons-${name}-Pressed: ${active};
  --Buttons-${name}-Highlight: ${highlightFor(bg)};
  --Buttons-${name}-Lowlight: ${lowlightFor(bg)};`;
    }).join('\n');
  })()}
}`;
})()}

/* ══ Tertiary Theme ══
 * An element with data-theme="Tertiary" should paint with the tertiary
 * palette at the user's TC tone (where their tertiary color sits in the
 * scale). Fixed to TC so it does NOT shift when the user changes the main
 * Background selection. Without these, Light-Mode.css's rule for
 * [data-theme="Tertiary"][data-surface="Surface"] hands the element
 * var(--Tertiary-Color-1) (near-black) and tertiary cards look wrong. */
${(() => {
  // Accessible Header/Text/Quiet/Border tones for the Tertiary surface at
  // TC. Without these the tertiary card inherits the brand surface's text
  // tokens — which are tuned for a different palette, so contrast fails
  // (e.g. dark neutral header on dark tertiary). Compute against the
  // tertiary palette at the user's TC tone so the H3 / body / border
  // resolve to readable tertiary tones.
  // In dark mode a Tertiary surface goes DARK, the same way the page background
  // and the tertiary CONTAINER already do (p(tertiary, 3) above). Pinning it to
  // TC in both modes is what left the tertiary card cream on a dark page — the
  // one card that never followed the mode.
  const tertiaryThemeN = isDark ? 3 : TC;
  const tertiaryThemePal = isDark ? tertiaryDark : tertiaryLight;
  const tertiarySurfaceBg = p(tertiaryThemePal, tertiaryThemeN);
  const tertiarySurfaceTones = getAccessibleTones(tertiarySurfaceBg, tertiaryThemeN, tertiaryThemePal);
  return `[data-theme="Tertiary"],
[data-theme="Tertiary"][data-surface="Surface"] {
  --Background: var(--Tertiary-Color-${tertiaryThemeN});
  --Surface: var(--Tertiary-Color-${tertiaryThemeN});
  --Header: var(--Tertiary-Color-${tertiarySurfaceTones.header});
  --Text: var(--Tertiary-Color-${tertiarySurfaceTones.text});
  --Quiet: var(--Tertiary-Color-${tertiarySurfaceTones.quiet});
  --Border: var(--Tertiary-Color-${tertiarySurfaceTones.border});
  /* Tag.Default on a Tertiary surface = Tag.Primary (per the design
     system's complementary-palette mapping: Tertiary card → Primary
     tag). Inherit the brand's already-computed Tag-Primary tokens so
     the chip stays in sync if the user changes their primary. */
  --Tag-Default-BG: var(--Tag-Primary-BG);
  --Tag-Default-Text: var(--Tag-Primary-Text);
  --Container: ${tertiaryContainerBg};
  --Container-Text: ${tertiaryText};
  --Container-Header: ${tertiaryHeader};
  --Container-Quiet: ${tertiaryQuiet};
  --Container-Border: var(--Tertiary-Color-${(() => { const t = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryLight); return t.border; })()});
  --Container-Buttons-Default-Text: ${tertiaryText};
  --Container-Buttons-Default-Border: var(--Tertiary-Color-${(() => { const t = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryLight); return t.border; })()});
  --Tag-Tertiary-BG: ${tagBg};
  --Tag-Tertiary-Text: ${tagText};
${emitDefaultBtnTokens('Tertiary')}
${emitPerPaletteButtonTokens(tertiarySurfaceBg, TC)}
${emitTagTextTokens()}
}`;
})()}

/* ══ Secondary Theme ══
 * Same fix as Tertiary, fixed to SC (the user's secondary color position) so
 * secondary-themed surfaces don't shift when the main Background changes. */
[data-theme="Secondary"],
[data-theme="Secondary"][data-surface="Surface"] {
  --Background: var(--Secondary-Color-${SC});
  --Surface: var(--Secondary-Color-${SC});
${emitDefaultBtnTokens('Secondary')}
${emitPerPaletteButtonTokens(p(vSecondary, SC), SC)}
${emitTagTextTokens()}
}

/* ══ Primary Theme ══
 * Cards with color="primary" (or other elements that set data-theme="Primary")
 * also need the brand's Default-button tokens — the lib emits hardcoded
 * Default-Hover/Pressed under [data-theme="Primary"][data-surface="Surface"]
 * which would otherwise win over the main Brand block. */
[data-theme="Primary"],
[data-theme="Primary"][data-surface="Surface"] {
${emitDefaultBtnTokens('Primary')}
${emitPerPaletteButtonTokens(p(primaryLight, PC), PC)}
${emitTagTextTokens()}
}

/* ══ Nav Bar ══ */
${(() => {
  const nc = navBarConfig;
  const tones = getAccessibleTones(navBarBg, nc.n, primaryLight);
  // Use the button mode's palette for hover/active
  let navDefPal: typeof vPrimary = vPrimary;
  let navDefN = btnPC;
  switch (effectiveButton) {
    case 'secondary': case 'laddered': navDefPal = bSecondary; navDefN = btnSC; break;
    // Match btnBg's logic (surfaceBg-based), NOT navBarBg-based. btnBg
    // resolves from the page surface so the button color is consistent
    // across nav bars. Picking the hover tone from navBarBg used to give
    // a black button (from surface=light) a white hover (from navBarBg=
    // dark) — totally invisible after hovering.
    case 'black-white': navDefPal = NEUTRAL.map(h => ({ hex: h })) as any; navDefN = isLight(surfaceBg) ? 1 : 12; break;
    default: navDefPal = bPrimary; navDefN = btnPC; break;
  }
  const { active: navDefOldHoverHex, hover: navDefHoverHex } = activeAndHoverFor(navDefPal, navDefN);
  const navBorderN = tones.border;
  // Surface --Hover/--Pressed for Nav Bar context — based on Nav Bar's own tone.
  const navBarSurfacePalette = nc.palette === 'Primary' ? primaryLight : (nc.palette === 'Neutral' ? NEUTRAL.map(h => ({hex: h})) as any : primaryLight);
  const { active: navBarActive, hover: navBarHover } = activeAndHoverFor(navBarSurfacePalette, nc.n);
  // The button sits ON the nav bar, so its border has to contrast with the BAR,
  // not with the page surface. btnBorder is derived from surfaceBg, so when
  // Default Buttons = Primary and the nav bar is also Primary, the border lands
  // on the bar's own colour and the button dissolves into the strip — a solid
  // band of colour with a label on it and no button shape at all.
  const navBtnBorder = p(navDefPal, getAccessibleTones(navBarBg, nc.n, navDefPal).border);

  return `[data-theme="Brand-Nav-Bar"],
  [data-theme="Brand-Nav-Bar"][data-surface="Surface"],
  [data-theme="Brand-Nav-Bar"] [data-theme="Nav-Bar"],
  [data-theme="Brand-Nav-Bar"] [data-theme="Nav-Bar"][data-surface="Surface-Bright"] {
  --Background: ${navBarBg};
  --Dropshadow-Color: ${hexToRgb(dropshadowFor(navBarBg))};
${emitDropshadowLevelLines(navBarBg)}
  --Text: ${p(primaryLight, tones.text)};
  --Header: ${p(primaryLight, tones.header)};
  --Quiet: ${p(primaryLight, tones.quiet)};
  --Border: ${p(primaryLight, navBorderN)};
  --Hover: ${navBarHover};
  --Pressed: ${navBarActive};
  /* Container tokens need to be set in the Brand-Nav-Bar scope too because
     the iPhone preview wraps EVERYTHING in [data-theme="Brand-Nav-Bar"].
     Without these, Card components inside the phone don't react to
     cardColoring changes. Values come from the same containerBg / etc.
     computed earlier from the user's cardColoring selection. */
  --Container: ${containerBg};
  --Container-Low: ${containerLow};
  --Container-Lowest: ${containerLow};
  --Container-High: ${containerBg};
  --Container-Highest: ${containerBg};
  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: ${effectiveButton === 'black-white' ? btnBg : navBtnBorder};
  --Buttons-Primary-Hover: ${navDefHoverHex};
  --Buttons-Primary-Pressed: ${navDefOldHoverHex};
  --Buttons-Default-Button: ${btnBg};
  --Buttons-Default-Text: ${btnText};
  --Buttons-Default-Border: ${effectiveButton === 'black-white' ? btnBg : navBtnBorder};
  --Buttons-Default-Highlight: ${highlightFor(btnBg)};
  --Buttons-Default-Lowlight: ${lowlightFor(btnBg)};
  --Buttons-Default-Hover: ${navDefHoverHex};
  --Buttons-Default-Pressed: ${navDefOldHoverHex};
  --Buttons-Primary-Highlight: ${highlightFor(btnBg)};
  --Buttons-Primary-Lowlight: ${lowlightFor(btnBg)};
}`;
})()}

/* Surface variants inside Brand scope.
 * Light-Mode.css has rules like [data-theme="Default"] [data-surface="Surface-Dim"]
 * that set --Background AND --Text / --Quiet / --Border etc. at specificity
 * 0,2,0. To fully override them for Brand-themed descendants, each rule below
 * re-emits the surface-N-dependent token block at its own tone (dimN/brightN).
 * Without these, only --Background would override and Text/Border would
 * silently inherit the Default theme's Color-N values. */
${(() => {
  const dimN = Math.max(surfaceN - 1, 1);
  const brightN = Math.min(surfaceN + 1, 12);
  const dimmestN = Math.max(surfaceN - 2, 1);
  const dimBg = p(surfacePalette, dimN);
  const brightBg = p(surfacePalette, brightN);
  const dimmestBg = p(surfacePalette, dimmestN);
  return `[data-theme="Brand"] [data-surface="Surface-Dim"],
[data-theme="Brand"][data-surface="Surface-Dim"] {
  --Background: var(--Surface-Dim);
${buildScopeTokens(dimBg, dimN)}
}
[data-theme="Brand"] [data-surface="Surface-Dimmest"],
[data-theme="Brand"][data-surface="Surface-Dimmest"] {
  --Background: var(--${surfacePaletteName}-Color-${dimmestN});
${buildScopeTokens(dimmestBg, dimmestN)}
}
[data-theme="Brand"] [data-surface="Surface-Bright"],
[data-theme="Brand"][data-surface="Surface-Bright"] {
  --Background: var(--Surface-Bright);
${buildScopeTokens(brightBg, brightN)}
}
[data-theme="Brand"] [data-surface="Surface"],
[data-theme="Brand"][data-surface="Surface"]             { --Background: var(--Surface); }`;
})()}

/* ══ Clickable Elements — border inherits 3:1 contrast from context ══ */
.clickable { border-color: var(--Border); }

/* ══ Typography ══ */
${(() => {
  const header = input.typographyStyles?.find(t => t.type === 'header');
  const decorative = input.typographyStyles?.find(t => t.type === 'decorative');
  const body = input.typographyStyles?.find(t => t.type === 'body');
  if (!header && !body) return '';
  // The Header face is always Google Sans Flex — never the picked family, and
  // resolveRoles enforces that for designs saved before the switch. Reading it
  // from there keeps the preview and the generated ramp on one answer.
  const resolvedFaces = resolveRoles(input.typographyStyles);
  const headerFamily = `'${resolvedFaces.header.family}', sans-serif`;
  const decorativeFamily = `'${decorative?.family || header?.family || 'sans-serif'}', sans-serif`;
  const bodyFamily = `'${body?.family || 'sans-serif'}', sans-serif`;
  // Use ^="Brand" so the typography tokens cascade into Brand and any
  // Brand-derived sub-themes (Brand-App-Bar, Brand-Nav-Bar, etc.) — that
  // way the AppBar / CreationTopBar / nav chrome pick up the user's
  // selected fonts, not just the body content under [data-theme="Brand"].
  // Weight is the wght axis on the Flex face.
  const headerWeight = String(resolvedFaces.header.weight);
  const bodyWeight = body?.weight || '400';
  return `[data-theme="Brand"], [data-theme^="Brand-"], [data-theme="Brand"] *, [data-theme^="Brand-"] * {
  --Set-Font-Family-Header: ${headerFamily};
  --Set-Font-Family-Header-Weight: ${headerWeight};
  --Set-Font-Family-Decorative: ${decorativeFamily};
  --Set-Font-Family-Body: ${bodyFamily};
  --Set-Font-Family-Body-Weight: ${bodyWeight};
  --Font-Family-Header: ${headerFamily};
  --Body-Font-Family: ${bodyFamily};
  --Font-Family-Body: ${bodyFamily};
  /* The lib's typography variants (H1-H6, display-*) read --Header-Font-Family
     for fontFamily and --H{N}-Font-Weight for fontWeight. Body/Subtitle/Overline
     read --Body-Font-Family. Set them all inside Brand context so the user's
     selected fonts and weights actually take effect on lib H2/H3/Body without
     having to inline them at every callsite. */
  --Header-Font-Family: ${headerFamily};
  --Header-Font-Weight: ${headerWeight};
  --Display-Large-Font-Weight: ${headerWeight};
  --Display-Small-Font-Weight: ${headerWeight};
  --H1-Font-Weight: ${headerWeight};
  --H2-Font-Weight: ${headerWeight};
  --H3-Font-Weight: ${headerWeight};
  --H4-Font-Weight: ${headerWeight};
  --H5-Font-Weight: ${headerWeight};
  --H6-Font-Weight: ${headerWeight};
  --Body-Font-Weight: ${bodyWeight};
  --Body-Small-Font-Weight: ${bodyWeight};
  --Body-Large-Font-Weight: ${bodyWeight};
}

/* The generated ramp — the same declarations typography-tokens.css ships, so
   the preview shows the sizes and leading the export actually produces rather
   than the lib's shipped defaults. On the theme roots only; custom properties
   inherit, and repeating 150 declarations under a universal selector doesn't. */
[data-theme="Brand"], [data-theme^="Brand-"] {
${typographyDeclarations(input.typographyStyles)}
}

${generateTypographyRules(input.typographyStyles)}`;
})()}

/* ══ Component Style ══ */
${(() => {
  // Preset fallbacks when no user customizations are present (percent radii).
  const PRESET_DEFAULTS: Record<string, { cardPadding: number; buttonRadius: number; iconButtonRadius: number; inputRadius: number }> = {
    professional: { cardPadding: 12, buttonRadius: 6,  iconButtonRadius: 100, inputRadius: 6 },
    modern:       { cardPadding: 16, buttonRadius: 12, iconButtonRadius: 100, inputRadius: 12 },
    bold:         { cardPadding: 20, buttonRadius: 25, iconButtonRadius: 100, inputRadius: 25 },
    playful:      { cardPadding: 24, buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100 },
  };
  const preset = PRESET_DEFAULTS[input.componentStyle] || PRESET_DEFAULTS.modern;
  const sc = migrateLegacyRadii({
    cardPadding: input.styleCustomizations?.cardPadding ?? preset.cardPadding,
    buttonRadius: input.styleCustomizations?.buttonRadius ?? preset.buttonRadius,
    iconButtonRadius: input.styleCustomizations?.iconButtonRadius ?? preset.iconButtonRadius,
    inputRadius: input.styleCustomizations?.inputRadius ?? preset.inputRadius,
    buttonHeight: input.styleCustomizations?.buttonHeight ?? 32,
    smallButtonHeight: input.styleCustomizations?.smallButtonHeight ?? 24,
    largeButtonHeight: input.styleCustomizations?.largeButtonHeight ?? 56,
    radius: input.styleCustomizations?.radius,
  });
  const r = computeRadii(sc);
  // Cap card-shaped radii at the standard button height so larger surfaces
  // (cards, image thumbnails, modals) don't go stadium-shaped under playful
  // brand presets where buttonRadius is 100. A 100px radius on a 32px
  // button still renders as a perfect pill (radius ≥ height/2 saturates),
  // so clamping below doesn't visually change pill buttons — it only stops
  // wide rectangular surfaces from inheriting the same pill silhouette.
  const buttonHeight = sc.buttonHeight ?? 32;
  const cappedStyleRadius = Math.min(r.buttonRadius, buttonHeight);
  const cappedCardRadius = Math.min(r.cardRadius, buttonHeight);
  const cappedModalRadius = Math.min(r.modalRadius, buttonHeight);
  // Accordion-specific cap. The Accordion summary is ~buttonHeight tall, so
  // using --Style-Border-Radius at full cap (= buttonHeight) saturates into
  // a stadium shape (radius ≥ height/2). Buttons are intentionally pill-able,
  // accordions aren't. We can't lower --Style-Border-Radius without also
  // de-pilling buttons, so emit a dedicated --Accordion-Radius capped at
  // half the button height and override the lib's Accordion rule below.
  const cappedAccordionRadius = Math.min(r.buttonRadius, Math.floor(buttonHeight / 2));
  // Button radius caps at the LARGE button height — beyond that CSS clamps a
  // pill anyway, and uncapped values (e.g. 100) over-round anything that reads
  // --Button-Radius (accordions, swatches). Mirrors the export cap.
  const largeButtonHeight = sc.largeButtonHeight ?? 56;
  const cappedButtonRadius = Math.min(r.buttonRadius, largeButtonHeight);
  return `:root {
  --Style-Border-Radius: ${cappedStyleRadius}px;
  --Button-Radius: ${cappedButtonRadius}px;
  --Sm-Button-Radius: ${Math.min(r.smButtonRadius, largeButtonHeight)}px;
  --Lg-Button-Radius: ${Math.min(r.lgButtonRadius, largeButtonHeight)}px;
  --Button-Icon-Radius: ${r.iconButtonRadius}px;
  --Sm-Button-Icon-Radius: ${r.smIconButtonRadius}px;
  --Lg-Button-Icon-Radius: ${r.lgIconButtonRadius}px;
  --Card-Radius: ${cappedCardRadius}px;
  --Card-Padding: ${r.cardPadding}px;
  --Modal-Padding: ${r.modalPadding}px;
  --Modal-Radius: ${cappedModalRadius}px;
  --Accordion-Radius: ${cappedAccordionRadius}px;
  --Input-Radius: ${r.inputRadius}px;
  --Input-Inner-Focus-Visible: ${Math.max(0, r.inputRadius - 1)}px;
  --Input-Swatch-Radius: ${r.inputSwatchRadius}px;
  --Sm-Input-Swatch-Radius: ${r.smInputSwatchRadius}px;
  --Lg-Input-Swatch-Radius: ${r.lgInputSwatchRadius}px;
  --Sm-Checkbox-Radius: 3.2px;
  --Checkbox-Radius: 4px;
  --Lg-Checkbox-Radius: 4.8px;
}

/* Accordion radius override — see --Accordion-Radius rationale above.
   The lib's Accordion.js inlines borderRadius: var(--Style-Border-Radius)
   so we override via the MUI class selector (Accordion is the only common
   wrapper that reads Style-Border-Radius today; if more components join
   we'll extract this into a shared rule). */
.accordion-group,
.MuiAccordion-root {
  border-radius: var(--Button-Radius) !important;
}
.accordion-group > *,
.MuiAccordion-root .MuiAccordionSummary-root,
.MuiAccordion-root .MuiAccordionDetails-root {
  border-radius: calc(var(--Button-Radius) - 1px) !important;
}`;
})()}

/* ══ Adaptive white token ══
 * --White is opaque #ffffff in light mode and 70% white in dark mode.
 * Anywhere the brand needs "white" (e.g. text on a chromatic surface,
 * a 100%-coverage container) should use var(--White) instead of a
 * literal #ffffff so it dims correctly for visual comfort under dark
 * surfaces. */
[data-theme="Brand"],
[data-theme^="Brand-"],
[data-theme="Brand"] [data-surface],
[data-theme^="Brand-"] [data-surface] {
  --White: ${isDark ? 'rgba(255, 255, 255, 0.7)' : '#ffffff'};
}

${isDark ? `/* ══ Dark mode image treatment ══
 * Every <img> gets a 30% black overlay (via brightness, which is
 * mathematically equivalent on opaque pixels and works on replaced
 * elements without a wrapper).
 *
 * Text/Header are NOT overridden here — the brand CSS above already
 * sets them to the design system's dark-mode palette tones (e.g.
 * var(--Neutral-Color-9)), which the export pipeline contrast-verifies
 * against each surface. */
[data-theme="Brand"] img,
[data-theme^="Brand-"] img,
[data-theme="Brand"] [data-theme] img {
  filter: brightness(0.7);
}
` : ''}`;
}
