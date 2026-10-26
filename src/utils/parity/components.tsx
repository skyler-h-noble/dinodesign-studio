/**
 * One entry per component the parity page can compare.
 *
 * `render` turns a Figma variant's properties into the lib component with the
 * same settings. It must read every axis the set has — an axis it ignores
 * shows up as a false match, which is worse than a visible mismatch.
 *
 * `parts` pairs a Figma layer name with a CSS selector inside the rendered
 * variant, for the measurement table. The first is the visual "body" of the
 * component; text layers are compared on font as well.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Alert, AppBar, Avatar, Badge, Box, BreadcrumbItem, Breadcrumbs, Body, BottomNavigation, Button, Card, Checkbox, Chip, CircularProgress, DayCell, Divider, Fab, FieldButton, FormHelper, FormLabel, LinearProgress, Link, LinkGroup, List, Loader, MESSAGE_ICONS, NumberField, OmniTreeView, ImagePlaceholder, Player, TextInput, InputDecorator, ButtonGroup, Icon, Radio, Rail, RailItem, Rating, Ratio, Select, Sheet, Slider, Snackbar, SpeedDial, Step, Stepper, Subtitle, Swatch, SwitchInput, Tab, TabList, Tabs, Tag, TextArea, TextAreaField, Tooltip, ToggleButtonGroup } from '@omni-design/components';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import FlightIcon from '@mui/icons-material/Flight';
import MapIcon from '@mui/icons-material/Map';
import MicIcon from '@mui/icons-material/Mic';
import MailIcon from '@mui/icons-material/Mail';
import BackspaceIcon from '@mui/icons-material/Backspace';
import HomeSharpIcon from '@mui/icons-material/HomeSharp';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import type { FigmaVariant } from './figmaSet';
import type { ForcedState } from './pseudoStates';
import { OWN_STATE_CLASS } from './pseudoStates';

export interface ParityPart {
  figma: string;
  css: string;
  label: string;
  /** Measure this pseudo-element of the matched node rather than the node. */
  pseudo?: '::before' | '::after';
  /** Compare every copy, in order — Figma's `name`, `name#2`… against the
   *  selector's 1st, 2nd… match. For parts a component repeats. */
  all?: boolean;
  /** With `all`: Figma draws this many copies per code copy (a stacked
   *  duplicate) — compare every Nth Figma copy, starting with the first. */
  figmaEvery?: number;
  /** Properties this pairing does not own (another pairing measures them). */
  skip?: string[];
  /** Measure the node's spread box-shadow as a ring: a gap layer, then a band. */
  halo?: boolean;
  /** Measure the node's CSS outline (offset + width) instead of its box. */
  outline?: boolean;
  /** Compare the OUTER edge — for rings, where Figma's stroke sits outside
   *  its frame and CSS's border sits inside its box. */
  outer?: boolean;
  /** Which of the node's box-shadow layers this part owns. Figma splits a
   *  button's shadows across frames — elevation on one, the inset bevel on
   *  another — where CSS stacks them all on one element. 'outer' keeps the
   *  drop shadows, 'inset' the inset ones. An `inset 0 0 0 Npx` ring is read
   *  as N more pixels of border, which is what it draws. */
  shadow?: 'outer' | 'inset' | 'ring';
  /** A child (selector, inside the matched node) whose inset ring is MORE of
   *  this node's border — Card draws its selected ring as a 1px border plus a
   *  1px inset ring on its inner surface, where Figma draws one 2px stroke. */
  ringOn?: string;
  /** Only on the variants this returns true for — when variants draw the same
   *  code node as differently named layers, so a layer one variant lacks is
   *  not "drawn on one side only". */
  when?: (v: FigmaVariant) => boolean;
}

export interface ParityComponent {
  key: string;
  name: string;
  /** The component set in the lib Figma file. */
  nodeId: string;
  parts: ParityPart[];
  /** The lib source file, relative to the lib repo — named in the report. */
  libFile?: string;
  /** The interaction state to force on this variant, if any. */
  forcedState?: (v: FigmaVariant) => ForcedState | undefined;
  render: (v: FigmaVariant, booleans: Record<string, boolean>, ctx: NonNullable<ParityComponent['context']>) => ReactNode;
  /** Extra style for a variant's cell — e.g. a clip that shows one segment of
   *  a group rendered round it. */
  cellStyle?: (v: FigmaVariant) => CSSProperties;
  /** The modes the Figma set RESOLVES in (read with resolvedVariableModes),
   *  which the code side must match or every size and color differs for a
   *  reason that has nothing to do with the component. */
  context?: { theme?: string; surface?: string; size?: 'small' | 'medium' | 'large' };
  /** Axes or layers in Figma the lib has no way to express — listed, not hidden. */
  notes?: string[];
  /** Measurements this component deliberately differs on, per variant — a
   *  decision, not drift. Listed in `notes` so the report still says so. */
  intended?: (v: FigmaVariant, prop: string) => boolean;
}

const noop = () => {};

const swatch: ParityComponent = {
  key: 'swatch',
  name: 'Swatch',
  nodeId: '9212:6816',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Color Swatch', css: '.swatch-chip', label: 'Chip' },
    { figma: 'Label', css: '.swatch-label', label: 'Label' },
    { figma: 'Icon', css: '.swatch-check', label: 'Check mark' },
    { figma: 'Focus-Visible', css: '.swatch-chip', pseudo: '::before', outer: true, label: 'Focus ring' },
  ],
  libFile: 'src/components/Swatch/Swatch.js',
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  render: (v, booleans, ctx) => {
    const state = v.props.State;
    const clickable = state !== 'Non-clickable';
    return (
      <Swatch
        color={v.parts['Color Swatch']?.fill ?? '#e79999'}
        size={ctx.size}
        fit={v.props.Fit === 'Fill' ? 'fill' : 'fixed'}
        label={booleans.Label ? 'color' : undefined}
        selected={booleans.Selected}
        disabled={state === 'Disabled'}
        // Figma's Mark axis: the radio is the selection mark, or the check is.
        radio={v.props.Mark === 'Radio'}
        onClick={clickable ? noop : undefined}
        aria-label={`Swatch ${state} ${v.props.Fit}`}
      />
    );
  },
  notes: [
    'Mark=Radio -> radio; Mark=Check -> no radio (the check on the chip is the mark).',
    'The set inherits .Elevation = Level-3 from its frame; code renders at the page default.',
  ],
};

const radio: ParityComponent = {
  key: 'radio',
  name: 'Radio',
  nodeId: '6778:13571',
  libFile: 'src/components/Radio/Radio.js',
  parts: [
    { figma: 'Radio', css: '.radio-circle-icon', label: 'Ring' },
    { figma: 'Dot', css: '.radio-circle-icon > div', label: 'Dot' },
    { figma: 'Hover', css: '.radio-circle-icon', halo: true, outer: true, label: 'Hover halo' },
    { figma: 'Pressed', css: '.radio-circle-icon', halo: true, outer: true, label: 'Pressed halo' },
    { figma: 'Focus-Visible', css: '.radio-circle-icon', outline: true, outer: true, label: 'Focus ring' },
  ],
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // The set resolves in .Theme=Primary (on each variant) and Component-Size
  // medium — the page used to pin large; that override is gone.
  context: { theme: 'Primary', surface: 'Surface', size: 'medium' },
  // No `color`: the comparison is against what the lib does BY DEFAULT, which
  // is what every caller that passes nothing gets — Swatch's radio included.
  render: (v, _b, ctx) => (
    <Radio
      size={ctx.size}
      // MUI marks keyboard focus with a class, not :focus-visible, and the
      // lib's ring hangs off that class — so Focus-Visible is forced by it.
      className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
      checked={v.props.Status === 'selected'}
      disabled={v.props.State === 'Disabled'}
      onChange={noop}
      aria-label={`Radio ${v.props.State} ${v.props.Status}`}
    />
  ),
};

const ALERT_ICONS = { Info: InfoIcon, Success: CheckCircleIcon, Warning: WarningIcon, Error: ErrorIcon } as const;

const alert: ParityComponent = {
  key: 'alert',
  name: 'Alert',
  nodeId: '9645:17163',
  libFile: 'src/components/Alert/Alert.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    // The shadow is on the component root; the border and radius on Theme-Container.
    { figma: '__root__', css: '.alert', label: 'Container shadow', skip: ['position', 'width', 'height', 'radius (as drawn)', 'border', 'fill', 'opacity'] },
    { figma: 'Theme-Container', css: '.alert', label: 'Container', skip: ['fill', 'shadow'] },
    // The lib splits the container: border and radius on .alert, the fill on
    // .alert-inner — so the fill is compared where it is painted.
    { figma: 'Theme-Container', css: '.alert-inner', label: 'Container fill', skip: ['position', 'width', 'height', 'radius (as drawn)', 'border', 'shadow', 'opacity'] },
    { figma: 'Message Icons', css: '.alert-start-decorator', label: 'Icon frame' },
    // The glyph itself, not just its frame: the frame once matched at 16px
    // while Figma drew a 24px icon spilling out of it.
    { figma: 'Icon', css: '.alert-start-decorator .icon', label: 'Icon' },
    { figma: 'Alert Title', css: '.alert-title .typography, .alert-title p, .alert-title span', label: 'Title' },
    // The button's visible shape is its inner Theme-Button frame; the instance root is a bare box.
    { figma: 'Theme-Button', css: '.alert-end-decorator button', label: 'Close button' },
    { figma: 'Alert body', css: '.alert-message .typography, .alert-message p, .alert-message span', label: 'Body' },
  ],
  render: (v, _b, ctx) => {
    const state = v.props['State-Theme'] as keyof typeof ALERT_ICONS;
    const Glyph = ALERT_ICONS[state] ?? InfoIcon;
    return (
      <Alert
        color={state.toLowerCase()}
        variant="light"
        size={ctx.size}
        style={{ width: v.box.w, boxSizing: 'border-box' }}
        title="Alert Title"
        startDecorator={<Icon size="small"><Glyph /></Icon>}
        endDecorator={<Button iconOnly variant="ghost" size="medium" aria-label="Close alert"><CloseIcon /></Button>}
      >
        Alert body
      </Alert>
    );
  },
};

/* Three open segments, as the Figma group draws them. Its layers repeat per
   segment, and `all` compares every segment, not just the first. */
const accordionGroup: ParityComponent = {
  key: 'accordion-group',
  name: 'Accordion Group',
  nodeId: '6888:29570',
  libFile: 'src/components/Accordion/Accordion.js',
  // The Accordion page resolves the group at Component-Size=small.
  context: { theme: 'Default', surface: 'Surface', size: 'small' },
  parts: [
    { figma: 'Theme-Container', css: '.accordion-segment', label: 'Segment', all: true, skip: ['shadow', 'border'] },
    // The border is an overlay (::after), drawn inside like Figma's stroke.
    { figma: 'Theme-Container', css: '.accordion-segment', pseudo: '::after', label: 'Segment border', all: true, skip: ['fill', 'shadow', 'opacity'] },
    { figma: 'Vertical Container', css: '.accordion-segment', label: 'Segment shadow', all: true, skip: ['position', 'width', 'height', 'radius (as drawn)', 'border', 'fill', 'opacity'] },
    // The summary's corner is a hover-only radius in code; Figma's frame has none.
    { figma: 'Accordion Summary', css: '.accordion-summary', label: 'Summary', all: true, skip: ['radius (as drawn)'] },
    // Figma stacks two chevrons per segment (up over down); code rotates one.
    { figma: 'Icon', css: '.accordion-summary svg', label: 'Chevron', all: true, figmaEvery: 2, skip: ['fill'] },
    // Figma names the title AND the body text "Component Name", in that order
    // per segment — matched against each summary title and details text in turn.
    { figma: 'Component Name', css: '.accordion-summary .typography, .accordion-details .typography', label: 'Text', all: true },
    { figma: 'Accordion Details', css: '.accordion-details', label: 'Details', all: true },
  ],
  render: (v, _b, ctx) => (
    // spacing counts in 8px steps: 1 = Sizing-1, the gap Figma's group binds.
    <AccordionGroup spacing={v.props.Style === 'connected' ? 0 : 1} size={ctx.size} style={{ width: v.box.w }}>
      {[0, 1, 2].map((i) => (
        <Accordion key={i} defaultExpanded>
          <AccordionSummary>Accordion body</AccordionSummary>
          <AccordionDetails>Accordion body</AccordionDetails>
        </Accordion>
      ))}
    </AccordionGroup>
  ),
};

/* One segment per variant. Position=default is a lone segment; top, middle
   and bottom only exist inside a connected group (the lib gives a segment its
   corners from where it sits), so those render a three-segment connected group
   shifted and clipped to show the one in that position. `.parity-target` marks
   the segment being compared. */
const SEGMENT_INDEX = { top: 0, middle: 1, bottom: 2 } as const;
const accordionSegment: ParityComponent = {
  key: 'accordion-segment',
  name: 'Accordion Segment',
  nodeId: '3156:2295',
  libFile: 'src/components/Accordion/Accordion.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Theme-Container', css: '.parity-target', label: 'Segment', skip: ['shadow', 'border'] },
    { figma: 'Theme-Container', css: '.parity-target', pseudo: '::after', label: 'Segment border', skip: ['fill', 'shadow', 'opacity'] },
    { figma: 'Vertical Container', css: '.parity-target', label: 'Segment shadow', skip: ['position', 'width', 'height', 'radius (as drawn)', 'border', 'fill', 'opacity'] },
    { figma: 'Accordion Summary', css: '.parity-target .accordion-summary', label: 'Summary', skip: ['radius (as drawn)'] },
    // Figma stacks a second chevron on a background patch to fake the closed
    // glyph; code rotates one. Only the first is compared, and not its fill —
    // that fill is the patch, which code has no reason to draw.
    { figma: 'Icon', css: '.parity-target .accordion-summary svg', label: 'Chevron', skip: ['fill'] },
    { figma: 'Component Name', css: '.parity-target .accordion-summary .typography, .parity-target .accordion-details .typography', label: 'Text', all: true },
    { figma: 'Accordion Details', css: '.parity-target .accordion-details', label: 'Details' },
    // The ring is the segment's outline (drawn while its summary has focus).
    { figma: 'Focus-Visible', css: '.parity-target', outline: true, outer: true, label: 'Focus ring' },
  ],
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  cellStyle: (v) => {
    const pos = v.props.Position;
    // Clip top and bottom to the segment, never the sides (room for a ring).
    if (pos === 'top') return { clipPath: 'inset(-8px -8px 0 -8px)' };
    if (pos === 'middle') return { clipPath: 'inset(0 -8px)' };
    if (pos === 'bottom') return { clipPath: 'inset(0 -8px -8px -8px)' };
    return {};
  },
  render: (v, booleans, ctx) => {
    const disabled = v.props.State === 'Disabled';
    const open = booleans.Open ?? true;
    const seg = (target: boolean, key?: number) => (
      <Accordion key={key} defaultExpanded={open} disabled={target && disabled} className={target ? 'parity-target' : undefined}>
        <AccordionSummary>Accordion body</AccordionSummary>
        <AccordionDetails>Accordion body</AccordionDetails>
      </Accordion>
    );
    const pos = v.props.Position as keyof typeof SEGMENT_INDEX | 'default';
    if (pos === 'default') {
      return <AccordionGroup spacing={1} size={ctx.size} style={{ width: v.box.w }}>{seg(true)}</AccordionGroup>;
    }
    const idx = SEGMENT_INDEX[pos];
    return (
      // Connected segments overlap by 1px, so each one starts h - 1 below the last.
      <div style={{ marginTop: -idx * (v.box.h - 1), width: v.box.w }}>
        <AccordionGroup spacing={0} size={ctx.size} style={{ width: v.box.w }}>
          {[0, 1, 2].map((i) => seg(i === idx, i))}
        </AccordionGroup>
      </div>
    );
  },
};

/* Figma's three AppBar layouts, built from the lib's own parts: Tabs in the
   middle, a ButtonGroup of icon buttons and an avatar button at the end. The
   brand mark is the design system's own artwork (the Brand add-on), so a
   32px box stands in for it — its place and size are what is compared. */
const APPBAR_LAYOUT = { 'Left brand': 'left-brand', 'Center Brand': 'center-brand', 'Title App Bar': 'title' } as const;
const appBar: ParityComponent = {
  key: 'app-bar',
  name: 'AppBar',
  nodeId: '7442:31333',
  libFile: 'src/components/AppBar/AppBar.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.appbar', label: 'Bar shadow', skip: ['position', 'width', 'height', 'radius (as drawn)', 'border', 'fill', 'opacity'] },
    { figma: 'Theme-Container', css: '.appbar', label: 'Bar', skip: ['shadow'] },
    { figma: 'Brand', css: '.parity-brand', label: 'Brand' },
    { figma: 'Tabs', css: '.appbar-center .tabs', label: 'Tabs' },
    { figma: 'Right Content', css: '.appbar-end', label: 'End group' },
    { figma: 'ButtonGroup', css: '.appbar-end .btn-group', label: 'Button group' },
    { figma: 'Title', css: '.appbar-title', label: 'Title' },
  ],
  render: (v, booleans) => {
    const layout = APPBAR_LAYOUT[v.props.Layout as keyof typeof APPBAR_LAYOUT] ?? 'left-brand';
    return (
      <AppBar
        layout={layout}
        showMenu={booleans.Menu ?? true}
        title="Title"
        brand={<Box className="parity-brand" sx={{ width: 32, height: 32 }} aria-hidden="true" />}
        centerSlot={
          <Tabs defaultValue={0} variant="standard" color="default">
            <TabList aria-label="Sections">
              {['Button', 'Button', 'Button'].map((t, i) => <Tab key={i}>{t}</Tab>)}
            </TabList>
          </Tabs>
        }
        endSlot={
          <>
            <ButtonGroup>
              {[0, 1, 2].map((i) => (
                <Button key={i} iconOnly variant="ghost" size="medium" aria-label={`Action ${i + 1}`}><HomeIcon /></Button>
              ))}
            </ButtonGroup>
            <Button avatar size="medium" aria-label="Account">L</Button>
          </>
        }
        // The bar's width INCLUDES its Margin padding, as Figma's 1920 does.
        sx={{ width: v.box.w, boxSizing: 'border-box' }}
      />
    );
  },
};

/* Alphabetical, as they are worked through. */
/* Three 32px variants. Each draws its disc as a differently named frame —
   Photo, Button-Theme-Avatar (the person glyph) and Button-Theme-Initials — and
   each is the lib's .avatar root, so each part is measured only on its own
   variant (`when`). Figma pads each side with a zero-width Spacer,
   which is why the instance is 32.0002 wide. */
const avatar: ParityComponent = {
  key: 'avatar',
  name: 'Avatar',
  nodeId: '3156:3696',
  libFile: 'src/components/Avatar/Avatar.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Photo', css: '.avatar', label: 'Photo disc', when: (v) => v.props.Style === 'Photo' },
    { figma: 'Button-Theme-Avatar', css: '.avatar', label: 'Glyph disc', when: (v) => v.props.Style === 'Default' },
    { figma: 'Vector', css: '.avatar svg', label: 'Person glyph', when: (v) => v.props.Style === 'Default' },
    { figma: 'Button-Theme-Initials', css: '.avatar', label: 'Initials disc', when: (v) => v.props.Style === 'Initials' },
    { figma: 'Component Name', css: '.avatar .typography, .avatar p, .avatar span', label: 'Initials', when: (v) => v.props.Style === 'Initials' },
  ],
  render: (v) => {
    const style = String(v.props.Style);
    /* The size comes from the set's Icons & Avatars mode, which the variant's
       drawn width reports (Avatar-Size: xxs 16 … xxl 72) — not from
       Component-Size, so it is read off the box rather than the context. */
    const AVATAR_SIZE: Record<number, string> = { 16: 'xxs', 20: 'xs', 24: 'small', 32: 'medium', 40: 'large', 56: 'xl', 72: 'xxl' };
    const size = AVATAR_SIZE[Math.round(v.box.w)] ?? 'medium';
    if (style === 'Initials') return <Avatar size={size} initials="LN" alt="LN" />;
    // Default is the person glyph: the brand fallback, not the built-in photo.
    if (style === 'Default') return <Avatar size={size} defaultPhoto={false} alt="User" />;
    return <Avatar size={size} alt="User photo" />;
  },
};

/* Two types: a 16px counter carrying "1" and an 8px status dot. The set
   resolves Icons=Error, so the badge is the error palette. A badge normally
   hangs off a child's corner; here it has none and is pinned in place, so the
   badge itself is what is measured, not where MUI anchors it. */
const badgeCounter: ParityComponent = {
  key: 'badge-counter',
  name: 'Badge Counter',
  nodeId: '3156:5150',
  libFile: 'src/components/Badge/Badge.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.MuiBadge-badge', label: 'Badge' },
    // The digit is centred in the pill; its box is the text's, so only the
    // type and the centre are compared.
    { figma: '1', css: '.MuiBadge-badge', label: 'Count', when: (v) => v.props.Type === 'standard', skip: ['width', 'height', 'radius (as drawn)', 'fill', 'border', 'shadow'] },
  ],
  /* Pinned from OUTSIDE. Passing sx={{ '& .MuiBadge-badge': … }} replaced the
     lib's own '& .MuiBadge-badge' block (same key, spread last), so the badge
     rendered as bare MUI — 20px, unfilled, Roboto — and every row was a
     harness artefact. */
  render: (v) => (
    <span className="parity-badge-pin">
      {/* Block, no line box: an inline badge sat on a text line and measured
          ~3px low (7 for the dot) for a reason that is not the badge's. */}
      <style>{'.parity-badge-pin{display:block;line-height:0}.parity-badge-pin .MuiBadge-root{display:block}.parity-badge-pin .MuiBadge-badge{position:static;transform:none}'}</style>
      <Badge
        variant="error"
        type={v.props.Type === 'status' ? 'status' : 'standard'}
        badgeContent={1}
      />
    </span>
  ),
};

/* A slot that paints its surface. No Ratio is the bare Box filling its
   frame; Ratio holds a 1:1 Ratio filling the Box's width ("Ratio - Fill
   Horizontal", the Ratio component), so the height follows the width. Both
   are 1214 square in the set, so the comparison runs at 1x. */
const box: ParityComponent = {
  key: 'box',
  name: 'Box',
  nodeId: '7191:61860',
  libFile: 'src/components/Box/Box.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.omni-box', label: 'Box', skip: ['fill'] },
    { figma: 'Content Slot', css: '.omni-box', label: 'Content slot', when: (v) => v.props.Fit === 'No Ratio' },
    { figma: 'Ratio - Fill Horizontal', css: '.ratio', label: 'Ratio', when: (v) => v.props.Fit === 'Ratio' },
  ],
  render: (v) => v.props.Fit === 'Ratio'
    ? (
      <Box style={{ width: v.box.w }}>
        <Ratio ratio="1:1" placeholder={false} />
      </Box>
    )
    : <Box style={{ width: v.box.w, height: v.box.h }} />,
};

/* The assembled trail: six link crumbs and the current one, with slanted
   separators, 8px apart (Desktop). The middle five sit in a "breadcrumb slot"
   frame, which code has no equivalent of — the list is flat — so crumbs and
   separators are compared in order, every copy. The hidden Mobile layout (a
   back button and the current crumb) is the lib's backOnlyMobile, not drawn. */
const breadcrumbs: ParityComponent = {
  key: 'breadcrumbs',
  name: 'Breadcrumbs',
  nodeId: '8424:36170',
  libFile: 'src/components/Breadcrumbs/Breadcrumbs.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Desktop', css: '.breadcrumbs-list', label: 'Trail' },
    { figma: 'Breadcrumb-Segments', css: '.breadcrumb-item', label: 'Crumb', all: true },
    { figma: 'Breadcrumbs-separator', css: '.breadcrumb-separator', label: 'Separator', all: true },
  ],
  notes: ['The hidden Mobile layout is backOnlyMobile in the lib and is not compared.'],
  render: () => (
    <Breadcrumbs size="medium" separator="/">
      {Array.from({ length: 6 }, (_, i) => <BreadcrumbItem key={i} href="#">Hotlink</BreadcrumbItem>)}
      <BreadcrumbItem>Hotlink</BreadcrumbItem>
    </Breadcrumbs>
  ),
};

/* The Button set: State x Type x Style x Status, 75 variants, resolved at
   Buttons=default and Component-Size=medium. Figma layers the button in three
   frames — Button-Effect (the elevation shadow), Theme-Button, Button-Fill
   (fill, Border stroke, the bevel) — and the lib paints all three on the one
   <button>, so each Figma frame is compared against that element for the
   properties it owns. The text type carries the boolean decorators at their
   set defaults: a start avatar and an end icon. */
const BUTTON_STYLE: Record<string, string> = { solid: 'default', outline: 'default-outline', ghost: 'ghost' };
const button: ParityComponent = {
  key: 'button',
  name: 'Button',
  nodeId: '5769:46293',
  libFile: 'src/components/Button/Button.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // Decided 2026-10-20: an unselected button rises 1px on hover. Figma draws
  // hover in place, so every position on a Hover variant is 1px off by design.
  intended: (v, prop) =>
    (v.props.State === 'Hover' && v.props.Status === 'unselected' && prop.startsWith('position'))
    // An unselected ghost at rest: Figma paints Background, code is transparent
    // over that same surface — the same pixels.
    || (v.props.Style === 'ghost' && v.props.Status === 'unselected' && prop === 'fill'
        && ['Default', 'Focus-Visible', 'Disabled'].includes(String(v.props.State))),
  notes: [
    'Hover lifts an unselected button 1px (translateY(-1px)) — intended; Figma draws hover in place, so Hover positions are not compared.',
    'An unselected ghost at rest is transparent in code and Background in Figma (on Theme-Button) — the same pixels, so that fill is not compared.',
  ],
  parts: [
    { figma: 'Button-Effect', css: 'button.MuiButton-root', label: 'Elevation', skip: ['fill', 'border'], shadow: 'outer' },
    { figma: 'Button-Fill', css: 'button.MuiButton-root', label: 'Fill', when: (v) => !(v.props.Style === 'ghost' && v.props.Status === 'unselected'), shadow: 'inset' },
    // An unselected ghost has no Button-Fill (decided 2026-10-20): its paint
    // is on Theme-Button — Background at rest, Hover / Pressed on interaction.
    { figma: 'Theme-Button', css: 'button.MuiButton-root', label: 'Ghost fill', when: (v) => v.props.Style === 'ghost' && v.props.Status === 'unselected', skip: ['border', 'shadow', 'radius (as drawn)', 'opacity'] },
    // The label is TWO nodes in both: a padded holder, and the text inside it.
    // The holder carries MUI's root font, so the type is read off the text.
    { figma: 'Typography Holder', css: '.btn-text-content', label: 'Label box', when: (v) => v.props.Type === 'text', skip: ['fill'] },
    { figma: 'Component Name', css: '.btn-text-content .typography', label: 'Label', when: (v) => v.props.Type === 'text' },
    { figma: 'Component Name', css: 'button.MuiButton-root > .typography', label: 'Number', when: (v) => v.props.Type === 'letterNumber' },
    // The ring is on the avatar's Photo frame, not on the instance around it.
    { figma: 'Photo', css: '.MuiButton-startIcon .avatar', label: 'Start avatar', when: (v) => v.props.Type === 'text' },
    { figma: 'Icon', css: '.MuiButton-endIcon', label: 'End icon', when: (v) => v.props.Type === 'text' },
    { figma: 'Focus-Visible', css: 'button.MuiButton-root', outline: true, outer: true, label: 'Focus ring' },
  ],
  render: (v, b, ctx) => {
    const common = {
      variant: BUTTON_STYLE[String(v.props.Style)] ?? 'default',
      size: ctx.size,
      selected: v.props.Status === 'selected',
      disabled: v.props.State === 'Disabled',
      // The lib styles focus off MUI's class, not :focus-visible, so forcing
      // the pseudo-class alone drew Focus-Visible as rest (as Radio, above).
      className: v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined,
    };
    const avatarDeco = <Avatar alt="" />;
    const iconDeco = <HomeIcon />;
    switch (v.props.Type) {
      case 'iconOnly':
        return <Button {...common} contentType="iconOnly" aria-label="Home"><HomeIcon /></Button>;
      case 'letterNumber':
        return <Button {...common} contentType="letterNumber" aria-label="Item 123">123</Button>;
      case 'Avatar':
        return <Button {...common} contentType="avatar" aria-label="Account"><Avatar alt="" /></Button>;
      default:
        return (
          <Button
            {...common}
            startDecorator={b['start-avatar'] ? avatarDeco : b['start-icon'] ? iconDeco : undefined}
            endDecorator={b['end-icon'] ? iconDeco : b['end-avatar'] ? avatarDeco : undefined}
          >
            Button
          </Button>
        );
    }
  },
};

/* ButtonGroup: a row of ACTIONS, spaced, none of them selected (the selection
   control is ToggleButtonGroup). Three default solid Buttons at the Button
   set's default decorators, 4px apart; the middle one sits in a Slot frame
   code has no equivalent of, so the Buttons are compared in order. Fit=fill
   stretches the group to its container and the Buttons share the width. */
const buttonGroup: ParityComponent = {
  key: 'buttonGroup',
  name: 'ButtonGroup',
  nodeId: '9350:37170',
  libFile: 'src/components/ButtonGroup/ButtonGroup.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    // The group paints nothing, so its corner radius draws nothing either.
    { figma: '__root__', css: '.btn-group', label: 'Group', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // Figma's `Button` is the instance's outer frame: its fill, border, radius
    // and bevel live on the inner Button-Fill / Button-Effect, which Button
    // parity compares. Here only where each Button sits and how big it is.
    { figma: 'Button', css: 'button.MuiButton-root', label: 'Button', all: true, skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'opacity'] },
    // …and its paint, off the inner layers that carry it. Without these the
    // group could repaint its Buttons (it did: every one as an unselected
    // toggle segment) and still report zero differences.
    { figma: 'Button-Fill', css: 'button.MuiButton-root', label: 'Button fill', all: true, shadow: 'inset', skip: ['position', 'width', 'height'] },
    { figma: 'Component Name', css: '.btn-text-content .typography', label: 'Label', all: true },
  ],
  notes: ['The middle Button sits in a Slot frame (a placeholder for more buttons) — code has no wrapper, so it is not compared.'],
  render: (v) => {
    const fill = v.props.Fit === 'fill';
    const btn = (i: number) => (
      <Button key={i} startDecorator={<Avatar alt="" />} endDecorator={<HomeIcon />}>Button</Button>
    );
    return (
      <div style={{ width: fill ? v.box.w : undefined, display: 'inline-block' }}>
        <ButtonGroup orientation={String(v.props.Orientation) as 'horizontal' | 'vertical'} fit={fill ? 'fill' : 'hug'}>
          {[0, 1, 2].map(btn)}
        </ButtonGroup>
      </div>
    );
  },
};

/* ToggleButtonGroup: a control with a value, the first segment selected.
   Style=Default is JOINED — Figma draws it from .Button-Group-Segments (end
   caps left / center / right, or top / center / bottom), overlapping by the
   border. Style=Separated is plain Buttons 4px apart. Outline at rest, the
   selected segment filled. Segment size and position, then each segment's
   paint off its inner Button-Fill, then its label. */
const TOGGLE_SEGMENT = (v: FigmaVariant) => (v.props.Style === 'Separated' ? 'Button' : '.Button-Group-Segments');
const toggleButtonGroup: ParityComponent = {
  key: 'toggleButtonGroup',
  name: 'ToggleButtonGroup',
  nodeId: '6599:138',
  libFile: 'src/components/ToggleButtonGroup/ToggleButtonGroup.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.btn-group', label: 'Group', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: '.Button-Group-Segments', css: 'button.MuiButton-root', label: 'Segment', all: true, when: (v) => TOGGLE_SEGMENT(v) !== 'Button', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'opacity'] },
    { figma: 'Button', css: 'button.MuiButton-root', label: 'Segment', all: true, when: (v) => TOGGLE_SEGMENT(v) === 'Button', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'opacity'] },
    { figma: 'Button-Fill', css: 'button.MuiButton-root', label: 'Segment fill', all: true, shadow: 'inset', skip: ['position', 'width', 'height'] },
    { figma: 'Component Name', css: '.btn-text-content .typography', label: 'Label', all: true },
  ],
  notes: ['The middle segment sits in a Slot frame (a placeholder for more segments) — code has no wrapper, so it is not compared.'],
  render: (v) => {
    const fill = v.props.Fit === 'Fill';
    return (
      <div style={{ width: fill ? v.box.w : undefined, display: 'inline-block' }}>
        <ToggleButtonGroup
          value="a"
          onChange={() => {}}
          separated={v.props.Style === 'Separated'}
          orientation={String(v.props.Orientation) as 'horizontal' | 'vertical'}
          fit={fill ? 'fill' : 'hug'}
        >
          {['a', 'b', 'c'].map((val) => (
            <Button key={val} value={val} startDecorator={<Avatar alt="" />} endDecorator={<HomeIcon />}>Button</Button>
          ))}
        </ToggleButtonGroup>
      </div>
    );
  },
};

/* Card: Card Container (border, radius, the Card / Card-Hover effect style)
   around Card Content (the Background), padded by Card-Padding, holding a
   Subtitle title and a Body paragraph. The Selected boolean defaults ON, so
   every clickable state draws Figma's Selected frame — a 2px ring laid over
   the card — which code draws as the card's own border. Figma shows the hover
   lift by dropping the variant's 1px top / bottom padding, so the code side
   sits in the same 1px padding and its translateY(-1px) lands where Figma's
   card does. */
const card: ParityComponent = {
  key: 'card',
  name: 'Card',
  nodeId: '8103:17421',
  libFile: 'src/components/Card/Card.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Card Container', css: '.card', label: 'Card', shadow: 'outer', when: (v) => !v.parts['Selected'] },
    // With the Selected frame drawn, the card's border IS that ring.
    { figma: 'Card Container', css: '.card', label: 'Card', shadow: 'outer', skip: ['border'], when: (v) => !!v.parts['Selected'] },
    { figma: 'Focus-Visible', css: '.card', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Selected', css: '.card', label: 'Selected ring', ringOn: ':scope > .MuiBox-root', skip: ['fill', 'shadow', 'position', 'width', 'height'], when: (v) => !!v.parts['Selected'] },
    // Figma squares the content and lets the container clip it; code rounds it
    // by `inherit` under the same clip — the same pixels, so radius is not compared.
    { figma: 'Card Content', css: '.card > .MuiBox-root', label: 'Content', skip: ['border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Card title', css: '.card .typography:first-of-type', label: 'Title' },
    { figma: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', css: '.card .typography:last-of-type', label: 'Body' },
  ],
  notes: ['Figma draws the hover lift as the variant losing its 1px padding; code lifts the card 1px inside the same padding.'],
  render: (v) => {
    const clickable = v.props.State !== 'Non-clickable';
    return (
      <div style={{ width: v.box.w, padding: '1px 0', boxSizing: 'border-box' }}>
        <Card
          clickable={clickable}
          selected={clickable && !!v.parts['Selected']}
          disabled={v.props.State === 'Disabled'}
          orientation={String(v.props.Orientation) as 'horizontal' | 'vertical'}
        >
          {/* Figma's slot stacks title over body in BOTH orientations — the
              axis is for media placement, and there is no media here. Code's
              horizontal card lays its children in a row, so horizontal gets
              the column CardContent would give it (CardContent itself is not
              exported from the package; same gap as Card's own medium, 4px). */}
          {v.props.Orientation === 'horizontal' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <Subtitle>Card title</Subtitle>
              <Body>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</Body>
            </div>
          ) : (
            <>
              <Subtitle>Card title</Subtitle>
              <Body>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</Body>
            </>
          )}
        </Card>
      </div>
    );
  },
};

/* Checkbox: a 20px box with a 2px inside border, in a 24px touch target, at
   Buttons=default / medium. Unchecked is a border only; checked and
   indeterminate fill with Buttons::Button and carry a 16px icon. Hover and
   Pressed recolor the border (no halo, unlike Radio); Focus-Visible is a 2px
   ring laid 1px outside the box. Default · checked nests its fill and border
   one frame deeper (an inner `Checkbox`), so that variant is read from there. */
const CHECKBOX_BOX = (v: FigmaVariant) => (v.props.State === 'Default' && v.props.Checked === 'checked' ? 'Checkbox' : 'Checkbox Border');
const checkbox: ParityComponent = {
  key: 'checkbox',
  name: 'Checkbox',
  nodeId: '6731:46',
  libFile: 'src/components/Checkbox/Checkbox.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Checkbox Border', css: '.chk-box-icon', label: 'Box', skip: ['fill'], when: (v) => CHECKBOX_BOX(v) === 'Checkbox Border' },
    { figma: 'Checkbox', css: '.chk-box-icon', label: 'Box', skip: ['fill', 'position'], when: (v) => CHECKBOX_BOX(v) === 'Checkbox' },
    // The fill is the box's inner surface in code. Unchecked draws none in
    // Figma and the surface's own Background in code — the same pixels.
    { figma: 'Checkbox Border', css: '.chk-box-icon > div', label: 'Fill', skip: ['border', 'radius (as drawn)', 'position', 'width', 'height', 'shadow', 'opacity'], when: (v) => v.props.Checked !== 'unchecked' && CHECKBOX_BOX(v) === 'Checkbox Border' },
    { figma: 'Checkbox', css: '.chk-box-icon > div', label: 'Fill', skip: ['border', 'radius (as drawn)', 'position', 'width', 'height', 'shadow', 'opacity'], when: (v) => CHECKBOX_BOX(v) === 'Checkbox' },
    // Figma's 16px frame and code's 14px svg hold the same 14px glyph about the
    // same centre, so only the dimming is compared, not the boxes.
    { figma: 'Icon', css: '.chk-box-icon svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'position', 'width', 'height'] },
    { figma: 'Focus-Visible', css: '.chk-box-icon', outline: true, outer: true, label: 'Focus ring' },
  ],
  // No `variant`: compared against what the lib draws for a caller who passes none.
  render: (v) => (
    <Checkbox
      className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
      checked={v.props.Checked === 'checked'}
      indeterminate={v.props.Checked === 'indeterminate'}
      disabled={v.props.State === 'Disabled'}
      onChange={noop}
      aria-label={`Checkbox ${v.props.State} ${v.props.Checked}`}
    />
  ),
};

/* Checkbox Field: a Checkbox and a Form-Label, Other/Label-Gap apart, the
   label on the right / left / top / bottom (or none). Compared: the whole
   field, where the checkbox sits in it, and the label's text. */
const CHECKBOX_FIELD_PLACEMENT: Record<string, 'end' | 'start' | 'top' | 'bottom'> = {
  'label-right': 'end', 'label-left': 'start', 'label-top': 'top', 'label-bottom': 'bottom',
};
const checkboxField: ParityComponent = {
  key: 'checkboxField',
  name: 'Checkbox Field',
  nodeId: '9439:46345',
  libFile: 'src/components/Checkbox/Checkbox.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.MuiFormControlLabel-root', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Checkbox', css: '.MuiCheckbox-root', label: 'Checkbox', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Label', css: '.MuiFormControlLabel-label .typography', label: 'Label' },
  ],
  render: (v) => {
    const placement = CHECKBOX_FIELD_PLACEMENT[String(v.props.Label)];
    return placement
      ? <Checkbox label="Label" labelPlacement={placement} onChange={noop} />
      : <Checkbox onChange={noop} aria-label="Checkbox" />;
  },
};

/* Chip: Chip Holder (the hover lift) around Theme-Chip-Body (the fill and,
   unselected, a 1px inside border), at Surface-Brightest unselected and
   Surface-Dimmest selected, holding an avatar, the label and an icon — the
   Start-Avatar / End-Icon booleans default on, Start-Icon / End-Avatar off.
   Focus-Visible is a 2px ring 3px outside. The set resolves in .Theme=Default,
   so the code side is variant="default", which inherits. */
const chip: ParityComponent = {
  key: 'chip',
  name: 'Chip',
  nodeId: '8927:15447',
  libFile: 'src/components/Chip/Chip.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // The holder carries the hover lift; the body carries the fill and the
    // 1px inside border (a frame's own stroke draws under its children, so on
    // the holder the body's fill covered it).
    { figma: 'Chip Holder', css: '.MuiChip-root', label: 'Chip', skip: ['fill', 'border'] },
    // Radius IS compared here: this is the element that paints. The root's
    // radius matching proved nothing while the inner surface drew square.
    { figma: 'Theme-Chip-Body', css: '.chip-surface', label: 'Fill', skip: ['shadow'] },
    { figma: 'Focus-Visible', css: '.MuiChip-root', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Avatar', css: '.MuiChip-label .avatar', label: 'Avatar', skip: ['fill', 'border'] },
    { figma: 'Icon', css: '.MuiChip-label svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Component Name', css: '.MuiChip-label .chip-parity-label', label: 'Label' },
  ],
  render: (v, booleans) => {
    const avatar = <Avatar alt="" />;
    const icon = <HomeIcon />;
    const start = (booleans['Start-Avatar'] ?? true) ? avatar : booleans['Start-Icon'] ? icon : undefined;
    const end = (booleans['End-Icon'] ?? true) ? icon : booleans['End-Avatar'] ? avatar : undefined;
    return (
      <Chip
        variant="default"
        className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
        clickable
        selected={v.props.Status === 'selected'}
        disabled={v.props.State === 'Disabled'}
        onClick={noop}
        startDecorator={start}
        endDecorator={end}
        label={<span className="chip-parity-label">Button</span>}
      />
    );
  },
};

/* Count Step: one Stepper step — a Button-Height circle (Button-Fill: fill
   and ring; Button-Effect: the hover lift) holding its number, with a label
   below (Bottom Label, on by default) or to the right (Right Label). Status
   is where the step sits against activeStep: incomplete is ahead of it,
   current is on it, complete is behind it. */
const COUNT_STEP_ACTIVE: Record<string, number> = { incomplete: -1, current: 0, complete: 1 };
const countStep: ParityComponent = {
  key: 'countStep',
  name: 'Count Step',
  nodeId: '8379:13829',
  libFile: 'src/components/Stepper/Stepper.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Button-Fill', css: '.step-indicator', label: 'Circle', skip: ['shadow'] },
    { figma: 'Button-Effect', css: '.step-indicator', label: 'Lift', shadow: 'outer', skip: ['fill', 'border', 'position', 'width', 'height', 'radius (as drawn)'] },
    { figma: 'Focus-Visible', css: '.step-indicator', outline: true, outer: true, label: 'Focus ring' },
    // The digit is a bare text node in the circle, so its box is the circle's: compare its type and color, not where it sits.
    { figma: 'Component Name', css: '.step-indicator', label: 'Number', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'position', 'position (centre, top)', 'width', 'height'] },
    { figma: 'Label', css: '.step .typography', label: 'Label' },
  ],
  render: (v, booleans) => {
    const bottom = booleans['Bottom Label'] ?? true;
    const right = booleans['Right Label'] ?? false;
    return (
      <div style={{ width: v.box.w, display: 'inline-block' }}>
        <Stepper
          orientation={right && !bottom ? 'vertical' : 'horizontal'}
          activeStep={COUNT_STEP_ACTIVE[String(v.props.Status)]}
          clickable
          onStepClick={noop}
        >
          <Step
            label={bottom || right ? 'Label' : undefined}
            disabled={v.props.State === 'Disabled'}
            className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
          />
        </Stepper>
      </div>
    );
  },
};

/* Divider: a 1-layer rule, Border-Variant, its thickness bound to
   Component-Size › Other › Divider. The set's Size axis has one value
   (small) — the weight comes from the Component-Size MODE the set resolves
   in, so the code side takes the context size, not the axis. */
const divider: ParityComponent = {
  key: 'divider',
  name: 'Divider',
  nodeId: '6847:27685',
  libFile: 'src/components/Divider/Divider.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '[role="separator"]', label: 'Rule' },
  ],
  notes: ['Figma\'s Size axis has only "small"; the thickness follows the Component-Size mode, so code renders size={context size}.'],
  render: (v, _b, ctx) => {
    const vertical = v.props.Orientation === 'vertical';
    return (
      <div style={{ width: v.box.w, height: v.box.h, display: 'flex', flexDirection: vertical ? 'row' : 'column', justifyContent: 'center' }}>
        <Divider orientation={vertical ? 'vertical' : 'horizontal'} size={ctx.size} />
      </div>
    );
  },
};

/* Day Cell: one DatePicker day — a 36px cell, Sizing-Quarter round a
   Button-Height circle (the frame `Day`; its number is the text `Day`, so
   `Day#2`). The range band is Backfill (range-middle, full width) or the
   inner half — Right-Fill on range-start, Left-Fill on range-end — the Button
   fill at 50% layer opacity. */
const dayCell: ParityComponent = {
  key: 'dayCell',
  name: 'Day Cell',
  nodeId: '8619:3484',
  libFile: 'src/components/DatePicker/DatePicker.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: '__root__', css: '.day-cell', label: 'Cell', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Day', css: '.day-cell-day', label: 'Day' },
    { figma: 'Focus-Visible', css: '.day-cell-day', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Day#2', css: '.day-cell-day', label: 'Number', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'position', 'position (centre, top)', 'width', 'height'] },
    { figma: 'Backfill', css: '.day-cell-band', label: 'Range band', when: (v) => v.props.Selection === 'range-middle' },
    { figma: 'Right-Fill', css: '.day-cell-band', label: 'Range band', when: (v) => v.props.Selection === 'range-start' },
    { figma: 'Left-Fill', css: '.day-cell-band', label: 'Range band', when: (v) => v.props.Selection === 'range-end' },
  ],
  render: (v) => (
    <DayCell
      day={15}
      selection={String(v.props.Selection)}
      disabled={v.props.State === 'Disabled'}
      onClick={noop}
      aria-label="September 15, 2026"
    />
  ),
};

/* Expandable Nav Rail Item: one expanded rail row — a 32px icon slot (Rail
   Button / Icon Buttons), 2px, then the label. The set resolves Buttons in
   `default`, which is the selected item's palette. */
const expandableNavRailItem: ParityComponent = {
  key: 'expandableNavRailItem',
  name: 'Expandable Nav Rail Item',
  nodeId: '8239:5977',
  libFile: 'src/components/Rail/Rail.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // The item's edge is an inset ring in code (Figma's inside stroke takes no
    // layout space); read it as the border it draws.
    { figma: '__root__', css: '.rail-item', label: 'Item', shadow: 'inset' },
    { figma: 'Focus-Visible', css: '.rail-item', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Icon Buttons', css: '.rail-item-icon', label: 'Icon slot', skip: ['fill', 'border', 'shadow'] },
    { figma: 'Icon', css: '.rail-item-icon svg', label: 'Icon', skip: ['border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Component Name', css: '.rail-item-label', label: 'Label' },
  ],
  render: (v) => (
    <div style={{ width: v.box.w }}>
      <RailItem
        expanded
        variant="default"
        selected={v.props.State === 'Selected'}
        item={{ icon: <HomeIcon />, label: 'Label', disabled: v.props.State === 'Disabled' }}
        onClick={noop}
      />
    </div>
  ),
};

/* FAB: a FAB-Width circle (Theme-Container: the fill and 1px border, in the
   Tertiary theme the set pins) holding a FAB-Icon glyph, with the FAB /
   FAB-Hover elevation on the root. Extended and Animate default off. */
const fab: ParityComponent = {
  key: 'fab',
  name: 'FAB',
  nodeId: '6778:17180',
  libFile: 'src/components/Fab/Fab.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // Figma rounds Theme-Container, not the root, so the root's radius is not compared.
    { figma: '__root__', css: '.fab', label: 'FAB', shadow: 'outer', skip: ['fill', 'border', 'radius (as drawn)'] },
    { figma: 'Theme-Container', css: '.fab', label: 'Fill', skip: ['shadow'] },
    { figma: 'Focus-Visible', css: '.fab', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Icon', css: '.fab svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v, booleans) => (
    <Fab
      icon={<AddIcon />}
      extended={booleans.Extended ?? false}
      label={booleans.Extended ? 'Extended' : undefined}
      animate={false}
      disabled={v.props.State === 'Disabled'}
      className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
      onClick={noop}
      ariaLabel="Add"
    />
  ),
};

/* Field Button: a NumberField stepper — Button-Height tall, Sizing-6 wide,
   the field's Input-Radius, an in-button icon. Ghost has no edge, outline a
   1px inside Buttons border; Focus is a 3px ring inside the button. */
const fieldButton: ParityComponent = {
  key: 'fieldButton',
  name: 'Field Button',
  nodeId: '6850:28584',
  libFile: 'src/components/NumberField/FieldButton.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // The inset ring is the outline style's edge; read it as border.
    { figma: '__root__', css: '.field-button', label: 'Button', shadow: 'outer', skip: ['border', 'radius (as drawn)'] },
    { figma: 'Button-Contents', css: '.field-button', label: 'Contents', shadow: 'inset', skip: ['fill', 'position', 'width', 'height'] },
    { figma: 'Focus-Visible', css: '.field-button', outline: true, label: 'Focus ring' },
    // Figma's Icon frame carries no fill (the glyph inside does), so its color is not compared here.
    { figma: 'Icon', css: '.field-button svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v, _b, ctx) => (
    <FieldButton
      size={ctx.size}
      variant={String(v.props.Style) as 'ghost' | 'outline'}
      disabled={v.props.State === 'Disabled'}
      aria-label="Increase"
      onClick={noop}
    >
      <KeyboardArrowUpIcon />
    </FieldButton>
  ),
};

/* Pagination Number: one page in a Pagination — a letterNumber Button.
   Unselected pages are ghost (Outline-Quiet at rest, Outline-Text engaged);
   the current page is the selected outline button. Rendered with the props
   Pagination.js gives a page button. */
const paginationNumber: ParityComponent = {
  key: 'paginationNumber',
  name: 'Pagination Number',
  nodeId: '8400:33345',
  libFile: 'src/components/Pagination/Pagination.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // As Button: an unselected button rises 1px on hover, and a resting ghost is
  // transparent in code over the Background Figma paints — the same pixels.
  intended: (v, prop) =>
    (v.props.State === 'Hover' && prop.startsWith('position'))
    || (['Default', 'Focus-Visible', 'Disabled'].includes(String(v.props.State)) && prop === 'fill'),
  notes: [
    'Hover lifts the button 1px — intended (see Button); Hover positions are not compared.',
    'A resting ghost is transparent in code and Background in Figma — the same pixels, so its fill is not compared.',
  ],
  parts: [
    { figma: 'Button', css: 'button.MuiButton-root', label: 'Button', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Button-Effect', css: 'button.MuiButton-root', label: 'Elevation', skip: ['fill', 'border'], shadow: 'outer' },
    { figma: 'Theme-Button', css: 'button.MuiButton-root', label: 'Ghost fill', when: (v) => v.props.State !== 'Selected', skip: ['border', 'shadow', 'radius (as drawn)', 'opacity'] },
    { figma: 'Button-Fill', css: 'button.MuiButton-root', label: 'Fill', when: (v) => v.props.State === 'Selected', shadow: 'inset' },
    { figma: 'Focus-Visible', css: 'button.MuiButton-root', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Component Name', css: 'button.MuiButton-root > .typography', label: 'Number' },
  ],
  render: (v, _b, ctx) => {
    const selected = v.props.State === 'Selected';
    return (
      <Button
        variant={selected ? 'default-outline' : 'ghost'}
        selected={selected}
        size={ctx.size}
        disabled={v.props.State === 'Disabled'}
        className={v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined}
        contentType="letterNumber"
        aria-label="Page 1"
        aria-current={selected ? 'page' : undefined}
        onClick={noop}
      >
        1
      </Button>
    );
  },
};

/* Progress Bar: the track is an outline (1px Border OUTSIDE, no fill), the
   indicator Buttons-Border with a 1px Background ring inside. Figma's bar is
   192 wide with a 100px indicator, so code renders 100/192 of the way. */
const progressBar: ParityComponent = {
  key: 'progressBar',
  name: 'Progress Bar',
  nodeId: '8379:11531',
  libFile: 'src/components/LinearProgress/LinearProgress.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.linear-progress', label: 'Track', shadow: 'ring' },
    { figma: 'Progress Indicator', css: '.linear-progress-bar', label: 'Indicator', shadow: 'inset' },
  ],
  render: () => <LinearProgress value={100 / 1.92} size="large" />,
};

/* Progress Dial: a ring an eighth of the diameter thick — Background with a
   1px Border on both edges — and a Buttons-Border arc inset 1px, clockwise
   from twelve. Figma's arc ends at 36.87deg past three o'clock: 35.24%. The
   ring and arc are SVG strokes, which the box measurements cannot read, so
   only the dial's box is compared; use Overlay for the drawing. */
const progressDial: ParityComponent = {
  key: 'progressDial',
  name: 'Progress Dial',
  nodeId: '8379:11570',
  libFile: 'src/components/CircularProgress/CircularProgress.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  notes: ['The ring and arc are SVG strokes; only the dial box is measured — check the drawing with Overlay.'],
  parts: [
    { figma: 'Container', css: '.circular-progress', label: 'Dial', skip: ['fill', 'border', 'shadow'] },
  ],
  render: () => <CircularProgress value={35.24} size="large" />,
};

/* RadioField: Radio + Form-Label, Label-Gap apart, in the five placements
   CheckboxField uses. (Figma's set name carries a trailing space.) The radio
   inside is pinned to .Theme=Primary; colors are the Radio set's to check,
   so here only the layout is compared. */
const radioField: ParityComponent = {
  key: 'radioField',
  name: 'RadioField',
  nodeId: '6778:13979',
  libFile: 'src/components/Radio/Radio.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.MuiFormControlLabel-root', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Radio', css: '.MuiRadio-root', label: 'Radio', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Label', css: '.MuiFormControlLabel-label .typography', label: 'Label' },
  ],
  render: (v) => {
    const placement = CHECKBOX_FIELD_PLACEMENT[String(v.props.Label)];
    return placement
      ? <Radio label="Label" labelPlacement={placement} onChange={noop} />
      : <Radio onChange={noop} aria-label="Radio" />;
  },
};

/* Star: one Rating star — a Material glyph (star / star_border / star_half) at the in-button Icon-Size, 20 in a Sizing-3 box,
   colored Icons › Icon (the Icons mode; Default here is the surface's Text).
   Hover on an unselected star turns it Text. Focus is a 3px ring 1px inside.
   The set pins .Theme=Primary. Code draws one star with Rating max={1}. */
const STAR_GLYPH: Record<string, string> = { selected: 'star', unselected: 'star_border', isHalfFilled: 'star_half' };
const starParts = (): ParityPart[] => [
  { figma: '__root__', css: '.rating-star', label: 'Star', skip: ['fill', 'border', 'radius (as drawn)'] },
  { figma: 'Icon', css: '.rating-star svg', label: 'Icon box', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ...Object.entries(STAR_GLYPH).map(([status, glyph]): ParityPart => ({
    figma: glyph, css: '.rating-star svg', label: 'Glyph',
    when: (v) => v.props.Status === status,
    skip: ['border', 'shadow', 'radius (as drawn)', 'font family'],
  })),
  { figma: 'Focus-Visible', css: '.rating-star', outline: true, label: 'Focus ring' },
];
const star: ParityComponent = {
  key: 'star',
  name: 'Star',
  nodeId: '6780:12460',
  libFile: 'src/components/Rating/Rating.js',
  context: { theme: 'Primary', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: starParts(),
  render: (v) => {
    const st = String(v.props.Status);
    return (
      <Rating max={1} emptyLabel="" precision={st === 'isHalfFilled' ? 0.5 : 1}
        value={st === 'selected' ? 1 : st === 'isHalfFilled' ? 0.5 : null}
        disabled={v.props.State === 'Disabled'} onChange={noop} />
    );
  },
};

/* Rating: five Stars, no gap — four selected, one unselected. */
const rating: ParityComponent = {
  key: 'rating',
  name: 'Rating',
  nodeId: '6780:12693',
  libFile: 'src/components/Rating/Rating.js',
  context: { theme: 'Primary', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.rating', label: 'Rating', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Star', css: '.rating-star', all: true, label: 'Star', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: () => <Rating value={4} onChange={noop} />,
};

/* RatingField: a Form-Label above or below the Rating, Sizing-Half apart.
   The field is on .Theme=Default; only its stars pin Primary. */
const ratingField: ParityComponent = {
  key: 'ratingField',
  name: 'RatingField',
  nodeId: '9574:3354',
  libFile: 'src/components/Rating/Rating.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.rating-field', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Rating', css: '.rating', label: 'Rating', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Form-Label', css: '.rating-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Label', css: '.rating-field .form-label', label: 'Label', skip: ['width'] },
  ],
  render: (v) => {
    const pos = String(v.props.Label);
    return pos === 'none'
      ? <Rating value={4} onChange={noop} />
      : <Rating value={4} onChange={noop} label="Label" labelPosition={pos === 'label-bottom' ? 'bottom' : 'top'} />;
  },
};

/* Snackbar: the placement frame — device Margin left/right, SnackBar-Top /
   SnackBar-Bottom from its edge — holding a 520px Snack, right or middle.
   The Snack: the theme's Surface with a 1px Border inside, Dropdown-Frame-
   Radius corners, the FAB / Snackbar elevation, an Icons-Match icon, the
   message in Text-Match and a ghost close button. Code is position: fixed,
   so it is pinned into a box the frame's size to be measured. */
const snackbar: ParityComponent = {
  key: 'snackbar',
  name: 'Snackbar',
  nodeId: '8839:28556',
  libFile: 'src/components/Snackbar/Snackbar.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Snack', css: '.snackbar', label: 'Snack', skip: ['fill', 'border'], shadow: 'outer' },
    { figma: 'Theme-Container', css: '.snackbar-inner', label: 'Container' },
    { figma: 'Icon', css: '.snackbar-icon', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Snackbar', css: '.snackbar-message .typography', label: 'Message' },
    { figma: 'Button', css: '.snackbar-close', label: 'Close', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div style={{ position: 'relative', width: v.box.w, height: v.box.h }}>
      <Snackbar open anchor={String(v.props.Anchor).toLowerCase()} onClose={noop} startDecorator={<HomeIcon />}
        sx={{ position: 'absolute', animation: 'none' }}>
        Snackbar
      </Snackbar>
    </div>
  ),
};

/* SpeedDial: a 56px FAB (the page resolves Component-Size large) whose fan —
   three FABs, the first Sizing-1-and-Half from the dial and the rest
   SpeedDial-Gap apart — shows on Hover / Pressed / Focus-Visible (open) and
   is hidden at Default / Disabled. Open, the + turns 45deg into an x. Code
   opens on pointer events a forced :hover cannot fire, so the open states are
   rendered open; the action FABs keep their own (rest) state. */
const SPEED_DIAL_OPEN = ['Hover', 'Pressed', 'Focus-Visible'];
const speedDial: ParityComponent = {
  key: 'speedDial',
  name: 'SpeedDial',
  nodeId: '6843:25091',
  libFile: 'src/components/SpeedDial/SpeedDial.js',
  context: { theme: 'Default', surface: 'Surface', size: 'large' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // Disabled: Figma fades the whole dial, code the dial FAB (Fab's own
  // disabled look) — with the fan shut, the same pixels.
  intended: (v, prop) => v.props.State === 'Disabled' && prop === 'opacity',
  parts: [
    { figma: '__root__', css: '.speed-dial', label: 'Dial box', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // The dial: its holder, since Figma turns the FAB itself 45deg when open
    // (a circle — the same pixels, but a rotated box measures 79 wide).
    { figma: 'FAB Holder', css: '.speed-dial > .fab', label: 'Dial', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // The fan, open only. Figma lists up / left fans farthest-first, code
    // nearest-first.
    ...[2, 3, 4].map((k): ParityPart => ({
      figma: 'FAB#' + k, label: 'Action ' + (k - 1), skip: ['fill', 'border', 'radius (as drawn)'], shadow: 'outer',
      css: '.speed-dial [role=menu] > .fab:nth-child(' + (k - 1) + ')',
      when: (v) => SPEED_DIAL_OPEN.includes(String(v.props.State)) && !['up', 'left'].includes(String(v.props.Direction)),
    })),
    ...[2, 3, 4].map((k): ParityPart => ({
      figma: 'FAB#' + k, label: 'Action ' + (5 - k), skip: ['fill', 'border', 'radius (as drawn)'], shadow: 'outer',
      css: '.speed-dial [role=menu] > .fab:nth-child(' + (5 - k) + ')',
      when: (v) => SPEED_DIAL_OPEN.includes(String(v.props.State)) && ['up', 'left'].includes(String(v.props.Direction)),
    })),
  ],
  render: (v, _b, ctx) => {
    const open = SPEED_DIAL_OPEN.includes(String(v.props.State));
    const actions = [
      { name: 'Place', icon: <PlaceIcon />, className: OWN_STATE_CLASS },
      { name: 'Flight', icon: <FlightIcon />, className: OWN_STATE_CLASS },
      { name: 'Map', icon: <MapIcon />, className: OWN_STATE_CLASS },
    ];
    return (
      <SpeedDial size={ctx.size} direction={String(v.props.Direction)} open={open} onOpen={noop} onClose={noop}
        disabled={v.props.State === 'Disabled'} actions={actions} showTooltips={false} ariaLabel="Add" />
    );
  },
};

/* Stepper: three steps — complete, current, incomplete — joined by
   Step-Lines, horizontal (labels under the steps) or vertical (labels right,
   a Sizing-3 line between steps),
   count or noCount. The line is a stroked LINE in Figma and a filled bar in
   code, so its geometry is compared here and its color by Overlay. */
const stepperParts = (): ParityPart[] => [
  { figma: '__root__', css: '.stepper', label: 'Stepper', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'horizontal' },
  { figma: '__root__', css: '.stepper', label: 'Stepper', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'], when: (v) => v.props.Orientation === 'vertical' },
  // The step's own column (indicator + label); code's .step also holds the line after it.
  // Vertical: Figma's step box is the indicator's width with the label
  // overflowing it, code's column holds the label — so no width there.
  { figma: 'Count Step', css: '.step > :first-child', all: true, label: 'Step', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Style === 'count' && v.props.Orientation === 'horizontal' },
  { figma: 'Count Step', css: '.step > :first-child', all: true, label: 'Step', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'], when: (v) => v.props.Style === 'count' && v.props.Orientation === 'vertical' },
  { figma: 'No-Count Step', css: '.step > :first-child', all: true, label: 'Step', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Style === 'noCount' && v.props.Orientation === 'horizontal' },
  { figma: 'No-Count Step', css: '.step > :first-child', all: true, label: 'Step', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'], when: (v) => v.props.Style === 'noCount' && v.props.Orientation === 'vertical' },
  { figma: 'Line', css: '.step-connector', all: true, label: 'Line', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'horizontal' },
  // 'Step-Line' names the instance AND the frame inside it: every other one.
  { figma: 'Step-Line', css: '.step-connector', all: true, figmaEvery: 2, label: 'Line', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'vertical' },
];
const stepper: ParityComponent = {
  key: 'stepper',
  name: 'Stepper',
  nodeId: '8379:13867',
  libFile: 'src/components/Stepper/Stepper.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  notes: ['The Step-Line color is a stroke in Figma and a fill in code — check it with Overlay.'],
  parts: stepperParts(),
  render: (v) => {
    const horizontal = v.props.Orientation === 'horizontal';
    const label = 'Label';
    return (
      <div style={{ width: horizontal ? v.box.w : undefined, display: 'inline-block' }}>
        <Stepper orientation={horizontal ? 'horizontal' : 'vertical'} variant={v.props.Style === 'noCount' ? 'noCount' : undefined} activeStep={1}>
          <Step label={label} /><Step label={label} /><Step label={label} />
        </Stepper>
      </div>
    );
  },
};

/* Step-Line: the 2px rule between two steps, centred in a Button-Height band
   — Buttons-Border complete, Quiet incomplete, dashed Quiet for
   incomplete-dashed (2/2 across, 4/4 down). Code draws it inside a two-step
   Stepper with the steps hidden; only the rule's thickness and band position
   are compared. */
const STEP_LINE_ACTIVE: Record<string, number> = { complete: 1, incomplete: 0, 'incomplete-dashed': 0 };
const stepLine: ParityComponent = {
  key: 'stepLine',
  name: 'Step-Line',
  nodeId: '9383:42912',
  libFile: 'src/components/Stepper/Stepper.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  notes: ['Only the rule is drawn and compared. Its color is a stroke in Figma and a fill in code — check with Overlay.'],
  parts: [
    { figma: 'Line', css: '.step-connector', label: 'Rule', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'horizontal' },
    // A vertical variant's length is whatever its fill gives it in the set (9.7).
    { figma: 'Step-Line', css: '.step-connector', label: 'Rule', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'height'], when: (v) => v.props.Orientation === 'vertical' },
  ],
  // Just the rule, as Figma's set shows it: the two steps that bound it are
  // hidden, and the stepper is shifted so its connector sits where Figma's
  // line does — the 32px step band before it pushed out of the clipped frame.
  render: (v) => {
    const horizontal = v.props.Orientation === 'horizontal';
    return (
      <div className="parity-step-line" style={{ position: 'relative', width: v.box.w, height: v.box.h, overflow: 'hidden' }}>
        <style>{'.parity-step-line .step > :first-child { visibility: hidden; }'}</style>
        <div style={horizontal
          ? { position: 'absolute', left: -32, top: 0, width: v.box.w + 64 }
          : { position: 'absolute', left: -15, top: -32 }}>
          <Stepper orientation={horizontal ? 'horizontal' : 'vertical'} activeStep={STEP_LINE_ACTIVE[String(v.props.Status)]}
            dashedIncomplete={v.props.Status === 'incomplete-dashed'}>
            <Step /><Step />
          </Stepper>
        </div>
      </div>
    );
  },
};

/* Switch: a 42x24 pill (Switch-Width x -Height), 2px padding, a 20px handle.
   Off: a 1px Quiet edge, no fill, Quiet handle. On: fill and edge
   Icons › Icon, handle Icons › On-Icon. Focus: a 2px ring 1px outside.
   Disabled 38%. The set pins .Theme=Primary. Code draws focus from MUI's
   Mui-focusVisible on the switch base, which a forced :focus-visible does not
   set, so the render adds it. */
const switchParity: ParityComponent = {
  key: 'switch',
  name: 'Switch',
  nodeId: '9212:6767',
  libFile: 'src/components/Switch/Switch.js',
  context: { theme: 'Primary', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: '__root__', css: '.MuiSwitch-root', label: 'Switch', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Switch-Body', css: '.MuiSwitch-track', label: 'Track', shadow: 'outer' },
    { figma: 'Dot', css: '.MuiSwitch-thumb', label: 'Handle', skip: ['shadow'] },
    { figma: 'Focus-Visible', css: '.MuiSwitch-track', outline: true, outer: true, label: 'Focus ring' },
  ],
  render: (v) => (
    <div ref={(el) => { if (el && v.props.State === 'Focus-Visible') el.querySelector('.MuiSwitch-switchBase')?.classList.add('Mui-focusVisible'); }}>
      <SwitchInput checked={v.props.Status === 'On'} disabled={v.props.State === 'Disabled'} onChange={noop} aria-label="Switch" />
    </div>
  ),
};

/* SwitchField: Switch + Form-Label, Label-Gap apart, in the five placements
   CheckboxField uses. Top / bottom / none hold the switch in a "Frame 1";
   left / right place it directly. Colors are the Switch set's to check. */
const switchField: ParityComponent = {
  key: 'switchField',
  name: 'SwitchField',
  nodeId: '9575:2434',
  libFile: 'src/components/Switch/Switch.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.MuiFormControlLabel-root', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Switch', css: '.MuiSwitch-root', label: 'Switch', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => ['label-left', 'label-right'].includes(String(v.props.Label)) },
    { figma: 'Frame 1', css: '.MuiSwitch-root', label: 'Switch', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => !['label-left', 'label-right'].includes(String(v.props.Label)) },
    { figma: 'Label', css: '.MuiFormControlLabel-label .typography', label: 'Label' },
  ],
  render: (v) => {
    const placement = CHECKBOX_FIELD_PLACEMENT[String(v.props.Label)];
    return placement
      ? <SwitchInput label="Label" labelPlacement={placement} onChange={noop} />
      : <SwitchInput onChange={noop} aria-label="Switch" />;
  },
};

/* Tab: a Button-Height row on Background — start avatar, the label in
   Dynamic Button (Quiet, Text when engaged), end icon. Hover previews the
   2px selector at 50%; Selected (a boolean, off by default) draws it full;
   Focus-Visible is a 3px ring 1px inside. Selector is the edge the bar sits
   on — Bottom (horizontal), Left, Right. */
const TAB_ORIENTATION: Record<string, string> = { Bottom: 'horizontal', Left: 'vertical-left', Right: 'vertical-right' };
const tabParts = (): ParityPart[] => [
  { figma: '__root__', css: '.tab', label: 'Tab', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  { figma: 'Button-Contents', css: '.tab', label: 'Contents', skip: ['border', 'shadow', 'radius (as drawn)'] },
  { figma: 'Component Name', css: '.tab .typography', label: 'Label' },
  { figma: 'Focus-Visible', css: '.tab', outline: true, label: 'Focus ring' },
];
const tab: ParityComponent = {
  key: 'tab',
  name: 'Tab',
  nodeId: '8212:9219',
  libFile: 'src/components/Tabs/Tabs.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // Code's tab is transparent over the list's Background (so the baseline can
  // run under it); Figma fills Button-Contents with Background — same pixels.
  intended: (_v, prop) => prop === 'fill',
  notes: ['A tab is transparent in code, over its list\'s Background, so the baseline shows through it; Figma fills it Background. Fill is not compared.'],
  parts: tabParts(),
  render: (v, b) => (
    <Tabs orientation={TAB_ORIENTATION[String(v.props.Selector)]} value={b.Selected ? 0 : -1} onChange={noop} baseline={false}>
      <TabList aria-label="Tab">
        <Tab value={0} disabled={v.props.State === 'Disabled'}
          startDecorator={b['Start Avatar'] ?? true ? <Avatar alt="" size="small" /> : undefined}
          endDecorator={b['End Icon'] ?? true ? <HomeIcon /> : undefined}>
          Button
        </Tab>
      </TabList>
    </Tabs>
  ),
};

/* Tabs: three Tabs on Background over a 1px Border-Variant baseline (the
   Baseline boolean, on by default) on the selector's edge. */
const tabs: ParityComponent = {
  key: 'tabs',
  name: 'Tabs',
  nodeId: '8216:9719',
  libFile: 'src/components/Tabs/Tabs.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.tab-list', label: 'Tabs', skip: ['border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Tab', css: '.tab', all: true, label: 'Tab', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const o = String(v.props.Orientation).toLowerCase();
    return (
      <Tabs orientation={o} value={-1} onChange={noop}>
        <TabList aria-label="Tabs">
          {[0, 1, 2].map((i) => (
            <Tab key={i} value={i} startDecorator={<Avatar alt="" size="small" />} endDecorator={<HomeIcon />}>Button</Tab>
          ))}
        </TabList>
      </Tabs>
    );
  },
};

/* Tag: Tag/{Theme}/BG behind the label in Tag/{Theme}/Text — Label-Medium,
   all caps — Sizing-Quarter x Sizing-2 padding, 2px corners. */
const tag: ParityComponent = {
  key: 'tag',
  name: 'Tag',
  nodeId: '7442:31271',
  libFile: 'src/components/Tag/Tag.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.tag', label: 'Tag', skip: ['shadow'] },
    { figma: 'Component Name', css: '.tag .typography', label: 'Label' },
  ],
  render: (v) => <Tag color={String(v.props.Theme).toLowerCase()}>NEW</Tag>,
};

/* TextArea: Input's frame (Hover fill, 1px Border inside, Input-Radius,
   Text-Area-Min-Height) holding the text (Dynamic Body, Input-Padding above
   and below, Sizing-1 either side) over an Actions row — the start decorator
   at the left, the end at the right (Figma's defaults: + and a mic). Hover
   fills Pressed; Focus-Visible is a 2px ring 1px outside. */
const textArea: ParityComponent = {
  key: 'textArea',
  name: 'TextArea',
  nodeId: '9457:46628',
  libFile: 'src/components/Input/Input.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  // Focused and empty, the textarea's own color turns Text, but what shows is
  // its ::placeholder, which stays Quiet — Figma's color. The page reads the
  // element, not the pseudo-element.
  intended: (v, prop) => v.props.State === 'Focus-Visible' && v.props.Content === 'placeholder' && prop === 'text color',
  notes: ['Focused and empty: the visible placeholder is Quiet (as Figma); the textarea element itself is Text, which is what the page reads — not compared.'],
  parts: [
    { figma: 'Inner Frame', css: '.parity-textarea .inp-shell', label: 'Field', skip: ['fill', 'border'] },
    { figma: 'Inner Frame', css: '.parity-textarea .inp-shell', pseudo: '::after', label: 'Field edge', skip: ['fill', 'position', 'width', 'height', 'shadow', 'opacity'] },
    { figma: 'Inner Frame', css: '.parity-textarea .MuiOutlinedInput-root', label: 'Field fill', skip: ['border', 'radius (as drawn)', 'position', 'width', 'height', 'shadow'] },
    { figma: 'Focus-Visible', css: '.parity-textarea .inp-shell', outline: true, outer: true, label: 'Focus ring' },
    // The text box is the textarea, padding and all; Figma's is the line alone.
    { figma: 'Component Name', css: '.parity-textarea textarea', label: 'Text', skip: ['width', 'height', 'position', 'position (left, top)'] },
    { figma: 'Input Buttons', css: '.parity-textarea .MuiInputAdornment-root', all: true, label: 'Action', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div className="parity-textarea" style={{ width: v.box.w }}>
      <TextArea aria-label="About you" placeholder="Tell us about yourself" rows={1}
        value={v.props.Content === 'value' ? 'My thoughts...' : ''} onChange={noop}
        disabled={v.props.State === 'Disabled'}
        className={v.props.State === 'Focus-Visible' ? 'Mui-focused' : undefined}
        startAdornment={<span className={OWN_STATE_CLASS} style={{ display: 'contents' }}><InputDecorator aria-label="Add"><AddIcon /></InputDecorator></span>}
        endAdornment={<span className={OWN_STATE_CLASS} style={{ display: 'contents' }}><InputDecorator aria-label="Dictate"><MicIcon /></InputDecorator></span>} />
    </div>
  ),
};

/* TextAreaField: a Form-Label over the TextArea, Sizing-Half apart; `none`
   is the TextArea alone. */
const textAreaField: ParityComponent = {
  key: 'textAreaField',
  name: 'TextAreaField',
  nodeId: '9575:4342',
  libFile: 'src/components/TextAreaField/TextAreaField.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Form-Label', css: '.parity-textarea-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Label', css: '.parity-textarea-field .form-label', label: 'Label', skip: ['width'], when: (v) => v.props.Label !== 'none' },
    { figma: 'TextArea', css: '.parity-textarea-field .inp-shell', label: 'TextArea', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const deco = {
      startAdornment: <InputDecorator aria-label="Add"><AddIcon /></InputDecorator>,
      endAdornment: <InputDecorator aria-label="Dictate"><MicIcon /></InputDecorator>,
    };
    return (
      <div className="parity-textarea-field" style={{ width: v.box.w }}>
        {v.props.Label === 'none'
          ? <TextArea aria-label="About you" placeholder="Tell us about yourself" rows={1} onChange={noop} {...deco} />
          : <TextAreaField label="Label" placeholder="Tell us about yourself" rows={1} onChange={noop} {...deco} />}
      </div>
    );
  },
};

/* Player: a small Slider over the elapsed time and the time remaining
   (Mobile Nav Label, Quiet), then the controls — previous, back 10, play
   (the one solid button), forward 10, next — sharing the row. Sizing-1
   padding, Sizing-3 between. A single component, not a set. Figma lays the
   controls out in a ToggleButtonGroup; code uses a plain row (they are
   actions, not toggles), so the group frame is compared as the row. */
const player: ParityComponent = {
  key: 'player',
  name: 'Player',
  nodeId: '10327:5421',
  libFile: 'src/components/Player/Player.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.player', label: 'Player', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Slider and Text', css: '.player-scrubber', label: 'Scrubber', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: '1:54', css: '.player-elapsed', label: 'Elapsed' },
    { figma: '-1:23', css: '.player-remaining', label: 'Remaining' },
    { figma: 'ToggleButtonGroup', css: '.player-controls', label: 'Controls', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Button', css: '.player-control', all: true, label: 'Control', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div style={{ width: v.box.w }}>
      <Player duration={197} defaultPosition={114} onSeek={noop} onPlayPause={noop}
        onPrevious={noop} onNext={noop} onSkip={noop} />
    </div>
  ),
};

/* Tooltip: a black-white Buttons bubble (Buttons Button / Text), Tooltip-
   Radius, Tooltip-Padding, Tooltip-Gap between an icon and the label, with
   a 16x8 arrow 6px of which shows; the tip touches the anchor. Code is MUI's
   tooltip, so it is rendered OPEN, without a portal, against a zero-size
   anchor where Figma's arrow tip is. */
const tooltip: ParityComponent = {
  key: 'tooltip',
  name: 'Tooltip',
  nodeId: '8829:27295',
  libFile: 'src/components/Tooltip/Tooltip.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Tooltip container', css: '.tooltip-content', label: 'Bubble', skip: ['shadow'] },
    { figma: 'Icon', css: '.tooltip-content svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Component Name', css: '.tooltip-content .tooltip-label', label: 'Label', skip: ['width', 'position', 'position (left, top)'] },
    // 'Text' in Bottom; the others call the same frame 'Frame 1'.
    { figma: 'Text', css: '.tooltip-content .tooltip-label', label: 'Label box', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Location === 'Bottom' },
    { figma: 'Frame 1', css: '.tooltip-content .tooltip-label', label: 'Label box', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Location !== 'Bottom' },
    // Figma's Polygon is the whole arrow (2px tucks under the bubble); code's
    // box is the part that shows — Figma's Arrow Holder. The holder runs the
    // bubble's length, so only its thickness (and that side's edge) compare.
    { figma: 'Arrow Holder', css: '.MuiTooltip-arrow', label: 'Arrow', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width', 'position'],
      when: (v) => ['Bottom', 'Top'].includes(String(v.props.Location)) },
    { figma: 'Arrow Holder', css: '.MuiTooltip-arrow', label: 'Arrow', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'height', 'position'],
      when: (v) => ['Left', 'Right'].includes(String(v.props.Location)) },
  ],
  /* The popper is pinned to the cell's corner and the arrow centred on its
     edge: positioning is MUI's job, and its maths does not survive the
     parity stage. What is compared is the tooltip's own drawing — bubble,
     stand-off, arrow, content. */
  render: (v) => {
    const loc = String(v.props.Location);
    const sideways = loc === 'Left' || loc === 'Right';
    return (
      <div className="parity-tooltip" style={{ position: 'relative', width: v.box.w, height: v.box.h }}>
        <style>{'.parity-tooltip .MuiTooltip-popper { position: absolute !important; inset: 0 auto auto 0 !important; transform: none !important; } '
          + '.parity-tooltip .MuiTooltip-arrow { ' + ({
            Bottom: 'top: 0 !important; bottom: auto !important; left: 50% !important; transform: translateX(-50%) !important;',
            Top: 'top: auto !important; bottom: 0 !important; left: 50% !important; transform: translateX(-50%) !important;',
            Left: 'left: auto !important; right: 0 !important; top: 50% !important; transform: translateY(-50%) !important;',
            Right: 'left: 0 !important; right: auto !important; top: 50% !important; transform: translateY(-50%) !important;',
          } as Record<string, string>)[loc] + ' }'}</style>
        <Tooltip open placement={loc.toLowerCase()} PopperProps={{ disablePortal: true }} title="Tooltip" icon={<InfoOutlinedIcon />}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }} />
        </Tooltip>
      </div>
    );
  },
};

/* TreeView: a Background panel, 8px padding, 4px corners, holding Menu Item
   rows at levels 0-4 (the first selected). Code nests one row in the next and
   expands them all so the five levels show; Figma draws every row closed, so
   the chevrons are not compared. */
const treeView: ParityComponent = {
  key: 'treeView',
  name: 'TreeView',
  nodeId: '6911:36658',
  libFile: 'src/components/TreeView/TreeView.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-tree > *', label: 'Panel', skip: ['border', 'shadow'] },
    // No 'Tree List' part: code's list carries the panel padding itself, so its
    // box is the panel's; the rows' positions check the padding instead.
    { figma: 'Parent', css: '.parity-tree .omni-tree-content', all: true, label: 'Row', skip: ['border', 'shadow', 'opacity'] },
  ],
  render: (v) => {
    const row = (id: string, child?: object) => ({ id, label: 'Menu Item', icon: <HomeIcon />, swatch: 'var(--Buttons-Primary-Button)', ...(child ? { children: [child] } : {}) });
    const items = [row('a', row('b', row('c', row('d', row('e')))))];
    return (
      <div className="parity-tree" style={{ width: v.box.w }}>
        <OmniTreeView items={items} variant="default" surface="Surface" animation="none"
          defaultExpandedItems={['a', 'b', 'c', 'd']} selectedItems="a" onSelectedItemsChange={noop} aria-label="Tree" />
      </div>
    );
  },
};

/* Validation Frame: the 2px inside stroke a field takes in a validation
   state — Buttons Border in the error / warning / success / info Buttons
   mode, Input-Radius corners. Code draws it as the field's edge. */
const validationFrame: ParityComponent = {
  key: 'validationFrame',
  name: 'Validation Frame',
  nodeId: '9518:53481',
  libFile: 'src/components/Input/Input.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-vf .inp-shell', pseudo: '::after', label: 'Edge', skip: ['fill', 'position', 'width', 'height', 'shadow', 'opacity'] },
  ],
  render: (v) => (
    <div className="parity-vf" style={{ width: v.box.w }}>
      <TextArea aria-label="Field" rows={3} validation={String(v.props['Validation-State']).toLowerCase()} onChange={noop} value="" />
    </div>
  ),
};

/* Form-Helper: the helper line (Legal, Quiet) and, with a validation, the
   message under it — a Theme-<State> / Surface-Brightest pill holding a 16px
   Message Icon and the message in Legal-Semibold, Text-<State>. Layer names
   carry the state (and Figma spells the info text "Info  message", two
   spaces), so the message parts are listed per validation. */
const FORM_HELPER_STATES = [
  ['warning', 'Theme-Warning', 'Warning message'],
  ['info', 'Theme-Info', 'Info  message'],
  ['success', 'Theme-Success', 'Success message'],
  ['error', 'Theme-Error', 'Error message'],
] as const;
const formHelper: ParityComponent = {
  key: 'formHelper',
  name: 'Form-Helper',
  nodeId: '8580:22922',
  libFile: 'src/components/FormHelper/FormHelper.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    // Figma's frame is a fixed 113 wide rather than hugging its text, so its width is not compared.
    { figma: '__root__', css: '.form-helper', label: 'Helper', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'] },
    { figma: 'Input Help Text', css: '.form-helper-text', label: 'Helper text' },
    ...FORM_HELPER_STATES.flatMap(([state, pill, text]) => [
      { figma: pill, css: '.input-message', label: 'Message', when: (v: FigmaVariant) => v.props.Validation === state },
      { figma: 'Message Icons', css: '.input-message svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v: FigmaVariant) => v.props.Validation === state },
      { figma: text, css: '.input-message-text', label: 'Message text', when: (v: FigmaVariant) => v.props.Validation === state },
    ]),
  ],
  render: (v, booleans) => {
    const state = String(v.props.Validation);
    const label = { warning: 'Warning message', info: 'Info message', success: 'Success message', error: 'Error message' }[state];
    return (
      <FormHelper
        helperText="Input Help Text"
        showHelper={booleans['Show Helper'] ?? true}
        validation={state}
        validationMessage={label}
      />
    );
  },
};

/* Form-Label: the label (Dynamic-Label, Text) and, by Type, its marker —
   " * Required" or "Optional" — as a second text after a gap. More Info (off
   by default) adds an info icon and a link beside it. In code the marker is a
   span inside the label, so the label part is compared on its type and the
   marker on its own position. */
const formLabel: ParityComponent = {
  key: 'formLabel',
  name: 'Form-Label',
  nodeId: '8702:11037',
  libFile: 'src/components/FormLabel/FormLabel.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.form-label-row', label: 'Row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Label', css: '.form-label', label: 'Label', skip: ['width'] },
    { figma: '* Required', css: '.form-label-marker', label: 'Marker', when: (v) => v.props.Type === 'required' },
    { figma: 'Optional', css: '.form-label-marker', label: 'Marker', when: (v) => v.props.Type === 'optional' },
  ],
  render: (v, booleans) => (
    <FormLabel
      htmlFor="parity-field"
      type={String(v.props.Type)}
      moreInfo={booleans['More Info'] ? { label: 'More about this field', text: 'More Info', href: '#' } : undefined}
    >
      Label
    </FormLabel>
  ),
};

/* Hotlink Group: Hotlinks in a row with a Border-Variant bar between each.
   "Four" holds three links and two bars (one pair sits in the Link Slot). */
const hotlinkGroup: ParityComponent = {
  key: 'hotlinkGroup',
  name: 'Hotlink Group',
  nodeId: '3156:5504',
  libFile: 'src/components/LinkGroup/LinkGroup.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.link-group', label: 'Group', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Link', css: '.link-group-item', label: 'Link', all: true, skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: '.Breadcrumbs-separator', css: '.link-group-separator', label: 'Separator', all: true, skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: () => (
    <LinkGroup>
      <Link href="#">Hotlink</Link>
      <Link href="#">Hotlink</Link>
      <Link href="#">Hotlink</Link>
    </LinkGroup>
  ),
};

/* Icon: one Material glyph at Icons & Avatars › Icon-Size (24 in `small`),
   colored Icons › Icon. Style picks the glyph set — Default (filled), Round,
   Sharp — which in code is the matching @mui/icons-material export. */
const ICON_STYLE: Record<string, ReactNode> = { Default: <HomeIcon />, Round: <HomeRoundedIcon />, Sharp: <HomeSharpIcon /> };
const icon: ParityComponent = {
  key: 'icon',
  name: 'Icon',
  nodeId: '9155:25617',
  libFile: 'src/components/Icon/Icon.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-icon > *', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // Figma draws the glyph with the Material Icons FONT, code with the same glyph as SVG — so the font family is not a comparison.
    { figma: 'home', css: '.parity-icon svg', label: 'Glyph', skip: ['border', 'shadow', 'radius (as drawn)', 'font family'] },
  ],
  render: (v) => (
    <span className="parity-icon" style={{ display: 'inline-flex' }}>
      <Icon size="small">{ICON_STYLE[String(v.props.Style)] ?? <HomeIcon />}</Icon>
    </span>
  ),
};

/* Image Placeholder: a Border-Variant tint (20%) with the photo glyph in
   Quiet, as large as the box. It fills its parent, so the cell gives it the
   Figma frame's size. */
const imagePlaceholder: ParityComponent = {
  key: 'imagePlaceholder',
  name: 'Image Placeholder',
  nodeId: '7251:1985',
  libFile: 'src/components/ImagePlaceholder/ImagePlaceholder.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.image-placeholder', label: 'Placeholder' },
    { figma: 'photo', css: '.image-placeholder-icon', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div style={{ width: v.box.w, height: v.box.h }}>
      <ImagePlaceholder />
    </div>
  ),
};

/* Input: a 32px field (Floating Label: 56) — Inner Frame carries the Hover
   fill, a 1px Border edge and the Input-Radius corner; a 20px start icon, the
   text in Dynamic Body, and an end decorator (a ghost icon-only button, 32px,
   "backspace"). Focus-Visible is a 2px ring 1px outside the field. */
const input: ParityComponent = {
  key: 'input',
  name: 'Input',
  nodeId: '8574:19742',
  libFile: 'src/components/Input/Input.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // The shell carries the size, corner and focus ring; its ::after draws the
    // edge (Figma's inside stroke, as an overlay); the MUI root draws the fill.
    { figma: 'Inner Frame', css: '.parity-input .inp-shell', label: 'Field', skip: ['fill', 'border'] },
    { figma: 'Inner Frame', css: '.parity-input .inp-shell', pseudo: '::after', label: 'Field edge', skip: ['fill', 'position', 'width', 'height', 'shadow', 'opacity'] },
    { figma: 'Inner Frame', css: '.parity-input .MuiOutlinedInput-root', label: 'Field fill', skip: ['border', 'radius (as drawn)', 'position', 'width', 'height', 'shadow'] },
    { figma: 'Focus-Visible', css: '.parity-input .inp-shell', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Icon', css: '.parity-input .MuiInputAdornment-positionStart svg', label: 'Start icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // The <input> spans the row; Figma's text box is the 24px line inside it — type and colour, not the box.
    { figma: 'Component Name', css: '.parity-input .MuiOutlinedInput-input', label: 'Text', skip: ['width', 'position', 'position (left, top)', 'height'],
      when: (v) => !(v.props.Type === 'Floating Label' && v.props.Content === 'placeholder') },
    // An empty floating field draws no placeholder: its "Name" is the resting label.
    { figma: 'Component Name', css: '.parity-input .MuiInputLabel-root', label: 'Resting label', skip: ['width', 'height'],
      when: (v) => v.props.Type === 'Floating Label' && v.props.Content === 'placeholder' && ['Default', 'Disabled'].includes(v.props.State) },
    // The raised label: content, or an empty field under hover / press / focus.
    { figma: 'Email address', css: '.parity-input .MuiInputLabel-root', label: 'Raised label', skip: ['width', 'height'],
      when: (v) => v.props.Type === 'Floating Label' && (v.props.Content === 'value' || ['Hover', 'Pressed', 'Focus-Visible'].includes(v.props.State)) },
    { figma: 'Input Decorator', css: '.parity-input .MuiInputAdornment-positionEnd', label: 'End decorator', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v, booleans) => {
    const floating = v.props.Type === 'Floating Label';
    const filled = v.props.Content === 'value';
    return (
      <div className="parity-input" style={{ width: v.box.w }}>
        <TextInput
          fullWidth
          labelPosition={floating ? 'floating' : 'standard'}
          label={floating ? 'Email address' : undefined}
          aria-label={floating ? undefined : 'Email address'}
          defaultValue={filled ? 'Jane.Doe@gmail.com' : undefined}
          // Figma's placeholder variant is an empty " " in Quiet — a placeholder, so the field shows its placeholder colour.
          placeholder={filled || floating ? undefined : ' '}
          disabled={v.props.State === 'Disabled'}
          startAdornment={(booleans['Start Icon'] ?? true) ? <MailIcon /> : undefined}
          // The decorator is a button with its own states; the field's state is not forced onto it.
          endAdornment={(booleans['End Decorator'] ?? true) ? <span className={OWN_STATE_CLASS} style={{ display: 'contents' }}><InputDecorator aria-label="Clear"><BackspaceIcon /></InputDecorator></span> : undefined}
        />
      </div>
    );
  },
};

/* Input Field: the Input with its Form-Label — Label top (Sizing-Half below
   the label), left (Sizing-1 beside it, centred), floating (the Input's own
   floating type) or none. The Input inside is the default one, so this checks
   only where the label goes; the Input set checks the field. */
const inputField: ParityComponent = {
  key: 'inputField',
  name: 'Input Field',
  nodeId: '9457:47428',
  libFile: 'src/components/Input/Input.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Form-Label', css: '.parity-input-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'],
      when: (v) => v.props.Label === 'label-top' || v.props.Label === 'label-left' },
    { figma: 'Label', css: '.parity-input-field .form-label', label: 'Label', skip: ['width'],
      when: (v) => v.props.Label === 'label-top' || v.props.Label === 'label-left' },
    // The instance's own frame is square; its Inner Frame carries the corner, which the Input set checks.
    { figma: 'Input', css: '.parity-input-field .inp-shell', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const pos = v.props.Label;
    const floating = pos === 'floating';
    const labelled = pos !== 'none';
    return (
      <div className="parity-input-field" style={{ width: v.box.w }}>
        <TextInput
          fullWidth
          labelPosition={floating ? 'floating' : pos === 'label-left' ? 'left' : 'standard'}
          label={labelled ? (floating ? 'Email address' : 'Label') : undefined}
          aria-label={labelled ? undefined : 'Email address'}
          placeholder={floating ? undefined : ' '}
          startAdornment={<MailIcon />}
          endAdornment={<span className={OWN_STATE_CLASS} style={{ display: 'contents' }}><InputDecorator aria-label="Clear"><BackspaceIcon /></InputDecorator></span>}
        />
      </div>
    );
  },
};

/* Link: Body text in --Hotlink, underlined at rest. Focus-Visible is a 2px
   ring (a frame 2px out, 2px inside stroke); Disabled is 38%. */
const link: ParityComponent = {
  key: 'link',
  name: 'Link',
  nodeId: '3156:5476',
  libFile: 'src/components/Link/Link.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: '__root__', css: '.parity-link a', label: 'Link', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Hotlink', css: '.parity-link a', label: 'Text' },
    { figma: 'Focus-Visible', css: '.parity-link a', outline: true, outer: true, label: 'Focus ring' },
  ],
  render: (v) => (
    <div className="parity-link">
      <Link href="#parity" onClick={(e: { preventDefault: () => void }) => e.preventDefault()} disabled={v.props.State === 'Disabled'}>Hotlink</Link>
    </div>
  ),
};

/* Ratio: a bare box that holds its proportion — Fill Horizontal takes the
   width and derives the height (fit="width"), Fill Vertical the reverse
   (fit="height"). Empty, it shows the Image Placeholder. */
const ratioOf = (v: FigmaVariant) => String(v.props.Ratio).replace('Golden ', 'Golden-');
const ratioFillHorizontal: ParityComponent = {
  key: 'ratioFillHorizontal',
  name: 'Ratio - Fill Horizontal',
  nodeId: '6241:11978',
  libFile: 'src/components/Ratio/Ratio.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-ratio .ratio', label: 'Box', skip: ['fill', 'border', 'shadow'] },
    // The paint is the inner layer's: the Surface-Dim level Figma pins on the Ratio.
    { figma: '__root__', css: '.parity-ratio .ratio > [data-surface]', label: 'Fill', skip: ['border', 'shadow', 'width', 'height', 'position', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div className="parity-ratio" style={{ width: v.box.w }}>
      <Ratio ratio={ratioOf(v)} />
    </div>
  ),
};
const ratioFillVertical: ParityComponent = {
  key: 'ratioFillVertical',
  name: 'Ratio - Fill Vertical',
  nodeId: '7257:3697',
  libFile: 'src/components/Ratio/Ratio.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-ratio .ratio', label: 'Box', skip: ['fill', 'border', 'shadow'] },
    // The paint is the inner layer's: the Surface-Dim level Figma pins on the Ratio.
    { figma: '__root__', css: '.parity-ratio .ratio > [data-surface]', label: 'Fill', skip: ['border', 'shadow', 'width', 'height', 'position', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div className="parity-ratio" style={{ height: v.box.h, display: 'flex' }}>
      <Ratio ratio={ratioOf(v)} fit="height" />
    </div>
  ),
};

/* Select: the trigger is Figma's Input (no start icon, an end decorator), so
   it is measured as one — shell, edge, ring, text, decorator. Focus-Visible
   also draws the open menu and a chip in the Selected Slot; only the trigger
   is compared there (the menu is SelectMenu's own set). */
const select: ParityComponent = {
  key: 'select',
  name: 'Select',
  nodeId: '9492:48518',
  libFile: 'src/components/Select/Select.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Inner Frame', css: '.parity-select .select-shell', label: 'Field', skip: ['border'] },
    { figma: 'Inner Frame', css: '.parity-select .select-shell', pseudo: '::after', label: 'Field edge', skip: ['fill', 'position', 'width', 'height', 'shadow', 'opacity'] },
    { figma: 'Focus-Visible', css: '.parity-select .select-shell', outline: true, outer: true, label: 'Focus ring' },
    { figma: 'Component Name', css: '.parity-select .select-value', label: 'Text', skip: ['width', 'height', 'position', 'position (left, top)'],
      when: (v) => v.props.State !== 'Focus-Visible' },
    { figma: 'Input Decorator', css: '.parity-select .select-decorator', label: 'End decorator', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div className="parity-select" style={{ width: v.box.w }}>
      <Select fullWidth aria-label="Choose" placeholder=" " options={['One', 'Two', 'Three']} disabled={v.props.State === 'Disabled'} labelPosition="none" />
    </div>
  ),
};

/* SelectField: the Select with its Form-Label — top, left or none, as Input
   Field. Only where the label goes is checked; Select checks the field. */
const selectField: ParityComponent = {
  key: 'selectField',
  name: 'SelectField',
  nodeId: '9499:50500',
  libFile: 'src/components/Select/Select.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Form-Label', css: '.parity-select-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'],
      when: (v) => v.props.Label !== 'none' },
    { figma: 'Label', css: '.parity-select-field .form-label', label: 'Label', skip: ['width'], when: (v) => v.props.Label !== 'none' },
    { figma: 'Select', css: '.parity-select-field .select-shell', label: 'Field', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const pos = v.props.Label;
    return (
      <div className="parity-select-field" style={{ width: v.box.w }}>
        <Select fullWidth placeholder=" " options={['One', 'Two', 'Three']}
          label={pos === 'none' ? undefined : 'Label'} aria-label={pos === 'none' ? 'Choose' : undefined}
          labelPosition={pos === 'label-left' ? 'left' : pos === 'label-top' ? 'top' : 'none'} />
      </div>
    );
  },
};

/* Slider: Figma's Type folds the thumb count (single / double) with the fill
   side (standard / inverted). The values here put each thumb where Figma
   draws it, so the rail, fill and thumbs can be compared by position. */
const SLIDER_VALUES: Record<string, number | number[]> = {
  'single|horizontal': 38, 'single-inverted|horizontal': 62,
  'double|horizontal': [20.4, 85.6], 'double-inverted|horizontal': [20.4, 85.6],
  'single|vertical': 79.4, 'single-inverted|vertical': 52,
  'double|vertical': [17.7, 68.8], 'double-inverted|vertical': [17.7, 68.8],
};
const slider: ParityComponent = {
  key: 'slider',
  name: 'Slider',
  nodeId: '6791:14897',
  libFile: 'src/components/Slider/Slider.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    // Figma builds the bar from pieces (fill, gap, rest), each with its own
    // paint; code is one rail with the track on top. So the rail owns the bar's
    // box, and the paint is compared on the fill.
    { figma: 'Slider Back Bar', css: '.parity-slider .MuiSlider-rail', label: 'Rail', skip: ['fill', 'border'] },
    // Figma's fill stops at the thumb's EDGE, code's at its centre — under the
    // thumb either way, so its length and start are not compared.
    { figma: 'Fill', css: '.parity-slider .MuiSlider-track', label: 'Fill', skip: ['position', 'width', 'height', 'radius (as drawn)'],
      when: (v) => v.props.Type === 'single' && v.props.Orientation === 'horizontal' },
    // The touch box is measured; its circle is ::before, so no corner here.
    { figma: 'Slider-thumb Horizontal', css: '.parity-slider .MuiSlider-thumb', label: 'Thumb', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'horizontal' },
    // Vertical: Figma's first thumb is the TOP one, MUI's last.
    { figma: 'Slider-thumb Vertical', css: '.parity-slider .MuiSlider-thumb:last-of-type', label: 'Thumb', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Orientation === 'vertical' },
    // The thumbs' Always Show Label defaults on, so the bubble is drawn at
    // rest. Figma's placeholder text is "Label" (horizontal) / "36" (vertical).
    { figma: 'Label', css: '.parity-slider .MuiSlider-valueLabel', label: 'Value label', skip: ['shadow'], when: (v) => v.props.Orientation === 'horizontal' },
    { figma: 'Text', css: '.parity-slider .MuiSlider-thumb:last-of-type .MuiSlider-valueLabel', label: 'Value label', skip: ['shadow'], when: (v) => v.props.Orientation === 'vertical' },
  ],
  render: (v) => {
    const type = String(v.props.Type);
    const vertical = v.props.Orientation === 'vertical';
    const val = SLIDER_VALUES[type + '|' + v.props.Orientation];
    return (
      <div className="parity-slider" style={{ width: v.box.w, height: v.box.h, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: vertical ? '0 48px' : '48px 0' }}>
        <Slider aria-label="Amount" orientation={vertical ? 'vertical' : 'horizontal'} value={val} track={type.includes('inverted') ? 'inverted' : 'standard'}
          valueLabelDisplay="on" valueLabelFormat={() => (vertical ? '36' : 'Label')}
          sx={vertical ? { height: '100%' } : { width: '100%' }} />
      </div>
    );
  },
};

/* Slider thumbs: the 24px handle on a stub of bar, one set per orientation.
   Fill Direction is which side of the thumb the fill is on. The handle is the
   thumb's ::before; hover / pressed add a 20% halo of the fill (4px / 8px). */
const thumbParts = (vertical: boolean): ParityPart[] => vertical ? [
  // The vertical Handle carries its own 1px --Background edge.
  { figma: 'Handle', css: '.parity-thumb .MuiSlider-thumb', pseudo: '::before', label: 'Handle', skip: ['shadow'] },
] : [
  // The horizontal Handle strokes itself in its own fill (invisible); the
  // visible 1px --Background edge is the Thumb Border layer above it.
  { figma: 'Handle', css: '.parity-thumb .MuiSlider-thumb', pseudo: '::before', label: 'Handle', skip: ['shadow', 'border'] },
  { figma: 'Thumb Border', css: '.parity-thumb .MuiSlider-thumb', pseudo: '::before', label: 'Edge', skip: ['shadow', 'fill', 'position'] },
  // The hover / pressed halo is a spread shadow on ::before, which the page
  // cannot measure on a pseudo-element yet — checked by eye.
];
const thumbRender = (vertical: boolean) => (v: FigmaVariant) => {
  const dir = String(v.props['Fill Direction']).toLowerCase();
  const inverted = vertical ? dir === 'bottom' : dir === 'right';
  return (
    <div className="parity-thumb" style={{ width: v.box.w, height: v.box.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Slider aria-label="Amount" orientation={vertical ? 'vertical' : 'horizontal'} value={50} track={inverted ? 'inverted' : 'standard'}
        disabled={v.props.State === 'Disabled'} valueLabelDisplay="off" sx={vertical ? { height: v.box.h } : { width: v.box.w }} />
    </div>
  );
};
const sliderThumbHorizontal: ParityComponent = {
  key: 'sliderThumbHorizontal',
  name: 'Slider-thumb Horizontal',
  nodeId: '6791:15142',
  libFile: 'src/components/Slider/Slider.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: thumbParts(false),
  render: thumbRender(false),
};
const sliderThumbVertical: ParityComponent = {
  key: 'sliderThumbVertical',
  name: 'Slider-thumb Vertical',
  nodeId: '7514:21988',
  libFile: 'src/components/Slider/Slider.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: thumbParts(true),
  render: thumbRender(true),
};

/* SliderField: Form-Label above or below a double Slider (104 tall: 48px
   either side of the bar, room for the value label), or no label. */
const sliderField: ParityComponent = {
  key: 'sliderField',
  name: 'SliderField',
  nodeId: '9492:48466',
  libFile: 'src/components/Slider/Slider.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Form-Label', css: '.parity-slider-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'],
      when: (v) => v.props.Label !== 'none' },
    // Below the slider, the first "Label" layer is the thumb's value bubble; the row covers it there.
    { figma: 'Label', css: '.parity-slider-field .form-label', label: 'Label', skip: ['width'], when: (v) => v.props.Label === 'label-top' },
    { figma: 'Slider Back Bar', css: '.parity-slider-field .MuiSlider-rail', label: 'Rail', skip: ['fill', 'border'] },
  ],
  render: (v) => {
    const pos = v.props.Label;
    return (
      <div className="parity-slider-field" style={{ width: v.box.w, ...(pos === 'none' ? { padding: '48px 0', boxSizing: 'border-box', height: v.box.h, display: 'flex', alignItems: 'center' } : {}) }}>
        <Slider defaultValue={[20.4, 85.6]} label={pos === 'none' ? undefined : 'Label'} aria-label={pos === 'none' ? 'Amount' : undefined}
          labelPosition={pos === 'label-bottom' ? 'bottom' : 'top'} valueLabelDisplay="off" sx={{ width: '100%' }} />
      </div>
    );
  },
};

/* Sheet: the bottom sheet on Figma's 1920x1080 screen frame. Rendered open
   with no scrim (so it is not modal and does not take the page's focus or
   scroll); the scaled cell is its containing block, so `position: fixed`
   lands it at the cell's bottom edge. */
const sheet: ParityComponent = {
  key: 'sheet',
  name: 'Sheet',
  nodeId: '8326:2842',
  libFile: 'src/components/Sheet/Sheet.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Sheet Background', css: '.parity-sheet .sheet', label: 'Sheet', skip: ['shadow'] },
  ],
  render: (v) => (
    <div className="parity-sheet" style={{ width: v.box.w, height: v.box.h, position: 'relative', transform: 'translateZ(0)' }}>
      <Sheet open hideBackdrop aria-label="Sheet" sx={{ animation: 'none' }} />
    </div>
  ),
};

/* List: two List Items in a column or a row. Non-clickable rows sit flush,
   separated by a hairline under each (vertical); clickable rows are cards
   (inset Border edge, List-Item-Radius) 8px apart, here selected (ring). Each
   item: a 1:1 image at List-Item-Default-Image-Width, Eyebrow / Subtitle /
   Body, and a checkbox at the end. */
const LIST_BODY = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const list: ParityComponent = {
  key: 'list',
  name: 'List',
  nodeId: '7022:51249',
  libFile: 'src/components/List/List.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    // The clickable card's edge is an inset ring (an inside stroke that takes no space).
    { figma: 'List Item', css: '.parity-list .list-item', all: true, shadow: 'inset', label: 'Item', skip: ['fill', 'shadow'] },
    { figma: 'Ratio - Fill Horizontal', css: '.parity-list .list-item .ratio', label: 'Image', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    // The eyebrow FACE is the design system's (Surf's Up sets Inter; the Figma file's own is Public Sans).
    { figma: 'Component Name', css: '.parity-list .list-item .typography', label: 'Eyebrow', skip: ['width', 'height', 'font family'] },
    { figma: 'End Decorator', css: '.parity-list .list-item .list-item-decorator:last-child', label: 'End decorator', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const clickable = v.props.Type === 'Clickable';
    const horizontal = v.props.Orientation === 'horizontal';
    const item = () => ({
      eyebrow: 'Eyebrow', label: 'Subtitle', secondary: LIST_BODY,
      startDecorator: <div style={{ width: 'var(--List-Item-Default-Image-Width, 64px)' }}><Ratio ratio="1:1" /></div>,
      endDecorator: <Checkbox aria-label="Choose" />,
      bottomBorder: !clickable && !horizontal,
      selected: clickable,
    });
    return (
      <div className="parity-list" style={{ width: v.box.w }}>
        <List orientation={horizontal ? 'horizontal' : 'vertical'} clickable={clickable} items={[item(), item()]} />
      </div>
    );
  },
};

/* Loader: the 32px ring (Other/Loader at medium), drawn as a conic sweep from
   the Primary button border into the Background. Position 1–4 are its quarter
   turns; code is one spinning ring, rendered here paused at each turn. */
const loader: ParityComponent = {
  key: 'loader',
  name: 'Loader',
  nodeId: '5859:1629',
  libFile: 'src/components/Loader/Loader.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-loader .loader-ring', label: 'Ring', skip: ['fill', 'border', 'radius (as drawn)'] },
  ],
  render: (v) => (
    <div className="parity-loader" style={{ width: v.box.w, height: v.box.h }}>
      <Loader message="" sx={{ py: 0 }}
        style={{ ['--_turn' as string]: (Number(v.props.Position) - 1) * 90 + 'deg' }} />
      <style>{`.parity-loader .loader-ring{animation:none!important;transform:rotate(var(--_turn))}`}</style>
    </div>
  ),
};

/* Menu Item: the tree row (OmniTreeView's). Toggle chevron, a starting icon,
   a MiniSwatch and the label, a Border-Variant line under it; open shows one
   child row indented to the next Menu-Level. */
const menuItem: ParityComponent = {
  key: 'menuItem',
  name: 'Menu Item',
  nodeId: '8007:25355',
  libFile: 'src/components/TreeView/TreeView.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Parent', css: '.parity-menu-item .omni-tree-content', label: 'Row', skip: ['border', 'shadow', 'opacity'] },
    { figma: 'Toggle', css: '.parity-menu-item .omni-tree-twisty', label: 'Toggle', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'MiniSwatch', css: '.parity-menu-item .mini-swatch', shadow: 'inset', label: 'Swatch', skip: ['fill', 'shadow'] },
    { figma: 'Menu Slot', css: '.parity-menu-item .omni-tree-label', label: 'Label box', skip: ['fill', 'border', 'shadow', 'width', 'radius (as drawn)'] },
    { figma: 'Component Name', css: '.parity-menu-item .omni-tree-label .typography', label: 'Label', skip: ['width', 'height', 'position', 'fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Focus-Visible', css: '.parity-menu-item .omni-tree-content', outline: true, label: 'Focus ring', when: (v) => v.props.State === 'Focus-Visible' },
    // Disabled dims the row, not the branch under it: a child is its own item.
    { figma: 'Children Slot', css: '.parity-menu-item ul[role="group"]', label: 'Children', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'opacity'], when: (v) => v.props.Type === 'open' },
  ],
  render: (v) => {
    const open = v.props.Type === 'open';
    // The child row keeps its own state: Figma draws Hover / Pressed / Focus on the parent row only.
    const child = { id: 'c', label: 'Menu Item', icon: <HomeIcon />, swatch: 'var(--Buttons-Primary-Button)', className: OWN_STATE_CLASS, children: [{ id: 'g', label: 'Menu Item' }] };
    const items = [{ id: 'p', label: 'Menu Item', icon: <HomeIcon />, swatch: 'var(--Buttons-Primary-Button)', disabled: v.props.State === 'Disabled', children: [child] }];
    return (
      <div className="parity-menu-item" style={{ width: v.box.w }}>
        {/* Just the rows: on Surface, with the tree's own panel padding and corner off. */}
        <OmniTreeView items={items} variant="default" surface="Surface" animation="none" disableSelection
          defaultExpandedItems={open ? ['p'] : []} aria-label="Menu"
          sx={{ borderRadius: 0, '& [role="tree"]': { padding: 0 } }} />
      </div>
    );
  },
};

/* Message Icons: the 16px glyph an InputMessage leads with — one per
   notification, in that notification's Icons colour (Icons mode → --Icons-*).
   Drawn with the lib's own MESSAGE_ICONS map and Icon at xxs, which is
   exactly what InputMessage renders. */
const messageIcons: ParityComponent = {
  key: 'messageIcons',
  name: 'Message Icons',
  nodeId: '8580:22896',
  libFile: 'src/components/InputMessage/InputMessage.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-message-icon > *', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const type = String(v.props.Notification);
    const Glyph = MESSAGE_ICONS[type];
    return (
      <div className="parity-message-icon" style={{ width: v.box.w, height: v.box.h, display: 'flex' }}>
        <Icon size="xxs" color={type}><Glyph /></Icon>
      </div>
    );
  },
};

/* Nav Item: one bottom-navigation item — a 40px circular icon holder over a
   Mobile-Nav-Label. Selected fills the holder with --Text and reverses the
   icon out of it. Rendered as a one-item bar with the bar's own chrome off. */
const navItem: ParityComponent = {
  key: 'navItem',
  name: 'Nav Item',
  nodeId: '5670:49999',
  libFile: 'src/components/BottomNavigation/BottomNavigation.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-nav .bottom-nav-item', label: 'Item', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Icon-Holder', css: '.parity-nav .bottom-nav-item > :first-child', label: 'Icon holder' },
    // Figma's Icon frame has no fill — its colour is on the glyph inside — so only its box is compared.
    { figma: 'Icon', css: '.parity-nav .bottom-nav-item svg', label: 'Icon', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
    { figma: 'Component Name', css: '.parity-nav .bottom-nav-label', label: 'Label' },
  ],
  render: (v) => (
    <div className="parity-nav" style={{ width: v.box.w, height: v.box.h }}>
      {/* In Figma's zone (Default / Surface): the bar would otherwise put the
          item in its own Nav-Bar theme, which Figma's lone item is not in. */}
      <BottomNavigation fixed={false} items={[{ label: 'Home', icon: <HomeIcon /> }]}
        data-theme="Default" data-surface="Surface"
        value={v.props.State === 'Selected' ? 0 : -1} aria-label="Navigation"
        sx={{ p: 0, m: 0, width: 'auto', minHeight: 0, display: 'inline-flex', background: 'transparent', boxShadow: 'none', border: 'none' }} />
    </div>
  ),
};

/* Nav Rail: Default (labelled items in two groups split by a divider),
   Closed-Expandable (the menu toggle over icon rows) and Open-Expandable (the
   toggle over full rows). The second item is selected in each. */
const RAIL_ITEMS = [0, 1, 2, 3].map(() => ({ icon: <HomeIcon />, label: 'Label' }));
const navRail: ParityComponent = {
  key: 'navRail',
  name: 'Nav Rail',
  nodeId: '8224:5229',
  libFile: 'src/components/Rail/Rail.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: '__root__', css: '.parity-rail .rail', label: 'Rail', skip: ['shadow', 'height'] },
    { figma: 'Expandable Rail Slot', css: '.parity-rail .rail [role="tablist"]', label: 'Slot', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'height'] },
    // Item edges are inset rings; an unselected collapsed item paints nothing, so its corner is not compared.
    { figma: 'Nav Rail Item', css: '.parity-rail .rail-item', all: true, shadow: 'inset', label: 'Item', skip: ['shadow', 'radius (as drawn)'], when: (v) => v.props.Type === 'Default' },
    { figma: 'Expandable Nav Rail Item', css: '.parity-rail .rail-item', all: true, shadow: 'inset', label: 'Item', skip: ['shadow'], when: (v) => v.props.Type !== 'Default' },
    { figma: 'Expand-Collapse', css: '.parity-rail .rail-toggle', label: 'Toggle row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Type !== 'Default' },
    { figma: 'Button', css: '.parity-rail .rail-toggle button', label: 'Toggle', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Type !== 'Default' },
    { figma: 'Drawer Title', css: '.parity-rail .rail-section-title', label: 'Title', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Type !== 'Default' },
    { figma: 'Top', css: '.parity-rail .rail-brand', label: 'Brand row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'], when: (v) => v.props.Type === 'Default' },
  ],
  render: (v) => {
    const type = String(v.props.Type);
    const expandable = type !== 'Default';
    return (
      <div className="parity-rail" style={{ width: v.box.w, height: v.box.h }}>
        <Rail value={1} aria-label="Navigation"
          expandable={expandable} defaultExpanded={type === 'Open-Expandable'}
          brand={expandable ? undefined : <div style={{ width: 'var(--Button-Height, 32px)', height: 'var(--Button-Height, 32px)', background: 'var(--Background)' }} />}
          sections={expandable ? [{ title: 'Title', items: RAIL_ITEMS }] : [{ items: RAIL_ITEMS.slice(0, 2) }, { items: RAIL_ITEMS.slice(2) }]} />
      </div>
    );
  },
};

/* Nav Rail Item: the collapsed rail's item — Label Contained (the state fills
   the whole 64x47 item) or Label Outside (only the 32px circle round the icon).
   Selected is the Buttons palette. */
const navRailItem: ParityComponent = {
  key: 'navRailItem',
  name: 'Nav Rail Item',
  nodeId: '8224:5192',
  libFile: 'src/components/Rail/Rail.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    // The item's corner only shows where the item paints (Contained: hover, pressed, selected).
    { figma: '__root__', css: '.parity-rail-item .rail-item', shadow: 'inset', label: 'Item', skip: ['shadow'],
      when: (v) => v.props.Style === 'Label Contained' && ['Hover', 'Pressed', 'Selected'].includes(String(v.props.State)) },
    { figma: '__root__', css: '.parity-rail-item .rail-item', shadow: 'inset', label: 'Item', skip: ['shadow', 'radius (as drawn)'],
      when: (v) => !(v.props.Style === 'Label Contained' && ['Hover', 'Pressed', 'Selected'].includes(String(v.props.State))) },
    // Figma names shift between the Styles: Contained's padded row is "Icon Buttons";
    // Outside's 32px circle is "Rail Button" (its "Icon Buttons" is the bare 20px glyph).
    { figma: 'Icon Buttons', css: '.parity-rail-item .rail-item > :first-child', shadow: 'inset', label: 'Rail button', skip: ['shadow'],
      when: (v) => v.props.Style === 'Label Contained' },
    { figma: 'Rail Button', css: '.parity-rail-item .rail-item > :first-child', shadow: 'inset', label: 'Circle', skip: ['shadow'],
      when: (v) => v.props.Style === 'Label Outside' },
    { figma: 'Component Name', css: '.parity-rail-item .rail-item-label', label: 'Label' },
    { figma: 'Focus-Visible', css: '.parity-rail-item .rail-item', outline: true, outer: true, label: 'Focus ring',
      when: (v) => v.props.State === 'Focus-Visible' && v.props.Style === 'Label Contained' },
    { figma: 'Focus-Visible', css: '.parity-rail-item .rail-item > :first-child', outline: true, outer: true, label: 'Focus ring',
      when: (v) => v.props.State === 'Focus-Visible' && v.props.Style === 'Label Outside' },
  ],
  render: (v) => (
    <div className="parity-rail-item" style={{ width: v.box.w }}>
      <RailItem item={{ icon: <HomeIcon />, label: 'Label', disabled: v.props.State === 'Disabled' }}
        selected={v.props.State === 'Selected'} labelStyle={v.props.Style === 'Label Outside' ? 'outside' : 'contained'} />
    </div>
  ),
};

/* No-Count Step: the stepper's plain dot (No-Count-Step, 12 at medium) with
   its label. Figma's Orientation names where the LABEL goes — horizontal is
   beside the dot, which is a vertical stepper's step in code; vertical is
   below it, a horizontal stepper's. */
const noCountStep: ParityComponent = {
  key: 'noCountStep',
  name: 'No-Count Step',
  nodeId: '8425:36435',
  libFile: 'src/components/Stepper/Stepper.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Ellipse 1', css: '.step-indicator', label: 'Dot', skip: ['shadow', 'radius (as drawn)'] },
    { figma: 'Label', css: '.step .typography', label: 'Label' },
  ],
  render: (v, booleans) => {
    const labelled = booleans['Label'] ?? true;
    return (
      <div style={{ width: v.box.w, display: 'inline-block' }}>
        <Stepper variant="noCount" orientation={v.props.Orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          activeStep={COUNT_STEP_ACTIVE[String(v.props.Status)]}>
          <Step label={labelled ? 'Label' : undefined} />
        </Stepper>
      </div>
    );
  },
};

/* Number: the field with steppers — Outline (a stacked column of two ghost
   Field Buttons on the trailing edge, 67 at medium) or Spinner (outline Field
   Buttons either side), each also with a floating label. */
const number: ParityComponent = {
  key: 'number',
  name: 'Number',
  nodeId: '9518:52318',
  libFile: 'src/components/NumberField/NumberField.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Input', css: '.parity-number .inp-shell', label: 'Field', skip: ['fill', 'border', 'radius (as drawn)'] },
    { figma: 'Increments', css: '.parity-number .numberfield-steppers', label: 'Stepper column', skip: ['fill', 'border', 'shadow'],
      when: (v) => /outline/i.test(String(v.props.Type)) },
    { figma: 'Field Button', css: '.parity-number button.field-button', all: true, label: 'Stepper', skip: ['fill', 'shadow'] },
    { figma: 'Divider', css: '.parity-number .numberfield-steppers > div', label: 'Divider', skip: ['border', 'shadow', 'radius (as drawn)'],
      when: (v) => /outline/i.test(String(v.props.Type)) },
  ],
  render: (v) => {
    const type = String(v.props.Type);
    return (
      <div className="parity-number" style={{ width: v.box.w }}>
        <NumberField variant={/Spinner/.test(type) ? "spinner" : "outlined"} defaultValue={1} fullWidth
          label="Email address" labelPosition={/Floating/.test(type) ? 'floating' : 'none'} aria-label="Quantity" />
      </div>
    );
  },
};

/* NumberField: the Number with its Form-Label — top, left, floating or none. */
const numberField: ParityComponent = {
  key: 'numberField',
  name: 'NumberField',
  nodeId: '9518:52593',
  libFile: 'src/components/NumberField/NumberField.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  parts: [
    { figma: 'Form-Label', css: '.parity-number-field .form-label-row', label: 'Label row', skip: ['fill', 'border', 'shadow', 'radius (as drawn)', 'width'],
      when: (v) => v.props.Label === 'label-top' || v.props.Label === 'label-left' },
    { figma: 'Number', css: '.parity-number-field .numberfield-row', label: 'Number', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v) => {
    const pos = String(v.props.Label);
    return (
      <div className="parity-number-field" style={{ width: v.box.w }}>
        <NumberField defaultValue={1} fullWidth label="Label" aria-label="Quantity"
          labelPosition={pos === 'label-top' ? 'top' : pos === 'label-left' ? 'left' : pos === 'floating' ? 'floating' : 'none'} />
      </div>
    );
  },
};

/* Input Decorator: the ghost button an Input carries at its end — Type text
   ("Button" + a 20px end icon) or iconOnly (32px, "backspace"). It is the
   lib's ghost Button; Button-Container carries the hover lift, Button-Fill
   the paint, Focus-Visible a 3px ring inside. */
const inputDecorator: ParityComponent = {
  key: 'inputDecorator',
  name: 'Input Decorator',
  nodeId: '8590:24802',
  libFile: 'src/components/Input/InputDecorator.js',
  context: { theme: 'Default', surface: 'Surface', size: 'medium' },
  forcedState: (v) => ({ Hover: 'hover', Pressed: 'active', 'Focus-Visible': 'focus-visible' } as const)[v.props.State as 'Hover'],
  parts: [
    { figma: 'Button-Container', css: 'button.MuiButton-root', label: 'Elevation', skip: ['fill', 'border'], shadow: 'outer' },
    { figma: 'Button-Fill', css: 'button.MuiButton-root', label: 'Fill', shadow: 'inset' },
    { figma: 'Focus-Visible', css: 'button.MuiButton-root', outline: true, label: 'Focus ring' },
    { figma: 'Typography Holder', css: '.btn-text-content', label: 'Label box', when: (v) => v.props.Type === 'text', skip: ['fill'] },
    { figma: 'Component Name', css: '.btn-text-content .typography', label: 'Label', when: (v) => v.props.Type === 'text' },
    { figma: 'Icon', css: '.MuiButton-endIcon', label: 'End icon', when: (v) => v.props.Type === 'text' },
    { figma: 'Icon', css: 'button.MuiButton-root svg', label: 'Icon', when: (v) => v.props.Type === 'iconOnly', skip: ['fill', 'border', 'shadow', 'radius (as drawn)'] },
  ],
  render: (v, b) => {
    const common = {
      disabled: v.props.State === 'Disabled',
      className: v.props.State === 'Focus-Visible' ? 'Mui-focusVisible' : undefined,
    };
    return v.props.Type === 'iconOnly'
      ? <InputDecorator {...common} aria-label="Clear"><BackspaceIcon /></InputDecorator>
      : <InputDecorator {...common} startDecorator={b['start-icon'] ? <HomeIcon /> : undefined} endDecorator={(b['end-icon'] ?? true) ? <HomeIcon /> : undefined}>Button</InputDecorator>;
  },
};

export const PARITY_COMPONENTS: ParityComponent[] = [accordionGroup, accordionSegment, alert, appBar, avatar, badgeCounter, box, breadcrumbs, button, buttonGroup, card, checkbox, checkboxField, chip, countStep, dayCell, divider, expandableNavRailItem, fab, fieldButton, formHelper, formLabel, hotlinkGroup, icon, imagePlaceholder, input, inputDecorator, inputField, link, list, loader, menuItem, messageIcons, navItem, navRail, navRailItem, noCountStep, number, numberField, paginationNumber, player, progressBar, progressDial, radio, radioField, rating, ratingField, ratioFillHorizontal, ratioFillVertical, select, selectField, sheet, slider, sliderThumbHorizontal, sliderThumbVertical, sliderField, snackbar, speedDial, star, stepLine, stepper, switchParity, switchField, tab, tabs, tag, textArea, textAreaField, swatch, toggleButtonGroup, tooltip, treeView, validationFrame];
