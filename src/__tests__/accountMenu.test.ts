import { describe, it, expect } from 'vitest';
import {
  accountNode, accountMenuProblems, ACCOUNT_MENU_CONDITION,
  DEFAULT_ACCOUNT_MENU, type AccountMenuItem,
} from '../utils/addOns/accountMenu';
import { navDefinition, NAV_CONDITIONS, defaultNavMatrix } from '../utils/addOns/navDefinition';
import { mobileNavDefinition, MOBILE_CONDITIONS } from '../utils/addOns/mobileNav';
import { toAddonSpec, conditionsUsedBy, tokensUsed } from '../utils/addOns/toAddonSpec';
import type { NodeDef } from '../utils/addOns/defineComponent';

const find = (n: NodeDef, name: string): NodeDef | undefined => {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const hit = find(c, name);
    if (hit) return hit;
  }
  return undefined;
};

const findSpec = (n: any, name: string): any => {
  if (n?.name === name) return n;
  for (const c of n?.children || []) {
    const hit = findSpec(c, name);
    if (hit) return hit;
  }
  return undefined;
};

describe('the avatar without a menu is unchanged', () => {
  /* The wrapper exists ONLY to give a panel something to hang off. Emitting it
     either way would put an extra frame in every design that does not use the
     menu — and a frame in Figma is not free: it is a layer a designer has to
     understand before they can move the avatar. */
  it('is the bare slot', () => {
    expect(accountNode({})).toEqual({
      name: 'Avatar', kind: 'slot', width: 'hug', height: 'hug',
    });
  });

  it('keeps the gate on the slot itself', () => {
    expect(accountNode({ when: 'Adaptive-Nav/Show-Avatar' }).presence)
      .toEqual({ when: 'Adaptive-Nav/Show-Avatar' });
  });
});

describe('the avatar with a menu', () => {
  const node = accountNode({ withMenu: true, when: 'Adaptive-Nav/Show-Avatar' });

  it('gates the GROUP, not the avatar inside it', () => {
    /* One decision evaluated once. Repeated on the child it would be the copy
       somebody forgot to change — and the menu cannot be open at a width where
       the control that opens it is not there. */
    expect(node.presence).toEqual({ when: 'Adaptive-Nav/Show-Avatar' });
    expect(find(node, 'Avatar')!.presence).toBeUndefined();
  });

  it('hangs the panel under the avatar, aligned to the right edge', () => {
    /* Not a preference. A panel left-aligned under a control at the RIGHT of a
       bar runs off the page — the alignment is which edge there is room on. */
    const panel = find(node, 'Account-Menu')!;
    expect(panel.overlay).toEqual({ anchor: 'top-right', drop: true });
    expect(panel.presence).toEqual({ when: ACCOUNT_MENU_CONDITION });
  });

  it('leaves the rows as a slot', () => {
    /* The same division as the tabs. Rows baked into the definition would ship
       this library's menu to every design system that imports the add-on,
       which is the values-not-names failure applied to content. */
    expect(find(node, 'Account-Menu')!.kind).toBe('slot');
  });

  it('carries no colour anywhere — only levels and token names', () => {
    const panel = find(node, 'Account-Menu')!;
    expect(panel.surface).toBe('Surface-Brightest');
    expect(panel.radius).toEqual({ token: 'Other/Dropdown-Frame-Radius' });
    /* The edge is a NAME too. A panel at the brightest level over a page that
       is also at the brightest level has no boundary, so the level alone does
       not do it — and a literal here would ship this library's border to every
       design system that imported the add-on. */
    expect(panel.border).toEqual({ token: 'Border' });
    expect(JSON.stringify(node)).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

describe('open is not a width', () => {
  it('is declared as an interaction, on both layouts', () => {
    /* Not `scroll`, though neither is width-driven: scroll is ambient and
       undoes itself, while this one has been asked for and stays until it is
       dismissed. One trigger for both would put a scroll listener on a menu. */
    expect(NAV_CONDITIONS[ACCOUNT_MENU_CONDITION].trigger).toBe('interaction');
    expect(MOBILE_CONDITIONS[ACCOUNT_MENU_CONDITION].trigger).toBe('interaction');
  });

  it('seeds false at every breakpoint', () => {
    /* The seed used to test for 'scroll' by name, which would have seeded this
       one TRUE — the menu open at every width, in the published table, as a
       recorded design decision. */
    const bps = [{ id: 'xs', minWidth: 0 }, { id: 'lg', minWidth: 1280 }];
    const seed = defaultNavMatrix([ACCOUNT_MENU_CONDITION], bps);
    expect(seed[ACCOUNT_MENU_CONDITION]).toEqual({ xs: false, lg: false });
  });

  it('is still published, so the design system has the variable', () => {
    /* False everywhere is not a reason to omit it. A component binds its
       panel's visibility to this name; leaving it out of the payload would
       leave that binding pointing at a variable the file does not have. */
    const def = navDefinition({ layout: 'brand-left', avatar: true, avatarMenu: true });
    expect(conditionsUsedBy(def)).toContain(ACCOUNT_MENU_CONDITION);
    expect(tokensUsed(def)).toContain(ACCOUNT_MENU_CONDITION);
  });
});

describe('nothing changes when the menu is off', () => {
  it('adds no condition and no panel', () => {
    const def = navDefinition({ layout: 'brand-left', avatar: true });
    expect(conditionsUsedBy(def)).not.toContain(ACCOUNT_MENU_CONDITION);
    expect(find(def.root, 'Account-Menu')).toBeUndefined();
    expect(find(def.root, 'Account')).toBeUndefined();
  });
});

describe('the mobile bar gets the same panel', () => {
  it('from the same builder, not a second one', () => {
    const def = mobileNavDefinition({ layout: 'top-only', showAvatar: true, avatarMenu: true });
    const panel = find(def.root, 'Account-Menu')!;
    const desktop = find(
      navDefinition({ layout: 'brand-left', avatar: true, avatarMenu: true }).root,
      'Account-Menu',
    )!;
    expect(panel).toEqual(desktop);
  });

  it('and none without the option', () => {
    const def = mobileNavDefinition({ layout: 'top-only', showAvatar: true });
    expect(find(def.root, 'Account-Menu')).toBeUndefined();
  });
});

describe('the Figma side', () => {
  const spec: any = toAddonSpec(
    navDefinition({ layout: 'brand-left', avatar: true, avatarMenu: true }),
  );

  it('pins the panel below the bar rather than to a corner', () => {
    const panel = findSpec(spec.root, 'Account-Menu');
    expect(panel.layoutPositioning).toBe('ABSOLUTE');
    /* MIN vertically even though the anchor says 'top-right': a dropping panel
       keeps its distance from the parent's TOP as the parent grows. MAX would
       slide it up over the control it drops from the moment the bar got
       taller. */
    expect(panel.constraints).toEqual({ horizontal: 'MAX', vertical: 'MIN' });
  });

  it('stops every frame on the path from clipping it', () => {
    /* Not just the immediate parent. A frame clips by default, and clipping
       ANYWHERE up the chain is enough to hide the panel completely — with no
       error and nothing on the canvas to say it is there. */
    const path = (n: any, name: string, acc: any[] = []): any[] | null => {
      if (n.name === name) return acc;
      for (const c of n.children || []) {
        const hit = path(c, name, [...acc, n]);
        if (hit) return hit;
      }
      return null;
    };
    const ancestors = path(spec.root, 'Account-Menu')!;
    expect(ancestors.length).toBeGreaterThan(1);
    for (const a of ancestors) expect(a.clipsContent, a.name).toBe(false);
  });

  it('leaves frames alone when nothing drops', () => {
    const plain: any = toAddonSpec(navDefinition({ layout: 'brand-left', avatar: true }));
    expect(JSON.stringify(plain)).not.toContain('clipsContent');
  });

  it('draws the hairline inside the frame, not straddling it', () => {
    /* Figma centres a stroke by default, which puts half a pixel outside the
       bounds — on a rounded panel that leaves the corners a half-pixel proud
       of the fill they are meant to trace. */
    const panel = findSpec(spec.root, 'Account-Menu');
    expect(panel.strokes).toEqual([{ type: 'SOLID', color: { var: 'Border' } }]);
    expect(panel.strokeAlign).toBe('INSIDE');
  });

  it('binds the panel visibility rather than baking it', () => {
    expect(findSpec(spec.root, 'Account-Menu').visibleWhen).toBe(ACCOUNT_MENU_CONDITION);
  });
});

describe('rows that would ship broken', () => {
  it('refuses a blank label', () => {
    /* A row with no text is a clickable empty strip announced as nothing —
       it looks like padding rather than like a fault, which is why it is
       checked here instead of being left to notice. */
    const items: AccountMenuItem[] = [{ id: 'a', label: '   ' }];
    expect(accountMenuProblems(items).join(' ')).toContain('No label');
  });

  it('refuses an empty menu', () => {
    // An avatar that opens nothing is worse than one that does nothing: it
    // takes focus, announces itself as a menu, and then has no menu.
    expect(accountMenuProblems([]).join(' ')).toContain('No rows');
  });

  it('accepts the default list', () => {
    expect(accountMenuProblems(DEFAULT_ACCOUNT_MENU)).toEqual([]);
  });

  it('never puts a rule above the first row', () => {
    // A line drawn against nothing.
    expect(DEFAULT_ACCOUNT_MENU[0].dividerBefore).toBeFalsy();
  });
});
