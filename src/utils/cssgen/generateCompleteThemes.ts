import { getSimplifiedDefaultSettings } from './completeSimplifiedSystem';
import { toneToColorNumber, generateSemanticLightModeScale, findClosestColorN } from '../colorScale';
// Reuse the contrast lookup tables that the CSS exporter already uses for
// Text and Header palettes. Without this, Text-Primary / Header-Primary were
// emitted as `{Text.Surfaces.Primary.Color-${n}}` which the lib resolves to
// Primary-Color-9 regardless of surface tone — failing WCAG on Color-1
// backgrounds. The getFixed* helpers return contrast-tuned references like
// `{Colors.Primary.Color-7}` per the table in exportColorSystem.ts.
import { getFixedTextToken, getFixedHeaderToken } from './exportColorSystem';

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
      // BW palette stays as the lib's raw reference (it has its own
      // contrast-tuned greyscale handling that doesn't go through the
      // color-N lookup). Branded palettes flow through getFixedTextToken
      // so Text inherits the same contrast pairing as Text-Primary etc.
      value: config.defaultText === 'BW'
        ? `{Text.Surfaces.BW.Color-${n}}`
        : getFixedTextToken(n, false, config.defaultText),
      type: 'color'
    },
    'Text-Primary': {
      value: getFixedTextToken(n, false, 'Primary'),
      type: 'color'
    },
    'Text-Secondary': {
      value: getFixedTextToken(n, false, 'Secondary'),
      type: 'color'
    },
    'Text-Tertiary': {
      value: getFixedTextToken(n, false, 'Tertiary'),
      type: 'color'
    },
    'Text-Neutral': {
      value: getFixedTextToken(n, false, 'Neutral'),
      type: 'color'
    },
    'Text-Info': {
      value: getFixedTextToken(n, false, 'Info'),
      type: 'color'
    },
    'Text-Success': {
      value: getFixedTextToken(n, false, 'Success'),
      type: 'color'
    },
    'Text-Warning': {
      value: getFixedTextToken(n, false, 'Warning'),
      type: 'color'
    },
    'Text-Error': {
      value: getFixedTextToken(n, false, 'Error'),
      type: 'color'
    },
    'Header': {
      value: getFixedHeaderToken(n, false, config.defaultHeader),
      type: 'color'
    },
    'Header-Primary': {
      value: getFixedHeaderToken(n, false, 'Primary'),
      type: 'color'
    },
    'Header-Secondary': {
      value: getFixedHeaderToken(n, false, 'Secondary'),
      type: 'color'
    },
    'Header-Tertiary': {
      value: getFixedHeaderToken(n, false, 'Tertiary'),
      type: 'color'
    },
    'Header-Neutral': {
      value: getFixedHeaderToken(n, false, 'Neutral'),
      type: 'color'
    },
    'Header-Info': {
      value: getFixedHeaderToken(n, false, 'Info'),
      type: 'color'
    },
    'Header-Success': {
      value: getFixedHeaderToken(n, false, 'Success'),
      type: 'color'
    },
    'Header-Warning': {
      value: getFixedHeaderToken(n, false, 'Warning'),
      type: 'color'
    },
    'Header-Error': {
      value: getFixedHeaderToken(n, false, 'Error'),
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
    'Active': {
      value: `{Active.${config.theme}.Color-${n}}`,
      type: 'color'
    },
    'Hotlink': {
      // Hotlinks share the contrast-tuned Info text mapping so links read
      // on any surface tone without the user noticing fade-out on dark
      // backgrounds.
      value: getFixedTextToken(n, false, 'Info'),
      type: 'color'
    },
    'Hotlink-Visited': {
      value: `{Text.Surfaces.Hotlink-Visited.Color-${n}}`,
      type: 'color'
    },
    'Focus-Visible': {
      value: `{Focus-Visible.Surfaces.Color-${n}}`,
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
            'Active': { value: `{Buttons.${config.theme}.${shade}.Active}`, type: 'color' },
            'Highlight': { value: `{Button-Highlight.${config.theme}.Color-${n}}`, type: 'color' },
            'Lowlight': { value: `{Button-Lowlight.${config.theme}.Color-${n}}`, type: 'color' }
          };
        }
        // Non-semantic themes — Border + Highlight + Lowlight follow the user's
        // button-mode palette (defaultButtonPalette) so they match the body.
        return {
          'Button': { value: `{Default-Button.Default.${shade}.Button}`, type: 'color' },
          'Text': { value: `{Default-Button.Default.${shade}.Text}`, type: 'color' },
          'Border': { value: `{Border.Surfaces.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' },
          'Hover': { value: `{Default-Button.Default.${shade}.Hover}`, type: 'color' },
          'Active': { value: `{Default-Button.Default.${shade}.Active}`, type: 'color' },
          'Highlight': { value: `{Button-Highlight.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' },
          'Lowlight': { value: `{Button-Lowlight.${config.defaultButtonPalette}.Color-${n}}`, type: 'color' }
        };
      })(),
      'Primary': {
        'Button': { value: `{Buttons.Primary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Primary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Primary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Primary.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Primary.${shade}.Active}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Buttons.Secondary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Secondary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Secondary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Secondary.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Secondary.${shade}.Active}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Buttons.Tertiary.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Tertiary.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Tertiary.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Tertiary.${shade}.Active}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Buttons.Neutral.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Neutral.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Neutral.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Neutral.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Neutral.${shade}.Active}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Buttons.Info.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Info.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Info.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Info.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Info.${shade}.Active}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Buttons.Success.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Success.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Success.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Success.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Success.${shade}.Active}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Buttons.Warning.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Warning.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Warning.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Warning.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Warning.${shade}.Active}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Buttons.Error.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Error.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Surfaces.Error.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Buttons.Error.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Error.${shade}.Active}`, type: 'color' }
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
  const dimmestN = 4; // Surface-Dimmest always uses Color-4
  const brightN = Math.min(config.n + 1, 12);

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
      value: config.n > 2 ? `{Backgrounds.${config.theme}.Background-${dimmestN}.Surfaces.Surface}` : '#000000',
      type: 'color'
    },
    ...buildSurfaceTokens(config, dimmestN)
  };

  // Surface-Bright
  theme['Surfaces-Bright'] = {
    'Background': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface-Bright}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, brightN)
  };

  // Containers Section — reference Modes/Containers for Light/Dark mode adaptation
  theme.Containers = {
    'Container': {
      value: `{Containers.${config.contTheme}.BG-${config.contN}.Container}`,
      type: 'color'
    },
    'Container-Low': {
      value: `{Containers.${config.contTheme}.BG-${config.contN}.Container-Low}`,
      type: 'color'
    },
    'Container-Lowest': {
      value: `{Containers.${config.contTheme}.BG-${config.contN}.Container-Lowest}`,
      type: 'color'
    },
    'Container-High': {
      value: `{Containers.${config.contTheme}.BG-${config.contN}.Container-High}`,
      type: 'color'
    },
    'Container-Highest': {
      value: `{Containers.${config.contTheme}.BG-${config.contN}.Container-Highest}`,
      type: 'color'
    },
    'Quiet': {
      value: getContainerTextPalette(config.contTheme, config) === 'BW'
        ? `{Quiet.Containers.Neutral.Color-${config.contN}}`
        : `{Quiet.Containers.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Text': {
      // Same BW/branded split as the surface Text token — BW stays on the
      // lib reference (greyscale has its own logic); branded palettes use
      // getFixedTextToken for contrast against the container background.
      value: getContainerTextPalette(config.contTheme, config) === 'BW'
        ? `{Text.Containers.BW.Color-${config.contN}}`
        : getFixedTextToken(config.contN, true, getContainerTextPalette(config.contTheme, config)),
      type: 'color'
    },
    'Text-Primary': {
      value: getFixedTextToken(config.contN, true, 'Primary'),
      type: 'color'
    },
    'Text-Secondary': {
      value: getFixedTextToken(config.contN, true, 'Secondary'),
      type: 'color'
    },
    'Text-Tertiary': {
      value: getFixedTextToken(config.contN, true, 'Tertiary'),
      type: 'color'
    },
    'Text-Neutral': {
      value: getFixedTextToken(config.contN, true, 'Neutral'),
      type: 'color'
    },
    'Text-Info': {
      value: getFixedTextToken(config.contN, true, 'Info'),
      type: 'color'
    },
    'Text-Success': {
      value: getFixedTextToken(config.contN, true, 'Success'),
      type: 'color'
    },
    'Text-Warning': {
      value: getFixedTextToken(config.contN, true, 'Warning'),
      type: 'color'
    },
    'Text-Error': {
      value: getFixedTextToken(config.contN, true, 'Error'),
      type: 'color'
    },
    'Header': {
      value: getFixedHeaderToken(config.contN, true, getContainerHeaderPalette(config.contTheme, config)),
      type: 'color'
    },
    'Header-Primary': {
      value: getFixedHeaderToken(config.contN, true, 'Primary'),
      type: 'color'
    },
    'Header-Secondary': {
      value: getFixedHeaderToken(config.contN, true, 'Secondary'),
      type: 'color'
    },
    'Header-Tertiary': {
      value: getFixedHeaderToken(config.contN, true, 'Tertiary'),
      type: 'color'
    },
    'Header-Neutral': {
      value: getFixedHeaderToken(config.contN, true, 'Neutral'),
      type: 'color'
    },
    'Header-Info': {
      value: getFixedHeaderToken(config.contN, true, 'Info'),
      type: 'color'
    },
    'Header-Success': {
      value: getFixedHeaderToken(config.contN, true, 'Success'),
      type: 'color'
    },
    'Header-Warning': {
      value: getFixedHeaderToken(config.contN, true, 'Warning'),
      type: 'color'
    },
    'Header-Error': {
      value: getFixedHeaderToken(config.contN, true, 'Error'),
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
    'Hover': {
      value: `{Hover.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Active': {
      value: `{Active.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Hotlink': {
      value: getFixedTextToken(config.contN, true, 'Info'),
      type: 'color'
    },
    'Hotlink-Visited': {
      value: `{Text.Containers.Hotlink-Visited.Color-${config.contN}}`,
      type: 'color'
    },
    'Focus-Visible': {
      value: `{Focus-Visible.Containers.Color-${config.contN}}`,
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
            'Active': { value: `{Buttons.${config.theme}.${config.cShade}.Active}`, type: 'color' },
            'Highlight': { value: `{Button-Highlight.${config.theme}.Color-${config.contN}}`, type: 'color' },
            'Lowlight': { value: `{Button-Lowlight.${config.theme}.Color-${config.contN}}`, type: 'color' }
          };
        }
        return {
          'Button': { value: `{Default-Button.Default.${config.cShade}.Button}`, type: 'color' },
          'Text': { value: `{Default-Button.Default.${config.cShade}.Text}`, type: 'color' },
          'Border': { value: `{Border.Containers.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' },
          'Hover': { value: `{Default-Button.Default.${config.cShade}.Hover}`, type: 'color' },
          'Active': { value: `{Default-Button.Default.${config.cShade}.Active}`, type: 'color' },
          'Highlight': { value: `{Button-Highlight.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' },
          'Lowlight': { value: `{Button-Lowlight.${config.defaultButtonPalette}.Color-${config.contN}}`, type: 'color' }
        };
      })(),
      'Primary': {
        'Button': { value: `{Buttons.Primary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Primary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Primary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Primary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Primary.${config.cShade}.Active}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Buttons.Secondary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Secondary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Secondary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Secondary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Secondary.${config.cShade}.Active}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Buttons.Tertiary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Tertiary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Tertiary.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Tertiary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Tertiary.${config.cShade}.Active}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Buttons.Neutral.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Neutral.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Neutral.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Neutral.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Neutral.${config.cShade}.Active}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Buttons.Info.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Info.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Info.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Info.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Info.${config.cShade}.Active}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Buttons.Success.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Success.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Success.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Success.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Success.${config.cShade}.Active}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Buttons.Warning.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Warning.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Warning.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Warning.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Warning.${config.cShade}.Active}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Buttons.Error.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Buttons.Error.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Border.Containers.Error.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Buttons.Error.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Buttons.Error.${config.cShade}.Active}`, type: 'color' }
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
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-base' | 'primary-dark' | 'neutral-light' | 'neutral-dark'; // CRITICAL FIX: Match completeSimplifiedSystem.ts
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    status?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    button?: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
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
  const buttonMode = userSelections?.button || 'primary';
  const defaultButtonPalette: string = (() => {
    if (buttonMode === 'black-white') return mode === 'Dark-Mode' ? 'Primary' : 'Neutral';
    if (buttonMode === 'secondary') return 'Secondary';
    if (buttonMode === 'tonal') return 'Primary';
    if (buttonMode === 'laddered') return 'Secondary';
    return 'Primary'; // 'primary' or anything else
  })();
  
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
    defaultButtonPalette
  });

  // Override Default theme's Surface to reference Default-Background (Light/Dark adaptive)
  if (themes.Default?.Surfaces) {
    themes.Default.Surfaces['Background'] = { value: '{Default-Background.Surface}', type: 'color' };
    themes.Default.Surfaces['Text'] = { value: '{Default-Background.Text}', type: 'color' };
    themes.Default.Surfaces['Header'] = { value: '{Default-Background.Header}', type: 'color' };
    themes.Default.Surfaces['Quiet'] = { value: '{Default-Background.Quiet}', type: 'color' };
    themes.Default.Surfaces['Border'] = { value: '{Default-Background.Border}', type: 'color' };
    themes.Default.Surfaces['Border-Variant'] = { value: '{Default-Background.Border-Variant}', type: 'color' };
    themes.Default.Surfaces['Hover'] = { value: '{Default-Background.Hover}', type: 'color' };
    themes.Default.Surfaces['Active'] = { value: '{Default-Background.Active}', type: 'color' };
    themes.Default.Surfaces['Focus-Visible'] = { value: '{Default-Background.Focus-Visible}', type: 'color' };
    // Dropshadow-Color is handled by processGroup which reads the Background sibling
  }
  // Override Default Surface-Dim and Surface-Bright
  if (themes.Default?.['Surfaces-Dim']) {
    themes.Default['Surfaces-Dim']['Background'] = { value: '{Default-Background.Surface-Dim}', type: 'color' };
  }
  if (themes.Default?.['Surfaces-Bright']) {
    themes.Default['Surfaces-Bright']['Background'] = { value: '{Default-Background.Surface-Bright}', type: 'color' };
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
  function navSelectionToThemeName(selection: string): string {
    const sel = selection?.toLowerCase?.() || '';
    switch (sel) {
      case 'primary-light': return 'Primary-Light';
      case 'primary': return 'Primary';
      case 'white': return 'White';
      case 'black': return 'Black';
      default: return selection || 'Primary-Light'; // Pass through already-formatted names
    }
  }

  // SimplifiedDefaultConfig stores nav selections as separate `<x>Theme` +
  // `<x>N` fields, NOT as a single string. Reading `.appBar` here always
  // returned `undefined`, which made the default branch ('Primary-Light')
  // win — so the AppBar was tinted Primary-Light regardless of what the
  // user picked in Assign Colors. Pull the raw selection from
  // userSelections.* instead, which is where the studio writes it.
  const appBarSource = navSelectionToThemeName(userSelections?.appBar as string);
  const navBarSource = navSelectionToThemeName(userSelections?.navBar as string);
  const statusSource = navSelectionToThemeName(userSelections?.status as string);

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
    defaultButtonPalette
  });

  // Primary, Secondary, Tertiary — N = PC/SC/TC
  themes.Primary = generateSingleTheme(makeConfig('Primary', 'Primary', PC));
  themes.Secondary = generateSingleTheme(makeConfig('Secondary', 'Secondary', SC));
  themes.Tertiary = generateSingleTheme(makeConfig('Tertiary', 'Tertiary', TC));

  // Primary-Light, Secondary-Light, Tertiary-Light — N = 11
  themes['Primary-Light'] = generateSingleTheme(makeConfig('Primary-Light', 'Primary', 11));
  themes['Secondary-Light'] = generateSingleTheme(makeConfig('Secondary-Light', 'Secondary', 11));
  themes['Tertiary-Light'] = generateSingleTheme(makeConfig('Tertiary-Light', 'Tertiary', 11));

  // White, Black, and Light-Gray
  themes.White = generateSingleTheme(makeConfig('White', 'Neutral', 12));
  themes.Black = generateSingleTheme(makeConfig('Black', 'Neutral', 1));
  themes['Light-Gray'] = generateSingleTheme(makeConfig('Light-Gray', 'Neutral', 10));

  // Info, Success, Warning, Error — N = OB
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[themeName] = generateSingleTheme(makeConfig(themeName, themeName, OB));
  });

  // Info-Light, Success-Light, Warning-Light, Error-Light — N = 11
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[`${themeName}-Light`] = generateSingleTheme(makeConfig(`${themeName}-Light`, themeName, 11));
  });
  
  // Nav component themes — alias the user's chosen theme
  console.log(`  Available theme keys:`, Object.keys(themes).join(', '));
  console.log(`  Looking for App-Bar source: "${appBarSource}" → exists: ${!!themes[appBarSource]}`);
  console.log(`  Looking for Nav-Bar source: "${navBarSource}" → exists: ${!!themes[navBarSource]}`);
  if (themes[appBarSource]) themes['App-Bar'] = JSON.parse(JSON.stringify(themes[appBarSource]));
  else console.error(`  ❌ App-Bar source "${appBarSource}" NOT FOUND in themes!`);
  if (themes[navBarSource]) themes['Nav-Bar'] = JSON.parse(JSON.stringify(themes[navBarSource]));
  else console.error(`  ❌ Nav-Bar source "${navBarSource}" NOT FOUND in themes!`);
  if (themes[statusSource]) themes['Status'] = JSON.parse(JSON.stringify(themes[statusSource]));

  console.log(`  ✓ Generated ${Object.keys(themes).length} complete themes with Surfaces and Containers for ${mode}`);

  return themes;
}