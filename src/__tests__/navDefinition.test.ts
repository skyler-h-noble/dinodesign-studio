import { describe, it, expect } from 'vitest';
import { navDefinition, applyExclusivity, defaultNavMatrix, NAV_LAYOUTS, NAV_CONDITIONS, type NavLayout } from '../utils/addOns/navDefinition';
import { toAddonSpec, tokensUsed, conditionsUsedBy } from '../utils/addOns/toAddonSpec';

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

  it('every layout carries a Bar', () => {
    for (const l of ALL) expect(names(toAddonSpec(full(l))), l).toContain('Bar');
  });

  it('the brand goes wherever the top-left corner is', () => {
    /* A full-height rail occupies that corner, so it carries the brand and the
       bar beside it starts with the title. Under a full-width bar the rail
       does not reach the corner, and the brand stays in the bar. In both, one
       place only: two would show it twice, neither would leave the corner
       empty. */
    const beside: any = toAddonSpec(navDefinition({ layout: 'rail', barPosition: 'beside-rail' }));
    const rail = beside.root.children.find((c: any) => c.name === 'Rail');
    const bar = beside.root.children.find((c: any) => c.name === 'Bar');
    expect(names(rail)).toContain('Brand');
    expect(names(bar)).not.toContain('Brand');

    const above: any = toAddonSpec(navDefinition({ layout: 'rail', barPosition: 'above-rail' }));
    const railAbove = above.root.children.find((c: any) => c.name === 'Rail');
    const barAbove = above.root.children.find((c: any) => c.name === 'Bar');
    expect(names(barAbove)).toContain('Brand');
    expect(names(railAbove)).not.toContain('Brand');
  });

  it('an End exists wherever the bar holds actions', () => {
    /* Hero has none: its actions sit over the image, and an empty End would
       still take part in the SPACE_BETWEEN and push the tabs off centre.
       Adding one for symmetry would be a slot that means nothing and can
       still be filled by mistake. */
    for (const l of ['brand-left', 'brand-centre', 'rail'] as NavLayout[]) {
      expect(names(toAddonSpec(full(l))), l).toContain('End');
    }
    const heroBar = (toAddonSpec(full('hero')) as any).root.children
      .find((c: any) => c.name === 'Bar');
    expect(names(heroBar)).not.toContain('End');
  });

  it('the middle region is named for what goes in it', () => {
    /* 'Center' described a position, not a purpose. In the rail layout that
       region is the page TITLE, the way an application bar works, and a slot
       named for where it sits tells a designer nothing about what to put
       there.
       
       Hero has two regions, not three: navigation leads and fills, actions sit
       at the end. Inventing an empty middle for symmetry would put a slot in
       the file that means nothing and can still be filled. */
    for (const l of ['brand-left', 'brand-centre'] as NavLayout[]) {
      expect(names(toAddonSpec(full(l))), l).toContain('Center');
    }
    expect(names(toAddonSpec(full('rail')))).toContain('Title');
    expect(names(toAddonSpec(full('hero')))).not.toContain('Center');
  });
});

describe('what differs between them', () => {
  it('brand-centre centres the brand rather than parking it after the tabs', () => {
    /* Superseded assertion: this used to require the CENTRE slot to fill, which
       is the arrangement that put the brand off-centre — the sides are
       different widths, so the leftover region is not central. The property
       that matters is where the brand ends up, and the geometry that gets it
       there is asserted in its own block below. */
    const spec: any = toAddonSpec(full('brand-centre'));
    const centre = spec.root.children[0].children.find((c: any) => c.name === 'Center');
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
    const def = navDefinition({ layout: 'brand-left' });
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
    const area = spec.root.children.find((c: any) => c.name === 'Hero-Area');
    const hero = area.children.find((c: any) => c.name === 'Hero');
    expect(hero).toBeTruthy();
    expect(hero.children).toBeUndefined();
    expect(hero.layoutSizingHorizontal).toBe('FILL');
  });

  it('the tab strip sits UNDER the hero area', () => {
    const spec: any = toAddonSpec(full('hero'));
    expect(spec.root.layoutMode).toBe('VERTICAL');
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Hero-Area', 'Bar']);
  });

  it('the actions sit OVER the hero, not in the strip', () => {
    /* The strip under a hero is navigation and nothing else. An overlay
       anchors to its PARENT, which is why the hero and its floating content
       are wrapped together — on the root it would pin to the whole nav and
       hang over the tab strip too. */
    const spec: any = toAddonSpec(full('hero'));
    const area = spec.root.children.find((c: any) => c.name === 'Hero-Area');
    const actions = area.children.find((c: any) => c.name === 'Hero-Actions');
    expect(actions.layoutPositioning).toBe('ABSOLUTE');
    expect(actions.constraints).toEqual({ horizontal: 'MAX', vertical: 'MIN' });

    const bar = spec.root.children.find((c: any) => c.name === 'Bar');
    expect(names(bar)).toContain('Tabs');
    expect(names(bar)).not.toContain('Avatar');
  });

  it('the actions are never in two places at once', () => {
    /* Condensed brings them into the strip, and the overlay copy goes at the
       same moment. Two variables set in opposition, because neither target can
       express "not X" on a visibility binding. */
    const spec: any = toAddonSpec(navDefinition({ layout: 'hero', avatar: true, condensed: true }));
    const area = spec.root.children.find((c: any) => c.name === 'Hero-Area');
    const overlay = area.children.find((c: any) => c.name === 'Hero-Actions');
    const bar = spec.root.children.find((c: any) => c.name === 'Bar');
    const end = bar.children.find((c: any) => c.name === 'End');
    expect(overlay.visibleWhen).toBe('Adaptive-Nav/Hide-When-Condensed');
    expect(end.visibleWhen).toBe('Adaptive-Nav/Show-Condensed');
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
    const bar = navDefinition({ layout: 'hero' }).root.children!.find((c) => c.name === 'Bar');
    expect(bar!.sticky).toBe(true);
  });
});

describe('the condensed state is scroll-driven, not width-driven', () => {
  it('is declared with a scroll trigger', () => {
    /* The distinction is not decoration: no media query can detect scroll
       position, so a compiler that treated this like the device conditions
       would emit a breakpoint for a state a breakpoint cannot see. */
    expect(NAV_CONDITIONS['Adaptive-Nav/Show-Condensed'].trigger).toBe('scroll');
    for (const name of Object.keys(NAV_CONDITIONS)) {
      if (name === 'Adaptive-Nav/Show-Condensed') continue;
      expect(NAV_CONDITIONS[name].trigger, name).toBe('device');
    }
  });

  it('puts brand and actions behind it, not in the bar outright', () => {
    /* Unconditional, they would show while the hero is still on screen —
       duplicating what the hero already shows, which is why the plain hero
       bar carries no brand at all. */
    const spec: any = toAddonSpec(navDefinition({ layout: 'hero', avatar: true, condensed: true }));
    const bar = spec.root.children.find((c: any) => c.name === 'Bar');
    const find = (n: any, name: string): any =>
      n.name === name ? n : (n.children || []).map((c: any) => find(c, name)).find(Boolean);
    expect(find(bar, 'Condensed-Brand').visibleWhen).toBe('Adaptive-Nav/Show-Condensed');
    expect(find(bar, 'End').visibleWhen).toBe('Adaptive-Nav/Show-Condensed');
  });

  it('is absent entirely when not asked for', () => {
    const spec: any = toAddonSpec(navDefinition({ layout: 'hero', avatar: true }));
    expect(JSON.stringify(spec)).not.toContain('Condensed');
  });

  it('only the hero layout offers it', () => {
    // The other three have no hero to scroll past.
    for (const l of ['brand-left', 'brand-centre', 'rail'] as NavLayout[]) {
      const spec = toAddonSpec(navDefinition({ layout: l, condensed: true, avatar: true }));
      expect(JSON.stringify(spec), l).not.toContain('Condensed');
    }
  });
});

describe('the rail can sit beside the bar or under it', () => {
  it('beside: the rail runs full height and comes first', () => {
    /* The bar occupies only the column to the rail's right, which is what puts
       the brand above the CONTENT rather than above the rail. */
    const spec: any = toAddonSpec(navDefinition({ layout: 'rail', barPosition: 'beside-rail' }));
    expect(spec.root.layoutMode).toBe('HORIZONTAL');
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Rail', 'Bar']);
  });

  it('above: the bar spans the width and the rail starts beneath it', () => {
    const spec: any = toAddonSpec(navDefinition({ layout: 'rail', barPosition: 'above-rail' }));
    expect(spec.root.layoutMode).toBe('VERTICAL');
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Bar', 'Rail']);
  });

  it('beside is the default', () => {
    const spec: any = toAddonSpec(navDefinition({ layout: 'rail' }));
    expect(spec.root.children.map((c: any) => c.name)).toEqual(['Rail', 'Bar']);
  });

  it('the rail is a sibling either way', () => {
    // Nested under the bar its height would be the bar's, and it would stop
    // being a rail.
    for (const pos of ['beside-rail', 'above-rail'] as const) {
      const spec: any = toAddonSpec(navDefinition({ layout: 'rail', barPosition: pos }));
      const bar = spec.root.children.find((c: any) => c.name === 'Bar');
      expect(names(bar), pos).not.toContain('Rail');
    }
  });

  it('the bar sticks in both, and the rail never does', () => {
    /* A full-height rail is already in view; sticking it would pin something
       that cannot scroll out of view anyway. */
    for (const pos of ['beside-rail', 'above-rail'] as const) {
      const def = navDefinition({ layout: 'rail', barPosition: pos });
      const bar = def.root.children!.find((c) => c.name === 'Bar');
      const rail = def.root.children!.find((c) => c.name === 'Rail');
      expect(bar!.sticky, pos).toBe(true);
      expect(rail!.sticky, pos).toBeUndefined();
    }
  });
});

describe('conditions are scoped to the arrangement', () => {
  it('a layout with no rail does not ask for Show-Rail', () => {
    /* Offering it would put a switch on the page that gates nothing — and
       switched on, it says a part exists when it does not. It would also tell
       the design system to provide a variable nothing binds to. */
    expect(tokensUsed(full('brand-left'))).not.toContain('Adaptive-Nav/Show-Rail');
    expect(tokensUsed(full('rail'))).toContain('Adaptive-Nav/Show-Rail');
  });

  it('only hero asks for the scroll conditions', () => {
    for (const l of ['brand-left', 'brand-centre', 'rail'] as NavLayout[]) {
      expect(tokensUsed(navDefinition({ layout: l, condensed: true })), l)
        .not.toContain('Adaptive-Nav/Show-Condensed');
    }
  });
});

describe('brand centred means centred in the BAR', () => {
  it('both side groups fill, so the middle is genuinely central', () => {
    /* Filling the MIDDLE and centring inside it is the obvious arrangement and
       it is wrong: the tabs and the actions are different widths, so the
       leftover region is off-centre and the brand lands wherever it falls.
       Equal flex on both sides is what centres it, whatever they hold. */
    const spec: any = toAddonSpec(full('brand-centre'));
    const bar = spec.root.children[0];
    const [start, centre, end] = bar.children;
    expect(start.layoutSizingHorizontal).toBe('FILL');
    expect(end.layoutSizingHorizontal).toBe('FILL');
    expect(centre.layoutSizingHorizontal).toBe('HUG');
  });

  it('the sides push outward', () => {
    const spec: any = toAddonSpec(full('brand-centre'));
    const [start, , end] = spec.root.children[0].children;
    expect(start.primaryAxisAlignItems).toBe('MIN');
    expect(end.primaryAxisAlignItems).toBe('MAX');
  });

  it('and the brand is the thing in the middle', () => {
    const spec: any = toAddonSpec(full('brand-centre'));
    expect(names(spec.root.children[0].children[1])).toContain('Brand');
  });
});

describe('tabs and the menu button are one decision', () => {
  const TABS = 'Adaptive-Nav/Show-Tabs';
  const MENU = 'Adaptive-Nav/Show-Menu-Button';

  it('turning one on turns the other off', () => {
    /* Both on shows two navigations. Neither state fails — they just look
       wrong in a way that is easy to create and hard to notice. */
    const row = { [TABS]: true, [MENU]: false };
    expect(applyExclusivity(row, MENU, true)).toEqual({ [TABS]: false, [MENU]: true });
  });

  it('turning the last one off is refused, not obeyed', () => {
    // A nav with no navigation in it is not a state worth being able to reach
    // by accident.
    const row = { [TABS]: true, [MENU]: false };
    expect(applyExclusivity(row, TABS, false)).toEqual(row);
  });

  it('but turning one off is fine when the other is already on', () => {
    const row = { [TABS]: true, [MENU]: true };
    expect(applyExclusivity(row, TABS, false)).toEqual({ [TABS]: false, [MENU]: true });
  });

  it('leaves conditions outside any group alone', () => {
    const row = { 'Adaptive-Nav/Show-Search': true, [TABS]: true, [MENU]: false };
    const out = applyExclusivity(row, 'Adaptive-Nav/Show-Search', false);
    expect(out['Adaptive-Nav/Show-Search']).toBe(false);
    expect(out[TABS]).toBe(true);
  });

  it('the starting table already respects it', () => {
    // Otherwise the rule would be enforced on edit but violated on open.
    const m = defaultNavMatrix([TABS, MENU], [
      { id: 'xs', minWidth: 0 }, { id: 'lg', minWidth: 1280 },
    ]);
    for (const bp of ['xs', 'lg']) expect([bp, m[TABS][bp] === m[MENU][bp]]).toEqual([bp, false]);
  });
});

describe('the responsive table travels with the spec', () => {
  const BPS = [
    { id: 'xs', label: 'xs', minWidth: 0 },
    { id: 'md', label: 'md', minWidth: 900 },
  ];
  const def = navDefinition({ layout: 'brand-left', search: true, avatar: true });
  const matrix = defaultNavMatrix(Object.keys(NAV_CONDITIONS), BPS);

  it('a spec without it records no decision at all', () => {
    /* The binding alone is not the design. Hiding search at xs and showing it
       at md is two values of one variable, and a spec that only says "this
       layer's visibility is bound" leaves both unwritten — while looking
       correct, because the binding is there. */
    const bare: any = toAddonSpec(def);
    expect(bare.responsive).toBeUndefined();
    expect(JSON.stringify(bare)).toContain('visibleWhen');
  });

  it('with it, every gated condition carries a value per breakpoint', () => {
    const spec: any = toAddonSpec(def, { breakpoints: BPS, matrix });
    for (const name of conditionsUsedBy(def)) {
      for (const bp of BPS) {
        expect([name, bp.id, typeof spec.responsive.matrix[name]?.[bp.id]])
          .toEqual([name, bp.id, 'boolean']);
      }
    }
  });

  it('records a genuine difference between widths', () => {
    // The whole point: hidden at one width, shown at another, both written.
    const spec: any = toAddonSpec(def, {
      breakpoints: BPS,
      matrix: { ...matrix, 'Adaptive-Nav/Show-Search': { xs: false, md: true } },
    });
    expect(spec.responsive.matrix['Adaptive-Nav/Show-Search']).toEqual({ xs: false, md: true });
  });

  it('carries the breakpoints, so widths can be matched to modes', () => {
    /* The matrix keys are breakpoint IDS, which mean nothing to the plugin on
       their own — it has to line them up with Device-Sizes modes by width. */
    const spec: any = toAddonSpec(def, { breakpoints: BPS, matrix });
    expect(spec.responsive.breakpoints.map((b: any) => b.minWidth)).toEqual([0, 900]);
  });

  it('omits conditions this arrangement does not gate on', () => {
    // Publishing a value for one nothing binds to would tell the plugin to
    // write a variable the component never reads.
    const spec: any = toAddonSpec(def, { breakpoints: BPS, matrix });
    expect(spec.responsive.matrix['Adaptive-Nav/Show-Rail']).toBeUndefined();
  });

  it('keeps scroll conditions in, at false everywhere', () => {
    /* Not a gap. No width makes them true, and leaving them out would leave
       those variables unwritten and looking like an oversight. */
    const hero = navDefinition({ layout: 'hero', avatar: true, condensed: true });
    const spec: any = toAddonSpec(hero, {
      breakpoints: BPS,
      matrix: defaultNavMatrix(Object.keys(NAV_CONDITIONS), BPS),
    });
    const condensed = spec.responsive.matrix['Adaptive-Nav/Show-Condensed'];
    expect(condensed).toEqual({ xs: false, md: false });
  });
});
