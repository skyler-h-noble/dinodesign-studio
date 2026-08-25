import { blendColors, generateSemanticLightModeScale } from '../colorScale';

/**
 * The Neutral ramp, from the same seed the export builds it from
 * (SEMANTIC_SEEDS.neutral in generateFullPalettes). White and black cards are
 * always NEUTRAL — Color-12 and Color-1 — regardless of which palette's
 * Background-N row they are being generated into, so their blends need the
 * neutral hexes even when `palette` is Primary or Success.
 *
 * Deriving it rather than hardcoding keeps it in step with the palette the
 * token references actually resolve against.
 */
const NEUTRAL_TONES = generateSemanticLightModeScale('#808080').map((t) => t.hex);
const NEUTRAL_WHITE = NEUTRAL_TONES[11];   // Color-12
const NEUTRAL_BLACK = NEUTRAL_TONES[0];    // Color-1

/**
 * Type definition for simplified surfaces and containers
 */
export interface SimplifiedSurfacesAndContainers {
  Surfaces: {
    Surface: { value: string; type: string };
    'Surface-Dim': { value: string; type: string };
    'Surface-Bright': { value: string; type: string };
    // The two ends. They used to be read off OTHER Background-N rows
    // (Dimmest from Background-(N-2), Brightest from Background-11/12), which
    // works in light mode only because Background-N is 1:1 with Color-N there.
    // Dark mode is not 1:1 — all five levels collapse into tones 1-5 — so the
    // ends need their own entries or they land on whatever another row happens
    // to hold. See addSurfaceEnds.
    'Surface-Dimmest': { value: string; type: string };
    'Surface-Brightest': { value: string; type: string };
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
/** What the generators below build: everything except the two ends, which
 *  addSurfaceEnds fills in for both modes from one rule. */
type SurfacesWithoutEnds = Omit<SimplifiedSurfacesAndContainers, 'Surfaces'> & {
  Surfaces: Omit<SimplifiedSurfacesAndContainers['Surfaces'], 'Surface-Dimmest' | 'Surface-Brightest'>
    & Partial<Pick<SimplifiedSurfacesAndContainers['Surfaces'], 'Surface-Dimmest' | 'Surface-Brightest'>>;
};

function lightModeBackgroundsBase(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false,
  paletteName?: string,
  containerStyle: 'tonal' | 'professional' | 'black' = 'tonal'
): SurfacesWithoutEnds {
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
    // The lightest-Neutral override is GONE.
    //
    // It forced all five containers to {White} whenever paletteName was Neutral
    // and tone was 99, ignoring containerStyle entirely. Its comment called that
    // row "Background-14" — a leftover from the 14-tone scale, where tone 99 was
    // a separate near-white step above the container tones. On the 12-tone scale
    // tone 99 IS Color-12, the ordinary white background, so it fired for every
    // white-background system.
    //
    // It existed because the caller hardcoded 'tonal', which made the
    // professional branch unreachable and left this as the only way white cards
    // could be white. The caller now passes the real card style through, so each
    // style has its own ramp and this hack has nothing left to do. It is also
    // what produced `--Container: #ffffff` in Cocktail Hour, Surf's Up,
    // Chocolated and Omni Design.

    // Professional mode: WHITE cards, as an elevation ramp rather than five
    // identical whites. Same idea as the tonal ramp below and as dark mode —
    // one colour at five opacities over the background — but the opacities sit
    // much higher, because white cards are meant to read as white: the lower
    // levels only let a little of the page through.
    //
    //   Container-Lowest  = 92% Neutral Color-12 over the background
    //   Container-Low     = 94%
    //   Container         = 97%
    //   Container-High    = 98%
    //   Container-Highest = Neutral Color-12
    //
    // Only the top level is a real colour, so only it keeps a token reference;
    // the rest are blends and stay hex. Mixing refs and blends is what made the
    // dark-mode ramp non-monotonic.
    if (containerStyle === 'professional') {
      const atWhite = (a: number) => blendColors(NEUTRAL_WHITE, surfaceColor, a);
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
            value: atWhite(0.97),
            type: 'color'
          },
          'Container-Lowest': {
            value: atWhite(0.92),
            type: 'color'
          },
          'Container-Low': {
            value: atWhite(0.94),
            type: 'color'
          },
          'Container-High': {
            value: atWhite(0.98),
            type: 'color'
          },
          'Container-Highest': {
            value: '{Colors.Neutral.Color-12}',
            type: 'color'
          }
        }
      };
    }

    // Black mode: BLACK cards, as an elevation ramp. This one runs the OTHER
    // way: the floor is the pure colour and the higher levels let a little of
    // the page bleed through, so a raised card lightens against a light page.
    //
    //   Container-Lowest  = Neutral Color-1 (100%)
    //   Container-Low     = 96% Neutral Color-1 over the background
    //   Container         = 94%
    //   Container-High    = 92%
    //   Container-Highest = 90%
    //
    // So the pure level — the one that keeps a token reference — is Lowest
    // here, not Highest. Everything else is a blend and stays hex.
    if (containerStyle === 'black') {
      const atBlack = (a: number) => blendColors(NEUTRAL_BLACK, surfaceColor, a);
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
            value: atBlack(0.94),
            type: 'color'
          },
          'Container-Lowest': {
            value: '{Colors.Neutral.Color-1}',
            type: 'color'
          },
          'Container-Low': {
            value: atBlack(0.96),
            type: 'color'
          },
          'Container-High': {
            value: atBlack(0.92),
            type: 'color'
          },
          'Container-Highest': {
            value: atBlack(0.90),
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
    // Which tone depends on the background it sits on — on its LIGHTNESS, not
    // on the mode. A light background takes Color-10. A DARK background must
    // not: a near-white card on a near-black page is wrong, and the theme's
    // foreground tokens are keyed for a dark card, so it would put dark text on
    // a light container. Dark backgrounds therefore keep a near-black card at
    // Color-2.
    //
    // A black background in LIGHT mode is still a dark background. Keying this
    // on the mode instead is precisely the bug buildPreviewCSS carried: it
    // painted a near-white Color-10 card on a black page while this side
    // emitted Color-2, and nothing failed because each side was internally
    // consistent. src/__tests__/containerTone.test.ts is the detector.
    //
    // Color-10 rather than 11: a tonal container should read as a distinct card
    // ON the surface, and at Color-11 against a Color-10/11 surface the edge
    // only showed up through the drop shadow — on the lightest surfaces it
    // vanished entirely.
    //
    // Tones 1-5 are the dark half of the ramp and 6-12 the light half, so the
    // split sits at surfaceBaseTone (0-based) >= 5.
    //
    // The previous logic blended Color-10 toward the surface by a per-level
    // percentage (0.12 → 0.22), producing five distinct off-palette colours.
    // That put containers on tones the foreground tables were never keyed for,
    // which is what broke Quiet/Text/Header contrast on tonal themes.
    const backgroundIsLight = surfaceBaseTone >= 5;
    const tonalContainerTone = backgroundIsLight ? 10 : 2;

    // Elevation ramp — the same shape dark mode uses (see
    // darkModeBackgroundsBase): ONE tone at five opacities rather than five
    // different tones, so every level is unmistakably the same material and the
    // steps can sit closer together than whole tones allow.
    //
    // Here the backing is the BACKGROUND itself, so a less elevated container
    // sinks toward the page and a more elevated one comes fully forward:
    //
    //   Container-Lowest  = 65% of the tone over the background (blends most)
    //   Container-Low     = 75%
    //   Container         = 85%
    //   Container-High    = 90%
    //   Container-Highest = no blend — the tone itself (Color-10 / Color-2)
    //
    // Only Container-Highest is a palette colour, so only it can be a token
    // reference. Emitting refs for the others is what produced a NON-MONOTONIC
    // ramp in dark mode: the refs resolved to whole tones while the neighbours
    // resolved to blends, so the levels came off two different curves.
    //
    // This is NOT the per-level 0.12 → 0.22 blend that was reverted. That one
    // moved every level off the tone the foreground tables are keyed to
    // (config.contN), including Container itself, which is what broke
    // Quiet/Text/Header contrast on tonal themes. Here the anchor tone is still
    // in the ramp and the blend runs toward the background — away from the
    // text, which is chosen to contrast the container — so each step gains
    // contrast against the keyed foreground rather than losing it.
    // Collision: on Background-10 (light) and Background-2 (dark) the surface IS
    // the container tone, so every opacity blends Color-N with Color-N and the
    // card disappears into the page — no elevation, no edge, at all five
    // levels. Measured across a full export that was 16 of 103 Background-N
    // combos, i.e. every palette's Background-2 and Background-10.
    //
    // Step one tone AWAY from the page in that case: a raised card catches more
    // light, so Color-11 on a Color-10 surface and Color-3 on a Color-2 one.
    const faceTone = surfaceColorNumber === tonalContainerTone
      ? (backgroundIsLight ? 11 : 3)
      : tonalContainerTone;
    const containerFace = palette[faceTone - 1]?.color || surfaceColor;
    const atOpacity = (a: number) => blendColors(containerFace, surfaceColor, a);
    const containerLowestColor = atOpacity(0.65);
    const containerLowColor = atOpacity(0.75);
    const containerColor = atOpacity(0.85);
    const containerHighColor = atOpacity(0.90);
    console.log(`🎨 [TONAL MODE] Palette: ${paletteName}, Tone: ${tone} — containers ramp to Color-${tonalContainerTone}`);

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
        // Four blends and one pure tone — see the ramp comment above. The
        // blends have no token to point at, so they stay hex; only the top
        // level stays linked to the palette.
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
          value: `{Colors.${paletteName}.Color-${faceTone}}`,
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
function darkModeBackgroundsBase(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  paletteName?: string
): SurfacesWithoutEnds {
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
  // Containers are ONE tone at five opacities, not five tones: Color-3
  // composited over Color-2 at 50 / 65 / 75 / 85 / 100%. Elevation reads as the
  // container gaining presence against a fixed backdrop rather than marching
  // through the palette, so the five levels stay unmistakably the same material
  // and the steps can sit closer together than whole tones allow.
  const containerBacking = palette[1]?.color || '#111111';   // Color-2
  const containerFace = palette[2]?.color || '#1f1f1f';      // Color-3
  const atOpacity = (a: number) => blendColors(containerFace, containerBacking, a);
  const containerLowestColor = atOpacity(0.50);
  const containerLowColor = atOpacity(0.65);
  const containerColor = atOpacity(0.75);
  const containerHighColor = atOpacity(0.90);
  const containerHighestColor = containerFace;

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
  // Dim is ONE TONE BELOW the surface, not black.
  //
  // It used to be pinned to the literal #000000, on the reasoning that Dim
  // "bottoms out at true black". That was right when Dim WAS the floor. It no
  // longer is: Surface-Dimmest owns the floor now, so pinning Dim to black put
  // it BELOW Dimmest and inverted the pair in every non-Neutral theme — dark
  // Primary read Dimmest L12, Dim L0, and the level names stopped meaning
  // anything. Measured across all nine themes, 7 of 8 resolvable ones were
  // inverted this way and none were clean.
  //
  // dimColorNumber was already computed here and then discarded with a void,
  // which is why the fix is to USE it rather than to derive anything new.
  const surfaceDimToken = paletteName
    ? `{Colors.${paletteName}.Color-${dimColorNumber}}`
    : surfaceDimColor;
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
        // Four blends and one pure tone. Only Container-Highest is a palette
        // colour, so only it can be a token reference — the rest are Color-3
        // composited over Color-2 and have no token to point at.
        //
        // Emitting token refs for Lowest/Container as well is what produced a
        // NON-MONOTONIC ramp: the refs resolved to whole tones (Color-2, -3, -4)
        // while Low and High resolved to blends, so the five levels came off two
        // different curves and Container-High landed BELOW Container.
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
          value: `{Colors.${paletteName}.Color-3}`,
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

/**
 * The five surface levels, in order. Dimmest and Brightest are computed HERE
 * rather than inside each of the generators' several return branches, so one
 * rule covers every branch and the two modes cannot drift apart.
 *
 * LIGHT keeps the historical derivation, which is why light mode is unchanged:
 * Background-N is 1:1 with Color-N there, so Dimmest is two tones down and
 * Brightest is the tone the retired <Palette>-Light themes used.
 *
 * DARK puts all five levels on tones 1-5 regardless of N. The dark ramp is only
 * dark at its bottom (L 3, 5, 12, 18, 24 for Color-1..5; Color-9 is already
 * L76), so a theme's light-mode tone cannot simply carry over — that is what
 * left every theme with a mid-grey Surface-Bright and a near-white Brightest.
 * Five levels, five genuinely dark tones, ascending.
 */
function addSurfaceEnds(
  out: SurfacesWithoutEnds,
  _mode: 'light' | 'dark',
  n: number,
  paletteName?: string,
): SimplifiedSurfacesAndContainers {
  const ref = (tone: number) =>
    paletteName ? `{Colors.${paletteName}.Color-${tone}}` : out.Surfaces.Surface.value;

  // NOTE: dark mode does NOT yet remap the five levels onto tones 1-5.
  //
  // Doing so was implemented and reverted, because the tone INDEX is the key for
  // every foreground table — Text, Quiet, Border, Eyebrow and the BlackWhite
  // button face all read Color-<N> — and the theme layer is MODE-INDEPENDENT, so
  // that index is one value shared by light and dark. Moving the dark surface off
  // tone N while the index stays N unpairs every foreground from the backdrop it
  // was computed against. It surfaced immediately as a black button on a dark
  // surface (tokenParity, olive/dark/Primary: surface #1e2117, fill #0b0b0b).
  //
  // The ends still get their own entries below, which is a prerequisite for any
  // future remap: without them Dimmest and Brightest read OTHER rows' Surface.

  // Light: unchanged from what the theme layer used to assemble by hand.
  const dimmestN = Math.max(n - 2, 1);
  const brightN = Math.min(n + 1, 12);
  const brightestN = brightN >= 11 ? 12 : 11;
  out.Surfaces['Surface-Dimmest'] = n > 2
    ? { value: ref(dimmestN), type: 'color' }
    : { value: '#000000', type: 'color' };
  out.Surfaces['Surface-Brightest'] = brightN >= 12
    ? { value: '#ffffff', type: 'color' }
    : { value: ref(brightestN), type: 'color' };
  return out as SimplifiedSurfacesAndContainers;
}

/** Background-N's tone index, matched to the closest palette entry. */
function toneIndexFor(tone: number, palette: { tone: number; color: string }[]): number {
  let best = 0, bestDiff = Math.abs((palette[0]?.tone ?? 0) - tone);
  for (let i = 1; i < palette.length; i++) {
    const d = Math.abs((palette[i]?.tone ?? 0) - tone);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return Math.min(best, 11) + 1;
}

export function generateSimplifiedLightModeBackgrounds(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false,
  paletteName?: string,
  containerStyle: 'tonal' | 'professional' | 'black' = 'tonal',
): SimplifiedSurfacesAndContainers {
  const out = lightModeBackgroundsBase(baseColor, tone, palette, isChromatic, paletteName, containerStyle);
  return addSurfaceEnds(out, 'light', toneIndexFor(tone, palette), paletteName);
}

export function generateSimplifiedDarkModeBackgrounds(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  paletteName?: string,
): SimplifiedSurfacesAndContainers {
  const out = darkModeBackgroundsBase(baseColor, tone, palette, paletteName);
  return addSurfaceEnds(out, 'dark', toneIndexFor(tone, palette), paletteName);
}
