// roundTrip.ts — code → IR → (simulated Figma nodes) → the Figma → code
// compiler → code, with no Figma in the loop.
//
// Two halves:
//
//   irToFigmaNode(ir)   what the plugin will build, as the plugin's own
//                       "enriched tree" JSON: each node carries the `_aaid`
//                       note keys (component, variant, modes, layout, sizingH,
//                       sizingV, boundVars) INLINE, exactly as the plugin
//                       stamps them in sharedPluginData('dino','aaid'). Layer
//                       structure follows the live template (a Card's slot is
//                       under Card Container > Card Content; a List Item's
//                       slots are under its Content frame), so the round trip
//                       also exercises the Figma → code reading of the live
//                       structure.
//
//   signatures          a small, comparable form of "which component, which
//                       props" — computed from the CODE when the mapper runs
//                       (InstanceNode.code / TextNode.code) and from the JSX the
//                       Figma → code compiler emits. The acceptance test
//                       asserts the two sequences are equal for clean nodes.

import type { JsxElement, JsxNode, PropValue } from '../aaid/jsx';
import { EXPORT_TO_TEXT_STYLE, TEXT_STYLE_TO_EXPORT, normalizeStyleName } from '../aaid/propTables';
import type { RecordedValue } from './record';
import type { FrameNode, InstanceNode, Node, Signature, Space } from './schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Signatures ──────────────────────────────────────────────────────────────

/** Comparable props per component, with the lib default each is dropped at. */
const SIG_PROPS: Record<string, Record<string, string | number | boolean>> = {
  Button: { variant: 'default', size: 'medium', disabled: false, selected: false, iconOnly: false, letterNumber: false, fullWidth: false, badge: false },
  Card: { orientation: 'vertical', clickable: false, elevated: false, selected: false, disabled: false, draggable: false, surface: '', 'data-theme': '', size: 'medium' },
  Divider: { orientation: 'horizontal', colored: false, size: 'small' },
  Checkbox: { variant: 'default', size: 'medium', defaultChecked: false, indeterminate: false, disabled: false, error: false },
  Chip: { variant: 'neutral', selected: false, disabled: false, label: '' },
  Tag: { color: '', width: 'hug' },
  Avatar: { size: 'medium', initials: '', color: '', defaultPhoto: false },
  Ratio: { ratio: '1:1', fit: 'width' },
  List: { clickable: false, orientation: 'vertical' },
  ListItem: { clickable: false, selected: false, disabled: false, secondary: '', eyebrow: '' },
  Icon: { glyph: '' },
  /* Phase 4 */
  Rating: { value: 0, precision: 1, size: 'medium', color: 'default', disabled: false, label: '', labelPosition: 'top' },
  Link: { disabled: false, visited: false, textStyle: 'body' },
  TextInput: { label: '', labelPosition: 'standard', labelType: 'default', placeholder: '', defaultValue: '', disabled: false, size: 'medium', fullWidth: false, validation: '' },
  NumberField: { label: '', labelPosition: 'top', value: '', variant: 'outlined', size: 'medium', disabled: false, helperText: '', fullWidth: false, type: 'default' },
  Select: { label: '', labelPosition: 'top', disabled: false, size: 'medium', fullWidth: false },
  Tabs: { orientation: 'horizontal', value: 0 },
  Stepper: { activeStep: 0, orientation: 'horizontal', variant: 'count' },
  Breadcrumbs: {},
  Swatch: { selected: false, disabled: false, fit: 'fixed', radio: false, size: 'medium', label: '' },
  IconBadge: { color: 'primary', size: 'medium', glyph: '' },
  ThumbnailSelector: { size: 'medium', orientation: 'horizontal', value: 0 },
  AppBar: { layout: '' },
  Footer: {},
};

/** Components whose signature already says everything inside them: the walk does not descend. */
const LEAF_COMPONENTS = new Set(['Button', 'Chip', 'ListItem', 'Rating', 'Link', 'TextInput', 'NumberField', 'Select', 'Tabs', 'Stepper', 'Breadcrumbs', 'Swatch', 'IconBadge', 'ThumbnailSelector', 'AppBar', 'Footer']);
const LEAF_SETS = new Set(['Button', 'Chip', 'List Item', 'Rating', 'RatingField', 'Link', 'Input Field', 'NumberField', 'SelectField', 'Tabs', 'Stepper', 'Swatch', 'IconBadge', 'AppBar', 'Footer']);
const TYPOGRAPHY = new Set(Object.keys(EXPORT_TO_TEXT_STYLE));

function plain(v: unknown): string | number | boolean | undefined {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return undefined;
}

/** The signature of one component from a flat prop table and its text. */
export function signature(component: string, props: Record<string, unknown>, text?: string): Signature {
  const p: Record<string, string | number | boolean> = {};
  if (TYPOGRAPHY.has(component)) {
    const color = plain(props.color);
    if (typeof color === 'string' && !['standard', 'default', 'inherit'].includes(color)) p.color = color;
  } else {
    for (const [k, def] of Object.entries(SIG_PROPS[component] ?? {})) {
      const v = plain(props[k]);
      if (v === undefined || v === def || v === false) continue;
      p[k] = v;
    }
  }
  if (component === 'Button' && p.iconOnly && typeof props['aria-label'] === 'string') p['aria-label'] = props['aria-label'];
  const sig: Signature = { c: component, p };
  if (text !== undefined && text.trim()) sig.t = text.trim();
  return sig;
}

/** Code-side normalization the round trip is allowed to make (each documented). */
export function codeSignature(component: string, props: Record<string, RecordedValue>, text: string | undefined): Signature {
  const q: Record<string, unknown> = { ...props };
  if (component === 'Card' && (props.onClick !== undefined || typeof props.href === 'string')) q.clickable = true;
  if (component === 'ListItem' && props.onClick !== undefined) q.clickable = true;
  if (component === 'Checkbox' && props.checked === true) q.defaultChecked = true;
  /* An Avatar photo's src cannot be written back by Figma → code (it has no
     image URL); the photo style is what survives. */
  if (component === 'Avatar' && typeof props.src === 'string') q.defaultPhoto = true;
  if (component === 'Button' && typeof props.contentType === 'string') q[props.contentType] = true;
  /* Rating: the stars the lib DRAWS (full when n <= value, half when
     precision is 0.5 and n - 0.5 <= value) — 4.2 draws four stars and comes
     back as 4; precision survives only when a half star is drawn. The exact
     value rides in plugin data. */
  if (component === 'Rating') {
    const raw = typeof props.value === 'number' ? props.value : typeof props.defaultValue === 'number' ? props.defaultValue : 0;
    const v = Math.max(0, Math.min(5, raw));
    const shown = props.precision === 0.5 ? Math.floor(v * 2) / 2 : Math.floor(v);
    q.value = shown;
    q.precision = shown % 1 ? 0.5 : 1;
  }
  /* TextInput: the field shows the value, or else the placeholder. */
  if (component === 'TextInput') {
    const value = props.value ?? props.defaultValue;
    q.defaultValue = value === undefined || value === null ? '' : String(value);
    if (q.defaultValue) delete q.placeholder;
  }
  /* A Link's textStyle that draws Body-Medium is the default. */
  if (component === 'Link' && typeof props.textStyle === 'string') {
    const exp = TEXT_STYLE_TO_EXPORT[normalizeStyleName(props.textStyle)];
    q.textStyle = exp === 'Body' || !exp ? 'body' : normalizeStyleName(EXPORT_TO_TEXT_STYLE[exp] ?? props.textStyle);
  }
  return signature(component, q, text);
}

function propValue(v: PropValue): unknown {
  switch (v.kind) {
    case 'string': return v.value;
    case 'number': return v.value;
    case 'true': return true;
    case 'json': return v.value;
    default: return undefined;
  }
}

function jsxText(nodes: JsxNode[]): string {
  return nodes.map((n) => (n.kind === 'text' ? n.value : n.kind === 'element' && !n.tag.endsWith('Icon') ? jsxText(n.children) : '')).join('');
}

/** The phase-4 components whose emitted JSX spells a fact differently from the code's props. */
function jsxSpecial(n: JsxElement, props: Record<string, unknown>): Signature | undefined {
  const kids = n.children.filter((c): c is JsxElement => c.kind === 'element');
  switch (n.tag) {
    case 'Rating': return signature('Rating', { ...props, value: props.defaultValue ?? props.value ?? 0 });
    case 'NumberField': return signature('NumberField', { ...props, value: props.defaultValue ?? props.value });
    case 'Select': return signature('Select', props, String(props.defaultValue ?? props.placeholder ?? 'Select\u2026'));
    case 'Tabs': {
      const tabs = kids.flatMap((l) => l.children).filter((c): c is JsxElement => c.kind === 'element' && c.tag === 'Tab');
      return signature('Tabs', { orientation: props.orientation, value: props.defaultValue ?? 0 }, tabs.map((t) => jsxText(t.children).trim()).join(' | '));
    }
    case 'Stepper': return signature('Stepper', props, kids.map((s) => String(Object.fromEntries(s.props.map(([k, v]) => [k, propValue(v)])).label ?? '')).join(' | '));
    case 'Breadcrumbs': return signature('Breadcrumbs', {}, kids.map((c) => jsxText(c.children).trim()).join(' / '));
    case 'IconBadge': {
      const glyph = kids[0]?.tag.replace(/Icon$/, '');
      return signature('IconBadge', { ...props, glyph });
    }
    case 'ThumbnailSelector': {
      const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
      return signature('ThumbnailSelector', { ...props, value: props.defaultValue ?? 0 }, items.map((i) => String(i.alt ?? '')).join(' | '));
    }
    case 'AppBar': {
      const links = Array.isArray(props.navLinks) ? (props.navLinks as Array<Record<string, unknown>>) : [];
      return signature('AppBar', props, links.map((l) => String(l.label ?? '')).join(' | '));
    }
    default: return undefined;
  }
}

/** Signatures of the compiled JSX, pre-order, for the components the IR compares. */
export function jsxSignatures(root: JsxNode): Signature[] {
  const out: Signature[] = [];
  const walk = (n: JsxNode) => {
    if (n.kind !== 'element') return;
    const props = Object.fromEntries(n.props.map(([k, v]) => [k, propValue(v)]));
    if (n.tag === 'Icon') {
      const glyph = (n.children.find((c) => c.kind === 'element') as JsxElement | undefined)?.tag.replace(/Icon$/, '');
      out.push(signature('Icon', { glyph }));
      return;
    }
    const special = jsxSpecial(n, props);
    if (special) {
      out.push(special);
      return;
    }
    if (n.tag in SIG_PROPS || TYPOGRAPHY.has(n.tag)) {
      const text = n.tag === 'Card' || n.tag === 'List' || n.tag === 'Ratio' ? undefined : jsxText(n.children);
      out.push(signature(n.tag, props, text));
    }
    if (LEAF_COMPONENTS.has(n.tag)) return;
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

/** Signatures the IR promises, pre-order: from the code for clean nodes, from the IR otherwise. */
export function irSignatures(root: Node): Array<{ sig: Signature; status: string; id: string }> {
  const out: Array<{ sig: Signature; status: string; id: string }> = [];
  const walk = (n: Node) => {
    if (n.kind === 'instance' || n.kind === 'text') {
      if (n.code) out.push({ sig: n.code, status: n.status, id: n.id });
      if (n.kind === 'instance') {
        if (LEAF_SETS.has(n.component.set)) return;
        for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk);
      }
      return;
    }
    /* A composite frame (Breadcrumbs, Thumbnail Selector) is one component. */
    if (n.kind === 'frame' && n.composite) {
      if (n.code) out.push({ sig: n.code, status: n.status, id: n.id });
      return;
    }
    if (n.kind === 'frame' || n.kind === 'placeholder') n.children.forEach(walk);
  };
  walk(root);
  return out;
}

// ── IR → the plugin's node JSON ─────────────────────────────────────────────

const pxOf = (s: Space | undefined) => s?.px ?? 0;

function frameNote(layout: FrameNode['layout']) {
  const mode = layout.mode === 'GRID' ? 'HORIZONTAL' : layout.mode;
  return {
    mode,
    gap: pxOf(layout.itemSpacing),
    padTop: pxOf(layout.padding?.top), padRight: pxOf(layout.padding?.right), padBottom: pxOf(layout.padding?.bottom), padLeft: pxOf(layout.padding?.left),
    primaryAxis: layout.primary ?? 'MIN',
    counterAxis: layout.counter ?? 'MIN',
    wrap: layout.wrap || layout.mode === 'GRID' ? 'WRAP' : 'NO_WRAP',
  };
}

function boundSpacing(layout: FrameNode['layout']): Record<string, string> {
  const b: Record<string, string> = {};
  if (layout.itemSpacing?.variable) b.itemSpacing = layout.itemSpacing.variable;
  const sides = { paddingTop: layout.padding?.top, paddingRight: layout.padding?.right, paddingBottom: layout.padding?.bottom, paddingLeft: layout.padding?.left };
  for (const [k, v] of Object.entries(sides)) if (v?.variable) b[k] = v.variable;
  return b;
}

function sizingKeys(n: Node): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const s = n.sizing;
  if (s?.h && s.h !== 'HUG') o.sizingH = s.h;
  if (s?.v && s.v !== 'HUG') o.sizingV = s.v;
  if (s?.width !== undefined || s?.height !== undefined) o.size = { x: s?.width ?? 0, y: s?.height ?? 0 };
  return o;
}

const text = (id: string, name: string, characters: string, styleName?: string, fill?: string) => ({
  id, name, type: 'TEXT', characters, ...(styleName ? { styleName } : {}), ...(fill ? { boundVars: { fills: fill } } : {}),
});

const slot = (id: string, name: string, children: any[]) => ({ id, name, type: 'SLOT', children });

function instanceChildren(n: InstanceNode, conv: (x: Node) => any): any[] {
  const set = n.component.set;
  const nested = (role: string) => n.nested?.find((x) => x.role === role)?.node;
  const kids = (name: string) => (n.slots?.[name] ?? []).map(conv);
  switch (set) {
    case 'Button':
    case 'Chip': {
      const out: any[] = [];
      const s = nested('start');
      if (s) out.push(conv(s));
      const icon = nested('icon');
      if (icon) out.push(conv(icon));
      if (n.text?.label) out.push(text(`${n.id}:label`, 'Label', n.text.label));
      const e = nested('end');
      if (e) out.push(conv(e));
      return out;
    }
    case 'Icon': return [text(`${n.id}:glyph`, String(n.properties?.['Icon name'] ?? ''), String(n.properties?.['Icon name'] ?? ''))];
    case 'Card':
      return [{ id: `${n.id}:container`, name: 'Card Container', type: 'FRAME', children: [
        { id: `${n.id}:content`, name: 'Card Content', type: 'FRAME', children: [slot(`${n.id}:padded`, 'Padded Card Content', kids('Padded Card Content'))] },
      ] }];
    case 'List': return [slot(`${n.id}:slot`, 'List Slot', kids('List Slot'))];
    case 'List Item': {
      const t: any[] = [];
      if (n.text?.eyebrow) t.push(text(`${n.id}:eyebrow`, 'Eyebrow', n.text.eyebrow, 'Eyebrow-Small'));
      if (n.text?.title) t.push(text(`${n.id}:title`, 'Title', n.text.title, 'Subtitle-Medium'));
      if (n.text?.secondary) t.push(text(`${n.id}:secondary`, 'Secondary', n.text.secondary, 'Body-Medium'));
      return [{ id: `${n.id}:content`, name: 'Content', type: 'FRAME', children: [
        slot(`${n.id}:start`, 'Start Decorator', kids('Start Decorator')),
        { id: `${n.id}:text`, name: 'Text', type: 'FRAME', children: t },
        slot(`${n.id}:end`, 'End Decorator', kids('End Decorator')),
      ] }];
    }
    case 'Ratio - Fill Horizontal':
    case 'Ratio - Fill Vertical': return n.slots?.['Ratio Slot'] ? [slot(`${n.id}:slot`, 'Ratio Slot', kids('Ratio Slot'))] : [];
    case 'Tag':
    case 'Checkbox': return n.text?.label ? [text(`${n.id}:label`, 'Label', n.text.label)] : [];
    case 'Avatar': return n.text?.initials ? [text(`${n.id}:initials`, 'Initials', n.text.initials)] : [];
    /* Phase 4 — the live layer structure each set has (read 2026-11-06). */
    case 'Rating':
      return [slot(`${n.id}:stars`, 'Star Slot', kids('Star Slot'))];
    case 'RatingField':
      return [formLabel(n, conv), ...(nested('rating') ? [conv(nested('rating')!)] : [])].filter(Boolean);
    case 'Link':
      return [text(`${n.id}:label`, 'Hotlink', n.text?.label ?? '', n.textStyles?.label ?? 'Body-Medium')];
    case 'Input Field':
    case 'NumberField':
    case 'SelectField': {
      const out: any[] = [formLabel(n, conv)].filter(Boolean);
      for (const role of ['input', 'number', 'select']) {
        const x = nested(role);
        if (x) out.push(conv(x));
      }
      if (set === 'NumberField' && n.text?.helper) out.push({ id: `${n.id}:helper`, name: 'Form-Helper', type: 'INSTANCE', component: 'Form-Helper', variant: { Validation: 'none' }, children: [text(`${n.id}:helperText`, 'Input Help Text', n.text.helper, 'Legal')] });
      return out;
    }
    case 'Input': {
      const content = parentNested(n, 'content');
      return [{ id: `${n.id}:frame`, name: 'Input/Default/Search', type: 'FRAME', children: [{ id: `${n.id}:inner`, name: 'Inner Frame', type: 'FRAME', children: [
        ...(nested('start') ? [conv(nested('start')!)] : []),
        ...(content ? [conv(content)] : []),
        ...(n.slots?.['End Decorator Content'] ? [slot(`${n.id}:end`, 'End Decorator Content', kids('End Decorator Content'))] : []),
      ] }] }];
    }
    case 'Select': {
      const content = parentNested(n, 'content');
      return content ? [{ id: `${n.id}:input`, name: 'Input', type: 'INSTANCE', component: 'Input', variant: { State: 'Default', Type: 'Default' }, children: [conv(content)] }] : [];
    }
    case 'InputContent':
    case 'Number':
      return n.text?.value ? [text(`${n.id}:value`, 'Component Name', n.text.value)] : [];
    case 'Tabs':
      return [
        ...(nested('first') ? [conv(nested('first')!)] : []),
        slot(`${n.id}:tabs`, 'Tab Slot', kids('Tab Slot')),
        ...(nested('last') ? [conv(nested('last')!)] : []),
      ];
    case 'Tab':
      return [...(nested('start') ? [conv(nested('start')!)] : []), ...(n.text?.label ? [text(`${n.id}:label`, 'Component Name', n.text.label)] : [])];
    case 'Stepper':
      return [{ id: `${n.id}:holder`, name: 'Step Holder', type: 'FRAME', children: [
        ...(nested('first') ? [conv(nested('first')!)] : []),
        slot(`${n.id}:steps`, 'Step Slot', kids('Step Slot')),
        ...(nested('last') ? [conv(nested('last')!)] : []),
      ] }];
    case 'Count Step':
    case 'No-Count Step':
      return [
        ...(n.text?.number ? [text(`${n.id}:number`, 'Component Name', n.text.number)] : []),
        ...(n.text?.label ? [text(`${n.id}:label`, 'Label', n.text.label, 'Dynamic-Label')] : []),
      ];
    case '.Breadcrumb-Segments':
      return [{ id: `${n.id}:link`, name: 'Hotlink', type: 'INSTANCE', component: 'Link', variant: { State: 'Default', Status: 'Default' }, children: [text(`${n.id}:label`, 'Hotlink', n.text?.label ?? '', 'Dynamic Body')] }];
    case 'Swatch':
      return [{ id: `${n.id}:color`, name: 'Color Swatch', type: 'FRAME', children: [] }, ...(n.text?.label ? [text(`${n.id}:label`, 'Label', n.text.label, 'Legal')] : [])];
    case 'IconBadge':
      return nested('icon') ? [conv(nested('icon')!)] : [];
    case 'AppBar':
      return nested('tabs') ? [{ id: `${n.id}:holder`, name: 'Tab Holder', type: 'FRAME', children: [conv(nested('tabs')!)] }] : [];
    case 'Footer':
      return [{ id: `${n.id}:frame`, name: 'Footer Frame', type: 'FRAME', children: [slot(`${n.id}:slot`, 'Slot', kids('Slot'))] }];
    default: return [];
  }
}

/** The Form-Label inside a field: its Type / Style from the nested part, the label text. */
function formLabel(n: InstanceNode, conv: (x: Node) => any): any {
  const part = n.nested?.find((x) => x.role === 'label')?.node;
  if (!part || !n.text?.label) return undefined;
  const fl = conv(part);
  fl.children = [{ id: `${n.id}:labelFrame`, name: 'label', type: 'FRAME', children: [text(`${n.id}:labelText`, 'Label', n.text.label, 'Dynamic-Label')] }];
  return fl;
}

/** Field parts are siblings in the IR's `nested` list; the plugin finds them inside one another. */
const PARENT_OF = new WeakMap<InstanceNode, InstanceNode>();
function parentNested(n: InstanceNode, role: string): InstanceNode | undefined {
  return PARENT_OF.get(n)?.nested?.find((x) => x.role === role)?.node;
}

/** The plugin's enriched-tree JSON for an IR subtree (see the file comment). */
export function irToFigmaNode(n: Node): any {
  const conv = (x: Node) => irToFigmaNode(x);
  const modes = n.modes ? { modes: n.modes } : {};
  switch (n.kind) {
    case 'frame':
    case 'placeholder': {
      const bound = boundSpacing(n.layout);
      if (n.kind === 'frame' && n.fill) bound.fills = n.fill.variable;
      return {
        id: n.id, name: n.name, type: 'FRAME',
        ...(n.kind === 'frame' && n.composite ? { component: n.composite } : {}),
        layout: frameNote(n.layout),
        ...modes, ...sizingKeys(n),
        ...(Object.keys(bound).length ? { boundVars: bound } : {}),
        fills: n.kind === 'frame' && n.fill ? [{ type: 'SOLID' }] : [],
        children: n.children.map(conv),
      };
    }
    case 'text':
      return { ...text(n.id, n.name, n.characters, n.textStyle, n.fill?.variable), ...sizingKeys(n) };
    case 'image':
      return { id: n.id, name: n.name, type: 'RECTANGLE', fills: [{ type: 'IMAGE' }], ...sizingKeys(n) };
    case 'instance': {
      for (const x of n.nested ?? []) PARENT_OF.set(x.node, n);
      const variant: Record<string, string> = { ...n.variant };
      for (const [k, v] of Object.entries(n.properties ?? {})) if (typeof v === 'boolean') variant[k] = String(v);
      return {
        id: n.id, name: n.name, type: 'INSTANCE', component: n.component.set, variant,
        ...modes, ...sizingKeys(n),
        ...(n.image ? { fills: [{ type: 'IMAGE' }] } : {}),
        children: instanceChildren(n, conv),
      };
    }
  }
}

/** The typography export a text style draws (for signatures of lossy text). */
export function exportForStyle(style: string): string | undefined {
  return TEXT_STYLE_TO_EXPORT[normalizeStyleName(style)];
}
