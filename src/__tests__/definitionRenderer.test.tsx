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

  it('every layout sticks its bar, and only its bar', () => {
    /* The bar is always sticky — a top nav that scrolls away is a header
       rather than a navigation, so it was never a real choice. Exactly one
       sticky node per layout: applied to the root it would pin the whole nav,
       and in the rail layout it would pin a full-height rail that is already
       in view. */
    for (const l of ['brand-left', 'brand-centre', 'rail', 'hero'] as const) {
      const out = html(<DefinitionRenderer definition={navDefinition({ layout: l })} showSlots />);
      expect((out.match(/position:sticky/g) || []).length, l).toBe(1);
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
