// moreMappers.ts — Figma → code for the sets added in code → Figma phase 4
// (2026-11-06): Rating, Link, Input Field, NumberField, SelectField, Tabs,
// Stepper, Breadcrumbs, Swatch, IconBadge, Thumbnail Selector, AppBar, Footer.
//
// Every variant read goes through VARIANT_TABLES (propTables.ts) — the same
// rows code → Figma reads backwards (src/utils/code2figma/mapper.ts). Props
// whose name starts with `$` are derived facts (a star's fill, a step's
// status) the mapper turns into the real prop itself; they are never emitted.
//
// What Figma does not carry (a link's href, a swatch's literal color, a
// thumbnail's image URL, a select's options) is emitted as the neutral value
// and NOTED, never guessed.

import type { IRNode } from './ir';
import { el, json, n as num, str, text, yes, type JsonValue, type JsxElement, type JsxNode, type PropValue } from './jsx';
import {
  COLORS, applyVariantTable, componentSize, findAll, firstText, isMeaningfulName, isTrue, mapIcon, normalizeStyleName,
  stripDefaults, typographyExport, variantOf, withStyle, type MapCtx,
} from './propTables';

const comp = (x: IRNode) => (x.component ?? '').trim();
const instancesOf = (n: IRNode, name: string) => findAll(n, (x) => comp(x) === name);
const textIn = (x: IRNode | undefined) => (x ? firstText(x)?.text?.content.trim() : undefined);
/** The first TEXT layer of this name inside `n`. */
const namedText = (n: IRNode, name: string) => findAll(n, (x) => x.type === 'TEXT' && x.name === name && !!x.text?.content.trim())[0]?.text?.content.trim();

/** applyVariantTable, with derived (`$`) props split off and unmapped keys noted. */
function table(name: string, n: IRNode | undefined, ctx: MapCtx, consumed: string[] = []): { props: Array<[string, PropValue]>; derived: Record<string, string | number | true> } {
  if (!n) return { props: [], derived: {} };
  const mapped = applyVariantTable(name, n.props);
  const skip = new Set(consumed.map((c) => c.toLowerCase()));
  for (const u of mapped.unmapped) if (!skip.has(u.split('=')[0].trim().toLowerCase())) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [];
  const derived: Record<string, string | number | true> = {};
  for (const [k, v] of mapped.props) {
    if (k.startsWith('$')) derived[k] = v.kind === 'string' ? v.value : v.kind === 'number' ? v.value : true;
    else props.push([k, v]);
  }
  return { props, derived };
}

function iconsColor(n: IRNode, ctx: MapCtx): string | undefined {
  const m = ctx.mode(n, 'Icons')?.trim().toLowerCase();
  return m && (COLORS as readonly string[]).includes(m) ? m : undefined;
}

const box = (n: IRNode, ctx: MapCtx) => ctx.layoutStyle(n, { box: false });
/** Horizontal FILL is the field's fullWidth (rule 4f-3b, as for Button); in a row the parent's flexGrow rides along. */
const fullWidth = (n: IRNode, _ctx: MapCtx) => n.sizing?.h === 'FILL';

// ── Rating / RatingField ────────────────────────────────────────────────────

export function mapRating(n: IRNode, ctx: MapCtx): JsxNode {
  const field = comp(n) === 'RatingField' ? n : undefined;
  const rating = field ? instancesOf(n, 'Rating')[0] : n;
  if (!rating) return ctx.fallback(n, 'RatingField without a Rating inside');
  const { derived } = table('Rating', rating, ctx);
  const stars = instancesOf(rating, 'Star');
  let value = 0;
  let half = false;
  let disabled = false;
  for (const s of stars) {
    const t = table('Star', s, ctx);
    if (t.derived.$fill === 'full') value += 1;
    if (t.derived.$fill === 'half') { value += 0.5; half = true; }
    if (t.props.some(([k]) => k === 'disabled')) disabled = true;
  }
  if (stars.length !== 5 && !derived.$empty) ctx.note(n, `rating draws ${stars.length} stars — the lib always draws five`);
  const props: Array<[string, PropValue]> = [];
  if (!derived.$empty && value > 0) props.push(['defaultValue', num(value)]);
  if (half) props.push(['precision', num(0.5)]);
  if (disabled) props.push(['disabled', yes]);
  props.push(['size', str(componentSize(rating, ctx))]);
  const color = iconsColor(rating, ctx);
  if (color) props.push(['color', str(color)]);
  if (field) {
    const f = table('RatingField', field, ctx);
    const label = textIn(instancesOf(field, 'Form-Label')[0]);
    if (variantOf(field, 'Label') !== 'none' && label) props.push(['label', str(label)]);
    props.push(...f.props);
  }
  return el('Rating', withStyle(stripDefaults('Rating', props), box(n, ctx)));
}

// ── Link ────────────────────────────────────────────────────────────────────

export function mapLink(n: IRNode, ctx: MapCtx): JsxNode {
  const t = firstText(n);
  const label = t?.text?.content.trim();
  if (!t || !label) return ctx.fallback(n, 'link without text');
  const { props } = table('Link', n, ctx);
  const style = t.text?.style;
  /* The Hotlink layer is Body-Medium; another style is the textStyle prop.
     "Dynamic Body" (the Breadcrumb segment's) is the body style too. */
  if (style && typographyExport(style) && typographyExport(style) !== 'Body') props.push(['textStyle', str(normalizeStyleName(style))]);
  props.push(['href', str('#')]);
  ctx.note(n, 'link target is not in the design — set href');
  return el('Link', withStyle(stripDefaults('Link', props), box(n, ctx)), [text(label)]);
}

// ── Input Field (TextInput), NumberField, SelectField ───────────────────────

function fieldLabel(n: IRNode, ctx: MapCtx, props: Array<[string, PropValue]>, typeProp: string): string | undefined {
  const fl = instancesOf(n, 'Form-Label')[0];
  if (!fl) return undefined;
  const t = table('Form-Label', fl, ctx);
  if (t.derived.$moreInfo) ctx.note(fl, 'More Info: the link it opens is not in the design — set moreInfo');
  for (const [k, v] of t.props) {
    const key = k === 'labelType' ? typeProp : k;
    if (!props.some(([x]) => x === key)) props.push([key, v]);
  }
  return textIn(fl);
}

export function mapInputField(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('TextInput', n, ctx);
  const labelAxis = variantOf(n, 'Label');
  const label = fieldLabel(n, ctx, props, 'labelType');
  if (labelAxis !== 'none' && label) props.push(['label', str(label)]);
  else if (labelAxis === 'none') ctx.note(n, 'field has no visible label — give it one or an aria-label');
  const input = instancesOf(n, 'Input')[0];
  const it = table('Input', input, ctx, ['start icon', 'end decorator']);
  for (const p of it.props) if (!props.some(([k]) => k === p[0])) props.push(p);
  if (it.derived.$validation) props.push(['validation', str('error')]);
  const content = instancesOf(n, 'InputContent')[0];
  const ct = table('InputContent', content, ctx, ['prefix', 'suffix', 'swatch label']);
  const shown = content ? namedText(content, 'Component Name') : undefined;
  if (ct.derived.$content === 'value' && shown) props.push(['defaultValue', str(shown)]);
  if (ct.derived.$content === 'placeholder' && shown) props.push(['placeholder', str(shown)]);
  props.push(['size', str(componentSize(n, ctx))]);
  if (fullWidth(n, ctx)) props.push(['fullWidth', yes]);
  return el('TextInput', withStyle(stripDefaults('TextInput', props), box(n, ctx)));
}

export function mapNumberField(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('NumberField', n, ctx, ['helper text']);
  const label = fieldLabel(n, ctx, props, 'type');
  if (label) props.push(['label', str(label)]);
  else if (variantOf(n, 'Label') === 'none' && isMeaningfulName(n.name, n.component)) props.push(['label', str(n.name.trim())]);
  const number = instancesOf(n, 'Number')[0];
  const nt = table('Number', number, ctx);
  const type = String(nt.derived.$type ?? 'outline');
  if (/spinner/.test(type)) props.push(['variant', str('spinner')]);
  if (/floating/.test(type) && !props.some(([k]) => k === 'labelPosition')) props.push(['labelPosition', str('floating')]);
  const shown = number ? textIn(number) : undefined;
  if (shown && /^-?\d+(\.\d+)?$/.test(shown)) props.push(['defaultValue', num(Number(shown))]);
  if (isTrue(variantOf(n, 'Helper Text'))) {
    const helper = textIn(instancesOf(n, 'Form-Helper')[0]);
    if (helper) props.push(['helperText', str(helper)]);
  }
  props.push(['size', str(componentSize(n, ctx))]);
  if (fullWidth(n, ctx)) props.push(['fullWidth', yes]);
  return el('NumberField', withStyle(stripDefaults('NumberField', props), box(n, ctx)));
}

export function mapSelectField(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('Select', n, ctx);
  const label = fieldLabel(n, ctx, props, '$type');
  const lt = props.findIndex(([k]) => k === '$type');
  if (lt >= 0) { ctx.note(n, 'Select has no required / optional marker'); props.splice(lt, 1); }
  if (label && variantOf(n, 'Label') !== 'none') props.push(['label', str(label)]);
  const trigger = instancesOf(n, 'Select')[0];
  for (const p of table('SelectTrigger', trigger, ctx).props) if (!props.some(([k]) => k === p[0])) props.push(p);
  const content = instancesOf(n, 'InputContent')[0];
  const ct = table('InputContent', content, ctx, ['prefix', 'suffix', 'swatch label']);
  const shown = content ? namedText(content, 'Component Name') : undefined;
  const options: JsonValue[] = [];
  if (ct.derived.$content === 'value' && shown) { options.push({ value: shown, label: shown }); props.push(['defaultValue', str(shown)]); }
  if (ct.derived.$content === 'placeholder' && shown && shown !== 'Select…') props.push(['placeholder', str(shown)]);
  props.push(['options', json(options)]);
  ctx.note(n, 'select options are not in the design — fill options');
  props.push(['size', str(componentSize(n, ctx))]);
  if (fullWidth(n, ctx)) props.push(['fullWidth', yes]);
  return el('Select', withStyle(stripDefaults('Select', props), box(n, ctx)));
}

// ── Tabs ────────────────────────────────────────────────────────────────────

const TAB_CONSUMED = ['start avatar', 'start icon', 'end icon', 'end avatar', 'text'];

export function mapTabs(n: IRNode, ctx: MapCtx): JsxNode {
  const { props, derived } = table('Tabs', n, ctx);
  if (derived.$noBaseline) props.push(['baseline', json(false)]);
  const tabs = instancesOf(n, 'Tab');
  if (!tabs.length) return ctx.fallback(n, 'Tabs without Tab instances');
  let selected = 0;
  const items: JsxNode[] = tabs.map((t, i) => {
    const tt = table('Tab', t, ctx, TAB_CONSUMED);
    if (tt.derived.$selected) selected = i;
    const tp: Array<[string, PropValue]> = tt.props.filter(([k]) => k === 'disabled');
    if (isTrue(variantOf(t, 'Start Icon'))) {
      const icon = findAll(t, (x) => comp(x) === 'Icon')[0];
      if (icon) tp.push(['startDecorator', { kind: 'node', value: mapIcon(icon, ctx) }]);
    }
    if (isTrue(variantOf(t, 'Start Avatar')) || isTrue(variantOf(t, 'End Avatar')) || isTrue(variantOf(t, 'End Icon'))) ctx.note(t, 'tab avatar / end icon not mapped');
    const label = namedText(t, 'Component Name') ?? textIn(t) ?? '';
    return el('Tab', tp, label ? [text(label)] : []);
  });
  if (selected > 0) props.push(['defaultValue', num(selected)]);
  return el('Tabs', withStyle(stripDefaults('Tabs', props), box(n, ctx)), [el('TabList', [], items)]);
}

// ── Stepper ─────────────────────────────────────────────────────────────────

export function mapStepper(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('Stepper', n, ctx);
  const steps = findAll(n, (x) => comp(x) === 'Count Step' || comp(x) === 'No-Count Step');
  if (!steps.length) return ctx.fallback(n, 'Stepper without steps');
  let current = -1;
  let complete = 0;
  const items = steps.map((s, i) => {
    const st = table(comp(s), s, ctx, ['bottom label', 'right label', 'icon', 'number', 'label']);
    if (st.derived.$status === 'current' && current < 0) current = i;
    if (st.derived.$status === 'complete') complete += 1;
    const label = namedText(s, 'Label');
    const sp: Array<[string, PropValue]> = [];
    if (label) sp.push(['label', str(label)]);
    if (st.props.some(([k]) => k === 'disabled')) sp.push(['disabled', yes]);
    return el('Step', sp);
  });
  const active = current >= 0 ? current : complete;
  if (active > 0) props.push(['activeStep', num(active)]);
  if (comp(steps[0]) === 'No-Count Step' && !props.some(([k]) => k === 'variant')) props.push(['variant', str('noCount')]);
  props.push(['size', str(componentSize(n, ctx))]);
  return el('Stepper', withStyle(stripDefaults('Stepper', props.filter(([k, v]) => !(k === 'size' && v.kind === 'string' && v.value === 'medium'))), box(n, ctx)), items);
}

// ── Breadcrumbs (the set, or a frame built from its segments) ───────────────

export function mapBreadcrumbs(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('Breadcrumbs', n, ctx);
  const segs = instancesOf(n, '.Breadcrumb-Segments');
  if (!segs.length) return ctx.fallback(n, 'Breadcrumbs without segments');
  const sep = instancesOf(n, '.Breadcrumbs-separator')[0];
  if (sep) {
    const s = table('.Breadcrumbs-separator', sep, ctx);
    if (s.derived.$customSeparator) ctx.note(sep, 'custom-icon separator: pass the icon as separator');
    props.push(...s.props);
  }
  const items = segs.map((s) => {
    const t = table('.Breadcrumb-Segments', s, ctx);
    const label = textIn(s) ?? '';
    return el('BreadcrumbItem', t.derived.$current ? [] : [['href', str('#')]], [text(label)]);
  });
  if (segs.length > 1) ctx.note(n, 'crumb targets are not in the design — set each href');
  return el('Breadcrumbs', withStyle(stripDefaults('Breadcrumbs', props), box(n, ctx)), items);
}

// ── Swatch ──────────────────────────────────────────────────────────────────

export function mapSwatch(n: IRNode, ctx: MapCtx): JsxNode {
  const { props, derived } = table('Swatch', n, ctx);
  const label = derived.$noLabel ? undefined : namedText(n, 'Label');
  if (label) props.push(['label', str(label)]);
  if (variantOf(n, 'State') && variantOf(n, 'State') !== 'Non-clickable') ctx.note(n, 'clickable swatch — add onClick');
  ctx.note(n, 'swatch color is a literal fill, not carried in the design IR — set color');
  props.push(['size', str(componentSize(n, ctx))]);
  return el('Swatch', withStyle(stripDefaults('Swatch', props), box(n, ctx)));
}

// ── IconBadge ───────────────────────────────────────────────────────────────

export function mapIconBadge(n: IRNode, ctx: MapCtx): JsxNode {
  const { derived } = table('IconBadge', n, ctx);
  if (derived.$shape) ctx.note(n, 'shaped tile: which IconShape is not in the variant — shape not emitted');
  const props: Array<[string, PropValue]> = [];
  props.push(['color', str(iconsColor(n, ctx) ?? 'primary')]);
  props.push(['size', str(componentSize(n, ctx))]);
  const icon = findAll(n, (x) => comp(x) === 'Icon')[0];
  const mapped = icon ? mapIcon(icon, ctx) : ctx.fallback(n, 'IconBadge without an icon');
  const glyph = mapped.kind === 'element' && mapped.tag === 'Icon' ? mapped.children[0] : mapped;
  return el('IconBadge', withStyle(stripDefaults('IconBadge', props), box(n, ctx)), glyph ? [glyph] : []);
}

// ── ThumbnailSelector ───────────────────────────────────────────────────────

export function mapThumbnailSelector(n: IRNode, ctx: MapCtx): JsxNode {
  const thumbs = instancesOf(n, 'Thumbnail');
  if (!thumbs.length) return ctx.fallback(n, 'Thumbnail Selector without Thumbnail instances');
  const { props } = table('Thumbnail Selector', n.props ? n : undefined, ctx);
  if (!n.props && n.layout?.direction === 'column') props.push(['orientation', str('vertical')]);
  let selected = 0;
  const sizes = new Set<string>();
  const items: JsonValue[] = thumbs.map((t, i) => {
    const tt = table('Thumbnail', t, ctx);
    if (tt.derived.$selected) selected = i;
    const size = tt.props.find(([k]) => k === 'size');
    sizes.add(size && size[1].kind === 'string' ? size[1].value : 'medium');
    const item: Record<string, JsonValue> = { src: '', alt: isMeaningfulName(t.name, 'Thumbnail') ? t.name.trim() : '' };
    if (tt.props.some(([k]) => k === 'disabled')) item.disabled = true;
    return item;
  });
  if (sizes.size > 1) ctx.note(n, `thumbnails in ${sizes.size} sizes — the first one's is used`);
  const first = [...sizes][0];
  if (first !== 'medium') props.push(['size', str(first)]);
  if (selected > 0) props.push(['defaultValue', num(selected)]);
  props.push(['items', json(items)]);
  let label = isMeaningfulName(n.name, n.component) && n.name.trim() !== 'Thumbnail Selector' ? n.name.trim() : undefined;
  if (!label) { label = 'Product images'; ctx.derived('"Product images" on ThumbnailSelector — default suggestion, the layer name says nothing'); }
  props.push(['aria-label', str(label)]);
  ctx.note(n, 'thumbnail image URLs are not in the design — set each item\'s src');
  return el('ThumbnailSelector', withStyle(stripDefaults('ThumbnailSelector', props), box(n, ctx)));
}

// ── AppBar / Footer ─────────────────────────────────────────────────────────

export function mapAppBar(n: IRNode, ctx: MapCtx): JsxNode {
  const { props } = table('AppBar', n, ctx);
  const labels = instancesOf(n, 'Tab').map((t) => namedText(t, 'Component Name') ?? textIn(t) ?? '').filter(Boolean);
  if (labels.length) props.push(['navLinks', json(labels.map((label) => ({ label, href: '#' })))]);
  ctx.note(n, 'app bar: brand, link targets and right-side actions are not in the design — set brand, navLinks hrefs, endSlot');
  return el('AppBar', withStyle(props, box(n, ctx)));
}

export function mapFooter(n: IRNode, ctx: MapCtx): JsxNode {
  const { derived } = table('Footer', n, ctx);
  const props: Array<[string, PropValue]> = [];
  const slot = findAll(n, (x) => x.name === 'Slot')[0];
  const columns: JsonValue[] = [];
  for (const c of slot?.children ?? []) {
    const links = instancesOf(c, 'Link');
    if (!links.length) continue;
    const title = findAll(c, (x) => x.type === 'TEXT' && typographyExport(x.text?.style) === 'H4')[0]?.text?.content.trim();
    columns.push({ ...(title ? { title } : {}), links: links.map((l) => ({ label: textIn(l) ?? '', href: '#' })) });
  }
  if (columns.length) props.push(['columns', json(columns)]);
  if (derived.$noCopyright) props.push(['copyright', json(false)]);
  ctx.note(n, 'footer: brand, link targets and the subscribe handler are not in the design');
  return el('Footer', withStyle(props, box(n, ctx)));
}

export type { JsxElement };
