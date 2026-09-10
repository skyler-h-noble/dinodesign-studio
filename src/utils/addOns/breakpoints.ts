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
  /** Where content stops growing, in CSS pixels. Undefined means it keeps
   *  filling the viewport.
   *
   *  This is what a wide breakpoint actually needs. Above the desktop cluster
   *  the real constraint is a content ceiling, not a gutter — a nav that keeps
   *  stretching to 2560px puts its brand and its actions half a metre apart.
   *  Left as a margin, that reads as "80px of padding at 2560", which describes
   *  the leftover rather than the rule. */
  maxWidth?: number;
  /** Where the capped content sits in the leftover space. Only meaningful with
   *  maxWidth, and there is no correct default: a centred nav matches a centred
   *  page, while a left-aligned one keeps the brand where the eye starts. */
  align?: 'left' | 'center';
}

/** Condition name → breakpoint id → whether it is true there. */
export type ConditionMatrix = Record<string, Record<string, boolean>>;

/* The five-step scale, with widths taken from the device clusters rather than
   round numbers. Model names drift every product cycle; the clusters do not:
   phones at 360-440, small tablets at 600-744, tablet landscape at 960-1180,
   and the desktop cluster opening at 1280.
   
     xs   0      phones
     sm   600    small tablets — Material's compact/medium boundary, and the
                 narrowest tablet in the device table
     md   900    tablet landscape and small laptops (Tablet-Horizontal Narrow
                 is 960, so 900 catches it rather than splitting it)
     lg   1280   where the desktop cluster starts (Desktop Narrow)
     xl   1920   Desktop Default

   Each is a LOWER bound, so xs must be 0 — see validateBreakpoints. */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: 'xs', label: 'xs', minWidth: 0 },
  { id: 'sm', label: 'sm', minWidth: 600 },
  { id: 'md', label: 'md', minWidth: 900 },
  { id: 'lg', label: 'lg', minWidth: 1280 },
  /* Capped and centred: past this width a nav that keeps stretching puts the
     brand and the actions absurdly far apart. 1440 is the widest of the common
     content ceilings and sits inside Desktop Default's 1920 with room for the
     margin. */
  { id: 'xl', label: 'xl', minWidth: 1920, maxWidth: 1440, align: 'center' },
];

/** Ascending by width. Order is MEANING here, not presentation: "the last one
 *  whose minWidth is at or below this width" only works on a sorted list, and
 *  a range's ceiling is the next entry's floor.
 *
 *  Never reverse this to change what a list looks like — breakpointAt and
 *  breakpointRange both read it, and both would return plausible wrong answers
 *  rather than failing. Use displayBreakpoints for presentation. */
export function sortBreakpoints(bps: Breakpoint[]): Breakpoint[] {
  return [...bps].sort((a, b) => a.minWidth - b.minWidth);
}

/** Widest first, for showing to a person.
 *
 *  Design runs desktop-down: the widest layout is the one being designed and
 *  the narrow ones are what it degrades into, so the widest belongs first.
 *  Separate from sortBreakpoints because that order is load-bearing — this one
 *  is only what a reader sees. */
export function displayBreakpoints(bps: Breakpoint[]): Breakpoint[] {
  return [...bps].sort((a, b) => b.minWidth - a.minWidth);
}

/** Where the layout vocabulary changes.
 *
 *  Below the tablet cluster a nav stops being "the desktop bar with fewer
 *  items": reach decides the arrangement, navigation moves to the bottom where
 *  a thumb lands, and the top bar keeps only identity and the way in. That is
 *  a different set of layouts rather than a narrower version of the same ones,
 *  so the picker offers different options either side of this line.
 *
 *  600px is the boundary because it is where the device clusters change too —
 *  Material's compact/medium line, and the narrowest tablet in the device
 *  table. */
export const MOBILE_MAX_WIDTH = 599;

export function isMobileBreakpoint(bp: Breakpoint | undefined): boolean {
  return !!bp && bp.minWidth <= MOBILE_MAX_WIDTH;
}

/** The breakpoint to open on: the widest, since that is what gets designed
 *  first and everything else is derived from it. */
export function primaryBreakpoint(bps: Breakpoint[]): Breakpoint | undefined {
  return displayBreakpoints(bps)[0];
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
