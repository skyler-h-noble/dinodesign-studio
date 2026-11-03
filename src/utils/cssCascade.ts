/**
 * A small CSS cascade for the generated design-system sheets.
 *
 * The accessibility report has to check what a page actually RENDERS, and the
 * page renders the published CSS — not tokens.json, and not a guess at which
 * token "should" apply. This reads the sheets a consumer loads (in load order)
 * and computes the custom properties an element ends up with, the way a
 * browser does:
 *
 *   - inherited from its parent,
 *   - overridden by every rule whose selector matches it, highest specificity
 *     first and then source order,
 *   - with var() resolved on the element that DECLARES the property (a
 *     custom property's var() is substituted at computed-value time, on its
 *     own element — which is why a theme's --Text can differ from the same
 *     declaration read under a different surface).
 *
 * It understands only the selector forms the generator emits: `:root`,
 * attribute selectors (`[a]`, `[a="v"]`, `[a^="v"]`), compounds of those, and
 * the descendant combinator. Anything else (classes, pseudo-classes, at-rule
 * blocks) is skipped, never approximated — a rule it cannot match exactly is
 * a rule it does not apply.
 */

type AttrTest = { name: string; op: 'exists' | '=' | '^='; value: string };
type Compound = { root: boolean; attrs: AttrTest[] };
type Selector = { parts: Compound[]; specificity: number };
type Rule = { selectors: Selector[]; decls: Record<string, string>; order: number };

export interface CascadeElement {
  /** Attributes on the element, e.g. { 'data-theme': 'Primary' }. */
  attrs: Record<string, string>;
  /** True for the document root (matches `:root`). */
  root?: boolean;
  parent?: CascadeElement;
}

const COMPOUND_PART = /^(?::root|\[[\w-]+(?:\^?="[^"]*")?\])+$/;

function parseCompound(text: string): Compound | null {
  if (!COMPOUND_PART.test(text)) return null;
  const root = text.includes(':root');
  const attrs: AttrTest[] = [];
  for (const m of text.matchAll(/\[([\w-]+)(?:(\^?=)"([^"]*)")?\]/g)) {
    attrs.push({ name: m[1], op: m[2] === '^=' ? '^=' : m[2] === '=' ? '=' : 'exists', value: m[3] ?? '' });
  }
  return { root, attrs };
}

function parseSelector(text: string): Selector | null {
  const parts: Compound[] = [];
  for (const piece of text.trim().split(/\s+/)) {
    const c = parseCompound(piece);
    if (!c) return null;
    parts.push(c);
  }
  if (!parts.length) return null;
  const specificity = parts.reduce((n, c) => n + c.attrs.length + (c.root ? 1 : 0), 0);
  return { parts, specificity };
}

/** Top-level rules only; at-rule blocks (@media, @container, @supports) and
 *  @import lines are skipped. */
function parseRules(css: string, startOrder: number): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  let i = 0, order = startOrder;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    let prelude = text.slice(i, open).trim();
    // Drop any statement at-rules (@import …;) sitting in front of this block.
    prelude = prelude.replace(/@[^;{]*;/g, '').trim();
    // Find the matching close brace.
    let depth = 1, j = open + 1;
    while (j < text.length && depth) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    i = j;
    if (prelude.startsWith('@')) continue;
    const selectors = prelude.split(',').map(parseSelector).filter((s): s is Selector => !!s);
    if (!selectors.length) continue;
    const decls: Record<string, string> = {};
    for (const d of body.split(';')) {
      const k = d.indexOf(':');
      if (k < 0) continue;
      const name = d.slice(0, k).trim();
      if (!name.startsWith('--')) continue;
      decls[name] = d.slice(k + 1).trim();
    }
    if (Object.keys(decls).length) rules.push({ selectors, decls, order: order++ });
  }
  return rules;
}

function compoundMatches(c: Compound, el: CascadeElement): boolean {
  if (c.root && !el.root) return false;
  return c.attrs.every((a) => {
    const v = el.attrs[a.name];
    if (v === undefined) return false;
    if (a.op === 'exists') return true;
    if (a.op === '=') return v === a.value;
    return v.startsWith(a.value);
  });
}

function selectorMatches(sel: Selector, el: CascadeElement): boolean {
  const last = sel.parts.length - 1;
  if (!compoundMatches(sel.parts[last], el)) return false;
  // Descendant combinator: each earlier compound matches SOME ancestor, in order.
  let anc = el.parent;
  for (let p = last - 1; p >= 0; p--) {
    while (anc && !compoundMatches(sel.parts[p], anc)) anc = anc.parent;
    if (!anc) return false;
    anc = anc.parent;
  }
  return true;
}

export class Cascade {
  private rules: Rule[];
  private cache = new Map<CascadeElement, Record<string, string>>();

  /** `sheets` in the order a page loads them. */
  constructor(sheets: string[]) {
    this.rules = [];
    for (const css of sheets) this.rules.push(...parseRules(css, this.rules.length));
  }

  /** Every custom property the element ends up with, var() substituted. */
  computed(el: CascadeElement): Record<string, string> {
    const hit = this.cache.get(el);
    if (hit) return hit;
    const inherited = el.parent ? this.computed(el.parent) : {};

    // Winning declaration per property: highest specificity, then source order.
    const won: Record<string, { value: string; spec: number; order: number }> = {};
    for (const rule of this.rules) {
      let spec = -1;
      for (const s of rule.selectors) if (s.specificity > spec && selectorMatches(s, el)) spec = s.specificity;
      if (spec < 0) continue;
      for (const [name, value] of Object.entries(rule.decls)) {
        const cur = won[name];
        if (!cur || spec > cur.spec || (spec === cur.spec && rule.order >= cur.order)) {
          won[name] = { value, spec, order: rule.order };
        }
      }
    }

    const out: Record<string, string> = { ...inherited };
    const resolving = new Set<string>();
    const resolveName = (name: string): string | undefined => {
      if (!(name in won)) return inherited[name];
      if (name in resolved) return resolved[name];
      if (resolving.has(name)) return undefined; // cycle: invalid at computed-value time
      resolving.add(name);
      const v = substitute(won[name].value);
      resolving.delete(name);
      resolved[name] = v ?? '';
      return v;
    };
    const resolved: Record<string, string> = {};
    const substitute = (value: string, depth = 0): string | undefined => {
      if (depth > 32) return undefined;
      let failed = false;
      const result = replaceVars(value, (name, fallback) => {
        const v = resolveName(name);
        if (v !== undefined && v !== '') return v;
        if (fallback !== undefined) {
          const f = substitute(fallback, depth + 1);
          if (f !== undefined) return f;
        }
        failed = true;
        return '';
      });
      return failed ? undefined : result;
    };
    for (const name of Object.keys(won)) {
      const v = resolveName(name);
      if (v === undefined || v === '') delete out[name];
      else out[name] = v;
    }
    this.cache.set(el, out);
    return out;
  }
}

/** Replace each var(--x[, fallback]) — outermost first, balanced parens. */
function replaceVars(value: string, fn: (name: string, fallback?: string) => string): string {
  let out = '', i = 0;
  while (i < value.length) {
    const k = value.indexOf('var(', i);
    if (k < 0) { out += value.slice(i); break; }
    out += value.slice(i, k);
    let depth = 1, j = k + 4;
    while (j < value.length && depth) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') depth--;
      j++;
    }
    const inner = value.slice(k + 4, j - 1);
    const comma = topLevelComma(inner);
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    out += fn(name, fallback);
    i = j;
  }
  return out;
}

function topLevelComma(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) return i;
  }
  return -1;
}

// ─── Colors ────────────────────────────────────────────────────────────────

export type RGBA = { r: number; g: number; b: number; a: number };

/** #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba(), or null. */
export function parseColor(value: string): RGBA | null {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}

/** Paint `fg` over an opaque `bg`. */
export function composite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

export function toHex(c: RGBA): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function luminance(c: RGBA): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/** WCAG contrast of two OPAQUE colors. */
export function contrast(a: RGBA, b: RGBA): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
