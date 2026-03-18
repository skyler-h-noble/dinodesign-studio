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
 * Generate a single theme with Surfaces and Containers sections
 */
function generateSingleTheme(config: ThemeConfig): any {
  const theme: any = {};
  
  // Surfaces Section
  theme.Surfaces = {
    'Surface': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface}`,
      type: 'color'
    },
    'Surface-Dim': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface-Dim}`,
      type: 'color'
    },
    'Surface-Bright': {
      value: `{Backgrounds.${config.theme}.Background-${config.n}.Surfaces.Surface-Bright}`,
      type: 'color'
    },
    'Quiet': {
      value: config.defaultText === 'BW' 
        ? `{Quiet.Surfaces.BW.Color-${config.n}}`
        : `{Quiet.Surfaces.${config.defaultText}.Color-${config.n}}`,
      type: 'color'
    },
    'Text': {
      value: config.defaultText === 'BW'
        ? `{Text.Surfaces.BW.Color-${config.n}}`
        : `{Text.Surfaces.${config.defaultText}.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Primary': {
      value: `{Text.Surfaces.Primary.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Secondary': {
      value: `{Text.Surfaces.Secondary.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Tertiary': {
      value: `{Text.Surfaces.Tertiary.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Neutral': {
      value: `{Text.Surfaces.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Info': {
      value: `{Text.Surfaces.Info.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Success': {
      value: `{Text.Surfaces.Success.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Warning': {
      value: `{Text.Surfaces.Warning.Color-${config.n}}`,
      type: 'color'
    },
    'Text-Error': {
      value: `{Text.Surfaces.Error.Color-${config.n}}`,
      type: 'color'
    },
    'Header': {
      value: `{Header.Surfaces.${config.defaultHeader}.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Primary': {
      value: `{Header.Surfaces.Primary.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Secondary': {
      value: `{Header.Surfaces.Secondary.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Tertiary': {
      value: `{Header.Surfaces.Tertiary.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Neutral': {
      value: `{Header.Surfaces.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Info': {
      value: `{Header.Surfaces.Info.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Success': {
      value: `{Header.Surfaces.Success.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Warning': {
      value: `{Header.Surfaces.Warning.Color-${config.n}}`,
      type: 'color'
    },
    'Header-Error': {
      value: `{Header.Surfaces.Error.Color-${config.n}}`,
      type: 'color'
    },
    'Border': {
      value: `{Border.Surfaces.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Border-Variant': {
      value: `{Border-Variant.Surfaces.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Hover': {
      value: `{Hover.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Active': {
      value: `{Active.Neutral.Color-${config.n}}`,
      type: 'color'
    },
    'Hotlink': {
      value: `{Text.Surfaces.Info.Color-${config.n}}`,
      type: 'color'
    },
    'Hotlink-Visited': {
      value: `{Text.Surfaces.Hotlink-Visited.Color-${config.n}}`,
      type: 'color'
    },
    'Focus-Visible': {
      value: `{Focus-Visible.Surfaces.Color-${config.n}}`,
      type: 'color'
    },
    
    // Buttons in Surfaces
    'Buttons': {
      'Default': {
        'Button': { value: `{Default-Button.Default.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Default.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Default.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Default.${config.shade}.Active}`, type: 'color' }
      },
      'Primary': {
        'Button': { value: `{Default-Button.Primary.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Primary.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Primary.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Primary.${config.shade}.Active}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Default-Button.Secondary.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Secondary.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Secondary.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Secondary.${config.shade}.Active}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Default-Button.Tertiary.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Tertiary.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Tertiary.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Tertiary.${config.shade}.Active}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Default-Button.Neutral.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Neutral.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Neutral.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Neutral.${config.shade}.Active}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Default-Button.Info.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Info.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Info.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Info.${config.shade}.Active}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Default-Button.Success.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Success.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Success.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Success.${config.shade}.Active}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Default-Button.Warning.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Warning.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Warning.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Warning.${config.shade}.Active}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Default-Button.Error.${config.shade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Error.${config.shade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Surfaces.${config.theme}.Color-${config.n}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Error.${config.shade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Error.${config.shade}.Active}`, type: 'color' }
      }
    },
    
    // Icons in Surfaces
    'Icons': {
      'Default': { value: `{Icon.Surfaces.Neutral.Color-${config.n}}`, type: 'color' },
      'Default-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${config.n}}`, type: 'color' },
      'Primary': { value: `{Icon.Surfaces.Primary.Color-${config.n}}`, type: 'color' },
      'Primary-Variant': { value: `{Icon-Variant.Surfaces.Primary.Color-${config.n}}`, type: 'color' },
      'Secondary': { value: `{Icon.Surfaces.Secondary.Color-${config.n}}`, type: 'color' },
      'Secondary-Variant': { value: `{Icon-Variant.Surfaces.Secondary.Color-${config.n}}`, type: 'color' },
      'Tertiary': { value: `{Icon.Surfaces.Tertiary.Color-${config.n}}`, type: 'color' },
      'Tertiary-Variant': { value: `{Icon-Variant.Surfaces.Tertiary.Color-${config.n}}`, type: 'color' },
      'Neutral': { value: `{Icon.Surfaces.Neutral.Color-${config.n}}`, type: 'color' },
      'Neutral-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${config.n}}`, type: 'color' },
      'Info': { value: `{Icon.Surfaces.Info.Color-${config.n}}`, type: 'color' },
      'Info-Variant': { value: `{Icon-Variant.Surfaces.Info.Color-${config.n}}`, type: 'color' },
      'Success': { value: `{Icon.Surfaces.Success.Color-${config.n}}`, type: 'color' },
      'Success-Variant': { value: `{Icon-Variant.Surfaces.Success.Color-${config.n}}`, type: 'color' },
      'Warning': { value: `{Icon.Surfaces.Warning.Color-${config.n}}`, type: 'color' },
      'Warning-Variant': { value: `{Icon-Variant.Surfaces.Warning.Color-${config.n}}`, type: 'color' },
      'Error': { value: `{Icon.Surfaces.Error.Color-${config.n}}`, type: 'color' },
      'Error-Variant': { value: `{Icon-Variant.Surfaces.Error.Color-${config.n}}`, type: 'color' }
    },
    
    // Tags in Surfaces
    'Tag': {
      'Primary': {
        'BG': { value: `{Tag.${config.shade}.Primary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.primaryText}.Text}`, type: 'color' }
      },
      'Secondary': {
        'BG': { value: `{Tag.${config.shade}.Secondary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.secondaryText}.Text}`, type: 'color' }
      },
      'Tertiary': {
        'BG': { value: `{Tag.${config.shade}.Tertiary.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.tertiaryText}.Text}`, type: 'color' }
      },
      'Info': {
        'BG': { value: `{Tag.${config.shade}.Info.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.infoText}.Text}`, type: 'color' }
      },
      'Success': {
        'BG': { value: `{Tag.${config.shade}.Success.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.successText}.Text}`, type: 'color' }
      },
      'Warning': {
        'BG': { value: `{Tag.${config.shade}.Warning.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.warningText}.Text}`, type: 'color' }
      },
      'Error': {
        'BG': { value: `{Tag.${config.shade}.Error.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.errorText}.Text}`, type: 'color' }
      },
      'Neutral': {
        'BG': { value: `{Tag.${config.shade}.Neutral.BG}`, type: 'color' },
        'Text': { value: `{Tag.${config.shade}.${config.neutralText}.Text}`, type: 'color' }
      }
    }
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
        'Button': { value: `{Default-Button.Primary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Primary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Primary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Primary.${config.cShade}.Active}`, type: 'color' }
      },
      'Secondary': {
        'Button': { value: `{Default-Button.Secondary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Secondary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Secondary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Secondary.${config.cShade}.Active}`, type: 'color' }
      },
      'Tertiary': {
        'Button': { value: `{Default-Button.Tertiary.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Tertiary.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Tertiary.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Tertiary.${config.cShade}.Active}`, type: 'color' }
      },
      'Neutral': {
        'Button': { value: `{Default-Button.Neutral.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Neutral.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Neutral.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Neutral.${config.cShade}.Active}`, type: 'color' }
      },
      'Info': {
        'Button': { value: `{Default-Button.Info.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Info.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Info.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Info.${config.cShade}.Active}`, type: 'color' }
      },
      'Success': {
        'Button': { value: `{Default-Button.Success.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Success.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Success.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Success.${config.cShade}.Active}`, type: 'color' }
      },
      'Warning': {
        'Button': { value: `{Default-Button.Warning.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Warning.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Warning.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Warning.${config.cShade}.Active}`, type: 'color' }
      },
      'Error': {
        'Button': { value: `{Default-Button.Error.${config.cShade}.Button}`, type: 'color' },
        'Text': { value: `{Default-Button.Error.${config.cShade}.Text}`, type: 'color' },
        'Border': { value: `{Default-Button-Border.Containers.${config.contTheme}.Color-${config.contN}}`, type: 'color' },
        'Hover': { value: `{Default-Button.Error.${config.cShade}.Hover}`, type: 'color' },
        'Active': { value: `{Default-Button.Error.${config.cShade}.Active}`, type: 'color' }
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
    appBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    navBar?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    status?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
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
  
  // 5-8. Primary, Secondary, Tertiary, Neutral Themes (use extracted PC value)
  const PC = Math.round(extractedTones.primary);
  const SC = Math.round(extractedTones.secondary);
  const TC = Math.round(extractedTones.tertiary);
  
  themes.Primary = generateSingleTheme({
    themeName: 'Primary',
    theme: 'Primary',
    n: PC,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: PC >= 11 ? 'Medium' : 'Light',
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
  
  themes.Secondary = generateSingleTheme({
    themeName: 'Secondary',
    theme: 'Secondary',
    n: SC,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: SC >= 11 ? 'Medium' : 'Light',
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
  
  themes.Tertiary = generateSingleTheme({
    themeName: 'Tertiary',
    theme: 'Tertiary',
    n: TC,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: TC >= 11 ? 'Medium' : 'Light',
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
  
  themes.Neutral = generateSingleTheme({
    themeName: 'Neutral',
    theme: 'Neutral',
    n: mode === 'Light-Mode' ? 14 : 1, // Neutral: 14 for Light Mode, 1 for Dark Mode
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: mode === 'Light-Mode' ? 'Medium' : 'Light',
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
  
  // 9-12. Light variants (N=13 for colors, N=14 for Neutral)
  ['Primary', 'Secondary', 'Tertiary'].forEach(themeName => {
    themes[`${themeName}-Light`] = generateSingleTheme({
      themeName: `${themeName}-Light`,
      theme: themeName,
      n: 13,
      contTheme: defaultSettings.containerTheme,
      contN: defaultSettings.containerN,
      shade: 'Medium',
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
  });
  
  themes['Neutral-Light'] = generateSingleTheme({
    themeName: 'Neutral-Light',
    theme: 'Neutral',
    n: 14,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: 'Medium',
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
  
  // 13-16. Info, Success, Warning, Error themes
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[themeName] = generateSingleTheme({
      themeName: themeName,
      theme: themeName,
      n: mode === 'Light-Mode' ? 13 : 3,
      contTheme: defaultSettings.containerTheme,
      contN: defaultSettings.containerN,
      shade: 'Medium',
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
  });
  
  // 17-20. Info, Success, Warning, Error Light variants
  ['Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[`${themeName}-Light`] = generateSingleTheme({
      themeName: `${themeName}-Light`,
      theme: themeName,
      n: 13,
      contTheme: defaultSettings.containerTheme,
      contN: defaultSettings.containerN,
      shade: 'Medium',
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
  });
  
  // 21-27. Medium variants (N=6 for colors, N=9 for Neutral)
  ['Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[`${themeName}-Medium`] = generateSingleTheme({
      themeName: `${themeName}-Medium`,
      theme: themeName,
      n: 6,
      contTheme: defaultSettings.containerTheme,
      contN: defaultSettings.containerN,
      shade: 'Light',
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
  });
  
  themes['Neutral-Medium'] = generateSingleTheme({
    themeName: 'Neutral-Medium',
    theme: 'Neutral',
    n: 9,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: 'Light',
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
  
  // 28-35. Dark variants (N=3 for colors, N=1 for Neutral)
  ['Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'].forEach(themeName => {
    themes[`${themeName}-Dark`] = generateSingleTheme({
      themeName: `${themeName}-Dark`,
      theme: themeName,
      n: 3,
      contTheme: defaultSettings.containerTheme,
      contN: defaultSettings.containerN,
      shade: 'Light',
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
  });
  
  themes['Neutral-Dark'] = generateSingleTheme({
    themeName: 'Neutral-Dark',
    theme: 'Neutral',
    n: 1,
    contTheme: defaultSettings.containerTheme,
    contN: defaultSettings.containerN,
    shade: 'Light',
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
  
  console.log(`  ✓ Generated ${Object.keys(themes).length} complete themes with Surfaces and Containers for ${mode}`);
  
  return themes;
}