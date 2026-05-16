/** Workflow stages in order */
export type Stage =
  | 'name'
  | 'upload'
  | 'color'
  | 'color-assignment'
  | 'typography'
  | 'component-style'
  | 'review'
  | 'export';

/** All stages in order for navigation */
export const STAGE_ORDER: Stage[] = [
  'name',
  'upload',
  'color',
  'color-assignment',
  'typography',
  'component-style',
  'review',
  'export',
];

/** Typography style for a single role (header, decorative, body) */
export interface TypographyStyle {
  type: 'header' | 'decorative' | 'body';
  family: string;
  weight: string;
  letterSpacing: string;
  allCaps: boolean;
}

/** Hue overrides for the endpoints (Color-1 / Color-12) of a tone scale */
export interface HueEasing {
  darkHue?: number;  // 0-360, hue at Color-1 (darkest)
  lightHue?: number; // 0-360, hue at Color-12 (lightest)
}

/** Per-palette hue overrides, separated by light/dark mode */
export interface PaletteHueOverrides {
  light?: HueEasing;
  dark?: HueEasing;
}

/** Hue overrides keyed by palette index (0=primary, 1=secondary, 2=tertiary) */
export type HueOverridesMap = Record<number, PaletteHueOverrides>;

/** Color scheme extracted from mood board */
export interface ColorScheme {
  name: string;
  colors: string[];
  originalColors: string[];
  extractedTones: {
    primary: number;
    secondary: number;
    tertiary: number;
  };
  tonePalettes: Record<string, Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>>;
  darkModeTonePalettes: Record<string, Array<{ tone: number; lightness: number; hex: string; colorNumber: number }>>;
  userSelections?: UserSelections;
  /** Per-palette hue easing overrides for Color-1 and Color-12 endpoints */
  hueOverrides?: HueOverridesMap;
}

/** User design choices made during the workflow */
export interface UserSelections {
  defaultTheme: 'light' | 'dark';
  background: string;
  backgroundTheme: 'Primary' | 'Neutral';
  backgroundN: number;
  appBar: 'primary-light' | 'primary' | 'white' | 'black';
  navBar: 'primary-light' | 'primary' | 'white' | 'black';
  status: 'primary-light' | 'primary' | 'white' | 'black';
  button: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
  cardColoring: 'tonal' | 'white' | 'black';
  textColoring: 'tonal' | 'black-white';
  decorativeMode: 'surface-components' | 'only-selected';
}

/** Surface style detected from mood board */
export type SurfaceStyle = 'light-tonal' | 'grey-professional' | 'dark-professional';

/** Component style selection */
export type ComponentStyle = 'professional' | 'modern' | 'bold' | 'playful';

/** Common props passed to stage components */
export interface StageProps {
  onNext: () => void;
  onBack: () => void;
}
