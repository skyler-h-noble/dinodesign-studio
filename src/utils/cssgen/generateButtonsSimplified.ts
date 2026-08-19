/**
 * Simplified Button Generation System
 * Based on the new two-layer architecture from color-tokens-1.json spec
 * 
 * LAYER 1: Buttons Section (Base Button Definitions)
 * - Primary, Secondary, Tertiary, Neutral, Info, Success, Warning, Error, Black, White
 * - Each has Light and Medium contrast levels
 * - Uses actual color values with {OB} calculation
 * 
 * LAYER 2: Default-Button Section (References to Buttons.{X})
 * - Maps Default/Primary/Secondary/Tertiary/Neutral/Info/Success/Warning/Error to Buttons.{X}
 * - Based on button mode selection (Primary, Secondary, Tonal, Laddered, Black/White)
 * - Handles text coloring (Tonal vs Black/White)
 * 
 * UPDATE: OB now uses 9 when PC >= 9, else 8
 * UPDATE: Primary/Secondary/Tertiary buttons use PC/SC/TC instead of OB
 */

// Helper function to convert tone value (e.g., 71) to color number (e.g., 11)
function toneToColorNumber(tone: number): number {
  // 12-TONE SYSTEM: [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99]
  //                   1   2   3   4   5   6   7   8   9  10  11  12
  const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];

  // Find exact match
  const exactIndex = toneScale.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) {
    return exactIndex + 1; // Color-1 through Color-12
  }

  // Find closest tone
  let closestIndex = 0;
  let minDiff = Math.abs(toneScale[0] - tone);
  for (let i = 1; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - tone);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex + 1; // Color-N (1-12)
}

/**
 * Generate LAYER 1: Base Buttons Section
 * Contains the actual button definitions (Primary, Secondary, Tertiary, etc.)
 * Each button type has Light and Medium contrast levels
 */
export function generateBaseButtons(
  mode: 'Light-Mode' | 'Dark-Mode',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): any {
  const isDark = mode === 'Dark-Mode';

  // Dark-mode buttons do not use the dark ramp at all. Every button reaches
  // across the mode boundary and takes Light-Mode Color-8 — one tone, every
  // palette — so a dark-mode UI gets bright, saturated buttons carrying dark
  // labels rather than tinted slabs pulled from the dark ramp.
  //
  // Cross-mode references are an established form in this export: Quiet's
  // Color-Vibrant already reads {Modes.Light-Mode.Colors.X.Color-9}. They
  // resolve to a baked hex in both the CSS bundle and the Figma payload, so
  // downstream this IS a hard-coded colour — the reference only exists so the
  // value keeps tracking the light ramp when the brand changes.
  const DARK_BUTTON_N = 8;

  // Light-mode tones. In dark mode these are computed but unused: shade()
  // substitutes DARK_BUTTON_N for every palette.
  const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  // SC and TC are honoured EXACTLY — a Secondary button is Color-SC and a
  // Tertiary is Color-TC, whatever tone that is.
  //
  // There used to be a floor here: `(raw === 11 || raw <= 5) ? (PC >= 9 ? 9 : 8)`.
  // It contradicted the rule below ("SECONDARY BUTTON — both shades use
  // Color-SC") and it silently swallowed every dark, saturated pick: a
  // secondary of #2563eb lands on SC=5, tripped `raw <= 5`, and shipped as
  // Color-8 (#b7c0ff) — the colour never appeared in the design at all. Button
  // TEXT contrast is not this function's job; it is computed per button against
  // whatever fill is chosen, so a dark fill simply gets a light label.
  //
  // The one case that is NOT a tone is a missing extraction — that still falls
  // back to the other-buttons tone rather than pretending to be an SC.
  const fallbackTone = PC >= 9 ? 9 : 8;
  const SC = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : fallbackTone;
  const TC = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : fallbackTone;

  // State buttons (Info/Success/Warning/Error) are pinned to Color-5.
  //
  // This used to be `PC >= 9 ? 6 : 5`, so a light primary silently moved every
  // state button one step lighter — and that step changes the LABEL, because
  // the contrast logic follows the fill. Measured across all four palettes:
  //
  //   Color-5   white 7.2:1 ✓   black 2.8:1 ✗
  //   Color-6   white 3.4:1 ✗   black 6.0:1 ✓
  //
  // So the tone silently decided whether an error button read white-on-red or
  // black-on-salmon, depending on an unrelated choice of primary. Color-5 is
  // the tone that carries a white label everywhere, which is what a state
  // colour is for — the meaning should not shift with the brand.
  const OB = 5;
  
  console.log(`🔘 [generateBaseButtons] Mode: ${mode}`);
  console.log(`  📊 EXTRACTED TONES INPUT:`, extractedTones);
  console.log(`  🎯 CALCULATED COLOR-N VALUES:`);
  console.log(`     PC=${PC} (from primary tone ${extractedTones?.primary || 'default'})`);
  console.log(`     SC=${SC} (from secondary tone ${extractedTones?.secondary || 'default'})`);
  console.log(`     TC=${TC} (from tertiary tone ${extractedTones?.tertiary || 'default'})`);
  console.log(`     OB=${OB}`);
  console.log(`  🎨 BUTTON PALETTE REFERENCES:`);
  console.log(`     buttons.Primary.Medium → {Colors.Primary.Color-${PC}}`);
  console.log(`     buttons.Secondary.Medium → {Colors.Secondary.Color-${SC}}`);
  console.log(`     buttons.Tertiary.Medium → {Colors.Tertiary.Color-${TC}}`);
  console.log(`     buttons.Neutral.Medium → {Colors.Neutral.Color-${OB}}`);
  
  const buttons: any = {};

  /**
   * The four colour slots for one palette at one tone.
   *
   * In dark mode the prefix sends every lookup into the Light-Mode collection
   * and the tone is forced to Color-8, so fill, label, hover and pressed all
   * come from the same light ramp and stay consistent with each other. Reading
   * the fill from light and the label from dark would be the obvious bug here.
   */
  const shade = (palette: string, n: number) => {
    const from = isDark ? 'Modes.Light-Mode.' : '';
    const tone = isDark ? DARK_BUTTON_N : n;
    return {
      Button:  { value: `{${from}Colors.${palette}.Color-${tone}}`, type: 'color' },
      Text:    { value: `{${from}Text.Surfaces.${palette}.Color-${tone}}`, type: 'color' },
      Hover:   { value: `{${from}Hover.${palette}.Color-${tone}}`, type: 'color' },
      Pressed: { value: `{${from}Pressed.${palette}.Color-${tone}}`, type: 'color' },
    };
  };

  /** Light and Medium have carried identical values since the SC/TC rule
   *  landed; they stay separate because the lib reads both names. */
  const bothShades = (palette: string, n: number) => ({
    Light: shade(palette, n),
    Medium: shade(palette, n),
  });

  buttons.Primary   = bothShades('Primary', PC);
  buttons.Secondary = bothShades('Secondary', SC);
  buttons.Tertiary  = bothShades('Tertiary', TC);
  buttons.Neutral   = bothShades('Neutral', 8);
  buttons.Info      = bothShades('Info', OB);
  buttons.Success   = bothShades('Success', OB);
  buttons.Warning   = bothShades('Warning', OB);
  buttons.Error     = bothShades('Error', OB);

  // BLACK AND WHITE BUTTONS
  //
  // These used to be a single `BlackWhite` entry whose Light/Medium shades
  // carried the two faces — and the shades SWAPPED between modes: "Light" was
  // the white button in Light-Mode and the black one in Dark-Mode. Naming a
  // black button "Light" is bad enough; having it mean the opposite depending
  // on mode made every reference to it a guess.
  //
  // They are now two palettes named for the colour they are, stable across
  // modes. Only the states differ per mode: a black face on a dark background
  // has to step lighter to show a hover at all, and vice versa.
  //
  // The label reference is mode-dependent for a blunt reason: Light-Mode has a
  // curated Text.Surfaces.BW-Button table, and Dark-Mode has no such group at
  // all. Pointing dark at it shipped the literal string
  // "{Text.Surfaces.BW-Button.Color-12}" into the Figma payload and the CSS,
  // so the black/white button's label had no colour in dark mode. Dark points
  // straight at the neutral ends instead.
  const blackFace = () => ({
    Button: { value: '{Colors.Neutral.Color-1}', type: 'color' },
    Text: { value: isDark ? '{Colors.White}' : '{Text.Surfaces.BW-Button.Color-12}', type: 'color' },
    Hover: { value: isDark ? '{Hover.Neutral.Color-2}' : '{Hover.Neutral.Color-1}', type: 'color' },
    Pressed: { value: isDark ? '{Pressed.Neutral.Color-3}' : '{Pressed.Neutral.Color-1}', type: 'color' },
  });
  const whiteFace = () => ({
    Button: { value: '{White}', type: 'color' },
    Text: { value: isDark ? '{Colors.Neutral.Color-1}' : '{Text.Surfaces.BW-Button.Color-1}', type: 'color' },
    Hover: { value: '{Hover.Neutral.Color-11}', type: 'color' },
    Pressed: { value: isDark ? '{Pressed.Neutral.Color-10}' : '{Pressed.Neutral.Color-12}', type: 'color' },
  });
  buttons.Black = { Light: blackFace(), Medium: blackFace() };
  buttons.White = { Light: whiteFace(), Medium: whiteFace() };

  return buttons;
}

/**
 * Get button theme mappings based on button mode selection
 * Returns which color theme {X} each button should use
 */
function getButtonThemeMappings(
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  mode: 'Light-Mode' | 'Dark-Mode'
): {
  Default: string;
  Primary: string;
  Secondary: string;
  Tertiary: string;
  Neutral: string;
  Info: string;
  Success: string;
  Warning: string;
  Error: string;
} {
  // Handle Black/White mode special case for Dark Mode
  if (buttonMode === 'black-white' && mode === 'Dark-Mode') {
    // Dark Mode Black/White: Use Primary/Secondary/Tertiary colors
    return {
      Default: 'Primary',
      Primary: 'Primary',
      Secondary: 'Secondary',
      Tertiary: 'Tertiary',
      Neutral: 'Primary',
      Info: 'Info',
      Success: 'Success',
      Warning: 'Warning',
      Error: 'Error'
    };
  }
  
  switch (buttonMode) {
    case 'primary':
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Primary',
        Tertiary: 'Primary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'secondary':
      return {
        Default: 'Secondary',
        Primary: 'Secondary',
        Secondary: 'Secondary',
        Tertiary: 'Secondary',
        Neutral: 'Secondary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'tonal':
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Secondary',
        Tertiary: 'Tertiary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'laddered':
      // Laddered: Uses a ladder pattern
      // Default: If Default is Primary then Secondary, Else Primary (evaluates to Secondary)
      // Primary → Secondary, Secondary → Tertiary, Tertiary → Secondary, Neutral → Primary
      return {
        Default: 'Secondary',
        Primary: 'Secondary',
        Secondary: 'Tertiary',
        Tertiary: 'Secondary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
    
    case 'black-white': {
      // Whichever face reads as the "solid" button for this mode: black on a
      // light page, white on a dark one. This is the swap that used to be
      // hidden inside the Light/Medium shade names.
      const bw = mode === 'Dark-Mode' ? 'White' : 'Black';
      return {
        Default: bw, Primary: bw, Secondary: bw, Tertiary: bw, Neutral: bw,
        Info: bw, Success: bw, Warning: bw, Error: bw,
      };
    }
    
    default:
      return {
        Default: 'Primary',
        Primary: 'Primary',
        Secondary: 'Secondary',
        Tertiary: 'Tertiary',
        Neutral: 'Primary',
        Info: 'Info',
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error'
      };
  }
}

/**
 * Get text theme mappings based on text coloring mode
 * Returns which theme to use for button text
 */
function getTextThemeMappings(
  textColoring: 'tonal' | 'black-white',
  buttonThemeMappings: ReturnType<typeof getButtonThemeMappings>
): typeof buttonThemeMappings {
  // Button text ALWAYS uses the button's own palette for contrast
  // BW text coloring only affects surface/container text, not button text
  // Button text must have 4.5:1 contrast against the BUTTON BG, not the surface BG
  return buttonThemeMappings;
}

/**
 * Generate LAYER 2: Default-Button Section
 * References Buttons.{X} based on button mode and text coloring selections
 */
export function generateDefaultButton(
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  textColoring: 'tonal' | 'black-white',
  mode: 'Light-Mode' | 'Dark-Mode'
): any {
  // CRITICAL FIX: Text coloring should ONLY affect text, NOT button backgrounds
  // Button backgrounds are controlled by buttonMode only
  // Text colors are controlled by textColoring only
  
  const buttonMappings = getButtonThemeMappings(buttonMode, mode);
  const textMappings = getTextThemeMappings(textColoring, buttonMappings);
  
  console.log(`🔘 [generateDefaultButton] Mode: ${mode}, ButtonMode: ${buttonMode}, TextColoring: ${textColoring}`);
  console.log(`  Button Mappings (for backgrounds):`, buttonMappings);
  console.log(`  Text Mappings (for text only):`, textMappings);
  
  const defaultButton: any = {};
  
  // Generate Default button
  defaultButton.Default = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Default}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Default}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Default}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Default}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Default}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Default}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Default}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Default}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Primary button
  defaultButton.Primary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Primary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Primary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Primary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Primary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Primary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Primary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Primary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Primary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Secondary button
  defaultButton.Secondary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Secondary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Secondary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Secondary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Secondary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Secondary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Secondary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Tertiary button
  defaultButton.Tertiary = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Tertiary}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Tertiary}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Tertiary}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Tertiary}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Neutral button
  defaultButton.Neutral = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Neutral}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Neutral}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Neutral}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Neutral}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Neutral}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Neutral}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Info button
  defaultButton.Info = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Info}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Info}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Info}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Info}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Info}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Info}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Info}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Info}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Success button
  defaultButton.Success = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Success}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Success}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Success}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Success}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Success}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Success}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Success}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Success}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Warning button
  defaultButton.Warning = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Warning}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Warning}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Warning}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Warning}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Warning}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Warning}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Warning}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Warning}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  // Generate Error button
  defaultButton.Error = {
    Light: {
      Button: { value: `{Buttons.${buttonMappings.Error}.Light.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Error}.Light.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Error}.Light.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Error}.Light.Pressed}`, type: 'color' }
    },
    Medium: {
      Button: { value: `{Buttons.${buttonMappings.Error}.Medium.Button}`, type: 'color' },
      Text: { value: `{Buttons.${textMappings.Error}.Medium.Text}`, type: 'color' },
      Hover: { value: `{Buttons.${buttonMappings.Error}.Medium.Hover}`, type: 'color' },
      Pressed: { value: `{Buttons.${buttonMappings.Error}.Medium.Pressed}`, type: 'color' }
    }
  };
  
  return defaultButton;
}

/**
 * Generate complete button system for a mode
 * Returns both Buttons (Layer 1) and Default-Button (Layer 2)
 */
export function generateCompleteButtonSystem(
  mode: 'Light-Mode' | 'Dark-Mode',
  buttonMode: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white',
  textColoring: 'tonal' | 'black-white',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): {
  Buttons: any;
  'Default-Button': any;
} {
  console.log(`\n🎨🎨🎨 [generateCompleteButtonSystem] === START for ${mode} ===`);
  console.log(`  ButtonMode: ${buttonMode}`);
  console.log(`  TextColoring: ${textColoring}`);
  
  const buttons = generateBaseButtons(mode, extractedTones);
  const defaultButton = generateDefaultButton(buttonMode, textColoring, mode);
  
  console.log(`  ✓ Generated Buttons section (9 button types)`);
  console.log(`  ✓ Generated Default-Button section (9 button references)`);
  console.log(`🎨🎨🎨 [generateCompleteButtonSystem] === END for ${mode} ===\n`);
  
  return {
    Buttons: buttons,
    'Default-Button': defaultButton
  };
}