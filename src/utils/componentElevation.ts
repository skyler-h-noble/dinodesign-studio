/**
 * Which elevation LEVEL each component sits at.
 *
 * This is the whole of Component-Elevations. The collection currently holds 150
 * variables restating shadow geometry per component — x, y, blur, spread and a
 * colour, per layer, per state, per mode — and every one of those numbers is a
 * prefix of the one ladder the Elevation collection already carries. What is
 * actually component-specific is a single number: how high it sits.
 *
 * ── Standard vs Elevated ────────────────────────────────────────────────────
 *
 * Not a second dimension. Measured across every existing row, Elevated is
 * Standard + 1, capped at 5 — which is why Dialog is the only component that
 * does not move: it is already at the top. The two modes are one lift.
 *
 * ── Why a number and not an alias ───────────────────────────────────────────
 *
 * A Figma alias cannot pin a mode. `Elevation/Shadow-1/offset-y` resolves in
 * whatever Elevation mode the CONSUMING node is in, so no variable can say
 * "give me Level-2's value". The level therefore ships as a number, and is
 * applied either by an effect style per level or by setting the node's
 * Elevation mode — both of which read the same number from here.
 */

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ComponentElevation {
  /** Figma group name, matching the existing Component-Elevations paths. */
  group: string;
  /** Standard mode level for the resting state. */
  base: ElevationLevel;
  /**
   * Whether the component has a Hover child at all.
   *
   * AppBar/Toolbars/Menus and Dialog/Modal do not: a bar is not a target and a
   * modal is already the top of the stack, so neither has a raised state to
   * express. Emitting a Hover level for them would invent an interaction.
   */
  hasHover: boolean;
}

/** The lift Elevated applies over Standard. */
const ELEVATED_LIFT = 1;
const MAX_LEVEL = 5;

const clamp = (n: number): ElevationLevel =>
  Math.max(0, Math.min(MAX_LEVEL, n)) as ElevationLevel;

export const COMPONENT_ELEVATIONS: ComponentElevation[] = [
  // Flat at rest — a button earns its shadow by being hovered.
  { group: 'Button, Outlined Cards', base: 0, hasHover: true },
  { group: 'Accordion', base: 1, hasHover: true },
  { group: 'Card, Handle, Bottom Sheet', base: 1, hasHover: true },
  // No Hover: a bar is a fixed chrome band, not a target that lifts.
  { group: 'AppBar, Toolbars, Menus', base: 2, hasHover: false },
  { group: 'FAB', base: 3, hasHover: true },
  // Already at the top of the stack, so Elevated cannot lift it and there is
  // no hover state to raise it to.
  { group: 'Dialog, Modal', base: 5, hasHover: false },
];

/** The level for one component in one state and one mode. */
export function elevationFor(
  c: ComponentElevation,
  state: 'Default' | 'Hover',
  mode: 'Standard' | 'Elevated',
): ElevationLevel {
  const hover = state === 'Hover' ? 1 : 0;
  const lift = mode === 'Elevated' ? ELEVATED_LIFT : 0;
  return clamp(c.base + hover + lift);
}

/**
 * The Component-Elevations payload: modes first, then `<Group>/<State>/Level`.
 *
 * Ten variables where there were 150. The old ones are left alone rather than
 * renamed — a renamed Figma variable gets a new id and every layer bound to the
 * old one stays unbound (invariant 8), so removing them is a deliberate manual
 * step once nothing points at them.
 */
export function componentElevationFigma(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { Standard: {}, Elevated: {} };
  for (const mode of ['Standard', 'Elevated'] as const) {
    for (const c of COMPONENT_ELEVATIONS) {
      const states: Array<'Default' | 'Hover'> = c.hasHover ? ['Default', 'Hover'] : ['Default'];
      for (const state of states) {
        out[mode][`${c.group}/${state}/Level`] = {
          value: elevationFor(c, state, mode), type: 'number',
        };
      }
    }
  }
  return out;
}
