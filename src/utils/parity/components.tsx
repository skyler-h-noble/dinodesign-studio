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
import type { ReactNode } from 'react';
import { Alert, Button, Icon, Radio, Swatch } from '@omni-design/components';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import type { FigmaVariant } from './figmaSet';
import type { ForcedState } from './pseudoStates';

export interface ParityPart {
  figma: string;
  css: string;
  label: string;
  /** Measure this pseudo-element of the matched node rather than the node. */
  pseudo?: '::before' | '::after';
  /** Properties this pairing does not own (another pairing measures them). */
  skip?: string[];
  /** Measure the node's spread box-shadow as a ring: a gap layer, then a band. */
  halo?: boolean;
  /** Measure the node's CSS outline (offset + width) instead of its box. */
  outline?: boolean;
  /** Compare the OUTER edge — for rings, where Figma's stroke sits outside
   *  its frame and CSS's border sits inside its box. */
  outer?: boolean;
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
  /** The modes the Figma set RESOLVES in (read with resolvedVariableModes),
   *  which the code side must match or every size and color differs for a
   *  reason that has nothing to do with the component. */
  context?: { theme?: string; surface?: string; size?: 'small' | 'medium' | 'large' };
  /** Axes or layers in Figma the lib has no way to express — listed, not hidden. */
  notes?: string[];
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
    { figma: 'Message Icons', css: '.alert-start-decorator', label: 'Icon' },
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
        startDecorator={<Icon size="xxs"><Glyph /></Icon>}
        endDecorator={<Button iconOnly variant="ghost" size="medium" aria-label="Close alert"><CloseIcon /></Button>}
      >
        Alert body
      </Alert>
    );
  },
};

export const PARITY_COMPONENTS: ParityComponent[] = [swatch, radio, alert];
