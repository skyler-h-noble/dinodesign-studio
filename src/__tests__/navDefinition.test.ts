import { describe, it, expect } from 'vitest';
import { navDefinition, NAV_LAYOUTS, NAV_CONDITIONS, type NavLayout } from '../utils/addOns/navDefinition';
import { toAddonSpec, tokensUsed } from '../utils/addOns/toAddonSpec';

const ALL: NavLayout[] = NAV_LAYOUTS.map((l) => l.id);
const full = (layout: NavLayout) =>
  navDefinition({ layout, search: true, actions: true, avatar: true });

/** Accepts a spec or a bare node, so a subtree can be asserted on directly. */
const names = (specOrNode: any): string[] => {
  const out: string[] = [];
  const walk = (n: any) => { if (n?.name) out.push(n.name); (n?.children || []).forEach(walk); };
  walk(specOrNode?.root ?? specOrNode);
  return out;
};

describe('three layouts, one component', () => {
  it('every layout produces the same add-on id', () => {
    /* They are one component with a picked layout, not three add-ons. Three
       ids would triple the spec surface for one axis of difference and let
       the shared parts drift apart. */
    for (const l of ALL) expect(navDefinition({ layout: l }).id).toBe('adaptive-nav');
  });

  it('every layout carries a Bar with a Start and an End', () => {
    for (const l of ALL) {
      const n = names(toAddonSpec(full(l)));
      expect(n, l).toContain('Bar');
      for (const slot of ['Start', 'End']) expect(n, `${l}/${slot}`).toContain(slot);
    }
  });

  it('a Center exists only where there is a middle region', () => {
    /* Hero has two regions, not three: navigation leads and fills, actions sit
       at the end. Inventing an empty Center for symmetry would put a slot in
       the file that means nothing and can still be filled. */
    for (const l of ['brand-left', 'brand-centre', 'rail'] as NavLayout[]) {
      expect(names(toAddonSpec(full(l))), l).toContain('Center');
    }
    expect(names(toAddonSpec(full('hero')))).not.toContain('Center');
  });
});

describe('what differs between them', () => {
  it('brand-centre puts the brand in the FILLING centre slot', () => {
    // Otherwise "centred" only means "after whatever is on the left".
    const spec: any = toAddonSpec(full('brand-centre'));
    const centre = spec.root.children[0].children.find((c: any) => c.name === 'Center');
    expect(centre.layoutSizingHorizontal).toBe('FILL');
    expect(centre.primaryAxisAlignItems).toBe('CENTER');
    expect(names(centre)).toContain('Brand');
  });

  it('brand-left keeps navigation in the centre, not the brand', () => {
    const spec: any = toAddonSpec(full('brand-left'));
    const centre = spec.root.children[0].children.find((c: any) => c.name === 'Center');
    expect(names(centre)).toContain('Tabs');
    expect(names(centre)).not.toContain('Brand');
  });

  it('the rail is a SIBLING of the bar, not a child', () => {
    /* It runs the full height beside the content. Nested under the bar its
       height would be the bar's, which is a rail in name only. */
    const spec: any = toAddonSpec(full('rail'));
    const top = spec.root.children.map((c: any) => c.name);
    expect(top).toEqual(['Rail', 'Bar']);
    expect(spec.root.layoutMode).toBe('HORIZONTAL');
  });

  it('the rail layout carries no tabs in the bar', () => {
    // Navigation lives in the rail; duplicating it inline would be two places
    // to keep in step.
    const spec: any = toAddonSpec(full('rail'));
    const bar = spec.root.children.find((c: any) => c.name === 'Bar');
    expect(names(bar)).not.toContain('Tabs');
  });
});

describe('the responsive axis is bound, never baked', () => {
  it('tabs and the menu button are separate conditions', () => {
    /* Exactly one shows at any width. Two conditions rather than one boolean
       is what lets a designer see both states — with a single flag, one of
       them is unreachable in the file. */
    const spec: any = toAddonSpec(full('brand-left'));
    const conds: string[] = [];
    const walk = (n: any) => { if (n.visibleWhen) conds.push(n.visibleWhen); (n.children || []).forEach(walk); };
    walk(spec.root);
    expect(conds).toContain('Adaptive-Nav/Show-Tabs');
    expect(conds).toContain('Adaptive-Nav/Show-Menu-Button');
  });

  it('every condition used is declared', () => {
    // A breakpoint invented by a typo is a layer that never shows and never
    // errors.
    for (const l of ALL) {
      const spec: any = toAddonSpec(full(l));
      const conds: string[] = [];
      const walk = (n: any) => { if (n.visibleWhen) conds.push(n.visibleWhen); (n.children || []).forEach(walk); };
      walk(spec.root);
      expect(conds.filter((c) => !(c in NAV_CONDITIONS)), l).toEqual([]);
    }
  });

  it('no part is hidden outright', () => {
    // visible:false would bake one breakpoint in and drop the rest.
    for (const l of ALL) {
      expect(JSON.stringify(toAddonSpec(full(l))), l).not.toContain('"visible":false');
    }
  });
});

describe('sticky has no Figma equivalent', () => {
  it('is carried on the definition but absent from the spec', () => {
    /* Figma has no scroll behaviour. A flag that means nothing on one target
       is better than a frame that pretends to. */
    const def = navDefinition({ layout: 'brand-left', sticky: true });
    expect(JSON.stringify(toAddonSpec(def))).not.toContain('sticky');
  });
});

describe('what a design system must provide', () => {
  it('lists conditions alongside the sizing and surface tokens', () => {
    const tokens = tokensUsed(full('rail'));
    expect(tokens).toContain('Adaptive-Nav/Show-Rail');
    expect(tokens).toContain('Surface/Background');
    expect(tokens).toContain('Sizing-2');
    expect(tokens.filter((t) => t.startsWith('Sizing/'))).toEqual([]);
  });

  it('carries no hardcoded colour or size', () => {
    for (const l of ALL) {
      const json = JSON.stringify(toAddonSpec(full(l)));
      expect(json, l).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});

describe('optional slots', () => {
  it('an unselected slot is absent, not hidden', () => {
    /* Nothing to bind and nothing to render — a slot the user did not ask for
       should not exist at all, rather than exist and be invisible. */
    const spec: any = toAddonSpec(navDefinition({ layout: 'brand-left', avatar: true }));
    expect(names(spec)).toContain('Avatar');
    expect(names(spec)).not.toContain('Search');
  });
});

describe('hero with sticky tabs', () => {
  it('the hero is a SLOT, not a structure', () => {
    /* It is a separate add-on. Defining its internals here would be a second
       definition of the same thing to keep in step. */
    const spec: any = toAddonSpec(full('hero'));
    const hero = spec.root.children.find((c: any) => c.name === 'Hero');
    expect(hero).toBeTruthy();
    expect(hero.children).toBeUndefined();
    expect(hero.layoutSizingHorizontal).toBe('FILL');
  });

  it('the tab strip sits UNDER the hero', () => {
    const spec: any = toAddonSpec(full('hero'));
    expect(spec.root.layoutMode).toBe('VERTICAL');
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Hero', 'Bar']);
  });

  it('carries no brand in the bar', () => {
    /* The brand belongs to the hero. Repeating it would show it twice before
       the bar sticks — and still twice after, since nothing removes the
       hero's copy on scroll. */
    const spec: any = toAddonSpec(full('hero'));
    const bar = spec.root.children.find((c: any) => c.name === 'Bar');
    expect(names(bar)).not.toContain('Brand');
    expect(names(bar)).toContain('Tabs');
  });

  it('sticky is on the BAR, not the component', () => {
    /* The hero scrolls away and only the tabs stay. A component-level flag
       cannot say which part remains, and applied to the root it would pin the
       hero to the viewport — the opposite of the pattern. */
    const def = navDefinition({ layout: 'hero' });
    const bar = def.root.children!.find((c) => c.name === 'Bar');
    expect(bar!.sticky).toBe(true);
    expect(def.root.sticky).toBeUndefined();
  });

  it('and never reaches the spec', () => {
    // Figma has no scroll behaviour.
    expect(JSON.stringify(toAddonSpec(full('hero')))).not.toContain('sticky');
  });

  it('is intrinsic, not an option', () => {
    // Tabs under a hero that do not stick are simply tabs under a hero.
    const off = navDefinition({ layout: 'hero', sticky: false });
    const bar = off.root.children!.find((c) => c.name === 'Bar');
    expect(bar!.sticky).toBe(true);
  });
});
