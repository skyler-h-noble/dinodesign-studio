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
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Alert, AppBar, Avatar, Badge, Box, BreadcrumbItem, Breadcrumbs, Body, Button, Card, Checkbox, Chip, DayCell, Divider, Fab, FieldButton, FormHelper, FormLabel, Link, LinkGroup, ImagePlaceholder, TextInput, InputDecorator, ButtonGroup, Icon, Radio, RailItem, Ratio, Select, Slider, Step, Stepper, Subtitle, Swatch, Tab, TabList, Tabs, ToggleButtonGroup } from '@omni-design/components';
import HomeIcon from '@mui/icons-material/Home';
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
  shadow?: 'outer' | 'inset';
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
  // The Radio page resolves the set in .Theme=Primary and Component-Size=large.
  context: { theme: 'Primary', surface: 'Surface', size: 'large' },
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
  ],
  render: (v) => {
    const type = String(v.props.Type);
    const vertical = v.props.Orientation === 'vertical';
    const val = SLIDER_VALUES[type + '|' + v.props.Orientation];
    return (
      <div className="parity-slider" style={{ width: v.box.w, height: v.box.h, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: vertical ? '0 48px' : '48px 0' }}>
        <Slider aria-label="Amount" orientation={vertical ? 'vertical' : 'horizontal'} value={val} track={type.includes('inverted') ? 'inverted' : 'standard'}
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

export const PARITY_COMPONENTS: ParityComponent[] = [accordionGroup, accordionSegment, alert, appBar, avatar, badgeCounter, box, breadcrumbs, button, buttonGroup, card, checkbox, checkboxField, chip, countStep, dayCell, divider, expandableNavRailItem, fab, fieldButton, formHelper, formLabel, hotlinkGroup, icon, imagePlaceholder, input, inputDecorator, inputField, link, radio, ratioFillHorizontal, ratioFillVertical, select, selectField, slider, sliderThumbHorizontal, sliderThumbVertical, sliderField, swatch, toggleButtonGroup];
