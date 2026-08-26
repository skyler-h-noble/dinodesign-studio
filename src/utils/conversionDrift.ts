/**
 * Drift — what the generated code does that the Figma frame does not say.
 *
 * The workbench already shows the code and a live preview side by side, which
 * catches drift you can SEE. It does not catch drift you cannot: a hardcoded
 * hex renders identically to the token it should have used, a dropped variant
 * gives you the default which looks plausible, and a hidden row that got
 * rendered anyway just looks like a row.
 *
 * Every check here is deterministic — it compares the frame JSON against the
 * emitted JSX and reports facts. No second model call, so the answer does not
 * drift on its own, and running it is free.
 *
 * These are SIGNALS, not verdicts. A finding can be legitimate: text is often
 * bound to a prop rather than inlined, and a designer's layer name need not
 * survive into code. The point is to put the differences in front of a person
 * quickly, so corrections feed back into the CLAUDE.md.
 */

export type DriftSeverity = 'error' | 'warning' | 'info';

export interface DriftFinding {
  severity: DriftSeverity;
  /** Short machine-ish label, e.g. "hardcoded-color". */
  kind: string;
  /** One line a human can act on. */
  message: string;
  /** The offending value, where there is one. */
  detail?: string;
  /**
   * The layer this came from, as a path — "List Item > Divider".
   *
   * Without it a finding like `Orientation = Vertical` is unactionable when a
   * frame has five Dividers, and tracking one down meant digging through the
   * cached frame JSON by hand.
   */
  where?: string;
}

interface FigmaNodeish {
  name?: string;
  type?: string;
  visible?: boolean;
  characters?: string;
  children?: FigmaNodeish[];
  componentProperties?: Record<string, { value?: unknown; type?: string }>;
}

/** A node plus where it sits, so a finding can say which layer it came from. */
interface Located { node: FigmaNodeish; where: string }

/** Walk every node, including invisible ones — their absence is the point. */
function walk(
  node: FigmaNodeish | null | undefined,
  trail: string[] = [],
  out: Located[] = [],
  depth = 0,
): Located[] {
  if (!node || typeof node !== 'object') return out;
  const name = (node.name ?? node.type ?? '').trim();
  // `trail` holds ancestor names EXCLUDING the root: every path would otherwise
  // begin with the frame's own name, which locates nothing.
  const where = depth === 0 ? '' : [...trail, name].join(' > ');
  out.push({ node, where });
  const childTrail = depth === 0 ? [] : [...trail, name];
  for (const child of node.children ?? []) walk(child, childTrail, out, depth + 1);
  return out;
}

/** Last two crumbs — enough to locate a layer without printing the whole tree. */
function shortPath(where: string): string {
  const parts = where.split(' > ').filter(Boolean);
  return parts.slice(-2).join(' > ');
}

/**
 * Find the frame inside whatever shape the caller has.
 *
 * The REST response is `{ nodes: { "1:2": { document: {...} } } }`, but callers
 * variously hold the envelope, the entry, or the document. Accepting all three
 * beats making every call site remember which.
 */
function rootOf(frameJson: unknown): FigmaNodeish | null {
  if (!frameJson || typeof frameJson !== 'object') return null;
  const obj = frameJson as Record<string, any>;
  if (obj.document) return obj.document as FigmaNodeish;
  if (obj.nodes && typeof obj.nodes === 'object') {
    const first = Object.values(obj.nodes)[0] as Record<string, any> | undefined;
    if (first?.document) return first.document as FigmaNodeish;
  }
  if (obj.name || obj.type || obj.children) return obj as FigmaNodeish;
  return null;
}

/** Strip strings and comments so literals inside them are not mistaken for code. */
function codeWithoutStrings(jsx: string): string {
  return jsx
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const HEX = /#[0-9a-f]{3,8}\b/gi;
const RGB_HSL = /\b(?:rgba?|hsla?)\s*\([^)]*\)/gi;

/**
 * Compare a Figma frame against the JSX generated from it.
 *
 * Ordered most to least actionable: a hardcoded colour is always wrong, a
 * missing component is usually wrong, a missing string is often fine.
 */
/* Values that mean "the default", beyond the literal word.
   Each of these is a real variant value from the OmniDesign library whose
   behaviour is what you get by passing nothing: a Divider is horizontal, a List
   is vertical and non-clickable, an Avatar shows a photo, a Button is solid, an
   Icon is filled. "text" is the Button TYPE meaning an ordinary labelled button
   — the shape axis calls its borderless style "ghost", so this never collides. */
const DEFAULTISH =
  /^(default|none|false|off|horizontal|vertical|solid|filled|photo|text|(non[-\s]?clickable)(\s+list)?)$/i;

/* Subtrees the library owns. */
const LIB_INTERNAL = [
  'Image Placeholder', 'Ratio Holder', 'Ratio Slot',
  'Button-Container', 'Button-Fill', 'Button-Contents', 'Typography Holder',
  'Focus-Visible',
];
const isLibInternal = (where: string) =>
  LIB_INTERNAL.some((seg) => where.includes(seg)) ||
  // A ListItem's own row rule, drawn from `bottomBorder`.
  /List Item\s*>\s*Divider/i.test(where);

/* Figma stores typographic punctuation; a code editor usually does not.
   "Let's Do It!" in the design and "Let's Do It!" in the code are the same
   string to a reader and different to includes(), so the text check reported
   a heading that was plainly present. */
const HTML_ENTITY: Record<string, string> = {
  '&apos;': "'", '&#39;': "'", '&lsquo;': "'", '&rsquo;': "'",
  '&quot;': '"', '&ldquo;': '"', '&rdquo;': '"',
  '&amp;': '&', '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&hellip;': '...',
};

const normaliseText = (t: string) =>
  /* JSX escapes an apostrophe rather than sit under
     react/no-unescaped-entities, so "Let's Do It!" is written Let&apos;s and no
     amount of quote-shape normalising will match it against the design's
     Let’s. Decode first, then normalise shape. */
  Object.entries(HTML_ENTITY)
    .reduce((acc, [ent, ch]) => acc.split(ent).join(ch), t)
    .replace(/[\u2018\u2019\u201B]/g, "'")
   .replace(/[\u201C\u201D]/g, '"')
   .replace(/[\u2013\u2014]/g, '-')
   .replace(/\u2026/g, '...')
   .replace(/\s+/g, ' ')
   .trim();

export function computeDrift(frameJson: unknown, jsx: string): DriftFinding[] {
  const findings: DriftFinding[] = [];
  if (!jsx.trim()) return findings;

  const code = codeWithoutStrings(jsx);
  const root = rootOf(frameJson);
  const located = root ? walk(root) : [];
  const visible = located.filter(l => l.node.visible !== false);
  const hidden = located.filter(l => l.node.visible === false);

  // ── Hardcoded colour ────────────────────────────────────────────────────
  // The rule the generated code most often breaks, and the one that is
  // invisible in a preview: #3794ff and var(--Focus-Visible) render the same
  // until the theme changes.
  const colours = new Set<string>();
  for (const m of code.matchAll(HEX)) colours.add(m[0]);
  for (const m of code.matchAll(RGB_HSL)) colours.add(m[0]);
  for (const c of colours) {
    findings.push({
      severity: 'error',
      kind: 'hardcoded-color',
      message: 'Hardcoded colour — should be a token.',
      detail: c,
    });
  }

  // ── Hidden nodes that got rendered ──────────────────────────────────────
  // visible:false means the designer turned it off. Rendering it anyway just
  // looks like an extra row, which is why it survived so long.
  for (const { node, where } of hidden) {
    const name = (node.name ?? '').trim();
    // The CONTENT is the tell, not the layer name. A hidden second row leaks as
    // its text — "Second row" — while the layer is called "Row 2", so checking
    // the name alone finds nothing and the row still renders.
    const chars = (node.characters ?? '').trim();
    const asTag = name.replace(/[^A-Za-z0-9]/g, '');

    const leakedText = chars.length >= 3 && jsx.includes(chars);
    const leakedName = name.length >= 3
      && (code.includes(name) || (asTag ? new RegExp(`<${asTag}\\b`).test(code) : false));

    if (leakedText || leakedName) {
      findings.push({
        severity: 'error',
        kind: 'hidden-rendered',
        message: 'Hidden in Figma but present in the code.',
        detail: leakedText ? `"${chars}"` : name,
        where: shortPath(where) || name,
      });
    }
  }

  // ── Variant properties that did not become props ────────────────────────
  // Dropping a variant gives you the component's default, which looks nearly
  // right — the worst kind of wrong.
  const seenVariants = new Set<string>();
  for (const { node, where } of visible) {
    const owner = (node.name ?? '').trim();
    for (const [prop, spec] of Object.entries(node.componentProperties ?? {})) {
      const value = spec?.value;
      if (typeof value !== 'string' || !value.trim()) continue;
      // Figma names variant props like "Size" or "Appearance#123:4".
      const cleanProp = prop.split('#')[0].trim();
      const key = `${owner}|${cleanProp}=${value}`;
      if (seenVariants.has(key)) continue;
      seenVariants.add(key);
      /* Default-ish values are not worth reporting when absent.
         A variant set to its own default is the component's behaviour with no
         prop at all, so the code omitting it is CORRECT — reporting it turns a
         right answer into a warning. Eleven of the twelve findings on one frame
         were this, which is how a drift report stops being read. */
      if (DEFAULTISH.test(value)) continue;
      /* Variants inside a component the LIBRARY renders for itself.
         A Ratio draws its own Image Placeholder and the icon within it; a
         ListItem draws its own Divider from `bottomBorder`. Their variants are
         the lib's internals, not choices the generated code can express, so
         asking for them is asking for a prop that does not exist. */
      if (isLibInternal(where)) continue;
      if (!new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(code)) {
        findings.push({
          severity: 'warning',
          kind: 'variant-dropped',
          message: `${owner || 'Instance'}: variant "${cleanProp}" is set in Figma but its value is not in the code.`,
          detail: `${cleanProp} = ${value}`,
          where: shortPath(where) || owner,
        });
      }
    }
  }

  // ── Text present in the frame but not in the code ───────────────────────
  const strings = new Map<string, string>();
  for (const { node, where } of visible) {
    const chars = (node.characters ?? '').trim();
    // Very short strings produce noise — a "1" or "OK" matches accidentally.
    if (chars.length < 3) continue;
    if (!strings.has(chars)) strings.set(chars, where);
  }
  const normalisedJsx = normaliseText(jsx);
  for (const [text, where] of strings) {
    if (!normalisedJsx.includes(normaliseText(text))) {
      findings.push({
        severity: 'warning',
        kind: 'text-missing',
        message: 'Text in the frame does not appear in the code.',
        detail: text.length > 60 ? `${text.slice(0, 60)}…` : text,
        where: shortPath(where),
      });
    }
  }

  /* ── A visible slot whose decorator never made it into the code ──────────
   *
   * Hidden slots are pruned before the model sees them, so a Start/End Slot
   * still in the tree is one the design shows AND has content in. It has to
   * become startIcon / endIcon / startDecorator / endDecorator.
   *
   * Dropping one is quiet in a way the other checks miss: the component still
   * renders, still carries its label, still looks like a button. A + that
   * vanishes from "+ Button" leaves "Button", which is a perfectly ordinary
   * thing to see. Nothing else here would flag it — the slot holds no text, so
   * text-missing says nothing, and the instance inside is named "Icon", which
   * instance-unmapped treats as mapped.
   */
  for (const { node, where } of visible) {
    const name = (node.name ?? '').trim();
    const m = /^(Start|End)\s*Slot$/i.exec(name);
    if (!m) continue;
    // An empty slot is a placeholder in the component, not content.
    const hasContent = Array.isArray(node.children) && node.children.length > 0;
    if (!hasContent) continue;

    const side = m[1].toLowerCase();
    const props = side === 'start'
      ? ['startIcon', 'startDecorator']
      : ['endIcon', 'endDecorator'];
    if (props.some((prop) => jsx.includes(prop))) continue;

    findings.push({
      severity: 'error',
      kind: 'slot-dropped',
      message: `${name}: visible and has content, but the code sets no ${props.join(' / ')}.`,
      detail: (node.children ?? [])
        .map((c: any) => (c?.name ?? '').trim())
        .filter(Boolean)
        .join(', ') || name,
      where: shortPath(where),
    });
  }

  // ── Component instances with no obvious counterpart ─────────────────────
  const instanceNames = new Map<string, string>();
  for (const { node, where } of visible) {
    if (node.type !== 'INSTANCE') continue;
    const name = (node.name ?? '').split('/').pop()?.trim() ?? '';
    if (name && !instanceNames.has(name)) instanceNames.set(name, where);
  }
  for (const [name, where] of instanceNames) {
    /* An "Icon" wrapper that contains its glyph reports nothing of its own.
       The wrapper names WHERE the icon goes; the child names WHICH icon it is,
       and the child is reported separately. Listing both turns one missing plus
       sign into two findings that a reader has to work out are the same thing. */
    if (/^icons?$/i.test(name) && instanceNames.size > 1) {
      const hasChildGlyph = [...instanceNames.keys()].some(
        (n) => n !== name && (instanceNames.get(n) ?? '').includes(`${name} >`),
      );
      if (hasChildGlyph) continue;
    }
    // The lib draws its own internals; those instances have no counterpart by
    // design, so demanding one is noise. Same filter the variant check uses.
    if (isLibInternal(where)) continue;

    /* Match the BASE name as well as the whole thing.
       A Figma instance carries its variant in its name — "Ratio - Fill
       Vertical", "Button-Small" — and stripping punctuation gave
       "RatioFillVertical" and "ButtonSmall", tags that exist nowhere. Both map
       to a real component with a prop: <Ratio fit="height" />, <Button
       size="small" />. Reporting them as unmapped was reporting correct code,
       and every such line makes the one real finding harder to see. */
    const full = name.replace(/[^A-Za-z0-9]/g, '');
    const base = name.split(/[-–—/,(]/)[0].replace(/[^A-Za-z0-9]/g, '');
    /* A glyph named the Material way is rendered under its React name:
       "add" -> <AddIcon />, "chevron-right" -> <ChevronRightIcon />. Without
       this the check reported a plus sign as missing while <AddIcon /> sat in
       the code — the same transform rule 4d0 asks the converter to apply. */
    const materialIcon = name
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('') + 'Icon';
    const candidates = [full, base, materialIcon].filter(Boolean);
    if (!candidates.length) continue;
    if (!candidates.some((t) => new RegExp(`<${t}\\b`, 'i').test(code))) {
      findings.push({
        severity: 'info',
        kind: 'instance-unmapped',
        message: 'Figma instance has no matching component in the code.',
        detail: name,
        where: shortPath(where),
      });
    }
  }

  const rank: Record<DriftSeverity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Counts for a summary line. */
export function driftSummary(findings: DriftFinding[]) {
  return {
    errors: findings.filter(f => f.severity === 'error').length,
    warnings: findings.filter(f => f.severity === 'warning').length,
    info: findings.filter(f => f.severity === 'info').length,
  };
}
