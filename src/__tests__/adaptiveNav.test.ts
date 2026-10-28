import { describe, it, expect } from 'vitest';
import { adaptiveNavDefinition, arrangementRows, mobileAt, DESKTOP_CONDITION, MOBILE_CONDITION } from '../utils/addOns/adaptiveNav';
import { toAddonSpec, conditionsUsedBy } from '../utils/addOns/toAddonSpec';
import { DEFAULT_BREAKPOINTS } from '../utils/addOns/breakpoints';

const def = adaptiveNavDefinition(
  { layout: 'brand-left', search: true, actions: true, avatar: true },
  { layout: 'top-and-bottom', itemCount: 4, showAvatar: true } as never,
);

describe('one Adaptive Nav across every width', () => {
  it('holds both arrangements, each gated by its width condition', () => {
    const kids = def.root.children!;
    expect(kids.map((k) => k.name)).toEqual(['Desktop', 'Mobile']);
    expect(kids[0].presence).toEqual({ when: DESKTOP_CONDITION });
    expect(kids[1].presence).toEqual({ when: MOBILE_CONDITION });
  });

  it('declares every condition either arrangement uses', () => {
    for (const name of conditionsUsedBy(def)) expect(def.conditions, name).toHaveProperty([name]);
  });

  it('Mobile below 600, Desktop above — exactly one per breakpoint', () => {
    const rows = arrangementRows(DEFAULT_BREAKPOINTS, {});
    for (const bp of DEFAULT_BREAKPOINTS) {
      expect(rows[MOBILE_CONDITION][bp.id], bp.id).toBe(bp.minWidth < 600);
      expect(rows[DESKTOP_CONDITION][bp.id], bp.id).toBe(!rows[MOBILE_CONDITION][bp.id]);
    }
  });

  it('a tablet breakpoint that chose the bottom bar is Mobile; a desktop one cannot be', () => {
    const tablet = DEFAULT_BREAKPOINTS.find((b) => b.id === 'tablet-h')!;
    const desktop = DEFAULT_BREAKPOINTS.find((b) => b.id === 'desktop')!;
    expect(mobileAt(tablet, { 'tablet-h': true })).toBe(true);
    expect(mobileAt(desktop, { desktop: true })).toBe(false);
  });

  it('publishes one spec whose responsive table switches arrangement', () => {
    const matrix = arrangementRows(DEFAULT_BREAKPOINTS, {});
    const spec: any = toAddonSpec(def, { breakpoints: DEFAULT_BREAKPOINTS, matrix });
    expect(spec.root.children.map((c: any) => c.visibleWhen)).toEqual([DESKTOP_CONDITION, MOBILE_CONDITION]);
    expect(spec.responsive.matrix[MOBILE_CONDITION].mobile).toBe(true);
    expect(spec.responsive.matrix[DESKTOP_CONDITION].desktop).toBe(true);
  });
});
