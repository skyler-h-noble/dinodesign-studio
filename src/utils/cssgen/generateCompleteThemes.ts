import { getSimplifiedDefaultSettings } from './completeSimplifiedSystem';
import { toneToColorNumber, generateSemanticLightModeScale, findClosestColorN } from '../colorScale';
import { neutralSurfaceWindow } from '../surfaceWindow';
import type { SurfaceLevel } from '../surfaceWindow';
// Text and Header roles reference the Text.*/Header.* families directly rather
// than the getFixed* helpers. Those helpers return a raw {Colors.Palette.Color-N}
// swatch, which is identical on every surface and in both modes — so an accent
// that was legible on a light surface stayed dark on a dark container, giving
// dark-on-dark text. The Text.Surfaces/Text.Containers tables already encode the
// accessible pairing per mode and per surface tone, so referencing them is both
// correct and self-maintaining.

/**
 * Theme configuration for generating Surfaces and Containers
 */
interface ThemeConfig {
  themeName: string;
  theme: string; // Primary, Secondary, Tertiary, Neutral
  n: number; // Color-N value (1-14)
  contTheme: string; // Container theme
  contN: number; // Container Color-N value
  shade: 'Light' | 'Medium'; // Button shade for Surfaces
  cShade: 'Light' | 'Medium'; // Button shade for Containers
  defaultText: string; // Text palette name
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  neutralText: string;
  infoText: string;
  successText: string;
  warningText: string;
  errorText: string;
  defaultHeader: string; // Header palette name
  primaryHeader: string;
  secondaryHeader: string;
  tertiaryHeader: string;
  neutralHeader: string;
  infoHeader: string;
  successHeader: string;
  warningHeader: string;
  errorHeader: string;
  // Palette the Default button's tokens (Border + Highlight + Lowlight) follow.
  // Derived from the user's button-mode choice via getButtonModeBorderMappings —
  // 'secondary' button mode → 'Secondary', 'primary' → 'Primary', etc. The
  // Default button's Button/Text already point at {Default-Button.Default…}
  // which resolves to the right palette, but Border + bevel were hardcoded to
  // the current theme's palette, so a Secondary-mode Default button on the
  // Default theme ended up with a Primary border. This field fixes that.
  defaultButtonPalette: string;
  /** True for tonal/laddered, where the Default button follows the surface's
   *  palette rather than one global palette. */
  surfaceScopedButton?: boolean;
  /** True for the black/white button style, whose border is its own fill. */
  blackWhiteButton?: boolean;
}

/**
 * Helper function to determine the container text palette based on container theme
 */
function getContainerTextPalette(contTheme: string, config: ThemeConfig): string {
  // Map container theme to its text palette
  // If container theme is Primary, use primary text palette, etc.
  switch (contTheme) {
    case 'Primary':
      return config.primaryText;
    case 'Secondary':
      return config.secondaryText;
    case 'Tertiary':
      return config.tertiaryText;
    case 'Neutral':
      return config.neutralText;
    default:
      return config.defaultText;
  }
}

/**
 * Helper function to determine the container header palette based on container theme
 */
function getContainerHeaderPalette(contTheme: string, config: ThemeConfig): string {
  // Map container theme to its header palette
  switch (contTheme) {
    case 'Primary':
      return config.primaryHeader;
    case 'Secondary':
      return config.secondaryHeader;
    case 'Tertiary':
      return config.tertiaryHeader;
    case 'Neutral':
      return config.neutralHeader;
    default:
      return config.defaultHeader;
  }
}

/**
 * Build the full surface token set for a given N value.
 * Returns everything from Quiet down to Tags (NOT the Surface entry itself).
 */
function buildSurfaceTokens(config: ThemeConfig, n: number): any {
  const shade = n >= 9 ? 'Medium' as const : 'Light' as const;
  return {
    'Quiet': {
      value: config.defaultText === 'BW'
        ? `{Quiet.Surfaces.Neutral.Color-${n}}`
        : `{Quiet.Surfaces.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Text': {
      // Both branches now reference the Text.Surfaces family — BW simply has
      // its own greyscale entry in that same table, so it needs no special
      // handling beyond picking the BW palette.
      value: config.defaultText === 'BW'
        ? `{Text.Surfaces.BW.Color-${n}}`
        : `{Text.Surfaces.${config.defaultText}.Color-${n}}`,
      type: 'color'
    },
    'Text-Primary': {
      value: `{Text.Surfaces.Primary.Color-${n}}`,
      type: 'color'
    },
    'Text-Secondary': {
      value: `{Text.Surfaces.Secondary.Color-${n}}`,
      type: 'color'
    },
    'Text-Tertiary': {
      value: `{Text.Surfaces.Tertiary.Color-${n}}`,
      type: 'color'
    },
    'Text-Neutral': {
      value: `{Text.Surfaces.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Text-Info': {
      value: `{Text.Surfaces.Info.Color-${n}}`,
      type: 'color'
    },
    'Text-Success': {
      value: `{Text.Surfaces.Success.Color-${n}}`,
      type: 'color'
    },
    'Text-Warning': {
      value: `{Text.Surfaces.Warning.Color-${n}}`,
      type: 'color'
    },
    'Text-Error': {
      value: `{Text.Surfaces.Error.Color-${n}}`,
      type: 'color'
    },
    'Header': {
      value: `{Header.Surfaces.${config.defaultHeader}.Color-${n}}`,
      type: 'color'
    },
    'Header-Primary': {
      value: `{Header.Surfaces.Primary.Color-${n}}`,
      type: 'color'
    },
    'Header-Secondary': {
      value: `{Header.Surfaces.Secondary.Color-${n}}`,
      type: 'color'
    },
    'Header-Tertiary': {
      value: `{Header.Surfaces.Tertiary.Color-${n}}`,
      type: 'color'
    },
    'Header-Neutral': {
      value: `{Header.Surfaces.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Header-Info': {
      value: `{Header.Surfaces.Info.Color-${n}}`,
      type: 'color'
    },
    'Header-Success': {
      value: `{Header.Surfaces.Success.Color-${n}}`,
      type: 'color'
    },
    'Header-Warning': {
      value: `{Header.Surfaces.Warning.Color-${n}}`,
      type: 'color'
    },
    'Header-Error': {
      value: `{Header.Surfaces.Error.Color-${n}}`,
      type: 'color'
    },
    'Border': {
      value: `{Border.Surfaces.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Border-Variant': {
      value: `{Border-Variant.Surfaces.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Hover': {
      value: `{Hover.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Pressed': {
      value: `{Pressed.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Hotlink': {
      // Hotlinks share the contrast-tuned Info text mapping so links read
      // on any surface tone without the user noticing fade-out on dark
      // backgrounds.
      //
      // DARK SURFACES take Color-Vibrant instead. On tones 1-4 the tone-mapped
      // Info text is a deep blue that a reader has to hunt for; Vibrant is the
      // light ramp's Color-8, bright enough to read as a link at a glance and
      // the same value the buttons and tags already use on dark.
      //
      // The cut is at 4, not 5. Tone 5 is L37 in light mode but L24 in dark —
      // the index means different lightnesses in the two ramps, and Vibrant
      // against a light-mode tone-5 surface measures 4.08-4.30, under the line.
      // Tone 5+ therefore keeps the mapped text.
      // {Colors.Info.Color-Vibrant} — the vibrant COLOUR itself, not
      // Text.Surfaces.Info.Color-Vibrant, which means "text to use ON a vibrant
      // surface" and is therefore dark. Pointing at the text table put a
      // near-black blue on a black surface at 1.20:1.
      value: n <= 4
        ? `{Colors.Info.Color-Vibrant}`
        : `{Text.Surfaces.Info.Color-${n}}`,
      type: 'color'
    },
    'Hotlink-Visited': {
      value: `{Text.Surfaces.Hotlink-Visited.Color-${n}}`,
      type: 'color'
    },
    'Focus-Visible': {
      value: `{Focus-Visible.Surfaces.Background-${n}}`,
      type: 'color'
    },

    // Buttons in Surfaces
    'Buttons': {
      'Default': (() => {
        // Semantic themes (Info, Success, Warning, Error) use their own palette
        // for the Default button — Border + bevel follow that semantic palette.
        const semanticThemes = ['Info', 'Success', 'Warning', 'Error'];
        if (semanticThemes.includes(config.theme)) {
          return {
            'Button': { value: `{Buttons.${config.theme}.${shade}.Button}`, type: 'color' },
            'Text': { value: `{Buttons.${config.theme}.${shade}.Text}`, type: 'color' },
            'Border': { value: `{Border.Surfaces.${config.theme}.Color-${n}}`, type: 'color' },
            'Hover': { value: `{Buttons.${config.theme}.${shade}.Hover}`, type: 'color' },
            'Pressed': { value: `{Buttons.${config.theme}.${shade}.Pressed}`, type: 'color' },
            'Highlight': { value: `{Button-Highlight.${config.theme}.Color-${n}}`, type: 'color' },
            'Lowlight': { value: `{Button-Lowlight.${config.theme}.Color-${n}}`, type: 'color' }
          };
        }
        // Non-semantic themes — Border + Highlight + Lowlight follow the user's
        // button-mode palette (defaultButtonPalette) so they match the body.
        // Black/white resolves per SURFACE TONE, from the table that already
        // encodes the rule: black face on light tones, white on dark, border
        // equal to the fill, text the inverse. Routing it through the single
        // Default-Button entry instead gave every theme the same face, which
        // put a black button on a black surface (1.0:1 — an invisible control).
        //
        // Tonal/laddered read the surface's own palette; the fixed modes keep
        // pointing at the single Default-Button entry.
        const src = config.blackWhiteButton
          // The Default theme takes the dedicated key: its surface moves
          // between modes, and its tone is shared with the White theme, so a
          // tone-keyed reference cannot describe both.
          ? (config.themeName === 'Default'
              ? 'Buttons.BlackWhite.Default'
              : `Buttons.BlackWhite.Color-${n}`)
          : config.surfaceScopedButton
            ? `Buttons.${config.defaultButtonPalette}.${shade}`
            : `Default-Button.Default.${shade}`;
        return {
          'Button': { value: `{${src}.Button}`, type: 'color' },
          'Text': { value: `{${src}.Text}`, type: 'color' },
          // A black or white button has no tonal ramp to step to for an edge,
          // so its border is its own fill — the face alone delineates it. The
          // BlackWhite table already stores Border that way.
          'Border': config.blackWhiteButton
            ? { value: `{${src}.Border}`, type: 'color' }
            : { value: `{Border.Surfaces.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' },
          'Hover': { value: `{${src}.Hover}`, type: 'color' },
          'Pressed': { value: `{${src}.Pressed}`, type: 'color' },
          'Highlight': { value: `{Button-Highlight.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' },
          'Lowlight': { value: `{Button-Lowlight.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' }
        };
      })(),
      'Primary': {
        'Button': { value: `{Buttons.Primary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Primary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Primary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Primary.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Primary.${shade}.Pressed}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Buttons.Secondary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Secondary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Secondary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Secondary.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Secondary.${shade}.Pressed}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Buttons.Tertiary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Tertiary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Tertiary.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Tertiary.${shade}.Pressed}`, type: 'color' }
      },
      // BlackWhite — linked to the tone-keyed Buttons.BlackWhite table at THIS
      // surface's own tone, so the face follows the background it lands on
      // (white on dark surfaces, black on light) without the consumer picking.
      // Every slot comes from the same tone so the fill, label, border and
      // bevel can never describe different faces.
      'BlackWhite': {
        'Button': { value: `{Buttons.BlackWhite.Color-${n}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.BlackWhite.Color-${n}.Text}`, type: 'color' },
        'Border': { value: `{Buttons.BlackWhite.Color-${n}.Border}`, type: 'color' },
        'Hover': { value: `{Buttons.BlackWhite.Color-${n}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.BlackWhite.Color-${n}.Pressed}`, type: 'color' },
        'Highlight': { value: `{Buttons.BlackWhite.Color-${n}.Highlight}`, type: 'color' },
        'Lowlight': { value: `{Buttons.BlackWhite.Color-${n}.Lowlight}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Buttons.Neutral.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Neutral.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Neutral.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Neutral.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Neutral.${shade}.Pressed}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Buttons.Info.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Info.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Info.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Info.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Info.${shade}.Pressed}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Buttons.Success.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Success.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Success.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Success.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Success.${shade}.Pressed}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Buttons.Warning.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Warning.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Warning.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Warning.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Warning.${shade}.Pressed}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Buttons.Error.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Error.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Error.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Error.${shade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Error.${shade}.Pressed}`, type: 'color' }
      }
    },

    // Icons in Surfaces — tonal: theme color, BW: same as text
    'Icons': {
      'Default': { value: config.defaultText === 'BW' ? `{Text.Surfaces.BW.Color-${n}}` : `{Icon.Surfaces.${config.theme}.Color-${n}}`, type: 'color' },
      'Default-Variant': { value: config.defaultText === 'BW' ? `{Text.Surfaces.BW.Color-${n}}` : `{Icon-Variant.Surfaces.${config.theme}.Color-${n}}`, type: 'color' },
      'Primary': { value: `{Icon.Surfaces.Primary.Color-${n}}`, type: 'color' },
      'Primary-Variant': { value: `{Icon-Variant.Surfaces.Primary.Color-${n}}`, type: 'color' },
      'Secondary': { value: `{Icon.Surfaces.Secondary.Color-${n}}`, type: 'color' },
      'Secondary-Variant': { value: `{Icon-Variant.Surfaces.Secondary.Color-${n}}`, type: 'color' },
      'Tertiary': { value: `{Icon.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
      'Tertiary-Variant': { value: `{Icon-Variant.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
      'Neutral': { value: `{Icon.Surfaces.Neutral.Color-${n}}`, type: 'color' },
      'Neutral-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${n}}`, type: 'color' },
      'Info': { value: `{Icon.Surfaces.Info.Color-${n}}`, type: 'color' },
      'Info-Variant': { value: `{Icon-Variant.Surfaces.Info.Color-${n}}`, type: 'color' },
      'Success': { value: `{Icon.Surfaces.Success.Color-${n}}`, type: 'color' },
      'Success-Variant': { value: `{Icon-Variant.Surfaces.Success.Color-${n}}`, type: 'color' },
      'Warning': { value: `{Icon.Surfaces.Warning.Color-${n}}`, type: 'color' },
      'Warning-Variant': { value: `{Icon-Variant.Surfaces.Warning.Color-${n}}`, type: 'color' },
      'Error': { value: `{Icon.Surfaces.Error.Color-${n}}`, type: 'color' },
      'Error-Variant': { value: `{Icon-Variant.Surfaces.Error.Color-${n}}`, type: 'color' }
    },

    // Tags in Surfaces — text references the tag's own text token (already has correct tonal/BW palette)
    'Tag': {
      'Primary': {
        'BG': { value: `{Tag.${shade}.Primary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Primary.Text.Primary}`, type: 'color' }
      },
      'Secondary': {
        'BG': { value: `{Tag.${shade}.Secondary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Secondary.Text.Secondary}`, type: 'color' }
      },
      'Tertiary': {
        'BG': { value: `{Tag.${shade}.Tertiary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Tertiary.Text.Tertiary}`, type: 'color' }
      },
      'Info': {
        'BG': { value: `{Tag.${shade}.Info.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Info.Text.Info}`, type: 'color' }
      },
      'Success': {
        'BG': { value: `{Tag.${shade}.Success.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Success.Text.Success}`, type: 'color' }
      },
      'Warning': {
        'BG': { value: `{Tag.${shade}.Warning.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Warning.Text.Warning}`, type: 'color' }
      },
      'Error': {
        'BG': { value: `{Tag.${shade}.Error.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Error.Text.Error}`, type: 'color' }
      },
      'Neutral': {
        'BG': { value: `{Tag.${shade}.Neutral.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.Neutral.Text.Neutral}`, type: 'color' }
      }
    }
  };
}

/**
 * Generate a single theme with Surfaces (per variant) and Containers sections
 */
function generateSingleTheme(config: ThemeConfig): any {
  const theme: any = {};

  // Surfaces Section — each surface variant gets its own complete token set
  const dimN = Math.max(config.n - 1, 1);
  // Surface-Dimmest = one tone darker than Surface-Dim (config.n - 2), floored
  // at black. Relative to the theme's own surface — NOT pinned to a fixed
  // Color-4 — so it's always the darkest surface, never coincides with
  // Surface-Dim (which it did on the State themes, whose Dim already landed on
  // Color-4), and re-themes like Dim/Bright do.
  const dimmestN = Math.max(config.n - 2, 1);
  const brightN = Math.min(config.n + 1, 12);

  // Neutral's window is LOCKED, not derived: black / 9 / 10 / 11 / white. It is
  // the theme that replaced White, Light-Gray and Black, so it has to span the
  // whole scale instead of sitting in a four-tone band.
  //
  // This wiring is what was missing. neutralSurfaceWindow() and its tests
  // shipped, but nothing in the generator called them, so Neutral fell through
  // to the derived rule above and Surface-Dimmest painted Color-8 - a mid grey -
  // while navSelectionToSource already mapped the retired Black theme onto it.
  // Reading the module here rather than restating black/white keeps ONE
  // definition of the lock; a second copy is how the two drift apart again.
  // themeName, NOT theme. `theme` is the PALETTE, and Default sets it to the
  // Neutral palette on any grey system - keying off it locked Default's ends to
  // black and white too, which is a different theme entirely.
  const locked = config.themeName === 'Neutral' ? neutralSurfaceWindow() : null;
  const lockStep = (level: SurfaceLevel) => locked?.find((s) => s.level === level) ?? null;

  // A locked end paints the anchor outright; every foreground table is still
  // keyed by toneIndex (1 for black, 12 for white), which is what keeps Text,
  // Quiet, Border and Eyebrow resolving on a surface that has no tone of its own.
  const dimmestLock = lockStep('Surface-Dimmest');

  // Only the DARK end is pinned to a literal. The two ends are not symmetric:
  //
  //   Dimmest  - no tone is true black (Color-1 is L1 in light mode, L3 in dark),
  //              so black can only come from a literal. The darkest surface being
  //              black in BOTH modes is what the retired Black theme did anyway.
  //   Brightest - Neutral's Color-12 IS pure white, so the tone reference already
  //              paints white in light mode AND keeps aliasing into Modes, which a
  //              literal would break. A hard #ffffff would force a blinding white
  //              surface in DARK mode, where Background-12 correctly resolves to
  //              the dark ramp's top instead.
  //
  // So neutralSurfaceWindow's whiteStep is honoured through the tone it indexes
  // (12) rather than through its paint. Same colour in light mode, still mode-
  // aware in dark.

  // Base Surface — reference Backgrounds structure for Light/Dark mode adaptation
  theme.Surfaces = {
    'Background': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, config.n)
  };

  // Surface-Dim
  theme['Surfaces-Dim'] = {
    'Background': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface-Dim}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, dimN)
  };

  // Surface-Dimmest
  theme['Surfaces-Dimmest'] = {
    'Background': {
      value: dimmestLock?.paint.kind === 'black' || config.n <= 2
        ? '#000000'
        : `{Backgrounds.${config.theme}.Background-${dimmestLock ? dimmestLock.toneIndex : dimmestN}.Surfaces.Surface}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, dimmestLock ? dimmestLock.toneIndex : dimmestN)
  };

  // Surface-Bright
  theme['Surfaces-Bright'] = {
    'Background': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface-Bright}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, brightN)
  };

  // Surface-Brightest
  //
  // The light counterpart of Surface-Dimmest, and the level that absorbs
  // <Palette>-Light: that theme's Surface was tone 11, so landing here makes
  // the replacement the same colour rather than an approximation of it.
  //
  // 11 unless Bright has already taken it (Surface at 10), in which case 12.
  // Above that the ramp is exhausted and it paints white outright — the same
  // shape as Dimmest falling through to black when the tone runs out below.
  const brightestN = brightN >= 11 ? 12 : 11;
  theme['Surfaces-Brightest'] = {
    'Background': {
      value: brightN >= 12
        ? '#ffffff'
        : `{Backgrounds.${config.theme}.Background-${brightestN}.Surfaces.Surface}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, brightestN)
  };

  // Containers Section — reference Modes/Containers for Light/Dark mode adaptation
  theme.Containers = {
    'Container': {
      value: `{Backgrounds.${config.contTheme}.Background-${config.contN}.Containers.Container}`,
      type: 'color'
    },
    'Container-Low': {
      value: `{Backgrounds.${config.contTheme}.Background-${config.contN}.Containers.Container-Low}`,
      type: 'color'
    },
    'Container-Lowest': {
      value: `{Backgrounds.${config.contTheme}.Background-${config.contN}.Containers.Container-Lowest}`,
      type: 'color'
    },
    'Container-High': {
      value: `{Backgrounds.${config.contTheme}.Background-${config.contN}.Containers.Container-High}`,
      type: 'color'
    },
    'Container-Highest': {
      value: `{Backgrounds.${config.contTheme}.Background-${config.contN}.Containers.Container-Highest}`,
      type: 'color'
    },
    'Quiet': {
      value: getContainerTextPalette(config.contTheme, config) === 'BW'
        ? `{Quiet.Containers.Neutral.Color-${config.contN}}`
        : `{Quiet.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Text': {
      // Same BW/branded split as the surface Text token, both resolving
      // through the Text.Containers family.
      value: getContainerTextPalette(config.contTheme, config) === 'BW'
        ? `{Text.Containers.BW.Color-${config.contN}}`
        : `{Text.Containers.${getContainerTextPalette(config.contTheme, config)}.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Primary': {
      value: `{Text.Containers.Primary.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Secondary': {
      value: `{Text.Containers.Secondary.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Tertiary': {
      value: `{Text.Containers.Tertiary.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Neutral': {
      value: `{Text.Containers.Neutral.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Info': {
      value: `{Text.Containers.Info.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Success': {
      value: `{Text.Containers.Success.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Warning': {
      value: `{Text.Containers.Warning.Color-${config.contN}}`,
      type: 'color'
    },
    'Text-Error': {
      value: `{Text.Containers.Error.Color-${config.contN}}`,
      type: 'color'
    },
    'Header': {
      value: `{Header.Containers.${getContainerHeaderPalette(config.contTheme, config)}.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Primary': {
      value: `{Header.Containers.Primary.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Secondary': {
      value: `{Header.Containers.Secondary.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Tertiary': {
      value: `{Header.Containers.Tertiary.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Neutral': {
      value: `{Header.Containers.Neutral.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Info': {
      value: `{Header.Containers.Info.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Success': {
      value: `{Header.Containers.Success.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Warning': {
      value: `{Header.Containers.Warning.Color-${config.contN}}`,
      type: 'color'
    },
    'Header-Error': {
      value: `{Header.Containers.Error.Color-${config.contN}}`,
      type: 'color'
    },
    'Border': {
      value: `{Border.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Border-Variant': {
      value: `{Border-Variant.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    // Containers have their own Hover/Pressed group, computed from the
    // container colour rather than the background's tone. The flat
    // {Hover.<palette>.Color-N} family is indexed by BACKGROUND tone and steps
    // lighter for tones 6-12 — which sent dark containers to a light hover
    // under white text. See buildContainerStates in exportColorSystem.ts.
    'Hover': {
      value: `{Hover.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Pressed': {
      value: `{Pressed.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Hotlink': {
      // Same rule as the surface Hotlink above — dark containers take Vibrant.
      value: config.contN <= 4
        ? `{Colors.Info.Color-Vibrant}`
        : `{Text.Containers.Info.Color-${config.contN}}`,
      type: 'color'
    },
    'Hotlink-Visited': {
      value: `{Text.Containers.Hotlink-Visited.Color-${config.contN}}`,
      type: 'color'
    },
    'Focus-Visible': {
      value: `{Focus-Visible.Containers.Background-${config.contN}}`,
      type: 'color'
    },
    
    // Buttons in Containers
    'Buttons': {
      'Default': (() => {
        // Mirror of the Surfaces block: semantic themes use their own palette
        // for the Default button; non-semantic themes use the user's
        // button-mode palette for Border + Highlight + Lowlight.
        const semanticThemes = ['Info', 'Success', 'Warning', 'Error'];
        if (semanticThemes.includes(config.theme)) {
          return {
            'Button': { value: `{Buttons.${config.theme}.${config.cShade}.Button}`, type: 'color' },
            'Text': { value: `{Buttons.${config.theme}.${config.cShade}.Text}`, type: 'color' },
            'Border': { value: `{Border.Containers.${config.theme}.Color-${config.contN}}`, type: 'color' },
            'Hover': { value: `{Buttons.${config.theme}.${config.cShade}.Hover}`, type: 'color' },
            'Pressed': { value: `{Buttons.${config.theme}.${config.cShade}.Pressed}`, type: 'color' },
            'Highlight': { value: `{Button-Highlight.${config.theme}.Color-${config.contN}}`, type: 'color' },
            'Lowlight': { value: `{Button-Lowlight.${config.theme}.Color-${config.contN}}`, type: 'color' }
          };
        }
        // Black/white reads the tone table at the CONTAINER's own tone, so a
        // button inside a container takes its face from the container it sits
        // on rather than from the surface behind it.
        const cSrc = config.blackWhiteButton
          ? `Buttons.BlackWhite.Color-${config.contN}`
          : `Default-Button.Default.${config.cShade}`;
        return {
          'Button': { value: `{${cSrc}.Button}`, type: 'color' },
          'Text': { value: `{${cSrc}.Text}`, type: 'color' },
          'Border': config.blackWhiteButton
            ? { value: `{${cSrc}.Border}`, type: 'color' }
            : { value: `{Border.Containers.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' },
          'Hover': { value: `{${cSrc}.Hover}`, type: 'color' },
          'Pressed': { value: `{${cSrc}.Pressed}`, type: 'color' },
          'Highlight': { value: `{Button-Highlight.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' },
          'Lowlight': { value: `{Button-Lowlight.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' }
        };
      })(),
      'Primary': {
        'Button': { value: `{Buttons.Primary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Primary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Primary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Primary.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Primary.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Buttons.Secondary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Secondary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Secondary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Secondary.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Secondary.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Buttons.Tertiary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Tertiary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Tertiary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Tertiary.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Tertiary.${config.cShade}.Pressed}`, type: 'color' }
      },
      // BlackWhite — same table, keyed to the CONTAINER's tone rather than the
      // surface's, so a black/white button inside a container reads against
      // the container it actually sits on.
      'BlackWhite': {
        'Button': { value: `{Buttons.BlackWhite.Color-${config.contN}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.BlackWhite.Color-${config.contN}.Text}`, type: 'color' },
        'Border': { value: `{Buttons.BlackWhite.Color-${config.contN}.Border}`, type: 'color' },
        'Hover': { value: `{Buttons.BlackWhite.Color-${config.contN}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.BlackWhite.Color-${config.contN}.Pressed}`, type: 'color' },
        'Highlight': { value: `{Buttons.BlackWhite.Color-${config.contN}.Highlight}`, type: 'color' },
        'Lowlight': { value: `{Buttons.BlackWhite.Color-${config.contN}.Lowlight}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Buttons.Neutral.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Neutral.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Neutral.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Neutral.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Buttons.Info.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Info.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Info.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Info.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Info.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Buttons.Success.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Success.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Success.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Success.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Success.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Buttons.Warning.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Warning.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Warning.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Warning.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Warning.${config.cShade}.Pressed}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Buttons.Error.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Error.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Error.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Error.${config.cShade}.Hover}`, type: 'color' },
        'Pressed': { value: `{Buttons.Error.${config.cShade}.Pressed}`, type: 'color' }
      }
    },
    
    // Icons in Containers
    'Icons': {
      'Default': { value: `{Icon.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
      'Default-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
      'Primary': { value: `{Icon.Containers.Primary.Color-${config.contN}}`, type: 'color' },
      'Primary-Variant': { value: `{Icon-Variant.Containers.Primary.Color-${config.contN}}`, type: 'color' },
      'Secondary': { value: `{Icon.Containers.Secondary.Color-${config.contN}}`, type: 'color' },
      'Secondary-Variant': { value: `{Icon-Variant.Containers.Secondary.Color-${config.contN}}`, type: 'color' },
      'Tertiary': { value: `{Icon.Containers.Tertiary.Color-${config.contN}}`, type: 'color' },
      'Tertiary-Variant': { value: `{Icon-Variant.Containers.Tertiary.Color-${config.contN}}`, type: 'color' },
      'Neutral': { value: `{Icon.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
      'Neutral-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
      'Info': { value: `{Icon.Containers.Info.Color-${config.contN}}`, type: 'color' },
      'Info-Variant': { value: `{Icon-Variant.Containers.Info.Color-${config.contN}}`, type: 'color' },
      'Success': { value: `{Icon.Containers.Success.Color-${config.contN}}`, type: 'color' },
      'Success-Variant': { value: `{Icon-Variant.Containers.Success.Color-${config.contN}}`, type: 'color' },
      'Warning': { value: `{Icon.Containers.Warning.Color-${config.contN}}`, type: 'color' },
      'Warning-Variant': { value: `{Icon-Variant.Containers.Warning.Color-${config.contN}}`, type: 'color' },
      'Error': { value: `{Icon.Containers.Error.Color-${config.contN}}`, type: 'color' },
      'Error-Variant': { value: `{Icon-Variant.Containers.Error.Color-${config.contN}}`, type: 'color' }
    },
    
    // Tags in Containers — text references the tag's own text token
    'Tag': {
      'Primary': {
        'BG': { value: `{Tag.${config.cShade}.Primary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Primary.Text.Primary}`, type: 'color' }
      },
      'Secondary': {
        'BG': { value: `{Tag.${config.cShade}.Secondary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Secondary.Text.Secondary}`, type: 'color' }
      },
      'Tertiary': {
        'BG': { value: `{Tag.${config.cShade}.Tertiary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Tertiary.Text.Tertiary}`, type: 'color' }
      },
      'Info': {
        'BG': { value: `{Tag.${config.cShade}.Info.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Info.Text.Info}`, type: 'color' }
      },
      'Success': {
        'BG': { value: `{Tag.${config.cShade}.Success.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Success.Text.Success}`, type: 'color' }
      },
      'Warning': {
        'BG': { value: `{Tag.${config.cShade}.Warning.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Warning.Text.Warning}`, type: 'color' }
      },
      'Error': {
        'BG': { value: `{Tag.${config.cShade}.Error.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Error.Text.Error}`, type: 'color' }
      },
      'Neutral': {
        'BG': { value: `{Tag.${config.cShade}.Neutral.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.Neutral.Text.Neutral}`, type: 'color' }
      }
    }
  };
  
  return theme;
}

/**
 * Generate all themes with Surfaces and Containers
 * Creates 28 themes total based on the specification
 */
export function generateAllThemesWithSurfacesAndContainers(
  mode: 'Light-Mode' | 'Dark-Mode',
  extractedTones: { primary: number; secondary: number; tertiary: number },
  surfaceStyle: 'light-tonal' | 'grey-professional' | 'dark-professional',
  schemeType: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic',
  userSelections?: {
    // Fifth declaration of this union in the chain, after exportColorSystem
    // (twice), completeSimplifiedSystem (twice) and here. The comment it
    // replaced already said "Match completeSimplifiedSystem.ts" — and it had
    // stopped matching, missing 'primary-medium'.
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-base'
      | 'primary-medium' | 'primary-dark' | 'neutral-light' | 'neutral-dark';
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    status?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    /** Accepts the STYLE form with its -adaptive / -fixed suffix, because the
     *  body strips it: userSelections.button.replace(/-fixed|-adaptive/g, '').
     *  Declaring only the family form described an input this code was never
     *  written to receive. */
    button?: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white'
      | 'primary-adaptive' | 'primary-fixed'
      | 'secondary-adaptive' | 'secondary-fixed'
      | 'tonal-adaptive' | 'tonal-fixed'
      | 'laddered-adaptive' | 'laddered-fixed';
    textColoring?: 'tonal' | 'black-white';
    cardColoring?: 'tonal' | 'white' | 'black'; // CRITICAL FIX: Added to pass card coloring selection to generateModesThemes
  }
): any {
  
  const themes: any = {};
  
  // Get the default settings from simplified system
  const defaultSettings = getSimplifiedDefaultSettings(extractedTones, surfaceStyle, schemeType, userSelections);
  
  // CRITICAL DEBUG: Log default settings to verify background changes
  console.log('🎯 [generateAllThemes] defaultSettings:', {
    defaultTheme: defaultSettings.defaultTheme,
    defaultN: defaultSettings.defaultN,
    containerTheme: defaultSettings.containerTheme,
    containerN: defaultSettings.containerN,
    containerShade: defaultSettings.containerShade,
    userSelections
  });
  
  // Helper to create text palette names
  const getTextPaletteName = (base: string, textColoring: 'tonal' | 'black-white'): string => {
    return textColoring === 'tonal' ? base : 'BW';
  };
  
  const textColoring = defaultSettings.textColoring;

  // Resolve the user's button-mode choice to the palette the Default button
  // uses. Mirrors getButtonModeBorderMappings(buttonMode, mode).Default in
  // completeSimplifiedSystem.ts so Border + bevel match the body color.
  // Strip the -adaptive / -fixed suffix exactly like getSimplifiedDefaultSettings
  // does. Without this, a stored value like "laddered-adaptive" fails every
  // exact-match check below and falls through to 'Primary' — which is why the
  // hosted Default-button border came out Primary (blue) instead of the
  // laddered Secondary (brown), diverging from the preview.
  const buttonMode = (userSelections?.button || 'primary').replace(/-fixed|-adaptive/g, '');
  const defaultButtonPalette: string = (() => {
    if (buttonMode === 'black-white') return mode === 'Dark-Mode' ? 'Primary' : 'Neutral';
    if (buttonMode === 'secondary') return 'Secondary';
    if (buttonMode === 'tonal') return 'Primary';
    if (buttonMode === 'laddered') return 'Secondary';
    return 'Primary'; // 'primary' or anything else
  })();

  // Tonal and laddered are SURFACE-SCOPED: the button's palette depends on the
  // surface it sits on, where primary/secondary/black-white use one palette
  // everywhere. The constant above cannot express that — it made a tonal button
  // resolve to Primary on every theme, so tonal and primary shipped identical
  // CSS while the preview varied per surface.
  //
  //   tonal    — the surface's own palette, at that palette's extracted tone
  //              (Primary→PC, Secondary→SC, Tertiary→TC). Neutral and semantic
  //              surfaces have no brand tone to match, so they take Primary.
  //   laddered — one step round the rotation, so the button contrasts in hue
  //              with the surface rather than matching it.
  const isBlackWhiteButton = buttonMode === 'black-white';
  const SURFACE_SCOPED_BUTTON_MODES = ['tonal', 'laddered'];
  const isSurfaceScopedButton = SURFACE_SCOPED_BUTTON_MODES.includes(buttonMode);
  const LADDER_NEXT: Record<string, string> = {
    Primary: 'Secondary', Secondary: 'Tertiary', Tertiary: 'Primary',
  };
  const buttonPaletteForSurface = (surfacePalette: string): string => {
    if (!isSurfaceScopedButton) return defaultButtonPalette;
    const brand = ['Primary', 'Secondary', 'Tertiary'].includes(surfacePalette)
      ? surfacePalette
      : 'Primary';
    return buttonMode === 'laddered' ? LADDER_NEXT[brand] : brand;
  };
  
  // Common text palette configurations
  const textPalettes = {
    default: getTextPaletteName(defaultSettings.defaultTheme, textColoring),
    primary: getTextPaletteName('Primary', textColoring),
    secondary: getTextPaletteName('Secondary', textColoring),
    tertiary: getTextPaletteName('Tertiary', textColoring),
    neutral: getTextPaletteName('Neutral', textColoring),
    info: getTextPaletteName('Info', textColoring),
    success: getTextPaletteName('Success', textColoring),
    warning: getTextPaletteName('Warning', textColoring),
    error: getTextPaletteName('Error', textColoring)
  };
  
  // 1. Default Theme (from user/calculated settings)
  themes.Default = generateSingleTheme({
    themeName: 'Default',
    surfaceScopedButton: isSurfaceScopedButton,
    blackWhiteButton: isBlackWhiteButton,
    theme: defaultSettings.defaultTheme,
    n: defaultSettings.defaultN,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: defaultSettings.defaultN >= 11 ? 'Medium' : 'Light',
    cShade: defaultSettings.containerShade,
    defaultText: textPalettes.default,
    primaryText: textPalettes.primary,
    secondaryText: textPalettes.secondary,
    tertiaryText: textPalettes.tertiary,
    neutralText: textPalettes.neutral,
    infoText: textPalettes.info,
    successText: textPalettes.success,
    warningText: textPalettes.warning,
    errorText: textPalettes.error,
    defaultHeader: textColoring === 'tonal' ? 'Primary' : 'Primary',
    primaryHeader: 'Primary',
    secondaryHeader: 'Secondary',
    tertiaryHeader: 'Tertiary',
    neutralHeader: 'Neutral',
    infoHeader: 'Info',
    successHeader: 'Success',
    warningHeader: 'Warning',
    errorHeader: 'Error',
    defaultButtonPalette: buttonPaletteForSurface(defaultSettings.defaultTheme),
  });

  // Route the Default theme's surfaces through Default-Background.
  //
  // Backgrounds AND foregrounds both have to route through Default-Background,
  // the same way Containers do below. Only the background and a handful of
  // neutral roles were overridden before, so every accent role kept
  // generateSingleTheme's hardcoded tone indices — e.g. {Text.Surfaces.Primary
  // .Color-4} — which describe the LIGHT-mode surface. The Theme layer is
  // mode-independent, so those indices cannot flip; in dark mode the background
  // resolved to Neutral Color-2 while Text-Primary stayed keyed to tone 4,
  // giving #232f27 on #111111 = 1.36:1. Every other theme derives its accent
  // tone from its own background tone (Black: bg Color-1 -> accents Color-9);
  // Default is the only one that could not, which is exactly why the
  // Default-Background indirection exists — and why it has to cover EVERY role.
  // A role left out of this list silently keeps its light-mode tone.
  //
  // Must stay in step with ROLE_SOURCES in generateFigmaJSON.ts and the
  // tokenLookup block in exportToCSS.ts; all three emit the same key set.
  const DEFAULT_ACCENTS = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
    'Info', 'Success', 'Warning', 'Error'];
  // Flat roles sit directly on the surface section.
  const DEFAULT_BG_ROLES = [
    'Text', 'Header', 'Quiet', 'Border', 'Border-Variant',
    'Hover', 'Pressed', 'Focus-Visible',
    'Hotlink', 'Hotlink-Visited',
    ...DEFAULT_ACCENTS.map(p => `Text-${p}`),
    ...DEFAULT_ACCENTS.map(p => `Header-${p}`),
  ];
  // Icons are NOT flat — they live in a nested `Icons` object keyed 'Default',
  // 'Default-Variant', 'Primary', 'Primary-Variant', ... and only get flattened
  // to --Icons-Primary when the CSS is emitted. Writing section['Icons-Primary']
  // would create a key nothing reads and silently leave the real one untouched.
  const DEFAULT_ICON_KEYS = ['Default', ...DEFAULT_ACCENTS]
    .flatMap(p => [p, `${p}-Variant`]);
  /**
   * @param group   key on themes.Default (e.g. 'Surfaces-Dim')
   * @param bgKey   Default-Background key holding this surface's background
   * @param fgPrefix prefix its foreground keys carry ('' for the base Surface)
   */
  const overrideSurface = (group: string, bgKey: string, fgPrefix: string) => {
    const section = themes.Default?.[group];
    if (!section) return;
    section['Background'] = { value: `{Default-Background.${bgKey}}`, type: 'color' };
    for (const role of DEFAULT_BG_ROLES) {
      if (section[role] === undefined) continue;
      section[role] = { value: `{Default-Background.${fgPrefix}${role}}`, type: 'color' };
    }
    if (section['Icons']) {
      for (const key of DEFAULT_ICON_KEYS) {
        if (section['Icons'][key] === undefined) continue;
        section['Icons'][key] = { value: `{Default-Background.${fgPrefix}Icons-${key}}`, type: 'color' };
      }
      // On-<pal> is CREATED here, not rewritten.
      //
      // exportColorSystem computes On-* for the other 17 themes by resolving
      // the icon's rendered tone, but it runs after the themes are built — by
      // then Default's icons are {Default-Background.*} refs it cannot resolve,
      // so Default would silently end up as the one theme without On-*. Routing
      // it through Default-Background is the same treatment Icons and
      // Icon-Variant already get, and the producers compute the value.
      for (const pal of DEFAULT_ACCENTS.concat('Default')) {
        section['Icons'][`On-${pal}`] = {
          value: `{Default-Background.${fgPrefix}On-${pal}}`, type: 'color',
        };
      }
    }
    // Dropshadow-Color is handled by processGroup which reads the Background sibling
  };
  overrideSurface('Surfaces', 'Surface', '');
  overrideSurface('Surfaces-Dim', 'Surface-Dim', 'Surface-Dim-');
  overrideSurface('Surfaces-Bright', 'Surface-Bright', 'Surface-Bright-');
  overrideSurface('Surfaces-Brightest', 'Surface-Brightest', 'Surface-Brightest-');
  // Surfaces-Dimmest is deliberately NOT routed through Default-Background.
  //
  // Surface-Dim and Surface-Bright are tone-relative to the theme's own
  // background (N-1 / N+1), so they move per mode and need the indirection.
  // Surface-Dimmest does not: generateSingleTheme pins it to Color-4 in every
  // theme and every mode (see dimmestN above), and {Backgrounds.<pal>
  // .Background-4.Surfaces.Surface} already resolves per mode on its own. Its
  // foregrounds are built by buildSurfaceTokens(config, 4) and are therefore
  // already paired against a tone-4 background.
  //
  // Routing it anyway is actively wrong: the background would move to the
  // Default surface's tone while Buttons — which are not part of this override —
  // keep their tone-4 borders. In light mode that put a light Color-9 border on
  // a light Color-10 surface (1.47:1, under the 3:1 floor for UI boundaries).
  // Dark mode: a button's border IS its fill.
  //
  // generateSingleTheme keys the button border to the THEME's surface tone
  // ({Border.Surfaces.<pal>.Color-N}). For every theme but Default that tone is
  // the same in both modes, so it stays correct. Default's surface moves per
  // mode (light Neutral-12, dark Neutral-2), so its border kept describing a
  // tone-12 surface while sitting on tone 2 — dark green on near-black
  // (#2d3d32 on #111111, 1.64:1) drawn around a near-white button.
  //
  // In dark mode the fill already separates the button from the surface at
  // ~13:1, so the border carries no information and should go flush rather
  // than draw a ring. Applied to every theme for consistency; light mode is
  // untouched. Mirrors the Default-Button-Border group in generateFigmaJSON,
  // which carries the same rule for Figma (where the Theme layer cannot branch
  // on mode and so needs the value supplied from the Modes layer instead).
  if (mode === 'Dark-Mode') {
    for (const theme of Object.values(themes) as any[]) {
      for (const group of Object.values(theme) as any[]) {
        const buttons = group?.Buttons;
        if (!buttons || typeof buttons !== 'object') continue;
        for (const btn of Object.values(buttons) as any[]) {
          if (btn?.Button?.value === undefined || btn?.Border === undefined) continue;
          btn.Border = { value: btn.Button.value, type: 'color' };
        }
      }
    }
  }

  // Override Default Containers
  if (themes.Default?.Containers) {
    themes.Default.Containers['Container'] = { value: '{Default-Background.Container}', type: 'color' };
    themes.Default.Containers['Container-Low'] = { value: '{Default-Background.Container-Low}', type: 'color' };
    themes.Default.Containers['Container-Lowest'] = { value: '{Default-Background.Container-Lowest}', type: 'color' };
    themes.Default.Containers['Container-High'] = { value: '{Default-Background.Container-High}', type: 'color' };
    themes.Default.Containers['Container-Highest'] = { value: '{Default-Background.Container-Highest}', type: 'color' };
    themes.Default.Containers['Text'] = { value: '{Default-Background.Container-Text}', type: 'color' };
    themes.Default.Containers['Header'] = { value: '{Default-Background.Container-Header}', type: 'color' };
    themes.Default.Containers['Quiet'] = { value: '{Default-Background.Container-Quiet}', type: 'color' };
    themes.Default.Containers['Border'] = { value: '{Default-Background.Container-Border}', type: 'color' };
    themes.Default.Containers['Border-Variant'] = { value: '{Default-Background.Container-Border-Variant}', type: 'color' };
    themes.Default.Containers['Focus-Visible'] = { value: '{Default-Background.Container-Focus-Visible}', type: 'color' };
  }

  console.log('🔍 [generateAllThemes] Default theme generated with:');
  console.log('   Surfaces references: Default-Background (Light/Dark adaptive)');
  console.log('   Containers references:', defaultSettings.containerTheme, '-', defaultSettings.containerN);
  console.log('   CShade:', defaultSettings.containerShade);
  
  // 2-4. Nav component themes — alias the user's chosen theme
  // Maps user selection → existing theme name
  /**
   * A nav selection resolves to a surviving theme AND the surface level that
   * carries the colour it used to name.
   *
   * `white`, `black` and `primary-light` were themes; they are now levels.
   * Mapping only the theme would silently change the colour — 'primary-light'
   * would land on Primary's Surface (tone 6) instead of the tone 11 it means —
   * so the level travels with it and is promoted to Surfaces on the copy.
   */
  function navSelectionToSource(selection: string): { theme: string; level: string } {
    const sel = selection?.toLowerCase?.() || '';
    switch (sel) {
      case 'primary-light':        return { theme: 'Primary', level: 'Surfaces-Brightest' };
      case 'primary-light-bright': return { theme: 'Primary', level: 'Surfaces-Brightest' };
      case 'primary-light-dim':    return { theme: 'Primary', level: 'Surfaces-Bright' };
      case 'primary':              return { theme: 'Primary', level: 'Surfaces' };
      case 'primary-bright':       return { theme: 'Primary', level: 'Surfaces-Bright' };
      case 'primary-dim':          return { theme: 'Primary', level: 'Surfaces-Dim' };
      case 'white':                return { theme: 'Neutral', level: 'Surfaces-Brightest' };
      case 'black':                return { theme: 'Neutral', level: 'Surfaces-Dimmest' };
      default:                     return { theme: selection || 'Primary', level: 'Surfaces' };
    }
  }

  /** Copy a theme, promoting one of its surface levels to be its Surface. */
  function navThemeFrom(src: { theme: string; level: string }): any | null {
    const base = themes[src.theme];
    if (!base) return null;
    const copy = JSON.parse(JSON.stringify(base));
    const level = base[src.level];
    if (level && src.level !== 'Surfaces') copy.Surfaces = JSON.parse(JSON.stringify(level));
    return copy;
  }

  // SimplifiedDefaultConfig stores nav selections as separate `<x>Theme` +
  // `<x>N` fields, NOT as a single string. Reading `.appBar` here always
  // returned `undefined`, which made the default branch ('Primary-Light')
  // win — so the AppBar was tinted Primary-Light regardless of what the
  // user picked in Assign Colors. Pull the raw selection from
  // userSelections.* instead, which is where the studio writes it.
  const appBarSource = navSelectionToSource(userSelections?.appBar as string);
  const navBarSource = navSelectionToSource(userSelections?.navBar as string);
  const statusSource = navSelectionToSource(userSelections?.status as string);

  // 5-7. Primary, Secondary, Tertiary Themes (use extracted PC/SC/TC converted to Color-N)
  // PC/SC/TC = closest Color-N to the original extracted color's lightness
  // These determine which tone the theme surface uses
  const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const SC = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 9;
  const TC = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 9;
  const OB = PC >= 9 ? 6 : 5;

  console.log(`  Nav themes: App-Bar→${appBarSource} (from "${userSelections?.appBar}"), Nav-Bar→${navBarSource} (from "${userSelections?.navBar}"), Status→${statusSource} (from "${userSelections?.status}")`);
  console.log(`  PC=${PC}, SC=${SC}, TC=${TC}, OB=${OB}`);

  // Helper to build common theme config
  // Container N: for Light themes (n=11), container = 10 (one step darker for contrast)
  // For other themes, use the default container settings
  const makeConfig = (themeName: string, theme: string, n: number): ThemeConfig => ({
    themeName,
    theme,
    n,
    surfaceScopedButton: isSurfaceScopedButton,
    blackWhiteButton: isBlackWhiteButton,
    contTheme: theme,
    contN: n === 11 ? 10 : n === 12 ? 11 : Math.min(n + 1, 12),
    shade: n >= 9 ? 'Medium' as const : 'Light' as const,
    cShade: n === 11 ? 'Medium' as const : defaultSettings.containerShade,
    defaultText: textPalettes.default,
    primaryText: textPalettes.primary,
    secondaryText: textPalettes.secondary,
    tertiaryText: textPalettes.tertiary,
    neutralText: textPalettes.neutral,
    infoText: textPalettes.info,
    successText: textPalettes.success,
    warningText: textPalettes.warning,
    errorText: textPalettes.error,
    defaultHeader: textColoring === 'tonal' ? 'Primary' : 'Primary',
    primaryHeader: 'Primary',
    secondaryHeader: 'Secondary',
    tertiaryHeader: 'Tertiary',
    neutralHeader: 'Neutral',
    infoHeader: 'Info',
    successHeader: 'Success',
    warningHeader: 'Warning',
    errorHeader: 'Error',
    defaultButtonPalette: buttonPaletteForSurface(theme),
  });

  // Primary, Secondary, Tertiary — N = PC/SC/TC
  themes.Primary = generateSingleTheme(makeConfig('Primary', 'Primary', PC));
  themes.Secondary = generateSingleTheme(makeConfig('Secondary', 'Secondary', SC));
  themes.Tertiary = generateSingleTheme(makeConfig('Tertiary', 'Tertiary', TC));

  // Primary-Light, Secondary-Light, Tertiary-Light, White, Black and Light-Gray
  // are RETIRED — they are surface levels now, not themes.
  //
  // Each was one palette viewed through a fixed window, which is a theme per
  // window rather than per palette. Measured across shipped systems all seven
  // `-Light` themes held the identical tone window (9-10-11-12), so nothing
  // selected between them — the palette already did. Their Surface was tone 11,
  // which is exactly where Surface-Brightest lands, so the colour survives:
  //
  //   Primary-Light  ->  theme="Primary"  surface="Surface-Brightest"
  //   White          ->  theme="Neutral"  surface="Surface-Brightest"
  //   Black          ->  theme="Neutral"  surface="Surface-Dimmest"
  //   Light-Gray     ->  theme="Neutral"  surface="Surface"
  //
  // Retiring them is what makes the set fit: Figma caps a collection at ten
  // modes, and eighteen themes meant nine could not import at all.

  // Neutral — the theme that replaces White / Light-Gray / Black.
  //
  // Those three are one palette viewed through three windows, which is a theme
  // per window rather than per palette. At tone 10 the derived window already
  // gives Dim 9, Surface 10 and Bright 11 — three of the five levels the
  // replacement needs. The two ends are locked rather than derived (Dimmest
  // black, Brightest white) so the theme spans the whole scale, and that comes
  // with the surfaceWindow wiring.
  //
  // Replaces White, Light-Gray and Black outright: those three were one palette
  // at three windows, and Neutral spans all of them across its five levels.
  themes.Neutral = generateSingleTheme(makeConfig('Neutral', 'Neutral', 10));

  // Info, Success, Warning, Error — N = OB
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[themeName] = generateSingleTheme(makeConfig(themeName, themeName, OB));
  });

  // Info-Light etc. are retired for the same reason — Surface-Brightest on the
  // state theme is the same tone 11 they were.
  
  // Nav component themes — the chosen theme, at the chosen surface level.
  const navPairs: Array<[string, { theme: string; level: string }]> = [
    ['App-Bar', appBarSource], ['Nav-Bar', navBarSource], ['Status', statusSource],
  ];
  for (const [name, src] of navPairs) {
    const built = navThemeFrom(src);
    if (built) themes[name] = built;
    else console.error(`  ❌ ${name} source "${src.theme}" NOT FOUND in themes!`);
  }

  console.log(`  ✓ Generated ${Object.keys(themes).length} complete themes with Surfaces and Containers for ${mode}`);

  return themes;
}