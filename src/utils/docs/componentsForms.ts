/**
 * Selection and feedback components.
 *
 * Theming rows are taken from the file, not assumed: Radio, Switch and Chip
 * pin Theme on their variant ROOT; Alert pins it on `Alert Container`; and
 * Checkbox, Badge, Avatar and Input pin nothing and inherit. Those differ
 * enough that a single rule would be wrong for half of them.
 */
import type { ComponentDoc } from './componentDoc';

const surfaceToken = (name: string, sets: string) =>
  ({ name, sets, variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' });

export const CHECKBOX_DOC: ComponentDoc = {
  name: 'Checkbox',
  summary: 'Turns one option on or off, independently of any other.',
  insteadUse: [
    { when: 'Exactly one of several must be chosen', use: 'RadioGroup' },
    { when: 'It switches something on immediately', use: 'SwitchInput' },
    { when: 'It selects a row in a list', use: 'ListItem with selectionMode' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'primary', note: 'The palette. A checkbox is one of the few controls that defaults to `primary` rather than `default`.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'checked / defaultChecked', type: 'boolean', default: 'undefined', note: 'Controlled with `checked` + `onChange`; uncontrolled with `defaultChecked`.' },
    { name: 'indeterminate', type: 'boolean', default: 'false', note: 'A third visual state for "some children checked". It is not a value — the box is still checked or not.' },
    { name: 'label', type: 'ReactNode', default: 'undefined' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Checked', setBy: 'prop' },
    { state: 'Indeterminate', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor — Checkbox has no theme prop.',
      inFigma: 'Pins no Theme mode; it inherits. Set the mode on the frame around it.' },
  ],
  tokens: [
    surfaceToken('--Border', 'the unchecked box outline'),
    { name: '--Buttons-{Color}-Button', sets: 'the checked fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Checkbox-Width', sets: 'the box', variesWith: 'size mode', figma: 'Checkbox/Checkbox-Width' },
    { name: '--Checkbox-Radius', sets: 'the box corner', variesWith: 'size mode', figma: 'Checkbox/Checkbox-Radius' },
    { name: '--Checkbox-Gap', sets: 'box-to-label gap', variesWith: 'size mode', figma: 'Checkbox/Checkbox-Gap' },
    { name: '--Sizing-3', sets: 'the 24px hit area', variesWith: '—', figma: 'Sizing-3' },
  ],
  composition: [
    'Pass `label` rather than putting text beside it — the label is wired to the input and clicking it toggles.',
  ],
  accessibility: [
    'A checkbox without a `label` needs an `aria-label`.',
    '`indeterminate` sets `aria-checked="mixed"` — do not also set `checked`.',
    'The box is centred inside a constant 24px frame so the target meets WCAG 2.5.8 even at `small`.',
  ],
  gotchas: [
    'It defaults to `variant="primary"`, unlike Button which defaults to `default`. Both are deliberate.',
    'The 24px hit area is `--Sizing-3`, not a Checkbox token. It lives on the Sizing scale — a collection, not a Component-Size group, so it has no prefix — and a second name for one number is how the two drift.',
  ],
};

export const RADIO_DOC: ComponentDoc = {
  name: 'Radio',
  summary: 'Picks exactly one option from a set. Never use one alone.',
  insteadUse: [
    { when: 'Options are independent', use: 'Checkbox' },
    { when: 'There are more than about seven', use: 'Select' },
    { when: 'It is a single on/off', use: 'SwitchInput' },
  ],
  props: [
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'theme / surface', type: 'string', default: 'undefined', note: 'Puts `data-theme` / `data-surface` on the root. Absent means inherit — do not pass an empty string.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'label', type: 'ReactNode', default: 'undefined' },
    { name: 'labelPlacement', type: 'string', values: ['start', 'end', 'top', 'bottom'], default: 'end' },
    { name: 'checked', type: 'boolean', default: 'undefined' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected', setBy: 'prop', note: '`checked`, usually driven by the enclosing RadioGroup.' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'The variant root pins `Theme=Primary`. Change the mode there to retheme it.' },
  ],
  themingNotes: [
    '`color` and `theme` are different: `color` picks which palette the filled dot draws from, `theme` moves the whole surface including the border and label tones.',
  ],
  tokens: [
    surfaceToken('--Border', 'the ring'),
    { name: '--Buttons-{Color}-Button', sets: 'the selected dot', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Radio', sets: 'the outer circle', variesWith: 'size mode', figma: 'Radio/Radio' },
    { name: '--Dot', sets: 'the inner dot', variesWith: 'size mode', figma: 'Radio/Dot' },
    { name: '--Radio-Gap', sets: 'circle-to-label gap', variesWith: 'size mode', figma: 'Radio/Radio-Gap' },
  ],
  composition: [
    'Wrap radios in `RadioGroup` — it owns the value, the name and arrow-key navigation.',
  ],
  accessibility: [
    'A lone radio is a bug: one option that cannot be deselected. Always a group of two or more.',
    'Arrow keys move between radios and Tab leaves the group. RadioGroup handles this.',
  ],
  gotchas: [
    'A radio cannot be unchecked by clicking it again. If the user must be able to clear it, the set needs an explicit "None" option.',
  ],
};

export const SWITCH_DOC: ComponentDoc = {
  name: 'SwitchInput',
  summary: 'Turns something on or off and applies it immediately — no save step.',
  insteadUse: [
    { when: 'The change needs saving or confirming', use: 'Checkbox' },
    { when: 'It is one of several options', use: 'RadioGroup' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'default', note: 'Picks which Icons colour the on state paints with: `primary` resolves the track to `--Icons-Primary`. Also takes `{color}-outline`.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'checked / defaultChecked', type: 'boolean', default: 'undefined' },
    { name: 'label', type: 'ReactNode', default: 'undefined' },
    { name: 'labelPlacement', type: 'string', values: ['start', 'end'], default: 'end' },
    { name: 'icon', type: 'ReactNode', default: 'undefined', note: 'Rides inside the handle.' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'On / Off', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'The variant root pins `Theme=Primary`. Change the mode there. This drives the OFF state, which is drawn in `--Quiet` / `--Border`.' },
    { collection: 'Icons', inCode: '`variant` — `<SwitchInput variant="primary">` resolves the on track to `--Icons-Primary`.',
      inFigma: 'The ON variants bind Switch-Body\'s fill AND stroke to `Icon`, and the Dot to `On-Icon`, and pin nothing — so they inherit. Set the Icons mode on the switch or an ancestor; that is what recolours an on switch.' },
  ],
  tokens: [
    { name: '--Icons-{Color}', sets: 'the on track — fill and edge are the same token', variesWith: 'theme + surface', figma: 'Icons → Icon' },
    { name: '--Icons-On-{Color}', sets: 'the knob on the on track', variesWith: 'theme + surface', figma: 'Icons → On-Icon' },
    surfaceToken('--Quiet', 'the off knob'),
    surfaceToken('--Border', 'the off track'),
    { name: '--Switch-Width', sets: 'track width', variesWith: 'size mode', figma: 'Switch/Switch-Width' },
    { name: '--Switch-Height', sets: 'track height', variesWith: 'size mode', figma: 'Switch/Switch-Height' },
    { name: '--Switch-Handle', sets: 'the knob', variesWith: 'size mode', figma: 'Switch/Switch-Handle' },
  ],
  composition: ['The label is a prop, not a sibling — it is wired to the input.'],
  accessibility: [
    'Announced as a switch with on/off, not checked/unchecked.',
    'Label it with what it controls, not its state: "Email notifications", never "On".',
  ],
  gotchas: [
    'The `-light` shape is gone here too. It tinted the track, which is not a shape in the Figma set — that has only State and Status axes. `{color}-light` still renders (it normalizes to `{color}` and warns once in development), but the eight `*LightSwitch` convenience exports are deleted, so a stale import fails at build. `ButtonGroup` `variant="light"` is unrelated and still real.',
  ],
};

export const CHIP_DOC: ComponentDoc = {
  name: 'Chip',
  summary: 'A compact, selectable or dismissible token — a filter, a tag on an input, a choice.',
  insteadUse: [
    { when: 'It only labels something and cannot be clicked', use: 'Tag' },
    { when: 'It is a primary action', use: 'Button' },
    { when: 'It shows a count on another element', use: 'Badge' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'primary' },
    { name: 'label', type: 'ReactNode', default: 'undefined' },
    { name: 'selected', type: 'boolean', default: 'false', note: 'Selection is a SURFACE change, not a different variant — selected draws on `Surface-Dimmest`, unselected on `Surface-Brightest`.' },
    { name: 'clickable', type: 'boolean', default: 'false' },
    { name: 'onDelete', type: 'function', default: 'undefined', note: 'Adds the dismiss affordance. Without it there is no X.' },
    { name: 'startDecorator / endDecorator', type: 'ReactNode', default: 'undefined' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected', setBy: 'prop' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`variant` sets `data-theme` on the chip; the chip sets `data-surface` itself from `selected`. `variant="default"` sets no theme and inherits.',
      inFigma: 'One layer carries both: `Theme-Chip-Body` pins `Theme` AND the `Surface` level. Nothing is pinned on the variant root — the shadow lives on `Chip Holder` ABOVE it, so a drop shadow reads the page\'s theme rather than the chip\'s.' },
  ],
  themingNotes: [
    'Do not reach for an outline variant — there is no outline/solid axis, only selected and unselected. `-outline` is stripped to the solid variant for back-compat and should not be written.',
  ],
  tokens: [
    surfaceToken('--Background', 'the body fill'),
    surfaceToken('--Text', 'the label'),
    surfaceToken('--Border', 'the outline'),
  ],
  composition: [
    'Decorators are props. An avatar or icon goes in `startDecorator`, the dismiss affordance comes from `onDelete`.',
  ],
  accessibility: [
    'A dismissible chip needs its X labelled with what it removes, not "close".',
    'A selectable chip announces its selected state; do not add your own `aria-pressed`.',
  ],
  gotchas: [
    'Selected and unselected differ by SURFACE, not by theme. That is why changing a chip\'s theme moves both states together — the two used to be separate style blocks and had drifted.',
  ],
};

export const ALERT_DOC: ComponentDoc = {
  name: 'Alert',
  summary: 'Tells the user something about the state of the page, in place.',
  insteadUse: [
    { when: 'It is transient and self-dismissing', use: 'Snackbar' },
    { when: 'It demands a decision before anything else', use: 'Dialog' },
    { when: 'It describes one field', use: "the field's own validation message" },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'light' },
    { name: 'color', type: 'string', values: ['info', 'success', 'warning', 'error'], default: 'info' },
    { name: 'surface', type: 'string', default: 'undefined' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'startDecorator / endDecorator', type: 'ReactNode', default: 'undefined' },
  ],
  states: [{ state: 'None', setBy: 'prop', note: 'An alert is not interactive; its colour is the message.' }],
  theming: [
    { collection: 'Theme', inCode: '`color` picks the semantic palette. `data-theme` on an ancestor is rarely wanted — an error alert should stay an error colour.',
      inFigma: '`Alert Container` pins both Theme (Error / Warning) and `Surface=Surface-Brightest`. That container is the node to change.' },
  ],
  tokens: [
    surfaceToken('--Background', 'the alert fill'),
    surfaceToken('--Text', 'the message'),
    surfaceToken('--Border', 'the outline'),
  ],
  composition: ['The icon goes in `startDecorator`, a dismiss or action in `endDecorator`.'],
  accessibility: [
    'An error or warning that appears in response to something needs `role="alert"` so it is announced.',
    'Colour alone is not the message — an error alert needs an icon or a word that says so.',
  ],
  gotchas: [
    'It defaults to `variant="light"`, which is a surface treatment here and not the removed `-light` shape.',
  ],
};

export const BADGE_DOC: ComponentDoc = {
  name: 'Badge',
  summary: 'A count or a dot anchored to the corner of something else.',
  insteadUse: [
    { when: 'It stands alone and labels something', use: 'Tag' },
    { when: 'It can be clicked or dismissed', use: 'Chip' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'primary' },
    { name: 'badgeContent', type: 'ReactNode', default: 'undefined' },
    { name: 'max', type: 'number', default: '99', note: 'Above this it renders "99+".' },
    { name: 'dot', type: 'boolean', default: 'false', note: 'A mark with no number — "something changed".' },
    { name: 'showZero', type: 'boolean', default: 'false', note: 'Off by default: a zero badge tells the user nothing and adds noise.' },
    { name: 'invisible', type: 'boolean', default: 'false' },
    { name: 'overlap', type: 'string', values: ['rectangular', 'circular'], default: 'rectangular' },
    { name: 'anchorOrigin', type: 'object', default: "{ vertical: 'top', horizontal: 'right' }" },
  ],
  states: [{ state: 'None', setBy: 'prop', note: 'A badge is decoration on its child; it has no states of its own.' }],
  theming: [
    { collection: 'Icons', inCode: '`data-theme` on an ancestor; the fill follows the Icons colour.',
      inFigma: 'Badge Counter binds `Icon` and `On-Icon` from the Icons collection and pins nothing. Set the Icons mode on it or an ancestor — that is what recolours a badge.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the badge fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    surfaceToken('--Background', 'the ring separating it from its child'),
  ],
  composition: ['It wraps its child — `<Badge badgeContent={3}><Icon/></Badge>`, not a sibling.'],
  accessibility: [
    'The number alone means nothing to a screen reader. Label the thing it sits on: "Notifications, 3 unread".',
    'A `dot` badge conveys nothing on its own and needs text elsewhere.',
  ],
  gotchas: [
    'There is no `-light` Badge. The sixteen `PrimaryLightBadge`…`ErrorLightBadge` exports were deleted in 0.9.0, so a stale import fails at build rather than rendering something other than its name.',
  ],
};

export const AVATAR_DOC: ComponentDoc = {
  name: 'Avatar',
  summary: 'Represents a person or entity: a photo, their initials, or a fallback glyph.',
  insteadUse: [
    { when: 'It is a brand or product mark', use: 'an Icon or image' },
    { when: 'It is a status indicator', use: 'Badge' },
  ],
  props: [
    { name: 'src', type: 'string', default: 'undefined' },
    { name: 'initials', type: 'string', default: 'undefined' },
    { name: 'icon', type: 'ReactNode', default: 'undefined' },
    { name: 'defaultPhoto', type: 'boolean', default: 'true', note: 'The brand glyph when nothing else resolves. `false` falls back to the icon.' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'customSize', type: 'number', default: 'undefined' },
    { name: 'clickable', type: 'boolean', default: 'false' },
    { name: 'alt', type: 'string', default: 'undefined' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Only when `clickable`.' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'Only when `clickable`.' },
  ],
  theming: [
    { collection: 'Buttons', inCode: '`data-theme` on an ancestor.',
      inFigma: 'The `Button-Theme-Avatar` and `Button-Theme-Initials` layers mark where the Buttons mode goes. Both are unpinned, so an avatar inherits. The Style variant chooses Photo / Initials / Default, which is content, not colour.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the initials background', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    surfaceToken('--Text', 'the initials'),
  ],
  composition: [
    'Content resolves in order: `src` → `initials` → `icon` → the default photo.',
    'Use `AvatarGroup` for a stack; it handles the overlap and the "+n" overflow.',
  ],
  accessibility: [
    'An avatar with a photo needs `alt` naming the person.',
    'Initials are not a name. `aria-label="JD"` passes every checker and says nothing — give the full name.',
  ],
  gotchas: [
    'In Figma the variant axis is `Style = Initials | Default | Photo`. Those are content choices; the library derives them from which prop you pass, so there is no `style` prop.',
  ],
};

export const INPUT_DOC: ComponentDoc = {
  name: 'Input',
  summary: 'One line of typed text, with a label and optional validation.',
  insteadUse: [
    { when: 'More than one line', use: 'TextArea' },
    { when: 'A search query', use: 'SearchField' },
    { when: 'Picking from a fixed list', use: 'Select' },
    { when: 'A number with steppers', use: 'NumberField' },
  ],
  props: [
    { name: 'variant', type: 'string', default: 'primary-outline' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'label', type: 'string', default: 'undefined' },
    { name: 'labelPosition', type: 'string', values: ['standard', 'floating'], default: 'standard' },
    { name: 'placeholder', type: 'string', default: 'undefined', note: 'Not a label. It disappears on focus, so a field labelled only by its placeholder has no label once typing starts.' },
    { name: 'helperText', type: 'string', default: 'undefined' },
    { name: 'validation', type: 'string', values: ['none', 'error'], default: 'none' },
    { name: 'validationMessage', type: 'string', default: 'undefined' },
    { name: 'type', type: 'string', default: 'text' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Error', setBy: 'prop', note: '`validation="error"`, which also reveals `validationMessage`.' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Pins nothing and inherits. Set the mode on the frame around it.' },
  ],
  tokens: [
    surfaceToken('--Border', 'the outline'),
    surfaceToken('--Text', 'the typed value'),
    surfaceToken('--Quiet', 'the placeholder'),
    { name: '--Input-Height', sets: 'height', variesWith: 'size mode + device', figma: 'Input/Input-Height' },
    { name: '--Input-Radius', sets: 'corner', variesWith: 'size mode', figma: 'Input/Input-Radius' },
    { name: '--Input-Focus-Radius', sets: 'focus ring corner', variesWith: 'size mode', figma: 'Input/Input-Focus-Radius' },
    { name: '--Input-Padding', sets: 'inner padding', variesWith: 'size mode', figma: 'Input/Input-Padding' },
  ],
  composition: [
    'The label, helper text and validation message are props. Do not place a `<Label>` beside it — the wiring is what makes them announced together.',
  ],
  accessibility: [
    'Every input needs a `label`. A placeholder is not one.',
    '`validation="error"` sets `aria-invalid` and ties the message with `aria-describedby`, so the error is announced rather than only drawn.',
    'Write the message as what to change, not what went wrong: "Enter a date after today", not "Invalid date".',
  ],
  gotchas: [
    'The focus ring is drawn as an `outline`, not a border. A border would change the box size on focus and shift the layout.',
  ],
};

export const FORM_DOCS: ComponentDoc[] = [
  CHECKBOX_DOC, RADIO_DOC, SWITCH_DOC, CHIP_DOC,
  ALERT_DOC, BADGE_DOC, AVATAR_DOC, INPUT_DOC,
];
