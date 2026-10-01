/**
 * Things that float above the page, and the two that hold rows of data.
 *
 * The overlays share a problem nothing else has: focus. A Modal traps it, a
 * Drawer traps it, a Tooltip must never take it, and a Dialog can be told not
 * to trap it at all. Getting that wrong is invisible with a mouse.
 */
import type { ComponentDoc } from './componentDoc';

const surfaceToken = (name: string, sets: string) =>
  ({ name, sets, variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' });

export const MODAL_DOC: ComponentDoc = {
  name: 'Modal',
  summary: 'Blocks the page with a task the user has to finish or abandon.',
  insteadUse: [
    { when: 'It asks one question with one or two answers', use: 'Dialog' },
    { when: 'It is a message, not a task', use: 'Alert or Snackbar' },
    { when: 'It is a panel the page can carry on around', use: 'Drawer' },
  ],
  props: [
    { name: 'open', type: 'boolean', default: 'undefined' },
    { name: 'onClose', type: 'function', default: 'undefined' },
    { name: 'title', type: 'string', default: 'undefined' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'layout', type: 'string', values: ['center', 'top'], default: 'center' },
    { name: 'transition', type: 'string', default: 'fade' },
    { name: 'closeOnBackdrop', type: 'boolean', default: 'true',
      note: 'Turn it off only when losing the work would be worse than the extra click.' },
    { name: 'showCloseButton', type: 'boolean', default: 'true' },
  ],
  states: [
    { state: 'Open', setBy: 'prop' },
    { state: 'Focus trapped', setBy: 'context', note: 'Automatic while open — do not add your own trap.' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`data-theme` on the modal, or wrap its content in `<Section>`.',
      inFigma: 'Pins nothing and inherits. Set the mode on the frame around it.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the panel'),
    { name: '--Modal-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Other/Modal-Radius' },
    { name: '--Modal-Padding', sets: 'inner padding', variesWith: 'size mode', figma: 'Other/Modal-Padding' },
    { name: '--Modal-Focus-Radius', sets: 'focus ring corner', variesWith: 'size mode', figma: '—' },
  ],
  composition: ['Title as a prop, body as children, actions at the end of the children.'],
  accessibility: [
    'Focus moves in on open and returns to whatever opened it on close. Both are handled.',
    'Escape closes it. Do not intercept the key without providing another way out.',
    'A modal with no focusable element traps keyboard users — give it at least a close button.',
  ],
  gotchas: [
    '`Modal-Radius` equals `Card-Radius` rather than being its own value: a floating panel is a card that happens to float, and two numbers for one shape drift.',
    'Elevation 5, the top of the scale, and it cannot be raised further — a modal is already above everything.',
  ],
};

export const DIALOG_DOC: ComponentDoc = {
  name: 'Dialog',
  summary: 'Asks one question and waits for the answer.',
  insteadUse: [
    { when: 'It is a form or a multi-step task', use: 'Modal' },
    { when: 'Nothing needs answering', use: 'Snackbar' },
  ],
  props: [
    { name: 'open', type: 'boolean', default: 'false' },
    { name: 'title', type: 'string', default: 'undefined' },
    { name: 'actions', type: 'ReactNode', default: 'undefined', note: 'The answers. Two is the usual maximum.' },
    { name: 'maxWidth', type: 'string', values: ['xs', 'sm', 'md', 'lg'], default: 'sm' },
    { name: 'fullScreen', type: 'boolean', default: 'false' },
    { name: 'alert', type: 'boolean', default: 'false', note: 'Announces assertively and cannot be dismissed by the backdrop — for destructive or blocking questions.' },
    { name: 'nonModal', type: 'boolean', default: 'false', note: 'Stops it trapping focus. Rare, and it stops being a dialog in the accessibility sense.' },
  ],
  states: [
    { state: 'Open', setBy: 'prop' },
    { state: 'Focus trapped', setBy: 'prop', note: 'On unless `nonModal`.' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on the dialog or an ancestor.',
      inFigma: 'Pins nothing and inherits.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the panel'),
    { name: '--Modal-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Other/Modal-Radius' },
  ],
  composition: ['Title, message as children, answers in `actions`.'],
  accessibility: [
    'The destructive answer should not be the default focus.',
    'Label the actions with the verb — "Delete", not "OK". "OK" to "Are you sure?" is unanswerable when read aloud.',
    '`alert` makes it `role="alertdialog"`, which interrupts. Use it for consequences, not for confirmations.',
  ],
  gotchas: [
    'Dialog and Modal share their elevation and shadow — the FAB-Hover, Dialog and Modal levels are the same geometry. They differ by role, not by depth.',
  ],
};

export const DRAWER_DOC: ComponentDoc = {
  name: 'Drawer',
  summary: 'A panel that slides in from an edge and can be dismissed.',
  insteadUse: [
    { when: 'It must be answered before anything else', use: 'Modal' },
    { when: 'It is permanent navigation', use: 'Rail or Sidebar' },
    { when: 'It rises from the bottom on a phone', use: 'Sheet' },
  ],
  props: [
    { name: 'open', type: 'boolean', default: 'false' },
    { name: 'anchor', type: 'string', values: ['left', 'right', 'top', 'bottom'], default: 'left' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'hideBackdrop', type: 'boolean', default: 'false', note: 'Without a backdrop it no longer reads as temporary — and it stops trapping focus.' },
    { name: 'onClose', type: 'function', default: 'undefined' },
  ],
  states: [
    { state: 'Open', setBy: 'prop' },
    { state: 'Focus trapped', setBy: 'prop', note: 'Unless `hideBackdrop`.' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on the drawer or an ancestor.',
      inFigma: 'Pins nothing and inherits.' },
  ],
  tokens: [surfaceToken('--Background', 'the panel'), surfaceToken('--Border', 'the edge against the page')],
  composition: ['Children are yours. A drawer adds the surface, the slide and the dismiss.'],
  accessibility: [
    'Escape closes it, and focus returns to the trigger.',
    'A drawer holding navigation should be a `<nav>`, not a generic region.',
  ],
  gotchas: [
    '`hideBackdrop` changes more than the visuals: without it the drawer stops trapping focus and becomes a permanent panel that happens to slide.',
  ],
};

export const TOOLTIP_DOC: ComponentDoc = {
  name: 'Tooltip',
  summary: 'Names or explains the control it is attached to, on hover or focus.',
  insteadUse: [
    { when: 'The content is essential', use: 'visible text — a tooltip is not readable on touch' },
    { when: 'It is interactive or holds links', use: 'Popover' },
    { when: 'It reports an error', use: "the field's validation message" },
  ],
  props: [
    { name: 'title', type: 'ReactNode', default: 'undefined', note: 'The content. Keep it to a phrase.' },
    { name: 'placement', type: 'string', values: ['top', 'bottom', 'left', 'right'], default: 'bottom' },
    { name: 'color', type: 'string', default: 'black-white',
      note: 'Which Buttons mode paints the bubble. The default matches the mode Figma pins on `Button-Theme-Tooltip`; pass another palette to recolour.' },
    { name: 'arrow', type: 'boolean', default: 'true',
      note: 'On by default — every Figma variant carries the arrow, and the component root uses a -2px gap to seat it against the bubble.' },
    { name: 'enterDelay', type: 'number', default: '100' },
    { name: 'leaveDelay', type: 'number', default: '0' },
    { name: 'describeChild', type: 'boolean', default: 'false',
      note: 'Switches it from NAMING the child to DESCRIBING it — `aria-describedby` rather than `aria-label`. Use it when the child already has a name.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus', setBy: 'interaction', note: 'A tooltip that only appears on hover is unreachable by keyboard.' },
  ],
  theming: [
    { collection: 'Buttons', inCode: '`color` — `<Tooltip color="primary">` resolves the bubble to `--Buttons-Primary-Button`. Defaults to `black-white`.',
      inFigma: 'One pin, on the inner `Button-Theme-Tooltip` frame: `Buttons = black-white`. The bubble, the arrow, the label and the icon all inherit it, so that frame is the only place to change a tooltip\'s colour.' },
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Pins nothing and inherits — deliberately. The drop shadow sits on the component ROOT, one level above the themed frame, so it reads the ambient surface rather than the tooltip\'s own colour.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the bubble and its arrow', variesWith: 'Buttons mode + surface',
      figma: 'Buttons → Button' },
    { name: '--Buttons-{Color}-Text', sets: 'the label and any icon in it', variesWith: 'Buttons mode + surface',
      figma: 'Buttons → Text' },
    { name: '--Buttons-{Color}-Border', sets: 'the edge, outline variant only', variesWith: 'Buttons mode + surface',
      figma: 'Buttons → Border' },
    { name: '--Effect-Level-2', sets: 'the drop shadow', variesWith: 'elevation mode',
      figma: 'Component-Elevations → AppBar, Toolbars, Menus' },
  ],
  composition: ['It wraps the element it describes. The child must be able to hold a ref and take focus.'],
  accessibility: [
    'Never put the only copy of something important in a tooltip — touch users get no hover.',
    '`describeChild` is the difference between replacing a control\'s name and adding to it. Naming a button "Save" that already says "Save" announces it twice.',
  ],
  gotchas: [
    'A tooltip on a `disabled` control never shows: a disabled element fires no pointer events. Wrap it in a span if the explanation matters.',
    'The bubble is a Buttons colour, not a surface colour. It used to read `--Background`, which painted it the colour of whatever it floated over and left no way to recolour it. `variant="light"` still works, because the Buttons tokens are surface-aware and light moves the SURFACE rather than tinting the fill.',
  ],
};

export const TABLE_DOC: ComponentDoc = {
  name: 'Table',
  summary: 'Rows and columns of data that the reader compares across both axes.',
  insteadUse: [
    { when: 'Each row is a thing rather than a set of values', use: 'List' },
    { when: 'There is one column', use: 'List' },
    { when: 'It is layout, not data', use: 'Grid' },
  ],
  props: [
    { name: 'columns', type: 'array', default: 'undefined' },
    { name: 'rows', type: 'array', default: 'undefined' },
    { name: 'footerRows', type: 'array', default: 'undefined' },
    { name: 'variant', type: 'string', default: 'default' },
    { name: 'loading', type: 'boolean', default: 'false', note: 'Draws `skeletonRows` placeholder rows rather than an empty table.' },
    { name: 'skeletonRows', type: 'number', default: '3' },
    { name: 'empty', type: 'ReactNode', default: 'undefined', note: 'What to show when there are no rows. Without it an empty table reads as a broken one.' },
    { name: 'error', type: 'ReactNode', default: 'undefined' },
  ],
  states: [
    { state: 'Loading', setBy: 'prop' },
    { state: 'Empty', setBy: 'prop' },
    { state: 'Error', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Table Header Row and Table Body Row pin nothing and inherit.' },
  ],
  tokens: [
    surfaceToken('--Background', 'row fills'),
    surfaceToken('--Border-Variant', 'the row rules'),
    surfaceToken('--Hover', 'row hover'),
  ],
  composition: [
    'Data goes in `columns` and `rows`, not as children — the component owns the markup so the header and cells stay associated.',
  ],
  accessibility: [
    'Header cells must be headers, not styled body cells; that association is what lets a screen reader say which column a value is in.',
    'Loading, empty and error each need their own message. A blank table says nothing about which it is.',
  ],
  gotchas: [
    'Row separators use `--Border-Variant`, not `--Border`. Variant is decorative and carries no contrast requirement; `--Border` is for anything that outlines a control.',
  ],
};

export const LIST_DOC: ComponentDoc = {
  name: 'List',
  summary: 'A stack of items where each row is one thing.',
  insteadUse: [
    { when: 'Rows are compared across columns', use: 'Table' },
    { when: 'Items are actions in a floating panel', use: 'Menu' },
    { when: 'Each item is a separate surface', use: 'Card' },
  ],
  props: [
    { name: 'items', type: 'array', default: 'undefined' },
    { name: 'orientation', type: 'string', values: ['vertical', 'horizontal'], default: 'vertical' },
    { name: 'dividers', type: 'boolean', default: 'false' },
    { name: 'clickable', type: 'boolean', default: 'false',
      note: 'Also sets the gap: clickable rows separate by `--Sizing-1`, non-clickable ones sit at 0 and are joined by hairlines.' },
    { name: 'selectionMode', type: 'string', values: ['none', 'single', 'multiple'], default: 'none' },
    { name: 'loading', type: 'boolean', default: 'false' },
    { name: 'empty', type: 'ReactNode', default: 'undefined' },
    { name: 'error', type: 'ReactNode', default: 'undefined' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Only when `clickable`.' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected', setBy: 'prop' },
    { state: 'Loading / Empty / Error', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'List and List Item pin nothing and inherit.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the row fill'),
    { name: '--List-Item-Radius', sets: 'row corner', variesWith: 'size mode', figma: 'List-item/List-Item-Radius' },
    { name: '--List-Item-Padding', sets: 'inner padding', variesWith: 'size mode', figma: 'List-item/List-Item-Padding' },
    { name: '--List-Item-Gap', sets: 'the gap between rows', variesWith: 'size mode', figma: 'List-item/List-Item-Gap' },
    { name: '--List-Item-Focus-Radius', sets: 'the inset focus ring', variesWith: 'size mode', figma: 'List-item/List-Item-Focus-Radius' },
    { name: '--List-Item-Default-Image-Width', sets: 'the thumbnail', variesWith: 'size mode', figma: 'List-item/List-Item-Default-Image-Width' },
  ],
  composition: [
    'Rows carry `startDecorator` / `endDecorator`. A decorator that is itself a control needs `startDecoratorIsButton` so it becomes one rather than a click target inside a click target.',
  ],
  accessibility: [
    'A clickable row is one target. A button inside it is a second, and nesting them makes the inner one unreachable — that is what the `*IsButton` props exist to avoid.',
    'Selection announces itself; do not add your own `aria-selected`.',
  ],
  gotchas: [
    'The row gap is the row padding, by rule: `listItemGap = listItemPadding`. They were both bound to `Sizing-1` in Figma, so they tracked each other by coincidence until the relationship was stated.',
    'The focus ring is inset 2, not 1, because the row draws its own 1px border. Measured from the drawn edge it is the same 1px clear gap every inner ring has.',
  ],
};

export const OVERLAY_DOCS: ComponentDoc[] = [
  MODAL_DOC, DIALOG_DOC, DRAWER_DOC, TOOLTIP_DOC, TABLE_DOC, LIST_DOC,
];
