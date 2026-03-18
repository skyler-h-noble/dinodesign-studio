/**
 * TypeScript type definitions for DynoDesign JSON structure
 * Ensures type safety when updating the design system
 */

// Base color value type
export interface ColorValue {
  value: string;
  type: 'color';
}

// Dimension value type
export interface DimensionValue {
  value: number;
  type: 'dimension';
}

// Color scale (Color-1 through Color-13)
export interface ColorScale {
  'Color-1': ColorValue;
  'Color-2': ColorValue;
  'Color-3': ColorValue;
  'Color-4': ColorValue;
  'Color-5': ColorValue;
  'Color-6': ColorValue;
  'Color-7': ColorValue;
  'Color-8': ColorValue;
  'Color-9': ColorValue;
  'Color-10': ColorValue;
  'Color-11': ColorValue;
  'Color-12': ColorValue;
  'Color-13': ColorValue;
}

// Button definition
export interface ButtonDefinition {
  Button: ColorValue;
  Text: ColorValue;
  Border: ColorValue;
}

// Background button styles (Background-1 through Background-11, Background-Vibrant)
export interface BackgroundButtons {
  'Background-1': ButtonDefinition;
  'Background-2': ButtonDefinition;
  'Background-3': ButtonDefinition;
  'Background-4': ButtonDefinition;
  'Background-5': ButtonDefinition;
  'Background-6': ButtonDefinition;
  'Background-7': ButtonDefinition;
  'Background-8': ButtonDefinition;
  'Background-9': ButtonDefinition;
  'Background-10': ButtonDefinition;
  'Background-11': ButtonDefinition;
  'Background-Vibrant': ButtonDefinition;
}

// Primary Buttons structure
export interface PrimaryButtons {
  Default: {
    Surfaces: BackgroundButtons;
    Containers: BackgroundButtons;
  };
  'Primary-Adaptive': {
    Surfaces: BackgroundButtons;
    Containers: BackgroundButtons;
  };
  'Primary-Fixed': {
    Surfaces: BackgroundButtons;
    Containers: BackgroundButtons;
  };
  'Black-White': {
    Surfaces: BackgroundButtons;
    Containers: BackgroundButtons;
  };
}

// Surface/Container common properties
export interface SurfaceContainerBase {
  Surface?: ColorValue;
  'Surface-Dim'?: ColorValue;
  'Surface-Bright'?: ColorValue;
  Container?: ColorValue;
  'Container-Low'?: ColorValue;
  'Container-Lowest'?: ColorValue;
  'Container-High'?: ColorValue;
  'Container-Highest'?: ColorValue;
  Header?: ColorValue;
  Text?: ColorValue;
  'Text-Quiet': ColorValue;
  Border: ColorValue;
  'Border-Variant': ColorValue;
  Hotlink?: ColorValue;
  'Hotlink-Visited'?: ColorValue;
  'Text-Quiet-Opacity'?: DimensionValue;
  'Border-Opacity'?: DimensionValue;
}

// Background definition
export interface BackgroundDefinition {
  Surfaces: SurfaceContainerBase;
  Containers: SurfaceContainerBase;
}

// All backgrounds for a color
export interface ColorBackgrounds {
  'Background-1': BackgroundDefinition;
  'Background-2': BackgroundDefinition;
  'Background-3': BackgroundDefinition;
  'Background-4': BackgroundDefinition;
  'Background-5': BackgroundDefinition;
  'Background-6': BackgroundDefinition;
  'Background-7': BackgroundDefinition;
  'Background-8': BackgroundDefinition;
  'Background-9': BackgroundDefinition;
  'Background-10': BackgroundDefinition;
  'Background-11': BackgroundDefinition;
  'Background-Vibrant': BackgroundDefinition;
}

// Mode backgrounds
export interface ModeBackgrounds {
  Neutral: ColorBackgrounds;
  Primary: ColorBackgrounds;
  Secondary: ColorBackgrounds;
  Tertiary: ColorBackgrounds;
  Info?: ColorBackgrounds;
  Success?: ColorBackgrounds;
  Warning?: ColorBackgrounds;
  Error?: ColorBackgrounds;
}

// Mode structure
export interface Mode {
  Backgrounds: ModeBackgrounds;
  [key: string]: any; // Allow other properties
}

// Complete design system structure
export interface DesignSystem {
  Colors: {
    Primary: ColorScale;
    Secondary: ColorScale;
    Tertiary: ColorScale;
    Neutral: ColorScale;
    Info?: ColorScale;
    Success?: ColorScale;
    Warning?: ColorScale;
    Error?: ColorScale;
    White?: ColorValue;
    Black?: ColorValue;
    Transparent?: ColorValue;
    [key: string]: any;
  };
  'Primary-Buttons': PrimaryButtons;
  Modes: {
    Default: Mode;
    Primary?: Mode;
    Secondary?: Mode;
    Tertiary?: Mode;
    [key: string]: any;
  };
  Theme?: {
    [key: string]: any;
  };
  Text?: {
    [key: string]: any;
  };
  [key: string]: any; // Allow additional top-level properties
}

// Button style options
export type ButtonStyle = 'Primary-Adaptive' | 'Primary-Fixed' | 'Black-White';

// Background selection types
export type ThemeType = 'Default' | 'Neutral' | 'Primary' | 'Secondary' | 'Tertiary' | 'Neutral-Variant';
export type BackgroundColor = 'Neutral' | 'Primary' | 'Secondary' | 'Tertiary';
export type BackgroundLevel = 
  | 'Background-1' 
  | 'Background-2' 
  | 'Background-3' 
  | 'Background-4' 
  | 'Background-5' 
  | 'Background-6' 
  | 'Background-7' 
  | 'Background-8' 
  | 'Background-9' 
  | 'Background-10' 
  | 'Background-11' 
  | 'Background-Vibrant';

export interface BackgroundSelection {
  color: BackgroundColor;
  level: BackgroundLevel;
}

export interface BackgroundSelections {
  Default: BackgroundSelection;
  Neutral: BackgroundSelection;
  Primary: BackgroundSelection;
  Secondary: BackgroundSelection;
  Tertiary: BackgroundSelection;
  'Neutral-Variant': BackgroundSelection;
}

// Navigation selection types
export type NavigationComponent = 'App-Bar' | 'Nav-Bar' | 'Tool-Bar';
export type NavigationColor = 'Neutral' | 'Primary' | 'Secondary' | 'Tertiary';
export type NavigationLevel = BackgroundLevel; // Same as background levels

export interface NavigationSelection {
  color: NavigationColor;
  level: NavigationLevel;
}

export interface NavigationSelections {
  'App-Bar': NavigationSelection;
  'Nav-Bar': NavigationSelection;
  'Tool-Bar': NavigationSelection;
}

// Color swap options (for future implementation)
export type SwappableColor = 'Primary' | 'Secondary' | 'Tertiary' | 'Neutral';

// Export validation result
export interface ValidationResult {
  isValid: boolean;
  missing: string[];
  errors?: string[];
}

// JSON update result (for tracking changes)
export interface UpdateResult {
  success: boolean;
  updatedPaths: string[];
  errors?: string[];
  message?: string;
}