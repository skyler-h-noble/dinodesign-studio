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
  useWhen: [
    'The control performs an action: submit, save, open a dialog, run something.',
    'You need an icon-only control — pass `iconOnly` and an `aria-label`.',
  ],
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
    'Put `data-theme` on the button, or on any ancestor — it inherits.',
    '**Do not theme a wrapper that also carries the drop shadow.** A shadow falls on the page, so it has to read the page\'s theme; the fill and bevel read the component\'s. Theming one node does both and tints the shadow.',
    'Colour is a `variant`, not a theme. `variant="success"` picks a palette; `data-theme` moves the whole surface.',
  ],
  tokens: [
    '--Buttons-{Color}-Button', '--Buttons-{Color}-Border', '--Button-Height',
    '--Button-Radius', '--Button-Focus-Radius', '--Button-Border-Width', '--Button-Padding',
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
  useWhen: [
    'Two or more views share a context and the user picks one at a time.',
    'The views are peers — no view is a step toward another.',
  ],
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
    '`TabList` carries the zone. Pass `variant` other than `standard` and it sets `data-theme` + `data-surface` for every tab inside.',
    'A `standard` TabList sets neither, so it inherits the surface it is dropped on — which is usually what you want inside a themed region.',
  ],
  tokens: ['--Border-Variant', '--Buttons-{Color}-Border', '--Text', '--Quiet', '--Hover', '--Pressed', '--Focus-Visible', '--Button-Height'],
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
  useWhen: [
    'Content belongs together and needs separating from what surrounds it.',
    'The whole card is one link or action — then pass `clickable`.',
  ],
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
    'Put `data-theme` on the card, or use `<Section>` around it.',
    'Use `surface` rather than writing `background:`. A card is a `Container` by default; naming the surface keeps `--Text`, `--Quiet` and `--Border` on the matching tone.',
    'Never `style={{ background }}` — it paints the box and leaves the text and borders on the parent\'s tone, which breaks the moment the surface flips dark.',
  ],
  tokens: ['--Background', '--Text', '--Border', '--Card-Radius', '--Card-Padding', '--Card-Inner-Radius', '--Card-Focus-Radius'],
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

export const COMPONENT_DOCS: ComponentDoc[] = [BUTTON_DOC, TABS_DOC, CARD_DOC];
