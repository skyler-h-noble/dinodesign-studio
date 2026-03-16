/** Workflow stages in order */
export type Stage =
  | 'welcome'
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
  'welcome',
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
  tonePalettes: Record<string, Array<{ tone: number; lightness: number; hex: string }>>;
  darkModeTonePalettes: Record<string, Array<{ tone: number; lightness: number; hex: string }>>;
  userSelections?: UserSelections;
}

/** User design choices made during the workflow */
export interface UserSelections {
  defaultTheme: 'light' | 'dark';
  background: string;
  backgroundTheme: 'Primary' | 'Neutral';
  backgroundN: number;
  appBar: string;
  navBar: string;
  status: string;
  button: 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
  cardColoring: 'tonal' | 'white' | 'black';
  textColoring: 'tonal' | 'black-white';
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
