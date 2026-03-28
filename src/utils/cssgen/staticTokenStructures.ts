/**
 * Static token structures that reference Colors but don't generate new colors
 * These are imported from sample-output.json and should remain unchanged
 */

export { getStaticQuietTokensForLightMode, getStaticQuietTokensForDarkMode } from './staticQuietStructures';

/**
 * Generate hover tokens for a palette.
 *
 * These values become ACTIVE after post-processing swap.
 * Post-processing: Active = these values, Hover = mix(bg, these values)
 *
 * Dark colors (1-5): one step darker (Color-1 → Black)
 * Gap color (6): one step darker
 * Light colors (7-12): one step lighter (Color-12 → White)
 * Color-Vibrant: follows Color-9 pattern (one step lighter)
 */
function buildHoverForPalette(palette: string): any {
  return {
    'Color-1': { value: '{Black}', type: 'color' },
    'Color-2': { value: `{Colors.${palette}.Color-1}`, type: 'color' },
    'Color-3': { value: `{Colors.${palette}.Color-2}`, type: 'color' },
    'Color-4': { value: `{Colors.${palette}.Color-3}`, type: 'color' },
    'Color-5': { value: `{Colors.${palette}.Color-4}`, type: 'color' },
    'Color-6': { value: `{Colors.${palette}.Color-7}`, type: 'color' },
    'Color-7': { value: `{Colors.${palette}.Color-8}`, type: 'color' },
    'Color-8': { value: `{Colors.${palette}.Color-9}`, type: 'color' },
    'Color-9': { value: `{Colors.${palette}.Color-10}`, type: 'color' },
    'Color-10': { value: `{Colors.${palette}.Color-11}`, type: 'color' },
    'Color-11': { value: `{Colors.${palette}.Color-12}`, type: 'color' },
    'Color-12': { value: '{White}', type: 'color' },
    'Color-Vibrant': { value: `{Colors.${palette}.Color-10}`, type: 'color' },
  };
}

export function getStaticHoverTokens() {
  return {
    Neutral: buildHoverForPalette('Neutral'),
    Primary: buildHoverForPalette('Primary'),
    Secondary: buildHoverForPalette('Secondary'),
    Tertiary: buildHoverForPalette('Tertiary'),
    Info: buildHoverForPalette('Info'),
    Success: buildHoverForPalette('Success'),
    Warning: buildHoverForPalette('Warning'),
    Error: buildHoverForPalette('Error'),
    'Hotlink-Visited': buildHoverForPalette('Hotlink-Visited'),
    BW: {
      'Color-1': { value: '{Black}', type: 'color' },
      'Color-2': { value: '{Colors.Neutral.Color-1}', type: 'color' },
      'Color-3': { value: '{Colors.Neutral.Color-2}', type: 'color' },
      'Color-4': { value: '{Colors.Neutral.Color-3}', type: 'color' },
      'Color-5': { value: '{Colors.Neutral.Color-4}', type: 'color' },
      'Color-6': { value: '{Colors.Neutral.Color-5}', type: 'color' },
      'Color-7': { value: '{Colors.Neutral.Color-8}', type: 'color' },
      'Color-8': { value: '{Colors.Neutral.Color-9}', type: 'color' },
      'Color-9': { value: '{Colors.Neutral.Color-10}', type: 'color' },
      'Color-10': { value: '{Colors.Neutral.Color-11}', type: 'color' },
      'Color-11': { value: '{Colors.Neutral.Color-12}', type: 'color' },
      'Color-12': { value: '{White}', type: 'color' },
      'Color-Vibrant': { value: '{Colors.Neutral.Color-10}', type: 'color' }
    }
  };
}

/**
 * Active tokens use the same pattern as Hover.
 * Post-processing replaces these with the Hover values anyway,
 * so these are just placeholders that follow the same logic.
 */
export function getStaticActiveTokens() {
  return {
    Neutral: buildHoverForPalette('Neutral'),
    Primary: buildHoverForPalette('Primary'),
    Secondary: buildHoverForPalette('Secondary'),
    Tertiary: buildHoverForPalette('Tertiary'),
    Info: buildHoverForPalette('Info'),
    Success: buildHoverForPalette('Success'),
    Warning: buildHoverForPalette('Warning'),
    Error: buildHoverForPalette('Error'),
    'Hotlink-Visited': buildHoverForPalette('Hotlink-Visited'),
    BW: buildHoverForPalette('Neutral'), // BW uses Neutral palette for hover/active
  };
}
