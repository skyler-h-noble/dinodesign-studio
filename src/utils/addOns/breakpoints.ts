/**
 * Breakpoints, and the condition values at each.
 *
 * A responsive component is not one layout with some parts hidden — it is a
 * TABLE: every condition has a value at every breakpoint. That is also exactly
 * what Figma stores, where a boolean variable holds one value per Device-Sizes
 * mode, so designing per breakpoint here produces the numbers that collection
 * needs rather than something that has to be translated into them.
 *
 * ── Why the first breakpoint must start at 0 ──────────────────────────────
 * A gap below the smallest breakpoint is a width where NO condition has a
 * value. In CSS that means every part falls back to whatever the base rule
 * says; in Figma there is simply no mode covering it. Neither fails loudly, so
 * the constraint is enforced rather than documented.
 */

export interface Breakpoint {
  id: string;
  label: string;
  /** Inclusive lower bound, in CSS pixels. */
  minWidth: number;
}

/** Condition name → breakpoint id → whether it is true there. */
export type ConditionMatrix = Record<string, Record<string, boolean>>;

/* Defaults chosen from the width clusters that actually exist rather than
   round numbers: phones sit at 360-430, small tablets at 600-768, and the
   desktop cluster starts at 1280. See docs on device sizes — the names drift
   with each product cycle but the clusters do not. */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: 'mobile',  label: 'Mobile',  minWidth: 0 },
  { id: 'tablet',  label: 'Tablet',  minWidth: 768 },
  { id: 'desktop', label: 'Desktop', minWidth: 1280 },
];

/** Ascending by width. Order is meaning here, not presentation: "the last one
 *  whose minWidth is at or below this width" only works on a sorted list. */
export function sortBreakpoints(bps: Breakpoint[]): Breakpoint[] {
  return [...bps].sort((a, b) => a.minWidth - b.minWidth);
}

export interface BreakpointProblem { id: string; message: string }

/** Problems worth blocking on, each of which is silent at runtime. */
export function validateBreakpoints(bps: Breakpoint[]): BreakpointProblem[] {
  const out: BreakpointProblem[] = [];
  const sorted = sortBreakpoints(bps);

  if (!sorted.length) {
    return [{ id: '', message: 'At least one breakpoint is needed.' }];
  }
  if (sorted[0].minWidth !== 0) {
    out.push({
      id: sorted[0].id,
      message: `Nothing covers widths below ${sorted[0].minWidth}px. The narrowest breakpoint must start at 0.`,
    });
  }
  const seen = new Map<number, string>();
  for (const b of sorted) {
    if (seen.has(b.minWidth)) {
      out.push({ id: b.id, message: `${b.label} and ${seen.get(b.minWidth)} both start at ${b.minWidth}px, so one can never apply.` });
    }
    seen.set(b.minWidth, b.label);
    if (!Number.isFinite(b.minWidth) || b.minWidth < 0) {
      out.push({ id: b.id, message: `${b.label} needs a width of 0 or more.` });
    }
  }
  return out;
}

/** Which breakpoint governs a given viewport width. */
export function breakpointAt(bps: Breakpoint[], width: number): Breakpoint | undefined {
  const sorted = sortBreakpoints(bps);
  let found: Breakpoint | undefined;
  for (const b of sorted) if (width >= b.minWidth) found = b;
  return found;
}

/** The width range a breakpoint covers, for display. `null` upper bound means
 *  it is the widest and has no ceiling. */
export function breakpointRange(bps: Breakpoint[], id: string): { from: number; to: number | null } | null {
  const sorted = sortBreakpoints(bps);
  const i = sorted.findIndex((b) => b.id === id);
  if (i < 0) return null;
  return { from: sorted[i].minWidth, to: i + 1 < sorted.length ? sorted[i + 1].minWidth - 1 : null };
}

/**
 * Fill in any condition/breakpoint pair the matrix does not cover.
 *
 * An absent value reads as FALSE elsewhere, so leaving holes would silently
 * hide parts at whichever widths were never visited. `fallback` decides what a
 * new cell means: most conditions default on and switch off as things get
 * narrower, which is why the default is true — except scroll-triggered ones,
 * which are false until something scrolls regardless of width.
 */
export function completeMatrix(
  matrix: ConditionMatrix,
  conditionNames: string[],
  bps: Breakpoint[],
  fallback: (condition: string, bp: Breakpoint) => boolean,
): ConditionMatrix {
  const out: ConditionMatrix = {};
  for (const name of conditionNames) {
    out[name] = {};
    for (const bp of bps) {
      const existing = matrix[name]?.[bp.id];
      out[name][bp.id] = existing === undefined ? fallback(name, bp) : existing;
    }
  }
  return out;
}

/** The conditions true at one breakpoint, in the shape the renderer wants. */
export function conditionsAt(matrix: ConditionMatrix, breakpointId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [name, byBp] of Object.entries(matrix)) out[name] = !!byBp[breakpointId];
  return out;
}
