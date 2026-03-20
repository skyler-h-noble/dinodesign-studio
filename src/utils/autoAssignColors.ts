import { toneToColorNumber, calculateOB } from './colorScale';
import type { SurfaceStyle, UserSelections, ColorScheme } from '../types';

/**
 * Auto-assign color selections based on:
 * 1. Surface style (light-tonal / grey-professional / dark-professional)
 * 2. Primary color lightness (PC) — light (>=9), medium (6-8), dark (<6)
 * 3. Color scheme type (monochromatic vs multi-color)
 */
export function autoAssignColors(
  surfaceStyle: SurfaceStyle,
  colorScheme: ColorScheme,
): UserSelections {
  const PC = toneToColorNumber(colorScheme.extractedTones.primary);
  const isLightPrimary = PC >= 9;
  const isMediumPrimary = PC >= 6 && PC < 9;
  const isDarkPrimary = PC < 6;
  const isMonochromatic = colorScheme.name?.toLowerCase() === 'monochromatic';

  let background: string;
  let backgroundTheme: 'Primary' | 'Neutral';
  let backgroundN: number;
  let defaultTheme: 'light' | 'dark';
  let appBar: string;
  let navBar: string;
  let status: string;
  let button: UserSelections['button'];
  let textColoring: UserSelections['textColoring'];
  let cardColoring: UserSelections['cardColoring'];
  const decorativeMode: UserSelections['decorativeMode'] = 'surface-components';

  // ── Dark Professional ──
  // Dark background, dark nav with subtle elevation, BW text, black cards
  if (surfaceStyle === 'dark-professional') {
    defaultTheme = 'dark';
    background = 'black';
    backgroundTheme = 'Neutral';
    backgroundN = 2;
    appBar = 'black';        // Neutral Surface-Bright (Color-3 in dark mode)
    navBar = 'black';        // Neutral Surface-Dim (Color-1 in dark mode)
    status = 'black';        // Neutral Surface-Bright
    button = 'primary';
    textColoring = 'black-white';
    cardColoring = 'black';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring, decorativeMode };
  }

  // ── Grey Professional ──
  // White background, dark nav for contrast, BW text, white cards
  if (surfaceStyle === 'grey-professional') {
    defaultTheme = 'light';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    background = 'white';
    appBar = 'black';        // Dark nav on light page
    navBar = 'black';        // Dark nav on light page
    status = 'black';        // Dark status
    button = 'primary';
    textColoring = 'black-white';
    cardColoring = 'white';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring, decorativeMode };
  }

  // ── Monochromatic ──
  // Primary throughout for cohesion
  if (isMonochromatic) {
    defaultTheme = 'light';
    background = 'primary-light';
    backgroundTheme = 'Primary';
    backgroundN = 11;
    appBar = 'primary-bright';
    status = 'primary-bright';
    navBar = 'primary-dim';
    button = 'laddered';
    textColoring = 'tonal';
    cardColoring = 'tonal';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring, decorativeMode };
  }

  // ── Light-Tonal — varies by primary lightness ──
  defaultTheme = 'light';

  if (isLightPrimary) {
    // Light primary (PC >= 9) — primary is light enough for background
    background = 'primary-light';
    backgroundTheme = 'Primary';
    backgroundN = 11;
    appBar = 'primary-light-bright';
    status = 'primary-light-bright';
    navBar = 'primary-light-dim';
    button = 'laddered';
    textColoring = 'tonal';
    cardColoring = 'tonal';

  } else if (isMediumPrimary) {
    // Medium primary (PC 6-8) — white bg lets colors breathe
    background = 'white';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    appBar = 'white';        // Neutral Surface-Bright
    status = 'white';        // Neutral Surface-Bright
    navBar = 'white';        // Neutral Surface-Dim
    button = 'laddered';
    textColoring = 'black-white';
    cardColoring = 'white';

  } else {
    // Dark primary (PC < 6) — white bg, primary nav accent
    background = 'white';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    appBar = 'primary-bright';
    status = 'primary-bright';
    navBar = 'primary-dim';
    button = 'primary';
    textColoring = 'tonal';
    cardColoring = 'tonal';
  }

  return {
    defaultTheme,
    background,
    backgroundTheme,
    backgroundN,
    appBar,
    navBar,
    status,
    button,
    cardColoring,
    textColoring,
    decorativeMode,
  };
}
