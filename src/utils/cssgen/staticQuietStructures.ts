/**
 * Complete Quiet token structures for Light Mode and Dark Mode
 * Extracted from sample-output.json with all palettes
 */

export function getStaticQuietTokensForLightMode() {
  const createQuietPaletteMapping = (paletteName: string) => ({
    'Color-1': { value: `{Colors.${paletteName}.Color-7}`, type: 'color' },
    'Color-2': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-3': { value: `{Colors.${paletteName}.Color-9}`, type: 'color' },
    'Color-4': { value: `{Colors.${paletteName}.Color-10}`, type: 'color' },
    'Color-5': { value: `{Colors.${paletteName}.Color-11}`, type: 'color' },
    'Color-6': { value: `{Colors.${paletteName}.Color-14}`, type: 'color' },
    'Color-7': { value: `{Colors.${paletteName}.Color-1}`, type: 'color' },
    'Color-8': { value: `{Colors.${paletteName}.Color-2}`, type: 'color' },
    'Color-9': { value: `{Colors.${paletteName}.Color-3}`, type: 'color' },
    'Color-10': { value: `{Colors.${paletteName}.Color-4}`, type: 'color' },
    'Color-11': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-12': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-13': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-14': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-Vibrant': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' }
  });

  return {
    Surfaces: {
      Neutral: createQuietPaletteMapping('Neutral'),
      Primary: createQuietPaletteMapping('Primary'),
      Secondary: createQuietPaletteMapping('Secondary'),
      Tertiary: createQuietPaletteMapping('Tertiary'),
      Info: createQuietPaletteMapping('Info'),
      Success: createQuietPaletteMapping('Success'),
      Warning: createQuietPaletteMapping('Warning'),
      Error: createQuietPaletteMapping('Error'),
      'Hotlink-Visited': createQuietPaletteMapping('Hotlink-Visited'),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-7}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-9}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-11}', type: 'color' },
        'Color-6': { value: '{Colors.Neutral.Color-14}', type: 'color' },
        'Color-7': { value: '{Colors.White}', type: 'color' },
        'Color-8': { value: '{Colors.White}', type: 'color' },
        'Color-9': { value: '{Colors.White}', type: 'color' },
        'Color-10': { value: '{Colors.White}', type: 'color' },
        'Color-11': { value: '{Colors.White}', type: 'color' },
        'Color-12': { value: '{Colors.White}', type: 'color' },
        'Color-13': { value: '{Colors.White}', type: 'color' },
        'Color-14': { value: '{Colors.White}', type: 'color' },
        'Color-Vibrant': { value: '{Colors.White}', type: 'color' }
      }
    },
    Containers: {
      Neutral: createQuietPaletteMapping('Neutral'),
      Primary: createQuietPaletteMapping('Primary'),
      Secondary: createQuietPaletteMapping('Secondary'),
      Tertiary: createQuietPaletteMapping('Tertiary'),
      Info: createQuietPaletteMapping('Info'),
      Success: createQuietPaletteMapping('Success'),
      Warning: createQuietPaletteMapping('Warning'),
      Error: createQuietPaletteMapping('Error'),
      'Hotlink-Visited': createQuietPaletteMapping('Hotlink-Visited'),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-7}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-9}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-11}', type: 'color' },
        'Color-6': { value: '{Colors.Neutral.Color-14}', type: 'color' },
        'Color-7': { value: '{Colors.White}', type: 'color' },
        'Color-8': { value: '{Colors.White}', type: 'color' },
        'Color-9': { value: '{Colors.White}', type: 'color' },
        'Color-10': { value: '{Colors.White}', type: 'color' },
        'Color-11': { value: '{Colors.White}', type: 'color' },
        'Color-12': { value: '{Colors.White}', type: 'color' },
        'Color-13': { value: '{Colors.White}', type: 'color' },
        'Color-14': { value: '{Colors.White}', type: 'color' },
        'Color-Vibrant': { value: '{Colors.White}', type: 'color' }
      }
    }
  };
}

export function getStaticQuietTokensForDarkMode() {
  // Most palettes use Color-7 for Color-14, except Primary which uses Color-4
  const createDarkModeQuietMapping = (paletteName: string, usesPrimaryVariant: boolean = false) => ({
    'Color-1': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-2': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-3': { value: `{Colors.${paletteName}.Color-10}`, type: 'color' },
    'Color-4': { value: `{Colors.${paletteName}.Color-10}`, type: 'color' },
    'Color-5': { value: `{Colors.${paletteName}.Color-12}`, type: 'color' },
    'Color-6': { value: `{Colors.${paletteName}.Color-13}`, type: 'color' },
    'Color-7': { value: `{Colors.${paletteName}.Color-13}`, type: 'color' },
    'Color-8': { value: `{Colors.${paletteName}.Color-2}`, type: 'color' },
    'Color-9': { value: `{Colors.${paletteName}.Color-3}`, type: 'color' },
    'Color-10': { value: `{Colors.${paletteName}.Color-4}`, type: 'color' },
    'Color-11': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-12': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-13': { value: `{Colors.${paletteName}.Color-7}`, type: 'color' },
    'Color-14': { value: usesPrimaryVariant ? `{Colors.${paletteName}.Color-4}` : `{Colors.${paletteName}.Color-7}`, type: 'color' },
    'Color-Vibrant': { value: `{Modes.Light-Mode.Colors.${paletteName}.Color-11}`, type: 'color' }
  });

  return {
    Surfaces: {
      Neutral: createDarkModeQuietMapping('Neutral', false),
      Primary: createDarkModeQuietMapping('Primary', true), // Primary uses Color-4 for Color-14
      Secondary: createDarkModeQuietMapping('Secondary', false),
      Tertiary: createDarkModeQuietMapping('Tertiary', false),
      Info: createDarkModeQuietMapping('Info', false),
      Success: createDarkModeQuietMapping('Success', false),
      Warning: createDarkModeQuietMapping('Warning', false),
      Error: createDarkModeQuietMapping('Error', false),
      'Hotlink-Visited': createDarkModeQuietMapping('Hotlink-Visited', false),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-12}', type: 'color' },
        'Color-6': { value: '{Colors.Neutral.Color-13}', type: 'color' },
        'Color-7': { value: '{Colors.Neutral.Color-13}', type: 'color' },
        'Color-8': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-9': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-10': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-11': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-12': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-13': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-14': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Neutral.Color-11}', type: 'color' }
      }
    },
    Containers: {
      Neutral: createDarkModeQuietMapping('Neutral', false),
      Primary: createDarkModeQuietMapping('Primary', true), // Primary uses Color-4 for Color-14
      Secondary: createDarkModeQuietMapping('Secondary', false),
      Tertiary: createDarkModeQuietMapping('Tertiary', false),
      Info: createDarkModeQuietMapping('Info', false),
      Success: createDarkModeQuietMapping('Success', false),
      Warning: createDarkModeQuietMapping('Warning', false),
      Error: createDarkModeQuietMapping('Error', false),
      'Hotlink-Visited': createDarkModeQuietMapping('Hotlink-Visited', false),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-12}', type: 'color' },
        'Color-6': { value: '{Colors.Neutral.Color-13}', type: 'color' },
        'Color-7': { value: '{Colors.Neutral.Color-13}', type: 'color' },
        'Color-8': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-9': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-10': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-11': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-12': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-13': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-14': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Neutral.Color-11}', type: 'color' }
      }
    }
  };
}