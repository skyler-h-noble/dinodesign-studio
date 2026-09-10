import { describe, it, expect } from 'vitest';
import {
  mobileNavDefinition, MOBILE_LAYOUTS, MAX_BOTTOM_ITEMS, maxItemsWithFab,
  type MobileLayout,
} from '../utils/addOns/mobileNav';
import { toAddonSpec } from '../utils/addOns/toAddonSpec';

const ALL: MobileLayout[] = MOBILE_LAYOUTS.map((l) => l.id);
const names = (n: any): string[] => {
  const out: string[] = [];
  const walk = (x: any) => { if (x?.name) out.push(x.name); (x?.children || []).forEach(walk); };
  walk(n?.root ?? n);
  return out;
};

describe('mobile is a different shape, not the desktop bar narrowed', () => {
  it('navigation moves to the bottom where a thumb reaches', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'top-and-bottom' }));
    /* Bar, PAGE, bottom bar. The gap is most of what makes the arrangement
       legible — stacked against each other the two read as one thick bar, and
       nothing says which end of a screen each lives at. */
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Bar', 'Page', 'Bottom-Bar']);
  });

  it('bottom-only drops the top bar entirely', () => {
    // For apps whose identity lives in the content — an empty top bar would
    // take height and say nothing.
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Page', 'Bottom-Bar']);
  });

  it('top-only keeps navigation in a drawer behind the menu button', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'top-only' }));
    expect(names(spec)).toContain('Menu-Button');
    expect(names(spec)).not.toContain('Bottom-Bar');
  });

  it('the top bar sticks in every layout that has one', () => {
    for (const l of ALL) {
      const def = mobileNavDefinition({ layout: l });
      const bar = def.root.children!.find((c) => c.name === 'Bar');
      if (bar) expect([l, bar.sticky]).toEqual([l, true]);
    }
  });
});

describe('a nav item is not a tab', () => {
  it('the label sits UNDER the icon, so the item is a column', () => {
    /* That is the whole structural difference: a tab lays its icon beside its
       label, a nav item stacks them. Reusing the tab's shape would put the
       label in the wrong place at every size. */
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    const bottom = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
    const item = bottom.children[0].children[0];
    expect(item.layoutMode).toBe('VERTICAL');
    expect(names(item)).toEqual(['Nav-Item-1', 'Nav-Icon-1', 'Nav-Label-1']);
  });

  it('labels are behind a condition, so they can go at a narrower width', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    const bottom2 = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
    const label = bottom2.children[0].children[0].children[1];
    expect(label.visibleWhen).toBe('Adaptive-Nav/Show-Labels');
  });

  it('and are omitted entirely when the layout has none', () => {
    // Different from hidden: a labelless bar has no label slot to fill.
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only', showLabels: false }));
    expect(names(spec)).not.toContain('Nav-Label-1');
  });
});

describe('five items is a reach limit', () => {
  it('caps at five', () => {
    /* Below about 64px a target stops being reliably hittable with a thumb,
       and five items is where a 360px phone reaches that. */
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only', itemCount: 9 }));
    expect(names(spec).filter((n) => /^Nav-Item-\d+$/.test(n))).toHaveLength(MAX_BOTTOM_ITEMS);
  });

  it('a FAB takes one of the five, because it is in the same row', () => {
    expect(maxItemsWithFab(false)).toBe(5);
    expect(maxItemsWithFab(true)).toBe(4);
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only', itemCount: 9, fab: true }));
    expect(names(spec).filter((n) => /^Nav-Item-\d+$/.test(n))).toHaveLength(4);
  });
});

describe('the FAB is composed, never a variant', () => {
  it('centred, it splits the items into the two slots the design already has', () => {
    /* Which is why a centred FAB needs no variant of its own: the NavBar is
       built with two item slots, and a centre gap is what they are for. */
    const spec: any = toAddonSpec(mobileNavDefinition({
      layout: 'bottom-only', itemCount: 4, fab: true, fabPosition: 'center',
    }));
    const bar = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
    expect(bar.children.map((c: any) => c.name))
      .toEqual(['Nav-Item-Slot-Start', 'FAB', 'Nav-Item-Slot-End']);
  });

  it('at the end, it is a sibling and the bar is unchanged', () => {
    // The bar's geometry is identical with or without it — enumerating that as
    // a variant would multiply the set for something that does not alter it.
    const spec: any = toAddonSpec(mobileNavDefinition({
      layout: 'bottom-only', itemCount: 4, fab: true, fabPosition: 'end',
    }));
    const endBar = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
    expect(endBar.children.map((c: any) => c.name)).toEqual(['Nav-Item-Slot', 'FAB']);
  });

  it('absent when not asked for', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    expect(names(spec)).not.toContain('FAB');
  });
});

describe('the toolbar', () => {
  it('floats or is fixed, and the difference is a corner', () => {
    const floating: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar', toolbarStyle: 'floating' }));
    const fixed: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar', toolbarStyle: 'fixed' }));
    const tb = (s: any) => s.root.children.find((c: any) => c.name === 'Toolbar');
    expect(tb(floating).cornerRadius).toEqual({ var: 'Sizing-6' });
    expect(tb(fixed).cornerRadius).toBeUndefined();
  });

  it('runs across or down', () => {
    const v: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar', toolbarOrientation: 'vertical' }));
    const tb = v.root.children.find((c: any) => c.name === 'Toolbar');
    expect(tb.layoutMode).toBe('VERTICAL');
    expect(tb.layoutSizingHorizontal).toBe('HUG');
  });
});

describe('nothing carries a colour', () => {
  it('at any layout or setting', () => {
    for (const l of ALL) {
      const json = JSON.stringify(toAddonSpec(mobileNavDefinition({
        layout: l, theme: 'Primary', surface: 'Surface-Dim', fab: true, showLabels: true,
      })));
      expect(json, l).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
