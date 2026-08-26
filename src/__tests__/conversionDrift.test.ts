/**
 * Drift detection — the checks the live preview cannot make.
 *
 * Each case here is a failure mode that renders as something plausible, which
 * is why it needs an assertion rather than an eyeball: a hardcoded hex looks
 * identical to the token it should have used, a dropped variant gives you the
 * component's default, and a row Figma hid just looks like a row.
 */
import { describe, it, expect } from 'vitest';
import { computeDrift, driftSummary } from '../utils/conversionDrift';

const frame = (children: unknown[]) => ({
  document: { name: 'Frame', type: 'FRAME', visible: true, children },
});

describe('computeDrift', () => {
  it('says nothing about empty code', () => {
    expect(computeDrift(frame([]), '')).toEqual([]);
  });

  it('flags hardcoded colours, in every notation', () => {
    const jsx = '<Box style={{ color: "#3794ff", background: "rgb(10, 20, 30)" }} />';
    const kinds = computeDrift(frame([]), jsx).filter(f => f.kind === 'hardcoded-color');
    expect(kinds).toHaveLength(2);
    expect(kinds.every(f => f.severity === 'error')).toBe(true);
  });

  it('does not flag token references', () => {
    const jsx = '<Box style={{ color: "var(--Text)", background: "var(--Background)" }} />';
    expect(computeDrift(frame([]), jsx).filter(f => f.kind === 'hardcoded-color')).toHaveLength(0);
  });

  // The one that started this: a list item whose second row is hidden in Figma
  // and rendered anyway looks exactly like a list item with two rows.
  it('flags a hidden layer that was rendered', () => {
    const f = frame([
      { name: 'Row 1', type: 'TEXT', visible: true, characters: 'First row' },
      { name: 'Row 2', type: 'TEXT', visible: false, characters: 'Second row' },
    ]);
    const jsx = '<ListItem><Body>First row</Body><Body>Second row</Body></ListItem>';
    const hidden = computeDrift(f, jsx).filter(x => x.kind === 'hidden-rendered');
    expect(hidden).toHaveLength(1);
    expect(hidden[0].detail).toBe('"Second row"');
    expect(hidden[0].where).toBe('Row 2');
    expect(hidden[0].severity).toBe('error');
  });

  it('stays quiet when the hidden layer was correctly dropped', () => {
    const f = frame([
      { name: 'Row 1', type: 'TEXT', visible: true, characters: 'First row' },
      { name: 'Row 2', type: 'TEXT', visible: false, characters: 'Second row' },
    ]);
    const jsx = '<ListItem><Body>First row</Body></ListItem>';
    expect(computeDrift(f, jsx).filter(x => x.kind === 'hidden-rendered')).toHaveLength(0);
  });

  it('flags a variant that did not become a prop', () => {
    const f = frame([{
      name: 'Button', type: 'INSTANCE', visible: true,
      componentProperties: { 'Size#1:0': { value: 'Small' }, Appearance: { value: 'Secondary' } },
    }]);
    const jsx = '<Button>Save</Button>';
    const dropped = computeDrift(f, jsx).filter(x => x.kind === 'variant-dropped');
    expect(dropped.map(d => d.detail).sort()).toEqual(['Appearance = Secondary', 'Size = Small']);
    // The message names the instance, so a frame with five Dividers is actionable.
    expect(dropped.every(d => d.message.startsWith('Button:'))).toBe(true);
    expect(dropped.every(d => d.where === 'Button')).toBe(true);
  });

  it('accepts a variant that reached the code, whatever the casing', () => {
    const f = frame([{
      name: 'Button', type: 'INSTANCE', visible: true,
      componentProperties: { Size: { value: 'Small' } },
    }]);
    expect(
      computeDrift(f, '<Button size="small">Save</Button>')
        .filter(x => x.kind === 'variant-dropped'),
    ).toHaveLength(0);
  });

  it('ignores default-ish variant values', () => {
    const f = frame([{
      name: 'Button', type: 'INSTANCE', visible: true,
      componentProperties: { State: { value: 'Default' } },
    }]);
    expect(computeDrift(f, '<Button />').filter(x => x.kind === 'variant-dropped')).toHaveLength(0);
  });

  it('flags frame text missing from the code, but ignores very short strings', () => {
    const f = frame([
      { name: 'T1', type: 'TEXT', visible: true, characters: 'Account settings' },
      { name: 'T2', type: 'TEXT', visible: true, characters: 'OK' },
    ]);
    const missing = computeDrift(f, '<Card />').filter(x => x.kind === 'text-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].detail).toBe('Account settings');
  });

  it('reads the REST envelope, a nodes entry, or a bare document', () => {
    const doc = { name: 'F', type: 'FRAME', visible: true, children: [
      { name: 'T', type: 'TEXT', visible: true, characters: 'Hello there' },
    ] };
    const expected = 1;
    for (const shape of [{ document: doc }, { nodes: { '1:2': { document: doc } } }, doc]) {
      expect(
        computeDrift(shape, '<Card />').filter(x => x.kind === 'text-missing'),
      ).toHaveLength(expected);
    }
  });

  it('orders errors before warnings before info, and counts them', () => {
    const f = frame([
      { name: 'Hidden Thing', type: 'TEXT', visible: false, characters: 'ghost' },
      { name: 'T', type: 'TEXT', visible: true, characters: 'Missing copy' },
    ]);
    const jsx = '<Box style={{ color: "#fff" }}>Hidden Thing</Box>';
    const findings = computeDrift(f, jsx);
    const severities = findings.map(f2 => f2.severity);
    expect(severities).toEqual([...severities].sort((a, b) =>
      ({ error: 0, warning: 1, info: 2 }[a] - { error: 0, warning: 1, info: 2 }[b])));
    const counts = driftSummary(findings);
    expect(counts.errors).toBeGreaterThan(0);
    expect(counts.warnings).toBeGreaterThan(0);
  });

  // Two instances of the same component with different variant values must
  // both be reported — keying only on prop=value collapsed them into one.
  it('reports the same variant separately per instance, and locates each', () => {
    const f = {
      document: {
        name: 'Frame', type: 'FRAME', visible: true, children: [
          { name: 'List', type: 'INSTANCE', visible: true,
            componentProperties: { Orientation: { value: 'Slanted' } },
            children: [
              { name: 'Divider', type: 'INSTANCE', visible: true,
                componentProperties: { Orientation: { value: 'Diagonal' } } },
            ] },
        ],
      },
    };
    const dropped = computeDrift(f, '<Box />').filter(x => x.kind === 'variant-dropped');
    expect(dropped).toHaveLength(2);
    const byOwner = Object.fromEntries(dropped.map(d => [d.where, d.detail]));
    expect(byOwner.List).toBe('Orientation = Slanted');
    expect(byOwner['List > Divider']).toBe('Orientation = Diagonal');
  });

  it('does not mistake a hex inside a comment for code', () => {
    const jsx = '// was #ff0000 before\n<Box style={{ color: "var(--Text)" }} />';
    expect(computeDrift(frame([]), jsx).filter(f => f.kind === 'hardcoded-color')).toHaveLength(0);
  });
});

// ─── Dropped slots ────────────────────────────────────────────────────────────
//
// The failure that prompted this: a "+ Button" in Figma converted to a plain
// <Button>Button</Button>. Nothing else here catches it — the slot holds no
// text, so text-missing is silent, and the instance inside is named "Icon",
// which instance-unmapped treats as mapped. The button still renders and still
// reads as a button, which is exactly why it needs an assertion.
describe('slot-dropped', () => {
  const buttonWith = (slots: unknown[]) => ({
    document: {
      name: 'Frame', type: 'FRAME', visible: true,
      children: [{ name: 'Button', type: 'INSTANCE', visible: true, children: slots }],
    },
  });

  const startSlot = {
    name: 'Start Slot', type: 'FRAME', visible: true,
    children: [{ name: 'Icon', type: 'INSTANCE', visible: true }],
  };

  it('flags a visible start slot with content that the code ignores', () => {
    const f = computeDrift(buttonWith([startSlot]), '<Button>Button</Button>')
      .filter(x => x.kind === 'slot-dropped');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
    expect(f[0].detail).toBe('Icon');
  });

  it('accepts startIcon', () => {
    expect(computeDrift(buttonWith([startSlot]),
      '<Button startIcon={<Icon><AddIcon /></Icon>}>Button</Button>')
      .filter(x => x.kind === 'slot-dropped')).toHaveLength(0);
  });

  it('accepts startDecorator', () => {
    expect(computeDrift(buttonWith([startSlot]),
      '<Button startDecorator={<Avatar />}>Button</Button>')
      .filter(x => x.kind === 'slot-dropped')).toHaveLength(0);
  });

  // An empty slot is the component's placeholder, not content the design chose.
  it('ignores a visible but EMPTY slot', () => {
    const empty = { name: 'End Slot', type: 'FRAME', visible: true, children: [] };
    expect(computeDrift(buttonWith([empty]), '<Button>Button</Button>')
      .filter(x => x.kind === 'slot-dropped')).toHaveLength(0);
  });

  // Hidden slots never reach the model, so they must never be demanded of it.
  it('ignores a hidden slot even when it has content', () => {
    const hidden = {
      name: 'End Slot', type: 'FRAME', visible: false,
      children: [{ name: 'Icon', type: 'INSTANCE', visible: true }],
    };
    expect(computeDrift(buttonWith([hidden]), '<Button>Button</Button>')
      .filter(x => x.kind === 'slot-dropped')).toHaveLength(0);
  });

  it('tells the two sides apart', () => {
    const endSlot = {
      name: 'End Slot', type: 'FRAME', visible: true,
      children: [{ name: 'Icon', type: 'INSTANCE', visible: true }],
    };
    // startIcon set, end slot still dropped.
    const f = computeDrift(buttonWith([startSlot, endSlot]),
      '<Button startIcon={<Icon><AddIcon /></Icon>}>Button</Button>')
      .filter(x => x.kind === 'slot-dropped');
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/^End Slot/);
  });
});

// ─── Noise control ────────────────────────────────────────────────────────────
//
// One real frame produced twelve findings and eleven were wrong. A report that
// is mostly wrong stops being read, and then the one real finding in it is lost
// too — so suppressing these is not cosmetic.
describe('drift does not report correct code', () => {
  const inst = (name: string, props: Record<string, string>, extra: object = {}) => ({
    document: {
      name: 'Test New', type: 'FRAME', visible: true,
      children: [{
        name, type: 'INSTANCE', visible: true,
        componentProperties: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { value: v }]),
        ),
        ...extra,
      }],
    },
  });

  // Each of these is a variant whose value IS the component's default, so code
  // that passes nothing is correct.
  const defaults: Array<[string, string, string]> = [
    ['Divider', 'Orientation', 'horizontal'],
    ['List', 'Orientation', 'Vertical'],
    ['List', 'Type', 'Non-Clickable List'],
    ['List Item', 'State', 'Non-Clickable'],
    ['Avatar', 'Style', 'Photo'],
    ['Button-Small', 'Style', 'solid'],
    ['Button-Small', 'Type', 'text'],
    ['Icon', 'Style', 'Filled'],
  ];
  for (const [owner, prop, value] of defaults) {
    it(`ignores ${owner} ${prop}="${value}" — that is the default`, () => {
      const found = computeDrift(inst(owner, { [prop]: value }), '<Box />')
        .filter(f => f.kind === 'variant-dropped');
      expect(`${owner}.${prop}: ${found.length} findings`).toBe(`${owner}.${prop}: 0 findings`);
    });
  }

  it('still reports a value that is NOT a default', () => {
    expect(computeDrift(inst('Divider', { Orientation: 'Slanted' }), '<Box />')
      .filter(f => f.kind === 'variant-dropped')).toHaveLength(1);
  });

  // A Ratio draws its own Image Placeholder; the icon inside it is the lib's,
  // and no prop on the generated code can reach it.
  it('ignores variants inside a library-owned subtree', () => {
    const frame = {
      document: {
        name: 'Test New', type: 'FRAME', visible: true,
        children: [{
          name: 'Image Placeholder', type: 'INSTANCE', visible: true,
          children: [{
            name: 'Icon', type: 'INSTANCE', visible: true,
            componentProperties: { Size: { value: 'Large' } },
          }],
        }],
      },
    };
    expect(computeDrift(frame, '<Ratio ratio="1:1" placeholder />')
      .filter(f => f.kind === 'variant-dropped')).toHaveLength(0);
  });

  // Figma stores a typographic apostrophe; the code has a straight one.
  it('matches text across curly and straight punctuation', () => {
    const frame = {
      document: {
        name: 'Test New', type: 'FRAME', visible: true,
        children: [{ name: 'Component Name', type: 'TEXT', visible: true, characters: '‘Let’s Do It!’' }],
      },
    };
    expect(computeDrift(frame, `<DisplaySmall>'Let's Do It!'</DisplaySmall>`)
      .filter(f => f.kind === 'text-missing')).toHaveLength(0);
  });
});

// ─── Unmapped instances ───────────────────────────────────────────────────────
describe('instance-unmapped ignores instances that ARE mapped', () => {
  const frameWith = (children: unknown[]) => ({
    document: { name: 'Test New', type: 'FRAME', visible: true, children },
  });
  const inst = (name: string, extra: object = {}) =>
    ({ name, type: 'INSTANCE', visible: true, ...extra });

  // A Figma instance carries its variant in its NAME. Stripping punctuation
  // turned these into tags that exist nowhere, and both map to a real
  // component plus a prop.
  it('matches "Ratio - Fill Vertical" to <Ratio>', () => {
    expect(computeDrift(frameWith([inst('Ratio - Fill Vertical')]),
      '<Ratio ratio="1:1" placeholder />')
      .filter(f => f.kind === 'instance-unmapped')).toHaveLength(0);
  });

  it('matches "Button-Small" to <Button>', () => {
    expect(computeDrift(frameWith([inst('Button-Small')]),
      '<Button size="small">Button</Button>')
      .filter(f => f.kind === 'instance-unmapped')).toHaveLength(0);
  });

  it('ignores instances inside a library-owned subtree', () => {
    const frame = frameWith([
      inst('Image Placeholder', {
        children: [inst('Icon', { children: [inst('photo')] })],
      }),
    ]);
    expect(computeDrift(frame, '<Ratio ratio="1:1" placeholder />')
      .filter(f => f.kind === 'instance-unmapped')).toHaveLength(0);
  });

  // The one real finding on that frame, and the reason the rest had to go.
  // One missing plus sign is ONE finding: the glyph. The "Icon" wrapper around
  // it names where the icon goes, not which icon it is, so reporting both makes
  // the reader work out they are the same thing.
  it('still reports a glyph the code never rendered, once', () => {
    const frame = frameWith([
      inst('Button-Small', { children: [inst('Icon', { children: [inst('add')] })] }),
    ]);
    const found = computeDrift(frame, '<Button size="small">Button</Button>')
      .filter(f => f.kind === 'instance-unmapped');
    expect(found.map(f => f.detail)).toEqual(['add']);
  });

  it('is silent once the glyph is rendered', () => {
    const frame = frameWith([
      inst('Button-Small', { children: [inst('Icon', { children: [inst('add')] })] }),
    ]);
    expect(computeDrift(frame,
      '<Button size="small" startIcon={<Icon><AddIcon /></Icon>}>Button</Button>')
      .filter(f => f.kind === 'instance-unmapped')).toHaveLength(0);
  });
});
