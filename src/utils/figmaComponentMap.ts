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
  /* Designed 2026-10-01, so it moves out of NO_FIGMA_PAGE.undesigned. The page
     holds a lone COMPONENT rather than a set — CodeBlock has no variant axis,
     it is one shape whose content changes. */
  CodeBlock:         { page: 'CodeBlock', sets: ['CodeBlock'] },
  Drawer:            { page: 'Drawer', sets: ['Drawer'] },
  Fab:               { page: 'FAB', sets: ['FAB'],
                       note: 'Figma says FAB, the export says Fab. Every one of the ~110 FAB variables spells it FAB, and renaming the export would break consumers — so the two differ on purpose.' },
  /* The Icon page is a FONT now, not a glyph library.
     It carried ~1,500 icon components and the template's own components used
     FIFTEEN of them — home, chevron_left, chevron_right, photo, error, info,
     check_circle, warning, flight, hotel, local_dining, directions_car,
     star_purple500, star_border_purple500, arrow_drop_down. A 99% carrying
     cost, paid by every clone and every scan over the file.
     So the glyph is a TEXT layer in Material Icons, and the Icon component set
     carries a Style variant for the three families Figma has — Default, Round,
     Sharp. All three are FILLED; the legacy Outlined and Two Tone families are
     not available in Figma, so outline comes from the ligature instead
     (info vs info_outline, star vs star_border), which is also what makes it
     survive conversion: the style is in the NAME, and the name is what
     figmaToCode reads. */
  Icon:              { page: 'Icon', sets: ['Icon'] },
  Input:             { page: 'Input', sets: ['Input', 'Input Buttons', 'Input Text Style'] },
  Link:              { page: 'Link', sets: ['Link', 'Hotlink Group'] },
  List:              { page: 'List', sets: ['List', 'List Item'] },
  Loader:            { page: 'Loader', sets: ['Loader'] },
  /* The menu panel is composed, not drawn once — see the Select note below.
     Menu maps to the ROW because that is the part the library owns as its own
     component; the panel it opens into is shared with Select. */
  Menu:              { page: 'MenuItem', sets: ['Menu Item'],
                       note: 'The directory is Menu; it exports Dropdown, MenuButton, Menu, MenuItem and MenuDivider. `Menu Item` has its own page because TreeView and Drop Down Menu both build from it — a menu with submenus IS a tree.' },
  Select:            { page: 'Select', sets: ['Select', 'SelectMenu'],
                       note: '`Select` is the TRIGGER — a Button instance with type = default | multiselect | searchable, a form control holding a value. `SelectMenu` is the panel it opens, itself a TreeView instance built from Menu Item.' },
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
  TreeView:          { page: 'TreeView', sets: ['TreeView'],
                       note: 'Its rows are `Menu Item`, which lives on its own page and is shared with the Select panel. Change it for tree reasons and menus inherit that.' },
  /* A FOUNDATION in Figma and a COMPONENT in code.
     The page carries text styles, not component sets — there is nothing to
     instance — while the library exports Typography, H1..H6, Body, Caption and
     the rest as real components. So it is mapped (the page is worth linking:
     it is where the type scale is) with no sets, and an empty `sets` here
     means "styles, not components" rather than "not built yet". */
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
 *     Popover, Paper, Sidebar, Toolbar, IconBadge, DropZone,
 *     StateMessage. Real UI a designer would expect to find.
 *   NOT DRAWABLE — Container, Grid, Stack, Spacing, Section, MainLayout,
 *     Showcase, Colors, BevelText, CurvedText, Copyright, Footer, Gradient.
 *     Layout and infrastructure; there is nothing to put on a page.
 */
export const NO_FIGMA_PAGE = {
  undesigned: [
    'Autocomplete', 'TextField', 'SearchField', 'Popover', 'Paper',
    'Sidebar', 'Toolbar', 'IconBadge', 'DropZone', 'StateMessage',
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
