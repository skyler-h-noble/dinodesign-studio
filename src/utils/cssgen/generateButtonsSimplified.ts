/**
 * Simplified Button Generation System
 * Based on the new two-layer architecture from color-tokens-1.json spec
 * 
 * LAYER 1: Buttons Section (Base Button Definitions)
 * - Primary, Secondary, Tertiary, Neutral, Info, Success, Warning, Error, BlackWhite
 * - Each has Light and Medium contrast levels
 * - Uses actual color values with {OB} calculation
 * 
 * LAYER 2: Default-Button Section (References to Buttons.{X})
 * - Maps Default/Primary/Secondary/Tertiary/Neutral/Info/Success/Warning/Error to Buttons.{X}
 * - Based on button mode selection (Primary, Secondary, Tonal, Laddered, Black/White)
 * - Handles text coloring (Tonal vs Black/White)
 * 
 * UPDATE: OB now uses 9 when PC >= 9, else 8
 * UPDATE: Primary/Secondary/Tertiary buttons use PC/SC/TC instead of OB
 */

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
 * Generate LAYER 1: Base Buttons Section
 * Contains the actual button definitions (Primary, Secondary, Tertiary, etc.)
 * Each button type has Light and Medium contrast levels
 */
export function generateBaseButtons(
  mode: 'Light-Mode' | 'Dark-Mode',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): any {
  const isDark = mode === 'Dark-Mode';

  // In Dark Mode, all buttons use Color-12 for both Light and Medium
  // In Light Mode, buttons use the extracted tone values
  const PC = isDark ? 12 : (extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9);
  const rawSC = isDark ? 12 : (extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 11);
  const rawTC = isDark ? 12 : (extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 11);
  const adjustTone = (raw: number) => (raw === 11 || raw <= 5) ? (PC >= 9 ? 9 : 8) : raw;
  const SC = isDark ? 12 : adjustTone(rawSC);
  const TC = isDark ? 12 : adjustTone(rawTC);

  // Calculate {OB} (Other Buttons): if PC >= 9 then 6, else 5. In Dark Mode = 12.
  const OB = isDark ? 12 : (PC >= 9 ? 6 : 5);
  
  console.log(`🔘 [generateBaseButtons] Mode: ${mode}`);
  console.log(`  📊 EXTRACTED TONES INPUT:`, extractedTones);
  console.log(`  🎯 CALCULATED COLOR-N VALUES:`);
  console.log(`     PC=${PC} (from primary tone ${extractedTones?.primary || 'default'})`);
  console.log(`     SC=${SC} (from secondary tone ${extractedTones?.secondary || 'default'})`);
  console.log(`     TC=${TC} (from tertiary tone ${extractedTones?.tertiary || 'default'})`);
  console.log(`     OB=${OB}`);
  console.log(`  🎨 BUTTON PALETTE REFERENCES:`);
  console.log(`     buttons.Primary.Medium → {Colors.Primary.Color-${PC}}`);
  console.log(`     buttons.Secondary.Medium → {Colors.Secondary.Color-${SC}}`);
  console.log(`     buttons.Tertiary.Medium → {Colors.Tertiary.Color-${TC}}`);
  console.log(`     buttons.Neutral.Medium → {Colors.Neutral.Color-${OB}}`);
  
  const buttons: any = {};
  
  // PRIMARY BUTTON
  // Both Light and Medium use Color-PC (the user's actual extracted primary)
  // This matches the UI preview which always uses p(vPrimary, PC)
  buttons.Primary = {
    Light: {
      Button: { value: `{Colors.Primary.Color-${PC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Primary.Color-${PC}}`, type: 'color' },
      Hover: { value: `{Hover.Primary.Color-${PC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Primary.Color-${PC}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Primary.Color-${PC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Primary.Color-${PC}}`, type: 'color' },
      Hover: { value: `{Hover.Primary.Color-${PC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Primary.Color-${PC}}`, type: 'color' }
    }
  };
  
  // SECONDARY BUTTON — both shades use Color-SC
  buttons.Secondary = {
    Light: {
      Button: { value: `{Colors.Secondary.Color-${SC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Secondary.Color-${SC}}`, type: 'color' },
      Hover: { value: `{Hover.Secondary.Color-${SC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Secondary.Color-${SC}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Secondary.Color-${SC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Secondary.Color-${SC}}`, type: 'color' },
      Hover: { value: `{Hover.Secondary.Color-${SC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Secondary.Color-${SC}}`, type: 'color' }
    }
  };

  // TERTIARY BUTTON — both shades use Color-TC
  buttons.Tertiary = {
    Light: {
      Button: { value: `{Colors.Tertiary.Color-${TC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Tertiary.Color-${TC}}`, type: 'color' },
      Hover: { value: `{Hover.Tertiary.Color-${TC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Tertiary.Color-${TC}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Tertiary.Color-${TC}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Tertiary.Color-${TC}}`, type: 'color' },
      Hover: { value: `{Hover.Tertiary.Color-${TC}}`, type: 'color' },
      Pressed: { value: `{Pressed.Tertiary.Color-${TC}}`, type: 'color' }
    }
  };

  // NEUTRAL BUTTON — always Color-8
  buttons.Neutral = {
    Light: {
      Button: { value: '{Colors.Neutral.Color-8}', type: 'color' },
      Text: { value: '{Text.Surfaces.Neutral.Color-8}', type: 'color' },
      Hover: { value: '{Hover.Neutral.Color-8}', type: 'color' },
      Pressed: { value: '{Pressed.Neutral.Color-8}', type: 'color' }
    },
    Medium: {
      Button: { value: '{Colors.Neutral.Color-8}', type: 'color' },
      Text: { value: '{Text.Surfaces.Neutral.Color-8}', type: 'color' },
      Hover: { value: '{Hover.Neutral.Color-8}', type: 'color' },
      Pressed: { value: '{Pressed.Neutral.Color-8}', type: 'color' }
    }
  };

  // INFO BUTTON — both shades use Color-OB
  buttons.Info = {
    Light: {
      Button: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Info.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Info.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Info.Color-${OB}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Info.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Info.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Info.Color-${OB}}`, type: 'color' }
    }
  };
  
  // SUCCESS BUTTON — both shades use Color-OB
  buttons.Success = {
    Light: {
      Button: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Success.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Success.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Success.Color-${OB}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Success.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Success.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Success.Color-${OB}}`, type: 'color' }
    }
  };

  // WARNING BUTTON — both shades use Color-OB
  buttons.Warning = {
    Light: {
      Button: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Warning.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Warning.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Warning.Color-${OB}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Warning.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Warning.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Warning.Color-${OB}}`, type: 'color' }
    }
  };

  // ERROR BUTTON — both shades use Color-OB
  buttons.Error = {
    Light: {
      Button: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Error.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Error.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Error.Color-${OB}}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.Error.Color-${OB}}`, type: 'color' },
      Hover: { value: `{Hover.Error.Color-${OB}}`, type: 'color' },
      Pressed: { value: `{Pressed.Error.Color-${OB}}`, type: 'color' }
    }
  };
  
  // BLACK/WHITE BUTTON (Special logic for Light vs Dark mode)
  if (mode === 'Light-Mode') {
    buttons.BlackWhite = {
      Light: {
        Button: { value: '{White}', type: 'color' },
        Text: { value: '{Text.Surfaces.BW-Button.Color-1}', type: 'color' },
        Hover: { value: '{Hover.Neutral.Color-11}', type: 'color' },
        Pressed: { value: '{Pressed.Neutral.Color-12}', type: 'color' }
      },
      Medium: {
        Button: { value: '{Colors.Neutral.Color-1}', type: 'color' },
        Text: { value: '{Text.Surfaces.BW-Button.Color-12}', type: 'color' },
        Hover: { value: '{Hover.Neutral.Color-1}', type: 'color' },
        Pressed: { value: '{Pressed.Neutral.Color-1}', type: 'color' }
      }
    };
  } else {
    // Dark Mode: BlackWhite button uses different colors
    buttons.BlackWhite = {
      Light: {
        Button: { value: '{Colors.Neutral.Color-1}', type: 'color' },
        Text: { value: '{Text.Surfaces.BW-Button.Color-12}', type: 'color' },
        Hover: { value: '{Hover.Neutral.Color-2}', type: 'color' },
        Pressed: { value: '{Pressed.Neutral.Color-3}', type: 'color' }
      },
      Medium: {
        Button: { value: '{White}', type: 'color' },
        Text: { value: '{Text.Surfaces.BW-Button.Color-1}', type: 'color' },
        Hover: { value: '{Hover.Neutral.Color-11}', type: 'color' },
        Pressed: { value: '{Pressed.Neutral.Color-10}', type: 'color' }
      }
    };
  }
  
  return buttons;
}

/**
 * Get button theme mappings based on button mode selection
 * Returns which color theme {X} each button should use
 */
function getButtonThemeMappings(
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  mode: 'Light-Mode' | 'Dark-Mode'
): {
  Default: string;
  Primary: string;
  Secondary: string;
  Tertiary: string;
  Neutral: string;
  Info: string;
  Success: string;
  Warning: string;
  Error: string;
} {
  // Handle Black/White mode special case for Dark Mode
  if (buttonMode === 'black-white' && mode === 'Dark-Mode') {
    // Dark Mode Black/White: Use Primary/Secondary/Tertiary colors
    return {
      Default: 'Primary',
      Primary: 'Primary',
      Secondary: 'Secondary',
      Tertiary: 'Tertiary',
      Neutral: 'Primary',
      Info: 'Info',
      Success: 'Success',
      Warning: 'Warning',
      Error: 'Error'
    };
  }
  
  switch (buttonMode) {
    case 'primary':
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Primary',
        Tertiary: 'Primary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'secondary':
      return {
        Default: 'Secondary',
        Primary: 'Secondary',
        Secondary: 'Secondary',
        Tertiary: 'Secondary',
        Neutral: 'Secondary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'tonal':
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Secondary',
        Tertiary: 'Tertiary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'laddered':
      // Laddered: Uses a ladder pattern
      // Default: If Default is Primary then Secondary, Else Primary (evaluates to Secondary)
      // Primary → Secondary, Secondary → Tertiary, Tertiary → Secondary, Neutral → Primary
      return {
        Default: 'Secondary',
        Primary: 'Secondary',
        Secondary: 'Tertiary',
        Tertiary: 'Secondary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'black-white':
      return {
        Default: 'BlackWhite',
        Primary: 'BlackWhite',
        Secondary: 'BlackWhite',
        Tertiary: 'BlackWhite',
        Neutral: 'BlackWhite',
        Info: 'BlackWhite',
        Success: 'BlackWhite',
        Warning: 'BlackWhite',
        Error: 'BlackWhite'
      };
    
    default:
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Secondary',
        Tertiary: 'Tertiary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
  }
}

/**
 * Get text theme mappings based on text coloring mode
 * Returns which theme to use for button text
 */
function getTextThemeMappings(
  textColoring: 'tonal' | 'black-white',
  buttonThemeMappings: ReturnType<typeof getButtonThemeMappings>
): typeof buttonThemeMappings {
  // Button text ALWAYS uses the button's own palette for contrast
  // BW text coloring only affects surface/container text, not button text
  // Button text must have 4.5:1 contrast against the BUTTON BG, not the surface BG
  return buttonThemeMappings;
}

/**
 * Generate LAYER 2: Default-Button Section
 * References Buttons.{X} based on button mode and text coloring selections
 */
export function generateDefaultButton(
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  textColoring: 'tonal' | 'black-white',
  mode: 'Light-Mode' | 'Dark-Mode'
): any {
  // CRITICAL FIX: Text coloring should ONLY affect text, NOT button backgrounds
  // Button backgrounds are controlled by buttonMode only
  // Text colors are controlled by textColoring only
  
  const buttonMappings = getButtonThemeMappings(buttonMode, mode);
  const textMappings = getTextThemeMappings(textColoring, buttonMappings);
  
  console.log(`🔘 [generateDefaultButton] Mode: ${mode}, ButtonMode: ${buttonMode}, TextColoring: ${textColoring}`);
  console.log(`  Button Mappings (for backgrounds):`, buttonMappings);
  console.log(`  Text Mappings (for text only):`, textMappings);
  
  const defaultButton: any = {};
  
  // Generate Default button
  defaultButton.Default = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Default}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Default}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Default}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Default}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Default}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Default}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Default}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Default}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Primary button
  defaultButton.Primary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Primary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Primary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Primary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Primary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Primary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Primary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Primary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Primary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Secondary button
  defaultButton.Secondary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Secondary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Secondary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Secondary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Secondary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Secondary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Tertiary button
  defaultButton.Tertiary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Tertiary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Tertiary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Neutral button
  defaultButton.Neutral = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Neutral}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Neutral}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Neutral}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Neutral}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Neutral}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Info button
  defaultButton.Info = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Info}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Info}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Info}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Info}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Info}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Info}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Info}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Info}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Success button
  defaultButton.Success = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Success}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Success}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Success}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Success}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Success}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Success}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Success}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Success}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Warning button
  defaultButton.Warning = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Warning}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Warning}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Warning}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Warning}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Warning}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Warning}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Warning}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Warning}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Error button
  defaultButton.Error = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Error}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Error}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Error}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Error}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Error}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Error}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Error}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Error}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  return defaultButton;
}

/**
 * Generate complete button system for a mode
 * Returns both Buttons (Layer 1) and Default-Button (Layer 2)
 */
export function generateCompleteButtonSystem(
  mode: 'Light-Mode' | 'Dark-Mode',
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  textColoring: 'tonal' | 'black-white',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): {
  Buttons: any;
  'Default-Button': any;
} {
  console.log(`\n🎨🎨🎨 [generateCompleteButtonSystem] === START for ${mode} ===`);
  console.log(`  ButtonMode: ${buttonMode}`);
  console.log(`  TextColoring: ${textColoring}`);
  
  const buttons = generateBaseButtons(mode, extractedTones);
  const defaultButton = generateDefaultButton(buttonMode, textColoring, mode);
  
  console.log(`  ✓ Generated Buttons section (9 button types)`);
  console.log(`  ✓ Generated Default-Button section (9 button references)`);
  console.log(`🎨🎨🎨 [generateCompleteButtonSystem] === END for ${mode} ===\n`);
  
  return {
    Buttons: buttons,
    'Default-Button': defaultButton
  };
}