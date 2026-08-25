declare module '@omni-design/components' {
  import { FC, ReactNode, CSSProperties } from 'react';

  // Provider
  export const OmniDesignProvider: FC<{
    themeURL?: string;
    foundationCSS?: string;
    coreCSS?: string;
    /** The brand's type ramp. Loads between core and the mode sheets;
     *  without it the lib's bundled typography-tokens.css wins and replaces
     *  the design system's ramp. */
    typographyCSS?: string;
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
  export const Radio: FC<any>;
  export const RadioInput: FC<any>;
  export const RadioGroup: FC<any>;
  export const SwitchInput: FC<any>;
  export const SliderInput: FC<any>;
  export const RatingInput: FC<any>;
  export const SearchField: FC<any>;

  // Chips
  export const Chip: FC<any>;

  // Code
  //
  // Typed properly rather than FC<any>, because the props are the whole API and
  // this file OVERRIDES the package's own .d.ts — anything missing here is
  // missing full stop, however correct the published types are.
  export const CodeBlock: FC<{
    /** The code to display and copy. */
    code?: string;
    /** Header label, e.g. "bash", "JSX", "CSS". */
    language?: string;
    /** Show the copy button. */
    showCopy?: boolean;
    /** Show the header row at all. */
    showHeader?: boolean;
    /** Cap the code area's height and scroll past it. */
    maxHeight?: number | string;
    /** Wrap long lines instead of scrolling horizontally. */
    wrap?: boolean;
    sx?: Record<string, unknown>;
  }>;
  export const CopyButton: FC<{ code: string; label?: string }>;

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
  export const AvatarMenu: FC<any>;
  export const Badge: FC<any>;
  export const Divider: FC<any>;
  export const List: FC<any>;
  export const Slider: FC<any>;
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

  // Components that exist in the lib and are documented in CLAUDE.md, but
  // were never declared here. The lib ships no .d.ts of its own (package.json
  // points `types` at dist/index.d.ts, which rollup does not emit), so this
  // hand-written shim IS the type surface — and it silently drifts behind the
  // lib every time a component is added.
  export const Section: FC<any>;
  export const Icon: FC<any>;
  export const DisplaySmall: FC<any>;
  export const AccordionGroup: FC<any>;
  export const AccordionSummary: FC<any>;
  export const AccordionDetails: FC<any>;
  export const TextArea: FC<any>;
  export const OverlineSmall: FC<any>;
  export const ListItem: FC<any>;
  export const EmailTextField: FC<any>;
  export const BreadcrumbItem: FC<any>;
}
