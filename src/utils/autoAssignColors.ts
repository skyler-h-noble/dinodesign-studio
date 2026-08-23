import { toneToColorNumber, calculateOB } from './colorScale';
import type { SurfaceStyle, UserSelections, ColorScheme } from '../types';

/**
 * Auto-assign color selections based on:
 * 1. Surface style (light-tonal / grey-professional / dark-professional)
 * 2. Primary color lightness (PC) — light (>=8), medium (5-7), dark (1-4)
 * 3. Color scheme type (monochromatic vs multi-color)
 */
export function autoAssignColors(
  surfaceStyle: SurfaceStyle,
  colorScheme: ColorScheme,
): UserSelections {
  const PC = toneToColorNumber(colorScheme.extractedTones.primary);
  const isLightPrimary = PC >= 8;
  const isMediumPrimary = PC >= 5 && PC < 8;
  const isDarkPrimary = PC < 5;
  const isMonochromatic = colorScheme.name?.toLowerCase() === 'monochromatic';

  // Typed from UserSelections rather than as bare `string`. The function
  // declares it returns UserSelections, whose appBar / navBar / status are
  // narrow unions — so widening the locals to `string` moved the mismatch from
  // the assignment, where the wrong value is written, to the return, where it
  // is already too late to say which one was wrong.
  let background: UserSelections['background'];
  let backgroundTheme: UserSelections['backgroundTheme'];
  let backgroundN: UserSelections['backgroundN'];
  let defaultTheme: UserSelections['defaultTheme'];
  let appBar: UserSelections['appBar'];
  let navBar: UserSelections['navBar'];
  let status: UserSelections['status'];
  let button: UserSelections['button'];
  let textColoring: UserSelections['textColoring'];
  let cardColoring: UserSelections['cardColoring'];
  const decorativeMode: UserSelections['decorativeMode'] = 'surface-components';

  // ── Dark Professional ──
  // Dark background, black nav with surface variants, BW text, black cards
  if (surfaceStyle === 'dark-professional') {
    defaultTheme = 'dark';
    background = 'black';
    backgroundTheme = 'Neutral';
    backgroundN = 2;
    appBar = 'black';        // Black Surface-Bright
    navBar = 'black';        // Black Surface-Dim
    status = 'black';        // Black Surface-Bright
    button = 'primary';
    textColoring = 'black-white';
    cardColoring = 'black';
    return { defaultTheme, background, backgroundTheme, backgroundN, appBar, navBar, status, button, cardColoring, textColoring, decorativeMode };
  }

  // ── Grey Professional ──
  // White background, primary nav, BW text, white cards
  if (surfaceStyle === 'grey-professional') {
    defaultTheme = 'light';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    background = 'white';
    appBar = 'primary';
    navBar = 'primary';
    status = 'primary';
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
    appBar = 'primary';
    status = 'primary';
    navBar = 'primary';
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
    appBar = 'primary-light';
    status = 'primary-light';
    navBar = 'primary-light';
    button = 'laddered';
    textColoring = 'tonal';
    cardColoring = 'tonal';

  } else if (isMediumPrimary) {
    // Medium primary (PC 7-10) — white bg, primary nav accent
    background = 'white';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    appBar = 'primary';
    status = 'primary';
    navBar = 'primary';
    button = 'laddered';
    textColoring = 'black-white';
    cardColoring = 'white';

  } else {
    // Dark primary (PC < 6) — white bg, primary nav accent
    background = 'white';
    backgroundTheme = 'Neutral';
    backgroundN = 12;
    appBar = 'primary';
    status = 'primary';
    navBar = 'primary';
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
