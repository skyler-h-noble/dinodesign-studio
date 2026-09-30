/**
 * Which Figma component sets back each library component.
 *
 * WRITTEN OUT, not derived, because the two sides genuinely disagree and no
 * rule reconciles them:
 *
 *   one page, several sets   Tabs holds `Tabs` and `Tab`; Stepper holds four.
 *                            21 of 48 pages do this, and the sets map to
 *                            separate exports — Tabs/TabList/Tab, not one.
 *   different names          page `FAB` against export `Fab`; page
 *                            `Data Visualization` against `Charts`; `Dropdown`
 *                            exported from the `Menu` directory.
 *   no counterpart           seven pages have no component, thirteen
 *                            components have no page.
 *
 * A generator that guessed would be right for most rows and quietly wrong for
 * the rest, which is worse than a table — a wrong Figma link resolves, it just
 * opens the wrong node.
 *
 * PAGE NAMES ARE THE KEY, not node ids. Ids are per COPY of the template: a
 * user imports the .fig, so theirs are their own, and the plugin reports them
 * at link time. Names survive copying. A user who renames a page stops
 * matching — visible — where an id would resolve to something else.
 *
 * Captured from the library file on 2026-09-30 (77 sets over 48 pages).
 */

export interface FigmaComponentMapping {
  /** The Figma PAGE, by name. */
  page: string;
  /**
   * The component sets on it that this component is made of, in the order a
   * reader wants them: the whole thing first, then its parts.
   */
  sets: string[];
  /** Why this row is not a plain name match, where it isn't obvious. */
  note?: string;
}

/** Library export name -> where it lives in Figma. */
export const FIGMA_COMPONENT_MAP: Record<string, FigmaComponentMapping> = {
  Accordion:         { page: 'Accordion', sets: ['Accordion Group', 'Accordion Segment'] },
  Alert:             { page: 'Alert', sets: ['Alert'] },
  AppBar:            { page: 'AppBar', sets: ['AppBar'] },
  Avatar:            { page: 'Avatar', sets: ['Avatar'] },
  Badge:             { page: 'Badge', sets: ['Badge Counter'] },
  Box:               { page: 'Box', sets: ['Box'] },
  Breadcrumbs:       { page: 'Breadcrumbs', sets: ['Breadcrumb-Segments', 'Breadcrumbs-separator'] },
  Button:            { page: 'Button', sets: ['Button'] },
  ButtonGroup:       { page: 'ButtonGroup',
                       sets: ['ButtonGroup', 'Button-Group-Segments', 'Separated-Button-Segments'],
                       note: 'Two segment sets: connected segments carry left/center/right end caps, separated ones do not.' },
  Card:              { page: 'Card', sets: ['Card', 'Quote Cards', 'Card Content / Ecommerce'] },
  Charts:            { page: 'Data Visualization', sets: ['Bar-Basic'],
                       note: 'The page is named for the discipline, the export for the component.' },
  Checkbox:          { page: 'Checkbox', sets: ['Checkbox'] },
  Chip:              { page: 'Chip', sets: ['Chip'] },
  Dialog:            { page: 'Dialog', sets: ['Dialog'] },
  Divider:           { page: 'Divider', sets: ['Divider'] },
  Drawer:            { page: 'Drawer', sets: ['Drawer'] },
  Fab:               { page: 'FAB', sets: ['FAB'],
                       note: 'Figma says FAB, the export says Fab. Every one of the ~110 FAB variables spells it FAB, and renaming the export would break consumers — so the two differ on purpose.' },
  Icon:              { page: 'Icon', sets: ['Icon'] },
  Input:             { page: 'Input', sets: ['Input', 'Input Buttons', 'Input Text Style'] },
  Link:              { page: 'Link', sets: ['Link', 'Hotlink Group'] },
  List:              { page: 'List', sets: ['List', 'List Item'] },
  Loader:            { page: 'Loader', sets: ['Loader'] },
  Menu:              { page: 'Dropdown', sets: ['Dropdown', 'Drop Down Menu'],
                       note: 'The directory is Menu; it exports Dropdown, MenuButton, Menu, MenuItem and MenuDivider. The page is named for the thing you open.' },
  Modal:             { page: 'Modal', sets: ['Modal', 'Modal with overlay'] },
  NumberField:       { page: 'NumberField', sets: ['Field Button'],
                       note: 'Only the increment button is a set; the field itself is drawn from Input.' },
  Pagination:        { page: 'Pagination', sets: ['Pagination Number'] },
  Progress:          { page: 'Progress Indicators', sets: ['Progress Bar', 'Progress Dial'],
                       note: 'One page for what the library splits into CircularProgress, LinearProgress and Progress.' },
  Radio:             { page: 'Radio', sets: ['Radio Group', 'Radio'] },
  Rail:              { page: 'Rail', sets: ['Nav Rail', 'Nav Rail Item', 'Expandable Nav Rail Item', 'Drawer Title'] },
  Rating:            { page: 'Rating', sets: ['Rating', 'Star'] },
  Ratio:             { page: 'Ratio', sets: ['Ratio - Fill Horizontal', 'Ratio - Fill Vertical'] },
  Sheet:             { page: 'Sheet', sets: ['Sheet'] },
  Slider:            { page: 'Slider', sets: ['Slider', 'Slider-thumb Horizontal', 'Slider-thumb Vertical'] },
  Snackbar:          { page: 'Snackbar', sets: ['Snackbar', 'Snack'] },
  SpeedDial:         { page: 'SpeedDial', sets: ['SpeedDial'] },
  Stepper:           { page: 'Stepper', sets: ['Stepper', 'Count Step', 'No-Count Step', 'Step - Line'] },
  Switch:            { page: 'Switch', sets: ['Switch'] },
  Table:             { page: 'Table', sets: ['Table Header Row', 'Table Body Row'] },
  Tabs:              { page: 'Tabs', sets: ['Tabs', 'Tab'],
                       note: 'Tabs is the container, Tab one row. The library also exports TabList, which Figma folds into Tabs.' },
  Tag:               { page: 'Tag', sets: ['Tag'] },
  Tooltip:           { page: 'Tooltip', sets: ['Tooltip'] },
  TransferList:      { page: 'TransferList', sets: ['TransferList'] },
  TreeView:          { page: 'TreeView', sets: ['TreeView', 'Menu Item'] },
  /* A page with no component sets: type specimens, not components. Mapped so
     the doc can link the page, with nothing to link inside it. */
  Typography:        { page: 'Typography', sets: [] },
  BottomNavigation:  { page: 'NavBar', sets: ['Nav-Bar', 'Nav Item'],
                       note: 'The page is NavBar; its Nav-Bar set carries a "Floating +Raised FAB" style and a Nav Item at Default/Selected, which is a bottom navigation bar.' },
};

/**
 * Library components with no Figma page.
 *
 * Listed rather than omitted: a component missing from the map is
 * indistinguishable from one nobody has added yet, and the doc needs to say
 * "no Figma counterpart" instead of showing an empty section.
 *
 * Two kinds, and only the first is a gap:
 *   DRAWN but undesigned — Autocomplete, Select, TextField, SearchField,
 *     Popover, Paper, Sidebar, Toolbar, CodeBlock, IconBadge, DropZone,
 *     StateMessage. Real UI a designer would expect to find.
 *   NOT DRAWABLE — Container, Grid, Stack, Spacing, Section, MainLayout,
 *     Showcase, Colors, BevelText, CurvedText, Copyright, Footer, Gradient.
 *     Layout and infrastructure; there is nothing to put on a page.
 */
export const NO_FIGMA_PAGE = {
  undesigned: [
    'Autocomplete', 'Select', 'TextField', 'SearchField', 'Popover', 'Paper',
    'Sidebar', 'Toolbar', 'CodeBlock', 'IconBadge', 'DropZone', 'StateMessage',
  ],
  notDrawable: [
    'Container', 'Grid', 'Stack', 'Spacing', 'Section', 'MainLayout',
    'Showcase', 'Colors', 'BevelText', 'CurvedText', 'Copyright', 'Footer',
    'Gradient',
  ],
  /**
   * Out of scope for now.
   *
   * ToggleButtonGroup is retired — a shim onto ButtonGroup, and it should
   * never get a page. ToggleButton has a Figma page but no component set: it
   * is drawn, not built, and the design is still being settled. Documenting a
   * component whose design is in flux teaches the wrong thing, so it stays off
   * the list until the set exists.
   */
  deferred: ['ToggleButtonGroup', 'ToggleButton'],
} as const;

/**
 * Figma pages with no library component.
 *
 * The other direction, and the more useful list: these are designed and
 * unbuilt, so they are the build queue rather than a documentation gap.
 */
export const NO_LIBRARY_COMPONENT = [
  'Carousel', 'Date Picker', 'ImagePlaceholder', 'Player',
  'Status Bar', 'Text Editor',
] as const;

/** Pages that are not components at all, and should never be matched. */
export const NON_COMPONENT_PAGES = [
  'Almost Theme! - Import your Dino Design', 'Page 13', 'Adaptive Templates',
  'Brand', 'Forms', 'Hero', 'Shapes', 'Design to Code Test',
] as const;

/** Where a library component lives in Figma, or null if it has no page. */
export function figmaMappingFor(component: string): FigmaComponentMapping | null {
  return FIGMA_COMPONENT_MAP[component] || null;
}
