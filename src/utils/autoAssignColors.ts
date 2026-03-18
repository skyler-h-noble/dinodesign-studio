import { toneToColorNumber, calculateOB } from './colorScale';
import type { SurfaceStyle, UserSelections, ColorScheme } from '../types';

/**
 * Auto-assign color selections based on:
 * 1. Surface style (light-tonal / grey-professional / dark-professional)
 * 2. Primary color lightness (PC) — light (>=11), medium (7-10), dark (<7)
 * 3. Color scheme type (monochromatic vs multi-color)
 *
 * Follows COLOR_ASSIGNMENT_LOGIC.md
 */
export function autoAssignColors(
  surfaceStyle: SurfaceStyle,
  colorScheme: ColorScheme,
): UserSelections {
  const PC = toneToColorNumber(colorScheme.extractedTones.primary);
  const isLightPrimary = PC >= 11;
  const isMediumPrimary = PC >= 7 && PC < 11;
  const isDarkPrimary = PC < 7;
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

  // ── Dark professional mood board ──
  if (surfaceStyle === 'dark-professional') {
    defaultTheme = 'dark';
    background = 'black';
    backgroundTheme = 'Neutral';
    backgroundN = 2;
    appBar = 'black';
    navBar = 'black';
    status = 'black';
    button = 'primary';
    textColoring = 'tonal'; // dark mode is always tonal
    cardColoring = 'tonal';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring };
  }

  // ── Grey professional mood board ──
  if (surfaceStyle === 'grey-professional') {
    defaultTheme = 'light';
    backgroundTheme = 'Neutral';
    backgroundN = 14;
    background = 'white';
    appBar = 'white';
    navBar = 'white';
    status = 'white';
    button = 'primary';
    textColoring = 'black-white';
    cardColoring = 'white';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring };
  }

  // ── Light-tonal mood board — varies by primary lightness ──
  defaultTheme = 'light';
  textColoring = 'tonal';
  cardColoring = 'tonal';

  if (isLightPrimary) {
    // Light primary (PC >= 11) — primary is very light, use it as background
    background = 'primary-light';
    backgroundTheme = 'Primary';
    backgroundN = 12;
    appBar = 'primary-light';
    status = 'primary-light';
    navBar = 'white';
    button = 'primary';

  } else if (isMediumPrimary) {
    // Medium primary (PC 7-10) — primary has good weight
    if (isMonochromatic) {
      // Monochromatic: use primary throughout for cohesion
      background = 'primary-light';
      backgroundTheme = 'Primary';
      backgroundN = 13;
      appBar = 'primary';
      status = 'primary';
      navBar = 'primary-light';
      button = 'primary';
    } else {
      // Multi-color: white bg lets colors breathe
      background = 'white';
      backgroundTheme = 'Neutral';
      backgroundN = 14;
      appBar = 'primary';
      status = 'primary';
      navBar = 'white';
      button = 'laddered';
    }

  } else {
    // Dark primary (PC < 7) — primary is dark/rich
    if (isMonochromatic) {
      // Monochromatic dark: use primary for nav, light bg
      background = 'white';
      backgroundTheme = 'Neutral';
      backgroundN = 14;
      appBar = 'primary';
      status = 'primary';
      navBar = 'primary';
      button = 'primary';
    } else {
      // Multi-color dark: white bg, primary nav accent
      background = 'white';
      backgroundTheme = 'Neutral';
      backgroundN = 14;
      appBar = 'primary';
      status = 'primary';
      navBar = 'white';
      button = 'laddered';
    }
    // Dark primary with tonal text can be hard to read — use BW
    textColoring = 'black-white';
    cardColoring = 'white';
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
  };
}
