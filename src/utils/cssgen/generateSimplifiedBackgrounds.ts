import { blendColors } from '../colorScale';

/**
 * Type definition for simplified surfaces and containers
 */
export interface SimplifiedSurfacesAndContainers {
  Surfaces: {
    Surface: { value: string; type: string };
    'Surface-Dim': { value: string; type: string };
    'Surface-Bright': { value: string; type: string };
  };
  Containers: {
    Container: { value: string; type: string };
    'Container-Lowest': { value: string; type: string };
    'Container-Low': { value: string; type: string };
    'Container-High': { value: string; type: string };
    'Container-Highest': { value: string; type: string };
  };
}

/**
 * Generate SIMPLIFIED Light Mode backgrounds - ONLY surface/container colors
 * This is a unified function that replaces both Tonal and Professional variants
 */
export function generateSimplifiedLightModeBackgrounds(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false,
  paletteName?: string,
  containerStyle: 'tonal' | 'professional' | 'black' = 'tonal'
): SimplifiedSurfacesAndContainers {
  // CRITICAL: Validate inputs
  if (!palette || palette.length === 0) {
    console.error('❌ generateSimplifiedLightModeBackgrounds: palette is empty or undefined!');
    console.error('   baseColor:', baseColor, 'tone:', tone, 'palette:', palette);
    throw new Error('Palette is required and must not be empty');
  }
  
  let surfaceDimBlack = 0.04;
  let surfaceWhite = 0.0;
  let surfaceBrightWhite = 0.04;
  let surfaceBaseTone = 0;
  
  let useColor10ForContainers = false;
  let containerLowestBlend = 0.12;
  let containerLowBlend = 0.15;
  let containerBlend = 0.18;
  let containerHighBlend = 0.20;
  let containerHighestBlend = 0.22;

  // Map tones to colors using SIMPLIFIED 1:1 mapping
  if (tone === 1) { // Background-1 → Color-1
    surfaceBaseTone = 0;
    useColor10ForContainers = true;
  } else if (tone === 10) { // Background-2 → Color-2
    surfaceBaseTone = 1;
    useColor10ForContainers = true;
  } else if (tone === 19) { // Background-3 → Color-3
    surfaceBaseTone = 2;
    useColor10ForContainers = true;
  } else if (tone === 28) { // Background-4 → Color-4
    surfaceBaseTone = 3;
    useColor10ForContainers = true;
  } else if (tone === 37) { // Background-5 → Color-5
    surfaceBaseTone = 4;
    useColor10ForContainers = true;
  } else if (tone === 46.6) { // Background-6 → Color-6
    surfaceBaseTone = 5;
    useColor10ForContainers = true;
  } else if (tone === 53) { // Background-7 → Color-7
    surfaceBaseTone = 6;
    useColor10ForContainers = true;
  } else if (tone === 62) { // Background-8 → Color-8
    surfaceBaseTone = 7;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 71) { // Background-9 → Color-9
    surfaceBaseTone = 8;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 81) { // Background-10 → Color-10
    surfaceBaseTone = 9;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 90) { // Background-11 → Color-11
    surfaceBaseTone = 10;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 95) { // Background-12 → Color-12
    surfaceBaseTone = 11;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 98) { // Background-13 → Color-13
    surfaceBaseTone = 12;
    useColor10ForContainers = false; // Use Color-13
  } else if (tone === 99) { // Background-14 → Color-14
    surfaceBaseTone = 13;
    useColor10ForContainers = false; // Use Color-13
  }

  const surfaceColor = palette[surfaceBaseTone]?.color || baseColor;
  const surfaceDimColor = blendColors('#000000', surfaceColor, surfaceDimBlack);
  const surfaceBrightColor = blendColors('#FFFFFF', surfaceColor, surfaceBrightWhite);

  // Get the base container color
  // For tonal mode: Use Color-10 for all backgrounds (provides contrast)
  const baseContainerColorIndex = 9; // Always Color-10 (index 9)
  const baseContainerColor = palette[baseContainerColorIndex]?.color || baseColor;

  // ========================================================================
  // CRITICAL FIX: Return TOKEN REFERENCES, not hex colors!
  // CSS must be generated from JSON, so JSON must contain token references
  // ========================================================================
  
  // Convert Color-N index (0-13) to Color-N name (1-14)
  const surfaceColorNumber = surfaceBaseTone + 1; // e.g., 0 → Color-1, 12 → Color-13
  const containerColorNumber = useColor10ForContainers ? 10 : 13; // Color-10 or Color-13
  
  // DEBUG: Log for Tertiary palette specifically
  if (paletteName === 'Tertiary') {
    console.log(`      [TERTIARY SIMPLIFIED] tone ${tone} → surfaceBaseTone ${surfaceBaseTone} → Color-${surfaceColorNumber}`);
  }
  
  if (paletteName) {
    // SPECIAL CASE: Neutral-14 always has white containers (regardless of containerStyle)
    // This is the only background where ALL containers should be white
    if (paletteName === 'Neutral' && tone === 99) { // Background-14
      console.log(`      🎨 [NEUTRAL-14 SPECIAL] All containers → {White}`);
      return {
        Surfaces: {
          'Surface': {
            value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
            type: 'color'
          },
          'Surface-Dim': {
            value: surfaceDimColor,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightColor,
            type: 'color'
          }
        },
        Containers: {
          'Container': {
            value: '{White}',
            type: 'color'
          },
          'Container-Lowest': {
            value: '{White}',
            type: 'color'
          },
          'Container-Low': {
            value: '{White}',
            type: 'color'
          },
          'Container-High': {
            value: '{White}',
            type: 'color'
          },
          'Container-Highest': {
            value: '{White}',
            type: 'color'
          }
        }
      };
    }
    
    // Professional mode: White cards - all containers link to {White}
    // NOTE: This should only be used when the USER explicitly selects "professional" container style
    if (containerStyle === 'professional') {
      return {
        Surfaces: {
          'Surface': {
            value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
            type: 'color'
          },
          'Surface-Dim': {
            value: surfaceDimColor,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightColor,
            type: 'color'
          }
        },
        Containers: {
          'Container': {
            value: '{White}',
            type: 'color'
          },
          'Container-Lowest': {
            value: '{White}',
            type: 'color'
          },
          'Container-Low': {
            value: '{White}',
            type: 'color'
          },
          'Container-High': {
            value: '{White}',
            type: 'color'
          },
          'Container-Highest': {
            value: '{White}',
            type: 'color'
          }
        }
      };
    }
    
    // Black mode: Black cards - all containers link to {Colors.Neutral.Color-2}
    if (containerStyle === 'black') {
      return {
        Surfaces: {
          'Surface': {
            value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
            type: 'color'
          },
          'Surface-Dim': {
            value: surfaceDimColor,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightColor,
            type: 'color'
          }
        },
        Containers: {
          'Container': {
            value: '{Colors.Neutral.Color-2}',
            type: 'color'
          },
          'Container-Lowest': {
            value: '{Colors.Neutral.Color-2}',
            type: 'color'
          },
          'Container-Low': {
            value: '{Colors.Neutral.Color-2}',
            type: 'color'
          },
          'Container-High': {
            value: '{Colors.Neutral.Color-2}',
            type: 'color'
          },
          'Container-Highest': {
            value: '{Colors.Neutral.Color-2}',
            type: 'color'
          }
        }
      };
    }
    
    // Tonal mode: calculate blended container values (HEX, not CSS variables)
    // Blend container base color (foreground) with Surface-Bright (background)
    // Lower blend = more surface, less container | Higher blend = more container, less surface
    const containerLowestColor = blendColors(baseContainerColor, surfaceColor, containerLowestBlend);
    const containerLowColor = blendColors(baseContainerColor, surfaceColor, containerLowBlend);
    const containerColor = blendColors(baseContainerColor, surfaceColor, containerBlend);
    const containerHighColor = blendColors(baseContainerColor, surfaceColor, containerHighBlend);
    const containerHighestColor = blendColors(baseContainerColor, surfaceColor, containerHighestBlend);
    
    console.log(`🎨 [TONAL MODE] Palette: ${paletteName}, Tone: ${tone}`);
    console.log(`   Container: ${containerColor}`);
    console.log(`   Container-Low: ${containerLowColor}`);
    console.log(`   Container-Lowest: ${containerLowestColor}`);
    console.log(`   Container-High: ${containerHighColor}`);
    console.log(`   Container-Highest: ${containerHighestColor}`);
    
    return {
      Surfaces: {
        'Surface': {
          value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
          type: 'color'
        },
        'Surface-Dim': {
          value: surfaceDimColor,
          type: 'color'
        },
        'Surface-Bright': {
          value: surfaceBrightColor,
          type: 'color'
        }
      },
      Containers: {
        'Container': {
          value: containerColor, // HEX value from blend calculation
          type: 'color'
        },
        'Container-Lowest': {
          value: containerLowestColor, // HEX value from blend calculation
          type: 'color'
        },
        'Container-Low': {
          value: containerLowColor, // HEX value from blend calculation
          type: 'color'
        },
        'Container-High': {
          value: containerHighColor, // HEX value from blend calculation
          type: 'color'
        },
        'Container-Highest': {
          value: containerHighestColor, // HEX value from blend calculation
          type: 'color'
        }
      }
    };
  }
  
  // Fallback: return hex colors (for backwards compatibility)
  return {
    Surfaces: {
      'Surface': {
        value: surfaceColor,
        type: 'color'
      },
      'Surface-Dim': {
        value: surfaceDimColor,
        type: 'color'
      },
      'Surface-Bright': {
        value: surfaceBrightColor,
        type: 'color'
      }
    },
    Containers: {
      'Container': {
        value: `{Colors.${paletteName}.Color-${containerColorNumber}}`,
        type: 'color'
      },
      'Container-Lowest': {
        value: `{Colors.${paletteName}.Color-${containerColorNumber}}`,
        type: 'color'
      },
      'Container-Low': {
        value: `{Colors.${paletteName}.Color-${containerColorNumber}}`,
        type: 'color'
      },
      'Container-High': {
        value: `{Colors.${paletteName}.Color-${containerColorNumber}}`,
        type: 'color'
      },
      'Container-Highest': {
        value: `{Colors.${paletteName}.Color-${containerColorNumber}}`,
        type: 'color'
      }
    }
  };
}

/**
 * Generate SIMPLIFIED Light Mode Tonal backgrounds - ONLY surface/container colors
 * DEPRECATED: Use generateSimplifiedLightModeBackgrounds instead
 */
export function generateSimplifiedLightModeTonalBackgrounds(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false
): SimplifiedSurfacesAndContainers {
  return generateSimplifiedLightModeBackgrounds(baseColor, tone, palette, isChromatic);
}

/**
 * Generate SIMPLIFIED Dark Mode backgrounds - ONLY surface/container colors
 */
export function generateSimplifiedDarkModeBackgrounds(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  paletteName?: string
): SimplifiedSurfacesAndContainers {
  // CRITICAL: Validate inputs
  if (!palette || palette.length === 0) {
    console.error('❌ generateSimplifiedDarkModeBackgrounds: palette is empty or undefined!');
    console.error('   baseColor:', baseColor, 'tone:', tone, 'palette:', palette);
    throw new Error('Palette is required and must not be empty');
  }
  
  let surfaceWhite = 0.04;
  let surfaceDimBlack = 0.02;
  let surfaceBrightWhite = 0.08;
  let surfaceBaseTone = 0;

  let useColor5ForContainers = false;

  // DARK_MODE_TONES = [1, 5, 12, 18, 24, 30, 36, 58, 64, 70, 76, 82, 85, 89]
  // Background-N → Color-N mapping (1:1)
  if (tone === 1) {
    surfaceBaseTone = 0;  // Background-1 → Color-1
    useColor5ForContainers = true;
  } else if (tone === 5) {
    surfaceBaseTone = 1;  // Background-2 → Color-2
    useColor5ForContainers = true;
  } else if (tone === 12) {
    surfaceBaseTone = 2;  // Background-3 → Color-3
    useColor5ForContainers = true;
  } else if (tone === 18) {
    surfaceBaseTone = 3;  // Background-4 → Color-4
    useColor5ForContainers = true;
  } else if (tone === 24) {
    surfaceBaseTone = 4;  // Background-5 → Color-5
    useColor5ForContainers = true;
  } else if (tone === 30) {
    surfaceBaseTone = 5;  // Background-6 → Color-6
    useColor5ForContainers = true;
  } else if (tone === 36) {
    surfaceBaseTone = 6;  // Background-7 → Color-7
    useColor5ForContainers = true;
  } else if (tone === 58) {
    surfaceBaseTone = 7;  // Background-8 → Color-8
    useColor5ForContainers = false; // Use Color-4
  } else if (tone === 64) {
    surfaceBaseTone = 8;  // Background-9 → Color-9
    useColor5ForContainers = false;
  } else if (tone === 70) {
    surfaceBaseTone = 9;  // Background-10 → Color-10
    useColor5ForContainers = false;
  } else if (tone === 76) {
    surfaceBaseTone = 10;  // Background-11 → Color-11
    useColor5ForContainers = false;
  } else if (tone === 82) {
    surfaceBaseTone = 11;  // Background-12 → Color-12
    useColor5ForContainers = false;
  } else if (tone === 85) {
    surfaceBaseTone = 12;  // Background-13 → Color-13
    useColor5ForContainers = false;
  } else if (tone === 89) {
    surfaceBaseTone = 13;  // Background-14 → Color-14
    useColor5ForContainers = false;
  }

  const surfaceColor = palette[surfaceBaseTone]?.color || baseColor;
  const surfaceDimColor = blendColors('#000000', surfaceColor, surfaceDimBlack);
  const surfaceBrightColor = blendColors('#FFFFFF', surfaceColor, surfaceBrightWhite);

  // Use Color-5 or Color-4 for containers
  const containerColor = useColor5ForContainers 
    ? (palette[4]?.color || '#000000')  // Color-5
    : (palette[3]?.color || '#000000'); // Color-4

  // ========================================================================
  // CRITICAL FIX: Return TOKEN REFERENCES for Dark Mode too!
  // ========================================================================
  
  const surfaceColorNumber = surfaceBaseTone + 1; // e.g., 0 → Color-1, 12 → Color-13
  
  if (paletteName) {
    return {
      Surfaces: {
        'Surface': {
          value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
          type: 'color'
        },
        'Surface-Dim': {
          value: surfaceDimColor, // Blended color, keep as hex
          type: 'color'
        },
        'Surface-Bright': {
          value: surfaceBrightColor, // Blended color, keep as hex
          type: 'color'
        }
      },
      Containers: {
        'Container': {
          value: containerColor, // Blended color, keep as hex
          type: 'color'
        },
        'Container-Lowest': {
          value: containerColor, // Blended color, keep as hex
          type: 'color'
        },
        'Container-Low': {
          value: containerColor, // Blended color, keep as hex
          type: 'color'
        },
        'Container-High': {
          value: containerColor, // Blended color, keep as hex
          type: 'color'
        },
        'Container-Highest': {
          value: containerColor, // Blended color, keep as hex
          type: 'color'
        }
      }
    };
  }

  // Fallback: return hex colors (for backwards compatibility)
  return {
    Surfaces: {
      'Surface': {
        value: surfaceColor,
        type: 'color'
      },
      'Surface-Dim': {
        value: surfaceDimColor,
        type: 'color'
      },
      'Surface-Bright': {
        value: surfaceBrightColor,
        type: 'color'
      }
    },
    Containers: {
      'Container': {
        value: containerColor,
        type: 'color'
      },
      'Container-Lowest': {
        value: containerColor,
        type: 'color'
      },
      'Container-Low': {
        value: containerColor,
        type: 'color'
      },
      'Container-High': {
        value: containerColor,
        type: 'color'
      },
      'Container-Highest': {
        value: containerColor,
        type: 'color'
      }
    }
  };
}