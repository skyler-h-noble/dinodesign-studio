import type { ExtractedColor } from './colorExtraction';

export interface SurfaceModeResult {
  mode: 'monochromatic' | 'dark-immersive' | 'dark-chrome' | 'standard' | 'soft';
  background: 'primary' | 'white' | 'black' | 'primary-light';
  appBar: 'white' | 'black' | 'primary' | 'primary-medium';
  navBar: 'white' | 'black' | 'primary';
  toolBar: 'white' | 'black' | 'primary';
  statusBar: 'white' | 'black' | 'primary' | 'primary-medium';
  buttonColor: 'primary-fixed' | 'primary-adaptive';
  textCard: 'professional' | 'tonal';
}

/**
 * Analyze extracted colors to determine black/dark dominance ratios
 */
export function analyzeBlackDominance(extractedColors: ExtractedColor[]): {
  blackRatio: number;
  darkRatio: number;
} {
  let blackDominance = 0;
  let darkDominance = 0;

  extractedColors.forEach((color) => {
    // Parse color to get lightness
    const rgb = hexToRgb(color.hex);
    const lightness = (Math.max(rgb.r, rgb.g, rgb.b) + Math.min(rgb.r, rgb.g, rgb.b)) / 510; // 0-1

    // Black: lightness < 0.1 (very dark)
    if (lightness < 0.1) {
      blackDominance += color.dominance;
    }
    // Dark: lightness < 0.3 (dark)
    if (lightness < 0.3) {
      darkDominance += color.dominance;
    }
  });

  return {
    blackRatio: blackDominance,
    darkRatio: darkDominance,
  };
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Determine surface mode based on extracted colors and primary tone
 * This is run ONCE on initial load for auto-assignment
 */
export function getSurfaceMode(
  extractedColors: ExtractedColor[],
  primaryTone: number,
  colorScheme?: 'monochromatic' | null
): SurfaceModeResult {
  const { blackRatio, darkRatio } = analyzeBlackDominance(extractedColors);

  console.log(`🎨 Surface Mode Analysis:`, {
    primaryTone,
    blackRatio: `${(blackRatio * 100).toFixed(1)}%`,
    darkRatio: `${(darkRatio * 100).toFixed(1)}%`,
    colorScheme,
  });

  // Rule 1: Monochromatic color scheme
  if (colorScheme === 'monochromatic') {
    return {
      mode: 'monochromatic',
      background: 'primary',
      appBar: 'white',
      navBar: 'white',
      toolBar: 'white',
      statusBar: 'white',
      buttonColor: 'primary-fixed',
      textCard: 'professional',
    };
  }

  // Rule 2: Dark Immersive (75%+ dark colors)
  if (darkRatio >= 0.75) {
    return {
      mode: 'dark-immersive',
      background: 'black',
      appBar: 'black',
      navBar: 'black',
      toolBar: 'black',
      statusBar: 'black',
      buttonColor: 'primary-adaptive',
      textCard: 'professional',
    };
  }

  // Rule 3: Dark Chrome (40-74% dark colors)
  if (darkRatio >= 0.40) {
    return {
      mode: 'dark-chrome',
      background: 'white',
      appBar: 'black',
      navBar: 'black',
      toolBar: 'black',
      statusBar: 'black',
      buttonColor: 'primary-adaptive',
      textCard: 'professional',
    };
  }

  // Rule 4: Standard (primary tone <= 62, darker primary)
  if (primaryTone <= 62) {
    return {
      mode: 'standard',
      background: 'white',
      appBar: 'primary',
      navBar: 'primary',
      toolBar: 'primary',
      statusBar: 'primary-medium',
      buttonColor: 'primary-adaptive',
      textCard: 'professional',
    };
  }

  // Rule 5: Soft (primary tone >= 71, lighter primary)
  if (primaryTone >= 71) {
    return {
      mode: 'soft',
      background: 'primary-light',
      appBar: 'primary',
      navBar: 'primary',
      toolBar: 'primary',
      statusBar: 'primary',
      buttonColor: 'primary-fixed',
      textCard: 'tonal',
    };
  }

  // Default: Standard mode
  return {
    mode: 'standard',
    background: 'white',
    appBar: 'primary',
    navBar: 'primary',
    toolBar: 'primary',
    statusBar: 'primary-medium',
    buttonColor: 'primary-adaptive',
    textCard: 'professional',
  };
}
