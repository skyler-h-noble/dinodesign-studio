/**
 * Progress, input-by-dragging, and the small pieces of typography and rule.
 *
 * Several of these take `theme` / `surface` props directly rather than relying
 * on an ancestor — Stepper, Slider, Rating, Loader and Pagination were given
 * the pair so a control can carry a zone without being wrapped.
 */
import type { ComponentDoc } from './componentDoc';

const surfaceToken = (name: string, sets: string) =>
  ({ name, sets, variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' });

const zoneProps = [
  { name: 'theme', type: 'string', default: 'undefined',
    note: 'Sets `data-theme` on the root. Absent means INHERIT — never pass an empty string, which pins the component to a zone that defines nothing.' },
  { name: 'surface', type: 'string', default: 'undefined' },
];

export const STEPPER_DOC: ComponentDoc = {
  name: 'Stepper',
  summary: 'Shows progress through a sequence and where the user is in it.',
  insteadUse: [
    { when: 'The views are peers in any order', use: 'Tabs' },
    { when: 'It is a percentage', use: 'Progress' },
    { when: 'It is a hierarchy', use: 'Breadcrumbs' },
  ],
  props: [
    ...zoneProps,
    { name: 'activeStep', type: 'number', default: '0' },
    { name: 'orientation', type: 'string', values: ['horizontal', 'vertical'], default: 'horizontal' },
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'clickable', type: 'boolean', default: 'false', note: 'Lets the user jump back. Only sensible where steps can be revisited.' },
    { name: 'dashedIncomplete', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Complete / Current / Incomplete', setBy: 'context', note: 'Derived from `activeStep`, never set per step.' },
    { state: 'Hover', setBy: 'interaction', note: 'Only when `clickable`.' },
    { state: 'Focus-visible', setBy: 'interaction' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'Count Step and No-Count Step pin Theme on their variant ROOT; the Stepper set pins it on a nested Count Step. Both are candidates for a named `Theme-*` layer.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'a completed step', variesWith: 'theme + surface', figma: 'Buttons → Button' },
    surfaceToken('--Border', 'the connecting line'),
    { name: '--Step bar', sets: 'the line thickness', variesWith: 'size mode', figma: 'Other/Step bar' },
    { name: '--No Count Step', sets: 'a dot step', variesWith: 'size mode', figma: 'Other/No Count Step' },
  ],
  composition: ['Steps are children; the connecting line is drawn by the stepper, not by you.'],
  accessibility: [
    'A non-clickable stepper is a status display, not a control — it should not be in the tab order.',
    'The current step needs `aria-current="step"`. Color alone does not say which one you are on.',
  ],
  gotchas: [
    'A step signalling focus by lightening its fill is not a focus indicator: the two colors measured 1.46:1 and 1.55:1 against each other, where an indicator needs 3:1. The ring carries it; the fill stays put.',
  ],
};

export const SLIDER_DOC: ComponentDoc = {
  name: 'Slider',
  summary: 'Picks a value from a range by dragging, where the exact number matters less than the feel of it.',
  insteadUse: [
    { when: 'The exact value matters', use: 'NumberField' },
    { when: 'There are a few discrete options', use: 'RadioGroup or ButtonGroup' },
    { when: 'It is on or off', use: 'SwitchInput' },
  ],
  props: [
    ...zoneProps,
    { name: 'variant', type: 'string', default: 'primary' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'value / defaultValue', type: 'number', default: 'undefined' },
    { name: 'min', type: 'number', default: '0' },
    { name: 'max', type: 'number', default: '100' },
    { name: 'onChange', type: 'function', default: 'undefined', note: 'Fires continuously while dragging.' },
    { name: 'onChangeCommitted', type: 'function', default: 'undefined', note: 'Fires once on release — use this for anything expensive.' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction' },
    { state: 'Dragging', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction', note: 'A DUAL ring: a blue inner and a background-colored outer, so it survives any backdrop.' },
    { state: 'Disabled', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'The Slider sets pin nothing and inherit.' },
  ],
  themingNotes: [
    'The thumb recolors on its own: it reads `--Border` and `--Background`, which are zone tokens, so moving the zone moves the thumb without the component knowing about themes.',
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the filled track', variesWith: 'theme + surface', figma: 'Buttons → Button' },
    surfaceToken('--Border', 'the thumb and empty track'),
    surfaceToken('--Background', "the thumb's border"),
    { name: '--Slider-Handle-Radius', sets: 'the thumb corner', variesWith: 'size mode', figma: 'Slider/Slider-Handle-Radius' },
    { name: '--Rail', sets: 'the track thickness', variesWith: 'size mode', figma: 'Slider/Rail' },
  ],
  composition: ['Labels and the value display are the slider’s own; a separate NumberField beside it is a different pattern.'],
  accessibility: [
    'Arrow keys move by one step, Page Up/Down by a larger one, Home and End to the ends. All handled.',
    'It needs an accessible name and announces min, max and current value — a bare slider says "50" with no unit or meaning.',
  ],
  gotchas: [
    'The dual focus ring is deliberate: a single-color ring disappears on a background close to its own color. The outer ring is bound to `--Background`, so on a dark surface it goes dark and the pair still separates.',
  ],
};

export const RATING_DOC: ComponentDoc = {
  name: 'Rating',
  summary: 'Shows or collects a score, usually out of five.',
  insteadUse: [
    { when: 'It is a percentage or progress', use: 'Progress' },
    { when: 'It is one choice from several', use: 'RadioGroup' },
  ],
  props: [
    ...zoneProps,
    { name: 'defaultValue', type: 'number', default: 'undefined' },
    { name: 'max', type: 'number', default: '5' },
    { name: 'precision', type: 'number', default: '1', note: '0.5 allows half stars.' },
    { name: 'readOnly', type: 'boolean', default: 'false', note: 'A displayed score, not an input. It leaves the tab order.' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'Previews the score under the pointer.' },
    { state: 'Focus-visible', setBy: 'interaction' },
    { state: 'Selected / Half / Empty', setBy: 'prop' },
    { state: 'Read-only', setBy: 'prop' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'Star pins Theme on its variant ROOT; the Rating set pins it on a nested Star, which looks like the pin landed on whatever was selected.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'a filled star', variesWith: 'theme + surface', figma: 'Buttons → Button' },
    surfaceToken('--Border', 'an empty star'),
    { name: '--Rating', sets: 'the star box', variesWith: 'size mode', figma: 'Other/Rating' },
    { name: '--Rating-Icon', sets: 'the glyph', variesWith: 'size mode', figma: 'Other/Rating-Icon' },
  ],
  composition: ['Stars are generated from `max` — do not render them yourself.'],
  accessibility: [
    'An interactive rating is a radio group: arrow keys move between values.',
    '`readOnly` must announce the score as text — "3 out of 5", not five graphics.',
  ],
  gotchas: [
    'Its focus ring is the 3px inner kind, inset 1px, because stars sit shoulder to shoulder and an outer ring would overlap the neighbour.',
  ],
};

export const LOADER_DOC: ComponentDoc = {
  name: 'Loader',
  summary: 'Says the page is working when there is nothing yet to show.',
  insteadUse: [
    { when: 'The shape of the result is known', use: 'Skeleton' },
    { when: 'Progress is measurable', use: 'Progress' },
    { when: 'It is one control that is busy', use: 'CircularProgress inside it' },
  ],
  props: [
    ...zoneProps,
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'medium' },
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'message', type: 'string', default: "'Loading...'" },
  ],
  states: [{ state: 'Spinning', setBy: 'context', note: 'A loader has one state; you mount it or you do not.' }],
  theming: [
    { collection: 'Theme', inCode: '`theme` / `surface` props, or `data-theme` on an ancestor.',
      inFigma: 'Loader pins nothing and inherits.' },
  ],
  tokens: [
    { name: '--Buttons-{Color}-Button', sets: 'the spinner', variesWith: 'theme + surface', figma: 'Buttons → Button' },
    { name: '--Loader', sets: 'the spinner size', variesWith: 'size mode', figma: 'Other/Loader' },
  ],
  composition: ['The message is a prop. A loader with no message is a spinner with no explanation.'],
  accessibility: [
    'Announce it politely with `role="status"` — assertive interrupts whatever the user is reading.',
    'The message should say what is loading. "Loading…" alone tells a screen-reader user nothing about what to expect.',
  ],
  gotchas: [
    'Prefer a Skeleton where the result has a known shape: it holds the layout and stops the page jumping when content arrives.',
  ],
};

export const LINK_DOC: ComponentDoc = {
  name: 'Link',
  summary: 'Navigates. If it does not change where you are, it is a Button.',
  insteadUse: [
    { when: 'It performs an action', use: 'Button' },
    { when: 'It looks like a button and navigates', use: 'Link styled as one — the element follows the behaviour' },
  ],
  props: [
    { name: 'href', type: 'string', default: 'undefined' },
    { name: 'target', type: 'string', default: 'undefined', note: 'With `_blank`, say so in the text — an unexpected new tab is disorienting.' },
    { name: 'textStyle', type: 'string', default: 'body' },
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  states: [
    { state: 'Hover', setBy: 'interaction', note: 'The underline THICKENS. The color does not change.' },
    { state: 'Visited', setBy: 'interaction' },
    { state: 'Focus-visible', setBy: 'interaction' },
  ],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Link and Hotlink Group pin nothing and inherit.' },
  ],
  tokens: [
    { name: '--Hotlink', sets: 'the link color', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Hotlink-Visited', sets: 'a visited link', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
  ],
  composition: ['The text is the child. Link text should say where it goes — "Read the pricing guide", never "click here".'],
  accessibility: [
    'Link text must make sense read alone, out of context — screen reader users list links without the surrounding sentence.',
    'A link that opens a new tab should say so in its text or its accessible name.',
  ],
  gotchas: [
    '**Links do not change color on hover** — the underline thickens instead. The system emits no hover tone for links, and inventing one would put an unverified value on text carrying a 4.5:1 requirement.',
    'The library reads `--Link` / `--Link-Visited`, which nothing generates, and falls back to `--Hotlink` / `--Hotlink-Visited`, which is what the studio actually emits. Define the Link names yourself or rely on the fallback.',
  ],
};

export const TAG_DOC: ComponentDoc = {
  name: 'Tag',
  summary: 'A short label attached to something. It is not a control.',
  insteadUse: [
    { when: 'It can be clicked, selected or dismissed', use: 'Chip' },
    { when: 'It is a count on another element', use: 'Badge' },
    { when: 'It is the status of the whole page', use: 'Alert' },
  ],
  props: [
    { name: 'color', type: 'string', default: 'primary' },
    { name: 'width', type: 'string', values: ['hug', 'fill'], default: 'hug' },
    { name: 'allCaps', type: 'boolean', default: 'false' },
  ],
  states: [{ state: 'None', setBy: 'prop', note: 'A tag has no states. If it needs one, it is a Chip.' }],
  theming: [
    { collection: 'Theme', inCode: '`color`, or `data-theme` on an ancestor.',
      inFigma: 'Tag pins nothing on its container; its variants are named per theme.' },
  ],
  tokens: [
    { name: '--Tag-BG', sets: 'the fill', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
    { name: '--Tag-Text', sets: 'the label', variesWith: 'theme + surface', figma: 'Modes → Theme → Surface' },
  ],
  composition: ['Label as the child. No icons, no dismiss — those make it a Chip.'],
  accessibility: [
    'A tag is text. It needs no role, and giving it one implies an interaction it does not have.',
    'Its text carries a 4.5:1 requirement against its own background, which is why `--Tag-Text` is generated against `--Tag-BG` rather than the page.',
  ],
  gotchas: [
    '`--Tag-BG` is NOT held to 3:1 against the page. It is a background for text, not a control outline, so the contrast that matters is the text on it.',
  ],
};

export const DIVIDER_DOC: ComponentDoc = {
  name: 'Divider',
  summary: 'A rule separating two regions, optionally with a label in it.',
  insteadUse: [
    { when: 'You need space, not a line', use: 'Spacing' },
    { when: 'It separates rows in a list', use: "List's dividers prop" },
    { when: 'It is a section heading', use: 'a heading' },
  ],
  props: [
    { name: 'orientation', type: 'string', values: ['horizontal', 'vertical'], default: 'horizontal' },
    { name: 'color', type: 'string', default: 'default' },
    { name: 'size', type: 'string', values: ['small', 'medium', 'large'], default: 'small' },
    { name: 'indicatorText', type: 'string', default: 'undefined', note: 'A label sitting in the rule — "OR" between two sign-in options.' },
    { name: 'indicatorStyle', type: 'string', values: ['outline', 'solid'], default: 'outline' },
    { name: 'textAlign', type: 'string', values: ['left', 'center', 'right'], default: 'center' },
  ],
  states: [{ state: 'None', setBy: 'prop' }],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Divider pins nothing and inherits.' },
  ],
  tokens: [
    surfaceToken('--Border-Variant', 'the rule'),
    { name: '--Divider', sets: 'its thickness', variesWith: 'size mode', figma: 'Other/Divider' },
  ],
  composition: ['A label goes in `indicatorText`, not as a child beside the rule.'],
  accessibility: [
    'A decorative divider should be hidden from screen readers; one with `indicatorText` is a separator with a label and announces.',
  ],
  gotchas: [
    'It uses `--Border-Variant`, not `--Border`. Variant is decorative and carries no contrast requirement; `--Border` is reserved for anything outlining a control, which must hold 3:1.',
  ],
};

export const RATIO_DOC: ComponentDoc = {
  name: 'Ratio',
  summary: 'Holds a box at a fixed aspect ratio while its content loads or resizes.',
  insteadUse: [
    { when: 'The content sets its own size', use: 'nothing — let it' },
    { when: 'You want a placeholder while loading', use: 'Skeleton' },
  ],
  props: [
    { name: 'ratio', type: 'string', default: '1:1', note: 'Written as `16:9`, not a decimal.' },
    { name: 'fit', type: 'string', values: ['width', 'height'], default: 'width', note: 'Which axis is driven; the other follows from the ratio.' },
    { name: 'variant', type: 'string', default: 'default' },
    { name: 'padding', type: 'string', default: 'none' },
  ],
  states: [{ state: 'None', setBy: 'prop' }],
  theming: [
    { collection: 'Theme', inCode: '`data-theme` on an ancestor.',
      inFigma: 'Ratio - Fill Horizontal and Ratio - Fill Vertical pin nothing.' },
  ],
  tokens: [surfaceToken('--Background', 'the box while empty')],
  composition: ['One child, which fills the box.'],
  accessibility: [
    'It is layout. An image inside still needs its own `alt`.',
  ],
  gotchas: [
    'Two Figma sets, Horizontal and Vertical, at 21 variants each — they correspond to `fit`, not to `ratio`.',
  ],
};

export const DATA_DOCS: ComponentDoc[] = [
  STEPPER_DOC, SLIDER_DOC, RATING_DOC, LOADER_DOC,
  LINK_DOC, TAG_DOC, DIVIDER_DOC, RATIO_DOC,
];
