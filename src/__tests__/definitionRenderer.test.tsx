import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DefinitionRenderer from '../components/DefinitionRenderer';
import { navDefinition } from '../utils/addOns/navDefinition';
import { toAddonSpec } from '../utils/addOns/toAddonSpec';

/* The renderer is the SECOND compiler, so what matters is that it makes the
   same decisions as the first from the same definition. A preview built on it
   cannot drift from the spec, which is the entire reason it replaced a
   hand-drawn schematic. */

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('the surface level becomes an attribute, not a colour', () => {
  it('sets data-surface and paints var(--Background)', () => {
    /* The definition stores a LEVEL because the two targets place it
       differently: Figma names the variable group, the DOM carries an
       attribute. Naming the colour directly here would bypass the cascade and
       leave text and border on the parent's tone. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} />);
    expect(out).toContain('data-surface="Surface"');
    expect(out).toContain('var(--Background)');
    expect(out).not.toContain('var(--Surface)');
  });
});

describe('conditions decide rendering, on both targets', () => {
  const def = navDefinition({ layout: 'brand-left' });

  it('a part behind a false condition is not rendered', () => {
    const out = html(<DefinitionRenderer definition={def} conditions={{}} showSlots />);
    expect(out).not.toContain('Menu-Button');
  });

  it('and appears when it is true', () => {
    const out = html(
      <DefinitionRenderer definition={def}
        conditions={{ 'Adaptive-Nav/Show-Menu-Button': true }} showSlots />,
    );
    expect(out).toContain('Menu-Button');
  });

  it('an unknown condition reads as false rather than true', () => {
    // A part behind a condition nobody set should stay hidden, not appear by
    // accident — the same way a Figma layer bound to a false boolean does.
    const out = html(<DefinitionRenderer definition={def} showSlots />);
    expect(out).not.toContain('Menu-Button');
  });

  it('the same parts are conditional here as in the spec', () => {
    /* The check that makes "one definition, two compilers" true. Anything
       carrying visibleWhen in the spec must be condition-gated here, or the
       preview shows a state the Figma component cannot. */
    const spec: any = toAddonSpec(def);
    const gated: string[] = [];
    const walk = (n: any) => { if (n.visibleWhen) gated.push(n.name); (n.children || []).forEach(walk); };
    walk(spec.root);

    const none = html(<DefinitionRenderer definition={def} conditions={{}} showSlots />);
    for (const name of gated) expect(none, name).not.toContain(name);
  });
});

describe('sizing stays adaptive', () => {
  it('fill becomes flex, never a measured width', () => {
    /* Asserted WITHOUT showSlots. That flag adds a min-width so empty slots
       are visible while designing; it is preview scaffolding, not layout, and
       including it here would test the affordance rather than the component. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} />);
    expect(out).toContain('flex:1 1 0%');
    expect(out).not.toMatch(/[^-]width:\d+px/);
  });

  it('the preview scaffolding stays out of the real render', () => {
    // Otherwise a dashed outline and a minimum size would ship inside whatever
    // consumes this.
    const real = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} />);
    expect(real).not.toContain('dashed');
    /* min-width:0 is allowed and expected — it is the flex idiom that stops a
       filling child from overflowing its row. What must not appear is a
       MEASURED minimum, which is the placeholder size. */
    expect(real).not.toMatch(/min-width:\d+px/);
    expect(real).toContain('min-width:0');
  });
});

describe('sticky is a node, not the component', () => {
  it('only the hero bar sticks', () => {
    /* Applied to the root it would pin the hero to the viewport — the
       opposite of the pattern. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'hero' })} showSlots />);
    expect(out.match(/position:sticky/g) || []).toHaveLength(1);
  });

  it('pins the bar only where it spans the whole width', () => {
    /* Pinning means left:0 right:0, so a pinned bar spans everything under it
       — including a rail. That is the arrangement "beside the rail" exists to
       avoid, so there the bar sticks within its own column instead and the
       rail is never underneath it.
       
       An APP BAR is out of the flow. A HERO's strip is not: it scrolls with
       the page until it reaches the top and then sticks, which is what
       position:sticky actually means and the one place it is right. */
    for (const l of ['brand-left', 'brand-centre'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l })} showSlots />);
      expect([l, (out.match(/position:fixed/g) || []).length]).toEqual([l, 1]);
    }
    const above = html(<DefinitionRenderer
      definition={navDefinition({ layout: 'rail', barPosition: 'above-rail' })} showSlots />);
    expect((above.match(/position:fixed/g) || []).length).toBe(1);

    const beside = html(<DefinitionRenderer
      definition={navDefinition({ layout: 'rail', barPosition: 'beside-rail' })} showSlots />);
    expect(beside.includes('position:fixed')).toBe(false);
    expect((beside.match(/position:sticky/g) || []).length).toBe(1);

    const hero = html(<DefinitionRenderer definition={navDefinition({ layout: 'hero' })} showSlots />);
    expect((hero.match(/position:sticky/g) || []).length).toBe(1);
  });

  it('a bar told not to stick still leaves the flow', () => {
    /* A marketing page whose nav gives way to the content is a real design —
       but the bar is still pinned to the top of the page, just absolutely
       rather than to the viewport. Dropping it back into the flow would be a
       different LAYOUT, and the page would then be inset for a bar that was
       also taking its own space. */
    for (const l of ['brand-left', 'brand-centre'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l, sticky: false })} showSlots />);
      expect([l, out.includes('position:absolute')]).toEqual([l, true]);
      expect([l, out.includes('position:fixed')]).toEqual([l, false]);
    }
    /* The rail layout cannot be told: it is an application frame, and a frame
       whose bar scrolls off leaves the rail beside nothing. */
    const rail = html(<DefinitionRenderer definition={navDefinition({ layout: 'rail', sticky: false })} showSlots />);
    expect(rail.includes('position:sticky')).toBe(true);
  });

  it('carries the design system\'s app bar elevation, by level', () => {
    /* --Effect-Level-2, not a shadow written here: the level comes from
       Component-Elevations (the "AppBar, Toolbars, Menus" group) so the bar
       follows the brand's own shadow controls. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} showSlots />);
    expect(out).toContain('box-shadow:var(--Effect-Level-2)');
  });
});

describe('the app bar paints itself', () => {
  it('carries data-surface and data-theme, not just the root', () => {
    /* A sticky bar over scrolling content must have its OWN background, or the
       content shows through as it passes under — the one thing a sticky bar
       cannot do. Inheriting the custom properties is not enough: they cascade,
       but nothing paints. */
    const out = html(
      <DefinitionRenderer
        definition={navDefinition({ layout: 'brand-left', theme: 'Primary', surface: 'Surface-Bright' })}
        showSlots
      />,
    );
    expect((out.match(/data-surface="Surface-Bright"/g) || []).length).toBeGreaterThan(1);
    expect((out.match(/data-theme="Primary"/g) || []).length).toBeGreaterThan(1);
  });

  it('and the pinned element is one that has a background', () => {
    // Pinned without a background is transparent over whatever scrolls beneath.
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} showSlots />);
    const before = out.slice(0, out.indexOf('position:fixed'));
    const openTag = before.lastIndexOf('<div style="');
    const tag = out.slice(openTag, out.indexOf('>', out.indexOf('position:fixed')));
    expect(tag).toContain('background:var(--Background)');
  });
});

describe('a filled slot holds its content at natural size', () => {
  const filled = (
    <DefinitionRenderer
      definition={navDefinition({ layout: 'brand-left' })}
      conditions={{ 'Adaptive-Nav/Show-Tabs': true }}
      slots={{ Tabs: <span>TABS</span> }}
    />
  );

  it('centres rather than stretching it', () => {
    /* align-items defaults to stretch, so a tab strip grew to the slot's full
       height and left a tall empty bar under it. */
    const out = html(filled);
    const at = out.indexOf('TABS');
    expect(out.slice(0, at)).toContain('align-items:center');
  });

  it('and does not let it be crushed', () => {
    /* min-width:0 is needed so a FILL slot can shrink — but applied to the
       CONTENT it squeezed four tabs into four hairlines. The slot still
       shrinks; what is in it overflows instead, which is visible and is what
       the breakpoint switches exist to resolve. */
    const out = html(filled);
    const at = out.indexOf('TABS');
    expect(out.slice(0, at)).toContain('flex-shrink:0');
  });

  it('an empty slot still collapses to nothing', () => {
    /* The non-shrinking wrapper is for supplied content only — an unfilled
       slot must not reserve space it has no reason to hold.
       
       Scoped to the SLOT, not the whole tree: a fixed-size node sets
       flex-shrink:0 legitimately, and the bar is App-Bar Height now, so a
       blanket search caught the bar and reported it as a slot reserving
       space. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} showSlots />);
    const slotTag = out.slice(out.indexOf('Tabs') - 600, out.indexOf('Tabs'));
    expect(slotTag).not.toContain('flex-shrink:0');
  });
});

describe('a capped band paints edge to edge', () => {
  it('caps its CONTENT, not itself', () => {
    /* Capping the band left bare page either side of a floating coloured
       strip. Capping only what is inside gives an unbroken bar with its
       content aligned to the rest of the page, which is what a content
       ceiling means everywhere else. */
    const out = html(
      <DefinitionRenderer
        definition={navDefinition({ layout: 'brand-left', surface: 'Surface' })}
        contentMaxWidth={1440}
        contentAlign="center"
        showSlots
      />,
    );
    // The painted element carries no cap...
    const barTag = out.slice(out.indexOf('data-surface'), out.indexOf('data-surface') + 400);
    expect(out).toContain('max-width:1440px');
    // ...and the capped element is INSIDE it, not around it.
    expect(out.indexOf('background:var(--Background)')).toBeLessThan(out.indexOf('max-width:1440px'));
    expect(barTag).not.toContain('max-width:1440px');
  });

  it('is uncapped when the breakpoint has no ceiling', () => {
    // The same nav at every narrower width — the cap belongs to the
    // breakpoint, not the component.
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} showSlots />);
    expect(out).not.toContain('max-width:1440px');
  });
});

describe('a panel that drops from its trigger', () => {
  const def = navDefinition({ layout: 'brand-left', avatar: true, avatarMenu: true });
  const open = {
    'Adaptive-Nav/Show-Avatar': true,
    'Adaptive-Nav/Show-Account-Menu': true,
    // No account without a session — the menu cannot be open for a visitor.
    'Adaptive-Nav/Signed-In': true,
  };

  it('hangs under the parent rather than inside a corner', () => {
    /* The four corner anchors place a panel INSIDE the parent, inset from that
       corner — which for a dropdown puts it on top of the control it opens
       from. `drop` is the difference, and it has to survive compilation or the
       menu covers the avatar. */
    const out = html(<DefinitionRenderer definition={def} conditions={open} showSlots />);
    expect(out).toContain('top:100%');
    expect(out).toContain('right:0');
    // The inset corner offsets belong to the OTHER kind of overlay.
    expect(out).not.toContain('top:var(--Sizing-2, 8px)');
  });

  it('is not rendered at all when the condition is false', () => {
    const out = html(
      <DefinitionRenderer definition={def}
        conditions={{ 'Adaptive-Nav/Show-Avatar': true }} showSlots />,
    );
    expect(out).not.toContain('Account-Menu');
  });

  it('gives the panel a stacking order that clears the bar', () => {
    // A panel that paints under the bar it drops from is not a panel.
    const out = html(<DefinitionRenderer definition={def} conditions={open} showSlots />);
    expect(out).toMatch(/z-index:2\d/);
  });

  it('does not clip the frame the panel escapes from', () => {
    /* The rounded-corner clip and a dropping child are in direct conflict:
       the rule that tidies a panel's corners would delete the panel hanging
       out of the frame above it. */
    const out = html(<DefinitionRenderer definition={def} conditions={open} showSlots />);
    const account = out.indexOf('Account-Menu');
    expect(account).toBeGreaterThan(-1);
    // The panel itself still clips its own rows to its radius.
    expect(out).toContain('overflow:hidden');
  });
});

describe('a column slot lays its content out in a column', () => {
  it('does not centre each row on its own width', () => {
    /* align-items is the CROSS axis, so 'center' on a column slot centres each
       row individually AND the wrapper's implicit row direction lays them side
       by side — a menu rendered as a line of items. */
    const def = navDefinition({ layout: 'brand-left', avatar: true, avatarMenu: true });
    const out = html(
      <DefinitionRenderer
        definition={def}
        conditions={{
          'Adaptive-Nav/Show-Avatar': true,
          'Adaptive-Nav/Show-Account-Menu': true,
          'Adaptive-Nav/Signed-In': true,
        }}
        slots={{ 'Account-Menu': <span>rows</span> }}
      />,
    );
    const panel = out.slice(out.indexOf('flex-direction:column'));
    expect(panel).toContain('align-items:stretch');
  });
});
