/**
 * Navigation.
 *
 * The family where the accessibility section does the most work: every one of
 * these is a set of links or a set of tabs, and which it is decides the roles,
 * the keyboard behaviour and whether "selected" is a state or a URL.
 */
import type { ComponentDoc } from './componentDoc';

const surfaceToken = (name: string, sets: string) =>
  ({ name, sets, variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' });

export const APPBAR_DOC: ComponentDoc = {
  name: 'AppBar',
  summary: 'The bar across the top of an application, carrying the brand, navigation and account.',
  insteadUse: [
    { when: 'It is the primary navigation down the side', use: 'Rail or Sidebar' },
    { when: 'It is the primary navigation at the bottom on a phone', use: 'BottomNavigation' },
    { when: 'It is a row of actions on a selection or a panel', use: 'Toolbar' },
  ],
  props: [
    { name: 'mode', type: 'string', values: ['desktop', 'mobile'], default: 'desktop' },
    { name: 'barColor', type: 'string', default: 'default' },
    { name: 'surface', type: 'string', default: 'Surface' },
    { name: 'brandType', type: 'string', values: ['name', 'logo', 'both'], default: 'name' },
    { name: 'menuType', type: 'string', values: ['hamburger', 'none'], default: 'hamburger' },
    { name: 'loginType', type: 'string', default: 'login' },
    { name: 'navLinks', type: 'array', default: "['Home', 'Products', 'About']" },
    { name: 'centerSlot / endSlot', type: 'ReactNode', default: 'undefined', note: 'For anything the props do not cover — search, a status chip, a second action.' },
  ],
  states: [
    { state: 'Scrolled', setBy: 'interaction', note: 'Where the bar elevates on scroll, the elevation is the bar’s own property, not the page’s.' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`barColor` and `surface`, or `data-theme` on an ancestor.',
      inFigma: 'Set the Theme mode on `Theme-Container` — **not** the variant root, which carries five drop shadows and must keep reading the page.' },
  ],
  themingNotes: [
    'The root pins `Elevation=Level-2`, its own property, and inherits Theme. That split is what keeps a Primary app bar from casting a Primary-tinted shadow on a neutral page.',
    'Once a user has a design system, the AppBar inherits its parent `data-theme` rather than carrying the DinoDesign brand — the brand belongs on the landing and pre-system pages only.',
  ],
  tokens: [
    surfaceToken('--Background', 'the bar'),
    surfaceToken('--Text', 'links and title'),
    { name: '--App-Bar-Height', sets: 'the bar height', variesWith: 'size mode + device', figma: 'Other/App-Bar-Height' },
  ],
  composition: [
    'Brand, nav and account are props. `centerSlot` and `endSlot` take anything else — do not nest a second bar.',
  ],
  accessibility: [
    'It is a `<header>` with a `<nav>` inside, not a row of buttons.',
    'The current page link needs `aria-current="page"`; colour alone does not say which one you are on.',
  ],
  gotchas: [
    '`Other/App-Bar-Height` was `App-Bar Height` with a space until 2026-09-30. Its sibling `Nav-Bar Height` still has one, because the rule is "use the file’s name", not "hyphenate".',
  ],
};

export const RAIL_DOC: ComponentDoc = {
  name: 'Rail',
  summary: 'A narrow column of primary destinations down the side, always visible.',
  insteadUse: [
    { when: 'It slides in and can be dismissed', use: 'Drawer' },
    { when: 'It is wide and holds nested navigation', use: 'Sidebar' },
    { when: 'It is at the bottom of a phone screen', use: 'BottomNavigation' },
  ],
  props: [
    { name: 'items', type: 'array', default: '[]' },
    { name: 'sections', type: 'array', default: 'undefined' },
    { name: 'defaultValue', type: 'number', default: '0' },
    { name: 'expandable', type: 'boolean', default: 'false' },
    { name: 'expandedWidth', type: 'string', values: ['partial', 'full'], default: 'partial' },
    { name: 'labelStyle', type: 'string', values: ['contained', 'outside'], default: 'contained',
      note: 'Whether the label sits inside the item’s target or beneath it. It changes the hit area, not just the look.' },
    { name: 'fabAction', type: 'object', default: 'undefined' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'An OUTSIDE ring — the rail is the only component drawing its ring outside the node.' },
    { state: 'Selected', setBy: 'context', note: 'From the rail’s value, not set per item.' },
    { state: 'Expanded', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on the rail or an ancestor.',
      inFigma: 'Nav Rail pins Theme on its variant ROOT. Nav Rail Item and Expandable Nav Rail Item pin nothing.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the rail'),
    surfaceToken('--Hover', 'item hover'),
    { name: '--Rail-Width', sets: 'the column', variesWith: 'size mode', figma: 'Other/Rail-Width' },
  ],
  composition: ['Items are data, not children. A `fabAction` puts a FAB at the top without nesting one yourself.'],
  accessibility: [
    'A `<nav>` with a list of links. The selected one needs `aria-current`.',
    'Icon-only items need labels — `labelStyle` controls where the label shows, never whether it exists.',
  ],
  gotchas: [
    'Its focus rings are drawn OUTSIDE, unlike every other component. `Nav Rail Item` insets 1px, `Expandable Nav Rail Item` sits flush top and bottom — the second is deliberate, since a wide row in a stack would otherwise overlap its neighbour.',
  ],
};

export const BOTTOMNAV_DOC: ComponentDoc = {
  name: 'BottomNavigation',
  summary: 'Three to five top-level destinations along the bottom of a phone screen.',
  insteadUse: [
    { when: 'There are more than five', use: 'Drawer or a More item' },
    { when: 'They are views inside one screen', use: 'Tabs' },
    { when: 'It is a desktop layout', use: 'AppBar or Rail' },
  ],
  props: [
    { name: 'items', type: 'array', default: '[]' },
    { name: 'defaultValue', type: 'number', default: '0' },
    { name: 'showLabels', type: 'boolean', default: 'true', note: 'Icons alone are guessable at best. Turn this off only where the icons are genuinely universal.' },
    { name: 'variant', type: 'string', values: ['fixed', 'floating'], default: 'fixed' },
    { name: 'barColor', type: 'string', default: 'default' },
    { name: 'fabAction', type: 'object', default: 'undefined', note: 'Raises a FAB into the bar — the "Floating +Raised FAB" style in Figma.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected', setBy: 'context' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`barColor`, or `data-theme` on an ancestor.',
      inFigma: 'Set the Theme mode on `Theme-Container`, on the **NavBar** page. The set is called `Nav-Bar` and the item `Nav Item`.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the bar'),
    surfaceToken('--Text', 'the selected item'),
    surfaceToken('--Quiet', 'unselected items'),
    { name: '--Nav-Bar Height', sets: 'the bar height', variesWith: 'size mode + device', figma: 'Other/Nav-Bar Height' },
  ],
  composition: ['Items are data. The FAB comes from `fabAction` rather than being placed inside.'],
  accessibility: [
    'A `<nav>` of links, with `aria-current` on the active destination.',
    'Three to five items. Fewer is a Tab bar; more does not fit a thumb.',
  ],
  gotchas: [
    'The Figma page is **NavBar** and the library export is **BottomNavigation** — a name pair worth knowing, since neither search finds the other.',
    '`Other/Nav-Bar Height` keeps a space in its name. Its sibling App-Bar-Height was hyphenated; this one was not, and the studio writes whichever the file has.',
  ],
};

export const BREADCRUMBS_DOC: ComponentDoc = {
  name: 'Breadcrumbs',
  summary: 'Shows where the current page sits in the hierarchy, and offers the way back up.',
  insteadUse: [
    { when: 'The steps are a sequence to complete', use: 'Stepper' },
    { when: 'They are peer views', use: 'Tabs' },
    { when: 'The hierarchy is one level deep', use: 'a single back link' },
  ],
  props: [
    { name: 'separator', type: 'string', default: '/' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'maxItems', type: 'number', default: '4', note: 'Above this the middle collapses to an ellipsis.' },
    { name: 'itemsBeforeCollapse', type: 'number', default: '1' },
    { name: 'itemsAfterCollapse', type: 'number', default: '1' },
    { name: 'condense', type: 'boolean', default: 'false' },
    { name: 'backOnlyMobile', type: 'boolean', default: 'false', note: 'Collapses to a single back link on small screens, where a full trail does not fit.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Expanded', setBy: 'interaction', note: 'Clicking the ellipsis reveals the collapsed middle.' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Breadcrumb-Segments and Breadcrumbs-separator pin nothing and inherit.' },
  ],
  tokens: [surfaceToken('--Hotlink', 'the links'), surfaceToken('--Text', 'the current page'), surfaceToken('--Quiet', 'the separator')],
  composition: ['Each crumb is a child. The last one is the current page and is not a link.'],
  accessibility: [
    'A `<nav>` with `aria-label="Breadcrumb"`, an ordered list inside.',
    'The last crumb carries `aria-current="page"` and must not be a link — linking to where you already are is a dead end for keyboard users.',
  ],
  gotchas: [
    'The separator is decorative and hidden from screen readers. Do not replace it with a character that carries meaning.',
  ],
};

export const PAGINATION_DOC: ComponentDoc = {
  name: 'Pagination',
  summary: 'Moves between pages of a long result set.',
  insteadUse: [
    { when: 'Results load as the user scrolls', use: 'no control at all' },
    { when: 'It is a sequence of steps', use: 'Stepper' },
    { when: 'There are only a few pages', use: 'Tabs' },
  ],
  props: [
    { name: 'count', type: 'number', default: '10' },
    { name: 'defaultPage', type: 'number', default: '1' },
    { name: 'theme / surface', type: 'string', default: 'undefined', note: 'Puts data-theme / data-surface on the root. Absent means inherit.' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'siblingCount', type: 'number', default: '1' },
    { name: 'boundaryCount', type: 'number', default: '1' },
    { name: 'showFirstButton / showLastButton', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Current page', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop', note: 'Previous on page 1, Next on the last.' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'Pagination Number pins nothing and inherits.' },
  ],
  tokens: [surfaceToken('--Text', 'page numbers'), surfaceToken('--Hover', 'hover'), surfaceToken('--Background', 'the current page')],
  composition: ['Page numbers are generated from `count` — do not render them yourself.'],
  accessibility: [
    'A `<nav>` labelled "Pagination", with `aria-current="page"` on the current number.',
    'Each number needs an accessible name that says what it does — "Go to page 4", not "4".',
  ],
  gotchas: [
    '`siblingCount` and `boundaryCount` decide how many numbers show either side of the current page and at the ends. Setting both to 0 leaves only arrows, which works but gives no sense of position.',
  ],
};

export const TREEVIEW_DOC: ComponentDoc = {
  name: 'TreeView',
  summary: 'A hierarchy that expands and collapses in place.',
  insteadUse: [
    { when: 'It is flat', use: 'List' },
    { when: 'Each branch is a panel of content', use: 'Accordion' },
    { when: 'It is navigation with two levels', use: 'Rail with sections' },
  ],
  props: [
    { name: 'items', type: 'array', default: '[]' },
    { name: 'defaultExpanded', type: 'array', default: '[]' },
    { name: 'selectionMode', type: 'string', values: ['none', 'single', 'multiple'], default: 'none' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'A 3px INNER ring, inset 1px — rows sit shoulder to shoulder, so an outer ring would overlap.' },
    { state: 'Expanded', setBy: 'prop' },
    { state: 'Selected', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'TreeView and Menu Item pin nothing and inherit.' },
  ],
  tokens: [
    surfaceToken('--Text', 'labels'),
    surfaceToken('--Hover', 'row hover'),
    { name: '--Menu-Item-Radius', sets: 'the row corner', variesWith: 'size mode', figma: 'Menu/Menu-Item-Radius' },
  ],
  composition: ['Nesting is data, not markup — a node carries its children rather than a TreeView containing a TreeView.'],
  accessibility: [
    'Arrow keys move and expand; Tab enters and leaves the whole tree, not each row.',
    'Every node reports its level and how many siblings it has. That is what makes a tree navigable without sight of the indentation.',
  ],
  gotchas: [
    'Indentation is a fixed ladder: 8px at level 0, then 28px per level. It is a stated table, not a multiplier, so a deep tree does not run off the panel.',
  ],
};

export const NAV_DOCS: ComponentDoc[] = [
  APPBAR_DOC, RAIL_DOC, BOTTOMNAV_DOC, BREADCRUMBS_DOC, PAGINATION_DOC, TREEVIEW_DOC,
];
