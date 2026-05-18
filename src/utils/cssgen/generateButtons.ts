import chroma from 'chroma-js';

// Helper function to convert tone value (e.g., 71) to color number (e.g., 11)
function toneToColorNumber(tone: number): number {
  // 12-TONE SYSTEM: [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99]
  //                   1   2   3   4   5   6   7   8   9  10  11  12
  const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];

  // Find exact match
  const exactIndex = toneScale.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) {
    return exactIndex + 1; // Color-1 through Color-12
  }

  // Find closest tone
  let closestIndex = 0;
  let minDiff = Math.abs(toneScale[0] - tone);
  for (let i = 1; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - tone);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex + 1; // Color-N (1-12)
}

/**
 * Generate buttons for all backgrounds for BW button type
 * Uses hardcoded values based on the theme-definitions-3.md structure
 */
function generateBWButtons(mode: 'Light-Mode' | 'Dark-Mode', theme: string) {
  const result: any = {
    Surfaces: {},
    Containers: {}
  };
  
  // For both Surfaces and Containers, backgrounds 1-5 use White button, backgrounds 6-12 use Color-1 button
  for (let n = 1; n <= 12; n++) {
    const isLightBackground = n <= 5;
    
    const surfaceButtonConfig = isLightBackground ? {
      Button: { value: `{White}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Neutral.Color-1}`, type: 'color' },
      Hover: { value: `{Hover.Neutral.Color-11}`, type: 'color' },
      Active: { value: n === 4 ? `{Active.Neutral.Color-11}` : `{Active.Neutral.Color-10}`, type: 'color' }
    } : {
      Button: { value: `{Colors.Neutral.Color-1}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Neutral.Color-12}`, type: 'color' },
      Hover: { value: `{Hover.Neutral.Color-2}`, type: 'color' },
      Active: { value: `{Active.Neutral.Color-3}`, type: 'color' }
    };
    
    const containerButtonConfig = isLightBackground ? {
      Button: { value: `{White}`, type: 'color' },
      Text: { value: `{Text.Containers.Neutral.Color-1}`, type: 'color' },
      Hover: { value: `{Hover.Neutral.Color-11}`, type: 'color' },
      Active: { value: n === 4 ? `{Active.Neutral.Color-11}` : `{Active.Neutral.Color-10}`, type: 'color' }
    } : {
      Button: { value: `{Colors.Neutral.Color-1}`, type: 'color' },
      Text: { value: `{Text.Containers.Neutral.Color-12}`, type: 'color' },
      Hover: { value: `{Hover.Neutral.Color-2}`, type: 'color' },
      Active: { value: `{Active.Neutral.Color-3}`, type: 'color' }
    };
    
    result.Surfaces[`Background-${n}`] = surfaceButtonConfig;
    result.Containers[`Background-${n}`] = containerButtonConfig;
  }
  
  // Add Background-Vibrant for both Light-Mode and Dark-Mode
  // In Light-Mode: uses same references as Background-9
  // In Dark-Mode: will be replaced with hex values from Light-Mode Background-9 in exportColorSystem.ts

  // Determine button color for vibrant background (same logic as Background-9)
  let vibrantButtonN: number | string;

  if (mode === 'Light-Mode') {
    vibrantButtonN = 9;
  } else {
    vibrantButtonN = 'Vibrant';
  }

  const surfaceVariantConfig = {
    Button: { value: `{Colors.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Text: { value: `{Text.Surfaces.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Hover: { value: `{Hover.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Active: { value: `{Active.Neutral.Color-${vibrantButtonN}}`, type: 'color' }
  };

  const containerVariantConfig = {
    Button: { value: `{Colors.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Text: { value: `{Text.Containers.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Hover: { value: `{Hover.Neutral.Color-${vibrantButtonN}}`, type: 'color' },
    Active: { value: `{Active.Neutral.Color-${vibrantButtonN}}`, type: 'color' }
  };
  
  result.Surfaces['Background-Vibrant'] = surfaceVariantConfig;
  result.Containers['Background-Vibrant'] = containerVariantConfig;
  
  return result;
}

/**
 * Generate buttons for all backgrounds for a specific button type
 * Following the pattern from theme-definitions-3.md:
 * - Button, Text, Hover & Active use {Default-N} (the button's fixed or adaptive N)
 */
function generateButtonsForMode(
  mode: 'Light-Mode' | 'Dark-Mode',
  buttonType: string,
  theme: string,
  defaultN: number | 'adaptive' | 'Vibrant',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
) {
  const result: any = {
    Surfaces: {},
    Containers: {}
  };
  
  // Generate for Color-1 through Color-12
  for (let n = 1; n <= 12; n++) {
    // Determine which Color-N to use for Button, Text, Hover, Active
    let buttonColorN: number | string;
    
    if (defaultN === 'adaptive') {
      // Adaptive: use the background's N
      buttonColorN = n;
    } else if (defaultN === 'Vibrant') {
      // Vibrant: use Color-Vibrant for all backgrounds
      buttonColorN = 'Vibrant';
    } else {
      // Fixed: use the specified N
      buttonColorN = defaultN as number;
    }
    
    result.Surfaces[`Background-${n}`] = {
      Button: { value: `{Colors.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Hover: { value: `{Hover.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Active: { value: `{Active.${theme}.Color-${buttonColorN}}`, type: 'color' },
      // Highlight / Lowlight follow the button's own palette so a Secondary
      // (or Default-as-Secondary, tonal, laddered, etc.) button gets its bevel
      // tones from its own color, not from Primary.
      Highlight: { value: `{Button-Highlight.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Lowlight: { value: `{Button-Lowlight.${theme}.Color-${buttonColorN}}`, type: 'color' }
    };

    result.Containers[`Background-${n}`] = {
      Button: { value: `{Colors.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Text: { value: `{Text.Containers.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Hover: { value: `{Hover.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Active: { value: `{Active.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Highlight: { value: `{Button-Highlight.${theme}.Color-${buttonColorN}}`, type: 'color' },
      Lowlight: { value: `{Button-Lowlight.${theme}.Color-${buttonColorN}}`, type: 'color' }
    };
  }
  
  // Add Background-Vibrant for both Light-Mode and Dark-Mode
  // In Light-Mode: uses same references as Background-9
  // In Dark-Mode: will be replaced with hex values from Light-Mode Background-9 in exportColorSystem.ts

  // Determine button color for vibrant background (same logic as Background-9)
  let vibrantButtonN: number | string;

  if (defaultN === 'adaptive') {
    // Adaptive: use 9 for Light-Mode, Vibrant for Dark-Mode
    vibrantButtonN = mode === 'Light-Mode' ? 9 : 'Vibrant';
  } else if (defaultN === 'Vibrant') {
    // Vibrant: use Color-Vibrant
    vibrantButtonN = 'Vibrant';
  } else {
    // Fixed: use the specified N
    vibrantButtonN = defaultN as number;
  }
  
  result.Surfaces['Background-Vibrant'] = {
    Button: { value: `{Colors.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Text: { value: `{Text.Surfaces.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Hover: { value: `{Hover.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Active: { value: `{Active.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Highlight: { value: `{Button-Highlight.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Lowlight: { value: `{Button-Lowlight.${theme}.Color-${vibrantButtonN}}`, type: 'color' }
  };

  result.Containers['Background-Vibrant'] = {
    Button: { value: `{Colors.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Text: { value: `{Text.Containers.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Hover: { value: `{Hover.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Active: { value: `{Active.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Highlight: { value: `{Button-Highlight.${theme}.Color-${vibrantButtonN}}`, type: 'color' },
    Lowlight: { value: `{Button-Lowlight.${theme}.Color-${vibrantButtonN}}`, type: 'color' }
  };
  
  return result;
}

/**
 * Auto-calculate default button configuration based on theme conditions
 */
function getAutoCalculatedDefault(
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  detectedStyle?: 'grey-professional' | 'dark-professional' | null,
  colorScheme?: string
): { theme: string; colorN: number | 'adaptive' } {
  if (!extractedTones) {
    return {
      theme: 'Primary',
      colorN: 9
    };
  }

  const PC = extractedTones.primary;
  const SC = extractedTones.secondary;

  // Dark Primary (PC < 9) OR Monochromatic
  if (PC < 9 || colorScheme === 'Monochromatic') {
    return {
      theme: 'Primary',
      colorN: toneToColorNumber(PC)
    };
  } else {
    // Light Primary (PC >= 9): Secondary, Fixed
    return {
      theme: 'Secondary',
      colorN: toneToColorNumber(SC)
    };
  }
}

/**
 * Determine default theme and color number based on button style
 * This can also handle auto-calculated defaults based on theme conditions
 */
function getDefaultButtonConfig(
  buttonStyle: 'primary-adaptive' | 'primary-fixed' | 'black-white' | 'secondary-adaptive' | 'secondary-fixed' | 'tonal-adaptive' | 'tonal-fixed',
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  detectedStyle?: 'grey-professional' | 'dark-professional' | null,
  colorScheme?: string
): { theme: string; colorN: number | 'adaptive' | 'tonal' } {
  
  // Handle specific button style selections
  switch (buttonStyle) {
    case 'primary-adaptive':
      // {Default} = Primary, {Default-N} = {X} (adaptive to surface)
      return {
        theme: 'Primary',
        colorN: 'adaptive'
      };
    
    case 'primary-fixed':
      // {Default} = Primary, {Default-N} = {PC}
      return {
        theme: 'Primary',
        colorN: extractedTones ? toneToColorNumber(extractedTones.primary) : 9
      };

    case 'secondary-fixed':
      // {Default} = Secondary, {Default-N} = {SC}
      return {
        theme: 'Secondary',
        colorN: extractedTones ? toneToColorNumber(extractedTones.secondary) : 9
      };
    
    case 'secondary-adaptive':
      // {Default} = Secondary, {Default-N} = {X}
      return {
        theme: 'Secondary',
        colorN: 'adaptive'
      };
    
    case 'tonal-adaptive':
      // {Default} uses the theme of the current surface, adaptive to N
      return {
        theme: 'tonal', // Special marker to indicate tonal behavior
        colorN: 'adaptive'
      };
    
    case 'tonal-fixed':
      // {Default} uses the theme of the current surface, fixed to PC
      return {
        theme: 'tonal', // Special marker to indicate tonal behavior
        colorN: extractedTones ? toneToColorNumber(extractedTones.primary) : 9
      };

    case 'black-white':
      // {Default} = BW, {Default-N} = 9 (fixed)
      return {
        theme: 'BW',
        colorN: 9
      };
    
    default:
      // Auto-calculate default based on theme conditions
      return getAutoCalculatedDefault(extractedTones, detectedStyle, colorScheme);
  }
}

/**
 * Generate all button types for a mode
 */
export function generateAllButtonsForMode(
  mode: 'Light-Mode' | 'Dark-Mode',
  buttonStyle: 'primary-adaptive' | 'primary-fixed' | 'black-white' | 'secondary-adaptive' | 'secondary-fixed' | 'tonal-adaptive' | 'tonal-fixed',
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  detectedStyle?: 'grey-professional' | 'dark-professional' | null,
  colorScheme?: string
) {
  const buttons: any = {};
  
  // Get default button configuration
  const defaultConfig = getDefaultButtonConfig(buttonStyle, extractedTones, detectedStyle, colorScheme);
  
  console.log(`🔘 [generateAllButtonsForMode] Mode: ${mode}, ButtonStyle: ${buttonStyle}`);
  console.log(`  Default config:`, defaultConfig);
  
  // Default Button (based on buttonStyle selection or auto-calculated)
  // Special handling for BW: use the same hardcoded logic as BW buttons
  if (buttonStyle === 'black-white') {
    buttons['Default'] = generateBWButtons(mode, 'BW');
  }
  // Special handling for tonal: generate multiple Default variations for each theme
  else if (defaultConfig.theme === 'tonal') {
    // For tonal buttons, we need to generate Default buttons that adapt to each theme
    // This requires a different structure than the other button types
    // For now, use Primary as the base theme for Default
    buttons['Default'] = generateButtonsForMode(mode, 'Default', 'Primary', defaultConfig.colorN as any, extractedTones);
  } else {
    buttons['Default'] = generateButtonsForMode(mode, 'Default', defaultConfig.theme, defaultConfig.colorN as any, extractedTones);
  }
  
  // Default-Light Button (same theme as Default, but always uses Color-Vibrant)
  if (buttonStyle === 'black-white') {
    // For BW, Default-Light uses Neutral theme with Color-Vibrant
    buttons['Default-Light'] = generateButtonsForMode(mode, 'Default-Light', 'Neutral', 'Vibrant', extractedTones);
  } else if (defaultConfig.theme === 'tonal') {
    // For tonal, use Primary theme with Color-Vibrant
    buttons['Default-Light'] = generateButtonsForMode(mode, 'Default-Light', 'Primary', 'Vibrant', extractedTones);
  } else {
    // Use the same theme as Default, but with Color-Vibrant
    buttons['Default-Light'] = generateButtonsForMode(mode, 'Default-Light', defaultConfig.theme, 'Vibrant', extractedTones);
  }
  
  // Primary Button (always uses Primary theme)
  const primaryColorN = buttonStyle === 'primary-fixed'
    ? (extractedTones ? toneToColorNumber(extractedTones.primary) : 9)
    : 'adaptive';
  buttons['Primary'] = generateButtonsForMode(mode, 'Primary', 'Primary', primaryColorN, extractedTones);
  
  // Secondary Button (always uses Secondary theme)
  const secondaryColorN = buttonStyle === 'primary-fixed' || buttonStyle === 'secondary-fixed' || buttonStyle === 'tonal-fixed'
    ? (extractedTones ? toneToColorNumber(extractedTones.secondary) : 9)
    : 'adaptive';
  buttons['Secondary'] = generateButtonsForMode(mode, 'Secondary', 'Secondary', secondaryColorN, extractedTones);

  // Tertiary Button (always uses Tertiary theme)
  const tertiaryColorN = buttonStyle === 'primary-fixed' || buttonStyle === 'secondary-fixed' || buttonStyle === 'tonal-fixed'
    ? (extractedTones ? toneToColorNumber(extractedTones.tertiary) : 9)
    : 'adaptive';
  buttons['Tertiary'] = generateButtonsForMode(mode, 'Tertiary', 'Tertiary', tertiaryColorN, extractedTones);
  
  // Neutral Button (always uses Neutral theme, always adaptive)
  buttons['Neutral'] = generateButtonsForMode(mode, 'Neutral', 'Neutral', 'adaptive', extractedTones);
  
  // Semantic buttons (Info, Success, Warning, Error) - always fixed at extracted tone
  const semanticColorN = extractedTones ? toneToColorNumber(extractedTones.primary) : 9;
  buttons['Info'] = generateButtonsForMode(mode, 'Info', 'Info', semanticColorN, extractedTones);
  buttons['Success'] = generateButtonsForMode(mode, 'Success', 'Success', semanticColorN, extractedTones);
  buttons['Warning'] = generateButtonsForMode(mode, 'Warning', 'Warning', semanticColorN, extractedTones);
  buttons['Error'] = generateButtonsForMode(mode, 'Error', 'Error', semanticColorN, extractedTones);
  
  return buttons;
}