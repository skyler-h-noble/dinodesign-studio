/**
 * Simplified Tag Generation System
 * Based on color-tokens-5.json specification
 * 
 * Tags reference {Primary-Button-Text}, {Secondary-Button-Text}, etc.
 * which map differently based on text coloring mode:
 * - Tonal: {Primary-Button-Text} = Primary
 * - BW Light Mode: {Primary-Button-Text} = BW-Button
 * - BW Dark Mode: {Primary-Button-Text} = Primary (same as tonal)
 * 
 * Structure:
 * Tag.Light.Primary.BG = {Colors.Primary.Color-9}
 * Tag.Light.Primary.Text.Primary = {Text.Tag.{Primary-Button-Text}.Color-9}
 */

/**
 * Get tag text theme mappings based on text coloring mode and light/dark mode
 * These determine which palette {X-Button-Text} maps to for tags
 */
function getTagTextMappings(
  textColoring: 'tonal' | 'black-white',
  mode: 'Light-Mode' | 'Dark-Mode'
): {
  Primary: string;
  Secondary: string;
  Tertiary: string;
  Neutral: string;
  Info: string;
  Success: string;
  Warning: string;
  Error: string;
} {
  // Light Mode + BW: All text uses BW-Button
  if (textColoring === 'black-white' && mode === 'Light-Mode') {
    return {
      Primary: 'BW-Button',
      Secondary: 'BW-Button',
      Tertiary: 'BW-Button',
      Neutral: 'BW-Button',
      Info: 'BW-Button',
      Success: 'BW-Button',
      Warning: 'BW-Button',
      Error: 'BW-Button'
    };
  }
  
  // Tonal OR (Dark Mode + BW): Use palette-specific text
  return {
    Primary: 'Primary',
    Secondary: 'Secondary',
    Tertiary: 'Tertiary',
    Neutral: 'Neutral',
    Info: 'Info',
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error'
  };
}

/**
 * Generate Tags section for Light Mode
 * Uses Color-9 for Light backgrounds, OB for Medium backgrounds
 */
export function generateLightModeTags(
  textColoring: 'tonal' | 'black-white',
  OB: number = 10
): any {
  const textMappings = getTagTextMappings(textColoring, 'Light-Mode');
  
  console.log(`🏷️  [generateLightModeTags] TextColoring: ${textColoring}, OB: ${OB}`);
  console.log(`  Text Mappings:`, textMappings);
  
  return {
    Light: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-9}', type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.${textMappings.Primary}.Color-9}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-9}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.${textMappings.Secondary}.Color-9}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-9}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.${textMappings.Tertiary}.Color-9}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-9}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.${textMappings.Neutral}.Color-9}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-9}', type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.${textMappings.Info}.Color-9}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-9}', type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.${textMappings.Success}.Color-9}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-9}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.${textMappings.Warning}.Color-9}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-9}', type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.${textMappings.Error}.Color-9}`, type: 'color' }
        }
      }
    },
    Medium: {
      Primary: {
        BG: { value: `{Colors.Primary.Color-${OB}}`, type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.${textMappings.Primary}.Color-${OB}}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: `{Colors.Secondary.Color-${OB}}`, type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.${textMappings.Secondary}.Color-${OB}}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: `{Colors.Tertiary.Color-${OB}}`, type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.${textMappings.Tertiary}.Color-${OB}}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: `{Colors.Neutral.Color-${OB}}`, type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.${textMappings.Neutral}.Color-${OB}}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.${textMappings.Info}.Color-${OB}}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.${textMappings.Success}.Color-${OB}}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.${textMappings.Warning}.Color-${OB}}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.${textMappings.Error}.Color-${OB}}`, type: 'color' }
        }
      }
    }
  };
}

/**
 * Generate Tags section for Dark Mode
 * Uses Color-Vibrant for both Light and Medium backgrounds
 */
export function generateDarkModeTags(
  textColoring: 'tonal' | 'black-white'
): any {
  const textMappings = getTagTextMappings(textColoring, 'Dark-Mode');
  
  console.log(`🏷️  [generateDarkModeTags] TextColoring: ${textColoring}`);
  console.log(`  Text Mappings:`, textMappings);
  
  return {
    Light: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-Vibrant}', type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.${textMappings.Primary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-Vibrant}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.${textMappings.Secondary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-Vibrant}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.${textMappings.Tertiary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-Vibrant}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.${textMappings.Neutral}.Color-Vibrant}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-Vibrant}', type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.${textMappings.Info}.Color-Vibrant}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-Vibrant}', type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.${textMappings.Success}.Color-Vibrant}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-Vibrant}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.${textMappings.Warning}.Color-Vibrant}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-Vibrant}', type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.${textMappings.Error}.Color-Vibrant}`, type: 'color' }
        }
      }
    },
    Medium: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-Vibrant}', type: 'color' },
        Text: {
          Primary: { value: `{Text.Tag.${textMappings.Primary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-Vibrant}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Tag.${textMappings.Secondary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-Vibrant}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Tag.${textMappings.Tertiary}.Color-Vibrant}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-Vibrant}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Tag.${textMappings.Neutral}.Color-Vibrant}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-Vibrant}', type: 'color' },
        Text: {
          Info: { value: `{Text.Tag.${textMappings.Info}.Color-Vibrant}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-Vibrant}', type: 'color' },
        Text: {
          Success: { value: `{Text.Tag.${textMappings.Success}.Color-Vibrant}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-Vibrant}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Tag.${textMappings.Warning}.Color-Vibrant}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-Vibrant}', type: 'color' },
        Text: {
          Error: { value: `{Text.Tag.${textMappings.Error}.Color-Vibrant}`, type: 'color' }
        }
      }
    }
  };
}
