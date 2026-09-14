import { describe, it, expect } from 'vitest';
import {
  SPEED_DIAL_CONDITION, DEFAULT_SPEED_DIAL, MAX_SPEED_DIAL_ITEMS,
  speedDialProblems, newSpeedDialItem,
} from '../utils/addOns/speedDial';
import { mobileNavDefinition } from '../utils/addOns/mobileNav';
import { conditionsToPublish, conditionsUsedBy } from '../utils/addOns/toAddonSpec';

describe('the speed dial is the component\'s — the definition carries its variable', () => {
  /* The ring is the Nav-Bar's, so the panel it opens is too. What the
     definition has to ship is the open/closed variable: a state a design
     system flips in Figma, bound when the nav is built, and a layer bound to
     a name the file does not have is simply unbound. */
  it('publishes the variable when there is a dial', () => {
    const def = mobileNavDefinition({ layout: 'bottom-only', fab: true, fabSpeedDial: true });
    expect(conditionsToPublish(def)).toContain(SPEED_DIAL_CONDITION);
    // Nothing in the definition gates on it — the component does.
    expect(conditionsUsedBy(def)).not.toContain(SPEED_DIAL_CONDITION);
    expect(def.conditions?.[SPEED_DIAL_CONDITION]?.trigger).toBe('interaction');
  });

  it('and not when there is nothing to bind it to', () => {
    /* A variable that flips nothing is a control that looks broken in every
       file that imported it. */
    for (const o of [{ fab: true }, { fab: false, fabSpeedDial: true }, {}]) {
      const def = mobileNavDefinition({ layout: 'bottom-only', ...o });
      expect(conditionsToPublish(def), JSON.stringify(o)).not.toContain(SPEED_DIAL_CONDITION);
    }
  });
});

describe('the list', () => {
  it('ships a sensible default that passes its own checks', () => {
    expect(speedDialProblems(DEFAULT_SPEED_DIAL)).toEqual([]);
    expect(DEFAULT_SPEED_DIAL.length).toBeLessThanOrEqual(MAX_SPEED_DIAL_ITEMS);
  });

  it('refuses an empty dial and an unlabelled action', () => {
    expect(speedDialProblems([])).toHaveLength(1);
    expect(speedDialProblems([{ id: 'a', label: '  ' }])).toHaveLength(1);
  });

  it('caps at six — past that the top action is out of thumb reach', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `d${i}`, label: `A${i}` }));
    expect(speedDialProblems(seven)).toHaveLength(1);
    expect(speedDialProblems(seven.slice(0, 6))).toEqual([]);
  });

  it('a new action arrives labelled and with an icon, so it never ships blank', () => {
    const n = newSpeedDialItem();
    expect(n.label.trim()).not.toBe('');
    expect(n.iconName).toBeTruthy();
  });
});
