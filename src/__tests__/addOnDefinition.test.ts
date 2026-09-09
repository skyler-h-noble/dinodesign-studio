import { describe, it, expect } from 'vitest';
import { slotBar } from '../utils/addOns/defineComponent';
import { toAddonSpec, tokensUsed } from '../utils/addOns/toAddonSpec';

/* The definition is only worth having if what it compiles to is genuinely
   portable — names, never values. These assert the properties that make that
   true, rather than the shape of one output. */

const spec: any = toAddonSpec(slotBar);
const bar = spec.root.children[0];
const divider = spec.root.children[1];

describe('nothing resolved travels in a spec', () => {
  it('carries no hex, anywhere', () => {
    /* A literal colour ships the AUTHOR's brand to every customer who imports
       the add-on, and nothing reports it — it only appears when someone opens
       it in a different palette, by which point it is published. */
    expect(JSON.stringify(spec)).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('carries no raw pixel numbers for spacing or size', () => {
    // A number here is a token that was not declared. The definition type has
    // nowhere to put one, so finding one means the compiler invented it.
    for (const field of ['itemSpacing', 'paddingTop', 'paddingLeft', 'cornerRadius', 'width', 'height']) {
      const found: unknown[] = [];
      const walk = (n: any) => {
        if (!n || typeof n !== 'object') return;
        if (n[field] !== undefined && typeof n[field] === 'number') found.push(n[field]);
        (n.children || []).forEach(walk);
      };
      walk(spec.root);
      expect(found, `${field} emitted a raw number`).toEqual([]);
    }
  });

  it('every styled value is a { var } binding', () => {
    expect(bar.itemSpacing).toEqual({ var: 'Sizing-2' });
    expect(bar.paddingLeft).toEqual({ var: 'Sizing-3' });
    expect(spec.root.fills[0].color).toEqual({ var: 'Surface/Background' });
  });
});

describe('sizing stays adaptive', () => {
  it('fill and hug are never baked to a measurement', () => {
    /* The whole reason a bar can become a nav. A fixed px here would pin the
       component at whatever width the author's frame happened to be. */
    expect(bar.layoutSizingHorizontal).toBe('FILL');
    expect(bar.layoutSizingVertical).toBe('HUG');
    expect(bar.width).toBeUndefined();
    expect(bar.height).toBeUndefined();
  });

  it('a fixed size is still a token, not a number', () => {
    expect(divider.layoutSizingVertical).toBe('FIXED');
    expect(divider.height).toEqual({ var: 'Sizing-Quarter' });
  });

  it('the three slots divide the bar without a spacer element', () => {
    // start hugs, center fills, end hugs — which is what puts brand left and
    // actions right with no filler node to keep in sync.
    const [start, center, end] = bar.children;
    expect([start.layoutSizingHorizontal, center.layoutSizingHorizontal, end.layoutSizingHorizontal])
      .toEqual(['HUG', 'FILL', 'HUG']);
    expect(bar.primaryAxisAlignItems).toBe('SPACE_BETWEEN');
  });
});

describe('conditional parts bind rather than resolve', () => {
  it('an optional part becomes visibleWhen, not visible:false', () => {
    /* Setting the literal would bake whichever state the author had active —
       the snapshot problem that loses most of a responsive design. */
    expect(divider.visibleWhen).toBe('Adaptive-Nav/Show-Divider');
    expect(divider.visible).toBeUndefined();
  });

  it('every `when` names a declared condition', () => {
    // A breakpoint invented by a typo is a layer that never shows and never
    // errors. The declared set is what makes that catchable.
    const declared = Object.keys(slotBar.conditions || {});
    const used: string[] = [];
    const walk = (n: any) => {
      if (n.visibleWhen) used.push(n.visibleWhen);
      (n.children || []).forEach(walk);
    };
    walk(spec.root);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((u) => !declared.includes(u))).toEqual([]);
  });
});

describe('the tokens it needs are knowable before publishing', () => {
  it('lists every referenced token', () => {
    /* An add-on naming a variable the customer lacks imports with that field
       silently unbound — no error, just a component that looks subtly wrong.
       Enumerating them is what allows a pre-publish check. */
    expect(tokensUsed(slotBar)).toEqual([
      'Adaptive-Nav/Show-Divider',
      'Sizing-2',
      'Sizing-3',
      'Sizing-Quarter',
      'Surface-Dim/Background',
      'Surface/Background',
    ]);
  });

  it('names are collection-RELATIVE, not prefixed with the collection', () => {
    /* The plugin indexes local variables by v.name, the path WITHIN a
       collection. 'Sizing/Sizing-2' matched nothing and imported with the
       field unbound — Figma's default, which looks like a design decision.
       A group inside a collection DOES count, hence Surface/Background. */
    const tokens = tokensUsed(slotBar);
    expect(tokens).toContain('Sizing-2');
    expect(tokens.filter((t) => t.startsWith('Sizing/'))).toEqual([]);
    expect(tokens).toContain('Surface/Background');
  });

  it('conditions are listed as tokens the file must have', () => {
    // Omitting them let a definition pass a token check and still import with
    // its conditional parts unbound.
    expect(tokensUsed(slotBar)).toContain('Adaptive-Nav/Show-Divider');
  });
});
