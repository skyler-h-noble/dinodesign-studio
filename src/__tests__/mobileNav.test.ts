import { describe, it, expect } from 'vitest';
import {
  mobileNavDefinition, MOBILE_LAYOUTS, MAX_BOTTOM_ITEMS, maxItemsWithFab,
  type MobileLayout,
} from '../utils/addOns/mobileNav';
import { toAddonSpec, conditionsUsedBy, conditionsToPublish, tokensUsed } from '../utils/addOns/toAddonSpec';

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

describe('the bar is ONE slot, filled by the Nav-Bar component', () => {
  /* It used to build a Nav-Item-N stack per item, each with its own
     Nav-Icon-N and Nav-Label-N. That was a second implementation of what the
     design's Nav-Bar already owns — the item's geometry, its selected pill,
     its label — and it would have drifted from the component the moment
     either changed. It also could not be FILLED: the group was a stack, so
     the preview's BottomNavigation never landed and every item rendered as
     two dashed boxes.

     The rail already worked this way: Rail-Items is one slot the real Rail
     drops into. This is the same shape.

     WHAT THIS COSTS, stated so it is a decision rather than a surprise: the
     item count and the per-breakpoint label switch no longer reach Figma,
     because the component owns them now. They still drive the preview. */
  it('emits one item slot, not a frame per item', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    const bottom = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
    expect(bottom.children.map((c: any) => c.name)).toEqual(['Nav-Item-Slot']);
    expect(names(spec).filter((n) => /^Nav-Item-\d+$/.test(n))).toHaveLength(0);
  });

  it('the slot fills, so the component decides how the items distribute', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'bottom-only' }));
    const slot = spec.root.children
      .find((c: any) => c.name === 'Bottom-Bar').children[0];
    expect(slot.layoutSizingHorizontal).toBe('FILL');
  });

  it('a toolbar is the same component, not a different one', () => {
    /* Its Style and Orientation are two of the Nav-Bar's own three variant
       axes — fixed or floating, across or down — so a toolbar is that
       component configured, not a second thing to keep in step. */
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar' }));
    const toolbar = spec.root.children.find((c: any) => c.name === 'Toolbar');
    expect(toolbar.children.some((c: any) => c.name === 'Nav-Item-Slot')).toBe(true);
  });
});

describe('five items is a reach limit', () => {
  it('a FAB takes one of the five, because it is in the same row', () => {
    /* The ceiling is still the add-on's to state — it is a reach fact, not a
       component preference — and it still bounds what the preview offers.
       Below about 64px a target stops being reliably hittable with a thumb,
       and five items is where a 360px phone reaches that. */
    expect(maxItemsWithFab(false)).toBe(MAX_BOTTOM_ITEMS);
    expect(maxItemsWithFab(true)).toBe(MAX_BOTTOM_ITEMS - 1);
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

describe('a variable the BUILD will bind still has to exist', () => {
  /* The add-on ships holes. A bottom bar's labels are added when the nav is
     built, and the builder binds each one's visibility to Show-Labels — so
     the definition gates on nothing and the variable still has to be there.
     A layer bound to a name the file does not have is unbound, and an unbound
     visibility renders as permanently visible rather than as an error. */
  const def = mobileNavDefinition({ layout: 'bottom-only' });

  it('is not among the conditions the definition binds', () => {
    expect(conditionsUsedBy(def)).not.toContain('Adaptive-Nav/Show-Labels');
  });

  it('is published anyway', () => {
    expect(conditionsToPublish(def)).toContain('Adaptive-Nav/Show-Labels');
  });

  it('reaches the payload, with a value at every breakpoint', () => {
    const bps = [{ id: 'xs', label: 'xs', minWidth: 0 }, { id: 'md', label: 'md', minWidth: 900 }];
    const spec: any = toAddonSpec(def, {
      breakpoints: bps,
      matrix: { 'Adaptive-Nav/Show-Labels': { xs: false, md: true } },
    });
    expect(spec.responsive.matrix['Adaptive-Nav/Show-Labels']).toEqual({ xs: false, md: true });
  });

  it('and is asked for as a token, so a pre-publish check catches a file without it', () => {
    expect(tokensUsed(def)).toContain('Adaptive-Nav/Show-Labels');
  });

  it('does NOT publish every declared condition — only the marked one', () => {
    /* Otherwise an add-on asks every design system for variables nothing
       reads, which is the failure this exception is carved out of. */
    const declared = Object.keys(def.conditions ?? {});
    const published = conditionsToPublish(def);
    expect(declared.length).toBeGreaterThan(published.length);
  });
});
