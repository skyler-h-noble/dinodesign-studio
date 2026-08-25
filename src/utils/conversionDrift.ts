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
}

interface FigmaNodeish {
  name?: string;
  type?: string;
  visible?: boolean;
  characters?: string;
  children?: FigmaNodeish[];
  componentProperties?: Record<string, { value?: unknown; type?: string }>;
}

/** Walk every node, including invisible ones — their absence is the point. */
function walk(node: FigmaNodeish | null | undefined, out: FigmaNodeish[] = []): FigmaNodeish[] {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  for (const child of node.children ?? []) walk(child, out);
  return out;
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
export function computeDrift(frameJson: unknown, jsx: string): DriftFinding[] {
  const findings: DriftFinding[] = [];
  if (!jsx.trim()) return findings;

  const code = codeWithoutStrings(jsx);
  const root = rootOf(frameJson);
  const nodes = root ? walk(root) : [];
  const visible = nodes.filter(n => n.visible !== false);
  const hidden = nodes.filter(n => n.visible === false);

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
  for (const node of hidden) {
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
        detail: leakedText ? `${name || 'layer'} — "${chars}"` : name,
      });
    }
  }

  // ── Variant properties that did not become props ────────────────────────
  // Dropping a variant gives you the component's default, which looks nearly
  // right — the worst kind of wrong.
  const seenVariants = new Set<string>();
  for (const node of visible) {
    for (const [prop, spec] of Object.entries(node.componentProperties ?? {})) {
      const value = spec?.value;
      if (typeof value !== 'string' || !value.trim()) continue;
      // Figma names variant props like "Size" or "Appearance#123:4".
      const cleanProp = prop.split('#')[0].trim();
      const key = `${cleanProp}=${value}`;
      if (seenVariants.has(key)) continue;
      seenVariants.add(key);
      // Default-ish values are not worth reporting when absent.
      if (/^(default|none|false|off)$/i.test(value)) continue;
      if (!new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(code)) {
        findings.push({
          severity: 'warning',
          kind: 'variant-dropped',
          message: `Variant "${cleanProp}" is set in Figma but its value is not in the code.`,
          detail: `${cleanProp} = ${value}`,
        });
      }
    }
  }

  // ── Text present in the frame but not in the code ───────────────────────
  const strings = new Set<string>();
  for (const node of visible) {
    const chars = (node.characters ?? '').trim();
    // Very short strings produce noise — a "1" or "OK" matches accidentally.
    if (chars.length < 3) continue;
    strings.add(chars);
  }
  for (const text of strings) {
    if (!jsx.includes(text)) {
      findings.push({
        severity: 'warning',
        kind: 'text-missing',
        message: 'Text in the frame does not appear in the code.',
        detail: text.length > 60 ? `${text.slice(0, 60)}…` : text,
      });
    }
  }

  // ── Component instances with no obvious counterpart ─────────────────────
  const instanceNames = new Set<string>();
  for (const node of visible) {
    if (node.type !== 'INSTANCE') continue;
    const name = (node.name ?? '').split('/').pop()?.trim() ?? '';
    if (name) instanceNames.add(name);
  }
  for (const name of instanceNames) {
    const asTag = name.replace(/[^A-Za-z0-9]/g, '');
    if (!asTag) continue;
    if (!new RegExp(`<${asTag}\\b`, 'i').test(code)) {
      findings.push({
        severity: 'info',
        kind: 'instance-unmapped',
        message: 'Figma instance has no matching component in the code.',
        detail: name,
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
