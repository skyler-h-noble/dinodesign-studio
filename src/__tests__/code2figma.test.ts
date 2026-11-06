/**
 * The code → Figma compiler (src/utils/code2figma/) and the live-vocabulary
 * fixes it needed in the Figma → code tables.
 *
 * What is pinned here:
 *   - phase 0: the variant tables against the LIVE Figma capture
 *     (figmaLibrary.live.json, 2026-11-06) — the Card Elevated / Drag fix, the
 *     Tag Theme axis, the live Card and List Item layer structure, Caption-Medium;
 *   - the inverses the code → Figma side reads (text styles, Button variant,
 *     icon names, variant tables) give their input back;
 *   - phase 1: the recorder's stand-ins record names and props, and copy the
 *     lib behaviors that decide what is on screen (closed overlays, active tab,
 *     heading level), with aliases found by identity;
 *   - phase 2: the mapper's layout, normalization and placeholder rules;
 *   - the acceptance test: code → IR → simulated Figma nodes → the existing
 *     Figma → code compiler → code, with the same components and props for
 *     every clean node — on a hand-written page and on two real omni-r5 states
 *     recorded by the runner (fixtures, so no bench app is needed here).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileFigmaFrame } from '../utils/aaid/compile';
import { buildIR } from '../utils/aaid/ir';
import { compileTree } from '../utils/aaid/emitJsx';
import {
  BUTTON_VARIANTS, CONSUMED_KEYS, EXPORT_TO_TEXT_STYLE, TEXT_STYLE_TO_EXPORT, VARIANT_TABLES, iconComponentName, iconGlyphFromComponent,
  invertVariantTable, normalizeStyleName,
} from '../utils/aaid/propTables';
import { buttonVariant, splitButtonVariant } from '../utils/figmaModeMapping';
import { LIBRARY, findSet, hasVariantValue } from '../utils/code2figma/library';
import { createRecorder, mediaMatches, parseStyle, type RecordedNode } from '../utils/code2figma/record';
import { mapRecorded, walkC2F } from '../utils/code2figma/mapper';
import { irSignatures, irToFigmaNode, jsxSignatures } from '../utils/code2figma/roundTrip';
import type { C2FDocument, InstanceNode, Node, TextNode } from '../utils/code2figma/schema';

type N = Record<string, any>;
const ROOT = process.cwd();
const fixture = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/__tests__/__fixtures__/code2figma', f), 'utf8'));

const txt = (characters: string, extra: N = {}): N => ({ id: `t-${characters}`, name: characters, type: 'TEXT', characters, ...extra });
const inst = (component: string, variant: N = {}, extra: N = {}): N => ({ id: extra.id ?? `i-${component}`, name: extra.name ?? component, type: 'INSTANCE', component, variant, ...extra });

// ── Phase 0: the live vocabulary ────────────────────────────────────────────

/** Table name → the live set it reads. */
const TABLE_SET: Record<string, string> = {
  Button: 'Button', Checkbox: 'Checkbox', Divider: 'Divider', Avatar: 'Avatar', Chip: 'Chip', Card: 'Card', List: 'List', ListItem: 'List Item', Box: 'Box',
};

/** Live axes no table reads yet — reported as unmapped notes, listed in docs/code-to-figma.md. */
const KNOWN_GAPS: Record<string, string[]> = { Box: ['Fit'] };

describe('phase 0 — the tables against the live Figma capture', () => {
  it('the capture is the real library file, with Card as Orientation × State × Elevated', () => {
    expect(LIBRARY.fileKey).toBe('Qv2dqF7mYoAGY77EkdrwTv');
    const card = findSet('Card')!;
    expect(Object.keys(card.axes).sort()).toEqual(['Elevated', 'Orientation', 'State']);
    expect(card.axes.State.values).toContain('Drag');
    expect(card.axes.Elevated.values.sort()).toEqual(['false', 'true']);
  });

  for (const [table, setName] of Object.entries(TABLE_SET)) {
    it(`${table}: every drawn row's axis and default exist in the live "${setName}" set, and every live axis is read`, () => {
      const set = findSet(setName)!;
      expect(set).toBeTruthy();
      const rows = VARIANT_TABLES[table];
      for (const r of rows.filter((x) => x.draw !== undefined)) {
        const liveAxis = set.axes[r.figma];
        const liveBool = Object.keys(set.properties).some((k) => k.replace(/#.*$/, '') === r.figma);
        expect(liveAxis || liveBool, `${table} ${r.figma}`).toBeTruthy();
        if (liveAxis) expect(liveAxis.values, `${table} ${r.figma} draw`).toContain(r.draw);
      }
      const read = new Set([...rows.map((r) => r.figma.toLowerCase()), ...(CONSUMED_KEYS[table] ?? [])]);
      for (const axis of Object.keys(set.axes)) {
        if ((KNOWN_GAPS[table] ?? []).includes(axis)) continue;
        expect(read.has(axis.toLowerCase()), `${table} reads live axis ${axis}`).toBe(true);
      }
    });
  }

  it('Card Elevated=true → elevated, with no unmapped note (the bug: the table read "Elevation")', () => {
    const { code, report } = compileFigmaFrame(inst('Card', { Orientation: 'vertical', State: 'Non-clickable', Elevated: 'true' }, { children: [txt('Body', { styleName: 'Body-Medium' })] }));
    expect(code).toMatch(/<Card elevated>/);
    expect(report.notes).toEqual([]);
  });

  it('Card Elevated=false → nothing; State=Drag → draggable, and not clickable', () => {
    const flat = compileFigmaFrame(inst('Card', { Orientation: 'vertical', State: 'Non-clickable', Elevated: 'false' }, { children: [txt('x', { styleName: 'Body-Medium' })] }));
    expect(flat.code).toMatch(/<Card>/);
    const drag = compileFigmaFrame(inst('Card', { Orientation: 'vertical', State: 'Drag', Elevated: 'true' }, { children: [txt('x', { styleName: 'Body-Medium' })] }));
    expect(drag.code).toMatch(/<Card draggable elevated>/);
    expect(drag.code).not.toMatch(/clickable/);
    expect(drag.report.notes).toEqual([]);
  });

  it('older files keep working: Elevation=elevated and Status=selected', () => {
    const { code } = compileFigmaFrame(inst('Card', { Elevation: 'elevated', Status: 'selected' }, { children: [txt('x', { styleName: 'Body-Medium' })] }));
    expect(code).toMatch(/<Card elevated selected>/);
  });

  it('the live Card layer structure: the Padded Card Content slot\'s children are the card\'s', () => {
    const card = inst('Card', { Orientation: 'vertical', State: 'Default', Elevated: 'false', Selected: 'true' }, {
      children: [{ id: 'cc', name: 'Card Container', type: 'FRAME', children: [{ id: 'cn', name: 'Card Content', type: 'FRAME', children: [
        { id: 'nb', name: 'No Bleed Card Content', type: 'SLOT', children: [] },
        { id: 'pc', name: 'Padded Card Content', type: 'SLOT', children: [txt('Inside', { styleName: 'Body-Medium' })] },
      ] }] }],
    });
    const { code } = compileFigmaFrame(card);
    expect(code).toMatch(/<Card clickable selected>\s*<Body>Inside<\/Body>\s*<\/Card>/);
  });

  it('Tag reads the live Theme axis and Fit=Fill', () => {
    const { code, report } = compileFigmaFrame(inst('Tag', { Theme: 'Success', Fit: 'Fill' }, { children: [txt('Active')] }));
    expect(code).toContain('<Tag color="success" width="fill">Active</Tag>');
    expect(report.notes).toEqual([]);
    expect(compileFigmaFrame(inst('Tag', { Theme: 'Default', Fit: 'Hug' }, { children: [txt('A')] })).code).toContain('<Tag>A</Tag>');
  });

  it('the live List Item: Content > Start Decorator / Text / End Decorator, clickable through State', () => {
    const item = inst('List Item', { State: 'Default', 'Bottom Border': 'false', 'Right Border': 'false', Image: 'false', Selected: 'false' }, {
      name: 'Row', sizingH: 'FILL',
      children: [
        { id: 'c', name: 'Content', type: 'FRAME', children: [
          { id: 's', name: 'Start Decorator', type: 'SLOT', children: [] },
          { id: 'tx', name: 'Text', type: 'FRAME', children: [txt('Jane', { styleName: 'Subtitle-Medium' }), txt('VP', { styleName: 'Body-Medium' })] },
          { id: 'e', name: 'End Decorator', type: 'SLOT', children: [] },
        ] },
        { id: 'd', name: 'Divider', type: 'INSTANCE', component: 'Divider', variant: {} },
      ],
    });
    const { code, report } = compileFigmaFrame(item);
    expect(code).toMatch(/<ListItem clickable secondary="VP">Jane<\/ListItem>/);
    expect(report.notes).toEqual([]);
  });

  it('the live List: rows inside the List Slot', () => {
    const row = (id: string, t: string) => inst('List Item', { State: 'Non-clickable' }, { id, children: [{ id: `${id}c`, name: 'Content', type: 'FRAME', children: [
      { id: `${id}t`, name: 'Text', type: 'FRAME', children: [txt(t, { id: `${id}x`, styleName: 'Subtitle-Medium' })] }] }] });
    const list = inst('List', { Type: 'Non-clickable', Orientation: 'vertical' }, { children: [{ id: 'ls', name: 'List Slot', type: 'SLOT', children: [row('a', 'One'), row('b', 'Two')] }] });
    expect(compileFigmaFrame(list).code).toMatch(/<List>\s*<ListItem>One<\/ListItem>\s*<ListItem>Two<\/ListItem>\s*<\/List>/);
  });

  it('Button Badge, Checkbox Validation and the Icon name property are read, not reported', () => {
    const b = compileFigmaFrame(inst('Button', { Style: 'solid', Type: 'text', State: 'Default', Status: 'unselected', Badge: 'true', 'start-icon': 'false', 'end-icon': 'false', 'start-avatar': 'false', 'end-avatar': 'false' }, { children: [txt('Go')] }));
    expect(b.code).toMatch(/<Button badge>Go<\/Button>/);
    expect(b.report.notes).toEqual([]);
    const c = compileFigmaFrame(inst('Checkbox', { State: 'Default', Checked: 'checked', Validation: 'true' }));
    expect(c.code).toMatch(/<Checkbox defaultChecked error \/>/);
    const i = compileFigmaFrame(inst('Icon', { Style: 'Round', 'Icon name': 'home' }, { children: [txt('home')] }));
    expect(i.report.notes).toEqual([]);
  });

  it('Caption-Medium (the live caption style) → Caption', () => {
    expect(compileFigmaFrame(txt('Small print', { styleName: 'Caption-Medium' })).code).toContain('<Caption>Small print</Caption>');
  });
});

// ── The inverses ────────────────────────────────────────────────────────────

describe('inverses the code → Figma side reads', () => {
  it('EXPORT_TO_TEXT_STYLE: every style is live, and reads back to the same export', () => {
    for (const [exp, style] of Object.entries(EXPORT_TO_TEXT_STYLE)) {
      expect(LIBRARY.textStyles, style).toContain(style);
      expect(TEXT_STYLE_TO_EXPORT[normalizeStyleName(style)], style).toBe(exp);
    }
  });

  it('every export TEXT_STYLE_TO_EXPORT can produce has a style to draw', () => {
    /* Label-Extra-Small is a lib size the Figma file does not have. */
    const noFigmaStyle = ['LabelExtraSmall'];
    for (const exp of new Set(Object.values(TEXT_STYLE_TO_EXPORT))) {
      if (!noFigmaStyle.includes(exp)) expect(EXPORT_TO_TEXT_STYLE[exp], exp).toBeTruthy();
    }
  });

  it('splitButtonVariant inverts buttonVariant for every variant the compiler emits', () => {
    for (const v of BUTTON_VARIANTS) {
      const s = splitButtonVariant(v)!;
      expect(buttonVariant(s.colorMode, s.shape), v).toBe(v);
    }
    expect(splitButtonVariant('primary-light')).toBeUndefined();
  });

  it('iconGlyphFromComponent inverts iconComponentName', () => {
    for (const name of ['Delete', 'ChevronRight', 'ChevronRightRounded', 'ShoppingCartSharp', 'FavoriteBorder', 'StarOutlined', 'Looks3', 'Filter9Plus', 'AddShoppingCart']) {
      const g = iconGlyphFromComponent(name)!;
      expect(iconComponentName(g.glyph, g.style), name).toBe(name);
    }
    expect(iconGlyphFromComponent('ChevronRightRounded')).toEqual({ glyph: 'chevron_right', style: 'Round' });
    expect(iconGlyphFromComponent('StarTwoTone')).toBeUndefined();
  });

  it('invertVariantTable: props → exact live values; values the set lacks fall back to the default', () => {
    const has = (axis: string, value: string) => hasVariantValue('Card', axis, value);
    expect(invertVariantTable('Card', { elevated: true, draggable: true, orientation: 'horizontal' }, has).variant)
      .toEqual({ State: 'Drag', Orientation: 'horizontal', Elevated: 'true' });
    expect(invertVariantTable('Card', {}, has).variant).toEqual({ State: 'Non-clickable', Orientation: 'vertical', Elevated: 'false' });
    /* Divider color="error" is an older file's palette value — not on the live set. */
    expect(invertVariantTable('Divider', { color: 'error' }, (a, v) => hasVariantValue('Divider', a, v)).variant.Color).toBe('Default');
  });
});

// ── Phase 1: the recorder ───────────────────────────────────────────────────

/** A stand-in "real lib": what matters is the export table, not what it draws. */
function fakeLib(): Record<string, unknown> {
  const C = (_name: string) => { const f = () => null; Object.defineProperty(f, 'name', { value: 'x' }); return f; };
  const Body = C('Body');
  return {
    VStack: C('VStack'), HStack: C('HStack'), Section: C('Section'), Container: C('Container'), Box: C('Box'), Grid: C('Grid'),
    Button: React.forwardRef(() => null), Card: C('Card'), Divider: C('Divider'), Chip: C('Chip'), Tag: C('Tag'), Avatar: C('Avatar'),
    Checkbox: C('Checkbox'), Ratio: C('Ratio'), List: C('List'), ListItem: C('ListItem'), Icon: C('Icon'),
    Body, Body1: Body, BodySmall: C('BodySmall'), Subtitle: C('Subtitle'), H2: C('H2'), DisplayLarge: C('DisplayLarge'), AutoHeading: C('AutoHeading'),
    Modal: C('Modal'), Tabs: C('Tabs'), TabList: C('TabList'), Tab: C('Tab'), TabPanel: C('TabPanel'), HeadingLevel: C('HeadingLevel'),
    StateMessage: C('StateMessage'), TextInput: C('TextInput'), OmniDesignProvider: C('OmniDesignProvider'),
    RATIO_NAMES: ['1:1'], useOmniDesign: () => { throw new Error('real hook needs the real provider'); }, shapePath: () => '',
  };
}

function record(element: (lib: any, icon: (n: string) => any) => React.ReactElement): { nodes: RecordedNode[]; aliases: Record<string, string[]> } {
  const r = createRecorder(React as any, fakeLib());
  const lib = { ...fakeLib(), ...r.standIns, ...r.hooks } as any;
  const html = renderToStaticMarkup(element(lib, (n) => r.icon(n)));
  return { nodes: r.parse(html), aliases: r.aliases };
}

const h = React.createElement;

describe('phase 1 — the recorder', () => {
  it('records export names and props with their types; constants and helpers pass through', () => {
    const r = createRecorder(React as any, fakeLib());
    expect(Object.keys(r.standIns)).toContain('Button');
    expect(Object.keys(r.standIns)).not.toContain('RATIO_NAMES');
    expect(Object.keys(r.standIns)).not.toContain('shapePath');
    const { nodes } = record((L) => h(L.VStack, { spacing: 2, alignItems: 'center', style: { marginTop: 8 } }, h(L.Body, { color: 'quiet' }, 'Hi')));
    expect(nodes).toEqual([{ kind: 'lib', name: 'VStack', props: { alignItems: 'center', spacing: 2, style: { marginTop: 8 } }, children: [
      { kind: 'lib', name: 'Body', aliases: ['Body1'], props: { color: 'quiet' }, children: [{ kind: 'text', text: 'Hi' }] },
    ] }]);
  });

  it('finds aliases by identity, not by name (the published build is minified)', () => {
    const { aliases } = record((L) => h(L.Body, null, 'x'));
    expect(aliases.Body1).toEqual(['Body']);
  });

  it('element props become slots; handlers and components become markers', () => {
    const { nodes } = record((L, icon) => h(L.Button, { variant: 'primary', onClick: () => {}, startDecorator: h(icon('Add')), component: L.Box }, 'Add'));
    const b = nodes[0] as Extract<RecordedNode, { kind: 'lib' }>;
    expect(b.props).toEqual({ component: { $component: true }, onClick: { $fn: true }, startDecorator: { $slot: 'startDecorator' }, variant: 'primary' });
    expect(b.slots).toEqual({ startDecorator: [{ kind: 'icon', name: 'Add', props: {} }] });
    expect(b.children).toEqual([{ kind: 'text', text: 'Add' }]);
  });

  it('a closed overlay renders nothing; an open one renders', () => {
    const { nodes } = record((L) => h(L.VStack, null, h(L.Modal, { open: false }, h(L.Body, null, 'hidden')), h(L.Modal, { open: true }, h(L.Body, null, 'shown'))));
    const v = nodes[0] as any;
    expect(v.children).toHaveLength(1);
    expect(v.children[0].props.open).toBe(true);
  });

  it('Tabs: only the active TabPanel, and each Tab knows whether it is selected', () => {
    const { nodes } = record((L) => h(L.Tabs, { defaultValue: 1 },
      h(L.TabList, null, h(L.Tab, null, 'A'), h(L.Tab, null, 'B')),
      h(L.TabPanel, { value: 0 }, 'panel A'), h(L.TabPanel, { value: 1 }, 'panel B')));
    const tabs = nodes[0] as any;
    const list = tabs.children[0];
    expect(list.children.map((t: any) => t.props.$selected)).toEqual([false, true]);
    expect(tabs.children.slice(1).map((p: any) => p.children[0].text)).toEqual(['panel B']);
  });

  it('AutoHeading records the level its Sections give it', () => {
    const { nodes } = record((L) => h(L.Section, null, h(L.AutoHeading, null, 'Title'), h(L.Section, null, h(L.AutoHeading, null, 'Sub'))));
    const s = nodes[0] as any;
    expect(s.children[0].props.$level).toBe(2);
    expect(s.children[1].children[0].props.$level).toBe(3);
  });

  it('useOmniDesign is answered by the recorder, not the real provider', () => {
    const r = createRecorder(React as any, fakeLib(), { mode: 'dark' });
    expect((r.hooks.useOmniDesign as () => any)().isDark).toBe(true);
  });

  it('the markup parser keeps text exactly and reads styles back to numbers', () => {
    const { nodes } = record((L) => h('div', { style: { display: 'flex', gap: 12, flex: '1 1 160px' } }, h(L.Body, null, 'Tom & Jerry <3 "q"'), 'a', 'b'));
    const d = nodes[0] as any;
    expect(d.style).toEqual({ display: 'flex', gap: 12, flex: '1 1 160px' });
    expect(d.children[0].children[0].text).toBe('Tom & Jerry <3 "q"');
    expect(d.children[1]).toEqual({ kind: 'text', text: 'ab' });
    expect(parseStyle('margin-top:16px;--x:1')).toEqual({ marginTop: 16, '--x': 1 });
  });

  it('media queries are answered at the spec viewport', () => {
    expect(mediaMatches('(min-width: 900px)', { width: 1280 })).toBe(true);
    expect(mediaMatches('(max-width: 599.98px)', { width: 1280 })).toBe(false);
    expect(mediaMatches('(max-width: 600px)', { width: 390 })).toBe(true);
    expect(mediaMatches('(prefers-color-scheme: dark)', { width: 1280 }, 'dark')).toBe(true);
  });
});

// ── Phase 2: the mapper ─────────────────────────────────────────────────────

const STATE: C2FDocument['state'] = { name: 'test', route: '/', viewport: { name: 'Desktop', width: 1280, height: 800 }, mode: 'light' };
const map = (nodes: RecordedNode[]) => mapRecorded(nodes, { app: 'test', state: STATE });
const all = (doc: C2FDocument) => { const out: Node[] = []; for (const c of doc.root.children) walkC2F(c, (x) => out.push(x)); return out; };

describe('phase 2 — the mapper', () => {
  it('stacks become auto-layout frames with token-bound gaps; stretch fills the cross axis', () => {
    const doc = map(record((L) => h(L.VStack, { spacing: 2 }, h(L.Body, null, 'a'), h(L.HStack, { spacing: 1, justifyContent: 'space-between' }, h(L.Body, null, 'b')))).nodes);
    const v = doc.root.children[0] as any;
    expect(v.layout).toEqual({ mode: 'VERTICAL', itemSpacing: { px: 16, variable: 'Sizing-2' } });
    expect(v.children[0].sizing).toEqual({ h: 'FILL' });
    expect(v.children[1].layout).toEqual({ mode: 'HORIZONTAL', itemSpacing: { px: 8, variable: 'Sizing-1' }, counter: 'CENTER', primary: 'SPACE_BETWEEN' });
  });

  it('Section: explicit Theme and Surface modes, Background fill, the Desktop padding', () => {
    const doc = map(record((L) => h(L.Section, { theme: 'Primary', surface: 'Surface-Bright', padding: 'large' }, h(L.Body, null, 'x'))).nodes);
    const s = doc.root.children[0] as any;
    expect(s.modes).toEqual({ '.Theme': 'Primary', Surface: 'Surface-Bright' });
    expect(s.fill).toEqual({ variable: 'Background' });
    expect(s.layout.padding.top).toEqual({ px: 96, variable: 'Sizing-12' });
    expect(s.layout.padding.left).toEqual({ px: 24, variable: 'Sizing-3' });
  });

  it('Button: variant → Style + Buttons mode, size → Component-Size, every boolean written', () => {
    const doc = map(record((L, icon) => h(L.Button, { variant: 'error-outline', size: 'small', startDecorator: h(icon('Add')) }, 'Add member')).nodes);
    const b = doc.root.children[0] as InstanceNode;
    expect(b.variant).toEqual({ State: 'Default', Status: 'unselected', Style: 'outline', Type: 'text' });
    expect(b.modes).toEqual({ Buttons: 'error', 'Component-Size': 'small' });
    /* Badge is a BOOLEAN property on the live set, so it is a property, not a variant. */
    expect(b.properties).toEqual({ 'start-icon': true, 'start-avatar': false, 'end-icon': false, 'end-avatar': false, Badge: false });
    expect(b.text).toEqual({ label: 'Add member' });
    expect(b.nested![0].node.properties).toEqual({ 'Icon name': 'add' });
    expect(b.component.key).toBe(findSet('Button')!.key);
  });

  it('normalizes marginTop to a spacer and bold Body to Subtitle — and reports both', () => {
    const doc = map(record((L) => h(L.VStack, null, h(L.Body, { style: { fontWeight: 700 } }, 'Total'), h(L.Box, { style: { marginTop: 16 } }, h(L.Body, null, 'x')))).nodes);
    const v = doc.root.children[0] as any;
    expect((v.children[0] as TextNode).textStyle).toBe('Subtitle-Medium');
    expect(v.children[1]).toMatchObject({ name: 'Spacer', sizing: { v: 'FIXED', height: 16 } });
    expect(doc.normalizations.map((x) => x.message)).toEqual([
      'fontWeight 700 on Body → Subtitle (Body has no bold; Subtitle is Body at 700)',
      'marginTop 16px → a 16px spacer (Sizing-2) before it',
    ]);
    expect(doc.coverage.normalized).toBe(2);
    expect(doc.coverage.cleanRatioStrict).toBeLessThan(doc.coverage.cleanRatio);
  });

  it('a component with no Figma counterpart is a placeholder named for it; a set without a table says which set', () => {
    const doc = map(record((L) => h(L.VStack, null, h(L.StateMessage, { title: 'Empty' }), h(L.TextInput, { label: 'Email' }))).nodes);
    const [a, b] = (doc.root.children[0] as any).children;
    expect(a).toMatchObject({ kind: 'placeholder', name: 'StateMessage', status: 'unmapped' });
    expect(b).toMatchObject({ kind: 'placeholder', status: 'needsTable', figmaSet: 'Input Field' });
    expect(doc.placeholders.map((p) => p.source)).toEqual(['StateMessage', 'TextInput']);
  });

  it('every variant value and mode the IR names exists in the live capture', () => {
    for (const f of ['omni-r5-cart-filled.recorded.json', 'omni-r5-checkout.recorded.json', 'omni-r5-home.recorded.json']) {
      const doc = map(fixture(f));
      for (const n of all(doc)) {
        if (n.kind === 'instance') {
          for (const [axis, value] of Object.entries(n.variant)) expect(hasVariantValue(n.component.set, axis, value), `${n.component.set} ${axis}=${value}`).toBe(true);
        }
        for (const [col, mode] of Object.entries(n.modes ?? {})) {
          expect(LIBRARY.collections.find((c) => c.name === col)?.modes, `${col}=${mode}`).toContain(mode);
        }
      }
    }
  });

  it('is deterministic: the same recording maps to the same bytes', () => {
    const rec = fixture('omni-r5-cart-filled.recorded.json');
    expect(JSON.stringify(map(rec))).toBe(JSON.stringify(map(structuredClone(rec))));
  });
});

// ── The acceptance test: the round trip ─────────────────────────────────────

function roundTrip(doc: C2FDocument) {
  const figma = irToFigmaNode(doc.root);
  const tree = compileTree(buildIR(figma));
  return { figma, jsx: tree.root, compiled: compileFigmaFrame(figma) };
}

function assertRoundTrip(doc: C2FDocument) {
  const { jsx, compiled } = roundTrip(doc);
  const want = irSignatures(doc.root);
  const got = jsxSignatures(jsx);
  expect(got.map((s) => s.c), 'component sequence').toEqual(want.map((w) => w.sig.c));
  const clean = want.map((w, i) => ({ w, g: got[i] })).filter(({ w }) => w.status === 'clean');
  for (const { w, g } of clean) expect(g, `${w.id} ${w.sig.c}`).toEqual(w.sig);
  return { compiled, clean: clean.length, compared: want.length };
}

describe('acceptance — code → IR → Figma nodes → Figma → code', () => {
  it('a hand-written page: layout, type, Button, Card, Tag, Chip, Divider, List, Avatar, Ratio, Icon', () => {
    const doc = map(record((L, icon) => h(L.Section, { theme: 'Secondary', padding: 'medium' },
      h(L.Container, null,
        h(L.VStack, { spacing: 3 },
          h(L.DisplayLarge, null, 'Shop'),
          h(L.BodySmall, { color: 'quiet' }, 'Calm pieces'),
          h(L.HStack, { spacing: 2 },
            h(L.Button, { variant: 'primary' }, 'Buy'),
            h(L.Button, { variant: 'default-outline', size: 'large', startDecorator: h(icon('Add')) }, 'Add'),
            h(L.Button, { variant: 'ghost', iconOnly: true, 'aria-label': 'Remove item' }, h(icon('Delete'))),
            h(L.Tag, { color: 'success' }, 'New'),
            h(L.Chip, { label: 'Linen', variant: 'primary', selected: true })),
          h(L.Divider, null),
          h(L.Card, { elevated: true, surface: 'Container', onClick: () => {} },
            h(L.Subtitle, null, 'Order summary'),
            h(L.Ratio, { ratio: '4:3' }, h('img', { src: 'https://example.com/a.jpg', alt: '' }))),
          h(L.List, null, h(L.ListItem, { secondary: 'VP' }, 'Jane'), h(L.ListItem, { secondary: 'CTO' }, 'Sam')),
          h(L.Avatar, { initials: 'LN', size: 'large' }),
          h(L.Icon, { color: 'primary' }, h(icon('ChevronRightRounded'))))))).nodes);
    expect(doc.coverage.unmapped + doc.coverage.needsTable).toBe(0);
    const { compiled, clean, compared } = assertRoundTrip(doc);
    expect(clean).toBe(compared);
    expect(compiled.report.fallbacks).toEqual([]);
    expect(compiled.code).toContain('<Button aria-label="Remove item" iconOnly variant="ghost">');
    expect(compiled.code).toMatch(/<Card clickable elevated surface="Container">/);
  });

  for (const state of ['cart-filled', 'checkout', 'home']) {
    it(`omni-r5 ${state}, recorded by the runner: every clean node comes back with the same component and props`, () => {
      const doc = map(fixture(`omni-r5-${state}.recorded.json`));
      const { clean, compared } = assertRoundTrip(doc);
      expect(clean).toBeGreaterThan(10);
      expect(compared).toBeGreaterThanOrEqual(clean);
    });
  }
});
