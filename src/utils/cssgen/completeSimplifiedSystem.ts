/**
 * Complete Simplified System Generator
 * Generates Themes, Default-Button, Buttons, and Tag sections based on the simplified specification
 */

import { generateBaseButtons, generateDefaultButton } from './generateButtonsSimplified';
import { generateAllThemesWithSurfacesAndContainers } from './generateCompleteThemes';
import { generateLightModeTags, generateDarkModeTags } from './generateTagsSimplified';

/**
 * Helper to detect surface style based on extracted colors
 */
export function detectSurfaceStyle(
  extractedTones: { primary: number; secondary: number; tertiary: number }
): 'light-tonal' | 'grey-professional' | 'dark-professional' {
  const PC = Math.round(extractedTones.primary);
  const SC = Math.round(extractedTones.secondary);
  const TC = Math.round(extractedTones.tertiary);
  
  // Check for grey-professional (all colors are low chroma/neutral)
  // This is a simplified check - in production you'd check actual chroma values
  if (PC >= 10 && PC <= 12 && SC >= 10 && SC <= 12 && TC >= 10 && TC <= 12) {
    return 'grey-professional';
  }
  
  // Check for dark-professional (all tones are dark)
  if (PC <= 4 && SC <= 4 && TC <= 4) {
    return 'dark-professional';
  }
  
  // Default to light-tonal
  return 'light-tonal';
}

/**
 * Helper to convert tone value to Color-N number (1-14)
 */
export function toneToColorNumber(tone: number): number {
  const toneScale = [1, 10, 19, 28, 37, 46.6, 53, 62, 71, 81, 90, 95, 98, 99];
  
  // Find exact match
  const exactIndex = toneScale.findIndex(t => Math.abs(t - tone) < 0.5);
  if (exactIndex !== -1) {
    return exactIndex + 1;
  }
  
  // Find closest match
  let closestIndex = 0;
  let minDiff = Math.abs(toneScale[0] - tone);
  
  for (let i = 1; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - tone);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex + 1;
}

/**
 * Default configuration interface
 */
export interface SimplifiedDefaultConfig {
  // Background/Surface themes
  defaultTheme: string; // Primary, Secondary, Tertiary, Neutral
  defaultN: number; // 1-14
  appBarTheme: string;
  appBarN: number;
  navBarTheme: string;
  navBarN: number;
  statusTheme: string;
  statusN: number;
  
  // Container configuration
  containerTheme: string;
  containerN: number;
  containerShade: 'Light' | 'Medium'; // CShade for buttons in containers
  
  // Button configuration
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
  
  // Text coloring
  textColoring: 'tonal' | 'black-white';
}

/**
 * Get simplified default settings based on Primary Color tone and surface style
 */
export function getSimplifiedDefaultSettings(
  extractedTones: { primary: number; secondary: number; tertiary: number },
  surfaceStyle: 'light-tonal' | 'grey-professional' | 'dark-professional',
  schemeType: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic',
  userSelections?: {
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-base' | 'primary-dark' | 'neutral-light' | 'neutral-dark'; // CRITICAL FIX: Added neutral-light and neutral-dark
    appBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    navBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    status?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    button?: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
    textColoring?: 'tonal' | 'black-white';
    cardColoring?: 'tonal' | 'white' | 'black';
  }
): SimplifiedDefaultConfig {
  const PC = toneToColorNumber(extractedTones.primary);
  
  // Initialize with defaults
  const config: SimplifiedDefaultConfig = {
    defaultTheme: 'Primary',
    defaultN: 13,
    appBarTheme: 'Primary',
    appBarN: PC,
    navBarTheme: 'Primary',
    navBarN: PC,
    statusTheme: 'Primary',
    statusN: PC,
    containerTheme: 'Neutral',
    containerN: 14,
    containerShade: 'Light',
    buttonMode: 'laddered',
    textColoring: 'tonal'
  };
  
  // Apply surface style defaults
  if (surfaceStyle === 'grey-professional') {
    // Grey Professional
    config.defaultTheme = 'Neutral';
    config.defaultN = 14;
    config.appBarTheme = 'Neutral';
    config.appBarN = 1;
    config.navBarTheme = 'Neutral';
    config.navBarN = 1;
    config.statusTheme = 'Neutral';
    config.statusN = 1;
    config.containerTheme = 'Neutral';
    config.containerN = 14;
    config.buttonMode = 'primary';
    config.textColoring = 'black-white';
  } else if (surfaceStyle === 'dark-professional') {
    // Dark Professional
    config.defaultTheme = 'Neutral';
    config.defaultN = 1;
    config.appBarTheme = 'Neutral';
    config.appBarN = 1;
    config.navBarTheme = 'Neutral';
    config.navBarN = 1;
    config.statusTheme = 'Neutral';
    config.statusN = 1;
    config.containerTheme = 'Neutral';
    config.containerN = 1;
    config.buttonMode = 'primary';
    config.textColoring = 'black-white';
  } else if (schemeType === 'monochromatic') {
    // Monochromatic
    config.defaultTheme = 'Primary';
    config.defaultN = 13;
    config.appBarTheme = 'Primary';
    config.appBarN = PC;
    config.navBarTheme = 'Primary';
    config.navBarN = PC;
    config.statusTheme = 'Primary';
    config.statusN = PC;
    config.containerTheme = 'Primary';
    config.containerN = 13;
    config.buttonMode = 'primary';
    config.textColoring = 'tonal';
  } else {
    // Light-tonal with PC-based logic
    if (PC <= 6) {
      // Dark Primary
      config.defaultTheme = 'Primary';
      config.defaultN = 13;
      config.containerTheme = 'Neutral';
      config.containerN = 14;
      config.buttonMode = 'laddered';
      config.textColoring = 'tonal';
      config.statusTheme = 'Primary';
      config.statusN = PC;
    } else if (PC > 6 && PC < 11) {
      // Bright Primary
      config.defaultTheme = 'Neutral';
      config.defaultN = 14;
      config.containerTheme = 'Neutral';
      config.containerN = 14;
      config.buttonMode = 'secondary';
      config.textColoring = 'black-white';
      config.statusTheme = 'Neutral';
      config.statusN = 1;
    } else {
      // Light Primary (PC >= 11)
      config.defaultTheme = 'Primary';
      config.defaultN = 13;
      config.containerTheme = 'Primary';
      config.containerN = 13;
      config.buttonMode = 'laddered';
      config.textColoring = 'tonal';
      config.statusTheme = 'Primary';
      config.statusN = PC;
    }
  }
  
  // Apply user selections (override defaults)
  if (userSelections) {
    // Background selection
    if (userSelections.background) {
      switch (userSelections.background) {
        case 'white':
          config.defaultTheme = 'Neutral';
          config.defaultN = 14;
          break;
        case 'primary':
          config.defaultTheme = 'Primary';
          config.defaultN = PC;
          break;
        case 'black':
          config.defaultTheme = 'Neutral';
          config.defaultN = 1;
          break;
        case 'primary-light':
          config.defaultTheme = 'Primary';
          config.defaultN = 13;
          break;
        case 'primary-base':
          config.defaultTheme = 'Primary';
          config.defaultN = PC; // CRITICAL FIX: Use PC instead of hardcoded 6
          break;
        case 'primary-dark':
          config.defaultTheme = 'Primary';
          config.defaultN = 3;
          break;
        case 'neutral-light':
          config.defaultTheme = 'Neutral';
          config.defaultN = 14;
          break;
        case 'neutral-dark':
          config.defaultTheme = 'Neutral';
          config.defaultN = 1;
          break;
      }
    }
    
    // App Bar selection
    if (userSelections.appBar) {
      switch (userSelections.appBar) {
        case 'white':
          config.appBarTheme = 'Neutral';
          config.appBarN = 14;
          break;
        case 'black':
          config.appBarTheme = 'Neutral';
          config.appBarN = 1;
          break;
        case 'primary':
          config.appBarTheme = 'Primary';
          config.appBarN = PC;
          break;
        case 'primary-light':
          config.appBarTheme = 'Primary';
          config.appBarN = 13;
          break;
        case 'primary-medium':
          config.appBarTheme = 'Primary';
          config.appBarN = 6;
          break;
        case 'primary-dark':
          config.appBarTheme = 'Neutral'; // Changed to Dark in spec
          config.appBarN = 3;
          break;
      }
    }
    
    // Nav Bar selection
    if (userSelections.navBar) {
      switch (userSelections.navBar) {
        case 'white':
          config.navBarTheme = 'Neutral';
          config.navBarN = 14;
          break;
        case 'black':
          config.navBarTheme = 'Neutral';
          config.navBarN = 1;
          break;
        case 'primary':
          config.navBarTheme = 'Primary';
          config.navBarN = PC;
          break;
        case 'primary-light':
          config.navBarTheme = 'Primary';
          config.navBarN = 13;
          break;
        case 'primary-medium':
          config.navBarTheme = 'Primary';
          config.navBarN = 6;
          break;
        case 'primary-dark':
          config.navBarTheme = 'Primary';
          config.navBarN = 3;
          break;
      }
    }
    
    // Status selection
    if (userSelections.status) {
      switch (userSelections.status) {
        case 'white':
          config.statusTheme = 'Neutral';
          config.statusN = 14;
          break;
        case 'black':
          config.statusTheme = 'Neutral';
          config.statusN = 1;
          break;
        case 'primary':
          config.statusTheme = 'Primary';
          config.statusN = PC;
          break;
        case 'primary-light':
          config.statusTheme = 'Primary';
          config.statusN = 13;
          break;
        case 'primary-medium':
          config.statusTheme = 'Primary';
          config.statusN = 6;
          break;
        case 'primary-dark':
          config.statusTheme = 'Primary';
          config.statusN = 3;
          break;
      }
    }
    
    // Button mode
    if (userSelections.button) {
      // Extract button type from values like "primary-fixed", "secondary-adaptive", etc.
      const buttonType = userSelections.button.replace(/-fixed|-adaptive/g, '') as 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
      
      switch (buttonType) {
        case 'primary':
          config.buttonMode = 'primary';
          break;
        case 'secondary':
          config.buttonMode = 'secondary';
          break;
        case 'tonal':
          config.buttonMode = 'tonal';
          break;
        case 'laddered':
          config.buttonMode = 'laddered';
          break;
        case 'black-white':
          config.buttonMode = 'black-white';
          break;
      }
    }
    
    // Text coloring
    if (userSelections.textColoring) {
      config.textColoring = userSelections.textColoring;
    }
    
    // Card coloring (Container configuration)
    if (userSelections.cardColoring) {
      console.log('🎴 [getSimplifiedDefaultSettings] Card Coloring Selection:', userSelections.cardColoring);
      console.log('   Current defaultTheme:', config.defaultTheme, 'defaultN:', config.defaultN);
      
      if (userSelections.cardColoring === 'tonal') {
        // Tonal Cards: ContTheme = {Theme}, ContN = {N}, CShade based on ContN
        // Use the current background theme and N values
        config.containerTheme = config.defaultTheme;
        config.containerN = config.defaultN;
        config.containerShade = config.defaultN >= 11 ? 'Medium' : 'Light';
        console.log('   ✅ TONAL: ContTheme =', config.containerTheme, 'ContN =', config.containerN, 'CShade =', config.containerShade);
      } else if (userSelections.cardColoring === 'white') {
        // White Cards: ContTheme = Neutral, ContN = 14, CShade = Medium (14 >= 11)
        config.containerTheme = 'Neutral';
        config.containerN = 14;
        config.containerShade = 'Medium'; // 14 >= 11
        console.log('   ✅ WHITE: ContTheme = Neutral, ContN = 14, CShade = Medium');
      } else if (userSelections.cardColoring === 'black') {
        // Black Cards: ContTheme = Neutral, ContN = 1, CShade = Light (1 < 11)
        config.containerTheme = 'Neutral';
        config.containerN = 1;
        config.containerShade = 'Light'; // 1 < 11
        console.log('   ✅ BLACK: ContTheme = Neutral, ContN = 1, CShade = Light');
      }
    }
  }
  
  return config;
}

/**
 * Generate Tag section based on OB value
 */
function generateTagSection(mode: 'Light-Mode' | 'Dark-Mode', OB: number): any {
  // Generate BOTH Light and Medium shades
  // Light uses Color-9 (always vibrant/saturated)
  // Medium uses OB value (based on Primary color tone)
  
  return {
    Light: {
      Primary: {
        BG: { value: `{Color-Palettes.Primary.Color-9}`, type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.Primary.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Secondary: {
        BG: { value: `{Color-Palettes.Secondary.Color-9}`, type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.Secondary.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: `{Color-Palettes.Tertiary.Color-9}`, type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.Tertiary.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Neutral: {
        BG: { value: `{Color-Palettes.Neutral.Color-9}`, type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.Neutral.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Info: {
        BG: { value: `{Color-Palettes.Info.Color-9}`, type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.Info.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Success: {
        BG: { value: `{Color-Palettes.Success.Color-9}`, type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.Success.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Warning: {
        BG: { value: `{Color-Palettes.Warning.Color-9}`, type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.Warning.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      },
      Error: {
        BG: { value: `{Color-Palettes.Error.Color-9}`, type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.Error.Color-9}`, type: 'color' },
          BW: { value: '{Color-Scale.White}', type: 'color' }
        }
      }
    },
    Medium: {
      Primary: {
        BG: { value: `{Color-Palettes.Primary.Color-${OB}}`, type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.Primary.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Secondary: {
        BG: { value: `{Color-Palettes.Secondary.Color-${OB}}`, type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.Secondary.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: `{Color-Palettes.Tertiary.Color-${OB}}`, type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.Tertiary.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Neutral: {
        BG: { value: `{Color-Palettes.Neutral.Color-${OB}}`, type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.Neutral.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Info: {
        BG: { value: `{Color-Palettes.Info.Color-${OB}}`, type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.Info.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Success: {
        BG: { value: `{Color-Palettes.Success.Color-${OB}}`, type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.Success.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Warning: {
        BG: { value: `{Color-Palettes.Warning.Color-${OB}}`, type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.Warning.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      },
      Error: {
        BG: { value: `{Color-Palettes.Error.Color-${OB}}`, type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.Error.Color-${OB}}`, type: 'color' },
          BW: { value: OB >= 11 ? '{Color-Scale.Black}' : '{Color-Scale.White}', type: 'color' }
        }
      }
    }
  };
}

/**
 * Generate Default-Button-Borders section
 * Light Mode: Uses color-specific borders (Color-8, Color-7, etc.)
 * Dark Mode: Uses White for Color 1-6, Neutral Color-1 for Color 7-14 and Vibrant
 */
function generateDefaultButtonBorders(mode: 'Light-Mode' | 'Dark-Mode'): any {
  const borders: any = {
    Surfaces: {},
    Containers: {}
  };
  
  // Define the theme types
  // IMPORTANT: "Default" is NOT a valid palette - it should use Neutral instead
  // Based on the Default Settings Logic, Default always maps to either Primary or Neutral
  // For button borders, we use Neutral as the safe fallback for Default
  const themeTypes = [
    { name: 'Default', variable: 'Neutral' },  // FIXED: Use Neutral instead of {Default}
    { name: 'Primary', variable: 'Primary' },  // FIXED: Remove curly braces
    { name: 'Secondary', variable: 'Secondary' },  // FIXED: Remove curly braces
    { name: 'Tertiary', variable: 'Tertiary' },  // FIXED: Remove curly braces
    { name: 'Neutral', variable: 'Neutral' },  // FIXED: Remove curly braces
    { name: 'Info', variable: 'Info' },
    { name: 'Success', variable: 'Success' },  // FIXED: Add curly braces for consistency
    { name: 'Warning', variable: 'Warning' },  // FIXED: Add curly braces for consistency
    { name: 'Error', variable: 'Error' }  // FIXED: Add curly braces for consistency
  ];
  
  // Generate for each theme type
  themeTypes.forEach(({ name, variable }) => {
    const surfaceBorders: any = {};
    const containerBorders: any = {};
    
    if (mode === 'Light-Mode') {
      // Light Mode logic
      surfaceBorders['Color-1'] = { value: `{Colors.${variable}.Color-8}`, type: 'color' };
      surfaceBorders['Color-2'] = { value: `{Colors.${variable}.Color-8}`, type: 'color' };
      surfaceBorders['Color-3'] = { value: `{Colors.${variable}.Color-9}`, type: 'color' };
      surfaceBorders['Color-4'] = { value: `{Colors.${variable}.Color-11}`, type: 'color' };
      surfaceBorders['Color-5'] = { value: `{Colors.${variable}.Color-12}`, type: 'color' };
      surfaceBorders['Color-6'] = { value: `{Colors.${variable}.Color-13}`, type: 'color' };
      surfaceBorders['Color-7'] = { value: `{Colors.${variable}.Color-3}`, type: 'color' };
      surfaceBorders['Color-8'] = { value: `{Colors.${variable}.Color-4}`, type: 'color' };
      surfaceBorders['Color-9'] = { value: `{Colors.${variable}.Color-5}`, type: 'color' };
      surfaceBorders['Color-10'] = { value: `{Colors.${variable}.Color-5}`, type: 'color' };
      surfaceBorders['Color-11'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      surfaceBorders['Color-12'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      surfaceBorders['Color-13'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      surfaceBorders['Color-14'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      surfaceBorders['Color-Vibrant'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      
      // Containers use the same logic as Surfaces in Light Mode
      containerBorders['Color-1'] = { value: `{Colors.${variable}.Color-8}`, type: 'color' };
      containerBorders['Color-2'] = { value: `{Colors.${variable}.Color-8}`, type: 'color' };
      containerBorders['Color-3'] = { value: `{Colors.${variable}.Color-9}`, type: 'color' };
      containerBorders['Color-4'] = { value: `{Colors.${variable}.Color-11}`, type: 'color' };
      containerBorders['Color-5'] = { value: `{Colors.${variable}.Color-12}`, type: 'color' };
      containerBorders['Color-6'] = { value: `{Colors.${variable}.Color-13}`, type: 'color' };
      containerBorders['Color-7'] = { value: `{Colors.${variable}.Color-3}`, type: 'color' };
      containerBorders['Color-8'] = { value: `{Colors.${variable}.Color-4}`, type: 'color' };
      containerBorders['Color-9'] = { value: `{Colors.${variable}.Color-5}`, type: 'color' };
      containerBorders['Color-10'] = { value: `{Colors.${variable}.Color-5}`, type: 'color' };
      containerBorders['Color-11'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      containerBorders['Color-12'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      containerBorders['Color-13'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      containerBorders['Color-14'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
      containerBorders['Color-Vibrant'] = { value: `{Colors.${variable}.Color-7}`, type: 'color' };
    } else {
      // Dark Mode logic
      // For Default theme in Dark Mode, use Neutral references
      const neutralRef = name === 'Default' ? '{Neutral}' : 'Neutral';
      
      surfaceBorders['Color-1'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-2'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-3'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-4'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-5'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-6'] = { value: '{Color-Scale.White}', type: 'color' };
      surfaceBorders['Color-7'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-8'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-9'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-10'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-11'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-12'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-13'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-14'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      surfaceBorders['Color-Vibrant'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      
      // Containers use the same logic as Surfaces in Dark Mode
      containerBorders['Color-1'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-2'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-3'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-4'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-5'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-6'] = { value: '{Color-Scale.White}', type: 'color' };
      containerBorders['Color-7'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-8'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-9'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-10'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-11'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-12'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-13'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-14'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
      containerBorders['Color-Vibrant'] = { value: `{Colors.${neutralRef}.Color-1}`, type: 'color' };
    }
    
    borders.Surfaces[name] = surfaceBorders;
    borders.Containers[name] = containerBorders;
  });
  
  return borders;
}

/**
 * Generate complete system for a mode
 * Returns Themes, Default-Button, Buttons, and Tag sections
 */
export function generateCompleteSimplifiedSystem(
  mode: 'Light-Mode' | 'Dark-Mode',
  extractedTones: { primary: number; secondary: number; tertiary: number },
  surfaceStyle: 'light-tonal' | 'grey-professional' | 'dark-professional',
  schemeType: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic',
  userSelections?: {
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-base' | 'primary-dark' | 'neutral-light' | 'neutral-dark'; // CRITICAL FIX: Added neutral-light and neutral-dark
    appBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    navBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    status?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    button?: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
    textColoring?: 'tonal' | 'black-white';
    cardColoring?: 'tonal' | 'white' | 'black';
  }
): {
  Themes: any;
  'Default-Button': any;
  Buttons: any;
  Tag: any;
  'Default-Button-Border': any;
} {
  console.log(`\n🎨🎨🎨 [generateCompleteSimplifiedSystem] === START for ${mode} ===`);
  
  // Get default settings
  const config = getSimplifiedDefaultSettings(extractedTones, surfaceStyle, schemeType, userSelections);
  
  // Calculate OB - NEW SPEC: PC >= 11 then OB = 10, else OB = 8
  const PC = toneToColorNumber(extractedTones.primary);
  const OB = PC >= 11 ? 10 : 8;
  
  // Generate all sections with COMPLETE THEMES (includes Surfaces and Containers)
  const themes = generateAllThemesWithSurfacesAndContainers(mode, extractedTones, surfaceStyle, schemeType, userSelections);
  const buttons = generateBaseButtons(mode, extractedTones);
  const defaultButton = generateDefaultButton(config.buttonMode, config.textColoring, mode);
  const tag = mode === 'Light-Mode' 
    ? generateLightModeTags(config.textColoring, OB) 
    : generateDarkModeTags(config.textColoring);
  const defaultButtonBorder = generateDefaultButtonBorders(mode);
  
  console.log(`  ✓ Generated Themes section (${Object.keys(themes).length} complete themes with Surfaces & Containers)`);
  console.log(`  ✓ Generated Buttons section (9 button types)`);
  console.log(`  ✓ Generated Default-Button section (9 button references)`);
  console.log(`  ✓ Generated Tag section (9 tag types)`);
  console.log(`  ✓ Generated Default-Button-Border section (9 theme types with Surfaces & Containers)`);
  console.log(`🎨🎨🎨 [generateCompleteSimplifiedSystem] === END for ${mode} ===\n`);
  
  return {
    Themes: themes,
    'Default-Button': defaultButton,
    Buttons: buttons,
    Tag: tag,
    'Default-Button-Border': defaultButtonBorder
  };
}