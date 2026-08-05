/**
 * Simplified Tag Generation System
 * Based on color-tokens-5.json specification
 * 
 * Tags reference {Primary-Button-Text}, {Secondary-Button-Text}, etc.
 * which map differently based on text coloring mode:
 * - Tonal: {Primary-Button-Text} = Primary
 * - BW Light Mode: {Primary-Button-Text} = BW (text-on-surface; tag text sits on
 *   the tag's own colored bg, NOT on a button overlay — BW-Button is its inverse)
 * - BW Dark Mode: {Primary-Button-Text} = Primary (same as tonal)
 * 
 * Structure:
 * Tag.Light.Primary.BG = {Colors.Primary.Color-9}
 * Tag.Light.Primary.Text.Primary = {Text.Surfaces.{Primary-Button-Text}.Color-9}
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
  // Light Mode + BW: tag text sits DIRECTLY on the tag's own colored background
  // (Color-9), exactly like surface text — so it uses the BW (text-on-surface)
  // mapping, NOT BW-Button (which is the inverse, for text on a black/white
  // button overlaying the surface). Using BW-Button here inverted every tag
  // (white text on light tags, black text on dark tags).
  if (textColoring === 'black-white' && mode === 'Light-Mode') {
    return {
      Primary: 'BW',
      Secondary: 'BW',
      Tertiary: 'BW',
      Neutral: 'BW',
      Info: 'BW',
      Success: 'BW',
      Warning: 'BW',
      Error: 'BW'
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
          Primary: { value: `{Text.Surfaces.${textMappings.Primary}.Color-9}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-9}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Surfaces.${textMappings.Secondary}.Color-9}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-9}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Surfaces.${textMappings.Tertiary}.Color-9}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-9}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Surfaces.${textMappings.Neutral}.Color-9}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-9}', type: 'color' },
        Text: {
          Info: { value: `{Text.Surfaces.${textMappings.Info}.Color-9}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-9}', type: 'color' },
        Text: {
          Success: { value: `{Text.Surfaces.${textMappings.Success}.Color-9}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-9}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Surfaces.${textMappings.Warning}.Color-9}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-9}', type: 'color' },
        Text: {
          Error: { value: `{Text.Surfaces.${textMappings.Error}.Color-9}`, type: 'color' }
        }
      }
    },
    Medium: {
      Primary: {
        BG: { value: `{Colors.Primary.Color-${OB}}`, type: 'color' },
        Text: {
          Primary: { value: `{Text.Surfaces.${textMappings.Primary}.Color-${OB}}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: `{Colors.Secondary.Color-${OB}}`, type: 'color' },
        Text: {
          Secondary: { value: `{Text.Surfaces.${textMappings.Secondary}.Color-${OB}}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: `{Colors.Tertiary.Color-${OB}}`, type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Surfaces.${textMappings.Tertiary}.Color-${OB}}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: `{Colors.Neutral.Color-${OB}}`, type: 'color' },
        Text: {
          Neutral: { value: `{Text.Surfaces.${textMappings.Neutral}.Color-${OB}}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
        Text: {
          Info: { value: `{Text.Surfaces.${textMappings.Info}.Color-${OB}}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
        Text: {
          Success: { value: `{Text.Surfaces.${textMappings.Success}.Color-${OB}}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
        Text: {
          Warning: { value: `{Text.Surfaces.${textMappings.Warning}.Color-${OB}}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
        Text: {
          Error: { value: `{Text.Surfaces.${textMappings.Error}.Color-${OB}}`, type: 'color' }
        }
      }
    }
  };
}

/**
 * Generate Tags section for Dark Mode
 *
 * Uses Color-5 for both Light and Medium backgrounds.
 *
 * These were the last 16 references to Color-Vibrant, and they were the reason
 * Figma and the CSS disagreed on every dark tag. Color-Vibrant is a FROZEN
 * light-mode Color-8 — the same hex in both modes, matching no dark tone — so
 * figma.json resolved these to the bright light value (#b8cfbf) while
 * exportToCSS rewrote .Color-Vibrant to .Color-8 and emitted the dark tone
 * (#94b39d). Parity never caught it because it compares no Tag roles.
 *
 * BG and Text move together to the same tone, so the pairing still comes from
 * the audited Text.Surfaces table: 8.32-8.76:1 across all eight palettes.
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
        BG: { value: '{Colors.Primary.Color-5}', type: 'color' },
        Text: {
          Primary: { value: `{Text.Surfaces.${textMappings.Primary}.Color-5}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-5}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Surfaces.${textMappings.Secondary}.Color-5}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-5}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Surfaces.${textMappings.Tertiary}.Color-5}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-5}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Surfaces.${textMappings.Neutral}.Color-5}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-5}', type: 'color' },
        Text: {
          Info: { value: `{Text.Surfaces.${textMappings.Info}.Color-5}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-5}', type: 'color' },
        Text: {
          Success: { value: `{Text.Surfaces.${textMappings.Success}.Color-5}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-5}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Surfaces.${textMappings.Warning}.Color-5}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-5}', type: 'color' },
        Text: {
          Error: { value: `{Text.Surfaces.${textMappings.Error}.Color-5}`, type: 'color' }
        }
      }
    },
    Medium: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-5}', type: 'color' },
        Text: {
          Primary: { value: `{Text.Surfaces.${textMappings.Primary}.Color-5}`, type: 'color' }
        }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-5}', type: 'color' },
        Text: {
          Secondary: { value: `{Text.Surfaces.${textMappings.Secondary}.Color-5}`, type: 'color' }
        }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-5}', type: 'color' },
        Text: {
          Tertiary: { value: `{Text.Surfaces.${textMappings.Tertiary}.Color-5}`, type: 'color' }
        }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-5}', type: 'color' },
        Text: {
          Neutral: { value: `{Text.Surfaces.${textMappings.Neutral}.Color-5}`, type: 'color' }
        }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-5}', type: 'color' },
        Text: {
          Info: { value: `{Text.Surfaces.${textMappings.Info}.Color-5}`, type: 'color' }
        }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-5}', type: 'color' },
        Text: {
          Success: { value: `{Text.Surfaces.${textMappings.Success}.Color-5}`, type: 'color' }
        }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-5}', type: 'color' },
        Text: {
          Warning: { value: `{Text.Surfaces.${textMappings.Warning}.Color-5}`, type: 'color' }
        }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-5}', type: 'color' },
        Text: {
          Error: { value: `{Text.Surfaces.${textMappings.Error}.Color-5}`, type: 'color' }
        }
      }
    }
  };
}
