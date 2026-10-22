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
    { name: 'variant', type: 'string', default: 'default', note: 'Picks which Icons color the on state paints with: `primary` resolves the track to `--Icons-Primary`. Also takes `{color}-outline`.' },
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
      inFigma: 'The ON color comes from the Icons collection: the set pins `Icons=Primary`, and `Icon` paints the track and edge, `On-Icon` the handle — change the Icons mode to recolor an on switch. The variant root pins `Theme=Primary`, which drives the OFF state, drawn in `--Quiet` / `--Border`.' },
    { collection: 'Icons', inCode: '`variant` — `<SwitchInput variant="primary">` resolves the on track to `--Icons-Primary`.',
      inFigma: 'The ON variants bind Switch-Body\'s fill AND stroke to `Icon`, and the Dot to `On-Icon`, and pin nothing — so they inherit. Set the Icons mode on the switch or an ancestor; that is what recolors an on switch.' },
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
  states: [{ state: 'None', setBy: 'prop', note: 'An alert is not interactive; its color is the message.' }],
  theming: [
    { collection: 'Theme', inCode: '`color` picks the semantic palette. `data-theme` on an ancestor is rarely wanted — an error alert should stay an error color.',
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
    'Color alone is not the message — an error alert needs an icon or a word that says so.',
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
    { collection: 'Icons', inCode: '`data-theme` on an ancestor; the fill follows the Icons color.',
      inFigma: 'Badge Counter binds `Icon` and `On-Icon` from the Icons collection and pins nothing. Set the Icons mode on it or an ancestor — that is what recolors a badge.' },
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
      inFigma: 'The `Button-Theme-Avatar` and `Button-Theme-Initials` layers mark where the Buttons mode goes. Both are unpinned, so an avatar inherits. The Style variant chooses Photo / Initials / Default, which is content, not color.' },
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

export const SWATCH_DOC: ComponentDoc = {
  name: 'Swatch',
  summary: 'Shows one color from the system, at a size you can judge it at.',
  insteadUse: [
    { when: 'It is a selectable token with a label', use: 'Chip' },
    { when: 'The mark carries meaning rather than color', use: 'Icon' },
  ],
  props: [
    { name: 'color', type: 'string', default: 'undefined',
      note: 'Any CSS color — a hex from a picker, or a token. The fill is DATA, not a palette choice, so there is no `variant` and no outline swatch.' },
    { name: 'label', type: 'ReactNode', default: 'undefined', note: 'One line under the chip in the Legal text style, cut off with an ellipsis.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium',
      note: 'Follows the button ramp — 24 / 32 / 56 by default — so a swatch lines up with the controls beside it.' },
    { name: 'fit', type: 'string', values: ['fixed', 'fill'], default: 'fixed',
      note: '`fill` hands the WIDTH to the layout, which is what a grid of swatches in a picker needs. The height stays on the button ramp either way.' },
    { name: 'onClick', type: 'function', default: 'undefined',
      note: 'Its presence is what makes the swatch clickable — there is no `clickable` prop. With it the swatch is a `<button>` with a 1px border; without it, a `<div>` with no border, no check and no radio.' },
    { name: 'selected', type: 'boolean', default: 'false', note: 'Draws a check on its own disc. Ignored on a swatch with no `onClick`.' },
    { name: 'radio', type: 'boolean', default: 'false',
      note: 'Hands selection to a nested Radio below the chip, and the chip then draws no check. Only rendered when there is an `onClick`.' },
    { name: 'disabled', type: 'boolean', default: 'false', note: 'Dims to 0.38 and stops responding, but still draws the border, check and radio.' },
    { name: 'aria-label', type: 'string', default: 'undefined', note: 'Falls back to `label`, then to the `color` string itself.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'A 5% black scrim over the color. No shadow change.' },
    { state: 'Pressed', setBy: 'interaction', note: 'An 8% black scrim.' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'A 2px ring 3px outside the chip, on its own rounder corner.' },
    { state: 'Selected', setBy: 'prop', note: 'The check on a disc, or the nested radio when `radio` is set — never both.' },
    { state: 'Disabled', setBy: 'prop' },
    { state: 'Non-clickable', setBy: 'prop', note: 'No `onClick`. The chip is just the color: no border, no states.' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`data-theme` on an ancestor. The fill is the `color` prop, so a theme moves only the border, the check disc and the label.',
      inFigma: 'Pins nothing but its icon size, so a swatch inherits the theme around it — which is the point: a swatch shown inside a themed frame shows that theme\'s color.' },
  ],
  tokens: [
    { name: '--Button-Height', sets: 'chip width and height — Small-/Large- for the other sizes', variesWith: 'size mode + device', figma: 'Button/Button-Height' },
    { name: '--Button-Radius', sets: 'chip corner', variesWith: 'size mode', figma: 'Button/Button-Radius' },
    { name: '--Button-Focus-Radius', sets: 'focus ring corner', variesWith: 'size mode', figma: 'Button/Button-Focus-Radius' },
    { name: '--Button-Border-Width', sets: 'the clickable edge', variesWith: '—', figma: 'Button/Button-Border-Width' },
    surfaceToken('--Border', 'the clickable edge'),
    surfaceToken('--Background', 'the disc the check sits on'),
    surfaceToken('--Icon', 'the check, falling back to --Text'),
    surfaceToken('--Focus-Visible', 'the focus ring'),
    { name: '--Checkbox-Icon', sets: 'the check disc', variesWith: 'size mode', figma: 'Checkbox/Checkbox-Icon' },
    { name: '--Legal-Font-Size', sets: 'the label', variesWith: 'device', figma: 'the Legal text style' },
  ],
  composition: [
    'The label and the radio are props, not siblings — the whole swatch is one control and one tab stop.',
    'Selection belongs to the caller: there is no swatch group, so a picker sets `selected` on one swatch and passes each its own `onClick`. Lay a picker out as a grid of `fit="fill"` swatches; fixed chips with a gap leave a ragged right edge.',
  ],
  accessibility: [
    'A clickable swatch is a `<button>` that reports `aria-pressed`. Do not add your own.',
    'Name the color for a person, not a machine: `aria-label="Ocean blue"`. The fallback to the color string is a last resort — "#1E6FD9" is a poor name.',
    'The nested radio is `aria-hidden` and out of the tab order, so the swatch is announced once, not twice.',
  ],
  gotchas: [
    'It is a rounded SQUARE, not a circle. The corner is `--Button-Radius`, a separate token from the height — an earlier comment claimed the radius was bound to the height, and the circle was derived from that rather than from the design.',
    'Hover and pressed are translucent BLACK, not `--Hover` / `--Pressed`. Those are opaque surface tones, so layering one over the chip replaced the color with the page\'s hover tone — the one thing a swatch must never do.',
    'The check sits on a `--Background` disc rather than straight on the color, so its contrast is known whatever the color is. Figma draws the disc white; the code follows the surface so it holds in dark mode.',
  ],
};

export const BUTTON_GROUP_DOC: ComponentDoc = {
  name: 'ButtonGroup',
  summary: 'A row of related actions, spaced apart. Nothing in it is selected.',
  insteadUse: [
    { when: 'One of them is chosen and stays chosen', use: 'ToggleButtonGroup' },
    { when: 'There is only one action', use: 'Button' },
    { when: 'The buttons switch between views', use: 'Tabs' },
  ],
  props: [
    { name: 'variant', type: 'string', values: ['outlined', 'light', 'ghost'], default: 'outlined',
      note: 'With no selection the segments are peers and look alike: `outlined` paints each one solid in `color`, `ghost` makes each one ghost, and `light` puts each one on `Surface-Brightest` of the group\'s palette.' },
    { name: 'color', type: 'string', default: 'default',
      values: ['default', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error'],
      note: '`default` sets no `data-theme` and inherits; the other eight name their palette.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium', note: 'Passed to every segment unless the segment sets its own.' },
    { name: 'orientation', type: 'string', values: ['horizontal', 'vertical'], default: 'horizontal' },
    { name: 'fit', type: 'string', values: ['hug', 'fill', 'equal'], default: 'hug',
      note: '`fill` stretches the group and shares the width; `equal` hugs but makes every segment as wide as the widest. `fullWidth` and `equalWidth` are the old names for the same two.' },
    { name: 'spacing', type: 'string | number', default: 'undefined', note: 'Overrides the gap, which is otherwise `--Platform-Spacer` — 4px on desktop, wider on touch.' },
    { name: 'separated', type: 'boolean', default: 'true',
      note: 'Cannot be turned off here. `separated={false}` is ignored with a dev warning — joined segments are ToggleButtonGroup\'s shape.' },
    { name: 'disabled', type: 'boolean', default: 'false', note: 'Passed to every segment.' },
    { name: 'aria-label', type: 'string', default: 'undefined', note: 'Gives the group `role="group"`. Without it the group is not announced at all.' },
    { name: 'value / defaultValue / onChange / multiple / allowEmpty', type: 'deprecated', default: 'undefined',
      note: 'Selection moved to ToggleButtonGroup. These still work and warn once in development, and will be removed in the next major.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Per segment. The segment does not lift — Button\'s 1px hover rise is turned off inside a group.' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Buttons',
      inCode: '`color` — `<ButtonGroup color="success">`. Every segment takes it.',
      inFigma: 'The set pins `Buttons=default`. Change the Buttons mode to recolor the group; `Theme-Button` inside is the layer that carries it.' },
  ],
  themingNotes: [
    '`variant="light"` changes the segments\' SURFACE, not their theme — `data-theme="{Color}"` plus `data-surface="Surface-Brightest"`. There is no `{Color}-Light` theme any more, and no `DefaultLightButtonGroup`, since a lighter version of "inherit" names nothing to lighten.',
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'each segment\'s fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Border', sets: 'each segment\'s border', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Platform-Spacer', sets: 'the gap between segments', variesWith: 'device', figma: 'Devices-Type → Platform Spacer' },
    { name: '--Button-Radius', sets: 'each segment\'s corner', variesWith: 'size mode', figma: 'Button/Button-Radius' },
    surfaceToken('--Focus-Visible', 'the focus ring'),
  ],
  composition: [
    'Children are `Button`s. The group sets `variant`, `size` and `disabled` on each one; a child\'s own value wins.',
    'Segments are text, iconOnly or letterNumber. An Avatar segment or a solid `variant` on a child has no Figma drawing and warns in development.',
  ],
  accessibility: [
    'No `aria-pressed` on the segments: they are actions, and "Delete, not pressed" promises an off state the button does not have.',
    'Name the group only when the boundary means something — `aria-label="Text formatting"`. An unnamed one is announced as nothing, which is honest for a plain row.',
    'Icon-only segments each need an `aria-label` naming the action.',
  ],
  gotchas: [
    'ButtonGroup and ToggleButtonGroup render alike and are different concepts: this one is layout, a row of things you can do; ToggleButtonGroup is state, a control with a value. If anything in the row is "on", it is the wrong component.',
    'Older guidance said to pass `value` + `onChange` and set `value=` on each child. That is the deprecated path — swap `<ButtonGroup>` for `<ToggleButtonGroup>`; every other prop is the same.',
  ],
};

export const TOGGLE_BUTTON_GROUP_DOC: ComponentDoc = {
  name: 'ToggleButtonGroup',
  summary: 'A set of options where exactly one is chosen, and one always is.',
  insteadUse: [
    { when: 'The buttons are actions and none is selected', use: 'ButtonGroup' },
    { when: 'The options need labels and descriptions', use: 'RadioGroup' },
    { when: 'Choosing one switches the view', use: 'Tabs' },
  ],
  props: [
    { name: 'value / defaultValue', type: 'any', default: 'undefined',
      note: 'Controlled with `value` + `onChange`, uncontrolled with `defaultValue`. Each segment carries its own `value`; one without falls back to its index. With `multiple` the value is an array.' },
    { name: 'onChange', type: 'function', default: 'undefined', note: 'Called as `(value, event)` — value FIRST. With `multiple` it receives the next array.' },
    { name: 'multiple', type: 'boolean', default: 'false', note: 'Any number of segments on at once.' },
    { name: 'allowEmpty', type: 'boolean', default: 'false',
      note: 'FALSE is what makes it a toggle group: the last segment that is on cannot be turned off. Only matters with `multiple` — single mode can never empty, because clicking the chosen segment keeps it chosen.' },
    { name: 'variant', type: 'string', values: ['outlined', 'light', 'ghost'], default: 'outlined',
      note: 'The SHAPE. `outlined` and `light` go outline → solid when selected; `ghost` goes ghost → outline.' },
    { name: 'color', type: 'string', default: 'default',
      values: ['default', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error'],
      note: 'The palette. `default` sets no `data-theme` and inherits.' },
    { name: 'separated', type: 'boolean', default: 'false',
      note: 'Joined by default — the segments overlap by one border width so a shared edge is one line. `true` spaces them by `--Platform-Spacer`.' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'orientation', type: 'string', values: ['horizontal', 'vertical'], default: 'horizontal' },
    { name: 'fit', type: 'string', values: ['hug', 'fill', 'equal'], default: 'hug' },
    { name: 'disabled', type: 'boolean', default: 'false' },
    { name: 'aria-label', type: 'string', default: 'undefined', note: 'Always pass one. It is what gives the group `role="group"` and a name.' },
    { name: 'exclusive', type: 'deprecated', default: 'undefined',
      note: 'MUI\'s name: `multiple` inverted. Still works, warns once, and switches `onChange` to MUI\'s `(event, value)` order.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Unselected segments take the surface `--Hover` and move their label to Outline-Text.' },
    { state: 'Pressed', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'The ring follows the segment\'s corner — rounded on an end cap, square on a middle one.' },
    { state: 'Selected', setBy: 'prop', note: 'From `value`. The group sets `aria-pressed` on each segment.' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme',
      inCode: '`data-theme` on an ancestor moves the surface around and under the segments.',
      inFigma: 'Pins no color mode — the group and its segments inherit (only the decorator icon and avatar pin a size). `Theme-Button` inside each segment is the layer to set a mode on to recolor the buttons without moving the surface around them.' },
    { collection: 'Buttons',
      inCode: '`color` — `<ToggleButtonGroup color="success">`.',
      inFigma: 'Set the Buttons mode on `Theme-Button` — the same layer the Theme row names.' },
  ],
  themingNotes: [
    'The selected fill comes from the Buttons table; an unselected segment has no fill of its own, so its hover and pressed tints are the SURFACE\'s scrims while its label still comes from the group\'s palette.',
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the selected fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Border', sets: 'segment borders', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Text', sets: 'the selected label', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Outline-Quiet', sets: 'an unselected label at rest', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    { name: '--Buttons-{Color}-Outline-Text', sets: 'an unselected label on hover, pressed and focus', variesWith: 'theme + surface', figma: 'Modes → Theme → Buttons' },
    surfaceToken('--Hover', 'an unselected segment on hover'),
    surfaceToken('--Pressed', 'an unselected segment when pressed'),
    surfaceToken('--Focus-Visible', 'the focus ring'),
    { name: '--Button-Radius', sets: 'the end caps of a horizontal group', variesWith: 'size mode', figma: 'Button/Button-Radius' },
    { name: '--Vertical-Button-Radius', sets: 'the end caps of a vertical group — half the button corner', variesWith: 'size mode', figma: 'Button/Vertical-Button-Radius' },
    { name: '--Button-Focus-Radius', sets: 'the focus ring on a horizontal end cap', variesWith: 'size mode', figma: 'Button/Button-Focus-Radius' },
    { name: '--Button-Border-Width', sets: 'the overlap that collapses a shared edge to one line', variesWith: '—', figma: 'Button/Button-Border-Width' },
  ],
  composition: [
    'Children are `ToggleButton` (an alias of `Button`) or `Button`, each with a `value`. Do NOT set `variant` on them — the group assigns it per segment, and an explicit one wins, which is how every segment ends up looking selected.',
    'Joined is the case a button cannot express about itself: its corners depend on where it sits in the row, so the group owns them. Separated segments (`separated`) are ordinary buttons with a gap.',
    'Segments are text, iconOnly or letterNumber; a separated segment has no Type axis. An Avatar or solid segment has no Figma drawing and warns in development.',
  ],
  accessibility: [
    'Each segment reports `aria-pressed` from the group. Do not add your own.',
    'Name the group — `aria-label="Text alignment"`. Here the group IS the control, and the options only mean something as a set.',
    'Icon-only segments need an `aria-label` naming the option, not the glyph: "Align left", not "format_align_left".',
  ],
  gotchas: [
    'It is not retired. It was briefly a shim onto ButtonGroup, on the reasoning that both draw the same row; they render alike and mean different things, so selection lives here and ButtonGroup has none.',
    'A selected segment\'s fill does NOT move on hover, though Figma\'s selected/Hover binds Buttons/Hover. Deliberate: that hover tone is lighter, so the selected segment read as deselecting. Only its label moves.',
    'The MUI-shaped API still works and warns: `variant="primary"` (a palette name, not a shape) is read as `color`, and `exclusive` or a legacy `variant` flips `onChange` to `(event, value)`. Not swapping the order hands a caller an event where it expects a value — no error, just a selection that never updates.',
    '`allowEmpty` is `false` here and `true` on ButtonGroup. That one default is the whole behavioral difference between the two.',
  ],
};

export const FORM_DOCS: ComponentDoc[] = [
  CHECKBOX_DOC, RADIO_DOC, SWITCH_DOC, CHIP_DOC,
  ALERT_DOC, BADGE_DOC, AVATAR_DOC, INPUT_DOC,
  SWATCH_DOC, BUTTON_GROUP_DOC, TOGGLE_BUTTON_GROUP_DOC,
];
