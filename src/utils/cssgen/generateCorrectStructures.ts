/**
 * Generate Tags section for Light Modes
 */
export function generateTagsSection(OB: number = 9): any {
  return {
    Light: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Primary.Color-Vibrant}', type: 'color' }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Secondary.Color-Vibrant}', type: 'color' }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Tertiary.Color-Vibrant}', type: 'color' }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Info.Color-Vibrant}', type: 'color' }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Success.Color-Vibrant}', type: 'color' }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Warning.Color-Vibrant}', type: 'color' }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Error.Color-Vibrant}', type: 'color' }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Neutral.Color-Vibrant}', type: 'color' }
      }
    },
    Medium: {
      Primary: {
        BG: { value: `{Colors.Primary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Primary.Color-${OB}}`, type: 'color' }
      },
      Secondary: {
        BG: { value: `{Colors.Secondary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Secondary.Color-${OB}}`, type: 'color' }
      },
      Tertiary: {
        BG: { value: `{Colors.Tertiary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Tertiary.Color-${OB}}`, type: 'color' }
      },
      Info: {
        BG: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Info.Color-${OB}}`, type: 'color' }
      },
      Success: {
        BG: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Success.Color-${OB}}`, type: 'color' }
      },
      Warning: {
        BG: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Warning.Color-${OB}}`, type: 'color' }
      },
      Error: {
        BG: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Error.Color-${OB}}`, type: 'color' }
      },
      Neutral: {
        BG: { value: `{Colors.Neutral.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Neutral.Color-${OB}}`, type: 'color' }
      }
    }
  };
}

/**
 * Generate Dark Mode Tags section
 */
export function generateDarkModeTagsSection(OB: number = 9): any {
  return {
    Light: {
      Primary: {
        BG: { value: '{Colors.Primary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Primary.Color-Vibrant}', type: 'color' }
      },
      Secondary: {
        BG: { value: '{Colors.Secondary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Secondary.Color-Vibrant}', type: 'color' }
      },
      Tertiary: {
        BG: { value: '{Colors.Tertiary.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Tertiary.Color-Vibrant}', type: 'color' }
      },
      Info: {
        BG: { value: '{Colors.Info.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Info.Color-Vibrant}', type: 'color' }
      },
      Success: {
        BG: { value: '{Colors.Success.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Success.Color-Vibrant}', type: 'color' }
      },
      Warning: {
        BG: { value: '{Colors.Warning.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Warning.Color-Vibrant}', type: 'color' }
      },
      Error: {
        BG: { value: '{Colors.Error.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Error.Color-Vibrant}', type: 'color' }
      },
      Neutral: {
        BG: { value: '{Colors.Neutral.Color-Vibrant}', type: 'color' },
        Text: { value: '{Text.Surfaces.Neutral.Color-Vibrant}', type: 'color' }
      }
    },
    Medium: {
      Primary: {
        BG: { value: `{Colors.Primary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Primary.Color-${OB}}`, type: 'color' }
      },
      Secondary: {
        BG: { value: `{Colors.Secondary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Secondary.Color-${OB}}`, type: 'color' }
      },
      Tertiary: {
        BG: { value: `{Colors.Tertiary.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Tertiary.Color-${OB}}`, type: 'color' }
      },
      Info: {
        BG: { value: `{Colors.Info.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Info.Color-${OB}}`, type: 'color' }
      },
      Success: {
        BG: { value: `{Colors.Success.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Success.Color-${OB}}`, type: 'color' }
      },
      Warning: {
        BG: { value: `{Colors.Warning.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Warning.Color-${OB}}`, type: 'color' }
      },
      Error: {
        BG: { value: `{Colors.Error.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Error.Color-${OB}}`, type: 'color' }
      },
      Neutral: {
        BG: { value: `{Colors.Neutral.Color-${OB}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.Neutral.Color-${OB}}`, type: 'color' }
      }
    }
  };
}

/**
 * Generate top-level Primary-Button section (NOT Primary-Buttons)
 * This is a sibling to Modes and SurfacesContainers
 * All values are {alias}
 */
export function generateTopLevelPrimaryButton(buttonStyle: 'primary-adaptive' | 'primary-fixed' | 'black-white' = 'primary-fixed'): any {
  const backgroundNames = ['Background-1', 'Background-2', 'Background-3', 'Background-4', 'Background-5',
    'Background-6', 'Background-7', 'Background-8', 'Background-9', 'Background-10',
    'Background-11', 'Background-12', 'Background-13', 'Background-14', 'Background-Vibrant'];

  // Helper to create a section with references
  const createSection = (styleType: string, surfaceOrContainer: string) => {
    const section: any = {};
    backgroundNames.forEach(bgName => {
      section[bgName] = {
        Button: { value: `{Primary-Buttons.${styleType}.${surfaceOrContainer}.${bgName}.Button}`, type: 'color' },
        Text: { value: `{Primary-Buttons.${styleType}.${surfaceOrContainer}.${bgName}.Text}`, type: 'color' },
        Border: { value: `{Primary-Buttons.${styleType}.${surfaceOrContainer}.${bgName}.Border}`, type: 'color' },
        Hover: { value: `{Primary-Buttons.${styleType}.${surfaceOrContainer}.${bgName}.Hover}`, type: 'color' },
        Active: { value: `{Primary-Buttons.${styleType}.${surfaceOrContainer}.${bgName}.Active}`, type: 'color' }
      };
    });
    return section;
  };

  // Map buttonStyle to the correct style type
  const styleTypeMap: Record<string, string> = {
    'primary-fixed': 'Primary-Fixed',
    'primary-adaptive': 'Primary-Adaptive',
    'black-white': 'Black-White'
  };
  
  const selectedStyleType = styleTypeMap[buttonStyle] || 'Primary-Fixed';

  return {
    Default: {
      Surfaces: createSection(selectedStyleType, 'Surfaces'),
      Containers: createSection(selectedStyleType, 'Containers')
    },
    'Primary-Fixed': {
      Surfaces: createSection('Primary-Fixed', 'Surfaces'),
      Containers: createSection('Primary-Fixed', 'Containers')
    },
    'Primary-Adaptive': {
      Surfaces: createSection('Primary-Adaptive', 'Surfaces'),
      Containers: createSection('Primary-Adaptive', 'Containers')
    },
    'Black-White': {
      Surfaces: createSection('Black-White', 'Surfaces'),
      Containers: createSection('Black-White', 'Containers')
    }
  };
}