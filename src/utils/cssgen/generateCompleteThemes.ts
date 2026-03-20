import { getSimplifiedDefaultSettings } from './completeSimplifiedSystem';

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
        ? `{Quiet.Surfaces.BW.Color-${n}}`
        : `{Quiet.Surfaces.${config.defaultText}.Color-${n}}`,
      type: 'color'
    },
    'Text': {
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
      value: `{Border.Surfaces.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Border-Variant': {
      value: `{Border-Variant.Surfaces.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Hover': {
      value: `{Hover.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Active': {
      value: `{Active.Neutral.Color-${n}}`,
      type: 'color'
    },
    'Hotlink': {
      value: `{Text.Surfaces.Info.Color-${n}}`,
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
      'Default': {
        'Button': { value: `{Default-Button.Default.${shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Default.${shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Default.${shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Default.${shade}.Active}`, type: 'color' }
      },
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

    // Tags in Surfaces
    'Tag': {
      'Primary': {
        'BG': { value: `{Tag.${shade}.Primary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.primaryText}.Text}`, type: 'color' }
      },
      'Secondary': {
        'BG': { value: `{Tag.${shade}.Secondary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.secondaryText}.Text}`, type: 'color' }
      },
      'Tertiary': {
        'BG': { value: `{Tag.${shade}.Tertiary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.tertiaryText}.Text}`, type: 'color' }
      },
      'Info': {
        'BG': { value: `{Tag.${shade}.Info.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.infoText}.Text}`, type: 'color' }
      },
      'Success': {
        'BG': { value: `{Tag.${shade}.Success.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.successText}.Text}`, type: 'color' }
      },
      'Warning': {
        'BG': { value: `{Tag.${shade}.Warning.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.warningText}.Text}`, type: 'color' }
      },
      'Error': {
        'BG': { value: `{Tag.${shade}.Error.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.errorText}.Text}`, type: 'color' }
      },
      'Neutral': {
        'BG': { value: `{Tag.${shade}.Neutral.BG}`, type: 'color' },
        'Text': { value: `{Tag.${shade}.${config.neutralText}.Text}`, type: 'color' }
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
  const dimmestN = Math.max(config.n - 2, 1);
  const brightN = Math.min(config.n + 1, 12);

  // Base Surface
  theme.Surfaces = {
    'Surface': {
      value: `{Colors.${config.theme}.Color-${config.n}}`,
      type: 'color'
    },
    ...buildSurfaceTokens(config, config.n)
  };

  // Surface-Dim
  theme['Surfaces-Dim'] = {
    'Surface': {
      value: config.n > 1 ? `{Colors.${config.theme}.Color-${dimN}}` : '#000000',
      type: 'color'
    },
    ...buildSurfaceTokens(config, dimN)
  };

  // Surface-Dimmest
  theme['Surfaces-Dimmest'] = {
    'Surface': {
      value: config.n > 2 ? `{Colors.${config.theme}.Color-${dimmestN}}` : '#000000',
      type: 'color'
    },
    ...buildSurfaceTokens(config, dimmestN)
  };

  // Surface-Bright
  theme['Surfaces-Bright'] = {
    'Surface': {
      value: config.n < 12 ? `{Colors.${config.theme}.Color-${brightN}}` : '#FFFFFF',
      type: 'color'
    },
    ...buildSurfaceTokens(config, brightN)
  };

  // Containers Section
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
        ? `{Quiet.Containers.BW.Color-${config.contN}}`
        : `{Quiet.Containers.${getContainerTextPalette(config.contTheme, config)}.Color-${config.contN}}`,
      type: 'color'
    },
    'Text': {
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
    'Hover': {
      value: `{Hover.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Active': {
      value: `{Active.${config.contTheme}.Color-${config.contN}}`,
      type: 'color'
    },
    'Hotlink': {
      value: `{Text.Containers.Info.Color-${config.contN}}`,
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
      'Default': {
        'Button': { value: `{Default-Button.Default.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Default.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Default.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Default.${config.cShade}.Active}`, type: 'color' }
      },
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
    
    // Tags in Containers
    'Tag': {
      'Primary': {
        'BG': { value: `{Tag.${config.cShade}.Primary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.primaryText}.Text}`, type: 'color' }
      },
      'Secondary': {
        'BG': { value: `{Tag.${config.cShade}.Secondary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.secondaryText}.Text}`, type: 'color' }
      },
      'Tertiary': {
        'BG': { value: `{Tag.${config.cShade}.Tertiary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.tertiaryText}.Text}`, type: 'color' }
      },
      'Info': {
        'BG': { value: `{Tag.${config.cShade}.Info.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.infoText}.Text}`, type: 'color' }
      },
      'Success': {
        'BG': { value: `{Tag.${config.cShade}.Success.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.successText}.Text}`, type: 'color' }
      },
      'Warning': {
        'BG': { value: `{Tag.${config.cShade}.Warning.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.warningText}.Text}`, type: 'color' }
      },
      'Error': {
        'BG': { value: `{Tag.${config.cShade}.Error.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.errorText}.Text}`, type: 'color' }
      },
      'Neutral': {
        'BG': { value: `{Tag.${config.cShade}.Neutral.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.cShade}.${config.neutralText}.Text}`, type: 'color' }
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
    errorHeader: 'Error'
  });
  
  console.log('🔍 [generateAllThemes] Default theme generated with:');
  console.log('   Surfaces references:', defaultSettings.defaultTheme, '-', defaultSettings.defaultN);
  console.log('   Containers references:', defaultSettings.containerTheme, '-', defaultSettings.containerN);
  console.log('   CShade:', defaultSettings.containerShade);
  
  // 2. App-Bar Theme
  themes['App-Bar'] = generateSingleTheme({
    themeName: 'App-Bar',
    theme: defaultSettings.appBarTheme,
    n: defaultSettings.appBarN,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: defaultSettings.appBarN >= 11 ? 'Medium' : 'Light',
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
    errorHeader: 'Error'
  });
  
  // 3. Nav-Bar Theme
  themes['Nav-Bar'] = generateSingleTheme({
    themeName: 'Nav-Bar',
    theme: defaultSettings.navBarTheme,
    n: defaultSettings.navBarN,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: defaultSettings.navBarN >= 11 ? 'Medium' : 'Light',
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
    errorHeader: 'Error'
  });
  
  // 4. Status Theme
  themes.Status = generateSingleTheme({
    themeName: 'Status',
    theme: defaultSettings.statusTheme,
    n: defaultSettings.statusN,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: defaultSettings.statusN >= 11 ? 'Medium' : 'Light',
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
    errorHeader: 'Error'
  });
  
  // 5-7. Primary, Secondary, Tertiary Themes (use extracted PC/SC/TC)
  const PC = Math.round(extractedTones.primary);
  const SC = Math.round(extractedTones.secondary);
  const TC = Math.round(extractedTones.tertiary);
  const OB = PC >= 9 ? 8 : 6;

  // Helper to build common theme config
  const makeConfig = (themeName: string, theme: string, n: number): ThemeConfig => ({
    themeName,
    theme,
    n,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: n >= 9 ? 'Medium' as const : 'Light' as const,
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
    errorHeader: 'Error'
  });

  // Primary, Secondary, Tertiary — N = PC/SC/TC
  themes.Primary = generateSingleTheme(makeConfig('Primary', 'Primary', PC));
  themes.Secondary = generateSingleTheme(makeConfig('Secondary', 'Secondary', SC));
  themes.Tertiary = generateSingleTheme(makeConfig('Tertiary', 'Tertiary', TC));

  // Primary-Light, Secondary-Light, Tertiary-Light — N = 11
  themes['Primary-Light'] = generateSingleTheme(makeConfig('Primary-Light', 'Primary', 11));
  themes['Secondary-Light'] = generateSingleTheme(makeConfig('Secondary-Light', 'Secondary', 11));
  themes['Tertiary-Light'] = generateSingleTheme(makeConfig('Tertiary-Light', 'Tertiary', 11));

  // White and Black (replace Neutral/Neutral-Light/Neutral-Dark)
  themes.White = generateSingleTheme(makeConfig('White', 'Neutral', 12));
  themes.Black = generateSingleTheme(makeConfig('Black', 'Neutral', 1));

  // Info, Success, Warning, Error — N = OB
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[themeName] = generateSingleTheme(makeConfig(themeName, themeName, OB));
  });

  // Info-Light, Success-Light, Warning-Light, Error-Light — N = 11
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[`${themeName}-Light`] = generateSingleTheme(makeConfig(`${themeName}-Light`, themeName, 11));
  });
  
  // REMOVED: Dark and Medium variants — only {Theme} and {Theme}-Light remain
  
  console.log(`  ✓ Generated ${Object.keys(themes).length} complete themes with Surfaces and Containers for ${mode}`);
  
  return themes;
}