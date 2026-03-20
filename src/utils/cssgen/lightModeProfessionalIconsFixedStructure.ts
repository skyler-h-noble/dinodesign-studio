/**
 * Fixed Icons structure for Light-Mode-Professional
 * This structure is constant and does not change based on color extraction
 * Updated to support 12 background levels
 * NOTE: Default icons use Neutral palette instead of Primary
 */

const createIconSet = (mainColor: string, variantColor: string) => ({
  Default: { value: `{Colors.Neutral.${mainColor}}`, type: 'color' as const },
  'Default-Variant': { value: `{Colors.Neutral.${variantColor}}`, type: 'color' as const },
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

export const lightModeProfessionalIconsFixed = {
  Surfaces: {
    'Background-1': createIconSet('Color-8', 'Color-6'),
    'Background-2': createIconSet('Color-8', 'Color-6'),
    'Background-3': createIconSet('Color-8', 'Color-6'),
    'Background-4': createIconSet('Color-8', 'Color-6'),
    'Background-5': createIconSet('Color-8', 'Color-6'),
    'Background-6': createIconSet('Color-5', 'Color-4'),
    'Background-7': createIconSet('Color-5', 'Color-4'),
    'Background-8': createIconSet('Color-5', 'Color-4'),
    'Background-9': createIconSet('Color-5', 'Color-5'),
    'Background-10': createIconSet('Color-5', 'Color-5'),
    'Background-11': createIconSet('Color-5', 'Color-5'),
    'Background-12': createIconSet('Color-5', 'Color-5')
  },
  Containers: {
    'Background-1': createIconSet('Color-8', 'Color-6'),
    'Background-2': createIconSet('Color-8', 'Color-6'),
    'Background-3': createIconSet('Color-8', 'Color-6'),
    'Background-4': createIconSet('Color-8', 'Color-6'),
    'Background-5': createIconSet('Color-8', 'Color-6'),
    'Background-6': createIconSet('Color-5', 'Color-4'),
    'Background-7': createIconSet('Color-5', 'Color-4'),
    'Background-8': createIconSet('Color-5', 'Color-4'),
    'Background-9': createIconSet('Color-5', 'Color-5'),
    'Background-10': createIconSet('Color-5', 'Color-5'),
    'Background-11': createIconSet('Color-5', 'Color-5'),
    'Background-12': createIconSet('Color-5', 'Color-5')
  }
};
