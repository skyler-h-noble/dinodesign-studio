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
  '#f0f0f0', '#fafafa',
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
function quietFor(hex: string) { return isLight(hex) ? '#777777' : '#aaaaaa'; }
function borderFor(hex: string) { return isLight(hex) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)'; }

/**
 * Get accessible text/header/quiet/border tone numbers for a given surface,
 * verified against the actual palette colors.
 */
function getAccessibleTones(
  bgHex: string,
  surfaceN: number,
  palette: Array<{ hex: string }>,
): { text: number; header: number; quiet: number } {
  const idx = surfaceN - 1; // 0-based index into lookup tables
  const safeIdx = Math.max(0, Math.min(idx, 11));

  const textStart = TEXT_LOOKUP_LIGHT_BG[safeIdx];
  const headerStart = HEADER_LOOKUP_LIGHT_BG[safeIdx];
  const quietStart = QUIET_LOOKUP_LIGHT_BG[safeIdx];

  return {
    text: findAccessibleTone(bgHex, palette, textStart, 4.5),
    header: findAccessibleTone(bgHex, palette, headerStart, 3.1),
    quiet: findAccessibleTone(bgHex, palette, quietStart, 4.5),
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
  // Determine surface palette and Color-N
  let surfacePalette: typeof primary;
  let surfaceN: number;
  if (isDark) {
    surfacePalette = darkUsePrimary ? primary : Array.from({ length: 12 }, (_, i) => ({
      hex: NEUTRAL[i], tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
    })) as typeof primary;
    surfaceN = 2;
  } else {
    switch (sel.background) {
      case 'black': surfacePalette = Array.from({ length: 12 }, (_, i) => ({
        hex: NEUTRAL[i], tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
      })) as typeof primary; surfaceN = 1; break;
      case 'primary-base': surfacePalette = primary; surfaceN = PC; break;
      case 'primary-light': surfacePalette = primary; surfaceN = 11; break;
      default: surfacePalette = Array.from({ length: 12 }, (_, i) => ({
        hex: NEUTRAL[i], tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
      })) as typeof primary; surfaceN = 12; break;
    }
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
  // White: Neutral Color-14
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
    containerBg = neutral(12);
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
  const containerN = isDark ? 3 : 10;
  const tertiaryContainerN = isDark ? 3 : 10;

  let surfaceText: string;
  let surfaceHeader: string;
  let surfaceQuiet: string;
  let containerText: string;
  let containerHeader: string;
  let containerQuiet: string;

  if (effectiveTextColoring === 'tonal') {
    // Tonal: use contrast-verified lookup against actual palette hex values
    // ALWAYS use the light (vibrant) palette for text — even in dark mode
    // Dark palette is only for surfaces/containers
    const textPalette = primaryLight;

    const surfaceTones = getAccessibleTones(surfaceBg, surfaceN, textPalette);
    surfaceText = `var(--Colors-Primary-Color-${surfaceTones.text})`;
    surfaceHeader = `var(--Colors-Primary-Color-${surfaceTones.header})`;
    surfaceQuiet = `var(--Colors-Primary-Color-${surfaceTones.quiet})`;

    const containerTones = getAccessibleTones(containerBg, containerN, textPalette);
    containerText = `var(--Colors-Primary-Color-${containerTones.text})`;
    containerHeader = `var(--Colors-Primary-Color-${containerTones.header})`;
    containerQuiet = `var(--Colors-Primary-Color-${containerTones.quiet})`;
  } else {
    // BW (light mode only)
    surfaceText = textFor(surfaceBg);
    surfaceHeader = textFor(surfaceBg);
    surfaceQuiet = quietFor(surfaceBg);
    containerText = textFor(containerBg);
    containerHeader = textFor(containerBg);
    containerQuiet = quietFor(containerBg);
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
  let btnBg: string, btnText: string, btnBorder: string;
  switch (effectiveButton) {
    case 'secondary': {
      btnBg = `var(--Colors-Secondary-Color-${SC})`;
      const scTones = getAccessibleTones(p(vSecondary, SC), SC, vSecondary);
      btnText = `var(--Colors-Secondary-Color-${scTones.text})`;
      btnBorder = `var(--Colors-Secondary-Color-${SC})`; break;
    }
    case 'tonal': {
      btnBg = `var(--Colors-Primary-Color-${PC})`;
      const pcTones = getAccessibleTones(p(vPrimary, PC), PC, vPrimary);
      btnText = `var(--Colors-Primary-Color-${pcTones.text})`;
      btnBorder = `var(--Colors-Primary-Color-${PC})`; break;
    }
    case 'black-white':
      btnBg = isLight(surfaceBg) ? '#1a1a1a' : '#ffffff';
      btnText = isLight(surfaceBg) ? '#ffffff' : '#1a1a1a';
      btnBorder = btnBg; break;
    case 'laddered': {
      // Laddered: Default button uses Secondary palette
      btnBg = `var(--Colors-Secondary-Color-${SC})`;
      const ladTones = getAccessibleTones(p(vSecondary, SC), SC, vSecondary);
      btnText = `var(--Colors-Secondary-Color-${ladTones.text})`;
      btnBorder = `var(--Colors-Secondary-Color-${SC})`; break;
    }
    default: {
      btnBg = `var(--Colors-Primary-Color-${PC})`;
      const defTones = getAccessibleTones(p(vPrimary, PC), PC, vPrimary);
      btnText = `var(--Colors-Primary-Color-${defTones.text})`;
      btnBorder = `var(--Colors-Primary-Color-${PC})`;
    }
  }

  const defaultBtnText = containerText;
  const defaultBtnBorder = borderFor(containerBg);

  // ── Tertiary tag + text — always vibrant (light palette) ──
  const tagN = Math.max(TC - 2, 1);
  const tagBg = `var(--Colors-Tertiary-Color-${tagN})`;
  const tagTones = getAccessibleTones(p(vTertiary, tagN), tagN, vTertiary);
  const tagText = `var(--Colors-Tertiary-Color-${tagTones.text})`;

  let tertiaryText: string;
  let tertiaryHeader: string;
  let tertiaryQuiet: string;
  if (effectiveTextColoring === 'tonal') {
    // Always use light palette for text accessibility checks
    const tertiaryTextPalette = tertiaryLight;
    const tertiaryTones = getAccessibleTones(tertiaryContainerBg, tertiaryContainerN, tertiaryTextPalette);
    tertiaryText = `var(--Colors-Tertiary-Color-${tertiaryTones.text})`;
    tertiaryHeader = `var(--Colors-Tertiary-Color-${tertiaryTones.header})`;
    tertiaryQuiet = `var(--Colors-Tertiary-Color-${tertiaryTones.quiet})`;
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
${primaryLight.map((t, i) => `  --Colors-Primary-Color-${i + 1}: ${t.hex};`).join('\n')}
${secondaryLight.map((t, i) => `  --Colors-Secondary-Color-${i + 1}: ${t.hex};`).join('\n')}
${tertiaryLight.map((t, i) => `  --Colors-Tertiary-Color-${i + 1}: ${t.hex};`).join('\n')}
${NEUTRAL.map((h, i) => `  --Colors-Neutral-Color-${i + 1}: ${h};`).join('\n')}
}

/* ══ Status Bar ══ */
${(() => {
  const sc = statusConfig;
  const tones = getAccessibleTones(statusBg, sc.n, primaryLight);
  return `[data-theme="Status"] {
  --Background: ${statusBg};
  --Text: var(--Colors-${sc.palette}-Color-${tones.text});
}`;
})()}

/* ══ App Bar ══ */
${(() => {
  const ac = appBarConfig;
  const tones = getAccessibleTones(appBarBg, ac.n, primaryLight);
  return `[data-theme="App-Bar"] {
  --Background: ${appBarBg};
  --Text: var(--Colors-${ac.palette}-Color-${tones.text});
  --Header: var(--Colors-${ac.palette}-Color-${tones.header});
  --Quiet: var(--Colors-${ac.palette}-Color-${tones.quiet});
  --Border: var(--Border-Surfaces-${ac.palette}-Color-${ac.n});
  --Buttons-Default-Button: transparent;
  --Buttons-Default-Text: var(--Colors-${ac.palette}-Color-${tones.text});
  --Buttons-Default-Border: var(--Border-Surfaces-${ac.palette}-Color-${ac.n});
}`;
})()}

/* ══ Default Theme ══ */
[data-theme="Default"] {
  --Surface: ${surfaceBg};
  --Surface-Dim: ${isDark ? '#111111' : '#f2f2f2'};
  --Text: ${surfaceText};
  --Header: ${surfaceHeader};
  --Quiet: ${surfaceQuiet};
  --Border: ${borderFor(surfaceBg)};
  --Border-Variant: ${borderFor(surfaceBg)};

  --Buttons-Primary-Button: ${btnBg};
  --Buttons-Primary-Text: ${btnText};
  --Buttons-Primary-Border: ${btnBorder};
  --Buttons-Default-Button: transparent;
  --Buttons-Default-Text: ${surfaceText};
  --Buttons-Default-Border: ${borderFor(surfaceBg)};

  --Container: ${containerBg};
  --Container-Low: ${containerBg};
  --Container-Lowest: ${containerBg};
  --Container-High: ${containerBg};
  --Container-Highest: ${containerBg};
  --Container-Text: ${containerText};
  --Container-Header: ${containerHeader};
  --Container-Quiet: ${containerQuiet};
  --Container-Border: ${borderFor(containerBg)};
  --Container-Buttons-Default-Text: ${defaultBtnText};
  --Container-Buttons-Default-Border: ${defaultBtnBorder};
}

/* ══ Container Surface ══ */
[data-surface="Container"] {
  --Background: var(--Container);
  --Text: var(--Container-Text);
  --Header: var(--Container-Header);
  --Quiet: var(--Container-Quiet);
  --Border-Variant: var(--Container-Border);
  --Buttons-Default-Text: var(--Container-Buttons-Default-Text);
  --Buttons-Default-Border: var(--Container-Buttons-Default-Border);
}

/* ══ Tertiary Theme ══ */
[data-theme="Tertiary"] {
  --Container: ${tertiaryContainerBg};
  --Container-Text: ${tertiaryText};
  --Container-Header: ${tertiaryHeader};
  --Container-Quiet: ${tertiaryQuiet};
  --Container-Border: ${borderFor(tertiaryContainerBg)};
  --Container-Buttons-Default-Text: ${tertiaryText};
  --Container-Buttons-Default-Border: ${borderFor(tertiaryContainerBg)};
  --Tag-Tertiary-BG: ${tagBg};
  --Tag-Tertiary-Text: ${tagText};
}

/* ══ Nav Bar ══ */
${(() => {
  const nc = navBarConfig;
  const tones = getAccessibleTones(navBarBg, nc.n, primaryLight);
  return `[data-theme="Nav-Bar"] {
  --Background: ${navBarBg};
  --Text: var(--Colors-${nc.palette}-Color-${tones.text});
  --Header: var(--Colors-${nc.palette}-Color-${tones.header});
  --Quiet: var(--Colors-${nc.palette}-Color-${tones.quiet});
  --Border: var(--Border-Surfaces-${nc.palette}-Color-${nc.n});
}`;
})()}

/* ══ Surface Resolution ══ */
[data-surface="Surface"]        { --Background: var(--Surface); }
[data-surface="Surface-Bright"] { --Background: var(--Surface-Bright); }
[data-surface="Surface-Dim"]    { --Background: var(--Surface-Dim); }

/* ══ Typography ══ */
${(() => {
  const header = input.typographyStyles?.find(t => t.type === 'header');
  const decorative = input.typographyStyles?.find(t => t.type === 'decorative');
  const body = input.typographyStyles?.find(t => t.type === 'body');
  if (!header && !body) return '';
  return `:root {
  --Set-Font-Family-Header: '${header?.family || 'sans-serif'}', serif;
  --Set-Font-Family-Header-Weight: ${header?.weight || '700'};
  --Set-Font-Family-Decorative: '${decorative?.family || header?.family || 'sans-serif'}', sans-serif;
  --Set-Font-Family-Body: '${body?.family || 'sans-serif'}', sans-serif;
  --Set-Font-Family-Body-Weight: ${body?.weight || '400'};
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
