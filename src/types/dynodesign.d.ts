declare module '@dynodesign/components' {
  import { FC, ReactNode, CSSProperties } from 'react';

  // Provider
  export const DynoDesignProvider: FC<{
    themeURL?: string;
    foundationCSS?: string;
    coreCSS?: string;
    lightModeCSS?: string;
    darkModeCSS?: string;
    baseCSS?: string;
    stylesCSS?: string;
    defaultTheme?: string;
    defaultStyle?: string;
    defaultSurface?: string;
    defaultDarkMode?: boolean;
    darkMode?: boolean;
    onDarkModeChange?: (dark: boolean) => void;
    fullHeight?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }>;

  export function useDynoDesign(): {
    theme: string;
    style: string;
    surface: string;
    isDark: boolean;
    cssStatus: 'loading' | 'ready' | 'error';
    cssError: string | null;
    setTheme: (theme: string) => void;
    setStyle: (style: string) => void;
    setSurface: (surface: string) => void;
    toggleDarkMode: () => void;
    themes: string[];
    styles: string[];
    surfaces: string[];
  };

  export const ThemedZone: FC<{
    theme?: string;
    surface?: string;
    as?: string;
    children?: ReactNode;
    [key: string]: any;
  }>;

  export const Surfaced: FC<{
    surface?: string;
    children?: ReactNode;
    [key: string]: any;
  }>;

  // Typography
  export const Typography: FC<any>;
  export const H1: FC<any>;
  export const H2: FC<any>;
  export const H3: FC<any>;
  export const H4: FC<any>;
  export const H5: FC<any>;
  export const H6: FC<any>;
  export const Body: FC<any>;
  export const BodySmall: FC<any>;
  export const BodyLarge: FC<any>;
  export const Label: FC<any>;
  export const Caption: FC<any>;
  export const Overline: FC<any>;

  // Buttons
  export const Button: FC<any>;
  export const ButtonGroup: FC<any>;
  export const ButtonIcon: FC<any>;
  export const Fab: FC<any>;
  export const Rail: FC<any>;
  export const Toolbar: FC<any>;
  export const ToggleButton: FC<any>;
  export const ToggleButtonGroup: FC<any>;
  export const NumberField: FC<any>;

  // Inputs
  export const TextField: FC<any>;
  export const TextInput: FC<any>;
  export const Input: FC<any>;
  export const Select: FC<any>;
  export const Autocomplete: FC<any>;
  export const Checkbox: FC<any>;
  export const CheckboxGroup: FC<any>;
  export const CheckboxWithDescription: FC<any>;
  export const IndeterminateCheckbox: FC<any>;
  export const RadioGroup: FC<any>;
  export const SwitchInput: FC<any>;
  export const SliderInput: FC<any>;
  export const RatingInput: FC<any>;
  export const SearchField: FC<any>;

  // Chips
  export const Chip: FC<any>;

  // Layout
  export const Stack: FC<any>;
  export const HStack: FC<any>;
  export const VStack: FC<any>;
  export const CenteredStack: FC<any>;
  export const SpaceBetweenStack: FC<any>;
  export const ResponsiveStack: FC<any>;
  export const GridStack: FC<any>;
  export const StackDivider: FC<any>;
  export const InsetStack: FC<any>;
  export const ScrollStack: FC<any>;
  export const WrapStack: FC<any>;
  export const Box: FC<any>;
  export const Container: FC<any>;
  export const Grid: FC<any>;

  // Navigation
  export const Tabs: FC<any>;
  export const TabList: FC<any>;
  export const Tab: FC<any>;
  export const TabPanel: FC<any>;
  export const Breadcrumbs: FC<any>;
  export const Pagination: FC<any>;
  export const Dropdown: FC<any>;
  export const Menu: FC<any>;
  export const MenuItem: FC<any>;
  export const BottomNavigation: FC<any>;
  export const Stepper: FC<any>;
  export const SpeedDial: FC<any>;

  // Surfaces
  export const Card: FC<any>;
  export const Paper: FC<any>;

  // Dialogs
  export const Dialog: FC<any>;
  export const Modal: FC<any>;
  export const Drawer: FC<any>;

  // Feedback
  export const Alert: FC<any>;
  export const Snackbar: FC<any>;
  export const CircularProgress: FC<any>;
  export const LinearProgress: FC<any>;

  // Data Display
  export const Avatar: FC<any>;
  export const AvatarGroup: FC<any>;
  export const Badge: FC<any>;
  export const Divider: FC<any>;
  export const List: FC<any>;
  export const Table: FC<any>;
  export const Tooltip: FC<any>;

  // App Structure
  export const AppBar: FC<any>;
  export const Header: FC<any>;
  export const Footer: FC<any>;
  export const Sidebar: FC<any>;
  export const MainLayout: FC<any>;
  export const Accordion: FC<any>;

  // Utilities
  export const Link: FC<any>;
  export const Skeleton: FC<any>;
  export const Backdrop: FC<any>;

  // Types
  export type DynoTheme = string;
  export type DynoSurface = string;
  export type DynoStyle = string;
}
