/**
 * Hand-authored content for the component reference.
 *
 * Three to start — Button, Tabs and Card — because between them they exercise
 * every section: the theming split, states the browser sets, a wrong-component
 * trap, and a value that looks arbitrary until it is explained.
 */
import type { ComponentDoc } from './componentDoc';

export const BUTTON_DOC: ComponentDoc = {
  name: 'Button',
  summary: 'Triggers an action. Not for navigation — a thing that changes the URL is a Link.',
  insteadUse: [
    { when: 'It navigates somewhere', use: 'Link' },
    { when: 'It is one of a set of mutually exclusive options', use: 'ButtonGroup' },
    { when: 'It is the primary action floating over content', use: 'Fab' },
    { when: 'It toggles a single on/off value', use: 'SwitchInput' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'default',
      values: ['default', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error'],
      note: 'Each also takes a `-outline`, `-ghost` or `-text` suffix. **The default is `default`, not `primary`** — use `primary` only where the design explicitly marks it.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'iconOnly', type: 'boolean', default: 'false',
      note: 'Requires an `aria-label`. The library dev-warns without one.' },
    { name: 'elevated', type: 'boolean', default: 'false',
      note: 'Raises it one elevation level; a button is flat at rest and earns its shadow by being hovered.' },
    { name: 'selected', type: 'boolean', default: 'false',
      note: 'For a toggled-on button in a group. Suppresses the hover lift so a selected button does not animate when hovered again.' },
    { name: 'fullWidth', type: 'boolean', default: 'false' },
    { name: 'disabled', type: 'boolean', default: 'false' },
    { name: 'startIcon / endIcon', type: 'ReactNode', default: 'undefined' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: '3px ring, inset 1px from the edge.' },
    { state: 'Disabled', setBy: 'prop', note: 'The `disabled` prop.' },
    { state: 'Selected', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on the button, or on any ancestor — it inherits.',
      inFigma: 'The Button component pins no Theme mode, so it inherits too. Set the mode on the frame it sits in.' },
    { collection: 'Buttons', inCode: '`variant` picks the palette — `variant="success"`.',
      inFigma: 'Set the Buttons mode. Colour is not a variant axis in Figma either — it arrives as a mode.' },
  ],
  themingNotes: [
    'Colour and theme are different things. `variant="success"` picks a palette; a theme moves the whole surface, including the text and border tones that have to stay readable on it.',
    'A button carries no shadow at rest, so theming it is safe. Components that DO — Fab, Chip, AppBar — pin the theme on an inner node instead, so the shadow keeps reading the page.',
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Border', sets: 'the border', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Button-Height', sets: 'height', variesWith: 'size mode + device', figma: 'Button/Button-Height' },
    { name: '--Button-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Button/Button-Radius' },
    { name: '--Button-Focus-Radius', sets: 'focus ring corner', variesWith: 'size mode', figma: 'Button/Button-Focus-Radius' },
    { name: '--Button-Border-Width', sets: 'border thickness', variesWith: '—', figma: 'Button/Button-Border-Width' },
    { name: '--Button-Padding', sets: 'horizontal padding', variesWith: 'size mode', figma: 'Button/Button-Padding' },
  ],
  composition: [
    'Icons go in `startIcon` / `endIcon`, not as children.',
    'A `Badge` anchors to the corner when `badge` is set — do not wrap the button yourself.',
  ],
  accessibility: [
    'An icon-only button needs `aria-label`; a text button must **not** have one, or it is announced twice.',
    'Name the ACTION, not the glyph: `aria-label="Delete item"`, never `aria-label="trash"`.',
    'A name that says nothing — `"button"`, `"JD"`, `"3"` — is an error, not a pass. It satisfies every automated checker and silences the dev warning.',
  ],
  gotchas: [
    'There is no `-light` shape. It was removed in 0.9.0; `variant="{color}-light"` still renders the solid variant and warns once in development, but never write a new one.',
    '`--Button-Border-Width` is 1px and load-bearing: Figma computes seven other tokens from it as `outer - (border x 2)`.',
  ],
};

export const TABS_DOC: ComponentDoc = {
  name: 'Tabs',
  summary: 'Switches between views in the same place. The tab list stays put; only the panel changes.',
  insteadUse: [
    { when: 'The views are sequential', use: 'Stepper' },
    { when: 'Selecting changes the page or URL', use: 'Link or a nav component' },
    { when: 'Panels can be open at once', use: 'Accordion' },
  ],
  props: [
    { name: 'value / defaultValue', type: 'number | string', default: '0',
      note: 'Controlled with `value` + `onChange`, uncontrolled with `defaultValue`.' },
    { name: 'orientation', type: 'string',
      values: ['horizontal', 'vertical-left', 'vertical-right'], default: 'horizontal',
      note: '`vertical` is kept as an alias for `vertical-right`. It decides which edge both the baseline and the indicator sit on.' },
    { name: 'baseline', type: 'boolean', default: 'true',
      note: 'The 1px rule the tabs sit on. Turn it off where the container already separates them — an AppBar\'s own edge, for instance.' },
    { name: 'variant', type: 'string', values: ['standard', 'solid', 'light', 'dark'], default: 'standard' },
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'scrollable', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Draws the indicator at 50%, previewing where selection will land.' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected', setBy: 'context', note: 'Derived from the Tabs `value`, never set on a Tab.' },
    { state: 'Disabled', setBy: 'prop', note: 'On the individual `Tab`.' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`TabList` carries the zone: a `variant` other than `standard` sets `data-theme` + `data-surface` for every tab inside.',
      inFigma: 'Neither the Tabs nor the Tab set pins a Theme mode — both inherit. Set the mode on the frame holding the Tabs instance.' },
    { collection: 'Theme', inCode: '`standard` sets neither, so it inherits the surface it is dropped on.',
      inFigma: 'Same behaviour, and the reason nothing is pinned: a tab bar usually belongs to the region around it.' },
  ],
  tokens: [
    { name: '--Border-Variant', sets: 'the 1px baseline', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Buttons-{Color}-Border', sets: 'the 2px indicator', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Text', sets: 'selected label', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Quiet', sets: 'unselected label', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Hover', sets: 'hover background', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Pressed', sets: 'pressed background', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Focus-Visible', sets: 'the 3px focus ring', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Button-Height', sets: "a tab's minimum height", variesWith: 'size mode + device', figma: 'Button/Button-Height' },
  ],
  composition: [
    '`<Tabs>` wraps `<TabList>` with `<Tab>` children, then `<TabPanel>` per view.',
    'Icons go in `startDecorator` / `endDecorator` on a `Tab`.',
  ],
  accessibility: [
    'Roles, `aria-selected` and arrow-key navigation are handled — do not add them.',
    'An icon-only tab needs an `aria-label`, same rule as Button.',
  ],
  gotchas: [
    'Three thicknesses, deliberately: **baseline 1px, indicator 2px, focus ring 3px**. Each has been collapsed into another at some point.',
    'The focus ring uses `outline-offset: -4px`, not `-3px`. The offset is measured to the outline\'s INNER edge, so a 3px ring at -3px lands flush; -4px leaves the 1px gap the design draws.',
    'The hover mark is 50% of the indicator\'s own token via `color-mix`, not `--Border-Variant` — that is the baseline\'s token, and using it would read as a thicker baseline rather than a hovered tab.',
  ],
};

export const CARD_DOC: ComponentDoc = {
  name: 'Card',
  summary: 'A surface that groups related content. Clickable only when the whole card is one target.',
  insteadUse: [
    { when: 'You only need a background', use: 'Section or Box' },
    { when: 'It is a row in a list', use: 'ListItem' },
    { when: 'It floats above everything and traps focus', use: 'Modal' },
  ],
  props: [
    { name: 'variant', type: 'string', values: ['solid', 'outlined', 'ghost'], default: 'solid' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'surface', type: 'string', default: 'undefined',
      note: 'Overrides the inner content surface. A default-color card uses `Container`; pass `surface="Surface"` when the card is genuinely a Surface-level region, so `--Header` resolves to the Surface tone.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'orientation', type: 'string', values: ['vertical', 'horizontal'], default: 'vertical' },
    { name: 'clickable', type: 'boolean', default: 'false',
      note: 'Makes the whole card a target. Without it the card is not focusable and gets no hover or pressed state.' },
    { name: 'elevated', type: 'boolean', default: 'false' },
    { name: 'selected', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Only when `clickable`.' },
    { state: 'Pressed', setBy: 'interaction', note: 'Only when `clickable`.' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'A 2px ring sitting 3px OUTSIDE the card — outward, unlike Tabs.' },
    { state: 'Selected', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on the card, or wrap it in `<Section>`.',
      inFigma: 'The Card set pins no Theme mode — it inherits. Set the mode on the frame around it.' },
    { collection: 'Theme', inCode: '`surface="Surface"` when the card is a Surface-level region rather than a Container.',
      inFigma: '`Card Content` pins `Surface=Container`, which is what makes the inner content read Container tones. That is the node to change if a card should be a Surface.' },
  ],
  themingNotes: [
    'Never `style={{ background }}`. It paints the box and leaves the text and borders on the parent\'s tone, which breaks the moment the surface flips dark.',
  ],
  tokens: [
    { name: '--Background', sets: 'the card fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Text', sets: 'body copy', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Border', sets: 'the outline', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Card-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Card/Card-Radius' },
    { name: '--Card-Padding', sets: 'inner padding', variesWith: 'size mode', figma: 'Card/Card-Padding' },
    { name: '--Card-Inner-Radius', sets: 'a nested surface corner', variesWith: 'size mode', figma: 'Card/Card-Inner-Radius' },
    { name: '--Card-Focus-Radius', sets: 'focus ring corner', variesWith: 'size mode', figma: 'Card/Card-Focus-Radius' },
  ],
  composition: [
    'Children are yours — the card adds padding and a surface, nothing else.',
    'A card inside a card should be `variant="outlined"`; two nested solid surfaces read as one.',
  ],
  accessibility: [
    'A `clickable` card is a button: it gets a role, focus and keyboard activation. A non-clickable one is a plain region.',
    'Do not put a separate link inside a clickable card — nested targets are unreachable by keyboard.',
  ],
  gotchas: [
    'The focus ring is `Card-Radius + 3` because it sits 3px outside. Tabs insets its ring instead, so the sign is opposite — a ring that crosses the card\'s own curve is this arithmetic backwards.',
    '`Card-Radius` is per size (small / medium / large) and so is its focus radius. A single focus radius is correct for exactly one of the three.',
  ],
};

import { FORM_DOCS } from './componentsForms';

export const COMPONENT_DOCS: ComponentDoc[] = [
  BUTTON_DOC, TABS_DOC, CARD_DOC, ...FORM_DOCS,
];
