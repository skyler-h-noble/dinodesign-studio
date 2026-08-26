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
            componentProperties: { Orientation: { value: 'Vertica' } },
            children: [
              { name: 'Divider', type: 'INSTANCE', visible: true,
                componentProperties: { Orientation: { value: 'Vertical' } } },
            ] },
        ],
      },
    };
    const dropped = computeDrift(f, '<Box />').filter(x => x.kind === 'variant-dropped');
    expect(dropped).toHaveLength(2);
    const byOwner = Object.fromEntries(dropped.map(d => [d.where, d.detail]));
    expect(byOwner.List).toBe('Orientation = Vertica');
    expect(byOwner['List > Divider']).toBe('Orientation = Vertical');
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
