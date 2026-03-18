/**
 * Fixed Icons structure for Dark-Mode
 * This structure is constant and does not change based on color extraction
 * Updated to support 14 background levels
 */

const createIconSet = (mainColor: string, variantColor: string, palette: string) => ({
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

const createContainerIconSet = (mainColor: string, variantColor: string) => ({
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

export const darkModeIconsFixed = {
  Surfaces: {
    'Background-1': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-2': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-3': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-4': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-5': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-6': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-7': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-8': createIconSet('Color-Vibrant', 'Color-9', 'Surfaces'),
    'Background-9': createIconSet('Color-5', 'Color-3', 'Surfaces'),
    'Background-10': createIconSet('Color-5', 'Color-3', 'Surfaces'),
    'Background-11': createIconSet('Color-6', 'Color-4', 'Surfaces'),
    'Background-12': createIconSet('Color-7', 'Color-5', 'Surfaces'),
    'Background-13': createIconSet('Color-7', 'Color-5', 'Surfaces'),
    'Background-14': createIconSet('Color-7', 'Color-5', 'Surfaces')
  },
  Containers: {
    'Background-1': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-2': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-3': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-4': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-5': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-6': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-7': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-8': createContainerIconSet('Color-Vibrant', 'Color-9'),
    'Background-9': createContainerIconSet('Color-4', 'Color-1'),
    'Background-10': createContainerIconSet('Color-4', 'Color-1'),
    'Background-11': createContainerIconSet('Color-5', 'Color-2'),
    'Background-12': createContainerIconSet('Color-6', 'Color-3'),
    'Background-13': createContainerIconSet('Color-6', 'Color-3'),
    'Background-14': createContainerIconSet('Color-6', 'Color-3')
  }
};
