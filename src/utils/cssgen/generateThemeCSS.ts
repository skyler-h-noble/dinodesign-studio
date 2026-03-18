/**
 * Button configuration for theme generation
 */
export interface ButtonConfig {
  defaultButtonType: 'primary' | 'secondary' | 'tonal' | 'black-white';
  buttonBehavior: 'adaptive' | 'fixed';
}

/**
 * Generate all theme CSS
 * DEPRECATED: This function is kept for backwards compatibility
 * Theme CSS is now generated directly from JSON in exportToCSS.ts
 */
export function generateAllThemesCSS(
  extractedTones?: { primary: number; secondary: number; tertiary: number },
  buttonConfig?: ButtonConfig,
  themeMode?: 'light' | 'dark',
  containerStyle?: 'tonal' | 'professional' | 'black'
): string {
  console.warn('⚠️ [generateAllThemesCSS] DEPRECATED: Template-based theme generation called as fallback');
  console.warn('   This should not happen - themes should be generated from JSON');
  console.warn('   Returning empty string to avoid errors');
  return '';
}
