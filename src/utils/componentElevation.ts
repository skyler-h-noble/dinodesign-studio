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

import {
  shadowLayers, DROP_COLOR_SLOTS,
  type ShadowOptions, type ShadowLevel,
} from './dropshadow';

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
  /* No Hover. An accordion's header is clickable, but the panel does not lift
     on hover — it lifts when it OPENS, and that is the Elevated mode, not a
     pointer state. This previously carried a Hover child, which invented an
     interaction the component does not have. */
  { group: 'Handle, Accordion', base: 1, hasHover: false },
  { group: 'Card, Bottom Sheet', base: 1, hasHover: true },
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

/**
 * The full Component-Elevations payload: geometry written out, colour aliased.
 *
 * The split is not arbitrary. Shadow GEOMETRY does not depend on the theme, so
 * it can be a literal number on a collection whose modes are Standard/Elevated.
 * Shadow COLOUR does depend on the theme, and Component-Elevations has no theme
 * mode to vary it along — so the colour is an ALIAS into Drop-Colors, which
 * does. A node then resolves its shadow hue through its own Drop-Colors mode,
 * and Component-Elevations never needs a theme axis of its own.
 *
 * Aliasing the colour is possible here for the same reason the geometry no
 * longer needs to be: the LEVEL is part of the variable name rather than a
 * mode, so `{Drop-Colors.Level-3.Drop-Color-2}` names one specific value.
 * While Level was a mode, no alias could reach a particular level — which is
 * what forced the bare-number design.
 *
 * Slot counts come from DROP_COLOR_SLOTS, so a row has exactly as many Shadow-n
 * children as its level can use at Resolution 1, and each one pairs with the
 * Drop-Color of the same index. Below that Resolution the extra slots still
 * emit: their geometry goes to zero and the Drop-Color they point at is at
 * alpha 00, so they paint nothing while staying bound.
 *
 * Level 0 emits no Shadow-n at all — it is the absence of a shadow, and there
 * is no Drop-Colors/Level-0 to point at.
 */
export function componentElevationGeometryFigma(
  o?: ShadowOptions,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { Standard: {}, Elevated: {} };

  for (const mode of ['Standard', 'Elevated'] as const) {
    for (const c of COMPONENT_ELEVATIONS) {
      const states: Array<'Default' | 'Hover'> = c.hasHover ? ['Default', 'Hover'] : ['Default'];
      for (const state of states) {
        const level = elevationFor(c, state, mode);
        const row = `${c.group}/${state}`;

        /* No `Level` variable. The collection in the file carries geometry
           only — five children per Shadow-N and nothing else — and the level is
           already implied by the values written into them. Emitting it would be
           an unmatched key on every row. `elevationFor` remains the source of
           the number for anything that needs it. */
        if (level === 0) continue;

        const layers = shadowLayers(level as ShadowLevel, o);
        const slots = DROP_COLOR_SLOTS[level as ShadowLevel];
        for (let i = 0; i < slots; i++) {
          const live = i < layers.length;
          const [x, y, blur, spread] = layers[i] ?? [0, 0, 0, 0];
          /* Named as the file names them — x / y / Blur / Spread / Drop-Color —
             not as the Elevation collection names the same four fields
             (offset-x / offset-y / blur-radius / spread-radius). Two collections
             in one file genuinely use different names for the same geometry, and
             a payload key that matches neither lands nowhere while reporting
             success. */
          out[mode][`${row}/Shadow-${i + 1}/x`] = { value: x, type: 'number' };
          out[mode][`${row}/Shadow-${i + 1}/y`] = { value: y, type: 'number' };
          out[mode][`${row}/Shadow-${i + 1}/Blur`] = { value: blur, type: 'number' };
          out[mode][`${row}/Shadow-${i + 1}/Spread`] = { value: spread, type: 'number' };
          /* Live slots alias the level's ONE colour — the alpha is flat across a
             level, so there is nothing per-slot to point at. Slots past the
             current layer count carry a transparent literal instead: this is
             where liveness is encoded now that Drop-Colors is one per level.

             Transparent rather than merely zero-geometry, because a 0/0/0/0
             shadow still paints the element's silhouette at full strength
             directly behind it. And emitted rather than skipped, because an
             unwritten Figma variable keeps its previous value — a slot dropped
             by a lower Resolution would go on painting what it held before. */
          out[mode][`${row}/Shadow-${i + 1}/Drop-Color`] = live
            ? { value: `{Drop-Colors.Level-${level}.Drop-Color}`, type: 'color' }
            : { value: '#00000000', type: 'color' };
        }
      }
    }
  }
  return out;
}

/** Slot totals, for the emitter to report and the test to pin. */
export function componentElevationSlotCount(): number {
  let n = 0;
  for (const mode of ['Standard', 'Elevated'] as const)
    for (const c of COMPONENT_ELEVATIONS)
      for (const state of (c.hasHover ? ['Default', 'Hover'] : ['Default']) as Array<'Default' | 'Hover'>) {
        const level = elevationFor(c, state, mode);
        if (level > 0) n += DROP_COLOR_SLOTS[level as ShadowLevel];
      }
  return n;
}
