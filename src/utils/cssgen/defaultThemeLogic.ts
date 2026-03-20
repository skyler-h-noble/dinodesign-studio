/**
 * Default Theme Logic
 * Determines default theme settings based on Primary Color tone, surface style, and scheme type
 */
import { toneToColorNumber } from '../colorScale';

export interface DefaultThemeSettings {
  // Default Theme
  defaultThemeName: string;
  defaultTheme: string;
  defaultN: number;
  
  // Navigation
  appBar: string;
  appBarTheme: string;
  appBarN: number;
  
  navBar: string;
  navBarTheme: string;
  navBarN: number;
  
  status: string;
  statusTheme: string;
  statusN: number;
  
  // Button defaults
  buttonDefault: string;
  buttonDefaultN: number;
  
  // Card Coloring defaults
  containerTheme: string;
  containerN: number;
  containerShade: 'Light' | 'Medium'; // CShade - Button shade for Containers
  
  // Text Coloring defaults
  textColoringMode: 'tonal' | 'black-white';
}

export type SurfaceStyle = 'light-tonal' | 'grey-professional' | 'dark-professional';
export type ColorSchemeType = 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic';

/**
 * Calculate default theme settings based on Primary Color tone and surface style
 * If userSelections are provided, they take precedence over calculated defaults
 */
export function calculateDefaultThemeSettings(
  primaryColorTone: number, // PC - HCT tone value (0-100) of the Primary color
  secondaryColorTone: number, // SC - HCT tone value (0-100) of the Secondary color
  surfaceStyle: SurfaceStyle,
  schemeType: ColorSchemeType,
  buttonStyle?: 'primary-adaptive' | 'primary-fixed' | 'black-white',
  userSelections?: {
    defaultTheme?: 'light' | 'dark';
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    appBar?: 'surface' | 'surface-dim' | 'surface-bright' | 'black' | 'white';
    navBar?: 'surface' | 'surface-dim' | 'surface-bright' | 'black' | 'white';
    status?: 'surface' | 'surface-dim' | 'surface-bright' | 'black' | 'white';
    button?: 'primary-adaptive' | 'primary-fixed' | 'black-white';
    cardsText?: 'tonal' | 'professional';
    cardColoring?: 'tonal' | 'white' | 'black';
    textColoring?: 'tonal' | 'black-white';
  }
): DefaultThemeSettings {
  
  // Convert HCT tone (0-100) to Color-N (1-12)
  const toneToColorN = (tone: number): number => {
    const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];

    // Find the closest tone in the scale
    let closestIndex = 0;
    let minDiff = Math.abs(tone - toneScale[0]);

    for (let i = 1; i < toneScale.length; i++) {
      const diff = Math.abs(tone - toneScale[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex + 1; // Color-N is 1-indexed
  };

  // Convert tone values to Color-N at the start
  const primaryColorN = toneToColorN(primaryColorTone);
  const secondaryColorN = toneToColorN(secondaryColorTone);
  
  console.log('🎨 [calculateDefaultThemeSettings] Input tones:', primaryColorTone, secondaryColorTone);
  console.log('🎨 [calculateDefaultThemeSettings] Converted to Color-N:', primaryColorN, secondaryColorN);
  
  // Special case: Monochromatic
  if (schemeType === 'monochromatic') {
    return {
      defaultThemeName: 'Default',
      defaultTheme: 'Primary',
      defaultN: 11,

      appBar: 'Primary',
      appBarTheme: 'Primary',
      appBarN: primaryColorN,

      navBar: 'Primary',
      navBarTheme: 'Primary',
      navBarN: primaryColorN,

      status: 'Primary',
      statusTheme: 'Primary',
      statusN: primaryColorN,

      buttonDefault: 'Laddered', // Laddered, Fixed per spec
      buttonDefaultN: primaryColorN, // Use PC

      containerTheme: 'Primary',
      containerN: 11,
      containerShade: 'Light',

      textColoringMode: 'tonal'
    };
  }
  
  // dark-professional: Black backgrounds, Primary buttons, Black cards
  if (surfaceStyle === 'dark-professional') {
    return {
      defaultThemeName: 'Default',
      defaultTheme: 'Neutral',
      defaultN: 1,

      appBar: 'Black',
      appBarTheme: 'Neutral',
      appBarN: 1,

      navBar: 'Black',
      navBarTheme: 'Neutral',
      navBarN: 1,

      status: 'Black',
      statusTheme: 'Neutral',
      statusN: 1,

      buttonDefault: 'Primary',
      buttonDefaultN: primaryColorN,

      containerTheme: 'Neutral',
      containerN: 3, // Black cards — surface is 2, container is 3
      containerShade: 'Light',

      textColoringMode: 'black-white'
    };
  }

  // grey-professional: Black nav elements, Neutral backgrounds, Primary buttons
  if (surfaceStyle === 'grey-professional') {
    return {
      defaultThemeName: 'Default',
      defaultTheme: 'Neutral',
      defaultN: 12,

      appBar: 'Black',
      appBarTheme: 'Neutral',
      appBarN: 1,

      navBar: 'Black',
      navBarTheme: 'Neutral',
      navBarN: 1,

      status: 'Black',
      statusTheme: 'Neutral',
      statusN: 1,

      buttonDefault: 'Primary',
      buttonDefaultN: primaryColorN,

      containerTheme: 'Neutral',
      containerN: 12,
      containerShade: 'Light',

      textColoringMode: 'black-white'
    };
  }
  
  // light-tonal (default): Logic based on Primary Color tone
  
  // Dark Primary (PC <= 5)
  if (primaryColorN <= 5) {
    return {
      defaultThemeName: 'Default',
      defaultTheme: 'Primary',
      defaultN: 11,

      appBar: 'Primary',
      appBarTheme: 'Primary',
      appBarN: primaryColorN,

      navBar: 'Primary',
      navBarTheme: 'Primary',
      navBarN: primaryColorN,

      status: 'Primary',
      statusTheme: 'Primary',
      statusN: primaryColorN,

      buttonDefault: 'Laddered',
      buttonDefaultN: primaryColorN,

      containerTheme: 'Neutral',
      containerN: 12,
      containerShade: 'Light',

      textColoringMode: 'tonal'
    };
  }

  // Bright Primary (PC > 5 and < 9)
  if (primaryColorN > 5 && primaryColorN < 9) {
    return {
      defaultThemeName: 'Default',
      defaultTheme: 'Neutral',
      defaultN: 12,

      appBar: 'Primary',
      appBarTheme: 'Primary',
      appBarN: primaryColorN,

      navBar: 'Primary',
      navBarTheme: 'Primary',
      navBarN: primaryColorN,

      status: 'Black',
      statusTheme: 'Neutral',
      statusN: 1,

      buttonDefault: 'Secondary',
      buttonDefaultN: secondaryColorN,

      containerTheme: 'Neutral',
      containerN: 12,
      containerShade: 'Light',

      textColoringMode: 'black-white'
    };
  }

  // Light Primary (PC >= 9)
  return {
    defaultThemeName: 'Default',
    defaultTheme: 'Primary',
    defaultN: 11,

    appBar: 'Primary',
    appBarTheme: 'Primary',
    appBarN: primaryColorN,

    navBar: 'Primary',
    navBarTheme: 'Primary',
    navBarN: primaryColorN,

    status: 'Primary',
    statusTheme: 'Primary',
    statusN: primaryColorN,

    buttonDefault: 'Laddered',
    buttonDefaultN: primaryColorN,

    containerTheme: 'Primary',
    containerN: 11,
    containerShade: 'Light',

    textColoringMode: 'tonal'
  };
}

/**
 * Helper function to map user selection strings to theme and N values
 */
function mapSelectionToThemeAndN(selection: string, primaryColorTone: number): { theme: string; n: number } {
  // Convert HCT tone (0-100) to Color-N (1-12)
  const toneToColorN = (tone: number): number => {
    const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];

    // Find the closest tone in the scale
    let closestIndex = 0;
    let minDiff = Math.abs(tone - toneScale[0]);

    for (let i = 1; i < toneScale.length; i++) {
      const diff = Math.abs(tone - toneScale[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex + 1; // Color-N is 1-indexed
  };

  const primaryColorN = toneToColorN(primaryColorTone);

  const mapping: Record<string, { theme: string; n: number }> = {
    'white': { theme: 'Neutral', n: 12 },
    'black': { theme: 'Neutral', n: 1 },
    'primary': { theme: 'Primary', n: primaryColorN },
    'primary-light': { theme: 'Primary', n: 11 },
    'primary-medium': { theme: 'Primary', n: 6 },
    'primary-dark': { theme: 'Primary', n: 3 }
  };
  return mapping[selection] || { theme: 'Primary', n: primaryColorN };
}

/**
 * Map nav selection to theme and N, with surface-relative options
 */
function mapNavSelectionToThemeAndN(
  selection: string,
  surfaceTheme: string,
  surfaceN: number,
  primaryColorTone: number,
  navKey: string = 'appBar',
): { theme: string; n: number } {
  const isNavBar = navKey === 'navBar';
  switch (selection) {
    case 'white': return { theme: 'Neutral', n: 12 };
    case 'black': return { theme: 'Neutral', n: 1 };
    case 'primary-light': return { theme: 'Primary', n: 11 };
    case 'primary-light-bright': return { theme: 'Primary', n: 12 };
    case 'primary-light-dim': return { theme: 'Primary', n: 10 };
    case 'primary': { const pcN = toneToColorNumber(primaryColorTone); return { theme: 'Primary', n: pcN }; }
    case 'primary-bright': { const pcN = toneToColorNumber(primaryColorTone); return { theme: 'Primary', n: Math.min(pcN + 1, 12) }; }
    case 'primary-dim': { const pcN = toneToColorNumber(primaryColorTone); return { theme: 'Primary', n: Math.max(pcN - 1, 1) }; }
    default: return mapSelectionToThemeAndN(selection, primaryColorTone);
  }
}

/**
 * Apply user selections from UI to override calculated defaults
 */
export function applyUserSelections(
  defaults: DefaultThemeSettings,
  userSelections: {
    defaultTheme?: 'light' | 'dark';
    background?: string;
    backgroundTheme?: 'Primary' | 'Neutral';
    backgroundN?: number;
    appBar?: string;
    navBar?: string;
    status?: string;
    button?: string;
    cardsText?: string; // Legacy - for backwards compatibility
    cardColoring?: 'tonal' | 'white' | 'black';
    textColoring?: 'tonal' | 'black-white';
  },
  primaryColorTone: number,
  secondaryColorTone: number
): DefaultThemeSettings {
  const updated = { ...defaults };

  console.log('🟢 [applyUserSelections] Called with userSelections:', userSelections);
  console.log('🟢 [applyUserSelections] defaults before update:', { defaultTheme: defaults.defaultTheme, defaultN: defaults.defaultN });

  // Apply Default Theme (background) if selected
  // PRIORITY: Use backgroundTheme/backgroundN if they exist (new direct mapping)
  if (userSelections.backgroundTheme && userSelections.backgroundN !== undefined) {
    console.log('✅ Using direct backgroundTheme/backgroundN:', userSelections.backgroundTheme, userSelections.backgroundN);
    updated.defaultTheme = userSelections.backgroundTheme;
    updated.defaultN = userSelections.backgroundN;
    updated.defaultThemeName = userSelections.defaultTheme || 'light';
  } else if (userSelections.background) {
    // FALLBACK: Use old string-based mapping for backwards compatibility
    console.log('⚠️ Using fallback background string mapping:', userSelections.background);
    const { theme, n } = mapSelectionToThemeAndN(userSelections.background, primaryColorTone);
    console.log('  Mapped to:', theme, n);
    updated.defaultTheme = theme;
    updated.defaultN = n;
    updated.defaultThemeName = userSelections.defaultTheme || 'light';
  }
  
  console.log('🟢 [applyUserSelections] defaults after update:', { defaultTheme: updated.defaultTheme, defaultN: updated.defaultN });

  // Apply App Bar if selected
  if (userSelections.appBar) {
    const { theme, n } = mapNavSelectionToThemeAndN(userSelections.appBar, updated.defaultTheme, updated.defaultN, primaryColorTone, 'appBar');
    updated.appBar = getSelectionName(theme, n);
    updated.appBarTheme = theme;
    updated.appBarN = n;
  }

  // Apply Nav Bar if selected
  if (userSelections.navBar) {
    const { theme, n } = mapNavSelectionToThemeAndN(userSelections.navBar, updated.defaultTheme, updated.defaultN, primaryColorTone, 'navBar');
    updated.navBar = getSelectionName(theme, n);
    updated.navBarTheme = theme;
    updated.navBarN = n;
  }

  // Apply Status Bar if selected
  if (userSelections.status) {
    const { theme, n } = mapNavSelectionToThemeAndN(userSelections.status, updated.defaultTheme, updated.defaultN, primaryColorTone, 'status');
    updated.status = getSelectionName(theme, n);
    updated.statusTheme = theme;
    updated.statusN = n;
  }

  // Apply Button default if selected
  // Logic from specification:
  // - Primary Fixed: Default = "Primary", Default-N = {PC}
  // - Primary Adaptive: Default = "Primary", Default-N = {N} (background N)
  // - Secondary Fixed: Default = "Secondary", Default-N = {SC}
  // - Secondary Adaptive: Default = "Secondary", Default-N = {N}
  // - Tonal Fixed: Default = {Theme}, Default-N = {PC}
  // - Tonal Adaptive: Default = {Theme}, Default-N = {N}
  // - Black/White: Default = "BW", Default-N = {N}
  if (userSelections.button) {
    const buttonType = userSelections.button;
    
    if (buttonType === 'primary' || buttonType.includes('primary')) {
      // Primary buttons
      updated.buttonDefault = 'Primary';
      if (buttonType.includes('fixed')) {
        updated.buttonDefaultN = primaryColorTone; // PC
      } else {
        updated.buttonDefaultN = updated.defaultN; // Adaptive uses background N
      }
    } else if (buttonType === 'secondary' || buttonType.includes('secondary')) {
      // Secondary buttons
      updated.buttonDefault = 'Secondary';
      if (buttonType.includes('fixed')) {
        updated.buttonDefaultN = secondaryColorTone; // SC
      } else {
        updated.buttonDefaultN = updated.defaultN; // Adaptive uses background N
      }
    } else if (buttonType === 'tonal' || buttonType.includes('tonal')) {
      // Tonal buttons use the background theme
      updated.buttonDefault = updated.defaultTheme; // Uses background theme
      if (buttonType.includes('fixed')) {
        updated.buttonDefaultN = primaryColorTone; // PC for fixed
      } else {
        updated.buttonDefaultN = updated.defaultN; // Adaptive uses background N
      }
    } else if (buttonType === 'black-white') {
      // Black/White buttons
      updated.buttonDefault = 'BW';
      updated.buttonDefaultN = updated.defaultN; // Uses background N
    }
  }

  // Apply Card Coloring (container) if selected
  // Logic from specification:
  // - Tonal: ContTheme = {Theme}, ContN = {N} (uses background theme and N)
  // - White: ContTheme = \"Neutral\", ContN = \"14\"
  // - Black: ContTheme = \"Neutral\", ContN = \"1\"
  if (userSelections.cardColoring) {
    if (userSelections.cardColoring === 'tonal') {
      // Tonal uses the background theme and N
      updated.containerTheme = updated.defaultTheme;
      updated.containerN = updated.defaultN;
      updated.containerShade = 'Light';
    } else if (userSelections.cardColoring === 'white') {
      // White uses Neutral 12 (White background for containers)
      updated.containerTheme = 'Neutral';
      updated.containerN = 12;
      updated.containerShade = 'Light';
    } else if (userSelections.cardColoring === 'black') {
      // Black uses Neutral 3 (dark container on dark surface 2)
      updated.containerTheme = 'Neutral';
      updated.containerN = 3;
      updated.containerShade = 'Light';
    }
  } else if (userSelections.cardsText) {
    // Legacy support for backwards compatibility
    if (userSelections.cardsText === 'tonal' || userSelections.cardsText === 'default') {
      updated.containerTheme = updated.defaultTheme;
      updated.containerN = updated.defaultN;
      updated.containerShade = 'Light';
    } else if (userSelections.cardsText === 'professional' || userSelections.cardsText === 'primary') {
      updated.containerTheme = 'Neutral';
      updated.containerN = 12;
      updated.containerShade = 'Light';
    } else if (userSelections.cardsText === 'black') {
      // Black uses Neutral 3 (dark container on dark surface 2)
      updated.containerTheme = 'Neutral';
      updated.containerN = 3;
      updated.containerShade = 'Light';
    }
  }

  // Apply Text Coloring if selected
  // - Tonal: Text colors match their respective theme colors
  // - Black/White: All text uses BW color
  if (userSelections.textColoring) {
    updated.textColoringMode = userSelections.textColoring;
  }

  return updated;
}

/**
 * Get the selection name based on theme and tone
 */
export function getSelectionName(theme: string, n: number): string {
  if (theme === 'Neutral' && n === 12) return 'White';
  if (theme === 'Neutral' && n === 1) return 'Black';
  if (theme === 'Primary' && n === 11) return 'Primary-Light';
  if (theme === 'Primary' && n === 6) return 'Primary-Medium';
  if (theme === 'Primary' && n === 3) return 'Primary-Dark';
  return 'Primary'; // Default to Primary if it's the primary color tone
}