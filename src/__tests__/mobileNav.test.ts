import { describe, it, expect } from 'vitest';
import {
  mobileNavDefinition, MOBILE_LAYOUTS, MAX_BOTTOM_ITEMS, maxItemsWithFab, bottomItemCounts, bottomBarItems,
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

describe('two to five items', () => {
  it('one is not navigation', () => {
    /* There is nowhere to go from one item, and a bar holding it is a button
       that has taken the whole edge. The picker starts at two, and a count
       below it is lifted to two rather than shown. */
    expect(bottomItemCounts(false)).toEqual([2, 3, 4, 5]);
    expect(bottomItemCounts(true)).toEqual([2, 3, 4]);
    const item = (n: number) => ({ label: `Item ${n}` });
    expect(bottomBarItems([item(1), item(2), item(3)], 1, item).map((i) => i.label))
      .toEqual(['Item 1', 'Item 2']);
  });

  it('the count is what the bar shows — padded with stand-ins past the tabs', () => {
    /* Four tabs and a count of five showed four: the tabs were mapped
       straight through and the count changed nothing. */
    const item = (n: number) => ({ label: `Tab ${n}` });
    const tabs = [item(1), item(2), item(3), item(4)];
    expect(bottomBarItems(tabs, 5, (n) => ({ label: `Item ${n}` })).map((i) => i.label))
      .toEqual(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Item 5']);
    expect(bottomBarItems(tabs, 3, item).map((i) => i.label)).toEqual(['Tab 1', 'Tab 2', 'Tab 3']);
  });

  it('a FAB takes one of the five, because it is in the same row', () => {
    /* The ceiling is still the add-on's to state — it is a reach fact, not a
       component preference — and it still bounds what the preview offers.
       Below about 64px a target stops being reliably hittable with a thumb,
       and five items is where a 360px phone reaches that. */
    expect(maxItemsWithFab(false)).toBe(MAX_BOTTOM_ITEMS);
    expect(maxItemsWithFab(true)).toBe(MAX_BOTTOM_ITEMS - 1);
  });
});

describe('the FAB is the component\'s, not the definition\'s', () => {
  /* It sits IN the bar in an item's place — an outlined ring, at the end or
     centred — and the Nav-Bar component draws it. So the frame carries no
     slot for it, and a centred one no longer splits the items into two
     slots with a FAB slot between: whatever fills the one slot places the
     ring. The option survives because it drives the preview and the reach
     ceiling. */
  for (const fabPosition of ['center', 'end'] as const) {
    it(`${fabPosition}: the bar is one slot, with nothing beside it`, () => {
      const spec: any = toAddonSpec(mobileNavDefinition({
        layout: 'bottom-only', itemCount: 4, fab: true, fabPosition,
      }));
      const bar = spec.root.children.find((c: any) => c.name === 'Bottom-Bar');
      expect(bar.children.map((c: any) => c.name)).toEqual(['Nav-Item-Slot']);
      expect(names(spec)).not.toContain('FAB');
    });
  }

  it('the toolbar carries none either', () => {
    const spec: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar', fab: true }));
    expect(names(spec)).not.toContain('FAB');
  });

  it('still takes one of the five places', () => {
    expect(maxItemsWithFab(true)).toBe(MAX_BOTTOM_ITEMS - 1);
  });
});

describe('the toolbar', () => {
  it('runs across or down', () => {
    const v: any = toAddonSpec(mobileNavDefinition({ layout: 'toolbar', toolbarOrientation: 'vertical' }));
    const tb = v.root.children.find((c: any) => c.name === 'Toolbar');
    expect(tb.layoutMode).toBe('VERTICAL');
    expect(tb.layoutSizingHorizontal).toBe('HUG');
  });
});

describe('fixed or floating — the frame does one thing or the other', () => {
  /* The Nav-Bar component paints ITSELF in both styles: its own fill, and as
     a floating pill its own corners. So the frame around it never paints a
     floating bar — doing so put a full-width band behind the pill, a bar
     inside a bar in two tones of the same surface. The frame's only job when
     floating is the inset off the screen edge.

     Fixed is the reverse. The bar is the edge, so the frame carries the
     surface, the band and the elevation — and NO inset, which showed as a
     stripe of frame around a component meant to reach the corners. */
  const frameOf = (name: string, o: object): any =>
    (toAddonSpec(mobileNavDefinition(o as any)) as any).root.children
      .find((c: any) => c.name === name);

  for (const [layout, name] of [['bottom-only', 'Bottom-Bar'], ['toolbar', 'Toolbar']] as const) {
    it(`${name}: floating is an unpainted inset`, () => {
      const f = frameOf(name, { layout, barStyle: 'floating', theme: 'Primary', surface: 'Surface-Dim' });
      expect(f.fills).toBeUndefined();
      expect(f.cornerRadius).toBeUndefined();
      /* The page's margin, not a spacing step: the pill's outer edge lines
         up with the page's contents, the way the desktop bar's do. */
      expect(f.paddingLeft).toEqual({ var: 'Margin' });
      expect(f.paddingTop).toEqual({ var: 'Sizing-2' });
    });

    it(`${name}: fixed is painted, edge to edge`, () => {
      const f = frameOf(name, { layout, barStyle: 'fixed', theme: 'Primary', surface: 'Surface-Dim' });
      expect(f.fills).toEqual([{ type: 'SOLID', color: { var: 'Surface-Dim/Background' } }]);
      expect(f.paddingLeft).toBeUndefined();
      expect(f.paddingTop).toBeUndefined();
    });
  }

  it('the style is one axis for both bars, not a toolbar-only one', () => {
    /* When it was toolbarStyle the preview read it for the bottom bar too,
       so the preview floated a pill inside a frame the definition had
       painted as a fixed band. One field, read by both. */
    const bottom = frameOf('Bottom-Bar', { layout: 'top-and-bottom', barStyle: 'floating' });
    expect(bottom.fills).toBeUndefined();
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
