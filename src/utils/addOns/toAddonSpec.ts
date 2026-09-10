/**
 * ComponentDefinition → AddonSpec, the shape the Figma plugin builds from.
 *
 * The plugin's builder rebinds every { var: name } to the importing file's own
 * variable of that name, so what travels is names — never resolved values.
 * That is the whole reason an add-on can be authored once and land in each
 * customer's brand.
 *
 * The other direction already exists: the plugin can serialize a canvas
 * selection back to an AddonSpec. These are not inverses and should not be
 * confused — this compiler is AUTHORING, the serializer is VERIFICATION.
 * Build from a definition, let a designer adjust, serialize back, diff. That
 * is how you find out the generator emitted a raw gap where the design wants
 * a token.
 */
import type { ComponentDefinition, NodeDef, Sizing, TokenRef } from './defineComponent';

/** The plugin's NumberOrVar / ColorOrVar shape. */
type VarRef = { var: string };
const ref = (t: TokenRef): VarRef => ({ var: t.token });

const JUSTIFY: Record<string, string> = {
  start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN',
};
const ALIGN: Record<string, string> = { start: 'MIN', center: 'CENTER', end: 'MAX' };

/** Figma expresses sizing on two axes at once — the layout mode decides which
 *  of primaryAxis/counterAxis a given side is, so this maps per axis rather
 *  than per property. */
function sizingFields(node: NodeDef, axis: 'H' | 'V'): Record<string, unknown> {
  const s: Sizing | undefined = axis === 'H' ? node.width : node.height;
  if (!s) return {};
  const key = axis === 'H' ? 'layoutSizingHorizontal' : 'layoutSizingVertical';
  if (s === 'hug') return { [key]: 'HUG' };
  if (s === 'fill') return { [key]: 'FILL' };
  // A fixed size is still a TOKEN, so it stays a binding rather than a number.
  return { [key]: 'FIXED', [axis === 'H' ? 'width' : 'height']: ref(s.fixed) };
}

function nodeToSpec(node: NodeDef): Record<string, unknown> {
  const spec: Record<string, unknown> = { name: node.name, type: 'FRAME' };

  if (node.kind === 'text') {
    spec.type = 'TEXT';
    if (node.text) spec.characters = node.text;
  }

  /* A slot is an empty auto-layout frame: somewhere a designer drops content,
     and the counterpart of `children` in React. It still needs a layout mode
     or Figma will not size it. */
  if (node.kind !== 'text') {
    spec.layoutMode = (node.direction || 'row') === 'row' ? 'HORIZONTAL' : 'VERTICAL';
    if (node.justify) spec.primaryAxisAlignItems = JUSTIFY[node.justify];
    if (node.align) spec.counterAxisAlignItems = ALIGN[node.align];
    if (node.gap) spec.itemSpacing = ref(node.gap);
    if (node.padding) {
      if (node.padding.top) spec.paddingTop = ref(node.padding.top);
      if (node.padding.right) spec.paddingRight = ref(node.padding.right);
      if (node.padding.bottom) spec.paddingBottom = ref(node.padding.bottom);
      if (node.padding.left) spec.paddingLeft = ref(node.padding.left);
    }
  }

  Object.assign(spec, sizingFields(node, 'H'), sizingFields(node, 'V'));
  if (node.radius) spec.cornerRadius = ref(node.radius);

  /* Surface is a LEVEL, and on this target it names the variable group the
     fill comes from — Surface/Background, Surface-Dim/Background. The CSS
     compiler will put the same level on a data-surface attribute instead and
     use a bare var(--Background); that divergence is expected and is why the
     definition stores the level rather than a paint. */
  if (node.surface) {
    spec.fills = [{ type: 'SOLID', color: { var: `${node.surface}/Background` } }];
  }

  /* A theme is a MODE, not a name inside a variable's path — so it pins the
     Theme collection for this subtree rather than changing which variable is
     read. Every token below it then resolves against that palette, which is
     what makes one nav definition work on a Primary bar and a Neutral one
     without naming a single colour differently. */
  if (node.theme) {
    spec.explicitModes = { ...(spec.explicitModes as Record<string, string> | undefined), Theme: node.theme };
  }

  /* Conditional presence binds `visible` to the boolean rather than setting
     it. Setting it would bake whichever state the author had active — the
     exact snapshot problem that loses two thirds of a responsive design. */
  if (node.presence && node.presence !== 'always') {
    spec.visibleWhen = node.presence.when;
  }

  /* Overlay leaves the auto-layout flow. The constraints are what keep it
     pinned to the chosen corner when the parent resizes — without them Figma
     holds the absolute offset it happened to be created at, so the content
     drifts off a wider hero. */
  if (node.overlay) {
    const [v, h] = node.overlay.anchor.split('-') as ['top' | 'bottom', 'left' | 'right'];
    spec.layoutPositioning = 'ABSOLUTE';
    spec.constraints = {
      horizontal: h === 'left' ? 'MIN' : 'MAX',
      vertical: v === 'top' ? 'MIN' : 'MAX',
    };
  }

  if (node.children && node.children.length) {
    spec.children = node.children.map(nodeToSpec);
  }
  return spec;
}

/** What a breakpoint means, for the plugin to map onto a Device-Sizes mode. */
export interface SpecBreakpoint {
  id: string;
  label: string;
  minWidth: number;
  maxWidth?: number;
  align?: 'left' | 'center';
}

export interface SpecResponsive {
  breakpoints: SpecBreakpoint[];
  /** condition name → breakpoint id → true there. */
  matrix: Record<string, Record<string, boolean>>;
}

/**
 * The spec, optionally carrying the responsive table.
 *
 * WITHOUT IT the spec says a layer's visibility is BOUND to a variable and
 * nothing says what that variable holds at each width. The import then creates
 * the binding and leaves every mode at whatever the file already had — so a
 * nav designed to hide its search at xs and show it at md arrives with neither
 * decision recorded, looking correct because the binding is there.
 *
 * The plugin needs both halves: the breakpoints to match against Device-Sizes
 * modes by width, and the matrix to write each boolean per mode.
 *
 * Scroll-triggered conditions are in the table too, at false everywhere. That
 * is not a gap — no width makes them true, and omitting them would leave those
 * variables unwritten and looking like an oversight rather than a decision.
 */
export function toAddonSpec(
  def: ComponentDefinition,
  responsive?: SpecResponsive,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: def.id,
    label: def.label,
    schemaVersion: def.schemaVersion,
    root: nodeToSpec(def.root),
  };

  if (responsive) {
    /* Only the conditions this arrangement actually gates on. Publishing a
       value for a condition nothing binds to would tell the plugin to write a
       variable the component never reads. */
    const used = new Set(conditionsUsedBy(def));
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const [name, byBp] of Object.entries(responsive.matrix)) {
      if (used.has(name)) matrix[name] = { ...byBp };
    }
    out.responsive = { breakpoints: responsive.breakpoints, matrix };
  }
  return out;
}

/** Every token a definition references, so the set can be checked against a
 *  real design system before publishing. An add-on that names a variable the
 *  customer does not have imports with that field silently unbound. */
export function tokensUsed(def: ComponentDefinition): string[] {
  const out = new Set<string>();
  const walk = (n: NodeDef) => {
    if (n.gap) out.add(n.gap.token);
    if (n.radius) out.add(n.radius.token);
    for (const k of ['top', 'right', 'bottom', 'left'] as const) {
      const p = n.padding && n.padding[k];
      if (p) out.add(p.token);
    }
    for (const s of [n.width, n.height]) {
      if (s && typeof s === 'object') out.add(s.fixed.token);
    }
    if (n.surface) out.add(`${n.surface}/Background`);
    (n.children || []).forEach(walk);
  };
  walk(def.root);
  /* Conditions are tokens too — boolean variables the file must have. They
     were omitted here, so a definition could pass a pre-publish token check
     and still import with its conditional parts unbound.
     
     Only the ones this definition actually REFERENCES, not everything
     declared: a layout with no rail does not need Show-Rail, and asking a
     design system for a variable nothing binds to is a false requirement. */
  for (const name of conditionsUsedBy(def)) out.add(name);
  return [...out].sort();
}

/**
 * The conditions a definition actually gates something on.
 *
 * `conditions` on the definition is the DECLARED set — every boolean the
 * component could read, which is documentation. What a given arrangement uses
 * is a subset, and the difference matters twice over: a switch for a condition
 * that gates nothing does nothing, and if it reads as ON it says a part exists
 * when it does not.
 */
export function conditionsUsedBy(def: ComponentDefinition): string[] {
  const out = new Set<string>();
  const walk = (n: NodeDef) => {
    if (n.presence && n.presence !== 'always') out.add(n.presence.when);
    (n.children || []).forEach(walk);
  };
  walk(def.root);
  return [...out].sort();
}
