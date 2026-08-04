// Button logic update - OB=8 when PC>=9 - 12-tone scale
import { blendColors } from '../colorScale';
import { dropshadowBaseHex } from '../dropshadow';
import chroma from 'chroma-js';
import { 
  generateSimplifiedLightModeBackgrounds,
  generateSimplifiedDarkModeBackgrounds
} from './generateSimplifiedBackgrounds';
import { generateTagsSection, generateDarkModeTagsSection, generateTopLevelPrimaryButton } from './generateCorrectStructures';
import { lightModeTextFixed } from './lightModeTonalTextFixedStructure';
import { darkModeTextFixed } from './darkModeTextFixedStructure';
import { darkModeBorderFixed } from './darkModeBorderFixedStructure';
import { lightModeHeaderFixed } from './lightModeTonalHeaderFixedStructure';
import { darkModeHeaderFixed } from './darkModeHeaderFixedStructure';
import { getStaticHoverTokens, getStaticActiveTokens, getStaticQuietTokensForLightMode, getStaticQuietTokensForDarkMode } from './staticTokenStructures';
import { calculateDefaultThemeSettings, getSelectionName, applyUserSelections } from './defaultThemeLogic';
import { generateAllButtonsForMode } from './generateButtons';
import { generateCompleteButtonSystem } from './generateButtonsSimplified';
import { generateCompleteSimplifiedSystem } from './completeSimplifiedSystem';

// Helper function to convert tone value to Color-X number
// 12-TONE SYSTEM: [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99]
//                   1   2   3   4   5   6   7   8   9  10  11  12
function toneToColorNumber(tone: number): number {
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

// Types for the export structure
interface ColorToken {
  value: string;
  type: string;
}

interface SurfacesDetails {
  Surface: ColorToken;
  'Surface-Dim': ColorToken;
  'Surface-Bright': ColorToken;
  Header: ColorToken;
  Text: ColorToken;
  Quiet: ColorToken;
  Border: ColorToken;
  'Border-Variant': ColorToken;
  Hotlink: ColorToken;
  'Hotlink-Visited': ColorToken;
  Hover: ColorToken;
  Pressed: ColorToken;
}

interface ContainersDetails {
  Container: ColorToken;
  'Container-Lowest': ColorToken;
  'Container-Low': ColorToken;
  'Container-High': ColorToken;
  'Container-Highest': ColorToken;
  Header: ColorToken;
  Text: ColorToken;
  Quiet: ColorToken;
  Border: ColorToken;
  'Border-Variant': ColorToken;
  Hotlink: ColorToken;
  'Hotlink-Visited': ColorToken;
  Hover: ColorToken;
  Pressed: ColorToken;
}

interface SurfacesAndContainers {
  Surfaces: SurfacesDetails;
  Containers: ContainersDetails;
}

interface ButtonDetails {
  Button: ColorToken;
  Text: ColorToken;
  Border: ColorToken;
  Hover: ColorToken;
  Pressed: ColorToken;
}

interface ButtonsForBackground {
  Primary: ButtonDetails;
  'Primary-Light': ButtonDetails;
  Secondary: ButtonDetails;
  'Secondary-Light': ButtonDetails;
  Tertiary: ButtonDetails;
  'Tertiary-Light': ButtonDetails;
  Neutral: ButtonDetails;
  'Neutral-Light': ButtonDetails;
  Info: ButtonDetails;
  'Info-Light': ButtonDetails;
  Success: ButtonDetails;
  'Success-Light': ButtonDetails;
  Warning: ButtonDetails;
  'Warning-Light': ButtonDetails;
  Error: ButtonDetails;
  'Error-Light': ButtonDetails;
}

interface ButtonsSectionForMode {
  Surfaces: { [backgroundKey: string]: ButtonsForBackground };
  Containers: { [backgroundKey: string]: ButtonsForBackground };
}

interface IconsForBackground {
  Default: ColorToken;
  'Default-Variant': ColorToken;
  Primary: ColorToken;
  'Primary-Variant': ColorToken;
  Secondary: ColorToken;
  'Secondary-Variant': ColorToken;
  Tertiary: ColorToken;
  'Tertiary-Variant': ColorToken;
  Neutral: ColorToken;
  'Neutral-Variant': ColorToken;
  Info: ColorToken;
  'Info-Variant': ColorToken;
  Success: ColorToken;
  'Success-Variant': ColorToken;
  Warning: ColorToken;
  'Warning-Variant': ColorToken;
  Error: ColorToken;
  'Error-Variant': ColorToken;
}

interface IconsSectionForMode {
  Surfaces: { [backgroundKey: string]: IconsForBackground };
  Containers: { [backgroundKey: string]: IconsForBackground };
}

interface TagDetails {
  BG: ColorToken;
  Text: ColorToken;
}

interface TagsForBackground {
  Primary: TagDetails;
  Secondary: TagDetails;
  Tertiary: TagDetails;
  Neutral: TagDetails;
  Info: TagDetails;
  Success: TagDetails;
  Warning: TagDetails;
  Error: TagDetails;
}

interface TagsSectionForMode {
  Surfaces: { [backgroundKey: string]: TagsForBackground };
  Containers: { [backgroundKey: string]: TagsForBackground };
}

interface ComprehensiveSurfaceContainerVariation {
  Background: { value: string; type: 'color' };
  Header: { value: string; type: 'color' };
  Text: { value: string; type: 'color' };
  Quiet: { value: string; type: 'color' };
  Border: { value: string; type: 'color' };
  'Border-Variant': { value: string; type: 'color' };
  Hotlink: { value: string; type: 'color' };
  'Hotlink-Visited': { value: string; type: 'color' };
  Hover: { value: string; type: 'color' };
  Pressed: { value: string; type: 'color' };
  Buttons: ButtonsForBackground;
  Icons: IconsForBackground;
  Tags: TagsForBackground;
}

interface PrimaryButtonForBackground {
  Primary: ButtonDetails;
}

interface PrimaryButtonsStyleSection {
  Surfaces: { [backgroundKey: string]: PrimaryButtonForBackground };
  Containers: { [backgroundKey: string]: PrimaryButtonForBackground };
}

interface PrimaryButtonsSectionForMode {
  Default: PrimaryButtonsStyleSection;
  'Primary-Adaptive': PrimaryButtonsStyleSection;
  'Primary-Fixed': PrimaryButtonsStyleSection;
  'Black-White': PrimaryButtonsStyleSection;
}

interface ThemeReference {
  Surfaces: SurfacesDetails & {
    Buttons: ButtonsForBackground;
    Icons: IconsForBackground;
    Tags: TagsForBackground;
  };
  Containers: ContainersDetails & {
    Buttons: ButtonsForBackground;
    Icons: IconsForBackground;
    Tags: TagsForBackground;
  };
}

interface FocusVisibleSection {
  Surfaces: {
    [backgroundKey: string]: ColorToken;
  };
  Containers: {
    [backgroundKey: string]: ColorToken;
  };
}

interface ModeSection {
  Colors: {
    [paletteKey: string]: {
      [colorKey: string]: ColorToken;
    };
  };
  Header: {
    Surfaces: { [backgroundKey: string]: any };
    Containers: { [backgroundKey: string]: any };
  };
  Text: {
    [paletteKey: string]: {
      [colorKey: string]: ColorToken;
    };
  };
  Quiet: {
    Surfaces: { [backgroundKey: string]: any };
    Containers: { [backgroundKey: string]: any };
  };
  Border: {
    Surfaces: { [backgroundKey: string]: any };
    Containers: { [backgroundKey: string]: any };
  };
  'Border-Variant'?: {
    Surfaces: { [backgroundKey: string]: any };
    Containers: { [backgroundKey: string]: any };
  };
  Hover: {
    [paletteKey: string]: {
      [colorKey: string]: ColorToken;
    };
  };
  Pressed: {
    [paletteKey: string]: {
      [colorKey: string]: ColorToken;
    };
  };
  Backgrounds: {
    [backgroundKey: string]: {
      Surface: ColorToken;
      'Surface-Dim': ColorToken;
      'Surface-Bright': ColorToken;
      Container: ColorToken;
      'Container-Low': ColorToken;
      'Container-Lowest': ColorToken;
    };
  };
  Icon: IconsSectionForMode;
  'Icon-Variant': IconsSectionForMode;
  Buttons: ButtonsSectionForMode;
  Tags: TagsSectionForMode;
  Charts: {
    Surfaces: { [backgroundKey: string]: any };
    Containers: { [backgroundKey: string]: any };
  };
  'Primary-Buttons': PrimaryButtonsSectionForMode;
  Theme: any;
  'Focus-Visible'?: FocusVisibleSection;
}

interface ShadowDetail {
  'offset-x': { value: number; type: string };
  'offset-y': { value: number; type: string };
  'blur-radius': { value: number; type: string };
  'spread-radius': { value: number; type: string };
  color: { value: string; type: string };
}

interface BevelDetail {
  'Shadow-1': ShadowDetail;
}

interface StyleVariant {
  Bevel: {
    'Bevel-1': BevelDetail;
    'Bevel-2': BevelDetail;
  };
  'Border-Radius': {
    'offset-x': { value: number; type: string };
  };
  Gradient: {
    'Color-1': { value: string; type: string };
    'Color-2': { value: string; type: string };
    Angle: { value: number; type: string };
  };
}

interface StyleSection {
  Default: StyleVariant;
  Professional: StyleVariant;
  Modern: StyleVariant;
  Bold: StyleVariant;
  Playful: StyleVariant;
}

interface TypographySection {
  'Set-Font-Family-Body': { value: string; type: string };
  'Set-Font-Family-Header': { value: string; type: string };
  'Set-Font-Family-Decorative': { value: string; type: string };
  'Set-Header-Font-Weight': { value: string; type: string };
  'Set-Decorative-Font-Weight': { value: string; type: string };
  'Set-Body-Font-Weight': { value: string; type: string };
  'Set-Body-Semibold-Font-Weight': { value: string; type: string };
  'Set-Body-Bold-Font-Weight': { value: string; type: string };
  'Set-Header-Caps': { value: string; type: string };
  'Set-Decorative-Caps': { value: string; type: string };
  'Congative-Family-Body': { value: string; type: string };
}

interface SpacingValue {
  value: string;
  type: string;
}

interface SpacingSection {
  Multiplier: SpacingValue;
  'Spacing-1': SpacingValue;
  'Spacing-2': SpacingValue;
  'Spacing-3': SpacingValue;
  'Spacing-4': SpacingValue;
  'Spacing-5': SpacingValue;
  'Spacing-6': SpacingValue;
  'Spacing-7': SpacingValue;
  'Spacing-8': SpacingValue;
  'Spacing-9': SpacingValue;
  'Spacing-10': SpacingValue;
  'Spacing-11': SpacingValue;
  'Spacing-12': SpacingValue;
  'Spacing-Half': SpacingValue;
  'Spacing-Quater': SpacingValue;
}

interface ColorSystemExport {
  Metadata: {
    Name: { value: string; type: 'string' };
    'Date Created': { value: string; type: 'string' };
    'Date Updated': { value: string; type: 'string' };
    'Extracted-Tones'?: {
      Primary: { value: number; type: 'number' };
      Secondary: { value: number; type: 'number' };
      Tertiary: { value: number; type: 'number' };
    };
    'Button-Config'?: {
      DefaultButtonType: { value: 'primary' | 'secondary' | 'tonal' | 'black-white'; type: 'string' };
      ButtonBehavior: { value: 'adaptive' | 'fixed'; type: 'string' };
    };
    'Default-Settings'?: {
      'Default-Theme': {
        'Theme-Name': { value: string; type: 'string' };
        Theme: { value: string; type: 'string' };
        N: { value: number; type: 'number' };
      };
      'App-Bar': {
        Selection: { value: string; type: 'string' };
        Theme: { value: string; type: 'string' };
        N: { value: number; type: 'number' };
      };
      'Nav-Bar': {
        Selection: { value: string; type: 'string' };
        Theme: { value: string; type: 'string' };
        N: { value: number; type: 'number' };
      };
      Status: {
        Selection: { value: string; type: 'string' };
        Theme: { value: string; type: 'string' };
        N: { value: number; type: 'number' };
      };
      Button: {
        Default: { value: string; type: 'string' };
        'Default-N': { value: number; type: 'number' };
      };
      'Card-Coloring': {
        ContTheme: { value: string; type: 'string' };
        ContN: { value: number; type: 'number' };
        CShade: { value: string; type: 'string' };
      };
      'Text-Coloring': {
        TextMode: { value: string; type: 'string' };
      };
    };
  };
  Modes: {
    'Light-Mode': ModeSection;
    'Dark-Mode': ModeSection;
  };
  Style: StyleSection;
  Spacing: SpacingSection;
  Typography: TypographySection;
  Charts: {
    'Chart-BG': { value: string; type: 'color' };
    'Chart-Lines': { value: string; type: 'color' };
    Solids: {
      'Chart-1': { value: string; type: 'color' };
      'Chart-2': { value: string; type: 'color' };
      'Chart-3': { value: string; type: 'color' };
      'Chart-4': { value: string; type: 'color' };
      'Chart-5': { value: string; type: 'color' };
      'Chart-6': { value: string; type: 'color' };
      'Chart-7': { value: string; type: 'color' };
      'Chart-8': { value: string; type: 'color' };
      'Chart-9': { value: string; type: 'color' };
      'Chart-10': { value: string; type: 'color' };
    };
    Opaque: {
      'Chart-1': { value: string; type: 'color' };
      'Chart-2': { value: string; type: 'color' };
      'Chart-3': { value: string; type: 'color' };
      'Chart-4': { value: string; type: 'color' };
      'Chart-5': { value: string; type: 'color' };
      'Chart-6': { value: string; type: 'color' };
      'Chart-7': { value: string; type: 'color' };
      'Chart-8': { value: string; type: 'color' };
      'Chart-9': { value: string; type: 'color' };
      'Chart-10': { value: string; type: 'color' };
    };
  };
  Effects: {
    'Level-0': { value: string; type: 'boxShadow' };
    'Level-1': { value: string; type: 'boxShadow' };
    'Level-2': { value: string; type: 'boxShadow' };
    'Level-3': { value: string; type: 'boxShadow' };
    'Level-4': { value: string; type: 'boxShadow' };
    'Level-5': { value: string; type: 'boxShadow' };
  };
  'Primary-Buttons': any;
  Themes: any;
  SurfacesContainers: {
    Surface: {
      Background: ColorToken;
    };
    'Surface-Dim': {
      Background: ColorToken;
    };
    'Surface-Bright': {
      Background: ColorToken;
    };
    Container: {
      Background: ColorToken;
    };
    'Container-Lowest': {
      Background: ColorToken;
    };
    'Container-Low': {
      Background: ColorToken;
    };
    'Container-High': {
      Background: ColorToken;
    };
    'Container-Highest': {
      Background: ColorToken;
    };
  };
}

/**
 * Convert hex color to rgba with specified opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Interpolate a color for a tone that doesn't exist in the palette
 * Uses LCH interpolation between surrounding tones
 */
function interpolateTone(
  targetTone: number,
  palette: { tone: number; color: string }[]
): string {
  // Find the two tones that surround the target tone
  const sortedPalette = [...palette].sort((a, b) => a.tone - b.tone);
  
  let lowerTone = sortedPalette[0];
  let upperTone = sortedPalette[sortedPalette.length - 1];
  
  for (let i = 0; i < sortedPalette.length - 1; i++) {
    if (sortedPalette[i].tone <= targetTone && sortedPalette[i + 1].tone >= targetTone) {
      lowerTone = sortedPalette[i];
      upperTone = sortedPalette[i + 1];
      break;
    }
  }
  
  // Interpolate in LCH space
  const [l1, c1, h1] = chroma(lowerTone.color).lch();
  const [l2, c2, h2] = chroma(upperTone.color).lch();
  
  // Calculate interpolation factor
  const factor = (targetTone - lowerTone.tone) / (upperTone.tone - lowerTone.tone);
  
  // Interpolate lightness linearly
  const targetL = l1 + (l2 - l1) * factor;
  
  // Interpolate chroma linearly  
  const targetC = c1 + (c2 - c1) * factor;
  
  // Handle hue interpolation (circular)
  let targetH = h1;
  if (!isNaN(h1) && !isNaN(h2)) {
    let diff = h2 - h1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    targetH = h1 + diff * factor;
    if (targetH < 0) targetH += 360;
    if (targetH >= 360) targetH -= 360;
  }
  
  return chroma.lch(targetL, targetC, targetH).hex();
}

/**
 * Get or interpolate a tone from a palette
 */
function getToneColor(
  tone: number,
  palette: { tone: number; color: string }[]
): string {
  const exactMatch = palette.find(p => p.tone === tone);
  if (exactMatch) {
    return exactMatch.color;
  }
  
  // Interpolate if not found
  return interpolateTone(tone, palette);
}

/**
 * Get text color based on background luminance (for light mode)
 * Returns dark text for light backgrounds, light text for dark backgrounds
 */
function getTextColor(bgColor: string, palette: { tone: number; color: string }[], isDark: boolean = false): string {
  const bgLuminance = chroma(bgColor).luminance();
  
  if (isDark) {
    // Dark mode: lighter backgrounds get darker text
    if (bgLuminance > 0.5) {
      // Lighter backgrounds: use dark text (Color-1 or Color-2)
      return palette[0]?.color || '#000000';
    } else if (bgLuminance > 0.18) {
      // Medium backgrounds: use medium-dark text
      return palette[1]?.color || '#1A1A1A';
    } else {
      // Dark backgrounds: use light text (Color-10 or Color-11)
      return palette.length > 11 ? palette[11].color : '#FFFFFF';
    }
  } else {
    // Light mode: darker backgrounds get lighter text
    if (bgLuminance > 0.5) {
      // Light backgrounds: use dark text (Color-1 or Color-2)
      return palette[0]?.color || '#000000';
    } else {
      // Dark backgrounds: use light text (Color-10 or Color-11)
      return palette.length > 11 ? palette[11].color : '#FFFFFF';
    }
  }
}

/**
 * Get text-quiet (secondary text) color based on background
 */
function getTextQuietColor(bgColor: string, palette: { tone: number; color: string }[], isDark: boolean = false): string {
  const bgLuminance = chroma(bgColor).luminance();
  
  if (isDark) {
    if (bgLuminance > 0.5) {
      return palette[2]?.color || '#333333';
    } else if (bgLuminance > 0.18) {
      return palette[3]?.color || '#4A4A4A';
    } else {
      return palette.length > 9 ? palette[9].color : '#CCCCCC';
    }
  } else {
    if (bgLuminance > 0.5) {
      return palette[2]?.color || '#666666';
    } else {
      return palette.length > 10 ? palette[10].color : '#DDDDDD';
    }
  }
}

/**
 * Calculate relative luminance for contrast ratio
 */
function getLuminance(hex: string): number {
  const rgb = chroma(hex).rgb();
  const [r, g, b] = rgb.map(val => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Find a color from the palette that has the target contrast ratio with the background
 */
function findColorWithContrast(
  bgColor: string,
  palette: { tone: number; color: string }[],
  targetContrast: number,
  isDark: boolean = false
): string {
  const bgLuminance = getLuminance(bgColor);
  const isLightBg = bgLuminance > 0.5;
  
  // Determine search direction: darker colors for light bg, lighter colors for dark bg
  const sortedPalette = [...palette].sort((a, b) => {
    if (isLightBg) {
      return a.tone - b.tone; // Search from dark to light
    } else {
      return b.tone - a.tone; // Search from light to dark
    }
  });
  
  // Find the first color that meets or exceeds the target contrast
  for (const paletteItem of sortedPalette) {
    const contrast = getContrastRatio(bgColor, paletteItem.color);
    if (contrast >= targetContrast) {
      return paletteItem.color;
    }
  }
  
  // Fallback: return the most contrasting color from the palette
  return isLightBg 
    ? (palette[0]?.color || '#000000') 
    : (palette[palette.length - 1]?.color || '#FFFFFF');
}

/**
 * Get header color with 3.1 contrast ratio to background
 */
function getHeaderColor(bgColor: string, palette: { tone: number; color: string }[], isDark: boolean = false): string {
  return findColorWithContrast(bgColor, palette, 3.1, isDark);
}

/**
 * Get border color with 3.1 contrast ratio to background
 */
function getBorderColor(bgColor: string, palette: { tone: number; color: string }[], isDark: boolean = false): string {
  return findColorWithContrast(bgColor, palette, 3.1, isDark);
}

/**
 * Get border-variant color (Border color with 15% opacity - hex 26)
 */
function getBorderVariantColor(bgColor: string, palette: { tone: number; color: string }[], isDark: boolean = false): string {
  // Get the border color with 3.1 contrast
  const borderColor = getBorderColor(bgColor, palette, isDark);
  
  // Convert to 8-digit hex with 15% opacity (0x26 ≈ 15% of 0xFF) — matches the
  // rest of the export + the Figma path + the live preview. Border-Variant is
  // decorative (non-clickable), so it carries no contrast requirement.
  const rgb = chroma(borderColor).hex();
  return `${rgb}26`; // Append 26 for 15% opacity
}

/**
 * Get hotlink color (typically primary color)
 */
function getHotlinkColor(primaryPalette: { tone: number; color: string }[], isDark: boolean = false): string {
  // Use Color-9 from primary palette (vibrant color)
  return primaryPalette.length > 10 ? primaryPalette[10].color : primaryPalette[primaryPalette.length - 1].color;
}

/**
 * Get hotlink-visited color (typically a variation of primary)
 */
function getHotlinkVisitedColor(primaryPalette: { tone: number; color: string }[], isDark: boolean = false): string {
  // Use Color-7 from primary palette (slightly darker/different than regular hotlink)
  return primaryPalette.length > 8 ? primaryPalette[8].color : primaryPalette[Math.max(0, primaryPalette.length - 3)].color;
}

/**
 * Get fixed Header token reference based on background number and container type
 */
export function getFixedHeaderToken(backgroundNumber: number, isContainer: boolean, paletteName: string): string {
  const colorMap: { [key: string]: { surfaces: number; containers: number } } = {
    '1': { surfaces: 7, containers: 8 },
    '2': { surfaces: 7, containers: 8 },
    '3': { surfaces: 8, containers: 9 },
    '4': { surfaces: 9, containers: 3 },
    '5': { surfaces: 10, containers: 4 },
    '6': { surfaces: 5, containers: 5 },
    '7': { surfaces: 5, containers: 5 },
    '8': { surfaces: 5, containers: 5 },
    '9': { surfaces: 6, containers: 6 },
    '10': { surfaces: 3, containers: 3 },
    '11': { surfaces: 5, containers: 2 }, // surface header aligned with the fixed structure (Color-11 → Color-5) so Primary-Light matches Default
    '12': { surfaces: 1, containers: 1 },
    '99': { surfaces: 5, containers: 5 }, // Background-Vibrant
  };

  const colorNumber = colorMap[backgroundNumber.toString()];
  if (!colorNumber) return '{Colors.Neutral.Color-5}';
  
  const num = isContainer ? colorNumber.containers : colorNumber.surfaces;
  return `{Colors.${paletteName}.Color-${num}}`;
}

/**
 * Get fixed Text token reference based on background number and container type
 */
export function getFixedTextToken(backgroundNumber: number, isContainer: boolean, paletteName: string): string {
  const colorMap: { [key: string]: { surfaces: number | string; containers: number | string } } = {
    '1': { surfaces: 8, containers: 10 },
    '2': { surfaces: 9, containers: 10 },
    '3': { surfaces: 10, containers: 10 },
    '4': { surfaces: '#f9f9f9', containers: '#f9f9f9' },
    '5': { surfaces: 2, containers: 1 },
    '6': { surfaces: 3, containers: 3 },
    '7': { surfaces: 3, containers: 3 },
    '8': { surfaces: 4, containers: 4 },
    '9': { surfaces: 5, containers: 5 },
    '10': { surfaces: 3, containers: 3 },
    '11': { surfaces: 2, containers: 2 },
    '12': { surfaces: 2, containers: 2 },
    '99': { surfaces: 4, containers: 4 }, // Background-Vibrant
  };
  
  const colorNumber = colorMap[backgroundNumber.toString()];
  if (!colorNumber) return '{Colors.Neutral.Color-8}';
  
  const num = isContainer ? colorNumber.containers : colorNumber.surfaces;
  if (typeof num === 'string') return num; // Return hex color directly
  return `{Colors.${paletteName}.Color-${num}}`;
}

/**
 * Get fixed Border token reference based on background number and container type
 */
function getFixedBorderToken(backgroundNumber: number, isContainer: boolean, paletteName: string): string {
  const colorMap: { [key: string]: { surfaces: number | string; containers: number | string } } = {
    '1': { surfaces: 5, containers: 6 },
    '2': { surfaces: 7, containers: 8 },
    '3': { surfaces: 8, containers: '#fcfcfc' },
    '4': { surfaces: 9, containers: 3 },
    '5': { surfaces: 10, containers: 4 },
    '6': { surfaces: 5, containers: 5 },
    '7': { surfaces: 5, containers: 5 },
    '8': { surfaces: 5, containers: 5 },
    '9': { surfaces: 5, containers: 5 },
    '10': { surfaces: 7, containers: 7 },
    '11': { surfaces: 8, containers: 8 },
    '12': { surfaces: 8, containers: 8 },
    '99': { surfaces: 5, containers: 5 }, // Background-Vibrant
  };

  const colorNumber = colorMap[backgroundNumber.toString()];
  if (!colorNumber) return '{Colors.Neutral.Color-5}';
  
  const num = isContainer ? colorNumber.containers : colorNumber.surfaces;
  if (typeof num === 'string') return num; // Return hex color directly
  return `{Colors.${paletteName}.Color-${num}}`;
}

/**
 * Get fixed Border hex color (resolves token references to actual colors)
 */
function getFixedBorderHexColor(backgroundNumber: number, isContainer: boolean, palette: { tone: number; color: string }[]): string {
  const colorMap: { [key: string]: { surfaces: number | string; containers: number | string } } = {
    '1': { surfaces: 5, containers: 6 },
    '2': { surfaces: 7, containers: 8 },
    '3': { surfaces: 8, containers: '#fcfcfc' },
    '4': { surfaces: 9, containers: 3 },
    '5': { surfaces: 10, containers: 4 },
    '6': { surfaces: 5, containers: 5 },
    '7': { surfaces: 5, containers: 5 },
    '8': { surfaces: 5, containers: 5 },
    '9': { surfaces: 5, containers: 5 },
    '10': { surfaces: 7, containers: 7 },
    '11': { surfaces: 8, containers: 8 },
    '12': { surfaces: 8, containers: 8 },
    '99': { surfaces: 5, containers: 5 }, // Background-Vibrant
  };

  const colorNumber = colorMap[backgroundNumber.toString()];
  if (!colorNumber) {
    // Fallback to Color-5 from palette (index 4)
    return palette[4]?.color || palette[palette.length - 1]?.color || '#000000';
  }
  
  const num = isContainer ? colorNumber.containers : colorNumber.surfaces;
  if (typeof num === 'string') return num; // Return hex color directly
  
  // Resolve Color-N to actual hex color from palette
  // Color-N uses index N-1 (Color-1 = index 0, Color-7 = index 6, etc.)
  const colorIndex = num - 1;
  return palette[colorIndex]?.color || palette[palette.length - 1]?.color || '#000000';
}

/**
 * Get Border-Variant value by appending 26 (15%) opacity to the Border reference or color
 * NOTE: This function is deprecated - we now resolve colors directly instead of using token references
 */
function getBorderVariantValue(borderValue: string): string {
  // If borderValue is a direct hex color
  if (borderValue.startsWith('#')) {
    // Append 26 for 15% opacity
    return `${borderValue}26`;
  }
  // Fallback for references: return black with 15% opacity (this shouldn't happen)
  console.warn(`getBorderVariantValue received a reference token: ${borderValue}. This should be resolved to hex first.`);
  return '#00000026';
}

/**
 * Generate light mode TONAL surfaces and containers for a given base color
 * Uses tone-specific formulas and mixes with tone80 for containers
 */
function generateLightModeTonalSurfacesAndContainers(
  baseColor: string, 
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false,
  allPalettes?: {
    primary: { tone: number; color: string }[];
    neutral: { tone: number; color: string }[];
  },
  paletteName?: string,
  backgroundNumber?: number
): SurfacesAndContainers {
  // Get tone80 for container calculations
  const tone80Data = palette.find(p => p.tone === 80);
  const tone80Color = tone80Data ? tone80Data.color : baseColor;

  // Get tone 71 (palette index 8) for Background-6, 7, and Vibrant container calculations
  const color9 = palette.length > 8 ? palette[8].color : tone80Color;

  // Get tone 81 (palette index 9) for Background-1 to Background-5, 8-9 container calculations
  const color10 = palette.length > 9 ? palette[9].color : tone80Color;

  // Get tone 90 (palette index 10) - no longer used for containers
  const color11 = palette.length > 10 ? palette[10].color : tone80Color;

  let surfaceDimBlack = 0.04;
  let surfaceWhite = 0.05;
  let surfaceBrightWhite = 0.04;
  let surfaceBaseTone = tone; // Which tone to use for Surface (default: same as background)
  let containerLowestBlend = 0.05;
  let containerLowBlend = 0.08;
  let containerBlend = 0.08;
  let containerHighBlend = 0.14;
  let containerHighestBlend = 0.16;
  let useColor9ForContainers = false; // Flag to use Color-7 for Backgrounds 8-9 and Vibrant
  let useColor10ForContainers = false; // Flag to use Color-8 for Backgrounds 1-5, 6-7, 10-11
  let useColor11ForContainers = false; // Flag to use Color-9 (deprecated)

  // Different logic for chromatic (Primary/Secondary/Tertiary) vs Neutral
  if (isChromatic) {
    // Primary, Secondary, Tertiary surfaces
    // SIMPLIFIED 1:1 MAPPING: Background-N → Color-N
    if (tone === 1) { // Background-1 → Color-1
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 0; // Color-1 (index 0)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.12;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 10) { // Background-2 → Color-2
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 1; // Color-2 (index 1)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.12;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 19) { // Background-3 → Color-3
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 2; // Color-3 (index 2)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.12;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 28) { // Background-4 → Color-4
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 3; // Color-4 (index 3)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.12;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 37) { // Background-5 → Color-5
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 4; // Color-5 (index 4)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.12;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 58) { // Background-6 → Color-6
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 5; // Color-6 (index 5)
      surfaceBrightWhite = 0.04;
      useColor9ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 71) { // Background-7 → Color-7
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 6; // Color-7 (index 6)
      surfaceBrightWhite = 0.04;
      useColor9ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 81) { // Background-8 → Color-8
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 7; // Color-8 (index 7)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 90) { // Background-9 → Color-9
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 8; // Color-9 (index 8)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 95) { // Background-10 → Color-10
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 9; // Color-10 (index 9)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 98) { // Background-11 → Color-11
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 10; // Color-11 (index 10)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    } else if (tone === 99) { // Background-12 → Color-12
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 11; // Color-12 (index 11)
      surfaceBrightWhite = 0.04;
      useColor10ForContainers = true;
      containerLowestBlend = 0.10;
      containerLowBlend = 0.15;
      containerBlend = 0.18;
      containerHighBlend = 0.20;
      containerHighestBlend = 0.22;
    }
  } else {
    // Neutral surfaces - SIMPLIFIED 1:1 MAPPING: Background-N → Color-N
    if (tone === 1) { // Background-1 → Color-1
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 0; // Color-1 (index 0)
      surfaceBrightWhite = 0.04;
    } else if (tone === 10) { // Background-2 → Color-2
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 1; // Color-2 (index 1)
      surfaceBrightWhite = 0.04;
    } else if (tone === 19) { // Background-3 → Color-3
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 2; // Color-3 (index 2)
      surfaceBrightWhite = 0.04;
    } else if (tone === 28) { // Background-4 → Color-4
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 3; // Color-4 (index 3)
      surfaceBrightWhite = 0.04;
    } else if (tone === 37) { // Background-5 → Color-5
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 4; // Color-5 (index 4)
      surfaceBrightWhite = 0.04;
    } else if (tone === 58) { // Background-6 → Color-6
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 5; // Color-6 (index 5)
      surfaceBrightWhite = 0.04;
    } else if (tone === 71) { // Background-7 → Color-7
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 6; // Color-7 (index 6)
      surfaceBrightWhite = 0.04;
    } else if (tone === 81) { // Background-8 → Color-8
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 7; // Color-8 (index 7)
      surfaceBrightWhite = 0.04;
    } else if (tone === 90) { // Background-9 → Color-9
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.01;
      surfaceBaseTone = 8; // Color-9 (index 8)
      surfaceBrightWhite = 0.04;
    } else if (tone === 95) { // Background-10 → Color-10
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 9; // Color-10 (index 9)
      surfaceBrightWhite = 0.04;
    } else if (tone === 98) { // Background-11 → Color-11
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 10; // Color-11 (index 10)
      surfaceBrightWhite = 0.04;
    } else if (tone === 99) { // Background-12 → Color-12
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 11; // Color-12 (index 11)
      surfaceBrightWhite = 0.04;
    }
  }

  // Get the correct base color for Surface using index-based lookup
  const surfaceBaseColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone < palette.length
    ? palette[surfaceBaseTone].color
    : baseColor;

  // Surface = pure Color-N (no blending)
  // Surface-Dim = adjacent tone one step darker (Color-1 Dim = black)
  // Surface-Bright = adjacent tone one step lighter (Color-12 Bright = white)
  const surfaceColor = surfaceBaseColor; // Pure color, no blending
  const surfaceDimColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone > 0
    ? palette[surfaceBaseTone - 1].color
    : '#000000'; // Color-1 Dim = black
  const surfaceBrightColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone < palette.length - 1
    ? palette[surfaceBaseTone + 1].color
    : '#FFFFFF'; // Color-12 Bright = white
  
  // Determine which color to use for container blending
  let containerBaseColor: string;
  let containerColorNumber = 5; // Default to Color-5 (tone80)
  if (useColor9ForContainers) {
    containerBaseColor = color9;
    containerColorNumber = 7;
  } else if (useColor10ForContainers) {
    containerBaseColor = color10;
    containerColorNumber = 8;
  } else if (useColor11ForContainers) {
    containerBaseColor = color11;
    containerColorNumber = 9;
  } else {
    containerBaseColor = tone80Color;
    containerColorNumber = 5;
  }
  
  // Light mode: all containers use Color-11 (L=98) — use drop shadows for elevation
  const containerToneColor = palette[10]?.color || '#f0f0f0'; // Color-11 (0-based index 10)
  const containerColor = containerToneColor;
  const containerLowestColor = containerToneColor;
  const containerLowColor = containerToneColor;
  const containerHighColor = containerToneColor;
  const containerHighestColor = containerToneColor;
  
  console.log(`📦 [CONTAINER DEBUG] ${paletteName || 'Unknown'}-Background-${backgroundNumber || '?'}:`);
  console.log(`   Base: Color-${containerColorNumber} = ${containerBaseColor}`);
  console.log(`   Surface-Bright: ${surfaceBrightColor}`);
  console.log(`   Container-Lowest: ${containerLowestBlend * 100}% blend → ${containerLowestColor}`);
  console.log(`   Container-Low: ${containerLowBlend * 100}% blend → ${containerLowColor}`);
  console.log(`   Container: ${containerBlend * 100}% blend → ${containerColor}`);
  console.log(`   Container-High: ${containerHighBlend * 100}% blend → ${containerHighColor}`);
  console.log(`   Container-Highest: ${containerHighestBlend * 100}% blend → ${containerHighestColor}`);

  // Use neutral palette for text colors if available, otherwise use current palette
  const textPalette = allPalettes?.neutral || palette;
  const primaryPalette = allPalettes?.primary || palette;

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
      },
      'Header': {
        value: paletteName && backgroundNumber ? getFixedHeaderToken(backgroundNumber, false, paletteName) : getHeaderColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Text': {
        value: paletteName && backgroundNumber ? getFixedTextToken(backgroundNumber, false, paletteName) : getTextColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Quiet': {
        value: getTextQuietColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Border': {
        value: paletteName && backgroundNumber ? getFixedBorderToken(backgroundNumber, false, paletteName) : getBorderColor(surfaceColor, palette, false),
        type: 'color'
      },
      'Border-Variant': {
        value: paletteName && backgroundNumber ? `${getFixedBorderHexColor(backgroundNumber, false, palette)}26` : `${getBorderColor(surfaceColor, palette, false)}26`,
        type: 'color'
      },
      'Hotlink': {
        value: '{Colors.Primary.Color-7}',
        type: 'color'
      },
      'Hotlink-Visited': {
        value: '{Colors.Hotlink-Visited.Color-6}',
        type: 'color'
      },
      'Hover': {
        value: paletteName ? `{Hover.${paletteName}.Color-${surfaceBaseTone + 1}}` : surfaceDimColor,
        type: 'color'
      },
      'Pressed': {
        value: paletteName ? `{Pressed.${paletteName}.Color-${surfaceBaseTone + 1}}` : surfaceBrightColor,
        type: 'color'
      }
    },
    Containers: {
      'Container': {
        value: containerColor,
        type: 'color'
      },
      'Container-Lowest': {
        value: containerLowestColor,
        type: 'color'
      },
      'Container-Low': {
        value: containerLowColor,
        type: 'color'
      },
      'Container-High': {
        value: containerHighColor,
        type: 'color'
      },
      'Container-Highest': {
        value: containerHighestColor,
        type: 'color'
      },
      'Header': {
        value: paletteName && backgroundNumber ? getFixedHeaderToken(backgroundNumber, true, paletteName) : getHeaderColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Text': {
        value: paletteName && backgroundNumber ? getFixedTextToken(backgroundNumber, true, paletteName) : getTextColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Quiet': {
        value: getTextQuietColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Border': {
        value: paletteName && backgroundNumber ? getFixedBorderToken(backgroundNumber, true, paletteName) : getBorderColor(containerColor, palette, false),
        type: 'color'
      },
      'Border-Variant': {
        value: paletteName && backgroundNumber ? `${getFixedBorderHexColor(backgroundNumber, true, palette)}26` : `${getBorderColor(containerColor, palette, false)}26`,
        type: 'color'
      },
      'Hotlink': {
        value: '{Colors.Primary.Color-7}',
        type: 'color'
      },
      'Hotlink-Visited': {
        value: '{Colors.Hotlink-Visited.Color-6}',
        type: 'color'
      },
      'Hover': {
        value: paletteName ? `{Hover.${paletteName}.Color-${containerColorNumber}}` : containerLowestColor,
        type: 'color'
      },
      'Pressed': {
        value: paletteName ? `{Pressed.${paletteName}.Color-${containerColorNumber}}` : containerLowColor,
        type: 'color'
      }
    }
  };
}

/**
 * Generate light mode PROFESSIONAL surfaces and containers
 * All containers are #FFFFFF
 */
function generateLightModeProfessionalSurfacesAndContainers(
  baseColor: string,
  tone: number,
  palette: { tone: number; color: string }[],
  isChromatic: boolean = false,
  allPalettes?: {
    primary: { tone: number; color: string }[];
    neutral: { tone: number; color: string }[];
  },
  paletteName?: string,
  backgroundNumber?: number
): SurfacesAndContainers {
  let surfaceDimBlack = 0.04;
  let surfaceWhite = 0.05;
  let surfaceBrightWhite = 0.04;
  let surfaceBaseTone = tone; // Which tone to use for Surface (default: same as background)

  // SIMPLIFIED 1:1 MAPPING: Background-N → Color-N (same as Tonal mode)
  if (isChromatic) {
    // Primary, Secondary, Tertiary surfaces
    // LIGHT_MODE_TONES = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99]
    // Index (palette[]):   0   1   2   3   4    5     6   7   8   9  10  11  12  13
    // Color-N:             1   2   3   4   5    6     7   8   9  10  11  12  13  14
    if (tone === 1) { // Background-1 → Color-1
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 0; // Color-1 (index 0)
      surfaceBrightWhite = 0.04;
    } else if (tone === 10) { // Background-2 → Color-2
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 1; // Color-2 (index 1)
      surfaceBrightWhite = 0.04;
    } else if (tone === 19) { // Background-3 → Color-3
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 2; // Color-3 (index 2)
      surfaceBrightWhite = 0.04;
    } else if (tone === 28) { // Background-4 → Color-4
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 3; // Color-4 (index 3)
      surfaceBrightWhite = 0.04;
    } else if (tone === 37) { // Background-5 → Color-5
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 4; // Color-5 (index 4)
      surfaceBrightWhite = 0.04;
    } else if (tone === 58) { // Background-6 → Color-6
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 5; // Color-6 (index 5)
      surfaceBrightWhite = 0.04;
    } else if (tone === 71) { // Background-7 → Color-7
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 6; // Color-7 (index 6)
      surfaceBrightWhite = 0.04;
    } else if (tone === 81) { // Background-8 → Color-8
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 7; // Color-8 (index 7)
      surfaceBrightWhite = 0.04;
    } else if (tone === 90) { // Background-9 → Color-9
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 8; // Color-9 (index 8)
      surfaceBrightWhite = 0.04;
    } else if (tone === 95) { // Background-10 → Color-10
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 9; // Color-10 (index 9)
      surfaceBrightWhite = 0.04;
    } else if (tone === 98) { // Background-11 → Color-11
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 10; // Color-11 (index 10)
      surfaceBrightWhite = 0.04;
    } else if (tone === 99) { // Background-12 → Color-12
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 11; // Color-12 (index 11)
      surfaceBrightWhite = 0.04;
    }
  } else {
    // Neutral surfaces - SIMPLIFIED 1:1 MAPPING: Background-N → Color-N
    if (tone === 1) { // Background-1 → Color-1
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 0; // Color-1 (index 0)
      surfaceBrightWhite = 0.04;
    } else if (tone === 10) { // Background-2 → Color-2
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 1; // Color-2 (index 1)
      surfaceBrightWhite = 0.04;
    } else if (tone === 19) { // Background-3 → Color-3
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 2; // Color-3 (index 2)
      surfaceBrightWhite = 0.04;
    } else if (tone === 28) { // Background-4 → Color-4
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 3; // Color-4 (index 3)
      surfaceBrightWhite = 0.04;
    } else if (tone === 37) { // Background-5 → Color-5
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 4; // Color-5 (index 4)
      surfaceBrightWhite = 0.04;
    } else if (tone === 58) { // Background-6 → Color-6
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 5; // Color-6 (index 5)
      surfaceBrightWhite = 0.04;
    } else if (tone === 71) { // Background-7 → Color-7
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 6; // Color-7 (index 6)
      surfaceBrightWhite = 0.04;
    } else if (tone === 81) { // Background-8 → Color-8
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 7; // Color-8 (index 7)
      surfaceBrightWhite = 0.04;
    } else if (tone === 90) { // Background-9 → Color-9
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.01;
      surfaceBaseTone = 8; // Color-9 (index 8)
      surfaceBrightWhite = 0.04;
    } else if (tone === 95) { // Background-10 → Color-10
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.0;
      surfaceBaseTone = 9; // Color-10 (index 9)
      surfaceBrightWhite = 0.04;
    } else if (tone === 98) { // Background-11 → Color-11
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 10; // Color-11 (index 10)
      surfaceBrightWhite = 0.04;
    } else if (tone === 99) { // Background-12 → Color-12
      surfaceDimBlack = 0.04;
      surfaceWhite = 0.05;
      surfaceBaseTone = 11; // Color-12 (index 11)
      surfaceBrightWhite = 0.04;
    }
  }

  // Get the correct base color for Surface using index-based lookup
  const surfaceBaseColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone < palette.length
    ? palette[surfaceBaseTone].color
    : baseColor;

  // Surface = pure Color-N (no blending)
  // Surface-Dim = adjacent tone one step darker (Color-1 Dim = black)
  // Surface-Bright = adjacent tone one step lighter (Color-12 Bright = white)
  const surfaceColor = surfaceBaseColor; // Pure color, no blending
  const surfaceDimColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone > 0
    ? palette[surfaceBaseTone - 1].color
    : '#000000'; // Color-1 Dim = black
  const surfaceBrightColor = typeof surfaceBaseTone === 'number' && surfaceBaseTone < palette.length - 1
    ? palette[surfaceBaseTone + 1].color
    : '#FFFFFF'; // Color-12 Bright = white
  
  // Professional mode: all containers are white
  const containerColor = '#FFFFFF';

  // Use neutral palette for text colors if available, otherwise use current palette
  const textPalette = allPalettes?.neutral || palette;
  const primaryPalette = allPalettes?.primary || palette;

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
      },
      'Header': {
        value: paletteName && backgroundNumber ? getFixedHeaderToken(backgroundNumber, false, paletteName) : getHeaderColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Text': {
        value: paletteName && backgroundNumber ? getFixedTextToken(backgroundNumber, false, paletteName) : getTextColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Quiet': {
        value: getTextQuietColor(surfaceColor, textPalette, false),
        type: 'color'
      },
      'Border': {
        value: paletteName && backgroundNumber ? getFixedBorderToken(backgroundNumber, false, paletteName) : getBorderColor(surfaceColor, palette, false),
        type: 'color'
      },
      'Border-Variant': {
        value: paletteName && backgroundNumber ? `${getFixedBorderHexColor(backgroundNumber, false, palette)}26` : `${getBorderColor(surfaceColor, palette, false)}26`,
        type: 'color'
      },
      'Hotlink': {
        value: '{Colors.Primary.Color-7}',
        type: 'color'
      },
      'Hotlink-Visited': {
        value: '{Colors.Hotlink-Visited.Color-6}',
        type: 'color'
      },
      'Hover': {
        value: paletteName ? `{Hover.${paletteName}.Color-${surfaceBaseTone + 1}}` : blendColors('#000000', surfaceColor, 0.08),
        type: 'color'
      },
      'Pressed': {
        value: paletteName ? `{Pressed.${paletteName}.Color-${surfaceBaseTone + 1}}` : blendColors('#000000', surfaceColor, 0.12),
        type: 'color'
      },
      'Focus-Active': {
        value: backgroundNumber ? `{Focus-Active.Surfaces.Background-${backgroundNumber}}` : blendColors('#000000', surfaceColor, 0.10),
        type: 'color'
      },
      'Focus-Visible': {
        value: backgroundNumber ? `{Focus-Visible.Surfaces.Background-${backgroundNumber}}` : blendColors('#000000', surfaceColor, 0.10),
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
      },
      'Header': {
        value: paletteName && backgroundNumber ? getFixedHeaderToken(backgroundNumber, true, paletteName) : getHeaderColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Text': {
        value: paletteName && backgroundNumber ? getFixedTextToken(backgroundNumber, true, paletteName) : getTextColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Quiet': {
        value: getTextQuietColor(containerColor, textPalette, false),
        type: 'color'
      },
      'Border': {
        value: paletteName && backgroundNumber ? getFixedBorderToken(backgroundNumber, true, paletteName) : getBorderColor(containerColor, palette, false),
        type: 'color'
      },
      'Border-Variant': {
        value: paletteName && backgroundNumber ? `${getFixedBorderHexColor(backgroundNumber, true, palette)}26` : `${getBorderColor(containerColor, palette, false)}26`,
        type: 'color'
      },
      'Hotlink': {
        value: '{Colors.Primary.Color-7}',
        type: 'color'
      },
      'Hotlink-Visited': {
        value: '{Colors.Hotlink-Visited.Color-6}',
        type: 'color'
      },
      'Hover': {
        value: paletteName ? `{Hover.${paletteName}.Color-11}` : blendColors('#000000', containerColor, 0.08),
        type: 'color'
      },
      'Pressed': {
        value: paletteName ? `{Pressed.${paletteName}.Color-11}` : blendColors('#000000', containerColor, 0.12),
        type: 'color'
      },
      'Focus-Active': {
        value: backgroundNumber ? `{Focus-Active.Containers.Background-${backgroundNumber}}` : blendColors('#000000', containerColor, 0.10),
        type: 'color'
      },
      'Focus-Visible': {
        value: backgroundNumber ? `{Focus-Visible.Containers.Background-${backgroundNumber}}` : blendColors('#000000', containerColor, 0.10),
        type: 'color'
      }
    }
  };
}

// NOTE: generateDarkModeSurfacesAndContainers() was removed — it had no
// callers. Dark-mode surfaces/containers are produced by
// generateSimplifiedDarkModeBackgrounds() in generateSimplifiedBackgrounds.ts.


/**
 * Create a theme reference for a specific background
 */
function createThemeReference(
  modeName: 'Light-Mode' | 'Dark-Mode',
  paletteName: string,
  backgroundNumber: number
): ThemeReference {
  const bgName = `Background-${backgroundNumber}`;
  const paletteCapitalized = paletteName.charAt(0).toUpperCase() + paletteName.slice(1);
  
  // Create references to the actual background data (scoped within the mode, so no Modes.{modeName} prefix needed)
  const createReference = (section: 'Surfaces' | 'Containers', property: string) => ({
    value: `{Backgrounds.${paletteCapitalized}.${bgName}.${section}.${property}}`,
    type: 'color' as const
  });

  const createButtonReference = (section: 'Surfaces' | 'Containers', bgNameRef: string, property: string) => {
    // For Border properties, reference the Border token system instead of Buttons
    if (property.endsWith('.Border')) {
      const palette = property.replace('.Border', '');
      return {
        value: `{Border.${section}.${palette}.${bgNameRef.replace('Background-', 'Color-')}}`,
        type: 'color' as const
      };
    }
    return {
      value: `{Buttons.${section}.${bgNameRef}.${property}}`,
      type: 'color' as const
    };
  };

  const createIconReference = (section: 'Surfaces' | 'Containers', bgNameRef: string, property: string) => ({
    value: `{Icons.${section}.${bgNameRef}.${property}}`,
    type: 'color' as const
  });

  const createTagReference = (section: 'Surfaces' | 'Containers', bgNameRef: string, property: string) => ({
    value: `{Tag.${section}.${bgNameRef}.${property}}`,
    type: 'color' as const
  });

  const createPrimaryButtonReference = (section: 'Surfaces' | 'Containers', bgNameRef: string, property: string) => {
    // For Border, use the Border section with plural Surfaces/Containers
    if (property === 'Primary.Border') {
      return {
        value: `{Border.${section}.Primary.${bgNameRef.replace('Background-', 'Color-')}}`,
        type: 'color' as const
      };
    }
    // For other properties, use Primary-Button (singular) switcher variables
    return {
      value: `{Primary-Button.${section}.${bgNameRef}.${property.replace('Primary.', '')}}`,
      type: 'color' as const
    };
  };

  return {
    Surfaces: {
      Surface: createReference('Surfaces', 'Surface'),
      'Surface-Dim': createReference('Surfaces', 'Surface-Dim'),
      'Surface-Bright': createReference('Surfaces', 'Surface-Bright'),
      Header: createReference('Surfaces', 'Header'),
      Text: createReference('Surfaces', 'Text'),
      Quiet: createReference('Surfaces', 'Quiet'),
      Border: createReference('Surfaces', 'Border'),
      'Border-Variant': createReference('Surfaces', 'Border-Variant'),
      Hotlink: createReference('Surfaces', 'Hotlink'),
      'Hotlink-Visited': createReference('Surfaces', 'Hotlink-Visited'),
      Hover: createReference('Surfaces', 'Hover'),
      Pressed: createReference('Surfaces', 'Pressed'),
      'Focus-Visible': createReference('Surfaces', 'Focus-Visible'),
      Buttons: {
        Primary: {
          Button: createPrimaryButtonReference('Surfaces', bgName, 'Primary.Button'),
          Text: createPrimaryButtonReference('Surfaces', bgName, 'Primary.Text'),
          Border: createPrimaryButtonReference('Surfaces', bgName, 'Primary.Border'),
          Hover: createPrimaryButtonReference('Surfaces', bgName, 'Primary.Hover'),
          Pressed: createPrimaryButtonReference('Surfaces', bgName, 'Primary.Pressed')
        },
        'Primary-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Primary-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Primary-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Primary-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Primary-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Primary-Light.Pressed')
        },
        Secondary: {
          Button: createButtonReference('Surfaces', bgName, 'Secondary.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Secondary.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Secondary.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Secondary.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Secondary.Pressed')
        },
        'Secondary-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Secondary-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Secondary-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Secondary-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Secondary-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Secondary-Light.Pressed')
        },
        Tertiary: {
          Button: createButtonReference('Surfaces', bgName, 'Tertiary.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Tertiary.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Tertiary.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Tertiary.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Tertiary.Pressed')
        },
        'Tertiary-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Tertiary-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Tertiary-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Tertiary-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Tertiary-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Tertiary-Light.Pressed')
        },
        Neutral: {
          Button: createButtonReference('Surfaces', bgName, 'Neutral.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Neutral.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Neutral.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Neutral.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Neutral.Pressed')
        },
        'Neutral-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Neutral-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Neutral-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Neutral-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Neutral-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Neutral-Light.Pressed')
        },
        Info: {
          Button: createButtonReference('Surfaces', bgName, 'Info.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Info.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Info.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Info.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Info.Pressed')
        },
        'Info-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Info-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Info-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Info-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Info-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Info-Light.Pressed')
        },
        Success: {
          Button: createButtonReference('Surfaces', bgName, 'Success.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Success.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Success.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Success.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Success.Pressed')
        },
        'Success-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Success-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Success-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Success-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Success-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Success-Light.Pressed')
        },
        Warning: {
          Button: createButtonReference('Surfaces', bgName, 'Warning.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Warning.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Warning.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Warning.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Warning.Pressed')
        },
        'Warning-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Warning-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Warning-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Warning-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Warning-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Warning-Light.Pressed')
        },
        Error: {
          Button: createButtonReference('Surfaces', bgName, 'Error.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Error.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Error.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Error.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Error.Pressed')
        },
        'Error-Light': {
          Button: createButtonReference('Surfaces', bgName, 'Error-Light.Button'),
          Text: createButtonReference('Surfaces', bgName, 'Error-Light.Text'),
          Border: createButtonReference('Surfaces', bgName, 'Error-Light.Border'),
          Hover: createButtonReference('Surfaces', bgName, 'Error-Light.Hover'),
          Pressed: createButtonReference('Surfaces', bgName, 'Error-Light.Pressed')
        }
      },
      Icons: {
        Default: createIconReference('Surfaces', bgName, 'Default'),
        'Default-Variant': createIconReference('Surfaces', bgName, 'Default-Variant'),
        Primary: createIconReference('Surfaces', bgName, 'Primary'),
        'Primary-Variant': createIconReference('Surfaces', bgName, 'Primary-Variant'),
        Secondary: createIconReference('Surfaces', bgName, 'Secondary'),
        'Secondary-Variant': createIconReference('Surfaces', bgName, 'Secondary-Variant'),
        Tertiary: createIconReference('Surfaces', bgName, 'Tertiary'),
        'Tertiary-Variant': createIconReference('Surfaces', bgName, 'Tertiary-Variant'),
        Neutral: createIconReference('Surfaces', bgName, 'Neutral'),
        'Neutral-Variant': createIconReference('Surfaces', bgName, 'Neutral-Variant'),
        Info: createIconReference('Surfaces', bgName, 'Info'),
        'Info-Variant': createIconReference('Surfaces', bgName, 'Info-Variant'),
        Success: createIconReference('Surfaces', bgName, 'Success'),
        'Success-Variant': createIconReference('Surfaces', bgName, 'Success-Variant'),
        Warning: createIconReference('Surfaces', bgName, 'Warning'),
        'Warning-Variant': createIconReference('Surfaces', bgName, 'Warning-Variant'),
        Error: createIconReference('Surfaces', bgName, 'Error'),
        'Error-Variant': createIconReference('Surfaces', bgName, 'Error-Variant')
      },
      Tags: {
        Primary: {
          BG: createTagReference('Surfaces', bgName, 'Primary.BG'),
          Text: createTagReference('Surfaces', bgName, 'Primary.Text')
        },
        Secondary: {
          BG: createTagReference('Surfaces', bgName, 'Secondary.BG'),
          Text: createTagReference('Surfaces', bgName, 'Secondary.Text')
        },
        Tertiary: {
          BG: createTagReference('Surfaces', bgName, 'Tertiary.BG'),
          Text: createTagReference('Surfaces', bgName, 'Tertiary.Text')
        },
        Neutral: {
          BG: createTagReference('Surfaces', bgName, 'Neutral.BG'),
          Text: createTagReference('Surfaces', bgName, 'Neutral.Text')
        },
        Info: {
          BG: createTagReference('Surfaces', bgName, 'Info.BG'),
          Text: createTagReference('Surfaces', bgName, 'Info.Text')
        },
        Success: {
          BG: createTagReference('Surfaces', bgName, 'Success.BG'),
          Text: createTagReference('Surfaces', bgName, 'Success.Text')
        },
        Warning: {
          BG: createTagReference('Surfaces', bgName, 'Warning.BG'),
          Text: createTagReference('Surfaces', bgName, 'Warning.Text')
        },
        Error: {
          BG: createTagReference('Surfaces', bgName, 'Error.BG'),
          Text: createTagReference('Surfaces', bgName, 'Error.Text')
        }
      }
    },
    Containers: {
      Container: createReference('Containers', 'Container'),
      'Container-Lowest': createReference('Containers', 'Container-Lowest'),
      'Container-Low': createReference('Containers', 'Container-Low'),
      'Container-High': createReference('Containers', 'Container-High'),
      'Container-Highest': createReference('Containers', 'Container-Highest'),
      Header: createReference('Containers', 'Header'),
      Text: createReference('Containers', 'Text'),
      Quiet: createReference('Containers', 'Quiet'),
      Border: createReference('Containers', 'Border'),
      'Border-Variant': createReference('Containers', 'Border-Variant'),
      Hotlink: createReference('Containers', 'Hotlink'),
      'Hotlink-Visited': createReference('Containers', 'Hotlink-Visited'),
      Hover: createReference('Containers', 'Hover'),
      Pressed: createReference('Containers', 'Pressed'),
      'Focus-Visible': createReference('Containers', 'Focus-Visible'),
      Buttons: {
        Primary: {
          Button: createPrimaryButtonReference('Containers', bgName, 'Primary.Button'),
          Text: createPrimaryButtonReference('Containers', bgName, 'Primary.Text'),
          Border: createPrimaryButtonReference('Containers', bgName, 'Primary.Border'),
          Hover: createPrimaryButtonReference('Containers', bgName, 'Primary.Hover'),
          Pressed: createPrimaryButtonReference('Containers', bgName, 'Primary.Pressed')
        },
        'Primary-Light': {
          Button: createButtonReference('Containers', bgName, 'Primary-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Primary-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Primary-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Primary-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Primary-Light.Pressed')
        },
        Secondary: {
          Button: createButtonReference('Containers', bgName, 'Secondary.Button'),
          Text: createButtonReference('Containers', bgName, 'Secondary.Text'),
          Border: createButtonReference('Containers', bgName, 'Secondary.Border'),
          Hover: createButtonReference('Containers', bgName, 'Secondary.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Secondary.Pressed')
        },
        'Secondary-Light': {
          Button: createButtonReference('Containers', bgName, 'Secondary-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Secondary-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Secondary-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Secondary-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Secondary-Light.Pressed')
        },
        Tertiary: {
          Button: createButtonReference('Containers', bgName, 'Tertiary.Button'),
          Text: createButtonReference('Containers', bgName, 'Tertiary.Text'),
          Border: createButtonReference('Containers', bgName, 'Tertiary.Border'),
          Hover: createButtonReference('Containers', bgName, 'Tertiary.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Tertiary.Pressed')
        },
        'Tertiary-Light': {
          Button: createButtonReference('Containers', bgName, 'Tertiary-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Tertiary-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Tertiary-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Tertiary-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Tertiary-Light.Pressed')
        },
        Neutral: {
          Button: createButtonReference('Containers', bgName, 'Neutral.Button'),
          Text: createButtonReference('Containers', bgName, 'Neutral.Text'),
          Border: createButtonReference('Containers', bgName, 'Neutral.Border'),
          Hover: createButtonReference('Containers', bgName, 'Neutral.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Neutral.Pressed')
        },
        'Neutral-Light': {
          Button: createButtonReference('Containers', bgName, 'Neutral-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Neutral-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Neutral-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Neutral-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Neutral-Light.Pressed')
        },
        Info: {
          Button: createButtonReference('Containers', bgName, 'Info.Button'),
          Text: createButtonReference('Containers', bgName, 'Info.Text'),
          Border: createButtonReference('Containers', bgName, 'Info.Border'),
          Hover: createButtonReference('Containers', bgName, 'Info.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Info.Pressed')
        },
        'Info-Light': {
          Button: createButtonReference('Containers', bgName, 'Info-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Info-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Info-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Info-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Info-Light.Pressed')
        },
        Success: {
          Button: createButtonReference('Containers', bgName, 'Success.Button'),
          Text: createButtonReference('Containers', bgName, 'Success.Text'),
          Border: createButtonReference('Containers', bgName, 'Success.Border'),
          Hover: createButtonReference('Containers', bgName, 'Success.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Success.Pressed')
        },
        'Success-Light': {
          Button: createButtonReference('Containers', bgName, 'Success-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Success-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Success-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Success-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Success-Light.Pressed')
        },
        Warning: {
          Button: createButtonReference('Containers', bgName, 'Warning.Button'),
          Text: createButtonReference('Containers', bgName, 'Warning.Text'),
          Border: createButtonReference('Containers', bgName, 'Warning.Border'),
          Hover: createButtonReference('Containers', bgName, 'Warning.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Warning.Pressed')
        },
        'Warning-Light': {
          Button: createButtonReference('Containers', bgName, 'Warning-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Warning-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Warning-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Warning-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Warning-Light.Pressed')
        },
        Error: {
          Button: createButtonReference('Containers', bgName, 'Error.Button'),
          Text: createButtonReference('Containers', bgName, 'Error.Text'),
          Border: createButtonReference('Containers', bgName, 'Error.Border'),
          Hover: createButtonReference('Containers', bgName, 'Error.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Error.Pressed')
        },
        'Error-Light': {
          Button: createButtonReference('Containers', bgName, 'Error-Light.Button'),
          Text: createButtonReference('Containers', bgName, 'Error-Light.Text'),
          Border: createButtonReference('Containers', bgName, 'Error-Light.Border'),
          Hover: createButtonReference('Containers', bgName, 'Error-Light.Hover'),
          Pressed: createButtonReference('Containers', bgName, 'Error-Light.Pressed')
        }
      },
      Icons: {
        Default: createIconReference('Containers', bgName, 'Default'),
        'Default-Variant': createIconReference('Containers', bgName, 'Default-Variant'),
        Primary: createIconReference('Containers', bgName, 'Primary'),
        'Primary-Variant': createIconReference('Containers', bgName, 'Primary-Variant'),
        Secondary: createIconReference('Containers', bgName, 'Secondary'),
        'Secondary-Variant': createIconReference('Containers', bgName, 'Secondary-Variant'),
        Tertiary: createIconReference('Containers', bgName, 'Tertiary'),
        'Tertiary-Variant': createIconReference('Containers', bgName, 'Tertiary-Variant'),
        Neutral: createIconReference('Containers', bgName, 'Neutral'),
        'Neutral-Variant': createIconReference('Containers', bgName, 'Neutral-Variant'),
        Info: createIconReference('Containers', bgName, 'Info'),
        'Info-Variant': createIconReference('Containers', bgName, 'Info-Variant'),
        Success: createIconReference('Containers', bgName, 'Success'),
        'Success-Variant': createIconReference('Containers', bgName, 'Success-Variant'),
        Warning: createIconReference('Containers', bgName, 'Warning'),
        'Warning-Variant': createIconReference('Containers', bgName, 'Warning-Variant'),
        Error: createIconReference('Containers', bgName, 'Error'),
        'Error-Variant': createIconReference('Containers', bgName, 'Error-Variant')
      },
      Tags: {
        Primary: {
          BG: createTagReference('Containers', bgName, 'Primary.BG'),
          Text: createTagReference('Containers', bgName, 'Primary.Text')
        },
        Secondary: {
          BG: createTagReference('Containers', bgName, 'Secondary.BG'),
          Text: createTagReference('Containers', bgName, 'Secondary.Text')
        },
        Tertiary: {
          BG: createTagReference('Containers', bgName, 'Tertiary.BG'),
          Text: createTagReference('Containers', bgName, 'Tertiary.Text')
        },
        Neutral: {
          BG: createTagReference('Containers', bgName, 'Neutral.BG'),
          Text: createTagReference('Containers', bgName, 'Neutral.Text')
        },
        Info: {
          BG: createTagReference('Containers', bgName, 'Info.BG'),
          Text: createTagReference('Containers', bgName, 'Info.Text')
        },
        Success: {
          BG: createTagReference('Containers', bgName, 'Success.BG'),
          Text: createTagReference('Containers', bgName, 'Success.Text')
        },
        Warning: {
          BG: createTagReference('Containers', bgName, 'Warning.BG'),
          Text: createTagReference('Containers', bgName, 'Warning.Text')
        },
        Error: {
          BG: createTagReference('Containers', bgName, 'Error.BG'),
          Text: createTagReference('Containers', bgName, 'Error.Text')
        }
      }
    }
  };
}

/**
 * Generate buttons for a specific background and surface/container type
 */
function generateButtonsForBackground(
  bgColor: string,
  palette: { tone: number; color: string }[],
  allPalettes: {
    primary?: { tone: number; color: string }[];
    secondary?: { tone: number; color: string }[];
    tertiary?: { tone: number; color: string }[];
    neutral?: { tone: number; color: string }[];
    info?: { tone: number; color: string }[];
    success?: { tone: number; color: string }[];
    warning?: { tone: number; color: string }[];
    error?: { tone: number; color: string }[];
  },
  isDark: boolean = false,
  bgName: string = 'Background-1',
  surfaceOrContainer: 'Surfaces' | 'Containers' = 'Surfaces',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): ButtonsForBackground {
  // Calculate Color-N values based on extracted tones
  const primaryN = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const secondaryExtractedN = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 9;
  const tertiaryExtractedN = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 9;

  // Secondary button N logic: If Secondary Color is NOT 9, use it. If it IS 9, use 7 or 6 based on Primary
  const secondaryN = secondaryExtractedN !== 9 ? secondaryExtractedN : (primaryN >= 7 ? 7 : 6);

  // Tertiary button N logic: If Tertiary Color is 9, use 7 or 6 based on Primary. Otherwise use extracted tertiary
  const tertiaryN = tertiaryExtractedN === 9 ? (primaryN >= 7 ? 7 : 6) : tertiaryExtractedN;
  
  // For Neutral, Info, Success, Warning, Error: use 7 or 6 based on Primary
  const semanticN = primaryN >= 7 ? 7 : 6;
  
  // Primary buttons reference top-level Primary-Button.Default
  const getPrimaryButtonTokens = (paletteName: string) => {
    return {
      buttonBg: `{Primary-Button.Default.${surfaceOrContainer}.${bgName}.Button}`,
      buttonText: `{Primary-Button.Default.${surfaceOrContainer}.${bgName}.Text}`,
      buttonBorder: `{Primary-Button.Default.${surfaceOrContainer}.${bgName}.Border}`,
      buttonHover: `{Primary-Button.Default.${surfaceOrContainer}.${bgName}.Hover}`,
      buttonActive: `{Primary-Button.Default.${surfaceOrContainer}.${bgName}.Pressed}`
    };
  };

  // Full button tokens (uses calculated N)
  const getFullButtonTokens = (paletteName: string, colorN: number) => {
    return {
      buttonBg: `{Colors.${paletteName}.Color-${colorN}}`,
      buttonText: `{Text.${surfaceOrContainer}.${paletteName}.Color-${colorN}}`,
      buttonBorder: `{Border.${surfaceOrContainer}.${paletteName}.${bgName}}`,
      buttonHover: `{Hover.${paletteName}.Color-${colorN}}`,
      buttonActive: `{Pressed.${paletteName}.Color-${colorN}}`
    };
  };

  // Light button tokens (always uses Color-9)
  const getLightButtonTokens = (paletteName: string) => {
    return {
      buttonBg: `{Colors.${paletteName}.Color-9}`,
      buttonText: `{Text.${surfaceOrContainer}.${paletteName}.Color-9}`,
      buttonBorder: `{Border.${surfaceOrContainer}.${paletteName}.${bgName}}`,
      buttonHover: `{Hover.${paletteName}.Color-9}`,
      buttonActive: `{Pressed.${paletteName}.Color-9}`
    };
  };

  const primary = getPrimaryButtonTokens('Primary');
  const primaryLight = getLightButtonTokens('Primary');
  const secondary = getFullButtonTokens('Secondary', secondaryN);
  const secondaryLight = getLightButtonTokens('Secondary');
  const tertiary = getFullButtonTokens('Tertiary', tertiaryN);
  const tertiaryLight = getLightButtonTokens('Tertiary');
  const neutral = getFullButtonTokens('Neutral', semanticN);
  const neutralLight = getLightButtonTokens('Neutral');
  const info = getFullButtonTokens('Info', semanticN);
  const infoLight = getLightButtonTokens('Info');
  const success = getFullButtonTokens('Success', semanticN);
  const successLight = getLightButtonTokens('Success');
  const warning = getFullButtonTokens('Warning', semanticN);
  const warningLight = getLightButtonTokens('Warning');
  const error = getFullButtonTokens('Error', semanticN);
  const errorLight = getLightButtonTokens('Error');

  return {
    Primary: {
      Button: { value: primary.buttonBg, type: 'color' },
      Text: { value: primary.buttonText, type: 'color' },
      Border: { value: primary.buttonBorder, type: 'color' },
      Hover: { value: primary.buttonHover, type: 'color' },
      Pressed: { value: primary.buttonActive, type: 'color' }
    },
    'Primary-Light': {
      Button: { value: primaryLight.buttonBg, type: 'color' },
      Text: { value: primaryLight.buttonText, type: 'color' },
      Border: { value: primaryLight.buttonBorder, type: 'color' },
      Hover: { value: primaryLight.buttonHover, type: 'color' },
      Pressed: { value: primaryLight.buttonActive, type: 'color' }
    },
    Secondary: {
      Button: { value: secondary.buttonBg, type: 'color' },
      Text: { value: secondary.buttonText, type: 'color' },
      Border: { value: secondary.buttonBorder, type: 'color' },
      Hover: { value: secondary.buttonHover, type: 'color' },
      Pressed: { value: secondary.buttonActive, type: 'color' }
    },
    'Secondary-Light': {
      Button: { value: secondaryLight.buttonBg, type: 'color' },
      Text: { value: secondaryLight.buttonText, type: 'color' },
      Border: { value: secondaryLight.buttonBorder, type: 'color' },
      Hover: { value: secondaryLight.buttonHover, type: 'color' },
      Pressed: { value: secondaryLight.buttonActive, type: 'color' }
    },
    Tertiary: {
      Button: { value: tertiary.buttonBg, type: 'color' },
      Text: { value: tertiary.buttonText, type: 'color' },
      Border: { value: tertiary.buttonBorder, type: 'color' },
      Hover: { value: tertiary.buttonHover, type: 'color' },
      Pressed: { value: tertiary.buttonActive, type: 'color' }
    },
    'Tertiary-Light': {
      Button: { value: tertiaryLight.buttonBg, type: 'color' },
      Text: { value: tertiaryLight.buttonText, type: 'color' },
      Border: { value: tertiaryLight.buttonBorder, type: 'color' },
      Hover: { value: tertiaryLight.buttonHover, type: 'color' },
      Pressed: { value: tertiaryLight.buttonActive, type: 'color' }
    },
    Neutral: {
      Button: { value: neutral.buttonBg, type: 'color' },
      Text: { value: neutral.buttonText, type: 'color' },
      Border: { value: neutral.buttonBorder, type: 'color' },
      Hover: { value: neutral.buttonHover, type: 'color' },
      Pressed: { value: neutral.buttonActive, type: 'color' }
    },
    'Neutral-Light': {
      Button: { value: neutralLight.buttonBg, type: 'color' },
      Text: { value: neutralLight.buttonText, type: 'color' },
      Border: { value: neutralLight.buttonBorder, type: 'color' },
      Hover: { value: neutralLight.buttonHover, type: 'color' },
      Pressed: { value: neutralLight.buttonActive, type: 'color' }
    },
    Info: {
      Button: { value: info.buttonBg, type: 'color' },
      Text: { value: info.buttonText, type: 'color' },
      Border: { value: info.buttonBorder, type: 'color' },
      Hover: { value: info.buttonHover, type: 'color' },
      Pressed: { value: info.buttonActive, type: 'color' }
    },
    'Info-Light': {
      Button: { value: infoLight.buttonBg, type: 'color' },
      Text: { value: infoLight.buttonText, type: 'color' },
      Border: { value: infoLight.buttonBorder, type: 'color' },
      Hover: { value: infoLight.buttonHover, type: 'color' },
      Pressed: { value: infoLight.buttonActive, type: 'color' }
    },
    Success: {
      Button: { value: success.buttonBg, type: 'color' },
      Text: { value: success.buttonText, type: 'color' },
      Border: { value: success.buttonBorder, type: 'color' },
      Hover: { value: success.buttonHover, type: 'color' },
      Pressed: { value: success.buttonActive, type: 'color' }
    },
    'Success-Light': {
      Button: { value: successLight.buttonBg, type: 'color' },
      Text: { value: successLight.buttonText, type: 'color' },
      Border: { value: successLight.buttonBorder, type: 'color' },
      Hover: { value: successLight.buttonHover, type: 'color' },
      Pressed: { value: successLight.buttonActive, type: 'color' }
    },
    Warning: {
      Button: { value: warning.buttonBg, type: 'color' },
      Text: { value: warning.buttonText, type: 'color' },
      Border: { value: warning.buttonBorder, type: 'color' },
      Hover: { value: warning.buttonHover, type: 'color' },
      Pressed: { value: warning.buttonActive, type: 'color' }
    },
    'Warning-Light': {
      Button: { value: warningLight.buttonBg, type: 'color' },
      Text: { value: warningLight.buttonText, type: 'color' },
      Border: { value: warningLight.buttonBorder, type: 'color' },
      Hover: { value: warningLight.buttonHover, type: 'color' },
      Pressed: { value: warningLight.buttonActive, type: 'color' }
    },
    Error: {
      Button: { value: error.buttonBg, type: 'color' },
      Text: { value: error.buttonText, type: 'color' },
      Border: { value: error.buttonBorder, type: 'color' },
      Hover: { value: error.buttonHover, type: 'color' },
      Pressed: { value: error.buttonActive, type: 'color' }
    },
    'Error-Light': {
      Button: { value: errorLight.buttonBg, type: 'color' },
      Text: { value: errorLight.buttonText, type: 'color' },
      Border: { value: errorLight.buttonBorder, type: 'color' },
      Hover: { value: errorLight.buttonHover, type: 'color' },
      Pressed: { value: errorLight.buttonActive, type: 'color' }
    }
  };
}

/**
 * Generate icons for a specific background
 */
function generateIconsForBackground(
  bgColor: string,
  allPalettes: {
    neutral: { tone: number; color: string }[];
    primary: { tone: number; color: string }[];
    secondary: { tone: number; color: string }[];
    tertiary: { tone: number; color: string }[];
  },
  isDark: boolean = false,
  surfaceOrContainer: 'Surfaces' | 'Containers' = 'Surfaces',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): IconsForBackground {
  // Icons should use token references instead of direct color values
  // Default icons use Text.Neutral Color-1
  // Chromatic icons use the extracted tone (e.g., Color-9 for tone 90, Color-6 for tone 58)
  
  // Convert extracted tones to Color-N numbers
  const primaryN = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const secondaryN = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 9;
  const tertiaryN = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 9;

  return {
    Default: { value: `{Text.${surfaceOrContainer}.Neutral.Color-1}`, type: 'color' },
    Primary: { value: `{Text.${surfaceOrContainer}.Primary.Color-${primaryN}}`, type: 'color' },
    Secondary: { value: `{Text.${surfaceOrContainer}.Secondary.Color-${secondaryN}}`, type: 'color' },
    Tertiary: { value: `{Text.${surfaceOrContainer}.Tertiary.Color-${tertiaryN}}`, type: 'color' },
    Neutral: { value: `{Text.${surfaceOrContainer}.Neutral.Color-7}`, type: 'color' },
    Info: { value: `{Text.${surfaceOrContainer}.Info.Color-7}`, type: 'color' },
    Success: { value: `{Text.${surfaceOrContainer}.Success.Color-7}`, type: 'color' },
    Warning: { value: `{Text.${surfaceOrContainer}.Warning.Color-7}`, type: 'color' },
    Error: { value: `{Text.${surfaceOrContainer}.Error.Color-7}`, type: 'color' }
  };
}

/**
 * Generate icon variants for a specific background
 */
function generateIconVariantsForBackground(
  bgColor: string,
  allPalettes: {
    neutral: { tone: number; color: string }[];
    primary: { tone: number; color: string }[];
    secondary: { tone: number; color: string }[];
    tertiary: { tone: number; color: string }[];
  },
  isDark: boolean = false,
  surfaceOrContainer: 'Surfaces' | 'Containers' = 'Surfaces',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): IconsForBackground {
  // Icon variants use one tone lighter/darker than base icons
  // For Primary/Secondary/Tertiary, use one tone lighter (N-1) if possible, otherwise same tone
  // Default variant uses Text.Neutral Color-2

  // Convert extracted tones to Color-N numbers, then use one tone lighter (N-1) for variants
  const primaryN = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const secondaryN = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 9;
  const tertiaryN = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 9;
  
  // Use one tone lighter for variants (min of Color-1)
  const primaryVariantN = Math.max(1, primaryN - 1);
  const secondaryVariantN = Math.max(1, secondaryN - 1);
  const tertiaryVariantN = Math.max(1, tertiaryN - 1);
  
  return {
    Default: { value: `{Text.${surfaceOrContainer}.Neutral.Color-2}`, type: 'color' },
    Primary: { value: `{Text.${surfaceOrContainer}.Primary.Color-${primaryVariantN}}`, type: 'color' },
    Secondary: { value: `{Text.${surfaceOrContainer}.Secondary.Color-${secondaryVariantN}}`, type: 'color' },
    Tertiary: { value: `{Text.${surfaceOrContainer}.Tertiary.Color-${tertiaryVariantN}}`, type: 'color' },
    Neutral: { value: `{Text.${surfaceOrContainer}.Neutral.Color-6}`, type: 'color' },
    Info: { value: `{Text.${surfaceOrContainer}.Info.Color-6}`, type: 'color' },
    Success: { value: `{Text.${surfaceOrContainer}.Success.Color-6}`, type: 'color' },
    Warning: { value: `{Text.${surfaceOrContainer}.Warning.Color-6}`, type: 'color' },
    Error: { value: `{Text.${surfaceOrContainer}.Error.Color-6}`, type: 'color' }
  };
}

/**
 * Generate complete Icon palette structure organized by palette > Color-N
 * Now supports different values for Light-Mode and Dark-Mode
 */
function generateIconPaletteStructure(isDark: boolean = false) {
  const iconStructure: any = {
    Surfaces: {
      Neutral: {},
      Primary: {},
      Secondary: {},
      Tertiary: {},
      Info: {},
      Success: {},
      Warning: {},
      Error: {}
    },
    Containers: {
      Neutral: {},
      Primary: {},
      Secondary: {},
      Tertiary: {},
      Info: {},
      Success: {},
      Warning: {},
      Error: {}
    }
  };

  const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];
  const surfaces = ['Surfaces', 'Containers'];
  
  // Icons carry meaning, so under WCAG 1.4.11 they need the same 3:1 against the
  // background that a Border does — and therefore the same tones. These arrays
  // mirror Border.Surfaces exactly (verified identical across all eight
  // palettes in both modes).
  //
  // The previous icon-specific tones sat too close to the background: they
  // measured 86.8% passing in light mode and only 16.7% in dark. Adopting
  // Border's tones takes both to ~100%.
  //
  // Keep these in step with the Border structures — if a Border tone changes,
  // the matching icon tone must change with it or icons silently drop below 3:1.
  const lightMode_DarkBackgroundColors = [6, 6, 7, 9, 10, 2];      // For Color-1 through Color-6
  const lightMode_LightBackgroundColors = [5, 5, 5, 5, 5, 5];      // For Color-7 through Color-12

  const darkMode_DarkBackgroundColors = [6, 6, 7, 8, 9, 2];        // For Color-1 through Color-6
  const darkMode_LightBackgroundColors = [3, 4, 5, 5, 5, 5];       // For Color-7 through Color-12

  const darkBgColors = isDark ? darkMode_DarkBackgroundColors : lightMode_DarkBackgroundColors;
  const lightBgColors = isDark ? darkMode_LightBackgroundColors : lightMode_LightBackgroundColors;

  // Index N is the BACKGROUND tone. For Surfaces that is also the tone the
  // surface renders at, so N indexes the arrays directly.
  //
  // Containers do NOT render at tone N: in dark mode every container level is
  // drawn from the Color-2..Color-4 ramp regardless of background, and in light
  // mode a container is flat Color-11 on a light background or Color-2 on a dark
  // one. Keying icons by N therefore picked a tone for a background the
  // container never has — putting dark icons on dark containers (e.g.
  // #2d3d32 on #111111 = 1.64:1). Resolve the container's actual tone first.
  const containerToneFor = (n: number): number => {
    if (isDark) return 4;            // dark containers span Color-2..4; anchor on Color-4
    return n <= 5 ? 2 : 11;          // light: Color-2 on a dark background, else Color-11
  };
  const toneAt = (n: number): number =>
    n <= 6 ? darkBgColors[n - 1] : lightBgColors[n - 7];

  surfaces.forEach(surface => {
    const isContainer = surface === 'Containers';
    palettes.forEach(palette => {
      for (let n = 1; n <= 12; n++) {
        const effectiveN = isContainer ? containerToneFor(n) : n;
        iconStructure[surface][palette][`Color-${n}`] = {
          value: `{Colors.${palette}.Color-${toneAt(effectiveN)}}`,
          type: 'color'
        };
      }

      // Color-Vibrant
      iconStructure[surface][palette]['Color-Vibrant'] = {
        value: `{Colors.${palette}.Color-${isContainer ? toneAt(containerToneFor(9)) : 9}}`,
        type: 'color'
      };
    });
  });
  
  return iconStructure;
}

/**
 * Generate complete Icon-Variant palette structure organized by palette > Color-N
 * Uses same structure as Icon but with same color values (no variant offset)
 */
function generateIconVariantPaletteStructure(isDark: boolean = false) {
  // Icon-Variant uses the exact same structure and values as Icon
  return generateIconPaletteStructure(isDark);
}

/**
 * Generate tags for a specific background
 */
function generateTagsForBackground(
  bgColor: string,
  allPalettes: {
    primary: { tone: number; color: string }[];
    secondary: { tone: number; color: string }[];
    tertiary: { tone: number; color: string }[];
    info: { tone: number; color: string }[];
    success: { tone: number; color: string }[];
    warning: { tone: number; color: string }[];
    error: { tone: number; color: string }[];
  },
  isDark: boolean = false,
  surfaceOrContainer: 'Surfaces' | 'Containers' = 'Surfaces'
): TagsForBackground {
  // Tags should use Color-9 from each palette and the corresponding text color
  // We're using token references instead of direct color values
  
  return {
    Primary: {
      BG: { value: '{Colors.Primary.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-9}`, type: 'color' }
    },
    Secondary: {
      BG: { value: '{Colors.Secondary.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Secondary.Color-9}`, type: 'color' }
    },
    Tertiary: {
      BG: { value: '{Colors.Tertiary.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Tertiary.Color-9}`, type: 'color' }
    },
    Neutral: {
      BG: { value: '{Colors.Neutral.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Neutral.Color-9}`, type: 'color' }
    },
    Info: {
      BG: { value: '{Colors.Info.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Info.Color-9}`, type: 'color' }
    },
    Success: {
      BG: { value: '{Colors.Success.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Success.Color-9}`, type: 'color' }
    },
    Warning: {
      BG: { value: '{Colors.Warning.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Warning.Color-9}`, type: 'color' }
    },
    Error: {
      BG: { value: '{Colors.Error.Color-9}', type: 'color' },
      Text: { value: `{Text.${surfaceOrContainer}.Error.Color-9}`, type: 'color' }
    }
  };
}

/**
 * Generate Focus-Visible section with fixed Info color mappings
 * This is consistent across all modes and never changes
 */
/**
 * Focus ring colours, keyed by the background tone the ring sits on.
 *
 * A focus indicator is non-text UI, so WCAG 1.4.11 requires 3:1 against the
 * background — the same requirement a Border has. These therefore use Border's
 * tone mapping, applied to the Info palette so the ring keeps its own
 * recognisable hue rather than blending into the theme.
 *
 * This is now per-mode. It previously returned one mode-independent structure
 * with tones [6,6,6,6,8,4] / [4,5,5,5,5,5], which happened to clear 3:1 in dark
 * mode but failed 15 of 96 light-mode backgrounds.
 *
 * Keep in step with the Border structures and with generateIconPaletteStructure
 * — all three share the 3:1 requirement and must share the tones.
 */
function generateFocusVisibleSection(isDark: boolean = false): FocusVisibleSection {
  // Mirrors Border.Surfaces (verified identical across all eight palettes).
  const darkBgTones = isDark ? [6, 6, 7, 8, 9, 2] : [6, 6, 7, 9, 10, 2];   // Background-1..6
  const lightBgTones = isDark ? [3, 4, 5, 5, 5, 5] : [5, 5, 5, 5, 5, 5];   // Background-7..12

  const toneAt = (n: number): number => (n <= 6 ? darkBgTones[n - 1] : lightBgTones[n - 7]);

  // Containers don't render at tone N — see generateIconPaletteStructure for the
  // full reasoning. Dark containers span Color-2..4 (anchor on 4); light
  // containers are Color-2 on a dark background, Color-11 otherwise. Without
  // this the focus ring was keyed to a background the container never has.
  const containerToneFor = (n: number): number => (isDark ? 4 : n <= 5 ? 2 : 11);

  const build = (isContainer: boolean) => {
    const out: Record<string, { value: string; type: 'color' }> = {};
    for (let n = 1; n <= 12; n++) {
      const effectiveN = isContainer ? containerToneFor(n) : n;
      out[`Background-${n}`] = { value: `{Colors.Info.Color-${toneAt(effectiveN)}}`, type: 'color' };
    }
    const vibrantN = isContainer ? containerToneFor(9) : 12;
    out['Background-Vibrant'] = { value: `{Colors.Info.Color-${toneAt(vibrantN)}}`, type: 'color' };
    return out;
  };

  return { Surfaces: build(false), Containers: build(true) };
}

/**
 * Generate hover state colors for a palette
 * Based on the hover state calculation logic
 */
// ─── Shared hover/active step math — MUST stay identical to
// buildPreviewCSS.ts's activeAndHoverFor so the hosted CSS/JSON matches the
// studio preview exactly. Pressed/hover move ALONG the palette one tone away
// from the text colour so contrast is preserved:
//   - dark (light-text) button  → active = tone n-1 (next darker)
//   - light (dark-text) button  → active = tone n+1 (next lighter)
//   - hover = 50% mix(base tone, active tone)
// Endpoints flip direction so there's always a visible delta. ───
// NOTE: the hover/pressed helper island that used to live here
// (_hoverRgb / _hoverIsLight / _hoverMix50 / _pressedHex / generateHoverColors /
// generateActiveColors) has been removed. It was never called — the live
// implementation is buildHoverForPalette() in staticTokenStructures.ts, applied
// via getStaticHoverTokens() / getStaticActiveTokens(). The dead copy also used
// a YIQ brightness threshold to choose direction, which disagreed with the real
// rule (tones 1-5 step darker, 6-12 step lighter) on saturated mid-tones.

/**
 * Flatten nested objects into hyphen-separated keys
 * Example: { Buttons: { Primary: { Button: {...} } } } → { "Buttons-Primary-Button": {...} }
 */
function flattenThemeTokens(obj: any, prefix: string = ''): any {
  const result: any = {};
  
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    
    const value = obj[key];
    const newKey = prefix ? `${prefix}-${key}` : key;
    
    // If value has a 'value' and 'type' property, it's a token - stop flattening
    if (value && typeof value === 'object' && ('value' in value) && ('type' in value)) {
      result[newKey] = value;
    }
    // If it's an object but not a token, continue flattening
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const flattened = flattenThemeTokens(value, newKey);
      Object.assign(result, flattened);
    }
    // Otherwise, copy as-is
    else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Generate themes for a mode (Light-Mode or Dark-Mode) following dyno-design-tokens.css specification
 * Each theme maps to a Theme + N combination and generates Surfaces and Containers blocks
 */
function generateModesThemes(
  modeName: 'Light-Mode' | 'Dark-Mode',
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  componentStyle?: 'professional' | 'modern' | 'bold' | 'playful',
  buttonStyle?: 'primary-adaptive' | 'primary-fixed' | 'black-white' | 'secondary-adaptive' | 'secondary-fixed' | 'tonal-adaptive' | 'tonal-fixed' | 'laddered-adaptive' | 'laddered-fixed',
  navigationSelections?: {
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    status?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
  },
  userSelections?: {
    background?: 'white' | 'black' | 'primary';
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    button?: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
    buttonBehavior?: 'adaptive' | 'fixed';
    cardColoring?: 'tonal' | 'white' | 'black';
    textColoring?: 'tonal' | 'black-white';
  }
): any {
  console.log(`\n🎨🎨🎨 [generateModesThemes] === START for ${modeName} ===`);
  const isDark = modeName === 'Dark-Mode';
  
  // Convert extracted tones to Color-N positions (PC, SC, TC)
  const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const rawSC = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 11;
  const SC = (rawSC === 11 || rawSC <= 5) ? (PC >= 9 ? 9 : 8) : rawSC;
  const rawTC = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 11;
  const TC = (rawTC === 11 || rawTC <= 5) ? (PC >= 9 ? 9 : 8) : rawTC;
  const NC = 9; // Neutral is always fixed
  const OB = PC >= 9 ? 6 : 5; // Other buttons (OB = 8 if PC >= 9, else 6)
  
  // {X} values per Background (from theme-definitions-3.md)
  const getXValue = (backgroundN: number): number => {
    if (isDark) {
      // Dark Mode {X} values (12-tone)
      const darkXMap: Record<number, number> = {
        1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 8,
        7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 6
      };
      return darkXMap[backgroundN] || 6;
    } else {
      // Light Mode {X} values (12-tone)
      const lightXMap: Record<number, number> = {
        1: 6, 2: 6, 3: 7, 4: 9, 5: 10, 6: 4,
        7: 5, 8: 5, 9: 6, 10: 6, 11: 6, 12: 6
      };
      return lightXMap[backgroundN] || 6;
    }
  };
  
  // Determine Container Mode Variables based on cardColoring and textColoring selections
  const cardColoringSelection = userSelections?.cardColoring || 'tonal';
  const textColoringSelection = userSelections?.textColoring || 'tonal';
  
  // Helper to get container variables for a given Theme and N
  const getContainerVars = (theme: string, n: number) => {
    // Determine text themes based on textColoring selection
    // - Tonal: Text colors match their respective themes (surface theme for surfaces, container theme for containers)
    // - Black & White: All text uses BW (pure black/white)
    
    // Surface text theme - based on background theme
    const surfaceTextTheme = textColoringSelection === 'black-white' ? 'BW' : theme;
    
    // Container text theme - based on container theme (varies by card coloring)
    let containerTextTheme: string;
    
    // White Cards (Light or Dark Mode): All containers use Neutral Color-12
    if (cardColoringSelection === 'white') {
      containerTextTheme = textColoringSelection === 'black-white' ? 'BW' : 'Neutral';
      return {
        ContTheme: 'Neutral',
        ContN: 12,
        SurfaceDefaultTextTheme: surfaceTextTheme, // For Surfaces: based on background theme
        ContDefaultTextTheme: containerTextTheme,  // For Containers: based on container theme (Neutral for white cards)
        ContQuiet: containerTextTheme,
        ContDefault: 'Neutral',
        ContPrimary: 'Primary',
        ContSecondary: 'Secondary',
        ContTertiary: 'Tertiary',
        ContNeutral: 'Neutral',
        ContInfo: 'Info',
        ContSuccess: 'Success',
        ContWarning: 'Warning',
        ContError: 'Error'
      };
    }
    // Black Cards (Light or Dark Mode): All containers use Neutral Color-1
    else if (cardColoringSelection === 'black') {
      containerTextTheme = textColoringSelection === 'black-white' ? 'BW' : 'Neutral'; // BW mode uses BW, else Neutral
      return {
        ContTheme: 'Neutral',
        ContN: 1,
        SurfaceDefaultTextTheme: surfaceTextTheme, // For Surfaces: based on background theme
        ContDefaultTextTheme: containerTextTheme,  // For Containers: BW or Neutral (white text on black cards)
        ContQuiet: containerTextTheme,
        ContDefault: 'Neutral',
        ContPrimary: 'Primary',
        ContSecondary: 'Secondary',
        ContTertiary: 'Tertiary',
        ContNeutral: 'Neutral',
        ContInfo: 'Info',
        ContSuccess: 'Success',
        ContWarning: 'Warning',
        ContError: 'Error'
      };
    }
    // Tonal style: Use the actual theme and N values
    else {
      containerTextTheme = textColoringSelection === 'black-white' ? 'BW' : theme;
      return {
        ContTheme: theme,
        ContN: n,
        SurfaceDefaultTextTheme: surfaceTextTheme,  // For Surfaces: based on background theme
        ContDefaultTextTheme: containerTextTheme,   // For Containers: BW or matches ContTheme (respects textColoring)
        ContQuiet: containerTextTheme,
        ContDefault: theme,  // FIXED: Use actual theme instead of 'Default'
        ContPrimary: 'Primary',
        ContSecondary: 'Secondary',
        ContTertiary: 'Tertiary',
        ContNeutral: 'Neutral',
        ContInfo: 'Info',
        ContSuccess: 'Success',
        ContWarning: 'Warning',
        ContError: 'Error'
      };
    }
  };
  
  // Helper to generate a theme structure
  const createThemeStructure = (themeName: string, theme: string, n: number) => {
    // Log what we're creating (especially for Default theme)
    if (themeName === 'Default') {
      console.log('🏗️ [createThemeStructure] Creating DEFAULT theme:');
      console.log('   themeName:', themeName);
      console.log('   theme:', theme);
      console.log('   n:', n);
      console.log('   Will generate Surface as: {Backgrounds.' + theme + '.Background-' + n + '.Surfaces.Surface}');
    }
    
    const cont = getContainerVars(theme, n);
    
    /**
     * BUTTON LOGIC per /imports/theme-definitions-3.md
     * 
     * PRIMARY FIXED: All themes use Primary, {Default-N} = PC (Light) / Vibrant (Dark), {OB} = OB
     * PRIMARY ADAPTIVE: All themes use Primary, {Default-N} = {X}, {OB} = {X}
     * 
     * SECONDARY FIXED: All themes use Secondary, {Default-N} = SC (Light) / Vibrant (Dark), {OB} = OB
     * SECONDARY ADAPTIVE: All themes use Secondary, {Default-N} = {X}, {OB} = {X}
     * 
     * TONAL FIXED:
     *   Default/Neutral: Primary, Primary: Primary, Secondary: Secondary, Tertiary: Tertiary
     *   {Default-N} = PC (Light) / Vibrant (Dark), {OB} = OB
     * 
     * TONAL ADAPTIVE:
     *   Default/Neutral: Primary, Primary: Primary, Secondary: Secondary, Tertiary: Tertiary
     *   {Default-N} = {X}, {OB} = {X}
     * 
     * LADDERED FIXED:
     *   Default: If Default Background is Primary-Light or Primary → Secondary, else Primary
     *   Primary: Secondary, Secondary: Tertiary, Tertiary: Primary, Neutral: Primary
     *   Light Mode: {Default-N} = PC, {OB} = OB
     *   Dark Mode: {Default-N} = Vibrant, {OB} = Vibrant
     * 
     * LADDERED ADAPTIVE:
     *   Default: If Default Background is Primary-Light or Primary → Secondary, else Primary
     *   Primary: Secondary, Secondary: Tertiary, Tertiary: Primary, Neutral: Primary
     *   {Default-N} = {X}, {OB} = {X}
     */
    
    // userSelections.button contains combined values like 'primary-adaptive', 'secondary-fixed', 'tonal-adaptive', 'laddered-fixed', etc.
    const userButtonChoice = userSelections?.button;
    
    // Parse the button type and behavior from the combined value
    let buttonType: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white' = 'primary';
    let buttonBehavior: 'adaptive' | 'fixed' = 'fixed';
    
    if (userButtonChoice) {
      if (userButtonChoice === 'black-white') {
        buttonType = 'black-white';
        buttonBehavior = 'fixed'; // BW is always fixed
      } else if (userButtonChoice.includes('-')) {
        // Split 'primary-adaptive', 'secondary-fixed', etc.
        const parts = userButtonChoice.split('-');
        buttonType = parts[0] as 'primary' | 'secondary' | 'tonal' | 'laddered';
        buttonBehavior = parts[1] as 'adaptive' | 'fixed';
      }
    }
    
    console.log('🎨 [BUTTON TYPE DETECTION]');
    console.log('   userButtonChoice:', userButtonChoice);
    console.log('   Parsed buttonType:', buttonType);
    console.log('   Parsed buttonBehavior:', buttonBehavior);
    
    const isAdaptive = buttonBehavior === 'adaptive';
    const X = getXValue(n); // Get {X} value for this background level
    
    // Determine which color theme to use for each button based on type
    // This mapping applies to: Default, Primary, Secondary, Tertiary, Neutral themes
    let defaultButtonTheme = 'Primary';
    let primaryButtonTheme = 'Primary';
    let secondaryButtonTheme = 'Primary';
    let tertiaryButtonTheme = 'Primary';
    let neutralButtonTheme = 'Primary';
    
    if (buttonType === 'primary') {
      // PRIMARY: All themes use Primary
      defaultButtonTheme = 'Primary';
      primaryButtonTheme = 'Primary';
      secondaryButtonTheme = 'Primary';
      tertiaryButtonTheme = 'Primary';
      neutralButtonTheme = 'Primary';
    } else if (buttonType === 'secondary') {
      // SECONDARY: All themes use Secondary
      defaultButtonTheme = 'Secondary';
      primaryButtonTheme = 'Secondary';
      secondaryButtonTheme = 'Secondary';
      tertiaryButtonTheme = 'Secondary';
      neutralButtonTheme = 'Secondary';
    } else if (buttonType === 'tonal') {
      // TONAL: Each theme uses its own color (except Neutral→Primary, Info/Success/Warning/Error→Primary)
      // {Default} = Primary, {Primary} = Primary, {Secondary} = Secondary, {Tertiary} = Tertiary, {Neutral} = Primary
      if (theme === 'Primary') {
        defaultButtonTheme = 'Primary';
      } else if (theme === 'Secondary') {
        defaultButtonTheme = 'Secondary';
      } else if (theme === 'Tertiary') {
        defaultButtonTheme = 'Tertiary';
      } else {
        // Neutral, Info, Success, Warning, Error, Default all use Primary
        defaultButtonTheme = 'Primary';
      }
      primaryButtonTheme = 'Primary';
      secondaryButtonTheme = 'Secondary';
      tertiaryButtonTheme = 'Tertiary';
      neutralButtonTheme = 'Primary';
    } else if (buttonType === 'laddered') {
      // LADDERED LOGIC (same theme mapping for both Fixed and Adaptive):
      // {Default} = If Default Background is Primary-Light (Primary/13) or Primary (Primary/PC) then Secondary, else Primary
      // {Primary} = Secondary
      // {Secondary} = Tertiary
      // {Tertiary} = Primary
      // {Neutral} = Primary
      // The ONLY difference between Fixed/Adaptive is the N values: Fixed uses Vibrant, Adaptive uses {X}
      
      console.log('🪜 [LADDERED BUTTON] Detected laddered button type');
      console.log('   themeName:', themeName);
      console.log('   theme:', theme);
      console.log('   n:', n);
      console.log('   PC:', PC);
      
      // LADDERED SPEC: The palette for each button depends on which BACKGROUND THEME is active
      // {Primary} = Secondary means "in Primary background theme, Primary button uses Secondary palette"
      // 
      // Default theme: Default btn varies, Primary btn varies too
      // Primary themes: Primary btn = Secondary, Secondary btn = Tertiary, Tertiary btn = Primary, Neutral btn = Primary
      // Secondary themes: Primary btn = Tertiary, Secondary btn = Tertiary, Tertiary btn = Primary, Neutral btn = Primary  
      // Tertiary themes: Primary btn = Primary, Secondary btn = Tertiary, Tertiary btn = Primary, Neutral btn = Primary
      // Neutral themes: Primary btn = Primary, Secondary btn = Tertiary, Tertiary btn = Primary, Neutral btn = Primary
      
      // Check which theme family we're in
      const isPrimaryTheme = themeName === 'Primary' || themeName === 'Primary-Light' || themeName === 'Primary-Medium' || themeName === 'Primary-Dark';
      const isSecondaryTheme = themeName === 'Secondary' || themeName === 'Secondary-Light' || themeName === 'Secondary-Medium' || themeName === 'Secondary-Dark';
      const isTertiaryTheme = themeName === 'Tertiary' || themeName === 'Tertiary-Light' || themeName === 'Tertiary-Medium' || themeName === 'Tertiary-Dark';
      const isNeutralTheme = themeName === 'Neutral' || themeName === 'Neutral-Light' || themeName === 'Neutral-Medium' || themeName === 'Neutral-Dark';
      
      console.log('   🔍 Laddered mapping for themeName:', themeName);
      
      // Set button themes based on which background theme is active
      if (isPrimaryTheme) {
        // Primary background themes: {Primary} = Secondary
        defaultButtonTheme = 'Primary';
        primaryButtonTheme = 'Secondary';
        secondaryButtonTheme = 'Tertiary';
        tertiaryButtonTheme = 'Primary';
        neutralButtonTheme = 'Primary';
        console.log('   ✅ Primary theme → Primary btn uses Secondary');
      } else if (isSecondaryTheme) {
        // Secondary background themes: {Secondary} = Tertiary
        defaultButtonTheme = 'Primary';
        primaryButtonTheme = 'Tertiary';
        secondaryButtonTheme = 'Tertiary';
        tertiaryButtonTheme = 'Primary';
        neutralButtonTheme = 'Primary';
        console.log('   ✅ Secondary theme → Primary btn uses Tertiary');
      } else if (isTertiaryTheme || isNeutralTheme) {
        // Tertiary/Neutral background themes: {Tertiary}/{Neutral} = Primary
        defaultButtonTheme = 'Primary';
        primaryButtonTheme = 'Primary';
        secondaryButtonTheme = 'Tertiary';
        tertiaryButtonTheme = 'Primary';
        neutralButtonTheme = 'Primary';
        console.log('   ✅ Tertiary/Neutral theme → Primary btn uses Primary');
      } else {
        // Default theme: check if background is Primary-Light or Primary
        const defaultBgIsPrimaryLight = (userSelections?.backgroundTheme === 'Primary' && userSelections?.backgroundN === 13);
        const defaultBgIsPrimary = (userSelections?.backgroundTheme === 'Primary' && userSelections?.backgroundN === PC);
        
        if (defaultBgIsPrimaryLight || defaultBgIsPrimary) {
          defaultButtonTheme = 'Secondary';
          primaryButtonTheme = 'Secondary';
          console.log('   ✅ Default theme + Primary bg → buttons use Secondary');
        } else {
          defaultButtonTheme = 'Primary';
          primaryButtonTheme = 'Primary';
          console.log('   ✅ Default theme + non-Primary bg → buttons use Primary');
        }
        secondaryButtonTheme = 'Tertiary';
        tertiaryButtonTheme = 'Primary';
        neutralButtonTheme = 'Primary';
      }
      
      console.log('   Final button themes:');
      console.log('     defaultButtonTheme:', defaultButtonTheme);
      console.log('     primaryButtonTheme:', primaryButtonTheme);
      console.log('     secondaryButtonTheme:', secondaryButtonTheme);
      console.log('     tertiaryButtonTheme:', tertiaryButtonTheme);
      console.log('     neutralButtonTheme:', neutralButtonTheme);
    } else if (buttonType === 'black-white') {
      defaultButtonTheme = 'BW';
      primaryButtonTheme = 'BW';
      secondaryButtonTheme = 'BW';
      tertiaryButtonTheme = 'BW';
      neutralButtonTheme = 'BW';
    }
    
    // Calculate {Default-N} and {OB} values
    let defaultN: number | string;
    let obN: number | string;
    
    if (isAdaptive) {
      // ADAPTIVE: {Default-N} = {X}, {OB} = {X}
      defaultN = X;
      obN = X;
    } else {
      // FIXED: {OB} = OB constant
      obN = OB;
      
      // {Default-N} depends on button type and mode
      if (buttonType === 'primary') {
        defaultN = isDark ? 'Vibrant' : PC;
      } else if (buttonType === 'secondary') {
        defaultN = isDark ? 'Vibrant' : SC;
      } else if (buttonType === 'tonal') {
        // For Tonal: use the appropriate color number based on current theme
        if (isDark) {
          defaultN = 'Vibrant';
        } else {
          if (theme === 'Primary') {
            defaultN = PC;
          } else if (theme === 'Secondary') {
            defaultN = SC;
          } else if (theme === 'Tertiary') {
            defaultN = TC;
          } else {
            // Neutral, Info, Success, Warning, Error, Default all use Primary
            defaultN = PC;
          }
        }
      } else if (buttonType === 'laddered') {
        // Laddered Fixed: Light Mode uses theme-specific values (PC/SC/TC), Dark Mode uses Vibrant
        // For Laddered, we'll set different N values per button theme below
        defaultN = isDark ? 'Vibrant' : PC; // Default still uses PC
      } else {
        // black-white or fallback
        defaultN = PC;
      }
    }
    
    // Special override for Laddered Fixed in Dark Mode
    if (buttonType === 'laddered' && !isAdaptive && isDark) {
      // Dark Mode Laddered Fixed: {OB} = Vibrant (override the OB constant)
      obN = 'Vibrant';
      console.log('🌙 [LADDERED DARK MODE] Overriding obN to Vibrant');
    }
    
    console.log('🎯 [BUTTON N VALUES]');
    console.log('   defaultN:', defaultN);
    console.log('   obN:', obN);
    console.log('   isDark:', isDark);
    console.log('   isAdaptive:', isAdaptive);
    
    // Calculate N values for each theme's buttons
    // In new spec, all themes use {Default-N} or {OB} based on the button type
    let primaryN: number | string;
    let secondaryN: number | string;
    let tertiaryN: number | string;
    let neutralN: number | string;
    
    // LADDERED SPECIFIC LOGIC: Use PC/SC/TC based on button theme mapping
    if (buttonType === 'laddered') {
      // For Laddered buttons, the N value should match the BUTTON THEME being used:
      // - If Primary button uses Primary theme → PC
      // - If Primary button uses Secondary theme → SC
      // - If Primary button uses Tertiary theme → TC
      
      // Primary button N based on which theme it uses
      if (primaryButtonTheme === 'Primary') {
        primaryN = isDark ? 'Vibrant' : PC;
      } else if (primaryButtonTheme === 'Secondary') {
        primaryN = isDark ? 'Vibrant' : SC;
      } else if (primaryButtonTheme === 'Tertiary') {
        primaryN = isDark ? 'Vibrant' : TC;
      } else {
        primaryN = isDark ? 'Vibrant' : PC;
      }
      
      // Secondary button N based on which theme it uses
      if (secondaryButtonTheme === 'Primary') {
        secondaryN = isDark ? 'Vibrant' : PC;
      } else if (secondaryButtonTheme === 'Secondary') {
        secondaryN = isDark ? 'Vibrant' : SC;
      } else if (secondaryButtonTheme === 'Tertiary') {
        secondaryN = isDark ? 'Vibrant' : TC;
      } else {
        secondaryN = isDark ? 'Vibrant' : SC;
      }
      
      // Tertiary button N based on which theme it uses
      if (tertiaryButtonTheme === 'Primary') {
        tertiaryN = isDark ? 'Vibrant' : PC;
      } else if (tertiaryButtonTheme === 'Secondary') {
        tertiaryN = isDark ? 'Vibrant' : SC;
      } else if (tertiaryButtonTheme === 'Tertiary') {
        tertiaryN = isDark ? 'Vibrant' : TC;
      } else {
        tertiaryN = isDark ? 'Vibrant' : TC;
      }
      
      // Neutral button always uses Primary in Laddered
      neutralN = isDark ? 'Vibrant' : PC;
      
      console.log('🪜 [LADDERED BUTTON N VALUES]');
      console.log('   primaryButtonTheme:', primaryButtonTheme, '→ primaryN:', primaryN);
      console.log('   secondaryButtonTheme:', secondaryButtonTheme, '→ secondaryN:', secondaryN);
      console.log('   tertiaryButtonTheme:', tertiaryButtonTheme, '→ tertiaryN:', tertiaryN);
      console.log('   neutralButtonTheme:', neutralButtonTheme, '→ neutralN:', neutralN);
    } else {
      // Non-Laddered buttons: all use defaultN
      primaryN = defaultN;
      secondaryN = defaultN;
      tertiaryN = defaultN;
      neutralN = defaultN;
    }
    
    const infoN = obN;
    const successN = obN;
    const warningN = obN;
    const errorN = obN;
    
    // Calculate Container N values
    // For Professional Light Mode: always 14
    // For Adaptive: uses cont.ContN (which is same as surface N in Tonal/Dark modes)
    // For Fixed: uses defaultN and obN (same as Surfaces)
    let defaultContN: number | string;
    let obContN: number | string;
    
    if (cardColoringSelection === 'white') {
      defaultContN = 12;
      obContN = 12;
    } else if (cardColoringSelection === 'black') {
      defaultContN = 1;
      obContN = 1;
    } else if (isAdaptive) {
      // Adaptive: Container uses cont.ContN
      defaultContN = cont.ContN;
      obContN = cont.ContN;
    } else {
      // Fixed: Same as Surface logic
      defaultContN = defaultN;
      obContN = obN;
    }
    
    const primaryContN = defaultContN;
    const secondaryContN = defaultContN;
    const tertiaryContN = defaultContN;
    const neutralContN = defaultContN;
    const infoContN = obContN;
    const successContN = obContN;
    const warningContN = obContN;
    const errorContN = obContN;
    
    // Calculate {Shade} and {CShade} variables for Buttons and Tags
    // {Shade} for Surfaces: Based on defaultN
    // {CShade} for Containers: Based on cont.ContN
    const calculateShade = (nValue: number | string): 'Light' | 'Medium' => {
      if (typeof nValue === 'string') {
        // If it's 'Vibrant' or 'X', we need to check against a threshold
        // For 'Vibrant' in dark mode, it's typically high (>=9)
        // For now, default to 'Medium' for string values as they're typically adaptive/high
        return 'Medium';
      }
      return nValue >= 9 ? 'Medium' : 'Light';
    };

    const Shade = calculateShade(defaultN); // For Surfaces.Buttons and Surfaces.Tag
    const CShade = calculateShade(typeof cont.ContN === 'number' ? cont.ContN :
                                  (cont.ContN === 12 ? 12 :
                                   cont.ContN === 1 ? 1 :
                                   defaultN)); // For Containers.Buttons and Containers.Tag
    
    console.log('🎨 [SHADE CALCULATIONS]');
    console.log('   defaultN:', defaultN, '→ Shade:', Shade);
    console.log('   cont.ContN:', cont.ContN, '→ CShade:', CShade);
    console.log('   cardColoringSelection:', cardColoringSelection);
    console.log('   textColoringSelection:', textColoringSelection);
    
    // Determine button text references based on textColoringSelection
    // Tonal: Use palette-based text colors
    // BW (Black-White): Use BW-Button for buttons/tags, BW for other text
    const getButtonTextRef = (palette: string, nValue: number | string, shade: 'Light' | 'Medium', isContainer: boolean = false): string => {
      const isBWMode = textColoringSelection === 'black-white';

      // A black-white BUTTON (theme 'BW') must ALWAYS use contrasting text,
      // regardless of the text-coloring selection. A black button (light mode)
      // needs white text (Color-12 → #FFF); a white button (dark mode) needs
      // black text (Color-1 → #000). Without this, a BW button with "Tonal" text
      // coloring falls to {Buttons.BW.{shade}.Text} and renders black-on-black.
      if (palette === 'BW') {
        return `{Text.${isContainer ? 'Containers' : 'Surfaces'}.BW-Button.Color-${isDark ? 1 : 12}}`;
      }

      if (isBWMode && !isDark) {
        // Black-White mode in Light Mode: Use BW-Button text for buttons/tags
        const nVal = typeof nValue === 'number' ? nValue : (nValue === 'Vibrant' ? 'Vibrant' : n);
        return `{Text.${isContainer ? 'Containers' : 'Surfaces'}.BW-Button.Color-${nVal}}`;
      } else {
        // Tonal mode OR Dark mode: Use palette-based text
        return `{Buttons.${palette}.${shade}.Text}`;
      }
    };
    
    // Log button theme mappings for this theme structure
    console.log(`🔨 [CREATING THEME: ${themeName}/${theme}/${n}]`);
    console.log('  Button Theme Mappings:');
    console.log('    defaultButtonTheme =', defaultButtonTheme);
    console.log('    primaryButtonTheme =', primaryButtonTheme, '← Primary button will use', primaryButtonTheme, 'palette');
    console.log('    secondaryButtonTheme =', secondaryButtonTheme, '← Secondary button will use', secondaryButtonTheme, 'palette');
    console.log('    tertiaryButtonTheme =', tertiaryButtonTheme);
    console.log('    neutralButtonTheme =', neutralButtonTheme);
    
    return {
      Surfaces: {
        Surface: { value: `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface}`, type: 'color' },
        'Surface-Dim': { value: `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface-Dim}`, type: 'color' },
        'Surface-Bright': { value: `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface-Bright}`, type: 'color' },
        Header: { value: `{Header.Surfaces.${cont.SurfaceDefaultTextTheme}.Color-${n}}`, type: 'color' },
        'Header-Primary': { value: `{Header.Surfaces.${cont.ContPrimary}.Color-${n}}`, type: 'color' },
        'Header-Secondary': { value: `{Header.Surfaces.${cont.ContSecondary}.Color-${n}}`, type: 'color' },
        'Header-Tertiary': { value: `{Header.Surfaces.${cont.ContTertiary}.Color-${n}}`, type: 'color' },
        'Header-Neutral': { value: `{Header.Surfaces.${cont.ContNeutral}.Color-${n}}`, type: 'color' },
        'Header-Info': { value: `{Header.Surfaces.${cont.ContInfo}.Color-${n}}`, type: 'color' },
        'Header-Success': { value: `{Header.Surfaces.${cont.ContSuccess}.Color-${n}}`, type: 'color' },
        'Header-Warning': { value: `{Header.Surfaces.${cont.ContWarning}.Color-${n}}`, type: 'color' },
        'Header-Error': { value: `{Header.Surfaces.${cont.ContError}.Color-${n}}`, type: 'color' },
        Text: { value: `{Text.Surfaces.${cont.SurfaceDefaultTextTheme}.Color-${n}}`, type: 'color' },
        'Text-Primary': { value: `{Text.Surfaces.${cont.ContPrimary}.Color-${n}}`, type: 'color' },
        'Text-Secondary': { value: `{Text.Surfaces.${cont.ContSecondary}.Color-${n}}`, type: 'color' },
        'Text-Tertiary': { value: `{Text.Surfaces.${cont.ContTertiary}.Color-${n}}`, type: 'color' },
        'Text-Info': { value: `{Text.Surfaces.${cont.ContInfo}.Color-${n}}`, type: 'color' },
        'Text-Success': { value: `{Text.Surfaces.${cont.ContSuccess}.Color-${n}}`, type: 'color' },
        'Text-Warning': { value: `{Text.Surfaces.${cont.ContWarning}.Color-${n}}`, type: 'color' },
        'Text-Error': { value: `{Text.Surfaces.${cont.ContError}.Color-${n}}`, type: 'color' },
        'Text-Neutral': { value: `{Text.Surfaces.${cont.ContNeutral}.Color-${n}}`, type: 'color' },
        Quiet: { value: `{Quiet.Surfaces.${cont.SurfaceDefaultTextTheme}.Color-${n}}`, type: 'color' },
        Border: { value: `{Border.Surfaces.${cont.SurfaceDefaultTextTheme}.Color-${n}}`, type: 'color' },
        'Border-Variant': { value: `{Border-Variant.Surfaces.${cont.SurfaceDefaultTextTheme}.Color-${n}}`, type: 'color' },
        Hotlink: { value: `{Text.Surfaces.Info.Color-${n}}`, type: 'color' },
        'Hotlink-Visited': { value: `{Text.Surfaces.Hotlink-Visited.Color-${n}}`, type: 'color' },
        Hover: { value: `{Hover.${cont.ContTheme}.Color-${cont.ContN}}`, type: 'color' },
        Pressed: { value: `{Pressed.${cont.ContTheme}.Color-${cont.ContN}}`, type: 'color' },
        'Focus-Visible': { value: `{Focus-Visible.Surfaces.Background-${n}}`, type: 'color' },
        Icons: {
          Default: { value: `{Icon.Surfaces.Neutral.Color-${n}}`, type: 'color' },
          'Default-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${n}}`, type: 'color' },
          Primary: { value: `{Icon.Surfaces.Primary.Color-${n}}`, type: 'color' },
          'Primary-Variant': { value: `{Icon-Variant.Surfaces.Primary.Color-${n}}`, type: 'color' },
          Secondary: { value: `{Icon.Surfaces.Secondary.Color-${n}}`, type: 'color' },
          'Secondary-Variant': { value: `{Icon-Variant.Surfaces.Secondary.Color-${n}}`, type: 'color' },
          Tertiary: { value: `{Icon.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
          'Tertiary-Variant': { value: `{Icon-Variant.Surfaces.Tertiary.Color-${n}}`, type: 'color' },
          Neutral: { value: `{Icon.Surfaces.Neutral.Color-${n}}`, type: 'color' },
          'Neutral-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${n}}`, type: 'color' },
          Info: { value: `{Icon.Surfaces.Info.Color-${n}}`, type: 'color' },
          'Info-Variant': { value: `{Icon-Variant.Surfaces.Info.Color-${n}}`, type: 'color' },
          Success: { value: `{Icon.Surfaces.Success.Color-${n}}`, type: 'color' },
          'Success-Variant': { value: `{Icon-Variant.Surfaces.Success.Color-${n}}`, type: 'color' },
          Warning: { value: `{Icon.Surfaces.Warning.Color-${n}}`, type: 'color' },
          'Warning-Variant': { value: `{Icon-Variant.Surfaces.Warning.Color-${n}}`, type: 'color' },
          Error: { value: `{Icon.Surfaces.Error.Color-${n}}`, type: 'color' },
          'Error-Variant': { value: `{Icon-Variant.Surfaces.Error.Color-${n}}`, type: 'color' }
        },
        Buttons: {
          Primary: {
            Button: { value: `{Buttons.${primaryButtonTheme}.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(primaryButtonTheme, primaryN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.${primaryButtonTheme}.${Shade}.Border}`, type: 'color' }
          },
          Secondary: {
            Button: { value: `{Buttons.${secondaryButtonTheme}.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(secondaryButtonTheme, secondaryN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.${secondaryButtonTheme}.${Shade}.Border}`, type: 'color' }
          },
          Tertiary: {
            Button: { value: `{Buttons.${tertiaryButtonTheme}.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(tertiaryButtonTheme, tertiaryN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.${tertiaryButtonTheme}.${Shade}.Border}`, type: 'color' }
          },
          Neutral: {
            Button: { value: `{Buttons.${neutralButtonTheme}.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(neutralButtonTheme, neutralN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.${neutralButtonTheme}.${Shade}.Border}`, type: 'color' }
          },
          Info: {
            Button: { value: `{Buttons.Info.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Info', infoN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.Info.${Shade}.Border}`, type: 'color' }
          },
          Success: {
            Button: { value: `{Buttons.Success.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Success', successN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.Success.${Shade}.Border}`, type: 'color' }
          },
          Warning: {
            Button: { value: `{Buttons.Warning.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Warning', warningN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.Warning.${Shade}.Border}`, type: 'color' }
          },
          Error: {
            Button: { value: `{Buttons.Error.${Shade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Error', errorN, Shade, false), type: 'color' },
            Border: { value: `{Buttons.Error.${Shade}.Border}`, type: 'color' }
          }
        },
        Tag: {
          Primary: {
            BG: { value: `{Tag.${Shade}.Primary.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Primary.Text}`, type: 'color' }
          },
          Secondary: {
            BG: { value: `{Tag.${Shade}.Secondary.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Secondary.Text}`, type: 'color' }
          },
          Tertiary: {
            BG: { value: `{Tag.${Shade}.Tertiary.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Tertiary.Text}`, type: 'color' }
          },
          Info: {
            BG: { value: `{Tag.${Shade}.Info.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Info.Text}`, type: 'color' }
          },
          Success: {
            BG: { value: `{Tag.${Shade}.Success.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Success.Text}`, type: 'color' }
          },
          Warning: {
            BG: { value: `{Tag.${Shade}.Warning.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Warning.Text}`, type: 'color' }
          },
          Error: {
            BG: { value: `{Tag.${Shade}.Error.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Error.Text}`, type: 'color' }
          },
          Neutral: {
            BG: { value: `{Tag.${Shade}.Neutral.BG}`, type: 'color' },
            Text: { value: `{Tag.${Shade}.Neutral.Text}`, type: 'color' }
          }
        }
      },
      Containers: {
        Container: { value: `{Backgrounds.${cont.ContTheme}.Background-${cont.ContN}.Containers.Container}`, type: 'color' },
        'Container-Low': { value: `{Backgrounds.${cont.ContTheme}.Background-${cont.ContN}.Containers.Container-Low}`, type: 'color' },
        'Container-Lowest': { value: `{Backgrounds.${cont.ContTheme}.Background-${cont.ContN}.Containers.Container-Lowest}`, type: 'color' },
        'Container-High': { value: `{Backgrounds.${cont.ContTheme}.Background-${cont.ContN}.Containers.Container-High}`, type: 'color' },
        'Container-Highest': { value: `{Backgrounds.${cont.ContTheme}.Background-${cont.ContN}.Containers.Container-Highest}`, type: 'color' },
        Header: { value: `{Header.Containers.${cont.ContDefaultTextTheme}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Primary': { value: `{Header.Containers.${cont.ContPrimary}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Secondary': { value: `{Header.Containers.${cont.ContSecondary}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Tertiary': { value: `{Header.Containers.${cont.ContTertiary}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Neutral': { value: `{Header.Containers.${cont.ContNeutral}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Info': { value: `{Header.Containers.${cont.ContInfo}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Success': { value: `{Header.Containers.${cont.ContSuccess}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Warning': { value: `{Header.Containers.${cont.ContWarning}.Color-${cont.ContN}}`, type: 'color' },
        'Header-Error': { value: `{Header.Containers.${cont.ContError}.Color-${cont.ContN}}`, type: 'color' },
        Text: { value: `{Text.Containers.${cont.ContDefaultTextTheme}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Primary': { value: `{Text.Containers.${cont.ContPrimary}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Secondary': { value: `{Text.Containers.${cont.ContSecondary}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Tertiary': { value: `{Text.Containers.${cont.ContTertiary}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Neutral': { value: `{Text.Containers.${cont.ContNeutral}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Info': { value: `{Text.Containers.${cont.ContInfo}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Success': { value: `{Text.Containers.${cont.ContSuccess}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Warning': { value: `{Text.Containers.${cont.ContWarning}.Color-${cont.ContN}}`, type: 'color' },
        'Text-Error': { value: `{Text.Containers.${cont.ContError}.Color-${cont.ContN}}`, type: 'color' },
        Quiet: { value: `{Quiet.Containers.${cont.ContQuiet}.Color-${cont.ContN}}`, type: 'color' },
        Border: { value: `{Border.Containers.${cont.ContDefaultTextTheme}.Color-${cont.ContN}}`, type: 'color' },
        'Border-Variant': { value: `{Border-Variant.Containers.${cont.ContDefaultTextTheme}.Color-${cont.ContN}}`, type: 'color' },
        Hover: { value: `{Hover.${cont.ContTheme}.Color-${cont.ContN}}`, type: 'color' },
        Pressed: { value: `{Pressed.${cont.ContTheme}.Color-${cont.ContN}}`, type: 'color' },
        Icons: {
          Default: { value: `{Icon.Containers.Neutral.Color-${cont.ContN}}`, type: 'color' },
          'Default-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${cont.ContN}}`, type: 'color' },
          Primary: { value: `{Icon.Containers.Primary.Color-${cont.ContN}}`, type: 'color' },
          'Primary-Variant': { value: `{Icon-Variant.Containers.Primary.Color-${cont.ContN}}`, type: 'color' },
          Secondary: { value: `{Icon.Containers.Secondary.Color-${cont.ContN}}`, type: 'color' },
          'Secondary-Variant': { value: `{Icon-Variant.Containers.Secondary.Color-${cont.ContN}}`, type: 'color' },
          Tertiary: { value: `{Icon.Containers.Tertiary.Color-${cont.ContN}}`, type: 'color' },
          'Tertiary-Variant': { value: `{Icon-Variant.Containers.Tertiary.Color-${cont.ContN}}`, type: 'color' },
          Neutral: { value: `{Icon.Containers.Neutral.Color-${cont.ContN}}`, type: 'color' },
          'Neutral-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${cont.ContN}}`, type: 'color' },
          Info: { value: `{Icon.Containers.Info.Color-${cont.ContN}}`, type: 'color' },
          'Info-Variant': { value: `{Icon-Variant.Containers.Info.Color-${cont.ContN}}`, type: 'color' },
          Success: { value: `{Icon.Containers.Success.Color-${cont.ContN}}`, type: 'color' },
          'Success-Variant': { value: `{Icon-Variant.Containers.Success.Color-${cont.ContN}}`, type: 'color' },
          Warning: { value: `{Icon.Containers.Warning.Color-${cont.ContN}}`, type: 'color' },
          'Warning-Variant': { value: `{Icon-Variant.Containers.Warning.Color-${cont.ContN}}`, type: 'color' },
          Error: { value: `{Icon.Containers.Error.Color-${cont.ContN}}`, type: 'color' },
          'Error-Variant': { value: `{Icon-Variant.Containers.Error.Color-${cont.ContN}}`, type: 'color' }
        },
        Buttons: {
          Primary: {
            Button: { value: `{Buttons.${primaryButtonTheme}.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(primaryButtonTheme, primaryContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.${primaryButtonTheme}.${CShade}.Border}`, type: 'color' }
          },
          Secondary: {
            Button: { value: `{Buttons.${secondaryButtonTheme}.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(secondaryButtonTheme, secondaryContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.${secondaryButtonTheme}.${CShade}.Border}`, type: 'color' }
          },
          Tertiary: {
            Button: { value: `{Buttons.${tertiaryButtonTheme}.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(tertiaryButtonTheme, tertiaryContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.${tertiaryButtonTheme}.${CShade}.Border}`, type: 'color' }
          },
          Neutral: {
            Button: { value: `{Buttons.${neutralButtonTheme}.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef(neutralButtonTheme, neutralContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.${neutralButtonTheme}.${CShade}.Border}`, type: 'color' }
          },
          Info: {
            Button: { value: `{Buttons.Info.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Info', infoContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.Info.${CShade}.Border}`, type: 'color' }
          },
          Success: {
            Button: { value: `{Buttons.Success.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Success', successContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.Success.${CShade}.Border}`, type: 'color' }
          },
          Warning: {
            Button: { value: `{Buttons.Warning.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Warning', warningContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.Warning.${CShade}.Border}`, type: 'color' }
          },
          Error: {
            Button: { value: `{Buttons.Error.${CShade}.Button}`, type: 'color' },
            Text: { value: getButtonTextRef('Error', errorContN, CShade, true), type: 'color' },
            Border: { value: `{Buttons.Error.${CShade}.Border}`, type: 'color' }
          }
        },
        Tag: {
          Primary: {
            BG: { value: `{Tag.${CShade}.Primary.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Primary.Text}`, type: 'color' }
          },
          Secondary: {
            BG: { value: `{Tag.${CShade}.Secondary.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Secondary.Text}`, type: 'color' }
          },
          Tertiary: {
            BG: { value: `{Tag.${CShade}.Tertiary.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Tertiary.Text}`, type: 'color' }
          },
          Info: {
            BG: { value: `{Tag.${CShade}.Info.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Info.Text}`, type: 'color' }
          },
          Success: {
            BG: { value: `{Tag.${CShade}.Success.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Success.Text}`, type: 'color' }
          },
          Warning: {
            BG: { value: `{Tag.${CShade}.Warning.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Warning.Text}`, type: 'color' }
          },
          Error: {
            BG: { value: `{Tag.${CShade}.Error.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Error.Text}`, type: 'color' }
          },
          Neutral: {
            BG: { value: `{Tag.${CShade}.Neutral.BG}`, type: 'color' },
            Text: { value: `{Tag.${CShade}.Neutral.Text}`, type: 'color' }
          }
        }
      }
    };
  };
  
  // Helper: Map user selection to Theme and N value
  // For surface/surface-dim/surface-bright, requires surfaceTheme and surfaceN to be passed in
  const getNavThemeAndN = (selection: string | undefined, surfaceTheme: string, surfaceN: number, defaultTheme: string = 'Primary', defaultN: number = PC, navKey: string = 'appBar'): { theme: string; n: number } => {
    if (!selection) return { theme: defaultTheme, n: defaultN };
    const isNavBar = navKey === 'navBar';

    switch (selection) {
      case 'white':
        return { theme: 'Neutral', n: 12 };
      case 'black':
        return { theme: 'Neutral', n: 1 };
      case 'primary-light':
        return { theme: 'Primary', n: 11 };
      case 'primary-light-bright':
        return { theme: 'Primary', n: 12 };
      case 'primary-light-dim':
        return { theme: 'Primary', n: 10 };
      case 'primary':
        return { theme: 'Primary', n: PC };
      case 'primary-bright':
        return { theme: 'Primary', n: Math.min(PC + 1, 12) };
      case 'primary-dim':
        return { theme: 'Primary', n: Math.max(PC - 1, 1) };
      default:
        return { theme: defaultTheme, n: defaultN };
    }
  };

  // NOTE: appBarConfig, navBarConfig, statusConfig are computed after defaultConfig below
  
  // Calculate Default theme based on background selection from userSelections (from Color Assignment Stage)
  // This determines which theme the user sees by default
  const backgroundSelection = userSelections?.background;
  let defaultConfig: { theme: string; n: number };
  
  // DARK MODE DEFAULTS: Use Primary-2 for Default theme in Dark Mode
  if (isDark) {
    // DARK MODE LOGIC:
    // - White selection → Neutral-2
    // - Black selection → Neutral-2
    // - Primary or Primary-Light selection → Primary-2
    if (backgroundSelection === 'white' || backgroundSelection === 'neutral-light') {
      defaultConfig = { theme: 'Neutral', n: 2 };  // FIXED: Dark Mode White → Neutral-2
      console.log('🎨 [Default Theme] DARK MODE Background=White/Neutral-Light → Neutral Color-2');
    } else if (backgroundSelection === 'black' || backgroundSelection === 'neutral-dark') {
      defaultConfig = { theme: 'Neutral', n: 2 };
      console.log('🎨 [Default Theme] DARK MODE Background=Black/Neutral-Dark → Neutral Color-2');
    } else if (backgroundSelection === 'primary' || backgroundSelection === 'primary-light') {
      // Primary or Primary-Light → Primary-2 in Dark Mode
      defaultConfig = { theme: 'Primary', n: 2 };
      console.log(`🎨 [Default Theme] DARK MODE Background=Primary/Primary-Light → Primary Color-2`);
    } else if (userSelections?.backgroundN !== undefined && userSelections?.backgroundTheme) {
      // Use explicit user selections if provided
      defaultConfig = { theme: userSelections.backgroundTheme, n: userSelections.backgroundN };
      console.log(`🎨 [Default Theme] DARK MODE Using userSelections → ${userSelections.backgroundTheme} Color-${userSelections.backgroundN}`);
    } else {
      // Default for Dark Mode: Primary-2
      defaultConfig = { theme: 'Primary', n: 2 };
      console.log(`🎨 [Default Theme] DARK MODE Default → Primary Color-2`);
    }
  } else {
    // LIGHT MODE DEFAULTS (existing logic)
    if (backgroundSelection === 'white' || backgroundSelection === 'neutral-light') {
      defaultConfig = { theme: 'Neutral', n: 12 };
      console.log('🎨 [Default Theme] Background=White/Neutral-Light → Neutral Color-12');
    } else if (backgroundSelection === 'black' || backgroundSelection === 'neutral-dark') {
      defaultConfig = { theme: 'Neutral', n: 1 };
      console.log('🎨 [Default Theme] Background=Black/Neutral-Dark → Neutral Color-1');
    } else if (backgroundSelection === 'primary') {
      defaultConfig = { theme: 'Primary', n: PC };
      console.log(`🎨 [Default Theme] Background=Primary → Primary Color-${PC}`);
    } else if (backgroundSelection === 'primary-light') {
      defaultConfig = { theme: 'Primary', n: 11 };
      console.log(`🎨 [Default Theme] Background=Primary-Light → Primary Color-11`);
    } else if (backgroundSelection === 'primary-dark') {
      defaultConfig = { theme: 'Primary', n: 3 };
      console.log(`🎨 [Default Theme] Background=Primary-Dark → Primary Color-3`);
    } else {
      // Use backgroundN from userSelections if available, otherwise default to Primary Color-9
      // This handles 'primary-base' and any other background options by using the actual extracted tone
      const fallbackN = userSelections?.backgroundN || PC;
      const fallbackTheme = userSelections?.backgroundTheme || 'Primary';
      defaultConfig = { theme: fallbackTheme, n: fallbackN };
      console.log(`🎨 [Default Theme] Using userSelections.backgroundN=${fallbackN}, backgroundTheme=${fallbackTheme} (from Color Assignment Stage)`);
    }
  }

  // Now that defaultConfig is resolved, compute nav configs using surface theme/N
  const appBarConfig = getNavThemeAndN(navigationSelections?.appBar, defaultConfig.theme, defaultConfig.n, 'Primary', PC, 'appBar');
  const navBarConfig = getNavThemeAndN(navigationSelections?.navBar, defaultConfig.theme, defaultConfig.n, 'Primary', PC, 'navBar');
  const statusConfig = getNavThemeAndN(userSelections?.status, defaultConfig.theme, defaultConfig.n, 'Neutral', 12, 'status');

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 [DEFAULT THEME CREATION]');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  backgroundSelection:', backgroundSelection);
  console.log('  userSelections.backgroundN:', userSelections?.backgroundN);
  console.log('  userSelections.backgroundTheme:', userSelections?.backgroundTheme);
  console.log('  FINAL defaultConfig.theme:', defaultConfig.theme);
  console.log('  FINAL defaultConfig.n:', defaultConfig.n);
  console.log('  Creating Default theme with createThemeStructure("Default", "' + defaultConfig.theme + '", ' + defaultConfig.n + ')');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Generate all 31 themes (including Default) following Section 1 mapping table
  return {
    'Default': createThemeStructure('Default', defaultConfig.theme, defaultConfig.n),  // CRITICAL: User's selected background
    'Primary-Light': createThemeStructure('Primary-Light', 'Primary', 13),
    'Primary': createThemeStructure('Primary', 'Primary', PC),
    'Primary-Medium': createThemeStructure('Primary-Medium', 'Primary', 6),
    'Primary-Dark': createThemeStructure('Primary-Dark', 'Primary', 3),
    'Secondary-Light': createThemeStructure('Secondary-Light', 'Secondary', 13),
    'Secondary': createThemeStructure('Secondary', 'Secondary', SC),
    'Secondary-Medium': createThemeStructure('Secondary-Medium', 'Secondary', 6),
    'Secondary-Dark': createThemeStructure('Secondary-Dark', 'Secondary', 3),
    'Tertiary-Light': createThemeStructure('Tertiary-Light', 'Tertiary', 13),
    'Tertiary': createThemeStructure('Tertiary', 'Tertiary', TC),
    'Tertiary-Medium': createThemeStructure('Tertiary-Medium', 'Tertiary', 6),
    'Tertiary-Dark': createThemeStructure('Tertiary-Dark', 'Tertiary', 3),
    'Neutral': createThemeStructure('Neutral', 'Neutral', isDark ? 2 : 14),  // Dark Mode: Neutral-2, Light Mode: Neutral-14
    'Neutral-Light': createThemeStructure('Neutral-Light', 'Neutral', 12),
    'Neutral-Medium': createThemeStructure('Neutral-Medium', 'Neutral', 6),
    'Neutral-Dark': createThemeStructure('Neutral-Dark', 'Neutral', isDark ? 2 : 3),  // Dark Mode: Neutral-2, Light Mode: Neutral-3
    'Error-Light': createThemeStructure('Error-Light', 'Error', 12),
    'Error-Medium': createThemeStructure('Error-Medium', 'Error', 6),
    'Error-Dark': createThemeStructure('Error-Dark', 'Error', 3),
    'Success-Light': createThemeStructure('Success-Light', 'Success', 12),
    'Success-Medium': createThemeStructure('Success-Medium', 'Success', 6),
    'Success-Dark': createThemeStructure('Success-Dark', 'Success', 3),
    'Warning-Light': createThemeStructure('Warning-Light', 'Warning', 12),
    'Warning-Medium': createThemeStructure('Warning-Medium', 'Warning', 6),
    'Warning-Dark': createThemeStructure('Warning-Dark', 'Warning', 3),
    'Info-Light': createThemeStructure('Info-Light', 'Info', 12),
    'Info-Medium': createThemeStructure('Info-Medium', 'Info', 6),
    'Info-Dark': createThemeStructure('Info-Dark', 'Info', 3),
    'App-Bar': createThemeStructure('App-Bar', appBarConfig.theme, appBarConfig.n),
    'Nav-Bar': createThemeStructure('Nav-Bar', navBarConfig.theme, navBarConfig.n),
    'Status': createThemeStructure('Status', statusConfig.theme, statusConfig.n)
  };
}

/**
 * Generate the complete Themes section with all theme variations
 */
function generateThemesSection(
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  backgroundSelection?: 'primary' | 'white' | 'black',
  navigationSelections?: {
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    status?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
  }
): any {
  // Convert extracted tones to Color-N positions using the 12-tone system
  const primaryN = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const secondaryN = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 9;
  const tertiaryN = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 9;

  console.log(`🎨 [Themes] Using extracted tones → Primary: tone ${extractedTones?.primary || 71} = Color-${primaryN}, Secondary: tone ${extractedTones?.secondary || 71} = Color-${secondaryN}, Tertiary: tone ${extractedTones?.tertiary || 71} = Color-${tertiaryN}`);
  
  // Helper: Map background selection to Theme and N value
  const getBgThemeAndN = (selection: string | undefined, defaultTheme: string = 'Primary', defaultN: number = 9): { theme: string; n: number } => {
    if (!selection) return { theme: defaultTheme, n: defaultN };

    switch (selection) {
      case 'white':
        return { theme: 'Neutral', n: 12 };
      case 'black':
        return { theme: 'Neutral', n: 1 };
      case 'primary':
        return { theme: 'Primary', n: primaryN };
      case 'primary-light':
        return { theme: 'Primary', n: 11 };
      default:
        return { theme: defaultTheme, n: defaultN };
    }
  };

  // Helper: Map nav selection to Theme and N value (uses surface-based options)
  const getNavThemeAndN2 = (selection: string | undefined, surfaceTheme: string, surfaceN: number, defaultTheme: string, defaultN: number, navKey: string = 'appBar'): { theme: string; n: number } => {
    if (!selection) return { theme: defaultTheme, n: defaultN };
    const isNavBar = navKey === 'navBar';

    switch (selection) {
      case 'white':
        return { theme: 'Neutral', n: 12 };
      case 'black':
        return { theme: 'Neutral', n: 1 };
      case 'primary-light':
        return { theme: 'Primary', n: 11 };
      case 'primary-light-bright':
        return { theme: 'Primary', n: 12 };
      case 'primary-light-dim':
        return { theme: 'Primary', n: 10 };
      case 'primary':
        return { theme: 'Primary', n: primaryN };
      case 'primary-bright':
        return { theme: 'Primary', n: Math.min(primaryN + 1, 12) };
      case 'primary-dim':
        return { theme: 'Primary', n: Math.max(primaryN - 1, 1) };
      default:
        return { theme: defaultTheme, n: defaultN };
    }
  };

  const defaultConfig = getBgThemeAndN(backgroundSelection, 'Primary', primaryN);
  const appBarConfig = getNavThemeAndN2(navigationSelections?.appBar, defaultConfig.theme, defaultConfig.n, 'Neutral', 1, 'appBar');
  const navBarConfig = getNavThemeAndN2(navigationSelections?.navBar, defaultConfig.theme, defaultConfig.n, 'Neutral', 2, 'navBar');
  const statusConfig = getNavThemeAndN2(navigationSelections?.status, defaultConfig.theme, defaultConfig.n, 'Neutral', 12, 'status');
  
  console.log(`🎨 [Themes] Selections → Default: ${defaultConfig.theme} Color-${defaultConfig.n}, App-Bar: ${appBarConfig.theme} Color-${appBarConfig.n}, Nav-Bar: ${navBarConfig.theme} Color-${navBarConfig.n}, Status: ${statusConfig.theme} Color-${statusConfig.n}`);
  
  // Helper to create a theme structure and flatten nested Buttons/Icons/Tags
  const createTheme = (backgroundNum: number, palette: string = 'Primary') => {
    const theme = {
    Surfaces: {
      Surface: { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Surfaces.Surface}`, type: 'color' },
      'Surface-Dim': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Surfaces.Surface-Dim}`, type: 'color' },
      'Surface-Bright': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Surfaces.Surface-Bright}`, type: 'color' },
      Header: { value: `{Header.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Header-Primary': { value: `{Header.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Secondary': { value: `{Header.Surfaces.Secondary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Tertiary': { value: `{Header.Surfaces.Tertiary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Neutral': { value: `{Header.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
      'Header-Info': { value: `{Header.Surfaces.Info.Color-${backgroundNum}}`, type: 'color' },
      'Header-Success': { value: `{Header.Surfaces.Success.Color-${backgroundNum}}`, type: 'color' },
      'Header-Warning': { value: `{Header.Surfaces.Warning.Color-${backgroundNum}}`, type: 'color' },
      'Header-Error': { value: `{Header.Surfaces.Error.Color-${backgroundNum}}`, type: 'color' },
      Text: { value: `{Text.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Text-Primary': { value: `{Text.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Secondary': { value: `{Text.Surfaces.Secondary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Tertiary': { value: `{Text.Surfaces.Tertiary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Neutral': { value: `{Text.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
      'Text-Info': { value: `{Text.Surfaces.Info.Color-${backgroundNum}}`, type: 'color' },
      'Text-Success': { value: `{Text.Surfaces.Success.Color-${backgroundNum}}`, type: 'color' },
      'Text-Warning': { value: `{Text.Surfaces.Warning.Color-${backgroundNum}}`, type: 'color' },
      'Text-Error': { value: `{Text.Surfaces.Error.Color-${backgroundNum}}`, type: 'color' },
      Quiet: { value: `{Quiet.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Border: { value: `{Border.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Border-Variant': { value: `{Border-Variant.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Hotlink: { value: `{Text.Surfaces.Info.Color-${backgroundNum}}`, type: 'color' },
      'Hotlink-Visited': { value: `{Hotlink-Visited.Surfaces.Color-${backgroundNum}}`, type: 'color' },
      Hover: { value: `{Hover.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Pressed: { value: `{Pressed.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Focus-Visible': { value: `{Focus-Visible.Surfaces.Background-${backgroundNum}}`, type: 'color' },
      Buttons: {
        // NOTE: this entire Themes literal is dead in the live pipeline — it
        // gets overwritten by `generateCompleteSimplifiedSystem` at the
        // assignment further down in this file (around line 5904). The
        // *live* Default-button cascade lives in generateCompleteThemes.ts
        // and uses `config.defaultButtonPalette` to pick the right palette.
        // Keeping the literal here on Primary just to satisfy TS — nothing
        // downstream reads these values.
        Default: {
          Button: { value: `{Colors.Primary.Color-${backgroundNum}}`, type: 'color' },
          Text: { value: `{Text.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
          Border: { value: `{Border.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Hover.Primary.Color-${backgroundNum}}`, type: 'color' },
          Pressed: { value: `{Pressed.Primary.Color-${backgroundNum}}`, type: 'color' }
        },
        'Default-Light': {
          Button: { value: `{Colors.Primary.Color-10}`, type: 'color' },
          Text: { value: `{Text.Surfaces.Primary.Color-10}`, type: 'color' },
          Hover: { value: `{Hover.Primary.Color-10}`, type: 'color' },
          Pressed: { value: `{Pressed.Primary.Color-10}`, type: 'color' }
        },
        Primary: {
          Button: { value: `{Primary-Button.Surfaces.Background-${backgroundNum}.Button}`, type: 'color' },
          Text: { value: `{Primary-Button.Surfaces.Background-${backgroundNum}.Text}`, type: 'color' },
          Border: { value: `{Border.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Primary-Button.Surfaces.Background-${backgroundNum}.Hover}`, type: 'color' },
          Pressed: { value: `{Primary-Button.Surfaces.Background-7.Pressed}`, type: 'color' }
        },
        'Primary-Light': {
          Button: { value: `{Colors.Primary.Color-10}`, type: 'color' },
          Text: { value: `{Text.Surfaces.Primary.Color-10}`, type: 'color' },
          Border: { value: `{Border.Surfaces.Primary.Color-10}`, type: 'color' },
          Hover: { value: `{Hover.Primary.Color-10}`, type: 'color' },
          Pressed: { value: `{Pressed.Primary.Color-10}`, type: 'color' }
        },
        'Primary-Outline': {
          Button: { value: '#00000000', type: 'color' },
          Text: { value: `{Text.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Border: { value: `{Border.Surfaces.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Hover.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Pressed: { value: `{Pressed.${palette}.Color-${backgroundNum}}`, type: 'color' }
        },
        Secondary: {
          Button: { value: '{Colors.Secondary.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Secondary.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Secondary.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Secondary.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Secondary.Color-10}', type: 'color' }
        },
        Tertiary: {
          Button: { value: '{Colors.Tertiary.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Tertiary.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Tertiary.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Tertiary.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Tertiary.Color-10}', type: 'color' }
        },
        Neutral: {
          Button: { value: '{Colors.Neutral.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Neutral.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Neutral.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Neutral.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Neutral.Color-10}', type: 'color' }
        },
        Info: {
          Button: { value: '{Colors.Info.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Info.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Info.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Info.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Info.Color-10}', type: 'color' }
        },
        Success: {
          Button: { value: '{Colors.Success.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Success.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Success.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Success.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Success.Color-10}', type: 'color' }
        },
        Warning: {
          Button: { value: '{Colors.Warning.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Warning.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Warning.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Warning.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Warning.Color-10}', type: 'color' }
        },
        Error: {
          Button: { value: '{Colors.Error.Color-10}', type: 'color' },
          Text: { value: '{Text.Surfaces.Error.Color-10}', type: 'color' },
          Border: { value: '{Border.Surfaces.Error.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Error.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Error.Color-10}', type: 'color' }
        }
      },
      Icons: {
        Default: { value: `{Icon.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
        'Default-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
        Primary: { value: `{Icon.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
        'Primary-Variant': { value: `{Icon-Variant.Surfaces.Primary.Color-${backgroundNum}}`, type: 'color' },
        Secondary: { value: `{Icon.Surfaces.Secondary.Color-${backgroundNum}}`, type: 'color' },
        'Secondary-Variant': { value: `{Icon-Variant.Surfaces.Secondary.Color-${backgroundNum}}`, type: 'color' },
        Tertiary: { value: `{Icon.Surfaces.Tertiary.Color-${backgroundNum}}`, type: 'color' },
        'Tertiary-Variant': { value: `{Icon-Variant.Surfaces.Tertiary.Color-${backgroundNum}}`, type: 'color' },
        Neutral: { value: `{Icon.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
        'Neutral-Variant': { value: `{Icon-Variant.Surfaces.Neutral.Color-${backgroundNum}}`, type: 'color' },
        Info: { value: `{Icon.Surfaces.Info.Color-${backgroundNum}}`, type: 'color' },
        'Info-Variant': { value: `{Icon-Variant.Surfaces.Info.Color-${backgroundNum}}`, type: 'color' },
        Success: { value: `{Icon.Surfaces.Success.Color-${backgroundNum}}`, type: 'color' },
        'Success-Variant': { value: `{Icon-Variant.Surfaces.Success.Color-${backgroundNum}}`, type: 'color' },
        Warning: { value: `{Icon.Surfaces.Warning.Color-${backgroundNum}}`, type: 'color' },
        'Warning-Variant': { value: `{Icon-Variant.Surfaces.Warning.Color-${backgroundNum}}`, type: 'color' },
        Error: { value: `{Icon.Surfaces.Error.Color-${backgroundNum}}`, type: 'color' },
        'Error-Variant': { value: `{Icon-Variant.Surfaces.Error.Color-${backgroundNum}}`, type: 'color' }
      },
      Tag: {
        Primary: { BG: { value: '{Tag.Medium.Primary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Primary.Text}', type: 'color' } },
        Secondary: { BG: { value: '{Tag.Medium.Secondary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Secondary.Text}', type: 'color' } },
        Tertiary: { BG: { value: '{Tag.Medium.Tertiary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Tertiary.Text}', type: 'color' } },
        Neutral: { BG: { value: '{Tag.Medium.Neutral.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Neutral.Text}', type: 'color' } },
        Info: { BG: { value: '{Tag.Medium.Info.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Info.Text}', type: 'color' } },
        Success: { BG: { value: '{Tag.Medium.Success.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Success.Text}', type: 'color' } },
        Warning: { BG: { value: '{Tag.Medium.Warning.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Warning.Text}', type: 'color' } },
        Error: { BG: { value: '{Tag.Medium.Error.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Error.Text}', type: 'color' } }
      }
    },
    Containers: {
      Container: { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Containers.Container}`, type: 'color' },
      'Container-Lowest': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Containers.Container-Lowest}`, type: 'color' },
      'Container-Low': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Containers.Container-Low}`, type: 'color' },
      'Container-High': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Containers.Container-High}`, type: 'color' },
      'Container-Highest': { value: `{Backgrounds.${palette}.Background-${backgroundNum}.Containers.Container-Highest}`, type: 'color' },
      Header: { value: `{Header.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Header-Primary': { value: `{Header.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Secondary': { value: `{Header.Containers.Secondary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Tertiary': { value: `{Header.Containers.Tertiary.Color-${backgroundNum}}`, type: 'color' },
      'Header-Neutral': { value: `{Header.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
      'Header-Info': { value: `{Header.Containers.Info.Color-${backgroundNum}}`, type: 'color' },
      'Header-Success': { value: `{Header.Containers.Success.Color-${backgroundNum}}`, type: 'color' },
      'Header-Warning': { value: `{Header.Containers.Warning.Color-${backgroundNum}}`, type: 'color' },
      'Header-Error': { value: `{Header.Containers.Error.Color-${backgroundNum}}`, type: 'color' },
      Text: { value: `{Text.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Text-Primary': { value: `{Text.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Secondary': { value: `{Text.Containers.Secondary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Tertiary': { value: `{Text.Containers.Tertiary.Color-${backgroundNum}}`, type: 'color' },
      'Text-Neutral': { value: `{Text.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
      'Text-Info': { value: `{Text.Containers.Info.Color-${backgroundNum}}`, type: 'color' },
      'Text-Success': { value: `{Text.Containers.Success.Color-${backgroundNum}}`, type: 'color' },
      'Text-Warning': { value: `{Text.Containers.Warning.Color-${backgroundNum}}`, type: 'color' },
      'Text-Error': { value: `{Text.Containers.Error.Color-${backgroundNum}}`, type: 'color' },
      Quiet: { value: `{Quiet.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Border: { value: `{Border.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Border-Variant': { value: `{Border-Variant.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Hotlink: { value: `{Text.Containers.Info.Color-${backgroundNum}}`, type: 'color' },
      'Hotlink-Visited': { value: `{Hotlink-Visited.Containers.Color-${backgroundNum}}`, type: 'color' },
      Hover: { value: `{Hover.${palette}.Color-${backgroundNum}}`, type: 'color' },
      Pressed: { value: `{Pressed.${palette}.Color-${backgroundNum}}`, type: 'color' },
      'Focus-Visible': { value: `{Focus-Visible.Containers.Background-${backgroundNum}}`, type: 'color' },
      Buttons: {
        // Dead literal (overwritten by generateCompleteSimplifiedSystem). See
        // the matching note in the Surfaces Buttons block above.
        Default: {
          Button: { value: `{Colors.Primary.Color-${backgroundNum}}`, type: 'color' },
          Text: { value: `{Text.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
          Border: { value: `{Border.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Hover.Primary.Color-${backgroundNum}}`, type: 'color' },
          Pressed: { value: `{Pressed.Primary.Color-${backgroundNum}}`, type: 'color' }
        },
        'Default-Light': {
          Button: { value: `{Colors.Primary.Color-10}`, type: 'color' },
          Text: { value: `{Text.Containers.Primary.Color-10}`, type: 'color' },
          Hover: { value: `{Hover.Primary.Color-10}`, type: 'color' },
          Pressed: { value: `{Pressed.Primary.Color-10}`, type: 'color' }
        },
        Primary: {
          Button: { value: `{Primary-Button.Containers.Background-${backgroundNum}.Button}`, type: 'color' },
          Text: { value: `{Primary-Button.Containers.Background-${backgroundNum}.Text}`, type: 'color' },
          Border: { value: `{Border.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Primary-Button.Containers.Background-${backgroundNum}.Hover}`, type: 'color' },
          Pressed: { value: `{Primary-Button.Containers.Background-7.Pressed}`, type: 'color' }
        },
        'Primary-Light': {
          Button: { value: '{Colors.Primary.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Primary.Color-10}', type: 'color' },
          Border: { value: `{Border.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: '{Hover.Primary.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Primary.Color-10}', type: 'color' }
        },
        'Primary-Outline': {
          Button: { value: '#00000000', type: 'color' },
          Text: { value: `{Text.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Border: { value: `{Border.Containers.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Hover: { value: `{Hover.${palette}.Color-${backgroundNum}}`, type: 'color' },
          Pressed: { value: `{Pressed.${palette}.Color-${backgroundNum}}`, type: 'color' }
        },
        Secondary: {
          Button: { value: '{Colors.Secondary.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Secondary.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Secondary.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Secondary.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Secondary.Color-10}', type: 'color' }
        },
        Tertiary: {
          Button: { value: '{Colors.Tertiary.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Tertiary.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Tertiary.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Tertiary.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Tertiary.Color-10}', type: 'color' }
        },
        Neutral: {
          Button: { value: '{Colors.Neutral.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Neutral.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Neutral.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Neutral.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Neutral.Color-10}', type: 'color' }
        },
        Info: {
          Button: { value: '{Colors.Info.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Info.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Info.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Info.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Info.Color-10}', type: 'color' }
        },
        Success: {
          Button: { value: '{Colors.Success.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Success.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Success.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Success.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Success.Color-10}', type: 'color' }
        },
        Warning: {
          Button: { value: '{Colors.Warning.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Warning.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Warning.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Warning.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Warning.Color-10}', type: 'color' }
        },
        Error: {
          Button: { value: '{Colors.Error.Color-10}', type: 'color' },
          Text: { value: '{Text.Containers.Error.Color-10}', type: 'color' },
          Border: { value: '{Border.Containers.Error.Color-11}', type: 'color' },
          Hover: { value: '{Hover.Error.Color-10}', type: 'color' },
          Pressed: { value: '{Pressed.Error.Color-10}', type: 'color' }
        }
      },
      Icons: {
        Default: { value: `{Icon.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
        'Default-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
        Primary: { value: `{Icon.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
        'Primary-Variant': { value: `{Icon-Variant.Containers.Primary.Color-${backgroundNum}}`, type: 'color' },
        Secondary: { value: `{Icon.Containers.Secondary.Color-${backgroundNum}}`, type: 'color' },
        'Secondary-Variant': { value: `{Icon-Variant.Containers.Secondary.Color-${backgroundNum}}`, type: 'color' },
        Tertiary: { value: `{Icon.Containers.Tertiary.Color-${backgroundNum}}`, type: 'color' },
        'Tertiary-Variant': { value: `{Icon-Variant.Containers.Tertiary.Color-${backgroundNum}}`, type: 'color' },
        Neutral: { value: `{Icon.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
        'Neutral-Variant': { value: `{Icon-Variant.Containers.Neutral.Color-${backgroundNum}}`, type: 'color' },
        Info: { value: `{Icon.Containers.Info.Color-${backgroundNum}}`, type: 'color' },
        'Info-Variant': { value: `{Icon-Variant.Containers.Info.Color-${backgroundNum}}`, type: 'color' },
        Success: { value: `{Icon.Containers.Success.Color-${backgroundNum}}`, type: 'color' },
        'Success-Variant': { value: `{Icon-Variant.Containers.Success.Color-${backgroundNum}}`, type: 'color' },
        Warning: { value: `{Icon.Containers.Warning.Color-${backgroundNum}}`, type: 'color' },
        'Warning-Variant': { value: `{Icon-Variant.Containers.Warning.Color-${backgroundNum}}`, type: 'color' },
        Error: { value: `{Icon.Containers.Error.Color-${backgroundNum}}`, type: 'color' },
        'Error-Variant': { value: `{Icon-Variant.Containers.Error.Color-${backgroundNum}}`, type: 'color' }
      },
      Tag: {
        Primary: { BG: { value: '{Tag.Medium.Primary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Primary.Text}', type: 'color' } },
        Secondary: { BG: { value: '{Tag.Medium.Secondary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Secondary.Text}', type: 'color' } },
        Tertiary: { BG: { value: '{Tag.Medium.Tertiary.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Tertiary.Text}', type: 'color' } },
        Neutral: { BG: { value: '{Tag.Medium.Neutral.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Neutral.Text}', type: 'color' } },
        Info: { BG: { value: '{Tag.Medium.Info.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Info.Text}', type: 'color' } },
        Success: { BG: { value: '{Tag.Medium.Success.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Success.Text}', type: 'color' } },
        Warning: { BG: { value: '{Tag.Medium.Warning.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Warning.Text}', type: 'color' } },
        Error: { BG: { value: '{Tag.Medium.Error.BG}', type: 'color' }, Text: { value: '{Tag.Medium.Error.Text}', type: 'color' } }
      }
    }
    };
    
    // Keep Buttons, Icons, and Tag nested (no flattening)
    console.log(`  🔧 [Theme] Processing theme for ${palette} Background-${backgroundNum}`);
    console.log(`      theme.Surfaces keys:`, Object.keys(theme.Surfaces));
    console.log(`      theme.Containers keys:`, Object.keys(theme.Containers));
    console.log(`      theme.Surfaces.Buttons exists?`, !!theme.Surfaces.Buttons);
    console.log(`      theme.Surfaces.Icons exists?`, !!theme.Surfaces.Icons);
    console.log(`      theme.Surfaces.Tag exists?`, !!theme.Surfaces.Tag);
    
    const surfaceTokenCount = Object.keys(theme.Surfaces).length;
    const containerTokenCount = Object.keys(theme.Containers).length;
    console.log(`  ✅ [Theme] Generated ${surfaceTokenCount} Surface tokens, ${containerTokenCount} Container tokens`);
    
    return theme;
  };

  return {
    Default: createTheme(defaultConfig.n, defaultConfig.theme),  // Use background selection
    Primary: createTheme(primaryN, 'Primary'),  // Use extracted tone → Color-N
    'Primary-Light': createTheme(11, 'Primary'),
    'Primary-Medium': createTheme(6, 'Primary'),  // Medium always uses Color-6
    'Primary-Dark': createTheme(3, 'Primary'),
    Secondary: createTheme(secondaryN, 'Secondary'),  // Use extracted tone → Color-N
    'Secondary-Light': createTheme(11, 'Secondary'),
    'Secondary-Medium': createTheme(6, 'Secondary'),  // Medium always uses Color-6
    'Secondary-Dark': createTheme(3, 'Secondary'),
    Tertiary: createTheme(tertiaryN, 'Tertiary'),  // Use extracted tone → Color-N
    'Tertiary-Light': createTheme(11, 'Tertiary'),
    'Tertiary-Medium': createTheme(6, 'Tertiary'),  // Medium always uses Color-6
    'Tertiary-Dark': createTheme(3, 'Tertiary'),
    Neutral: createTheme(9, 'Neutral'),
    'Neutral-Light': createTheme(11, 'Neutral'),
    'Neutral-Medium': createTheme(6, 'Neutral'),
    'Neutral-Dark': createTheme(3, 'Neutral'),
    'Info-Light': createTheme(11, 'Info'),
    'Info-Medium': createTheme(6, 'Info'),
    'Info-Dark': createTheme(3, 'Info'),
    'Success-Light': createTheme(11, 'Success'),
    'Success-Medium': createTheme(6, 'Success'),
    'Success-Dark': createTheme(3, 'Success'),
    'Warning-Light': createTheme(11, 'Warning'),
    'Warning-Medium': createTheme(6, 'Warning'),
    'Warning-Dark': createTheme(3, 'Warning'),
    'Error-Light': createTheme(11, 'Error'),
    'Error-Medium': createTheme(6, 'Error'),
    'Error-Dark': createTheme(3, 'Error'),
    'App-Bar': createTheme(appBarConfig.n, appBarConfig.theme),  // Use App Bar selection
    'Nav-Bar': createTheme(navBarConfig.n, navBarConfig.theme),  // Use Nav Bar selection
    Status: createTheme(statusConfig.n, statusConfig.theme)  // Use Status Bar selection
  };
  
  console.log(`🎨🎨🎨 [generateModesThemes] === END for ${modeName} - Generated ${Object.keys(themes).length} themes ===\n`);
  const sampleTheme = themes['Primary-Light'];
  if (sampleTheme) {
    console.log(`  📋 Sample Theme (Primary-Light):`);
    console.log(`      Surfaces keys (${Object.keys(sampleTheme.Surfaces).length}):`, Object.keys(sampleTheme.Surfaces).slice(0, 10).join(', '));
    console.log(`      Containers keys (${Object.keys(sampleTheme.Containers).length}):`, Object.keys(sampleTheme.Containers).slice(0, 10).join(', '));
  }
  
  return themes;
}

/**
 * Export the entire color system to a JSON structure
 */
export function exportColorSystemToJSON(
  tonePalettes: {
    primary: { tone: number; color: string }[];
    secondary: { tone: number; color: string }[];
    tertiary: { tone: number; color: string }[];
    neutral: { tone: number; color: string }[];
    info: { tone: number; color: string }[];
    success: { tone: number; color: string }[];
    warning: { tone: number; color: string }[];
    error: { tone: number; color: string }[];
    'hotlink-visited': { tone: number; color: string }[];
  },
  darkModeTonePalettes: {
    primary: { tone: number; color: string }[];
    secondary: { tone: number; color: string }[];
    tertiary: { tone: number; color: string }[];
    neutral: { tone: number; color: string }[];
    info: { tone: number; color: string }[];
    success: { tone: number; color: string }[];
    warning: { tone: number; color: string }[];
    error: { tone: number; color: string }[];
    'hotlink-visited': { tone: number; color: string }[];
  },
  selectedBackground: 'neutral' | 'primary',
  buttonStyle: 'primary-adaptive' | 'primary-fixed' | 'black-white' | 'secondary-adaptive' | 'secondary-fixed' | 'tonal-adaptive' | 'tonal-fixed' | 'laddered-adaptive' | 'laddered-fixed' = 'primary-fixed',
  extractedTones?: { primary: number; secondary: number; tertiary: number }, // Tones from extracted colors
  componentStyle?: 'professional' | 'modern' | 'bold' | 'playful', // Selected component style
  typography?: { header?: { family: string; weight: string }; decorative?: { family: string; weight: string }; body?: { family: string; weight: string } }, // Selected typography
  designSystemName?: string, // Design system name
  dateCreated?: string, // Date the design system was created
  dateUpdated?: string, // Date the design system was last updated
  navigationColors?: { appBar?: string; toolBar?: string; navBar?: string }, // Navigation bar color selections
  surfaceStyle?: 'light-tonal' | 'grey-professional' | 'dark-professional', // Surface style from image analysis
  schemeType?: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic', // Color scheme type
  userSelections?: { // User selections from ColorAssignmentStage - takes precedence over calculated defaults
    defaultTheme?: 'light' | 'dark';
    background?: 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
    appBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    navBar?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    status?: 'primary-light' | 'primary-light-bright' | 'primary-light-dim' | 'primary' | 'primary-bright' | 'primary-dim' | 'white' | 'black';
    button?: 'primary-adaptive' | 'primary-fixed' | 'secondary-adaptive' | 'secondary-fixed' | 'tonal-adaptive' | 'tonal-fixed' | 'laddered-adaptive' | 'laddered-fixed' | 'black-white';
    cardColoring?: 'tonal' | 'white' | 'black';
    textColoring?: 'tonal' | 'black-white';
  }
): ColorSystemExport {
  console.log('🏗️ [JSON Export] Starting color system export...');
  console.log('📊 [JSON Export] Configuration:', { selectedBackground, buttonStyle, extractedTones, componentStyle });
  
  // Validate that we have the required palettes
  const requiredPalettes = ['neutral', 'primary', 'secondary', 'tertiary'] as const;
  const missingPalettes = requiredPalettes.filter(key => 
    !tonePalettes[key] || tonePalettes[key].length === 0 || 
    !darkModeTonePalettes[key] || darkModeTonePalettes[key].length === 0
  );
  
  if (missingPalettes.length > 0) {
    console.error(`❌ [JSON Export] Missing required palettes: ${missingPalettes.join(', ')}`);
    console.error('❌ [JSON Export] Cannot generate design system without core palettes');
    throw new Error(`Missing required color palettes: ${missingPalettes.join(', ')}`);
  }
  
  console.log('✅ [JSON Export] All required palettes validated');
  
  // Format dates as MM/DD/YYYY
  const formatDate = (date: string | undefined): string => {
    if (!date) {
      const now = new Date();
      return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
    }
    return date;
  };
  
  // Calculate default theme settings based on user selections OR calculated defaults
  // Priority: userSelections > calculated defaults
  let defaultSettings = null;
  
  if (extractedTones && surfaceStyle && schemeType) {
    // First calculate the base defaults
    console.log('🎯 [JSON Export] Calculating base defaults');
    defaultSettings = calculateDefaultThemeSettings(
      extractedTones.primary,
      extractedTones.secondary,
      surfaceStyle,
      schemeType,
      buttonStyle
    );

    // Then override with user selections if they exist
    console.log('🔍 [JSON Export] Checking userSelections:', userSelections);
    console.log('🔍 [JSON Export] userSelections exists?', !!userSelections);
    console.log('🔍 [JSON Export] userSelections.backgroundTheme:', userSelections?.backgroundTheme);
    console.log('🔍 [JSON Export] userSelections.backgroundN:', userSelections?.backgroundN);
    
    if (userSelections) {
      console.log('🎯 [JSON Export] Applying User Selections from UI:', userSelections);
      defaultSettings = applyUserSelections(
        defaultSettings,
        userSelections,
        extractedTones.primary,
        extractedTones.secondary
      );
    }
  } else {
    // Fallback: Create default settings even if some parameters are missing
    console.warn('⚠️ [JSON Export] Some parameters missing for defaultSettings calculation');
    console.warn('  ├─ extractedTones:', extractedTones);
    console.warn('  ├─ surfaceStyle:', surfaceStyle);
    console.warn('  └─ schemeType:', schemeType);
    
    if (extractedTones) {
      // Use fallback values for missing parameters
      defaultSettings = calculateDefaultThemeSettings(
        extractedTones.primary,
        extractedTones.secondary,
        surfaceStyle || 'light-tonal',
        schemeType || 'triadic',
        buttonStyle
      );
      
      // Apply user selections if they exist
      if (userSelections) {
        console.log('���� [JSON Export] Applying User Selections (fallback mode):', userSelections);
        defaultSettings = applyUserSelections(
          defaultSettings,
          userSelections,
          extractedTones.primary,
          extractedTones.secondary
        );
      }
    } else {
      console.error('❌ [JSON Export] Cannot create defaultSettings - extractedTones is missing!');
    }
  }
  
  console.log('🎯 [JSON Export] Final Default Settings:', defaultSettings);
  
  // Calculate OB (Other Buttons) value based on Primary Color position
  const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
  const OB = PC >= 9 ? 6 : 5; // Other buttons (OB = 8 if PC >= 9, else 6)
  console.log(`🎯 [JSON Export] OB calculated: ${OB} (PC = ${PC})`);
  
  const colorSystem: ColorSystemExport = {
    Metadata: {
      Name: {
        value: designSystemName || 'My Design System',
        type: 'string'
      },
      'Date Created': {
        value: formatDate(dateCreated),
        type: 'string'
      },
      'Date Updated': {
        value: formatDate(dateUpdated),
        type: 'string'
      },
      ...(extractedTones && {
        'Extracted-Tones': {
          Primary: { value: extractedTones.primary, type: 'number' },
          Secondary: { value: extractedTones.secondary, type: 'number' },
          Tertiary: { value: extractedTones.tertiary, type: 'number' }
        }
      }),
      ...(userSelections?.background && {
        'Background': { value: userSelections.background, type: 'string' }
      }),
      'Button-Config': {
        DefaultButtonType: { 
          value: buttonStyle === 'black-white' 
            ? 'black-white' 
            : buttonStyle?.startsWith('laddered')
              ? 'laddered'
              : buttonStyle?.startsWith('tonal') 
                ? 'tonal' 
                : buttonStyle?.startsWith('secondary') 
                  ? 'secondary' 
                  : 'primary', 
          type: 'string' 
        },
        ButtonBehavior: { 
          value: buttonStyle?.endsWith('-adaptive') ? 'adaptive' : 'fixed', 
          type: 'string' 
        }
      },
      ...(defaultSettings && {
        'Default-Settings': {
          'Default-Theme': {
            'Theme-Name': { value: defaultSettings.defaultThemeName, type: 'string' },
            Theme: { value: defaultSettings.defaultTheme, type: 'string' },
            N: { value: defaultSettings.defaultN, type: 'number' }
          },
          'App-Bar': {
            Selection: { value: defaultSettings.appBar, type: 'string' },
            Theme: { value: defaultSettings.appBarTheme, type: 'string' },
            N: { value: defaultSettings.appBarN, type: 'number' }
          },
          'Nav-Bar': {
            Selection: { value: defaultSettings.navBar, type: 'string' },
            Theme: { value: defaultSettings.navBarTheme, type: 'string' },
            N: { value: defaultSettings.navBarN, type: 'number' }
          },
          Status: {
            Selection: { value: defaultSettings.status, type: 'string' },
            Theme: { value: defaultSettings.statusTheme, type: 'string' },
            N: { value: defaultSettings.statusN, type: 'number' }
          },
          Button: {
            Default: { value: defaultSettings.buttonDefault, type: 'string' },
            'Default-N': { value: defaultSettings.buttonDefaultN, type: 'number' }
          },
          'Card-Coloring': {
            ContTheme: { value: defaultSettings.containerTheme, type: 'string' },
            ContN: { value: defaultSettings.containerN, type: 'number' },
            CShade: { value: defaultSettings.containerShade, type: 'string' }
          },
          'Text-Coloring': {
            TextMode: { value: defaultSettings.textColoringMode || 'tonal', type: 'string' }
          }
        }
      })
    },
    Modes: {
      'Light-Mode': {
        Colors: {},
        Header: { Surfaces: {}, Containers: {} },
        Text: {},
        Quiet: { Surfaces: {}, Containers: {} },
        Border: { Surfaces: {}, Containers: {} },
        Hover: {},
        Pressed: {},
        Backgrounds: {},
        Icon: generateIconPaletteStructure(false), // Light-Mode
        'Icon-Variant': generateIconVariantPaletteStructure(false), // Light-Mode
        Tag: {},
        Charts: { Surfaces: {}, Containers: {} },
        'Focus-Visible': generateFocusVisibleSection(false), // Light-Mode
        Buttons: {}, // Will be populated with all button types
        Themes: {} // Will be populated with all 30 themes
      },
      'Dark-Mode': {
        Colors: {},
        Header: { Surfaces: {}, Containers: {} },
        Text: {},
        Quiet: { Surfaces: {}, Containers: {} },
        Border: { Surfaces: {}, Containers: {} },
        Hover: {},
        Pressed: {},
        Backgrounds: {},
        Icon: generateIconPaletteStructure(true), // Dark-Mode
        'Icon-Variant': generateIconVariantPaletteStructure(true), // Dark-Mode
        Tag: {},
        Charts: { Surfaces: {}, Containers: {} },
        'Focus-Visible': generateFocusVisibleSection(true), // Dark-Mode
        Buttons: {}, // Will be populated with all button types
        Themes: {} // Will be populated with all 30 themes
      }
    },
    Style: {} as any, // Will be populated below
    Spacing: {} as any, // Will be populated below
    Typography: {} as any // Will be populated below
  };

  // Generate Style section with all variants
  const createStyleVariant = (
    borderRadius: number,
    bevelColor: string = '#eeeeee'
  ): StyleVariant => {
    // Cap stored Border-Radius at a 32px reference button height. Buttons
    // at that height saturate to a perfect pill at radius ≥ 16, so capping
    // playful's 40 → 32 doesn't visually change the button — but it
    // prevents cards / modals / image thumbnails from inheriting a
    // stadium silhouette in downstream consumers of the JSON. Matches the
    // CSS-side cap in buildPreviewCSS and exportToCSS.
    const STORED_RADIUS_CAP = 32;
    const cappedBorderRadius = Math.min(borderRadius, STORED_RADIUS_CAP);
    return {
    Bevel: {
      'Bevel-1': {
        'Shadow-1': {
          'offset-x': { value: 0, type: 'dimension' },
          'offset-y': { value: 0, type: 'dimension' },
          'blur-radius': { value: 0, type: 'dimension' },
          'spread-radius': { value: 1, type: 'dimension' },
          color: { value: bevelColor, type: 'color' }
        }
      },
      'Bevel-2': {
        'Shadow-1': {
          'offset-x': { value: 0, type: 'dimension' },
          'offset-y': { value: 0, type: 'dimension' },
          'blur-radius': { value: 0, type: 'dimension' },
          'spread-radius': { value: 1, type: 'dimension' },
          color: { value: bevelColor, type: 'color' }
        }
      }
    },
    'Border-Radius': {
      'offset-x': { value: cappedBorderRadius, type: 'dimension' }
    },
    Gradient: {
      'Color-1': { value: '{Buttons.Primary.Button}', type: 'color' },
      'Color-2': { value: '{Buttons.Primary.Button}', type: 'color' },
      Angle: { value: 0, type: 'dimension' }
    }
    };
  };

  console.log('🎨 [JSON Export] Generating Style section...');
  
  // Create all style variants
  const professionalStyle = createStyleVariant(4);
  const modernStyle = createStyleVariant(8);
  const boldStyle = createStyleVariant(16);
  const playfulStyle = createStyleVariant(40);
  
  // Set Default based on componentStyle selection, fallback to 'modern'
  const selectedStyleVariant = componentStyle || 'modern';
  let defaultStyle: StyleVariant;
  
  switch (selectedStyleVariant) {
    case 'professional':
      defaultStyle = professionalStyle;
      break;
    case 'modern':
      defaultStyle = modernStyle;
      break;
    case 'bold':
      defaultStyle = boldStyle;
      break;
    case 'playful':
      defaultStyle = playfulStyle;
      break;
    default:
      defaultStyle = modernStyle;
  }
  
  colorSystem.Style = {
    Default: defaultStyle,
    Professional: professionalStyle,
    Modern: modernStyle,
    Bold: boldStyle,
    Playful: playfulStyle
  };
  
  console.log(`  ├─ [JSON Export] Style/Default → Set to ${selectedStyleVariant.charAt(0).toUpperCase() + selectedStyleVariant.slice(1)} (border-radius: ${defaultStyle['Border-Radius']['offset-x'].value})`);
  console.log(`  ├─ [JSON Export] Style/Professional → border-radius: 4`);
  console.log(`  ├─ [JSON Export] Style/Modern → border-radius: 8`);
  console.log(`  ├─ [JSON Export] Style/Bold → border-radius: 16`);
  console.log(`  ├─ [JSON Export] Style/Playful → border-radius: 40`);

  // Spacing section
  console.log('📏 [JSON Export] Generating Spacing section...');
  colorSystem.Spacing = {
    Multiplier: { value: '1', type: 'number' },
    'Spacing-1': { value: '8px', type: 'dimension' },
    'Spacing-2': { value: '16px', type: 'dimension' },
    'Spacing-3': { value: '24px', type: 'dimension' },
    'Spacing-4': { value: '32px', type: 'dimension' },
    'Spacing-5': { value: '40px', type: 'dimension' },
    'Spacing-6': { value: '48px', type: 'dimension' },
    'Spacing-7': { value: '56px', type: 'dimension' },
    'Spacing-8': { value: '64px', type: 'dimension' },
    'Spacing-9': { value: '72px', type: 'dimension' },
    'Spacing-10': { value: '80px', type: 'dimension' },
    'Spacing-11': { value: '88px', type: 'dimension' },
    'Spacing-12': { value: '96px', type: 'dimension' },
    'Spacing-Half': { value: '4px', type: 'dimension' },
    'Spacing-Quater': { value: '2px', type: 'dimension' }
  };
  console.log('  ✓ [JSON Export] Spacing section generated');

  // Typography section
  console.log('🔤 [JSON Export] Generating Typography section...');
  console.log('  ├─ Typography parameter:', typography);
  console.log('  ├─ Has header:', !!typography?.header);
  console.log('  ├─ Has decorative:', !!typography?.decorative);
  console.log('  ├─ Has body:', !!typography?.body);
  if (typography) {
    console.log('  ├─ Header family:', typography.header?.family);
    console.log('  ├─ Decorative family:', typography.decorative?.family);
    console.log('  └�� Body family:', typography.body?.family);
  }
  
  // Extract font family names (remove style classifications)
  const extractFontName = (family: string) => {
    // If it has a comma, it's in format "Font Name, Style" - extract just the font name
    if (family.includes(',')) {
      return family.split(',')[0].trim();
    }
    return family;
  };

  const headerFamily = extractFontName(typography?.header?.family || 'Open Sans');
  const decorativeFamily = extractFontName(typography?.decorative?.family || 'Open Sans');
  const bodyFamily = extractFontName(typography?.body?.family || 'Open Sans');
  
  // Determine if body family is "Sans Serif" - if so, use body family name; otherwise use "Open Sans"
  const bodyFamilyType = typography?.body?.family || '';
  const isSansSerif = bodyFamilyType.toLowerCase().includes('sans serif');
  const congativeFamily = isSansSerif ? bodyFamily : 'Open Sans';

  colorSystem.Typography = {
    'Set-Font-Family-Body': { value: bodyFamily, type: 'string' },
    'Set-Font-Family-Header': { value: headerFamily, type: 'string' },
    'Set-Font-Family-Decorative': { value: decorativeFamily, type: 'string' },
    'Set-Header-Font-Weight': { value: typography?.header?.weight || '600', type: 'string' },
    'Set-Decorative-Font-Weight': { value: typography?.decorative?.weight || '600', type: 'string' },
    'Set-Body-Font-Weight': { value: typography?.body?.weight || '400', type: 'string' },
    'Set-Body-Semibold-Font-Weight': { value: '600', type: 'string' },
    'Set-Body-Bold-Font-Weight': { value: '700', type: 'string' },
    'Set-Header-Caps': { value: typography?.header?.allCaps ? 'uppercase' : 'none', type: 'string' },
    'Set-Decorative-Caps': { value: typography?.decorative?.allCaps ? 'uppercase' : 'none', type: 'string' },
    'Congative-Family-Body': { value: congativeFamily, type: 'string' }
  };
  
  console.log(`  ├─ [JSON Export] Typography/Set-Font-Family-Header → ${headerFamily} ${typography?.header?.weight || '600'}`);
  console.log(`  ├─ [JSON Export] Typography/Set-Font-Family-Decorative → ${decorativeFamily} ${typography?.decorative?.weight || '600'}`);
  console.log(`  ├─ [JSON Export] Typography/Set-Font-Family-Body → ${bodyFamily} ${typography?.body?.weight || '400'}`);
  console.log(`  ├─ [JSON Export] Typography/Set-Header-Caps → ${typography?.header?.allCaps ? 'uppercase' : 'none'}`);
  console.log(`  ├─ [JSON Export] Typography/Set-Decorative-Caps → ${typography?.decorative?.allCaps ? 'uppercase' : 'none'}`);
  console.log(`  ├─ [JSON Export] Typography/Congative-Family-Body → ${congativeFamily}`);

  // Light mode backgrounds - all 14 backgrounds with 1:1 mapping to Color-N
  const lightModeBackgroundTones = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];
  const lightModeBackgroundNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Dark mode backgrounds - all 12 backgrounds with 1:1 mapping to Color-N
  const darkModeBackgroundTones = [1, 5, 12, 18, 24, 58, 64, 70, 76, 82, 85, 89];
  // Neutral and Chromatic both use the same 12 tones (Background-N → Color-N)
  const darkModeNeutralBackgroundTones = [1, 5, 12, 18, 24, 58, 64, 70, 76, 82, 85, 89];
  const darkModeNeutralBackgroundNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const darkModeChromaticBackgroundTones = [1, 5, 12, 18, 24, 58, 64, 70, 76, 82, 85, 89];
  const darkModeChromaticBackgroundNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Process each palette
  console.log('🎨 [JSON Export] Processing color palettes...');
  
  // DEBUG: Log Primary palette at function entry
  console.log('🔍 [exportColorSystem ENTRY] Primary palette received:', tonePalettes.primary);
  if (tonePalettes.primary) {
    console.log('   Color-1:', tonePalettes.primary[0]);
    console.log('   Color-6:', tonePalettes.primary[5]);
    console.log('   Color-12:', tonePalettes.primary[11]);
  }
  
  (['neutral', 'primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error', 'hotlink-visited'] as const).forEach((paletteKey) => {
    const palette = tonePalettes[paletteKey];
    const darkPalette = darkModeTonePalettes[paletteKey];
    
    // DEBUG: Log tertiary palette specifically
    if (paletteKey === 'tertiary') {
      console.log('🔍🔍🔍 [TERTIARY DEBUG] Tertiary palette received:');
      console.log('  palette:', palette);
      console.log('  darkPalette:', darkPalette);
      if (palette && palette.length > 0) {
        console.log('  Color-1:', palette[0]);
        console.log('  Color-6:', palette[5]);
        console.log('  Color-12:', palette[11]);
      }
    }
    
    // Skip if palette is not defined
    if (!palette || !darkPalette) {
      console.log(`  ⚠️  [JSON Export] Skipping ${paletteKey} - palette not found`);
      return;
    }
    
    // Capitalize palette name for export
    // Special handling for 'hotlink-visited' to become 'Hotlink-Visited'
    const paletteName = paletteKey === 'hotlink-visited' 
      ? 'Hotlink-Visited' 
      : paletteKey.charAt(0).toUpperCase() + paletteKey.slice(1);
    
    // DEBUG: Log tertiary paletteName
    if (paletteKey === 'tertiary') {
      console.log('🔍 [TERTIARY DEBUG] paletteName after capitalization:', paletteName);
      console.log('🔍 [TERTIARY DEBUG] paletteKey:', paletteKey);
    }
    
    console.log(`  ├─ [JSON Export] Adding ${paletteName} palette (Light: ${palette.length} colors, Dark: ${darkPalette.length} colors)`);

    // Add to Colors.Light-Mode section
    // Color-Vibrant:
    // - For Primary/Secondary/Tertiary: Use the extracted tone (e.g., tone 90 = Color-9, tone 58 = Color-6)
    // - For semantic palettes (10 colors): Color-6 (index 7) which corresponds to tone 58
    // - For Neutral: Color-9 (index 10)
    const isSemanticColor = paletteKey === 'info' || paletteKey === 'success' || paletteKey === 'warning' || paletteKey === 'error' || paletteKey === 'hotlink-visited';
    
    // Color-Vibrant = Color-8 (index 7 in 0-based array) for BOTH Light and Dark mode
    let lightColorVibrant: string;
    lightColorVibrant = palette.length > 7 ? palette[7].color : palette[palette.length - 1].color;
    console.log(`🎨 [Color-Vibrant] ${paletteName} using Color-8 (index 7)`);

    colorSystem.Modes['Light-Mode'].Colors[paletteName] = {};
    
    // Add all light mode tones to Colors section
    // Ensure we have all 12 colors (Color-1 through Color-12)
    for (let i = 0; i < 12; i++) {
      const colorKey = `Color-${i + 1}`;
      let colorValue: string;

      if (i < palette.length) {
        // Use existing palette color
        colorValue = palette[i].color;

        // DEBUG: Log ALL colors for Primary to see what's being used
        if (paletteName === 'Primary') {
          console.log(`🔍 [exportColorSystem ASSIGNMENT] ${paletteName} ${colorKey}: palette[${i}].color = "${palette[i].color}"`);
        }

        // DEBUG: Log Color-1, Color-6, and Color-12 for Primary
        if (paletteName === 'Primary' && (i === 0 || i === 5 || i === 11)) {
          console.log(`🔍 [exportColorSystem] ${paletteName} ${colorKey}: palette[${i}] =`, palette[i]);
          console.log(`   └─ Using color value: ${colorValue}`);
        }
      } else if (i === 11) {
        // Color-12: Blend last available color with white
        const lastColor = palette[palette.length - 1].color;
        colorValue = chroma.mix(lastColor, '#FFFFFF', 0.5, 'lab').hex();
      } else {
        // Missing color: use last available color
        colorValue = palette[palette.length - 1].color;
      }
      
      colorSystem.Modes['Light-Mode'].Colors[paletteName][colorKey] = {
        value: colorValue,
        type: 'color'
      };
    }
    
    // DEBUG: Verify what was actually written to the JSON for Primary
    if (paletteName === 'Primary') {
      console.log(`🔍 [exportColorSystem] ${paletteName} JSON Colors verification:`);
      console.log('  Color-1:', colorSystem.Modes['Light-Mode'].Colors[paletteName]['Color-1']);
      console.log('  Color-6:', colorSystem.Modes['Light-Mode'].Colors[paletteName]['Color-6']);
      console.log('  Color-12:', colorSystem.Modes['Light-Mode'].Colors[paletteName]['Color-12']);
    }
    
    // Add Color-Vibrant for light mode (= Color-8)
    colorSystem.Modes['Light-Mode'].Colors[paletteName]['Color-Vibrant'] = {
      value: lightColorVibrant,
      type: 'color'
    };

    // Add to Colors.Dark-Mode section
    // Color-Vibrant for dark mode uses the SAME color as Light Mode Color-Vibrant (Light Mode Color-9)
    // This ensures consistency: Dark Mode Vibrant = Light Mode Vibrant = Light Mode Color-9
    colorSystem.Modes['Dark-Mode'].Colors[paletteName] = {};
    
    // For dark mode: all palettes start at Color-1 (12 colors each)
    const darkStartIndex = 1;
    const darkEndIndex = paletteKey === 'neutral' ? 12 : 12;
    const darkColorCount = darkEndIndex - darkStartIndex + 1;
    
    // Ensure we have all required dark mode colors
    for (let i = 0; i < darkColorCount; i++) {
      const colorKey = `Color-${darkStartIndex + i}`;
      let colorValue: string;
      
      if (i < darkPalette.length) {
        // Use existing dark palette color
        colorValue = darkPalette[i].color;
      } else if (darkStartIndex + i === 12) {
        // Color-12: Blend last available color with white
        const lastColor = darkPalette[darkPalette.length - 1].color;
        colorValue = chroma.mix(lastColor, '#FFFFFF', 0.3, 'lab').hex();
      } else {
        // Missing color: use last available color
        colorValue = darkPalette[darkPalette.length - 1].color;
      }
      
      colorSystem.Modes['Dark-Mode'].Colors[paletteName][colorKey] = {
        value: colorValue,
        type: 'color'
      };
    }
    
    // Add Color-Vibrant for dark mode - USE LIGHT MODE Color-8
    // Per specification: Dark Mode Vibrant = Light Mode Vibrant = Light Mode Color-8
    colorSystem.Modes['Dark-Mode'].Colors[paletteName]['Color-Vibrant'] = {
      value: lightColorVibrant, // Use the SAME value as light mode (Light Mode Color-8)
      type: 'color'
    };
    
    console.log(`🎨 [Color-Vibrant] ${paletteName} DARK MODE Color-Vibrant = ${lightColorVibrant} (using Light Mode Color-8)`);

    // Add modes for Neutral, Primary, Secondary, Tertiary, and semantic colors (Error, Warning, Success, Info)
    if (paletteKey === 'neutral' || paletteKey === 'primary' || paletteKey === 'secondary' || paletteKey === 'tertiary' ||
        paletteKey === 'error' || paletteKey === 'warning' || paletteKey === 'success' || paletteKey === 'info') {
      console.log(`    ├─ [JSON Export] Creating backgrounds for ${paletteName}`);
      
      // Debug: Check if Backgrounds objects exist
      console.log(`      [DEBUG] Checking Backgrounds existence before initialization:`);
      console.log(`        - Light-Mode.Backgrounds: ${!!colorSystem.Modes['Light-Mode'].Backgrounds}`);
      console.log(`        - Dark-Mode.Backgrounds: ${!!colorSystem.Modes['Dark-Mode'].Backgrounds}`);
      
      try {
        // Initialize palette sections in Modes
        console.log(`      ├─ [JSON Export] Initializing Backgrounds (no palette nesting)...`);
        
        // Defensive: Ensure Backgrounds objects exist
        if (!colorSystem.Modes['Light-Mode'].Backgrounds) {
          console.error(`❌ WARNING: Light-Mode.Backgrounds is undefined! Creating it...`);
          colorSystem.Modes['Light-Mode'].Backgrounds = {};
        }
        if (!colorSystem.Modes['Dark-Mode'].Backgrounds) {
          console.error(`❌ WARNING: Dark-Mode.Backgrounds is undefined! Creating it...`);
          colorSystem.Modes['Dark-Mode'].Backgrounds = {};
        }
        
        // CREATE palette nesting: Backgrounds.Neutral, Backgrounds.Primary, etc.
        if (!colorSystem.Modes['Light-Mode'].Backgrounds[paletteName]) {
          colorSystem.Modes['Light-Mode'].Backgrounds[paletteName] = {};
        }
        if (!colorSystem.Modes['Dark-Mode'].Backgrounds[paletteName]) {
          colorSystem.Modes['Dark-Mode'].Backgrounds[paletteName] = {};
        }
        console.log(`      ✓ Backgrounds.${paletteName} initialized`);
        console.log(`      [DEBUG] Light-Mode.Backgrounds structure:`, Object.keys(colorSystem.Modes['Light-Mode'].Backgrounds));
      } catch (error) {
        console.error(`❌ Error initializing Backgrounds for ${paletteName}:`, error);
        console.error(`   colorSystem.Modes keys:`, Object.keys(colorSystem.Modes));
        throw error;
      }

      // Light Mode - SIMPLIFIED Backgrounds (ONLY surfaces and containers)
      console.log(`      ├─ [JSON Export] Light-Mode/${paletteName}: Generating 14 SIMPLIFIED backgrounds (surfaces/containers only)`);
      lightModeBackgroundTones.forEach((tone, index) => {
        const bgIndex = lightModeBackgroundNumbers[index];
        const toneColor = getToneColor(tone, palette);
        const surfacesAndContainers = generateSimplifiedLightModeBackgrounds(
          toneColor,
          tone,
          palette,
          paletteKey !== 'neutral',
          paletteName, // ✅ Pass palette name to generate token references instead of hex colors
          'tonal' // ✅ Always use tonal mode - Neutral-14 will be handled as special case inside function
        );
        
        // CRITICAL: Check if the function returned a valid result
        if (!surfacesAndContainers) {
          console.error(`❌ CRITICAL: generateSimplifiedLightModeBackgrounds returned undefined!`);
          console.error(`  Tone: ${tone}, ToneColor: ${toneColor}, Palette length: ${palette.length}`);
          throw new Error('generateSimplifiedLightModeBackgrounds returned undefined');
        }
        if (!surfacesAndContainers.Surfaces) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Surfaces is undefined!`);
          console.error(`  Result:`, surfacesAndContainers);
          throw new Error('surfacesAndContainers.Surfaces is undefined');
        }
        if (!surfacesAndContainers.Containers) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Containers is undefined!`);
          console.error(`  Result:`, surfacesAndContainers);
          throw new Error('surfacesAndContainers.Containers is undefined');
        }
        
        // DEEPER VALIDATION: Check if nested properties exist
        if (!surfacesAndContainers.Surfaces.Surface) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Surfaces.Surface is undefined!`);
          console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
          console.error(`  surfacesAndContainers.Surfaces:`, surfacesAndContainers.Surfaces);
          throw new Error(`surfacesAndContainers.Surfaces.Surface is undefined for ${paletteName} Background-${bgIndex}`);
        }
        if (!surfacesAndContainers.Surfaces['Surface-Dim']) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Surfaces['Surface-Dim'] is undefined!`);
          console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
          throw new Error(`surfacesAndContainers.Surfaces['Surface-Dim'] is undefined for ${paletteName} Background-${bgIndex}`);
        }
        if (!surfacesAndContainers.Surfaces['Surface-Bright']) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Surfaces['Surface-Bright'] is undefined!`);
          console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
          throw new Error(`surfacesAndContainers.Surfaces['Surface-Bright'] is undefined for ${paletteName} Background-${bgIndex}`);
        }
        if (!surfacesAndContainers.Containers.Container) {
          console.error(`❌ CRITICAL: surfacesAndContainers.Containers.Container is undefined!`);
          console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
          console.error(`  surfacesAndContainers.Containers:`, surfacesAndContainers.Containers);
          throw new Error(`surfacesAndContainers.Containers.Container is undefined for ${paletteName} Background-${bgIndex}`);
        }
        
        // Defensive: Ensure the entire chain exists
        if (!colorSystem) {
          console.error(`❌ CRITICAL: colorSystem is undefined!`);
          throw new Error('colorSystem is undefined');
        }
        if (!colorSystem.Modes) {
          console.error(`❌ CRITICAL: colorSystem.Modes is undefined!`);
          throw new Error('colorSystem.Modes is undefined');
        }
        if (!colorSystem.Modes['Light-Mode']) {
          console.error(`❌ CRITICAL: Light-Mode is undefined!`);
          throw new Error('Light-Mode mode is undefined');
        }
        
        // CRITICAL FIX: Check if Backgrounds is undefined and recreate it
        if (colorSystem.Modes['Light-Mode'].Backgrounds === undefined) {
          console.error(`❌ CRITICAL ERROR: Light-Mode.Backgrounds is undefined! Creating it...`);
          colorSystem.Modes['Light-Mode'].Backgrounds = {};
        }
        
        console.log(`      Setting Light-Mode.Backgrounds.${paletteName}[Background-${bgIndex}]`);
        console.log(`      Backgrounds.${paletteName} is currently:`, typeof colorSystem.Modes['Light-Mode'].Backgrounds[paletteName]);
        
        // KEEP NESTED STRUCTURE: Surfaces and Containers as separate objects
        const nestedBackground = {
          Surfaces: {
            Surface: surfacesAndContainers.Surfaces.Surface,
            'Surface-Dim': surfacesAndContainers.Surfaces['Surface-Dim'],
            'Surface-Bright': surfacesAndContainers.Surfaces['Surface-Bright'],
          },
          Containers: {
            Container: surfacesAndContainers.Containers.Container,
            'Container-Lowest': surfacesAndContainers.Containers['Container-Lowest'],
            'Container-Low': surfacesAndContainers.Containers['Container-Low'],
            'Container-High': surfacesAndContainers.Containers['Container-High'],
            'Container-Highest': surfacesAndContainers.Containers['Container-Highest'],
          }
        };
        
        // Try-catch the actual assignment
        try {
          // Store reference to ensure it's not lost
          const backgroundsRef = colorSystem.Modes['Light-Mode'].Backgrounds[paletteName];
          if (backgroundsRef === undefined || backgroundsRef === null) {
            console.error(`❌ CRITICAL: Backgrounds.${paletteName} reference is ${backgroundsRef}!`);
            throw new Error(`Backgrounds.${paletteName} reference is ${backgroundsRef}`);
          }
          backgroundsRef[`Background-${bgIndex}`] = nestedBackground;
          console.log(`        ✅ Successfully set Background-${bgIndex}`);
        } catch (assignError) {
          console.error(`❌❌❌ ASSIGNMENT ERROR for Background-${bgIndex}:`, assignError);
          console.error(`   colorSystem exists:`, !!colorSystem);
          console.error(`   colorSystem.Modes exists:`, !!colorSystem?.Modes);
          console.error(`   Light-Mode exists:`, !!colorSystem?.Modes?.['Light-Mode']);
          console.error(`   Backgrounds exists:`, !!colorSystem?.Modes?.['Light-Mode']?.Backgrounds);
          console.error(`   Backgrounds value:`, colorSystem?.Modes?.['Light-Mode']?.Backgrounds);
          throw assignError;
        }

        // Generate Buttons, Icons, and Tags for this background
        const bgKey = `Background-${bgIndex}`;
        
        // Buttons are NOT generated in Modes - they only exist in Themes
        // Icon and Icon-Variant are pre-populated with complete palette structure at initialization
        // Tags are generated once for the entire mode, not per-background
      });

      // Add Background-Vibrant for Light-Mode (SIMPLIFIED)
      const vibrantLMTColor = lightColorVibrant;
      const vibrantLMTTone = isSemanticColor 
        ? (palette.length > 7 ? palette[7].tone : 95)
        : (palette.length > 10 ? palette[10].tone : 95);
      const vibrantLMTSurfacesAndContainers = generateSimplifiedLightModeBackgrounds(
        vibrantLMTColor,
        vibrantLMTTone,
        palette,
        paletteKey !== 'neutral',
        paletteName, // ✅ Pass palette name to generate token references instead of hex colors
        'tonal' // ✅ Always use tonal mode - Neutral-14 will be handled as special case inside function
      );
      
      // CRITICAL: Check if the function returned a valid result
      if (!vibrantLMTSurfacesAndContainers || !vibrantLMTSurfacesAndContainers.Surfaces || !vibrantLMTSurfacesAndContainers.Containers) {
        console.error(`❌ CRITICAL: generateSimplifiedLightModeBackgrounds (vibrant) returned invalid result!`);
        console.error(`  Tone: ${vibrantLMTTone}, Color: ${vibrantLMTColor}, Palette length: ${palette.length}`);
        throw new Error('generateSimplifiedLightModeBackgrounds (vibrant) returned invalid result');
      }
      
      // DEEPER VALIDATION for Vibrant: Check if nested properties exist
      if (!vibrantLMTSurfacesAndContainers.Surfaces.Surface) {
        console.error(`❌ CRITICAL: vibrantLMTSurfacesAndContainers.Surfaces.Surface is undefined!`);
        console.error(`  Palette: ${paletteName}, Tone: ${vibrantLMTTone}`);
        console.error(`  vibrantLMTSurfacesAndContainers.Surfaces:`, vibrantLMTSurfacesAndContainers.Surfaces);
        throw new Error(`vibrantLMTSurfacesAndContainers.Surfaces.Surface is undefined for ${paletteName}`);
      }
      if (!vibrantLMTSurfacesAndContainers.Containers.Container) {
        console.error(`❌ CRITICAL: vibrantLMTSurfacesAndContainers.Containers.Container is undefined!`);
        console.error(`  Palette: ${paletteName}, Tone: ${vibrantLMTTone}`);
        console.error(`  vibrantLMTSurfacesAndContainers.Containers:`, vibrantLMTSurfacesAndContainers.Containers);
        throw new Error(`vibrantLMTSurfacesAndContainers.Containers.Container is undefined for ${paletteName}`);
      }
      
      // Defensive: Ensure the entire chain exists
      if (!colorSystem.Modes['Light-Mode']) {
        console.error(`❌ CRITICAL: Light-Mode is undefined!`);
        throw new Error('Light-Mode mode is undefined');
      }
      
      // CRITICAL FIX: Check if Backgrounds is undefined and recreate it
      if (colorSystem.Modes['Light-Mode'].Backgrounds === undefined) {
        console.error(`❌ CRITICAL ERROR: Light-Mode.Backgrounds is undefined! Creating it...`);
        colorSystem.Modes['Light-Mode'].Backgrounds = {};
      }
      
      console.log(`      Setting Light-Mode.Backgrounds.${paletteName}['Background-Vibrant']`);
      
      // KEEP NESTED STRUCTURE
      const nestedVibrantLMT = {
        Surfaces: {
          Surface: vibrantLMTSurfacesAndContainers.Surfaces.Surface,
          'Surface-Dim': vibrantLMTSurfacesAndContainers.Surfaces['Surface-Dim'],
          'Surface-Bright': vibrantLMTSurfacesAndContainers.Surfaces['Surface-Bright'],
        },
        Containers: {
          Container: vibrantLMTSurfacesAndContainers.Containers.Container,
          'Container-Lowest': vibrantLMTSurfacesAndContainers.Containers['Container-Lowest'],
          'Container-Low': vibrantLMTSurfacesAndContainers.Containers['Container-Low'],
          'Container-High': vibrantLMTSurfacesAndContainers.Containers['Container-High'],
          'Container-Highest': vibrantLMTSurfacesAndContainers.Containers['Container-Highest'],
        }
      };
      
      try {
        const backgroundsRef = colorSystem.Modes['Light-Mode'].Backgrounds[paletteName];
        if (backgroundsRef === undefined || backgroundsRef === null) {
          console.error(`❌ CRITICAL: Backgrounds.${paletteName} reference is ${backgroundsRef}!`);
          throw new Error(`Backgrounds.${paletteName} reference is ${backgroundsRef}`);
        }
        backgroundsRef['Background-Vibrant'] = nestedVibrantLMT;
        console.log(`        ✅ Successfully set Background-Vibrant`);
      } catch (assignError) {
        console.error(`❌❌❌ ASSIGNMENT ERROR for Background-Vibrant in Light-Mode:`, assignError);
        console.error(`   Backgrounds object state:`, colorSystem.Modes['Light-Mode'].Backgrounds);
        throw assignError;
      }
      
      // Generate Buttons, Icons, and Tags for Background-Vibrant Surfaces
      // CRITICAL: Validate vibrantLMTSurfacesAndContainers before accessing
      if (!vibrantLMTSurfacesAndContainers || !vibrantLMTSurfacesAndContainers.Surfaces || !vibrantLMTSurfacesAndContainers.Containers) {
        console.error('❌ vibrantLMTSurfacesAndContainers is invalid before accessing for buttons!');
        console.error('  vibrantLMTSurfacesAndContainers:', vibrantLMTSurfacesAndContainers);
        throw new Error('vibrantLMTSurfacesAndContainers validation failed');
      }
      const vibrantLMTSurfaceColor = vibrantLMTSurfacesAndContainers.Surfaces.Surface.value;
      // REMOVED: colorSystem.Modes['Light-Mode'].Buttons.Surfaces['Background-Vibrant'] = generateButtonsForBackground(
      //   vibrantLMTSurfaceColor,
      //   palette,
      //   {
      //     primary: tonePalettes.primary,
      //     secondary: tonePalettes.secondary,
      //     tertiary: tonePalettes.tertiary,
      //     neutral: tonePalettes.neutral,
      //     info: tonePalettes.info,
      //     success: tonePalettes.success,
      //     warning: tonePalettes.warning,
      //     error: tonePalettes.error
      //   },
      //   false,
      //   'Background-Vibrant',
      //   'Surfaces',
      //   extractedTones
      // );
      
      // Icon and Icon-Variant are now pre-populated with complete palette structure
      // No need to assign by Background-N anymore
      
      // Tags are generated once for the entire mode, not per-background
      
      // Generate Buttons, Icons, and Tags for Background-Vibrant Containers
      const vibrantLMTContainerColor = vibrantLMTSurfacesAndContainers.Containers.Container.value;
      // REMOVED: colorSystem.Modes['Light-Mode'].Buttons.Containers['Background-Vibrant'] = generateButtonsForBackground(
      //   vibrantLMTContainerColor,
      //   palette,
      //   {
      //     primary: tonePalettes.primary,
      //     secondary: tonePalettes.secondary,
      //     tertiary: tonePalettes.tertiary,
      //     neutral: tonePalettes.neutral,
      //     info: tonePalettes.info,
      //     success: tonePalettes.success,
      //     warning: tonePalettes.warning,
      //     error: tonePalettes.error
      //   },
      //   false,
      //   'Background-Vibrant',
      //   'Containers',
      //   extractedTones
      // );
      
      // Icon and Icon-Variant are now pre-populated with complete palette structure
      // No need to assign by Background-N anymore
      
      // Tags are generated once for the entire mode, not per-background

      // Dark Mode - SIMPLIFIED Backgrounds (ONLY surfaces and containers)
      console.log(`      ├─ [JSON Export] Dark-Mode/${paletteName}: Generating 14 SIMPLIFIED backgrounds (surfaces/containers only)`);
      const darkTones = paletteKey === 'neutral' ? darkModeNeutralBackgroundTones : darkModeChromaticBackgroundTones;
      const darkBgNumbers = paletteKey === 'neutral' ? darkModeNeutralBackgroundNumbers : darkModeChromaticBackgroundNumbers;
      
      darkTones.forEach((tone, index) => {
        const bgIndex = darkBgNumbers[index];
        const toneData = darkPalette.find(p => p.tone === tone);
        if (toneData) {
          const surfacesAndContainers = generateSimplifiedDarkModeBackgrounds(
            toneData.color,
            tone,
            darkPalette,
            paletteName // ✅ Pass palette name for dark mode token references
          );
          
          // CRITICAL: Check if the function returned a valid result
          if (!surfacesAndContainers || !surfacesAndContainers.Surfaces || !surfacesAndContainers.Containers) {
            console.error(`❌ CRITICAL: generateSimplifiedDarkModeBackgrounds returned invalid result!`);
            console.error(`  Tone: ${tone}, Color: ${toneData.color}, Palette length: ${darkPalette.length}`);
            throw new Error('generateSimplifiedDarkModeBackgrounds returned invalid result');
          }
          
          // DEEPER VALIDATION for Dark Mode: Check if nested properties exist
          if (!surfacesAndContainers.Surfaces.Surface) {
            console.error(`❌ CRITICAL: surfacesAndContainers.Surfaces.Surface is undefined in Dark Mode!`);
            console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
            console.error(`  surfacesAndContainers.Surfaces:`, surfacesAndContainers.Surfaces);
            throw new Error(`[Dark Mode] surfacesAndContainers.Surfaces.Surface is undefined for ${paletteName} Background-${bgIndex}`);
          }
          if (!surfacesAndContainers.Containers.Container) {
            console.error(`❌ CRITICAL: surfacesAndContainers.Containers.Container is undefined in Dark Mode!`);
            console.error(`  Palette: ${paletteName}, Background: ${bgIndex}, Tone: ${tone}`);
            console.error(`  surfacesAndContainers.Containers:`, surfacesAndContainers.Containers);
            throw new Error(`[Dark Mode] surfacesAndContainers.Containers.Container is undefined for ${paletteName} Background-${bgIndex}`);
          }
          
          // Defensive: Ensure the entire chain exists
          if (!colorSystem.Modes['Dark-Mode']) {
            console.error(`❌ CRITICAL: Dark-Mode is undefined!`);
            throw new Error('Dark-Mode mode is undefined');
          }
          
          // CRITICAL FIX: Check if Backgrounds is undefined and recreate it
          if (colorSystem.Modes['Dark-Mode'].Backgrounds === undefined) {
            console.error(`❌ CRITICAL ERROR: Dark-Mode.Backgrounds is undefined! Creating it...`);
            colorSystem.Modes['Dark-Mode'].Backgrounds = {};
          }
          
          console.log(`      Setting Dark-Mode.Backgrounds.${paletteName}[Background-${bgIndex}]`);
          
          // KEEP NESTED STRUCTURE
          const nestedBackgroundDark = {
            Surfaces: {
              Surface: surfacesAndContainers.Surfaces.Surface,
              'Surface-Dim': surfacesAndContainers.Surfaces['Surface-Dim'],
              'Surface-Bright': surfacesAndContainers.Surfaces['Surface-Bright'],
            },
            Containers: {
              Container: surfacesAndContainers.Containers.Container,
              'Container-Lowest': surfacesAndContainers.Containers['Container-Lowest'],
              'Container-Low': surfacesAndContainers.Containers['Container-Low'],
              'Container-High': surfacesAndContainers.Containers['Container-High'],
              'Container-Highest': surfacesAndContainers.Containers['Container-Highest'],
            }
          };
          
          // Try-catch the actual assignment
          try {
            // Store reference to ensure it's not lost
            const backgroundsRef = colorSystem.Modes['Dark-Mode'].Backgrounds[paletteName];
            if (backgroundsRef === undefined || backgroundsRef === null) {
              console.error(`❌ CRITICAL: Dark Backgrounds.${paletteName} reference is ${backgroundsRef}!`);
              throw new Error(`Dark Backgrounds.${paletteName} reference is ${backgroundsRef}`);
            }
            backgroundsRef[`Background-${bgIndex}`] = nestedBackgroundDark;
            console.log(`        ✅ Successfully set Background-${bgIndex}`);
          } catch (assignError) {
            console.error(`❌❌❌ ASSIGNMENT ERROR for Background-${bgIndex} in Dark-Mode:`, assignError);
            console.error(`   Backgrounds exists:`, !!colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
            console.error(`   Backgrounds value:`, colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
            throw assignError;
          }

          // Generate Buttons, Icons, and Tags for this background
          const bgKey = `Background-${bgIndex}`;
          
          // Buttons are NOT generated in Modes - they only exist in Themes
          // Icon and Icon-Variant are pre-populated with complete palette structure at initialization
          // Tags are generated once for the entire mode, not per-background
        }
      });

      // For chromatic backgrounds (Primary, Secondary, Tertiary) in Dark Mode:
      // Background-9 uses Dark Mode Color-11, Background-Vibrant uses Light Mode Color-9
      if (paletteKey === 'primary' || paletteKey === 'secondary' || paletteKey === 'tertiary') {
        // paletteName is already defined in outer scope
        
        // Get Dark Mode Color-11 (tone 89) for Background-9
        const darkModePalette = colorSystem.Modes['Dark-Mode'].Colors[paletteName];
        const darkModeColor13 = darkModePalette['Color-11'].value;
        
        // Get Light Mode Color-9 (tone 90) for Background-Vibrant
        const lightModePalette = tonePalettes[paletteKey];
        const lightModeColor11 = lightModePalette.length > 10 ? lightModePalette[10].color : '#E5C2D5'; // Color-9 (tone 90)
        
        // Get Light Mode Background-9 Container values (actual hex values, not references)
        const lightModeBg11Containers = colorSystem.Modes['Light-Mode'].Backgrounds[paletteName]['Background-9'].Containers;
        const lightModeContainer = lightModeBg11Containers.Container.value;
        const lightModeContainerLow = lightModeBg11Containers['Container-Low'].value;
        const lightModeContainerLowest = lightModeBg11Containers['Container-Lowest'].value;
        const lightModeContainerHigh = lightModeBg11Containers['Container-High']?.value || lightModeContainer;
        const lightModeContainerHighest = lightModeBg11Containers['Container-Highest']?.value || lightModeContainer;
        
        // Surface-Dim = adjacent tone one step darker, Surface-Bright = one step lighter
        const surfaceDim = darkPalette[10]?.color || '#000000'; // Color-11 dim → Color-10
        const surfaceBright = darkPalette[12]?.color || '#FFFFFF'; // Color-11 bright → Color-12 (or white)
        
        // Calculate Container colors for Background-9
        // For tone 89 in Dark Mode, containers use Color-4 (index 3)
        const containerColor = darkPalette[3]?.color || '#000000'; // Color-4
        
        // Surface-Dim/Bright for Vibrant background — adjacent tones from light palette
        const lightPalette = colorSystem.Modes['Light-Mode']?.Colors ?
          Object.entries(colorSystem.Modes['Light-Mode'].Colors)
            .filter(([k]) => k.startsWith('Color-') && !k.includes('Vibrant'))
            .sort(([a], [b]) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]))
            .map(([, v]: [string, any]) => v.value) : [];
        const vibrantSurfaceDim = lightPalette[8] || lightModeColor11; // Color-9 dim → Color-8 (index 7... but vibrant is Color-9=index 8)
        const vibrantSurfaceBright = lightPalette[10] || '#FFFFFF'; // Color-9 bright → Color-10
        
        // Defensive: Ensure the entire chain exists
        if (!colorSystem.Modes['Dark-Mode']) {
          console.error(`❌ CRITICAL: Dark-Mode is undefined!`);
          throw new Error('Dark-Mode mode is undefined');
        }
        
        // CRITICAL FIX: Check if Backgrounds is undefined and recreate it
        if (colorSystem.Modes['Dark-Mode'].Backgrounds === undefined) {
          console.error(`❌ CRITICAL ERROR: Dark-Mode.Backgrounds is undefined! Creating it...`);
          colorSystem.Modes['Dark-Mode'].Backgrounds = {};
        }
        
        console.log(`      Setting Dark-Mode.Backgrounds.${paletteName}['Background-9'] (special chromatic)`);
        
        // Background-9 uses Dark Mode Color-11 - NESTED structure with Surfaces/Containers
        try {
          const backgroundsRef = colorSystem.Modes['Dark-Mode'].Backgrounds[paletteName];
          if (backgroundsRef === undefined || backgroundsRef === null) {
            console.error(`❌ CRITICAL: Dark-Mode Backgrounds.${paletteName} reference is ${backgroundsRef}!`);
            throw new Error(`Dark-Mode Backgrounds.${paletteName} reference is ${backgroundsRef}`);
          }
          backgroundsRef['Background-9'] = {
            Surfaces: {
              Surface: { value: `{Colors.${paletteName}.Color-11}`, type: 'color' },
              'Surface-Dim': { value: surfaceDim, type: 'color' },
              'Surface-Bright': { value: surfaceBright, type: 'color' },
            },
            Containers: {
              Container: { value: containerColor, type: 'color' },
              'Container-Low': { value: containerColor, type: 'color' },
              'Container-Lowest': { value: containerColor, type: 'color' },
              'Container-High': { value: containerColor, type: 'color' },
              'Container-Highest': { value: containerColor, type: 'color' },
            }
          };
          console.log(`        ✅ Successfully set Background-9 (chromatic)`);
        } catch (assignError) {
          console.error(`❌❌❌ ASSIGNMENT ERROR for Background-9 (chromatic) in Dark-Mode:`, assignError);
          console.error(`   Backgrounds exists:`, !!colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
          console.error(`   Backgrounds value:`, colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
          throw assignError;
        }
        
        
        console.log(`      Setting Dark-Mode.Backgrounds.${paletteName}['Background-Vibrant'] (special chromatic)`);
        
        // Background-Vibrant uses Light Mode Color-9 - NESTED structure with Surfaces/Containers
        // IMPORTANT: Use actual hex values, not references, for Vibrant tokens
        try {
          const backgroundsRef = colorSystem.Modes['Dark-Mode'].Backgrounds[paletteName];
          if (backgroundsRef === undefined || backgroundsRef === null) {
            console.error(`❌ CRITICAL: Dark-Mode Backgrounds.${paletteName} reference is ${backgroundsRef}!`);
            throw new Error(`Dark-Mode Backgrounds.${paletteName} reference is ${backgroundsRef}`);
          }
          backgroundsRef['Background-Vibrant'] = {
            Surfaces: {
              Surface: { value: lightModeColor11, type: 'color' },
              'Surface-Dim': { value: vibrantSurfaceDim, type: 'color' },
              'Surface-Bright': { value: vibrantSurfaceBright, type: 'color' },
            },
            Containers: {
              Container: { value: lightModeContainer, type: 'color' },
              'Container-Low': { value: lightModeContainerLow, type: 'color' },
              'Container-Lowest': { value: lightModeContainerLowest, type: 'color' },
              'Container-High': { value: lightModeContainerHigh, type: 'color' },
              'Container-Highest': { value: lightModeContainerHighest, type: 'color' },
            }
          };
          console.log(`        ✅ Successfully set Background-Vibrant (chromatic)`);
        } catch (assignError) {
          console.error(`❌❌❌ ASSIGNMENT ERROR for Background-Vibrant (chromatic) in Dark-Mode:`, assignError);
          console.error(`   Backgrounds exists:`, !!colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
          console.error(`   Backgrounds value:`, colorSystem?.Modes?.['Dark-Mode']?.Backgrounds);
          throw assignError;
        }
      }
    }
  });

  // Add BW (Black/White) colors to Light-Mode
  console.log('  ├─ [JSON Export] Adding BW (Black/White) palette to Light-Mode');
  colorSystem.Modes['Light-Mode'].Colors['BW'] = {
    'Color-1': { value: '#ffffff', type: 'color' },
    'Color-2': { value: '#ffffff', type: 'color' },
    'Color-3': { value: '#ffffff', type: 'color' },
    'Color-4': { value: '#ffffff', type: 'color' },
    'Color-5': { value: '#ffffff', type: 'color' },
    'Color-6': { value: '#040404', type: 'color' },
    'Color-7': { value: '#040404', type: 'color' },
    'Color-8': { value: '#040404', type: 'color' },
    'Color-9': { value: '#040404', type: 'color' },
    'Color-10': { value: '#040404', type: 'color' },
    'Color-11': { value: '#040404', type: 'color' },
    'Color-12': { value: '#040404', type: 'color' },
    'Color-Vibrant': { value: '#040404', type: 'color' }
  };
  console.log('      ✓ BW palette added: 12 colors + Color-Vibrant');

  // Override all mode-specific structures with fixed structures
  console.log('🎨 [JSON Export] Applying all fixed structures...');
  
  // Light-Mode overrides
  console.log('  ├─ [JSON Export] Applying fixed Light-Mode Header structure');
  colorSystem.Modes['Light-Mode'].Header = lightModeHeaderFixed;
  console.log(`      ✓ Header applied`);
  
  // Icon and Icon-Variant are now pre-populated with correct structure at initialization
  console.log('  ├─ [JSON Export] Icon and Icon-Variant structures already pre-populated');
  console.log(`      [TRACE] About to access Icon.Surfaces (mode-specific)...`);
  console.log(`      [TRACE] Light-Mode Icon exists: ${!!colorSystem.Modes['Light-Mode'].Icon}`);
  console.log(`      [TRACE] Light-Mode Icon.Surfaces exists: ${!!colorSystem.Modes['Light-Mode'].Icon?.Surfaces}`);
  console.log(`      ✓ Light-Mode Icon.Surfaces palettes: ${Object.keys(colorSystem.Modes['Light-Mode'].Icon.Surfaces).length}`);
  
  console.log('  ├─ [JSON Export] Applying fixed Light-Mode Text structure');
  colorSystem.Modes['Light-Mode'].Text = lightModeTextFixed;
  console.log(`      ✓ Text applied: ${Object.keys(lightModeTextFixed).length} sections (Surfaces, Containers)`);
  console.log(`      ✓ Text.Surfaces.Neutral.Color-1 = ${lightModeTextFixed.Surfaces.Neutral['Color-1'].value}`);
  
  // Tag is now generated by the Complete Simplified System
  console.log('  ├─ [JSON Export] Tag structure already generated by Complete Simplified System');

  // Dark-Mode overrides
  console.log('  ├─ [JSON Export] Applying fixed Dark-Mode Header structure');
  colorSystem.Modes['Dark-Mode'].Header = darkModeHeaderFixed;
  console.log(`      ✓ Header applied`);
  
  // Icon and Icon-Variant are now pre-populated with correct structure at initialization
  console.log('  ├─ [JSON Export] Icon and Icon-Variant structures already pre-populated');
  console.log(`      ✓ Dark-Mode Icon.Surfaces palettes: ${Object.keys(colorSystem.Modes['Dark-Mode'].Icon.Surfaces).length}`);
  
  console.log('  ├─ [JSON Export] Applying fixed Dark-Mode Text structure');
  colorSystem.Modes['Dark-Mode'].Text = darkModeTextFixed;
  console.log(`      ✓ Text applied: ${Object.keys(darkModeTextFixed).length} sections (Surfaces, Containers)`);
  console.log(`      ✓ Text.Surfaces.Neutral.Color-1 = ${darkModeTextFixed.Surfaces.Neutral['Color-1'].value}`);
  
  // Tag is now generated by the Complete Simplified System
  console.log('  ├─ [JSON Export] Tag structure already generated by Complete Simplified System');
  
  console.log('  └─ [JSON Export] Applying fixed Dark-Mode Border structure');
  colorSystem.Modes['Dark-Mode']['Border'] = darkModeBorderFixed;
  console.log(`      ✓ Border applied: Surfaces has ${Object.keys(darkModeBorderFixed.Surfaces || {}).length} palettes`);
  console.log(`      ✓ Border applied: Containers has ${Object.keys(darkModeBorderFixed.Containers || {}).length} palettes`);

  // Patch Dark Mode Vibrant tokens with actual Light Mode Color-9 hex values
  console.log('🎨 [JSON Export] Patching Dark-Mode Color-Vibrant tokens with Light-Mode Color-9 hex values...');
  const palettesToPatch = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'BW', 'Info', 'Success', 'Warning', 'Error', 'Hotlink-Visited'];
  palettesToPatch.forEach(paletteName => {
    const lightModeColor11 = colorSystem.Modes['Light-Mode'].Colors[paletteName]?.['Color-9']?.value;
    if (lightModeColor11) {
      // Patch Header
      if (colorSystem.Modes['Dark-Mode'].Header?.Surfaces?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Header.Surfaces[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
      if (colorSystem.Modes['Dark-Mode'].Header?.Containers?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Header.Containers[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
      
      // Patch Text
      if (colorSystem.Modes['Dark-Mode'].Text?.Surfaces?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Text.Surfaces[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
      if (colorSystem.Modes['Dark-Mode'].Text?.Containers?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Text.Containers[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
      
      // Patch Quiet
      if (colorSystem.Modes['Dark-Mode'].Quiet?.Surfaces?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Quiet.Surfaces[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
      if (colorSystem.Modes['Dark-Mode'].Quiet?.Containers?.[paletteName]) {
        colorSystem.Modes['Dark-Mode'].Quiet.Containers[paletteName]['Color-Vibrant'] = { value: lightModeColor11, type: 'color' };
      }
    }
  });
  console.log(`      ✓ Patched Color-Vibrant values for ${palettesToPatch.length} palettes`);

  // Add utility colors to each mode
  console.log('🎨 [JSON Export] Adding utility colors to all modes...');
  
  // Light Mode utility colors
  colorSystem.Modes['Light-Mode'].Colors['White'] = {
    value: '#ffffff',  // Pure white in light mode (no transparency)
    type: 'color'
  };
  colorSystem.Modes['Light-Mode'].Colors['Image-Overlay'] = {
    value: '#00000000',
    type: 'color'
  };
  colorSystem.Modes['Light-Mode'].Colors['Transparent'] = {
    value: '#ffffff00',
    type: 'color'
  };
  
  // Dark Mode utility colors — white at 70% opacity. Used as the canonical
  // "white" reference for text and any UI that needs a softened white
  // against dark backgrounds (full #ffffff against #0d0d0d reads as harsh).
  // 0xB3 / 255 ≈ 0.702.
  colorSystem.Modes['Dark-Mode'].Colors['White'] = {
    value: '#ffffffb3',
    type: 'color'
  };
  // 30% black overlay for images in dark mode (#0000004D = 0x4D / 255 ≈ 0.30).
  // Light mode stays fully transparent — overlay is only applied when the
  // image needs to be visually muted against a darker UI.
  colorSystem.Modes['Dark-Mode'].Colors['Image-Overlay'] = {
    value: '#0000004D',
    type: 'color'
  };
  colorSystem.Modes['Dark-Mode'].Colors['Transparent'] = {
    value: '#00000000',
    type: 'color'
  };
  
  console.log('  ✓ [JSON Export] Utility colors added (White, Image-Overlay, Transparent)');

  // REMOVED: Text color generation - now using fixed structures applied earlier (lines 3395, 3401, 3417)
  console.log('  ✓ [JSON Export] Text colors using fixed structures (applied earlier)');

  // Generate Button-Border for all modes
  const generateButtonBorder = () => {
    const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];
    const buttonBorder: any = {
      Surfaces: {},
      Containers: {}
    };

    palettes.forEach(palette => {
      const colorRef = palette;
      
      buttonBorder.Surfaces[palette] = {
        'Color-1': { value: `{Colors.${colorRef}.Color-6}`, type: 'color' },
        'Color-2': { value: `{Colors.${colorRef}.Color-6}`, type: 'color' },
        'Color-3': { value: `{Colors.${colorRef}.Color-7}`, type: 'color' },
        'Color-4': { value: `{Colors.${colorRef}.Color-9}`, type: 'color' },
        'Color-5': { value: `{Colors.${colorRef}.Color-10}`, type: 'color' },
        'Color-6': { value: `{Colors.${colorRef}.Color-2}`, type: 'color' },
        'Color-7': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-8': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-9': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-10': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-11': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-12': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-Vibrant': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' }
      };

      buttonBorder.Containers[palette] = {
        'Color-1': { value: `{Colors.${colorRef}.Color-6}`, type: 'color' },
        'Color-2': { value: `{Colors.${colorRef}.Color-6}`, type: 'color' },
        'Color-3': { value: `{Colors.${colorRef}.Color-7}`, type: 'color' },
        'Color-4': { value: `{Colors.${colorRef}.Color-9}`, type: 'color' },
        'Color-5': { value: `{Colors.${colorRef}.Color-10}`, type: 'color' },
        'Color-6': { value: `{Colors.${colorRef}.Color-2}`, type: 'color' },
        'Color-7': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-8': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-9': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-10': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-11': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-12': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' },
        'Color-Vibrant': { value: `{Colors.${colorRef}.Color-5}`, type: 'color' }
      };
    });

    return buttonBorder;
  };

  colorSystem.Modes['Light-Mode']['Border'] = generateButtonBorder();
  // Dark-Mode Border uses fixed structure (applied earlier)
  
  console.log('  ✓ [JSON Export] Border generated for Light modes (Dark-Mode uses fixed structure)');

  // Generate Charts for all modes (placeholder - will be populated with actual chart data per background)
  const generateCharts = () => {
    return {
      Surfaces: {},
      Containers: {}
    };
  };

  colorSystem.Modes['Light-Mode'].Charts = generateCharts();
  colorSystem.Modes['Dark-Mode'].Charts = generateCharts();
  
  console.log('  ✓ [JSON Export] Charts initialized for all modes');

  // REMOVED: Theme should NOT be inside Modes - it's a top-level sibling to Modes
  // Theme variants are in colorSystem.Themes (plural, top-level)
  // NOT in colorSystem.Modes['Light-Mode'].Theme
  
  /*
  console.log('🎭 [JSON Export] Generating themes for all modes...');
  colorSystem.Modes['Light-Mode'].Theme = {
    'Neutral-Default': createThemeReference('Light-Mode', 'neutral', 12),
    'Neutral-Base': createThemeReference('Light-Mode', 'neutral', 11),
    'Primary-Default': createThemeReference('Light-Mode', 'primary', 11),
    'Primary-Base': createThemeReference('Light-Mode', 'primary', 11),
    'Secondary-Default': createThemeReference('Light-Mode', 'secondary', 11),
    'Secondary-Base': createThemeReference('Light-Mode', 'secondary', 11),
    'Tertiary-Default': createThemeReference('Light-Mode', 'tertiary', 11),
    'Tertiary-Base': createThemeReference('Light-Mode', 'tertiary', 11)
  };

  colorSystem.Modes['Dark-Mode'].Theme = {
    'Neutral-Default': createThemeReference('Dark-Mode', 'neutral', 12),
    'Neutral-Base': createThemeReference('Dark-Mode', 'neutral', 11),
    'Primary-Default': createThemeReference('Dark-Mode', 'primary', 11),
    'Primary-Base': createThemeReference('Dark-Mode', 'primary', 11),
    'Secondary-Default': createThemeReference('Dark-Mode', 'secondary', 11),
    'Secondary-Base': createThemeReference('Dark-Mode', 'secondary', 11),
    'Tertiary-Default': createThemeReference('Dark-Mode', 'tertiary', 11),
    'Tertiary-Base': createThemeReference('Dark-Mode', 'tertiary', 11)
  };
  */

  // REMOVED: Primary-Buttons generation section - no longer in Modes
  // Calculate Primary Color-N from extracted tones (REMOVED - was used for Primary-Fixed buttons)
  // const primaryN = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 11;
  // console.log(`🔘 [Primary-Buttons] Using Primary Color-${primaryN} for Primary-Fixed buttons (tone: ${extractedTones?.primary || 'default'})`);
  
  /*
  const backgroundNames = ['Background-1', 'Background-2', 'Background-3', 'Background-4', 'Background-5', 
                           'Background-6', 'Background-7', 'Background-6', 'Background-7', 'Background-8', 
                           'Background-9', 'Background-10', 'Background-11', 'Background-12', 'Background-Vibrant'];

  // Helper function to convert button color reference to Hover/Pressed references
  const getHoverActiveReferences = (buttonColorValue: string) => {
    // Extract the color reference from button value
    // Examples: 
    // - "{Primary.Color-9}" → Hover: "{Hover.Primary.Color-9}", Pressed: "{Pressed.Primary.Color-9}"
    // - "{Colors.Primary.Color-6}" → Hover: "{Hover.Primary.Color-6}", Pressed: "{Pressed.Primary.Color-6}"
    // - "#FFFFFF" (White) → Hover: "{Hover.Neutral.Color-11}", Pressed: "{Pressed.Neutral.Color-11}"
    // - "#000000" (Black) → Hover: "{Hover.Neutral.Color-1}", Pressed: "{Pressed.Neutral.Color-1}"
    
    let hover = '';
    let active = '';
    
    if (buttonColorValue === '#FFFFFF' || buttonColorValue === '#ffffff') {
      // White button → use Neutral Color-11
      hover = '{Hover.Neutral.Color-11}';
      active = '{Pressed.Neutral.Color-11}';
    } else if (buttonColorValue === '#000000' || buttonColorValue === '#000') {
      // Black button → use Neutral Color-1
      hover = '{Hover.Neutral.Color-1}';
      active = '{Pressed.Neutral.Color-1}';
    } else if (buttonColorValue.includes('{')) {
      // Extract palette and color from reference
      // Remove curly braces and "Colors." prefix if present
      let ref = buttonColorValue.replace(/[{}]/g, '');
      ref = ref.replace('Colors.', '');
      
      // ref is now like "Primary.Color-9" or "Neutral.Color-5"
      const parts = ref.split('.');
      if (parts.length >= 2) {
        const palette = parts[0]; // "Primary", "Secondary", "Neutral", etc.
        const colorNum = parts[1]; // "Color-9", "Color-5", etc.
        
        hover = `{Hover.${palette}.${colorNum}}`;
        active = `{Pressed.${palette}.${colorNum}}`;
      }
    }
    
    return { hover, active };
  };

  // Helper function to generate button styles for a specific mode and style type
  const generateButtonStyle = (
    mode: 'Light-Mode' | 'Dark-Mode',
    style: 'Primary-Adaptive' | 'Primary-Fixed' | 'Black-White',
    surfaceOrContainer: 'Surfaces' | 'Containers'
  ) => {
    const result: { [bgName: string]: PrimaryButtonForBackground } = {};

    backgroundNames.forEach(bgName => {
      const bgNumber = bgName === 'Background-Vibrant' ? 11 : parseInt(bgName.split('-')[1]);

      // PRIMARY-ADAPTIVE STYLE (formerly Primary-Tonal)
      // Containers use the exact same values as Surfaces
      if (style === 'Primary-Adaptive') {
        if (mode === 'Light-Mode') {
          // Light-Mode: Adaptive button colors per background
          // Special case for Background-9 and Background-Vibrant (both Surfaces and Containers)
          if (bgNumber === 11 || bgName === 'Background-Vibrant') {
            const buttonColor = '{Colors.Primary.Color-6}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-3}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          } else {
            const tonalConfig: { [key: number]: { button: string; text: string } } = {
              1: { button: '{Colors.Primary.Color-9}', text: `{Text.${surfaceOrContainer}.Primary.Color-9}` },
              2: { button: '{Colors.Primary.Color-9}', text: `{Text.${surfaceOrContainer}.Primary.Color-5}` },
              3: { button: '{Colors.Primary.Color-9}', text: `{Text.${surfaceOrContainer}.Primary.Color-5}` },
              4: { button: '{Colors.Primary.Color-3}', text: `{Text.${surfaceOrContainer}.Primary.Color-9}` },
              5: { button: '{Colors.Primary.Color-3}', text: `{Text.${surfaceOrContainer}.Primary.Color-9}` },
              6: { button: '{Colors.Primary.Color-4}', text: `{Text.${surfaceOrContainer}.Primary.Color-8}` },
              7: { button: '{Colors.Primary.Color-4}', text: `{Text.${surfaceOrContainer}.Primary.Color-8}` },
              8: { button: '{Colors.Primary.Color-5}', text: `{Text.${surfaceOrContainer}.Primary.Color-9}` },
              9: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-10}` },
              10: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` },
              11: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` },
              12: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` },
              13: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` },
              14: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` }
            };
            const config = tonalConfig[bgNumber];
            if (!config) {
              console.warn(`⚠️ No tonal config for bgNumber ${bgNumber}, skipping ${bgName}`);
              return;
            }
            const { hover, active } = getHoverActiveReferences(config.button);
            result[bgName] = {
              Button: { value: config.button, type: 'color' },
              Text: { value: config.text, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          }
        } else if (mode === 'Dark-Mode') {
          // Dark-Mode: Adaptive pattern for dark backgrounds
          // Special case for Background-9 and Background-Vibrant (both Surfaces and Containers)
          if (bgNumber === 11 || bgName === 'Background-Vibrant') {
            const buttonColor = '{Colors.Primary.Color-7}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-11}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          } else {
            const darkConfig: { [key: number]: { button: string; text: string } } = {
              1: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              2: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              3: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              4: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              5: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              6: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              7: { button: '{Colors.Primary.Color-9}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              8: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              9: { button: '{Colors.Primary.Color-6}', text: `{Text.${surfaceOrContainer}.Primary.Color-2}` },
              10: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              11: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              12: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              13: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` },
              14: { button: '{Colors.Primary.Color-7}', text: `{Text.${surfaceOrContainer}.Primary.Color-3}` }
            };
            const config = darkConfig[bgNumber];
            if (!config) {
              console.warn(`⚠️ No dark config for bgNumber ${bgNumber}, skipping ${bgName}`);
              return;
            }
            const { hover, active } = getHoverActiveReferences(config.button);
            result[bgName] = {
              Button: { value: config.button, type: 'color' },
              Text: { value: config.text, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          }
        }
      }

      // PRIMARY-FIXED STYLE
      else if (style === 'Primary-Fixed') {
        if (mode === 'Light-Mode') {
          // Light mode uses the extracted Primary Color-N
          // Text references Text.Primary.Color-N
          
          const buttonColor = `{Colors.Primary.Color-${primaryN}}`;
          const { hover, active } = getHoverActiveReferences(buttonColor);
          result[bgName] = {
            Button: { value: buttonColor, type: 'color' },
            Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-${primaryN}}`, type: 'color' },
            Hover: { value: hover, type: 'color' },
            Pressed: { value: active, type: 'color' }
          };
        } else if (mode === 'Dark-Mode') {
          // Dark mode uses the extracted Primary Color-N
          // Text references Text.Primary.Color-N
          
          const buttonColor = `{Colors.Primary.Color-${primaryN}}`;
          const { hover, active } = getHoverActiveReferences(buttonColor);
          result[bgName] = {
            Button: { value: buttonColor, type: 'color' },
            Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-${primaryN}}`, type: 'color' },
            Hover: { value: hover, type: 'color' },
            Pressed: { value: active, type: 'color' }
          };
        }
      }

      // BLACK-WHITE STYLE
      else if (style === 'Black-White') {
        if (mode === 'Light-Mode') {
          if (surfaceOrContainer === 'Surfaces' || (surfaceOrContainer === 'Containers' && bgNumber <= 4)) {
            // Surfaces and Containers Background-1 to 4: White button with black text
            const buttonColor = '{Colors.White}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.Neutral.Color-1}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          } else {
            // Containers Background-5 to Vibrant: Black button with white text
            const buttonColor = '{Colors.Neutral.Color-1}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.White}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          }
        } else if (mode === 'Dark-Mode') {
          if (bgNumber <= 7) {
            // Background-1 to 7: Light button with dark text
            const buttonColor = '{Colors.Primary.Color-11}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-2}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          } else {
            // Background-6 to Vibrant: Dark button with light text
            const buttonColor = '{Colors.Primary.Color-2}';
            const { hover, active } = getHoverActiveReferences(buttonColor);
            result[bgName] = {
              Button: { value: buttonColor, type: 'color' },
              Text: { value: `{Text.${surfaceOrContainer}.Primary.Color-11}`, type: 'color' },
              Hover: { value: hover, type: 'color' },
              Pressed: { value: active, type: 'color' }
            };
          }
        }
      }
    });

    return result;
  };
  */

  // Generate all three styles for each mode
  // const modes: Array<'Light-Mode' | 'Dark-Mode'> = [
  //   'Light-Mode',
  //   'Dark-Mode'
  // ];

  // REMOVED: console.log(`🔘 [JSON Export] Generating Primary-Buttons styles (Selected: ${buttonStyle})...`);
  // REMOVED: modes.forEach(mode => {
  //   // Primary-Adaptive
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Primary-Adaptive'].Surfaces = 
  //     generateButtonStyle(mode, 'Primary-Adaptive', 'Surfaces');
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Primary-Adaptive'].Containers = 
  //     generateButtonStyle(mode, 'Primary-Adaptive', 'Containers');
  // 
  //   // Primary-Fixed
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Primary-Fixed'].Surfaces = 
  //     generateButtonStyle(mode, 'Primary-Fixed', 'Surfaces');
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Primary-Fixed'].Containers = 
  //     generateButtonStyle(mode, 'Primary-Fixed', 'Containers');
  // 
  //   // Black-White
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Black-White'].Surfaces = 
  //     generateButtonStyle(mode, 'Black-White', 'Surfaces');
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons']['Black-White'].Containers = 
  //     generateButtonStyle(mode, 'Black-White', 'Containers');
  // });

  // Set Default to the selected buttonStyle
  // REMOVED: console.log(`🔘 [JSON Export] Setting Default Primary-Buttons to: ${buttonStyle}`);
  // REMOVED: modes.forEach(mode => {
  //   let selectedStyle: 'Primary-Adaptive' | 'Primary-Fixed' | 'Black-White';
  //   switch (buttonStyle) {
  //     case 'primary-adaptive':
  //       selectedStyle = 'Primary-Adaptive';
  //       break;
  //     case 'primary-fixed':
  //       selectedStyle = 'Primary-Fixed';
  //       break;
  //     case 'black-white':
  //       selectedStyle = 'Black-White';
  //       break;
  //     default:
  //       selectedStyle = 'Primary-Adaptive';
  //   }
  //   
  //   // REMOVED: colorSystem.Modes[mode]['Primary-Buttons'].Default = {
  //     // REMOVED: Surfaces: colorSystem.Modes[mode]['Primary-Buttons'][selectedStyle].Surfaces,
  //     // REMOVED: Containers: colorSystem.Modes[mode]['Primary-Buttons'][selectedStyle].Containers
  //   };
  // });

  // REMOVED: Theme-Colors section (no longer part of the design system structure)
  
  // ========================================
  // Generate Complete Simplified System (Themes, Default-Button, Buttons, Tag)
  // ========================================
  console.log('🎨 [JSON Export] Generating Complete Simplified System for Light-Mode and Dark-Mode...');
  console.log('   Sections: Themes, Default-Button, Buttons, Tag');
  
  // Parse user selections to match the expected format
  const parsedUserSelections = userSelections ? {
    background: userSelections.background,
    appBar: userSelections.appBar,
    navBar: userSelections.navBar,
    status: userSelections.status,
    button: userSelections.button,
    textColoring: userSelections.textColoring,
    cardColoring: userSelections.cardColoring // CRITICAL FIX: Pass cardColoring to generateCompleteSimplifiedSystem
  } : undefined;
  
  // Generate for both modes
  const modesForSystem: Array<'Light-Mode' | 'Dark-Mode'> = ['Light-Mode', 'Dark-Mode'];
  
  console.log('🔍 [exportColorSystem] parsedUserSelections before generateCompleteSimplifiedSystem:', parsedUserSelections);
  
  modesForSystem.forEach(mode => {
    const system = generateCompleteSimplifiedSystem(
      mode,
      extractedTones!,
      surfaceStyle!,
      schemeType!,
      parsedUserSelections
    );
    
    // Add all sections to the mode
    colorSystem.Modes[mode].Themes = system.Themes;
    colorSystem.Modes[mode]['Default-Button'] = system['Default-Button'];
    colorSystem.Modes[mode].Buttons = system.Buttons;
    colorSystem.Modes[mode].Tag = system.Tag;
    colorSystem.Modes[mode]['Default-Button-Border'] = system['Default-Button-Border'];
    
    console.log(`  ├─ Generated ${mode}/Themes (${Object.keys(system.Themes).length} themes: Default, App-Bar, Nav-Bar, Status, and variants)`);
    console.log(`  ├─ Generated ${mode}/Buttons (9 base button types)`);
    console.log(`  ├─ Generated ${mode}/Default-Button (9 button references)`);
    console.log(`  ├─ Generated ${mode}/Tag (9 tag types)`);
    console.log(`  └─ Generated ${mode}/Default-Button-Border (9 theme types with Surfaces & Containers)`);
  });
  
  console.log('  ✓ [JSON Export] Complete Simplified System generated for both modes');

  // ========================================
  // Add Dropshadow-Color to every theme's Surfaces and Containers
  // Dropshadow = same hue/chroma, L × 0.625
  // ========================================
  console.log('🎨 [JSON Export] Adding Dropshadow-Color to all themes...');
  const computeDropshadow = (hex: string, lightOffset = -35, satMultiplier = 1.25): string => {
    try {
      const clean = hex.replace('#', '');
      const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const n = parseInt(full, 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      // RGB → HSL
      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h /= 6;
      }
      const hDeg = h * 360, sPct = s * 100, lPct = l * 100;
      // Apply offsets
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const newS = clamp(sPct * satMultiplier, 0, 100);
      // Floor at 40% of original lightness so dark colors don't collapse to near-black
      const minL = Math.max(8, lPct * 0.4);
      const newL = clamp(lPct + lightOffset, minL, 92);
      // HSL → RGB
      const s2 = newS / 100, l2 = newL / 100, h2 = hDeg / 360;
      let sr: number, sg: number, sb: number;
      if (s2 === 0) {
        sr = sg = sb = Math.round(l2 * 255);
      } else {
        const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
        const p = 2 * l2 - q;
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        sr = Math.round(hue2rgb(p, q, h2 + 1/3) * 255);
        sg = Math.round(hue2rgb(p, q, h2) * 255);
        sb = Math.round(hue2rgb(p, q, h2 - 1/3) * 255);
      }
      return `${sr}, ${sg}, ${sb}`;
    } catch {
      return '0, 0, 0';
    }
  };

  // Dropshadow-Color uses the SHARED goldilocks math (../dropshadow), which
  // always darkens proportionally to the surface — the darker the surface, the
  // darker the shadow — with NO "keep it light so dark colors don't collapse"
  // floor. (computeDropshadow above is kept ONLY for the bevel highlight/lowlight,
  // which legitimately need a lighter/additive offset.) Returns an "r, g, b"
  // triple to match the rgba(var(--Dropshadow-Color), α) consumers.
  const computeDropshadowRGB = (hex: string): string => {
    try {
      const c = dropshadowBaseHex(hex).replace('#', '');
      const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
      return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    } catch {
      return '0, 0, 0';
    }
  };

  // Lowlight: same hue, slightly *reduced* chroma (so it reads as a shadow,
  // not a more-saturated glow), and a stronger darkening offset. Saturated
  // semantic palettes (Info/Success/Warning/Error) had bevels reading as a
  // bottom-edge glow at the old (-15, 1.2) values — the chroma boost pushed
  // the lowlight to a vibrant sibling of the body, and only -15 in lightness
  // wasn't enough contrast to read as a recessed shadow.
  const computeLowlight = (hex: string): string => computeDropshadow(hex, -30, 0.85);

  // Highlight: same hue, lower chroma, lighter. Keep chroma reduction so the
  // highlight reads as a washed-out tint, not a saturated overlay.
  const computeHighlight = (hex: string): string => computeDropshadow(hex, 25, 0.7);

  const resolveColorToken = (tokenValue: string, modeColors: any, modeBackgrounds: any): string | null => {
    if (!tokenValue) return null;
    // Match {Colors.Palette.Color-N}
    let match = tokenValue.match(/\{Colors\.(\w+)\.Color-(\d+)\}/);
    if (match) {
      return modeColors?.[match[1]]?.['Color-' + match[2]]?.value || null;
    }
    // Match {Backgrounds.Palette.Background-N.Surfaces.Surface}
    match = tokenValue.match(/\{Backgrounds\.(\w+)\.Background-(\d+)\.Surfaces\.Surface\}/);
    if (match) {
      return modeBackgrounds?.[match[1]]?.['Background-' + match[2]]?.Surfaces?.Surface?.value || null;
    }
    // Match {Backgrounds.Palette.Background-N.Surfaces.Surface-Dim}
    match = tokenValue.match(/\{Backgrounds\.(\w+)\.Background-(\d+)\.Surfaces\.(Surface-\w+)\}/);
    if (match) {
      return modeBackgrounds?.[match[1]]?.['Background-' + match[2]]?.Surfaces?.[match[3]]?.value || null;
    }
    // Match {Backgrounds.Palette.Background-N.Containers.Container}
    match = tokenValue.match(/\{Backgrounds\.(\w+)\.Background-(\d+)\.Containers\.(Container[\w-]*)\}/);
    if (match) {
      return modeBackgrounds?.[match[1]]?.['Background-' + match[2]]?.Containers?.[match[3]]?.value || null;
    }
    // Direct hex
    if (tokenValue.startsWith('#')) return tokenValue;
    return null;
  };

  modesForSystem.forEach(mode => {
    const themes = (colorSystem.Modes[mode] as any).Themes;
    const colors = (colorSystem.Modes[mode] as any).Colors;
    const backgrounds = (colorSystem.Modes[mode] as any).Backgrounds;
    if (!themes) { console.log(`  ⚠️ No themes found for ${mode}`); return; }

    // Shared helpers for the 4.5-enforcement passes below.
    const tonesForMode: any = mode === 'Dark-Mode' ? darkModeTonePalettes : tonePalettes;
    const isDarkMode = mode === 'Dark-Mode';
    const modeTree = colorSystem.Modes[mode] as any;
    const deepResolve = (v: any, depth = 0): string | null => {
      if (depth > 8 || typeof v !== 'string') return null;
      if (v.startsWith('#')) return v;
      if (!v.startsWith('{') || !v.endsWith('}')) return null;
      let node: any = modeTree;
      for (const part of v.slice(1, -1).split('.')) {
        if (node == null) return null;
        node = node[part];
      }
      if (node == null) return null;
      const nv = typeof node === 'object' && 'value' in node ? node.value : node;
      if (typeof nv !== 'string') return null;
      return nv.startsWith('{') ? deepResolve(nv, depth + 1) : nv;
    };
    const CONTRAST_PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];

    // ── Enforce 4.5 contrast on Tag-Text vs its own Tag-BG ──────────────────
    // Tag-Text must clear WCAG AA (4.5) against the tag's colored background.
    // The generator points Tag-Text at the static Text.Surfaces table, which
    // isn't guaranteed to pass on every palette tone. Resolve each tag's BG +
    // current Text to hex: if the pair already clears 4.5 keep the tuned value,
    // otherwise recompute an accessible one. Black-white text mode (Text refs
    // .Surfaces.BW.) stays black/white; tonal mode uses findColorWithContrast
    // against the tag's own palette. (Tag-BG itself carries no contrast rule.)
    const tagSection = (colorSystem.Modes[mode] as any).Tag;
    if (tagSection) {
      for (const shade of ['Light', 'Medium']) {
        for (const P of CONTRAST_PALETTES) {
          const entry = tagSection?.[shade]?.[P];
          const textNode = entry?.Text?.[P];
          if (!entry || !textNode) continue;
          const bgHex = deepResolve(entry.BG?.value);
          if (!bgHex) continue;
          const curHex = deepResolve(textNode.value);
          if (curHex && getContrastRatio(bgHex, curHex) >= 4.5) continue; // already accessible — keep tuned value
          const isBWText = typeof textNode.value === 'string' && /\.Surfaces\.BW\./.test(textNode.value);
          if (isBWText) {
            textNode.value = getContrastRatio(bgHex, '#000000') >= getContrastRatio(bgHex, '#ffffff') ? '#000000' : '#ffffff';
          } else {
            const pal = tonesForMode?.[P.toLowerCase()];
            if (!pal) continue;
            textNode.value = findColorWithContrast(bgHex, pal, 4.5, isDarkMode);
          }
        }
      }
    }

    // ── Enforce 4.5 contrast on button / chip text vs the button fill ───────
    // The lib Button + Chip render --Buttons-{C}-Text on --Buttons-{C}-Button,
    // and --Buttons-{C}-Text resolves through --Text-Surfaces-{palette}-Color-N
    // (the fill is Colors.{palette}.Color-N). So the rendered contrast is
    // Text.Surfaces[palette][N] vs Colors[palette][N] — enforce that pairing.
    // Keep the tuned static value where it already clears 4.5; only recompute
    // genuine failures. Fixing the shared Text.Surfaces cell also hardens
    // surface text at the same tone (same contract: text on Color-N).
    const textSurfaces = modeTree?.Text?.Surfaces;
    if (textSurfaces && colors) {
      for (const P of CONTRAST_PALETTES) {
        const pal = tonesForMode?.[P.toLowerCase()];
        const cells = textSurfaces[P];
        if (!pal || !cells) continue;
        for (let n = 1; n <= 12; n++) {
          const cell = cells[`Color-${n}`];
          const fillHex = deepResolve(colors[P]?.[`Color-${n}`]?.value);
          if (!cell || !fillHex) continue;
          const curHex = deepResolve(cell.value);
          if (curHex && getContrastRatio(fillHex, curHex) >= 4.5) continue; // keep tuned value
          cell.value = findColorWithContrast(fillHex, pal, 4.5, isDarkMode);
        }
      }
    }

    console.log(`  🔍 Processing ${Object.keys(themes).length} themes for ${mode}`);
    console.log(`  🔍 Colors palettes available: ${colors ? Object.keys(colors).join(', ') : 'NONE'}`);
    console.log(`  🔍 Backgrounds available: ${backgrounds ? Object.keys(backgrounds).join(', ') : 'NONE'}`);

    Object.keys(themes).forEach(themeName => {
      const theme = themes[themeName];

      // Helper: resolve a theme token's Border to hex, then compute Border-Variant (15% opacity)
      const resolveBorderVariant = (sectionData: any) => {
        const borderToken = sectionData?.Border?.value;
        if (!borderToken) return;
        // Border token is like "{Border.Surfaces.Neutral.Color-11}" — resolve through color ref
        const borderResolved = resolveColorToken(borderToken, colors, backgrounds);
        if (borderResolved) {
          // Border-Variant = border color at 15% opacity (26) as 8-digit hex
          sectionData['Border-Variant'] = { value: `${borderResolved}26`, type: 'color' };
        } else {
          // Try to resolve via the intermediate: navigate the token path through modeData
          const path = borderToken.replace(/[{}]/g, '').split('.');
          let current: any = (colorSystem.Modes[mode] as any);
          for (const part of path) {
            if (!current || typeof current !== 'object') { current = null; break; }
            current = current[part];
          }
          if (current?.value) {
            const innerHex = resolveColorToken(current.value, colors, backgrounds);
            if (innerHex) {
              sectionData['Border-Variant'] = { value: `${innerHex}26`, type: 'color' };
            }
          }
        }
      };

      // Helper: resolve any token to hex by following the full chain
      const resolveToHex = (tokenValue: string): string | null => {
        if (!tokenValue) return null;
        if (tokenValue.startsWith('#')) return tokenValue;

        // Try resolveColorToken first
        let hex = resolveColorToken(tokenValue, colors, backgrounds);
        if (hex) return hex;

        // Navigate the modeData by token path
        const path = tokenValue.replace(/[{}]/g, '').split('.');
        let current: any = (colorSystem.Modes[mode] as any);
        for (const part of path) {
          if (!current || typeof current !== 'object') { current = null; break; }
          current = current[part];
        }
        if (current?.value) {
          if (current.value.startsWith('#')) return current.value;
          // One more level
          hex = resolveColorToken(current.value, colors, backgrounds);
          if (hex) return hex;
          // Navigate again
          const innerPath = current.value.replace(/[{}]/g, '').split('.');
          let inner: any = (colorSystem.Modes[mode] as any);
          for (const part of innerPath) {
            if (!inner || typeof inner !== 'object') { inner = null; break; }
            inner = inner[part];
          }
          if (inner?.value && inner.value.startsWith('#')) return inner.value;
        }
        return null;
      };

      // Add Dropshadow-Color and Border-Variant to all sections
      const allThemeSections = ['Surfaces', 'Surfaces-Dim', 'Surfaces-Dimmest', 'Surfaces-Bright', 'Containers'];
      allThemeSections.forEach(section => {
        const sectionData = theme[section];
        if (!sectionData) return;

        // Find the background token for this section
        let bgToken: string | null = null;
        if (section === 'Containers') {
          bgToken = sectionData.Container?.value;
        } else {
          bgToken = sectionData.Surface?.value || sectionData.Background?.value;
        }

        if (bgToken) {
          const hex = resolveToHex(bgToken);
          if (hex) {
            sectionData['Dropshadow-Color'] = { value: computeDropshadowRGB(hex), type: 'color' };
          }
        }

        // Border-Variant
        resolveBorderVariant(sectionData);
      });
      // Add Highlight and Lowlight to each button theme
      // Resolve button color: token is like "{Buttons.Primary.Medium.Button}"
      // Navigate modeData.Buttons.Primary to find button hex, or resolve through the chain
      const resolveButtonHex = (btnToken: string): string | null => {
        if (!btnToken) return null;
        // Direct hex
        if (btnToken.startsWith('#')) return btnToken;
        // Try resolveColorToken first
        let hex = resolveColorToken(btnToken, colors, backgrounds);
        if (hex) return hex;
        // Parse token like "{Buttons.Primary.Medium.Button}" and resolve via Buttons section
        const btnMatch = btnToken.replace(/[{}]/g, '').match(/^Buttons\.(\w+)\.(\w+)\.Button$/);
        if (btnMatch) {
          const [, palette, shade] = btnMatch;
          // The Buttons section in mode has Surfaces/Containers with Background-N keys
          // Each entry has a Button.value that references Colors
          const modeBtns = (colorSystem.Modes[mode] as any).Buttons?.[palette];
          if (modeBtns) {
            // Try Surfaces first, then Containers — find any Background-N with a Button value
            for (const section of ['Surfaces', 'Containers']) {
              if (modeBtns[section]) {
                for (const bgKey of Object.keys(modeBtns[section])) {
                  const btnVal = modeBtns[section][bgKey]?.Button?.value;
                  if (btnVal) {
                    hex = resolveColorToken(btnVal, colors, backgrounds);
                    if (hex) return hex;
                    // One more level
                    if (btnVal.startsWith('#')) return btnVal;
                  }
                }
              }
            }
          }
          // Fallback: look up directly from Colors palette
          // For Primary → Colors.Primary, etc.
          if (colors?.[palette]) {
            // Use extracted tone for this palette
            const toneMap: Record<string, number> = { Primary: PC, Secondary: SC, Tertiary: TC, Neutral: NC };
            const colorN = toneMap[palette] || 8;
            const colorHex = colors[palette]?.['Color-' + colorN]?.value;
            if (colorHex) return colorHex;
          }
        }
        return null;
      };

      // Compute extracted tone numbers for fallback
      const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
      const rawSC = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 11;
  const SC = (rawSC === 11 || rawSC <= 5) ? (PC >= 9 ? 9 : 8) : rawSC;
      const rawTC = extractedTones?.tertiary ? toneToColorNumber(extractedTones.tertiary) : 11;
  const TC = (rawTC === 11 || rawTC <= 5) ? (PC >= 9 ? 9 : 8) : rawTC;
      const NC = 9;
      const OB = PC >= 9 ? 6 : 5;

      const buttonThemes = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
      const btnColorNMap: Record<string, number> = {
        Default: SC, Primary: PC, Secondary: SC, Tertiary: TC, Neutral: OB,
        Info: OB, Success: OB, Warning: OB, Error: OB,
      };

      // Add Highlight/Lowlight to ALL sections that have Buttons
      const allSections = [
        'Surfaces', 'Surfaces-Dim', 'Surfaces-Dimmest', 'Surfaces-Bright', 'Containers'
      ];

      buttonThemes.forEach(btnTheme => {
        // Resolve a base hex for this button theme (fallback for all sections)
        const colorN = btnColorNMap[btnTheme] || 8;
        // Default isn't a palette — resolve from the Default-Button section or mapped palette
        const fallbackHex = btnTheme === 'Default'
          ? (() => {
              // Try to resolve Default button color from Default-Button section
              const defBtn = (colorSystem.Modes[mode] as any)?.['Default-Button'];
              if (defBtn) {
                // Find the Medium button value and resolve it
                const mediumBtnToken = defBtn['Default-Medium-Button']?.value || defBtn['Default-Medium']?.Button?.value;
                if (mediumBtnToken) {
                  const resolved = resolveColorToken(mediumBtnToken, colors, backgrounds);
                  if (resolved) return resolved;
                }
              }
              // Fallback driven by the user's chosen button mode. The Default
              // button takes its fill from whichever palette the button mode
              // maps to — Primary for primary mode, Secondary for secondary /
              // tonal / laddered, Neutral for black-white.
              //
              // userSelections.button arrives as a combined string like
              // 'secondary-adaptive' / 'tonal-fixed' (see the parser at the
              // top of this file). Strip the '-adaptive' / '-fixed' suffix
              // before comparing so the equality checks below actually match.
              const btnModeRaw = userSelections?.button;
              const btnMode = btnModeRaw === 'black-white'
                ? 'black-white'
                : (btnModeRaw?.split('-')[0] || 'primary');
              const fbPalette = (btnMode === 'secondary' || btnMode === 'tonal' || btnMode === 'laddered')
                ? 'Secondary'
                : btnMode === 'black-white'
                  ? 'Neutral'
                  : 'Primary';
              const fbN = fbPalette === 'Primary' ? PC
                        : fbPalette === 'Secondary' ? SC
                        : colorN;
              return colors?.[fbPalette]?.['Color-' + fbN]?.value;
            })()
          : colors?.[btnTheme]?.['Color-' + colorN]?.value;

        allSections.forEach(section => {
          const sectionData = theme[section];
          if (!sectionData) return;

          const btnToken = sectionData.Buttons?.[btnTheme]?.Button?.value;
          let hex = resolveButtonHex(btnToken || '');
          if (!hex) hex = fallbackHex;
          if (!hex) return;

          if (!sectionData.Buttons) sectionData.Buttons = {};
          if (!sectionData.Buttons[btnTheme]) sectionData.Buttons[btnTheme] = {};
          sectionData.Buttons[btnTheme].Highlight = { value: computeHighlight(hex), type: 'color' };
          sectionData.Buttons[btnTheme].Lowlight = { value: computeLowlight(hex), type: 'color' };
        });
      });
    });
    // Also add Highlight/Lowlight to mode-level Buttons section
    const modeButtons = (colorSystem.Modes[mode] as any).Buttons;
    if (modeButtons) {
      const buttonThemes2 = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
      buttonThemes2.forEach(btnTheme => {
        // Check Surfaces and Containers in the Buttons section
        ['Surfaces', 'Containers'].forEach(section => {
          if (modeButtons[btnTheme]?.[section]) {
            const bgKeys = Object.keys(modeButtons[btnTheme][section]);
            bgKeys.forEach(bgKey => {
              const btnData = modeButtons[btnTheme][section][bgKey];
              if (btnData?.Button?.value) {
                const hex = resolveColorToken(btnData.Button.value, colors, backgrounds);
                if (hex) {
                  btnData.Highlight = { value: computeHighlight(hex), type: 'color' };
                  btnData.Lowlight = { value: computeLowlight(hex), type: 'color' };
                }
              }
            });
          }
        });
      });
    }

    // ── Tag.Default per theme ────────────────────────────────────────────
    // Chromatic themes get their Tag.Default from a complementary palette
    // (Primary↔Secondary↔Tertiary triangle). Semantic themes pick the
    // higher-contrast of black/var(--White) for the chip background, with
    // the opposite as text. App-Bar/Nav-Bar/Status alias their source
    // theme so the mapping flows through.
    const tagDefaultPaletteMap: Record<string, 'Primary' | 'Secondary' | 'Tertiary' | 'bw'> = {
      'Default':         'Secondary',
      'Primary':         'Secondary',
      'Primary-Light':   'Secondary',
      'Black':           'Secondary',
      'White':           'Secondary',
      'Light-Gray':      'Secondary',
      'Secondary':       'Tertiary',
      'Secondary-Light': 'Tertiary',
      'Tertiary':        'Primary',
      'Tertiary-Light':  'Primary',
      'Info':            'bw',
      'Info-Light':      'bw',
      'Success':         'bw',
      'Success-Light':   'bw',
      'Warning':         'bw',
      'Warning-Light':   'bw',
      'Error':           'bw',
      'Error-Light':     'bw',
      // Nav themes alias their source — fall through to Secondary as a
      // safe default since they typically render on Primary/Primary-Light.
      'App-Bar':         'Secondary',
      'Nav-Bar':         'Secondary',
      'Status':          'Secondary',
    };
    Object.keys(themes).forEach(themeName => {
      const theme = themes[themeName];
      const target = tagDefaultPaletteMap[themeName];
      if (!target) return;
      ['Surfaces', 'Surfaces-Dim', 'Surfaces-Dimmest', 'Surfaces-Bright', 'Containers'].forEach(section => {
        const sectionData = theme[section];
        if (!sectionData) return;
        if (!sectionData.Tag) sectionData.Tag = {};

        if (target === 'bw') {
          // Semantic theme — resolve the section's Background to hex and
          // pick whichever of black/white has higher contrast against it.
          // The Background can reference {Backgrounds.X.Background-N}
          // which itself wraps another { ref }, so a single
          // resolveColorToken call may not produce a hex. Walk through one
          // extra level if needed, then bail (skip Tag.Default for this
          // section) if we still don't have a hex — better to omit the
          // token than crash the whole export.
          const bgRef = sectionData.Background?.value;
          let bgHex: string | null = null;
          if (bgRef) {
            const r1 = resolveColorToken(bgRef, colors, backgrounds);
            if (typeof r1 === 'string' && r1.startsWith('#')) {
              bgHex = r1;
            } else if (typeof r1 === 'string') {
              const r2 = resolveColorToken(r1, colors, backgrounds);
              if (typeof r2 === 'string' && r2.startsWith('#')) bgHex = r2;
            }
          }
          if (!bgHex) return;
          const ratioBlack = getContrastRatio(bgHex, '#000000');
          const ratioWhite = getContrastRatio(bgHex, '#ffffff');
          const blackWins = ratioBlack >= ratioWhite;
          sectionData.Tag.Default = {
            BG:   { value: blackWins ? '#000000' : 'var(--White)', type: 'color' },
            Text: { value: blackWins ? 'var(--White)' : '#000000', type: 'color' },
          };
        } else if (sectionData.Tag[target]) {
          // Chromatic theme — alias the target palette's Tag entry. Clone
          // so future mutations to Tag.Secondary etc don't accidentally
          // mutate Tag.Default through reference sharing.
          sectionData.Tag.Default = {
            BG:   { ...sectionData.Tag[target].BG },
            Text: { ...sectionData.Tag[target].Text },
          };
        }
      });
    });

    console.log(`  ✓ Added Dropshadow-Color, Highlight, Lowlight to ${mode} themes`);
  });

  // ========================================
  // Replace Dark-Mode Background-Vibrant with hex values from Light-Mode Background-9
  // ========================================
  console.log('🎨 [JSON Export] Replacing Dark-Mode Background-Vibrant with hex values from Light-Mode Background-9...');
  
  // Helper function to resolve token reference to hex color
  const resolveTokenToHex = (tokenRef: string, theme: string): string => {
    // Extract the Color-N from the token reference
    // E.g., "{Colors.Primary.Color-9}" -> 11
    const colorMatch = tokenRef.match(/Color-(\d+|Vibrant)/);
    if (!colorMatch) return tokenRef;
    
    const colorN = colorMatch[1];
    
    // Map theme to tonePalette
    const themeMap: { [key: string]: any } = {
      'Primary': tonePalettes.primary,
      'Secondary': tonePalettes.secondary,
      'Tertiary': tonePalettes.tertiary,
      'Neutral': tonePalettes.neutral,
      'Info': tonePalettes.info,
      'Success': tonePalettes.success,
      'Warning': tonePalettes.warning,
      'Error': tonePalettes.error
    };
    
    const palette = themeMap[theme];
    if (!palette) return tokenRef;
    
    // Map Color-N to tone value
    const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];
    const colorIndex = parseInt(colorN) - 1;
    
    if (colorN === 'Vibrant') {
      // For Vibrant, use tone 71 (Color-7)
      return interpolateTone(71, palette);
    } else if (colorIndex >= 0 && colorIndex < toneScale.length) {
      return interpolateTone(toneScale[colorIndex], palette);
    }
    
    return tokenRef;
  };
  
  // Helper function to get theme from button type
  const getThemeForButtonType = (buttonType: string): string => {
    if (buttonType === 'Default' || buttonType === 'Default-Light') {
      // For Default buttons, determine theme based on button style
      if (buttonStyle === 'black-white') return 'Neutral';
      if (buttonStyle.includes('primary')) return 'Primary';
      if (buttonStyle.includes('secondary')) return 'Secondary';
      return 'Primary'; // fallback
    }
    // For other button types, the theme matches the button type name
    return buttonType;
  };
  
  // Iterate through all button types in Dark-Mode
  const darkModeButtons = colorSystem.Modes['Dark-Mode'].Buttons;
  Object.keys(darkModeButtons).forEach(buttonType => {
    const buttonData = darkModeButtons[buttonType];
    const theme = getThemeForButtonType(buttonType);
    
    // Replace Surfaces/Background-Vibrant
    if (buttonData.Surfaces && buttonData.Surfaces['Background-Vibrant']) {
      const vibrantData = buttonData.Surfaces['Background-Vibrant'];
      Object.keys(vibrantData).forEach(tokenKey => {
        if (vibrantData[tokenKey].value) {
          const hexValue = resolveTokenToHex(vibrantData[tokenKey].value, theme);
          vibrantData[tokenKey].value = hexValue;
        }
      });
    }
    
    // Replace Containers/Background-Vibrant
    if (buttonData.Containers && buttonData.Containers['Background-Vibrant']) {
      const vibrantData = buttonData.Containers['Background-Vibrant'];
      Object.keys(vibrantData).forEach(tokenKey => {
        if (vibrantData[tokenKey].value) {
          const hexValue = resolveTokenToHex(vibrantData[tokenKey].value, theme);
          vibrantData[tokenKey].value = hexValue;
        }
      });
    }
  });
  
  console.log('  ✓ [JSON Export] Dark-Mode Background-Vibrant replaced with hex values');
  
  // Add Charts section (using light tints for data visualization)
  console.log('��� [JSON Export] Generating Charts colors...');
  
  // Get chart colors from tone 95 (very light tints) for better visibility
  const chartColors = [
    interpolateTone(95, tonePalettes.primary),      // Chart-1: Light primary
    interpolateTone(95, tonePalettes.secondary),    // Chart-2: Light secondary
    interpolateTone(95, tonePalettes.tertiary),     // Chart-3: Light tertiary
    interpolateTone(95, tonePalettes.info),         // Chart-4: Light info
    interpolateTone(95, tonePalettes.success),      // Chart-5: Light success
    interpolateTone(95, tonePalettes.warning),      // Chart-6: Light warning
    interpolateTone(95, tonePalettes.error),        // Chart-7: Light error
    interpolateTone(95, tonePalettes.neutral),      // Chart-8: Light gray
    interpolateTone(90, tonePalettes.primary),      // Chart-9: Medium primary
    interpolateTone(90, tonePalettes.secondary)     // Chart-10: Medium secondary
  ];
  
  colorSystem.Charts = {
    'Chart-BG': { value: '#ffffff', type: 'color' },
    'Chart-Lines': { value: interpolateTone(90, tonePalettes.neutral), type: 'color' },
    Solids: {
      'Chart-1': { value: chartColors[0], type: 'color' },
      'Chart-2': { value: chartColors[1], type: 'color' },
      'Chart-3': { value: chartColors[2], type: 'color' },
      'Chart-4': { value: chartColors[3], type: 'color' },
      'Chart-5': { value: chartColors[4], type: 'color' },
      'Chart-6': { value: chartColors[5], type: 'color' },
      'Chart-7': { value: chartColors[6], type: 'color' },
      'Chart-8': { value: chartColors[7], type: 'color' },
      'Chart-9': { value: chartColors[8], type: 'color' },
      'Chart-10': { value: chartColors[9], type: 'color' }
    },
    Opaque: {
      'Chart-1': { value: hexToRgba(chartColors[0], 0.5), type: 'color' },
      'Chart-2': { value: hexToRgba(chartColors[1], 0.5), type: 'color' },
      'Chart-3': { value: hexToRgba(chartColors[2], 0.5), type: 'color' },
      'Chart-4': { value: hexToRgba(chartColors[3], 0.5), type: 'color' },
      'Chart-5': { value: hexToRgba(chartColors[4], 0.5), type: 'color' },
      'Chart-6': { value: hexToRgba(chartColors[5], 0.5), type: 'color' },
      'Chart-7': { value: hexToRgba(chartColors[6], 0.5), type: 'color' },
      'Chart-8': { value: hexToRgba(chartColors[7], 0.5), type: 'color' },
      'Chart-9': { value: hexToRgba(chartColors[8], 0.5), type: 'color' },
      'Chart-10': { value: hexToRgba(chartColors[9], 0.5), type: 'color' }
    }
  };
  console.log('  ✓ [JSON Export] Charts colors generated (BG, Lines, Solids x10, Opaque x10)');

  // Add Effects section (box shadow levels)
  console.log('✨ [JSON Export] Generating Effects levels...');
  colorSystem.Effects = {
    'Level-0': { value: 'none', type: 'boxShadow' },
    'Level-1': { value: '0 1px 2px rgba(var(--Dropshadow-Color), 0.28)', type: 'boxShadow' },
    'Level-2': { value: '0 2px 4px rgba(var(--Dropshadow-Color), 0.22), 0 1px 2px rgba(var(--Dropshadow-Color), 0.28)', type: 'boxShadow' },
    'Level-3': { value: '0 4px 8px rgba(var(--Dropshadow-Color), 0.17), 0 2px 4px rgba(var(--Dropshadow-Color), 0.22)', type: 'boxShadow' },
    'Level-4': { value: '0 8px 16px rgba(var(--Dropshadow-Color), 0.13), 0 4px 8px rgba(var(--Dropshadow-Color), 0.17)', type: 'boxShadow' },
    'Level-5': { value: '0 16px 32px rgba(var(--Dropshadow-Color), 0.1), 0 8px 16px rgba(var(--Dropshadow-Color), 0.13)', type: 'boxShadow' }
  };
  console.log('  ✓ [JSON Export] Effects levels generated');

  // Add top-level Theme section with references to Mode themes
  console.log('🎨 [JSON Export] Generating top-level Theme references...');
  
  // Check if Backgrounds.Neutral.Background-9 exists (with palette nesting)
  const neutralBg11 = colorSystem.Modes['Light-Mode']?.Backgrounds?.Neutral?.['Background-9'];
  if (!neutralBg11) {
    console.warn('⚠️  [JSON Export] Backgrounds.Neutral.Background-9 not found - Surfaces and Containers will be empty');
    console.warn('⚠️  Available Backgrounds:', Object.keys(colorSystem.Modes['Light-Mode']?.Backgrounds || {}));
    if (colorSystem.Modes['Light-Mode']?.Backgrounds?.Neutral) {
      console.warn('⚠️  Available Neutral Backgrounds:', Object.keys(colorSystem.Modes['Light-Mode']?.Backgrounds?.Neutral || {}));
    }
  }
  
  // Helper function to convert Modes.Light-Mode.Backgrounds.* references to Themes.{themeName}.* references
  const convertModesToThemeReferences = (obj: any, themeName: string): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (obj.value && typeof obj.value === 'string') {
      let newValue = obj.value;
      
      // Convert Backgrounds.{Palette}.Background-{N}.Surfaces.* → Themes.{themeName}.Surfaces.*
      // Convert Backgrounds.{Palette}.Background-{N}.Containers.* → Themes.{themeName}.Containers.*
      newValue = newValue.replace(
        /\{Backgrounds\.[^.]+\.Background-\d+\.Surfaces\.([^}]+)\}/g,
        `{Themes.${themeName}.Surfaces.$1}`
      );
      newValue = newValue.replace(
        /\{Backgrounds\.[^.]+\.Background-\d+\.Containers\.([^}]+)\}/g,
        `{Themes.${themeName}.Containers.$1}`
      );
      
      // Buttons should NOT be converted - they keep their original format
      // {Buttons.Surfaces.Background-{N}.*} → var(--Buttons-Surfaces-Background-{N}-...)
      // {Buttons.Containers.Background-{N}.*} → var(--Buttons-Containers-Background-{N}-...)
      // NO CONVERSION NEEDED FOR BUTTONS
      
      // Convert Icons.Surfaces.Background-{N}.* → Themes.{themeName}.Icons.Surfaces.*
      // Convert Icons.Containers.Background-{N}.* → Themes.{themeName}.Icons.Containers.*
      newValue = newValue.replace(
        /\{Icons\.Surfaces\.Background-\d+\.([^}]+)\}/g,
        `{Themes.${themeName}.Icons.Surfaces.$1}`
      );
      newValue = newValue.replace(
        /\{Icons\.Containers\.Background-\d+\.([^}]+)\}/g,
        `{Themes.${themeName}.Icons.Containers.$1}`
      );
      
      // Convert Tag.Surfaces.Background-{N}.* → Themes.{themeName}.Tags.Surfaces.*
      // Convert Tag.Containers.Background-{N}.* → Themes.{themeName}.Tags.Containers.*
      newValue = newValue.replace(
        /\{Tag\.Surfaces\.Background-\d+\.([^}]+)\}/g,
        `{Themes.${themeName}.Tags.Surfaces.$1}`
      );
      newValue = newValue.replace(
        /\{Tag\.Containers\.Background-\d+\.([^}]+)\}/g,
        `{Themes.${themeName}.Tags.Containers.$1}`
      );
      
      return { ...obj, value: newValue };
    }
    
    // Recursively process nested objects
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      result[key] = convertModesToThemeReferences(obj[key], themeName);
    }
    return result;
  };
  
  // Helper function to convert navigation selection to theme reference
  const getNavigationThemeReference = (selection?: string): string => {
    if (!selection) return 'Primary,Base'; // Default
    
    // Map the selection to the appropriate theme reference
    switch (selection.toLowerCase()) {
      case 'white':
        return 'Neutral,Light';
      case 'black':
        return 'Neutral,Dark';
      case 'primary':
      default:
        return 'Primary,Base';
    }
  };

  // Note: Themes section is generated at the end of the export process
  
  console.log('  ✓ [JSON Export] Mode structure complete');

  // Helper function to convert references from Modes to Theme
  const convertReferencesToTheme = (obj: any, section: 'Buttons' | 'Icons' | 'Tags', subsection: 'Surfaces' | 'Containers'): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (obj.value && typeof obj.value === 'string') {
      // Convert references like {Modes.Light-Mode.Buttons.Surfaces.Background-9.Primary.Button}
      // to {Theme.Buttons.Surfaces.Primary.Button}
      const referenceMatch = obj.value.match(/\{Modes\.Light-Mode\.(Buttons|Icons|Tags)\.(Surfaces|Containers)\.Background-9\.(.*)\}/);
      if (referenceMatch) {
        const path = referenceMatch[3];
        return {
          value: `{Theme.${section}.${subsection}.${path}}`,
          type: obj.type
        };
      }
      return obj;
    }
    
    // Recursively process nested objects
    const result: any = {};
    for (const key in obj) {
      result[key] = convertReferencesToTheme(obj[key], section, subsection);
    }
    return result;
  };

  // Helper function to generate comprehensive surface/container properties
  const generateSurfaceContainerProperties = (
    surfaceType: 'Surfaces' | 'Containers',
    backgroundProp: string
  ) => ({
    Background: { value: `{${surfaceType}.${backgroundProp}}`, type: 'color' as const },
    Header: { value: `{${surfaceType}.Header}`, type: 'color' as const },
    Text: { value: `{${surfaceType}.Text}`, type: 'color' as const },
    'Text-Success': { value: `{${surfaceType}.Text-Success}`, type: 'color' as const },
    'Text-Warning': { value: `{${surfaceType}.Text-Warning}`, type: 'color' as const },
    'Text-Error': { value: `{${surfaceType}.Text-Error}`, type: 'color' as const },
    Quiet: { value: `{${surfaceType}.Quiet}`, type: 'color' as const },
    Border: { value: `{${surfaceType}.Border}`, type: 'color' as const },
    'Border-Variant': { value: `{${surfaceType}.Border-Variant}`, type: 'color' as const },
    Hotlink: { value: `{${surfaceType}.Hotlink}`, type: 'color' as const },
    'Hotlink-Visited': { value: `{${surfaceType}.Hotlink-Visited}`, type: 'color' as const },
    Hover: { value: `{${surfaceType}.Hover}`, type: 'color' as const },
    Pressed: { value: `{${surfaceType}.Pressed}`, type: 'color' as const },
    'Focus-Visible': { value: `{${surfaceType}.Focus-Visible}`, type: 'color' as const },
    Buttons: {
      Primary: {
        Button: { value: `{${surfaceType}.Buttons.Primary.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Primary.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Primary.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Primary.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Primary.Pressed}`, type: 'color' as const }
      },
      'Primary-Light': {
        Button: { value: `{${surfaceType}.Buttons.Primary-Light.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Primary-Light.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Primary-Light.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Primary-Light.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Primary-Light.Pressed}`, type: 'color' as const }
      },
      'Primary-Outline': {
        Button: { value: `{${surfaceType}.Buttons.Primary-Outline.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Primary-Outline.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Primary-Outline.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Primary-Outline.Pressed}`, type: 'color' as const }
      },
      Secondary: {
        Button: { value: `{${surfaceType}.Buttons.Secondary.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Secondary.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Secondary.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Secondary.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Secondary.Pressed}`, type: 'color' as const }
      },
      Tertiary: {
        Button: { value: `{${surfaceType}.Buttons.Tertiary.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Tertiary.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Tertiary.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Tertiary.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Tertiary.Pressed}`, type: 'color' as const }
      },
      Neutral: {
        Button: { value: `{${surfaceType}.Buttons.Neutral.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Neutral.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Neutral.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Neutral.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Neutral.Pressed}`, type: 'color' as const }
      },
      Info: {
        Button: { value: `{${surfaceType}.Buttons.Info.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Info.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Info.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Info.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Info.Pressed}`, type: 'color' as const }
      },
      Success: {
        Button: { value: `{${surfaceType}.Buttons.Success.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Success.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Success.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Success.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Success.Pressed}`, type: 'color' as const }
      },
      Warning: {
        Button: { value: `{${surfaceType}.Buttons.Warning.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Warning.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Warning.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Warning.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Warning.Pressed}`, type: 'color' as const }
      },
      Error: {
        Button: { value: `{${surfaceType}.Buttons.Error.Button}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Buttons.Error.Text}`, type: 'color' as const },
        Border: { value: `{${surfaceType}.Buttons.Error.Border}`, type: 'color' as const },
        Hover: { value: `{${surfaceType}.Buttons.Error.Hover}`, type: 'color' as const },
        Pressed: { value: `{${surfaceType}.Buttons.Error.Pressed}`, type: 'color' as const }
      }
    },
    // Icons section removed - Icon tokens are background-specific and defined in Background-N structures
    // Use Background-N.Icons.* to access icon colors for specific backgrounds
    Tags: {
      Primary: {
        BG: { value: `{${surfaceType}.Tag.Primary.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Primary.Text}`, type: 'color' as const }
      },
      Secondary: {
        BG: { value: `{${surfaceType}.Tag.Secondary.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Secondary.Text}`, type: 'color' as const }
      },
      Tertiary: {
        BG: { value: `{${surfaceType}.Tag.Tertiary.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Tertiary.Text}`, type: 'color' as const }
      },
      Neutral: {
        BG: { value: `{${surfaceType}.Tag.Neutral.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Neutral.Text}`, type: 'color' as const }
      },
      Info: {
        BG: { value: `{${surfaceType}.Tag.Info.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Info.Text}`, type: 'color' as const }
      },
      Success: {
        BG: { value: `{${surfaceType}.Tag.Success.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Success.Text}`, type: 'color' as const }
      },
      Warning: {
        BG: { value: `{${surfaceType}.Tag.Warning.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Warning.Text}`, type: 'color' as const }
      },
      Error: {
        BG: { value: `{${surfaceType}.Tag.Error.BG}`, type: 'color' as const },
        Text: { value: `{${surfaceType}.Tag.Error.Text}`, type: 'color' as const }
      }
    }
  });

  // Add SurfacesContainers section - Simplified structure
  // Maps surface types to --Background CSS variable
  colorSystem.SurfacesContainers = {
    'Surface': {
      'Background': { value: '{Surface}', type: 'color' }
    },
    'Surface-Dim': {
      'Background': { value: '{Surface-Dim}', type: 'color' }
    },
    'Surface-Bright': {
      'Background': { value: '{Surface-Bright}', type: 'color' }
    },
    'Container': {
      'Background': { value: '{Container}', type: 'color' }
    },
    'Container-Low': {
      'Background': { value: '{Container-Low}', type: 'color' }
    },
    'Container-Lowest': {
      'Background': { value: '{Container-Lowest}', type: 'color' }
    },
    'Container-High': {
      'Background': { value: '{Container-High}', type: 'color' }
    },
    'Container-Highest': {
      'Background': { value: '{Container-Highest}', type: 'color' }
    }
  };

  // Apply static Hover and Pressed tokens (these are simple references, not generated colors)
  console.log('📋 [JSON Export] Applying static Hover and Pressed token structures...');
  const staticHover = getStaticHoverTokens();
  const staticActive = getStaticActiveTokens();
  
  // Deep clone static tokens so Light and Dark can differ
  const lightHover = JSON.parse(JSON.stringify(staticHover));
  const lightActive = JSON.parse(JSON.stringify(staticActive));
  const darkHover = JSON.parse(JSON.stringify(staticHover));
  const darkActive = JSON.parse(JSON.stringify(staticActive));

  colorSystem.Modes['Light-Mode'].Hover = lightHover;
  colorSystem.Modes['Light-Mode'].Pressed = lightActive;
  colorSystem.Modes['Dark-Mode'].Hover = darkHover;
  colorSystem.Modes['Dark-Mode'].Pressed = darkActive;
  console.log('  ✓ [JSON Export] Static Hover and Pressed tokens applied to all modes');

  // Post-process: new Pressed = old Hover, new Hover = mix(Button, old Hover)
  function mixHexColors(hex1: string, hex2: string): string {
    const parse = (h: string) => {
      const c = h.replace('#', '');
      const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
      const n = parseInt(f.substring(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const [r1, g1, b1] = parse(hex1);
    const [r2, g2, b2] = parse(hex2);
    const m = (a: number, b: number) => Math.round((a + b) / 2);
    return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function resolveColorRef(ref: string, modeColors: any): string | null {
    if (!ref || !ref.includes('{')) return ref?.startsWith('#') ? ref : null;
    const path = ref.replace(/[{}]/g, '');
    const match = path.match(/Colors\.([\w-]+)\.([\w-]+)/);
    if (match) return modeColors?.[match[1]]?.[match[2]]?.value || null;
    return null;
  }

  try {
    for (const modeName of ['Light-Mode', 'Dark-Mode'] as const) {
      const modeColors = colorSystem.Modes[modeName].Colors;
      const hover = colorSystem.Modes[modeName].Hover;
      const active = colorSystem.Modes[modeName].Pressed;
      if (!modeColors || !hover || !active) continue;

      for (const palette of Object.keys(hover)) {
        if (!modeColors?.[palette] || !active?.[palette]) continue;
        for (const colorKey of Object.keys(hover[palette])) {
          try {
            const oldHoverRef = hover[palette][colorKey]?.value;
            const oldHoverHex = resolveColorRef(oldHoverRef, modeColors);
            const buttonHex = modeColors[palette]?.[colorKey]?.value;

            if (oldHoverHex && buttonHex && oldHoverHex.startsWith('#') && buttonHex.startsWith('#')) {
              // new Pressed = old Hover hex
              active[palette][colorKey] = { value: oldHoverHex, type: 'color' };
              // new Hover = mix(Button, old Hover)
              hover[palette][colorKey] = { value: mixHexColors(buttonHex, oldHoverHex), type: 'color' };
            }
          } catch { /* skip individual color */ }
        }
      }
    }
    console.log('  ✓ [JSON Export] Hover/Pressed swapped: Pressed=oldHover, Hover=mix(Button,oldHover)');
  } catch (e) {
    console.error('  ✗ Hover/Pressed post-processing failed:', e);
  }
  
  // Apply static Quiet tokens
  console.log('📋 [JSON Export] Applying static Quiet (Text-Quiet) token structures...');
  colorSystem.Modes['Light-Mode'].Quiet = getStaticQuietTokensForLightMode();
  colorSystem.Modes['Dark-Mode'].Quiet = getStaticQuietTokensForDarkMode();
  console.log('  ✓ [JSON Export] Static Quiet tokens applied to all modes');

  // ========================================
  // Add Color-Vibrant and Color-Variant to Dark-Mode Header, Text, Quiet, Hover, and Pressed
  // Both should use hex values from Light-Mode's Color-9
  // ========================================
  console.log('🎨 [JSON Export] Adding Color-Vibrant and Color-Variant to Dark-Mode...');
  
  const themes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error', 'Hotlink-Visited'];
  const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];
  
  // Helper to get hex value for Color-9 from a theme's palette (for Text, Quiet, Hover, Pressed)
  const getColor11Hex = (themeName: string): string => {
    const themeMap: { [key: string]: any } = {
      'Neutral': tonePalettes.neutral,
      'Primary': tonePalettes.primary,
      'Secondary': tonePalettes.secondary,
      'Tertiary': tonePalettes.tertiary,
      'Info': tonePalettes.info,
      'Success': tonePalettes.success,
      'Warning': tonePalettes.warning,
      'Error': tonePalettes.error,
      'Hotlink-Visited': tonePalettes.hotlinkVisited
    };
    
    const palette = themeMap[themeName];
    if (!palette) return '#000000';
    
    // Color-9 corresponds to tone 90 (index 8)
    return interpolateTone(toneScale[8], palette);
  };

  // Helper to get hex value for Light-Mode Header Color-9 from a theme's palette
  // Light-Mode Header Color-9 points to Colors.{Theme}.Color-6
  const getHeaderColor11Hex = (themeName: string): string => {
    const themeMap: { [key: string]: any } = {
      'Neutral': tonePalettes.neutral,
      'Primary': tonePalettes.primary,
      'Secondary': tonePalettes.secondary,
      'Tertiary': tonePalettes.tertiary,
      'Info': tonePalettes.info,
      'Success': tonePalettes.success,
      'Warning': tonePalettes.warning,
      'Error': tonePalettes.error,
      'Hotlink-Visited': tonePalettes.hotlinkVisited
    };
    
    const palette = themeMap[themeName];
    if (!palette) return '#000000';
    
    // Light-Mode Header Color-9 points to Color-6, which corresponds to tone 58 (index 5)
    return interpolateTone(toneScale[5], palette);
  };
  
  // Add Color-Vibrant and Color-Variant to Header (Surfaces and Containers)
  themes.forEach(theme => {
    // Header has Surfaces and Containers sub-objects
    if (colorSystem.Modes['Dark-Mode'].Header.Surfaces && colorSystem.Modes['Dark-Mode'].Header.Surfaces[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Header.Surfaces[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Header.Surfaces[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Header.Surfaces[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
    if (colorSystem.Modes['Dark-Mode'].Header.Containers && colorSystem.Modes['Dark-Mode'].Header.Containers[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Header.Containers[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Header.Containers[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Header.Containers[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
  });
  
  // Add Color-Vibrant and Color-Variant to Text (for Surfaces and Containers)
  themes.forEach(theme => {
    if (colorSystem.Modes['Dark-Mode'].Text.Surfaces[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Text.Surfaces[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Text.Surfaces[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Text.Surfaces[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
    if (colorSystem.Modes['Dark-Mode'].Text.Containers[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Text.Containers[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Text.Containers[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Text.Containers[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
  });
  
  // Add Color-Vibrant and Color-Variant to Quiet
  themes.forEach(theme => {
    if (colorSystem.Modes['Dark-Mode'].Quiet[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Quiet[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Quiet[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Quiet[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
  });
  
  // Add Color-Vibrant and Color-Variant to Hover
  themes.forEach(theme => {
    if (colorSystem.Modes['Dark-Mode'].Hover[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Hover[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Hover[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Hover[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
  });
  
  // Add Color-Vibrant and Color-Variant to Pressed
  themes.forEach(theme => {
    if (colorSystem.Modes['Dark-Mode'].Pressed[theme]) {
      const color11Value = colorSystem.Modes['Dark-Mode'].Pressed[theme]['Color-9']?.value;
      if (color11Value) {
        colorSystem.Modes['Dark-Mode'].Pressed[theme]['Color-Vibrant'] = {
          value: color11Value,
          type: 'color'
        };
        colorSystem.Modes['Dark-Mode'].Pressed[theme]['Color-Variant'] = {
          value: color11Value,
          type: 'color'
        };
      }
    }
  });
  
  console.log('  ✓ [JSON Export] Color-Vibrant and Color-Variant added to Dark-Mode');

  // ========================================
  // THEMES ARE ALREADY GENERATED at line 5798!
  // generateCompleteSimplifiedSystem() creates complete themes with Buttons & Tags
  // DO NOT overwrite them here - the old generateModesThemes() is missing Buttons & Tags
  // ========================================
  console.log('🎨 [JSON Export] Themes already generated (with Buttons & Tags) at line 5798');
  console.log(`  ├─ Light-Mode has ${Object.keys((colorSystem.Modes['Light-Mode'] as any).Themes || {}).length} themes`);
  console.log(`  └─ Dark-Mode has ${Object.keys((colorSystem.Modes['Dark-Mode'] as any).Themes || {}).length} themes`);
  
  // Calculate and add metadata to Default theme (button defaults and container defaults)
  console.log('📋 [JSON Export] Adding button and container metadata to Default themes...');
  
  // Recalculate if defaultSettings wasn't created earlier (shouldn't happen, but be safe)
  if (!defaultSettings && extractedTones) {
    const PC = extractedTones?.primary ? toneToColorNumber(extractedTones.primary) : 9;
    const rawSC = extractedTones?.secondary ? toneToColorNumber(extractedTones.secondary) : 11;
  const SC = (rawSC === 11 || rawSC <= 5) ? (PC >= 9 ? 9 : 8) : rawSC;
    
    defaultSettings = calculateDefaultThemeSettings(
      PC,
      SC,
      surfaceStyle || 'light-tonal',
      'triadic', // Default scheme type - could be passed as parameter
      buttonStyle
    );
    
    // Apply user selections if they exist
    if (userSelections) {
      console.log('  🔄 [Default Theme] Applying user overrides...');
      console.log('      Background:', userSelections.background);
      console.log('      Button:', userSelections.button);
      console.log('      Cards/Text:', userSelections.cardsText);
      console.log('      Card Coloring:', userSelections.cardColoring);
      console.log('      Text Coloring:', userSelections.textColoring);
      
      defaultSettings = applyUserSelections(
        defaultSettings,
        {
          background: userSelections.background,
          appBar: userSelections.appBar,
          navBar: userSelections.navBar,
          button: userSelections.button,
          cardsText: userSelections.cardsText,
          cardColoring: userSelections.cardColoring,
          textColoring: userSelections.textColoring
        },
        PC,
        SC
      );
    }
  }
  
  console.log('  🔍 [Default Theme] Final settings for metadata:', defaultSettings);
  
  // Add metadata properties to Default themes (only if defaultSettings exists)
  if (defaultSettings) {
    const lightDefaultTheme = (colorSystem.Modes['Light-Mode'] as any).Themes?.Default;
    const darkDefaultTheme = (colorSystem.Modes['Dark-Mode'] as any).Themes?.Default;
    
    if (lightDefaultTheme) {
      lightDefaultTheme.ButtonDefault = { value: defaultSettings.buttonDefault, type: 'string' };
      lightDefaultTheme.ButtonDefaultN = { value: defaultSettings.buttonDefaultN, type: 'number' };
      lightDefaultTheme.ContainerTheme = { value: defaultSettings.containerTheme, type: 'string' };
      lightDefaultTheme.ContainerN = { value: defaultSettings.containerN, type: 'number' };
      lightDefaultTheme.ContainerShade = { value: defaultSettings.containerShade, type: 'string' };
      
      console.log('  🎯 [Default Theme] Light-Mode Default theme created:');
      console.log('      Surfaces.Surface:', lightDefaultTheme.Surfaces?.Surface?.value);
      console.log('      ButtonDefault:', defaultSettings.buttonDefault);
      console.log('      ButtonDefaultN:', defaultSettings.buttonDefaultN);
      console.log('      ContainerTheme:', defaultSettings.containerTheme);
      console.log('      ContainerN:', defaultSettings.containerN);
      console.log('      ContainerShade:', defaultSettings.containerShade);
    } else {
      console.warn('  ⚠️ [Default Theme] Light-Mode Default theme NOT FOUND!');
    }
    
    if (darkDefaultTheme) {
      darkDefaultTheme.ButtonDefault = { value: defaultSettings.buttonDefault, type: 'string' };
      darkDefaultTheme.ButtonDefaultN = { value: defaultSettings.buttonDefaultN, type: 'number' };
      darkDefaultTheme.ContainerTheme = { value: defaultSettings.containerTheme, type: 'string' };
      darkDefaultTheme.ContainerN = { value: defaultSettings.containerN, type: 'number' };
      darkDefaultTheme.ContainerShade = { value: defaultSettings.containerShade, type: 'string' };
      
      console.log('  🎯 [Default Theme] Dark-Mode Default theme created:');
      console.log('      Surfaces.Surface:', darkDefaultTheme.Surfaces?.Surface?.value);
      console.log('      ButtonDefault:', defaultSettings.buttonDefault);
      console.log('      ButtonDefaultN:', defaultSettings.buttonDefaultN);
      console.log('      ContainerTheme:', defaultSettings.containerTheme);
      console.log('      ContainerN:', defaultSettings.containerN);
      console.log('      ContainerShade:', defaultSettings.containerShade);
    } else {
      console.warn('  ⚠️ [Default Theme] Dark-Mode Default theme NOT FOUND!');
    }
  } else {
    console.warn('  ⚠️ [Default Theme] defaultSettings is null - cannot add metadata properties!');
    console.warn('      This may happen if extractedTones or surfaceStyle is missing');
  }
  
  // DEBUG: Check if Buttons/Icons exist in a theme
  const sampleTheme = (colorSystem.Modes['Light-Mode'] as any).Themes?.['Primary-Light'];
  if (sampleTheme) {
    console.log('  🔍 [DEBUG] Primary-Light theme structure:');
    console.log(`      - Surfaces has ${Object.keys(sampleTheme.Surfaces || {}).length} keys:`, Object.keys(sampleTheme.Surfaces || {}).join(', '));
    console.log(`      - Surfaces.Buttons exists: ${!!sampleTheme.Surfaces?.Buttons}`);
    console.log(`      - Surfaces.Icons exists: ${!!sampleTheme.Surfaces?.Icons}`);
    if (sampleTheme.Surfaces?.Buttons) {
      console.log(`      - Surfaces.Buttons has ${Object.keys(sampleTheme.Surfaces.Buttons).length} button types:`, Object.keys(sampleTheme.Surfaces.Buttons).slice(0, 5).join(', '));
    }
  }

  // Final verification of fixed structures before return
  console.log('🔍 [JSON Export] FINAL VERIFICATION OF FIXED STRUCTURES:');
  console.log(`  ├─ Light-Mode Text.Surfaces.Neutral.Color-1 = ${colorSystem.Modes['Light-Mode'].Text?.Surfaces?.Neutral?.['Color-1']?.value || 'MISSING'}`);
  console.log(`  ├─ Dark-Mode Text.Surfaces.Neutral.Color-1 = ${colorSystem.Modes['Dark-Mode'].Text?.Surfaces?.Neutral?.['Color-1']?.value || 'MISSING'}`);
  console.log(`  ├─ Dark-Mode Border.Surfaces has ${Object.keys(colorSystem.Modes['Dark-Mode']['Border']?.Surfaces || {}).length} palettes`);
  console.log(`  └─ Dark-Mode Border.Surfaces.Neutral has ${Object.keys(colorSystem.Modes['Dark-Mode']['Border']?.Surfaces?.Neutral || {}).length} backgrounds`);
  
  // Tag sections are now generated by the Complete Simplified System
  console.log('🏷️  [JSON Export] Tag sections already generated by Complete Simplified System');

  console.log('✅ [JSON Export] Color system export complete!');
  return colorSystem;
}

/**
 * Download the color system as a JSON file
 */
export function downloadColorSystemJSON(colorSystem: ColorSystemExport, filename: string): void {
  const jsonString = JSON.stringify(colorSystem, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
