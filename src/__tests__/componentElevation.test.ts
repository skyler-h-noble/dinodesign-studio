/**
 * Component-Elevations: one level per component/state, not 150 geometry
 * variables.
 *
 * The table below is the spec as given, written out longhand rather than
 * derived, so a change to the formula cannot silently move a component. The
 * formula (Elevated = Standard + 1, capped at 5) is asserted separately — if
 * the two ever disagree, the longhand table is the one that is right.
 */
import { describe, it, expect } from 'vitest';
import {
  COMPONENT_ELEVATIONS, elevationFor, componentElevationFigma,
} from '../utils/componentElevation';

/** group, state, Standard, Elevated */
const SPEC: Array<[string, 'Default' | 'Hover', number, number]> = [
  ['Button, Outlined Cards',     'Default', 0, 1],
  ['Button, Outlined Cards',     'Hover',   1, 2],
  ['Handle, Accordion',          'Default', 1, 2],
  ['Card, Bottom Sheet',         'Default', 1, 2],
  ['Card, Bottom Sheet',         'Hover',   2, 3],
  ['AppBar, Toolbars, Menus',    'Default', 2, 3],
  ['FAB',                        'Default', 3, 4],
  ['FAB',                        'Hover',   4, 5],
  ['Dialog, Modal',              'Default', 5, 5],
];

const byGroup = (g: string) => {
  const c = COMPONENT_ELEVATIONS.find((x) => x.group === g);
  if (!c) throw new Error(`no elevation entry for ${g}`);
  return c;
};

describe('component elevation levels', () => {
  it.each(SPEC)('%s / %s is Standard %i, Elevated %i', (group, state, std, elev) => {
    expect(elevationFor(byGroup(group), state, 'Standard')).toBe(std);
    expect(elevationFor(byGroup(group), state, 'Elevated')).toBe(elev);
  });

  it('Elevated is one level above Standard, capped at 5', () => {
    for (const [group, state, std, elev] of SPEC) {
      expect(elev, `${group}/${state}`).toBe(Math.min(5, std + 1));
    }
  });

  it('a button is flat at rest — it earns its shadow by being hovered', () => {
    expect(elevationFor(byGroup('Button, Outlined Cards'), 'Default', 'Standard')).toBe(0);
  });

  it('Dialog cannot be lifted, because it is already at the top', () => {
    const d = byGroup('Dialog, Modal');
    expect(elevationFor(d, 'Default', 'Standard')).toBe(5);
    expect(elevationFor(d, 'Default', 'Elevated')).toBe(5);
  });
});

describe('which components have a Hover state', () => {
  // A bar is fixed chrome, not a target; a modal is already the top of the
  // stack. Emitting a Hover level for either would invent an interaction.
  it.each([
    ['AppBar, Toolbars, Menus', false],
    ['Dialog, Modal', false],
    ['Button, Outlined Cards', true],
    ['Card, Bottom Sheet', true],
    ['FAB', true],
    ['Handle, Accordion', false],
  ])('%s hasHover=%s', (group, expected) => {
    expect(byGroup(group).hasHover).toBe(expected);
  });
});

describe('the Figma payload', () => {
  const payload = componentElevationFigma();

  it('is keyed by the collection\'s two modes', () => {
    expect(Object.keys(payload)).toEqual(['Standard', 'Elevated']);
  });

  it('emits exactly one variable per component/state — nine, not 150', () => {
    /* Nine rows, not ten: Accordion lost its Hover child. An accordion lifts
       when it OPENS, which is the Elevated mode, not a pointer state — the
       Hover row invented an interaction the component does not have. */
    expect(Object.keys(payload.Standard)).toHaveLength(SPEC.length);
    expect(Object.keys(payload.Elevated)).toHaveLength(SPEC.length);
    expect(SPEC.length).toBe(9);
  });

  it('names variables the way the collection paths already read', () => {
    expect(payload.Standard['FAB/Hover/Level']).toEqual({ value: 4, type: 'number' });
    expect(payload.Elevated['FAB/Hover/Level']).toEqual({ value: 5, type: 'number' });
  });

  it('omits Hover entirely for the components that have none', () => {
    for (const mode of ['Standard', 'Elevated'] as const) {
      expect(payload[mode]['AppBar, Toolbars, Menus/Hover/Level']).toBeUndefined();
      expect(payload[mode]['Dialog, Modal/Hover/Level']).toBeUndefined();
    }
  });

  it('every level is a real Elevation mode', () => {
    for (const mode of ['Standard', 'Elevated'] as const) {
      for (const entry of Object.values(payload[mode])) {
        const v = (entry as { value: number }).value;
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });
});
