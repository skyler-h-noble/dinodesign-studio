/**
 * Icon, and the components that float above the page.
 *
 * Between them these cover the parts of the system nothing else documents: the
 * Icons collection (Icon, Tag), the shadow/theme split with a PINNED
 * Theme-Container (Fab, Snackbar), and an UNPINNED one (Accordion).
 */
import type { ComponentDoc } from './componentDoc';

const surfaceToken = (name: string, sets: string) =>
  ({ name, sets, variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' });

export const ICON_DOC: ComponentDoc = {
  name: 'Icon',
  summary: 'Wraps an icon glyph so it takes a system color and size. Decorative unless you name it.',
  insteadUse: [
    { when: 'It is clickable', use: 'Button with iconOnly' },
    { when: 'It is a person or entity', use: 'Avatar' },
    { when: 'It carries a count', use: 'Badge' },
  ],
  props: [
    { name: 'color', type: 'string', default: 'default',
      values: ['default', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error', 'quiet'],
      note: 'Picks the Icons mode. This is the only way to recolor an icon — do not pass `style={{ color }}`.' },
    { name: 'size', type: 'string', values: ['xxs', 'xs', 'small', 'medium', 'large', 'xl', 'xxl'], default: 'medium' },
    { name: 'twoTone', type: 'boolean', default: 'false', note: 'Draws the glyph in the icon color with its secondary shapes at the variant alpha.' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [{ state: 'Disabled', setBy: 'prop', note: 'An icon is decoration; it has no interactive states of its own.' }],
  theming: [
    { collection: 'Icons',
      inCode: '`color` — `<Icon color="primary">`. It resolves to `--Icons-Primary`.',
      inFigma: 'The Icon component binds `Vector → Icon` from the Icons collection and pins nothing, so it inherits. Set the Icons mode on it or an ancestor.' },
  ],
  themingNotes: [
    'The Icons collection is 3 variables across 10 modes, the same shape as Buttons. Before it existed each color was its own variable in Surface, so a component had to bind to ONE — which is why Badge could only ever be an error badge in Figma.',
    'In CSS there are no modes: the generator flattens each one into a name, so `--Icons-Primary` is what a consumer writes and always has been.',
  ],
  tokens: [
    { name: '--Icons-{Color}', sets: 'the glyph', variesWith: 'theme + surface', figma: 'Icons → Icon' },
    { name: '--Icons-Variant-{Color}', sets: "the glyph's secondary shapes", variesWith: 'theme + surface', figma: 'Icons → Icon-Variant' },
    { name: '--Icons-On-{Color}', sets: 'a glyph sitting ON that color', variesWith: 'theme + surface', figma: 'Icons → On-Icon' },
    { name: '--Icon-Size', sets: 'the glyph box', variesWith: 'size mode', figma: 'Icons & Avatars → Icon-Size' },
  ],
  composition: [
    'Pass a MUI icon as the child — `<Icon color="primary"><CheckIcon/></Icon>`. The wrapper is what makes it take a system color.',
  ],
  accessibility: [
    'Icons are `aria-hidden` by default. That is correct: an icon beside a label is decoration, and announcing it repeats the label.',
    'An icon carrying meaning on its own needs an `aria-label` — but if it is also clickable, the name belongs on the Button, not the Icon, or it is announced twice.',
  ],
  gotchas: [
    '`Icons & Avatars` sounds like a color collection and is not — it holds Icon-Size and Avatar-Size, and its modes (`in-button`, `in-check`, `xxs`…) are SIZES. A containing component pins it automatically; you never choose it.',
    'The variant alpha is one flat number across every theme and surface (`Colors/Icon-Variant-Opacity`, 50). It was adaptive once; flattening it is what let Figma express it as alias-plus-opacity instead of 192 baked colors.',
  ],
};

export const FAB_DOC: ComponentDoc = {
  name: 'Fab',
  summary: 'The one primary action on a screen, floating above the content.',
  insteadUse: [
    { when: 'It sits in the layout rather than over it', use: 'Button' },
    { when: 'There is more than one action', use: 'SpeedDial' },
    { when: 'It is inside a toolbar or bar', use: 'Button with iconOnly' },
  ],
  props: [
    { name: 'icon', type: 'ReactNode', default: 'undefined' },
    { name: 'label', type: 'string', default: 'undefined', note: 'Shown only when `extended`.' },
    { name: 'variant', type: 'string', values: ['solid', 'outline', 'ghost'], default: 'solid' },
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'extended', type: 'boolean', default: 'false', note: 'Widens it to carry a label beside the icon.' },
    { name: 'ariaLabel', type: 'string', default: 'undefined', note: 'Required unless `extended` — an icon-only FAB has no visible name.' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Rises from elevation 3 to 4.' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`data-theme` on the FAB or an ancestor.',
      inFigma: 'Set the Theme mode on the `Theme-Container` layer — **not** the variant root. The root carries the drop shadows.' },
  ],
  themingNotes: [
    'This is the component the shadow rule exists for. A drop shadow falls on the PAGE, so it has to read the page\'s theme; the fill and bevel belong to the component. Theming the root does both and tints the shadow.',
    'The root pins `Elevation`, which IS the component\'s own property. Theme inherits, elevation is pinned — that is the whole split in one sentence.',
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the fill', variesWith: 'theme + surface', figma: 'Buttons → Button' },
    { name: '--FAB-Width', sets: 'diameter', variesWith: 'size mode', figma: 'FAB/FAB-Width' },
    { name: '--FAB-Icon', sets: 'the glyph', variesWith: 'size mode', figma: 'FAB/FAB-Icon' },
    { name: '--FAB-Focus-Radius', sets: 'the focus ring', variesWith: 'size mode', figma: 'FAB/FAB-Focus-Radius' },
  ],
  composition: ['One icon, or an icon plus a label when `extended`. Nothing else goes inside.'],
  accessibility: [
    'An icon-only FAB needs `ariaLabel` naming the ACTION — "Compose message", not "pencil".',
    'There should be one FAB per screen. Two competing primary actions is a design problem no label fixes.',
  ],
  gotchas: [
    'Its icon sizes are STATED, not derived: 16 / 24 / 32 against widths of 32 / 48 / 56. The large one is 32, not width/2, so the ratio does not describe them.',
    'Elevation 3 at rest, 4 on hover — the highest of any component except Dialog. A FAB that does not appear to float is usually one whose shadow got themed.',
  ],
};

export const SNACKBAR_DOC: ComponentDoc = {
  name: 'Snackbar',
  summary: 'A brief message about something that just happened, which dismisses itself.',
  insteadUse: [
    { when: 'It describes the state of the page and stays', use: 'Alert' },
    { when: 'It needs a decision before anything continues', use: 'Dialog' },
    { when: 'It belongs to one field', use: "the field's validation message" },
  ],
  props: [
    { name: 'open', type: 'boolean', default: 'false' },
    { name: 'color', type: 'string', values: ['info', 'success', 'warning', 'error'], default: 'info' },
    { name: 'variant', type: 'string', default: 'light' },
    { name: 'anchor', type: 'string', values: ['top', 'bottom'], default: 'bottom' },
    { name: 'autoHideDuration', type: 'number', default: 'undefined', note: 'Milliseconds. Omit it and the snackbar stays until dismissed.' },
    { name: 'action', type: 'ReactNode', default: 'undefined', note: 'One action at most — a snackbar is not a dialog.' },
    { name: 'onClose', type: 'function', default: 'undefined' },
  ],
  states: [
    { state: 'Open', setBy: 'prop' },
    { state: 'Auto-hiding', setBy: 'prop', note: '`autoHideDuration` starts the timer; the component calls `onClose`.' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`color` picks the semantic palette. A snackbar rarely wants `data-theme` — the color is the message.',
      inFigma: 'Set the Theme mode on `Theme-Container`. All eight colors are pinned there, one per variant, alongside `Surface-Brightest`.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the bar'),
    surfaceToken('--Text', 'the message'),
    { name: '--SnackBar-Top / --SnackBar-Bottom', sets: 'distance from the edge', variesWith: '—', figma: '—' },
  ],
  composition: [
    'Message as children, one action in `action`, an icon in `startDecorator`.',
    'It positions itself from `anchor` — do not wrap it in your own fixed container.',
  ],
  accessibility: [
    'A snackbar that disappears on a timer is unreadable for anyone who needs longer. Give an action or a dismiss for anything that matters.',
    'It announces politely by default; an error should be assertive so it interrupts.',
  ],
  gotchas: [
    'Its offsets read `var(--SnackBar-Top, 24px)` so a brand can move it, but nothing generates those tokens — the fallback is what ships unless a consumer defines them.',
  ],
};

export const ACCORDION_DOC: ComponentDoc = {
  name: 'Accordion',
  summary: 'Collapses a section of content behind its own heading.',
  insteadUse: [
    { when: 'Only one section may be open and they are peers', use: 'Tabs' },
    { when: 'The content is a sequence', use: 'Stepper' },
    { when: 'It is a menu', use: 'Dropdown' },
  ],
  props: [
    { name: 'variant', type: 'string', values: ['solid', 'outlined', 'ghost'], default: 'solid' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'surface', type: 'string', default: 'undefined' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'spacing', type: 'number', default: '0', note: '0 joins the segments into one block; above 0 they float separately.' },
    { name: 'defaultExpanded', type: 'boolean', default: 'false' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'A lone segment gets an OUTER ring; a stacked one an inner ring, because an outer one would overlap its neighbour.' },
    { state: 'Expanded', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`data-theme` on the accordion or an ancestor.',
      inFigma: 'Set the Theme mode on `Theme-Container`. It is UNPINNED, so an accordion inherits until you choose otherwise — the layer marks the place, it does not fix a color.' },
  ],
  themingNotes: [
    'Its structure is the model for the shadow rule: `Vertical Container` carries four drop shadows, `Theme-Container` inside it carries the fill and stroke. Theme the inner one and the shadow keeps reading the page.',
  ],
  tokens: [
    surfaceToken('--Background', 'the segment fill'),
    surfaceToken('--Border', 'the outline'),
    { name: '--Accordion-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Accordion/Accordion-Radius' },
    { name: '--Accordion-Focus-Radius', sets: 'the outer ring', variesWith: 'size mode', figma: 'Accordion/Accordion-Focus-Radius' },
    { name: '--Accordion-Inner-Focus-Radius', sets: 'the inner ring', variesWith: 'size mode', figma: 'Accordion/Accordion-Inner-Focus-Radius' },
  ],
  composition: ['A summary and a details region per segment; several segments stack into one accordion.'],
  accessibility: [
    'The summary is a button that toggles the details and carries `aria-expanded`.',
    'Do not nest an accordion inside an accordion — the heading levels stop making sense.',
  ],
  gotchas: [
    'Two focus radii, and they are not a mistake: `Accordion-Focus-Radius` is `radius + 3` for the outer ring, `Accordion-Inner-Focus-Radius` is `max(0, radius − 3)` for the inner one. CSS needs neither — a browser draws an outline concentric with the border — but Figma cannot do arithmetic on a variable, so both are stated.',
  ],
};

export const SURFACE_DOCS: ComponentDoc[] = [
  ICON_DOC, FAB_DOC, SNACKBAR_DOC, ACCORDION_DOC,
];
