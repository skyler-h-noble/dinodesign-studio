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

  it('every layout sticks its bar by default, and only its bar', () => {
    /* Exactly one sticky node: applied to the root it would pin the whole nav,
       and in the rail layout it would pin a full-height rail that is already
       in view. */
    for (const l of ['brand-left', 'brand-centre', 'rail', 'hero'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l })} showSlots />);
      expect([l, (out.match(/position:sticky/g) || []).length]).toEqual([l, 1]);
    }
  });

  it('the two plain bars can be told not to stick', () => {
    /* A marketing page whose nav gives way to the content is a real design.
       The other two cannot: a rail layout is an application frame, and a frame
       whose bar scrolls off leaves the rail beside nothing. */
    for (const l of ['brand-left', 'brand-centre'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l, sticky: false })} showSlots />);
      expect([l, out.includes('position:sticky')]).toEqual([l, false]);
    }
    for (const l of ['rail', 'hero'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l, sticky: false })} showSlots />);
      expect([l, out.includes('position:sticky')]).toEqual([l, true]);
    }
  });
});

describe('what it does not pretend to do', () => {
  it('renders slots as regions, not as controls', () => {
    /* A definition has no behaviour, so neither compiler can produce any.
       Miming a button that does nothing would misrepresent what has been
       designed. */
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left', avatar: true })} showSlots />);
    expect(out).not.toContain('<button');
    expect(out).toContain('Avatar');
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

  it('and the sticky element is one that has a background', () => {
    // Sticky without a background is transparent over whatever scrolls beneath.
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} showSlots />);
    const sticky = out.slice(0, out.indexOf('position:sticky'));
    const openTag = sticky.lastIndexOf('<div style="');
    const tag = out.slice(openTag, out.indexOf('>', out.indexOf('position:sticky')));
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
    // The non-shrinking wrapper is for supplied content only — an unfilled
    // slot must not reserve space it has no reason to hold.
    const out = html(<DefinitionRenderer definition={navDefinition({ layout: 'brand-left' })} />);
    expect(out).not.toContain('flex-shrink:0');
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
