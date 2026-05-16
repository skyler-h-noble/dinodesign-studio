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

  // SIMPLIFIED 1:1 mapping — Background-N uses Color-N regardless of tone-scale
  // values. Find the palette entry whose tone is closest to `tone` and use its
  // index. (Previously a hard-coded if/else ladder that only recognised the
  // old 14-tone scale; tones 58+ from the current 12-tone scale fell through
  // to the default surfaceBaseTone=0 → Color-1 → near-black, which is why
  // Background-6..12 imported as black.)
  let bestIdx = 0;
  let bestDiff = Math.abs((palette[0]?.tone ?? 0) - tone);
  for (let i = 1; i < palette.length; i++) {
    const d = Math.abs((palette[i]?.tone ?? 0) - tone);
    if (d < bestDiff) { bestDiff = d; bestIdx = i; }
  }
  surfaceBaseTone = Math.min(bestIdx, 11);
  // Container tone: lighter-half backgrounds (Color-1..7) use a saturated
  // container tone (Color-10); darker-half backgrounds (Color-8..12) need a
  // lighter container so text stays legible — use Color-12 capped.
  useColor10ForContainers = surfaceBaseTone <= 6;

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
  const surfaceColorNumber = Math.min(surfaceBaseTone + 1, 12); // Cap at Color-12 (max in 12-tone scale)
  const containerColorNumber = useColor10ForContainers ? 10 : 12; // Color-10 or Color-12 (capped)
  
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

  // SIMPLIFIED 1:1 mapping — Background-N uses Color-N. Match the input tone
  // to the closest palette entry instead of an if/else ladder, so future
  // tone-scale changes don't drop Background-N into the default Color-1.
  let bestIdx = 0;
  let bestDiff = Math.abs((palette[0]?.tone ?? 0) - tone);
  for (let i = 1; i < palette.length; i++) {
    const d = Math.abs((palette[i]?.tone ?? 0) - tone);
    if (d < bestDiff) { bestDiff = d; bestIdx = i; }
  }
  surfaceBaseTone = Math.min(bestIdx, 11);
  // Container tone in dark mode: lighter-half backgrounds (Color-1..7) use
  // a slightly lighter container (Color-5); darker-half backgrounds use the
  // even darker Color-4 so the container stays distinct from the surface.
  useColor5ForContainers = surfaceBaseTone <= 6;

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
  
  const surfaceColorNumber = Math.min(surfaceBaseTone + 1, 12); // Cap at Color-12 (max in 12-tone scale)
  
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