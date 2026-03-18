/**
 * Fixed Icons structure for Light-Mode-Tonal
 * This structure is constant and does not change based on color extraction
 * Updated to support 14 background levels
 */

const createIconSet = (mainColor: string, variantColor: string) => ({
  Default: { value: `{Colors.Primary.${mainColor}}`, type: 'color' as const },
  'Default-Variant': { value: `{Colors.Primary.${variantColor}}`, type: 'color' as const },
  Primary: { value: `{Colors.Primary.${mainColor}}`, type: 'color' as const },
  'Primary-Variant': { value: `{Colors.Primary.${variantColor}}`, type: 'color' as const },
  Secondary: { value: `{Colors.Secondary.${mainColor}}`, type: 'color' as const },
  'Secondary-Variant': { value: `{Colors.Secondary.${variantColor}}`, type: 'color' as const },
  Tertiary: { value: `{Colors.Tertiary.${mainColor}}`, type: 'color' as const },
  'Tertiary-Variant': { value: `{Colors.Tertiary.${variantColor}}`, type: 'color' as const },
  Neutral: { value: `{Colors.Neutral.${mainColor}}`, type: 'color' as const },
  'Neutral-Variant': { value: `{Colors.Neutral.${variantColor}}`, type: 'color' as const },
  Info: { value: `{Colors.Info.${mainColor}}`, type: 'color' as const },
  'Info-Variant': { value: `{Colors.Info.${variantColor}}`, type: 'color' as const },
  Success: { value: `{Colors.Success.${mainColor}}`, type: 'color' as const },
  'Success-Variant': { value: `{Colors.Success.${variantColor}}`, type: 'color' as const },
  Warning: { value: `{Colors.Warning.${mainColor}}`, type: 'color' as const },
  'Warning-Variant': { value: `{Colors.Warning.${variantColor}}`, type: 'color' as const },
  Error: { value: `{Colors.Error.${mainColor}}`, type: 'color' as const },
  'Error-Variant': { value: `{Colors.Error.${variantColor}}`, type: 'color' as const }
});

export const lightModeTonalIconsFixed = {
  Surfaces: {
    'Background-1': createIconSet('Color-10', 'Color-8'),
    'Background-2': createIconSet('Color-10', 'Color-8'),
    'Background-3': createIconSet('Color-10', 'Color-8'),
    'Background-4': createIconSet('Color-10', 'Color-8'),
    'Background-5': createIconSet('Color-10', 'Color-8'),
    'Background-6': createIconSet('Color-10', 'Color-8'),
    'Background-7': createIconSet('Color-10', 'Color-8'),
    'Background-8': createIconSet('Color-10', 'Color-8'),
    'Background-9': createIconSet('Color-6', 'Color-4'),
    'Background-10': createIconSet('Color-6', 'Color-4'),
    'Background-11': createIconSet('Color-6', 'Color-4'),
    'Background-12': createIconSet('Color-7', 'Color-5'),
    'Background-13': createIconSet('Color-7', 'Color-5'),
    'Background-14': createIconSet('Color-7', 'Color-5')
  },
  Containers: {
    'Background-1': createIconSet('Color-10', 'Color-8'),
    'Background-2': createIconSet('Color-10', 'Color-8'),
    'Background-3': createIconSet('Color-10', 'Color-8'),
    'Background-4': createIconSet('Color-10', 'Color-8'),
    'Background-5': createIconSet('Color-10', 'Color-8'),
    'Background-6': createIconSet('Color-10', 'Color-8'),
    'Background-7': createIconSet('Color-10', 'Color-8'),
    'Background-8': createIconSet('Color-10', 'Color-8'),
    'Background-9': createIconSet('Color-6', 'Color-4'),
    'Background-10': createIconSet('Color-6', 'Color-4'),
    'Background-11': createIconSet('Color-6', 'Color-4'),
    'Background-12': createIconSet('Color-7', 'Color-5'),
    'Background-13': createIconSet('Color-7', 'Color-5'),
    'Background-14': createIconSet('Color-7', 'Color-5')
  }
};
