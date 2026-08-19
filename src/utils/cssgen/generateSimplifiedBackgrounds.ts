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
  // (The per-level container blend percentages that used to live here are gone:
  // light-mode containers are now flat at Color-11 and don't step.)

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

  // (Tonal light containers used to blend from Color-10 toward the surface.
  // They're now flat at Color-11, emitted as a token ref, so no base colour
  // needs computing here.)

  // ========================================================================
  // CRITICAL FIX: Return TOKEN REFERENCES, not hex colors!
  // CSS must be generated from JSON, so JSON must contain token references
  // ========================================================================
  
  // Convert Color-N index (0-13) to Color-N name (1-14)
  const surfaceColorNumber = Math.min(surfaceBaseTone + 1, 12); // Cap at Color-12 (max in 12-tone scale)
  const containerColorNumber = useColor10ForContainers ? 10 : 12; // Color-10 or Color-12 (capped)
  // Surface-Dim / Surface-Bright are adjacent palette tones so they stay in the
  // brand color family (instead of falling out to a desaturated black/white blend).
  const dimColorNumber = Math.max(surfaceColorNumber - 1, 1);
  const brightColorNumber = Math.min(surfaceColorNumber + 1, 12);
  const surfaceDimToken = paletteName ? `{Colors.${paletteName}.Color-${dimColorNumber}}` : surfaceDimColor;
  const surfaceBrightToken = paletteName ? `{Colors.${paletteName}.Color-${brightColorNumber}}` : surfaceBrightColor;
  
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
            value: surfaceDimToken,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightToken,
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
            value: surfaceDimToken,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightToken,
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
            value: surfaceDimToken,
            type: 'color'
          },
          'Surface-Bright': {
            value: surfaceBrightToken,
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
    
    // Tonal mode, light: all five container levels share ONE tone. Light mode
    // conveys elevation with drop shadows, so the container colour does not
    // step — unlike dark mode, where shadows don't read and the tone steps
    // Color-2 → Color-4 instead (see generateSimplifiedDarkModeBackgrounds).
    //
    // Which tone depends on the background it sits on. A light background takes
    // Color-11 (a near-white card). A DARK background must not: a near-white
    // card on a near-black page is wrong, and the theme's foreground tokens are
    // keyed for a dark card, so it would put dark text on a light container.
    // Dark backgrounds therefore keep a near-black card at Color-2.
    //
    // Tones 1-5 are the dark half of the ramp and 6-12 the light half, so the
    // split sits at surfaceBaseTone (0-based) >= 5.
    //
    // The previous logic blended Color-10 toward the surface by a per-level
    // percentage (0.12 → 0.22), producing five distinct off-palette colours.
    // That put containers on tones the foreground tables were never keyed for,
    // which is what broke Quiet/Text/Header contrast on tonal themes.
    const backgroundIsLight = surfaceBaseTone >= 5;
    const tonalContainerTone = backgroundIsLight ? 11 : 2;
    console.log(`🎨 [TONAL MODE] Palette: ${paletteName}, Tone: ${tone} — containers flat at Color-${tonalContainerTone}`);

    return {
      Surfaces: {
        'Surface': {
          value: `{Colors.${paletteName}.Color-${surfaceColorNumber}}`,
          type: 'color'
        },
        'Surface-Dim': {
          value: surfaceDimToken,
          type: 'color'
        },
        'Surface-Bright': {
          value: surfaceBrightToken,
          type: 'color'
        }
      },
      Containers: {
        // Flat across all five levels — elevation comes from drop shadows in
        // light mode, not tone. Color-11 on a light background, Color-2 on a
        // dark one. Emitted as a token ref so it stays linked to the palette.
        'Container-Lowest': {
          value: `{Colors.${paletteName}.Color-${tonalContainerTone}}`,
          type: 'color'
        },
        'Container-Low': {
          value: `{Colors.${paletteName}.Color-${tonalContainerTone}}`,
          type: 'color'
        },
        'Container': {
          value: `{Colors.${paletteName}.Color-${tonalContainerTone}}`,
          type: 'color'
        },
        'Container-High': {
          value: `{Colors.${paletteName}.Color-${tonalContainerTone}}`,
          type: 'color'
        },
        'Container-Highest': {
          value: `{Colors.${paletteName}.Color-${tonalContainerTone}}`,
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
  const surfaceColor = palette[surfaceBaseTone]?.color || baseColor;
  const surfaceDimColor = blendColors('#000000', surfaceColor, surfaceDimBlack);
  const surfaceBrightColor = blendColors('#FFFFFF', surfaceColor, surfaceBrightWhite);

  // Dark-mode elevation is conveyed by STEPPING the container tone lighter,
  // because drop shadows barely read dark-on-dark. The five levels are anchored
  // to the palette's dark low tones (Color-2 → Color-4) with the in-between
  // levels as 50% blends, so a more elevated container catches more light:
  //
  //   Container-Lowest  = Color-2
  //   Container-Low     = 50% blend of Color-2 and Color-3
  //   Container         = Color-3
  //   Container-High    = 50% blend of Color-3 and Color-4
  //   Container-Highest = Color-4
  //
  // These are anchored to the dark end of the palette regardless of which
  // background you're on — they do NOT shift with the background tone. The
  // previous logic collapsed all five levels onto a single tone (Color-5 for
  // backgrounds 1-7, Color-4 for 8-12), which left dark mode with no elevation
  // cue at all and put every container on one colour.
  // The Neutral (black) theme anchors its ramp ONE tone lower so cards read as
  // near-black (Container = Color-2 #111111) on a true-black Color-1 surface,
  // instead of the Color-3 grey that looked too light. Colored dark themes keep
  // the Color-2/3/4 ramp. See the surfaceColorNumber shift below (black surface
  // → Color-1) so the Color-2 card isn't the same tone as the surface.
  // Only the actual BLACK Neutral background (its two darkest tones) shifts down;
  // lighter Neutral (grey) themes keep the standard Color-2/3/4 ramp.
  const isNeutralBlack = paletteName === 'Neutral' && surfaceBaseTone <= 1;
  const rampLowN = isNeutralBlack ? 1 : 2;
  const rampMidN = isNeutralBlack ? 2 : 3;
  const rampHighN = isNeutralBlack ? 3 : 4;
  const darkColorLow = palette[rampLowN - 1]?.color || '#111111';
  const darkColorMid = palette[rampMidN - 1]?.color || '#1f1f1f';
  const darkColorHigh = palette[rampHighN - 1]?.color || '#2c2c2c';
  const containerLowestColor = darkColorLow;
  const containerLowColor = blendColors(darkColorMid, darkColorLow, 0.50);
  const containerColor = darkColorMid;
  const containerHighColor = blendColors(darkColorHigh, darkColorMid, 0.50);
  const containerHighestColor = darkColorHigh;

  // ========================================================================
  // CRITICAL FIX: Return TOKEN REFERENCES for Dark Mode too!
  // ========================================================================
  
  const surfaceColorNumber = Math.min(surfaceBaseTone + 1, 12); // Cap at Color-12 (max in 12-tone scale)
  // Black (Neutral) surface drops to Color-1 (#040404, true black) so the
  // near-black Color-2 card sits one tone above it instead of matching it.
  const surfaceN = isNeutralBlack ? 1 : surfaceColorNumber;
  // Surface-Dim / Surface-Bright = adjacent palette tones so they stay in the
  // brand color family instead of falling out to a desaturated black/white blend.
  const dimColorNumber = Math.max(surfaceColorNumber - 1, 1);
  const brightColorNumber = Math.min(surfaceColorNumber + 1, 12);
  const surfaceDimToken = paletteName ? `{Colors.${paletteName}.Color-${dimColorNumber}}` : surfaceDimColor;
  const surfaceBrightToken = paletteName ? `{Colors.${paletteName}.Color-${brightColorNumber}}` : surfaceBrightColor;

  if (paletteName) {
    return {
      Surfaces: {
        'Surface': {
          value: `{Colors.${paletteName}.Color-${surfaceN}}`,
          type: 'color'
        },
        'Surface-Dim': {
          value: surfaceDimToken,
          type: 'color'
        },
        'Surface-Bright': {
          value: surfaceBrightToken,
          type: 'color'
        }
      },
      Containers: {
        // Stepping ramp — see the anchor comment above. The endpoint tones are
        // emitted as token refs so they stay linked to the palette; the two
        // in-between levels are blends and have no token, so they stay hex.
        // Neutral (black) anchors one tone lower (Color-1/2/3) so cards read
        // near-black; colored dark themes use Color-2/3/4.
        'Container-Lowest': {
          value: `{Colors.${paletteName}.Color-${rampLowN}}`,
          type: 'color'
        },
        'Container-Low': {
          value: containerLowColor,
          type: 'color'
        },
        'Container': {
          value: `{Colors.${paletteName}.Color-${rampMidN}}`,
          type: 'color'
        },
        'Container-High': {
          value: containerHighColor,
          type: 'color'
        },
        'Container-Highest': {
          value: `{Colors.${paletteName}.Color-${rampHighN}}`,
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
      // Same stepping ramp as the token-ref branch above, as raw hex.
      'Container-Lowest': {
        value: containerLowestColor,
        type: 'color'
      },
      'Container-Low': {
        value: containerLowColor,
        type: 'color'
      },
      'Container': {
        value: containerColor,
        type: 'color'
      },
      'Container-High': {
        value: containerHighColor,
        type: 'color'
      },
      'Container-Highest': {
        value: containerHighestColor,
        type: 'color'
      }
    }
  };
}