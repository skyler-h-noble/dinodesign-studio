/**
 * The deterministic Figma → code compiler (src/utils/aaid/).
 *
 * What is pinned here:
 *   - the emitted file for the Design-to-Code test screen (golden snapshot);
 *   - determinism: ten compiles, and a key-order shuffle of the input, give
 *     one sha256 — and the input is never mutated;
 *   - coverage, and the FALLBACK markers for what the tables cannot map;
 *   - every row of every variant table, one at a time;
 *   - the emitted code TYPE-CHECKS against the lib's real published types
 *     (dist/types), not the studio's ambient shim — which is also where the
 *     vocabularies in propTables.ts are checked against the lib's unions;
 *   - the token metric: the full LLM prompt against the fallback-only prompt.
 *
 * The aaid fixture is SYNTHETIC — built by hand from the plugin's
 * aaidNodeRecord shape, because no Figma token was available to fetch the real
 * frame with plugin_data=shared. Its `_synthetic` key says so.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import ts from 'typescript';
import { compileFigmaFrame } from '../utils/aaid/compile';
import { buildIR, irToJSON } from '../utils/aaid/ir';
import { sha256Hex } from '../utils/aaid/sha256';
import {
  AVATAR_SIZES, BUTTON_COLORS, BUTTON_VARIANTS, COLORS, LIB_DEFAULTS, RATIO_NAMES, SIZES, SURFACES, TEXT_COLORS,
  TEXT_STYLE_TO_EXPORT, THEMES, VARIANT_TABLES, elevationFromMode, iconComponentName, paddingShorthand, ratioName,
  spacing, themeAndSurface, typographyExport,
} from '../utils/aaid/propTables';
import { buildFallbackPrompt, comparePromptSizes } from '../utils/figmaToCode';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SYNTHETIC = read('src/__tests__/__fixtures__/aaidDesignToCodeTest.synthetic.json');
const MCP_FIXTURE = read('public/figma-fixtures/omni-designs-test.json');

// ── Node builders (the plugin's enriched-tree shape: note keys inline) ──────

type N = Record<string, any>;
const txt = (characters: string, extra: N = {}): N => ({ id: `t-${characters}`, name: characters, type: 'TEXT', characters, ...extra });
const inst = (component: string, variant: N = {}, extra: N = {}): N => ({
  id: extra.id ?? `i-${component}-${JSON.stringify(variant)}`,
  name: extra.name ?? component,
  type: 'INSTANCE',
  component,
  variant,
  ...extra,
});
const frame = (name: string, mode: 'VERTICAL' | 'HORIZONTAL', children: N[], extra: N = {}): N => ({
  id: extra.id ?? `f-${name}`,
  name,
  type: 'FRAME',
  layout: { mode, gap: 8, padTop: 0, padRight: 0, padBottom: 0, padLeft: 0, primaryAxis: 'MIN', counterAxis: 'MIN', ...(extra.layout ?? {}) },
  children,
  ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'layout')),
});
const icon = (glyph: string, style = 'Default'): N => inst('Icon', { Style: style }, { id: `icon-${glyph}-${style}`, children: [txt(glyph)] });
const row = (id: string, texts: Array<[string, string]>, end?: N, start?: N, variant: N = {}): N => inst('List Item', variant, {
  id,
  name: 'List',
  sizingH: 'FILL',
  children: [
    { id: `${id}-s`, name: 'Beginning Slot', type: 'FRAME', children: start ? [start] : [] },
    { id: `${id}-t`, name: 'Text', type: 'FRAME', children: texts.map(([type, c], i) => inst('Typography', { type }, { id: `${id}-t${i}`, children: [txt(c)] })) },
    { id: `${id}-e`, name: 'End Slot', type: 'FRAME', children: end ? [end] : [] },
  ],
});

/** Everything the tables cover, plus one of each unsupported shape. */
const KITCHEN_SINK: N = frame('Kitchen Sink', 'VERTICAL', [
  inst('Button', { Style: 'outline', Type: 'text', State: 'Disabled', Status: 'unselected', 'start-icon': 'true', 'end-icon': 'false', 'start-avatar': 'false', 'end-avatar': 'false' },
    { id: 'btn-1', modes: { Buttons: 'Error' }, sizingH: 'FILL', children: [icon('add', 'Round'), txt('Add member')] }),
  inst('Button', { Type: 'iconOnly', Style: 'ghost' }, { id: 'btn-2', children: [icon('search')] }),
  frame('Row', 'HORIZONTAL', [
    inst('Chip', { Status: 'selected', State: 'Default', 'Start-Avatar': 'true', 'Start-Icon': 'false', 'End-Icon': 'false', 'End-Avatar': 'false' },
      { id: 'chip-1', children: [inst('Avatar', { Style: 'Photo' }, { id: 'chip-av' }), txt('Design')] }),
    inst('Tag', {}, { id: 'tag-1', modes: { Buttons: 'Success' }, children: [txt('Active')] }),
    inst('Avatar', { Style: 'Initials' }, { id: 'av-1', width: 56, height: 56, children: [txt('LN')] }),
  ], { id: 'row-1', layout: { gap: 10, counterAxis: 'CENTER' } }),
  inst('Card', { State: 'Non-clickable', Orientation: 'vertical' }, {
    id: 'card-1', modes: { Elevation: 'Level-2', Surface: 'Container' },
    children: [{ id: 'card-slot', name: 'Content Slot', type: 'FRAME', children: [txt('Card body', { id: 'card-txt', styleName: 'Body/Small', boundVars: { fills: 'Text-Quiet' } })] }],
  }),
  inst('Ratio - Fill Vertical', { Ratio: 'Golden Horizontal' }, {
    id: 'ratio-1', children: [{ id: 'ratio-slot', name: 'Content Slot', type: 'FRAME', children: [inst('Avatar', { Style: 'Default' }, { id: 'ratio-av', modes: { 'Icons & Avatars': 'xl' } })] }],
  }),
  frame('Small Board', 'HORIZONTAL', [inst('Divider', { Orientation: 'vertical', Color: 'Colored', Size: 'small' }, { id: 'div-1' })], { id: 'board-1', modes: { 'Component-Size': 'small' } }),
  txt('Section title', { id: 'h2', name: 'H2', boundVars: { fills: 'Text-Primary' } }),
  txt('One\nTwo', { id: 'prose', styleName: 'Body/Medium', list: { type: 'UNORDERED' } }),
  inst('Box', { Radius: 'medium' }, {
    id: 'box-1', modes: { Theme: 'Secondary', Surface: 'Surface-Bright', Elevation: 'Level-1' },
    layout: { mode: 'VERTICAL', gap: 8, padTop: 16, padRight: 24, padBottom: 16, padLeft: 24, primaryAxis: 'MIN', counterAxis: 'MIN' },
    children: [txt('Callout', { id: 'box-txt', styleName: 'Subtitle' })],
  }),
  inst('List', { Type: 'Clickable' }, {
    id: 'list-1',
    children: [
      row('r1', [['Overline-Small', 'Kicker'], ['Subtitle-Large', 'Jane Dow'], ['Body-Medium', 'VP of Marketing']], inst('Checkbox', { Checked: 'checked' }, { id: 'r1-cb' }), inst('Avatar', { Style: 'Photo' }, { id: 'r1-av' })),
      row('r2', [['Overline-Small', 'Only kicker']], undefined, undefined, { Type: 'Clickable' }),
    ],
  }),
  { id: 'vec-1', name: 'Logo mark', type: 'VECTOR' },
  { id: 'det-1', name: 'Button', type: 'FRAME', children: [txt('Detached')] },
  { id: 'rect-1', name: 'Swatch', type: 'RECTANGLE', fills: [{ type: 'SOLID' }] },
  { id: 'rect-2', name: 'Photo', type: 'RECTANGLE', fills: [{ type: 'IMAGE', imageRef: 'abc' }] },
  inst('Avatar', { Style: 'Photo' }, { id: 'abs-1', name: 'Floating', layoutPositioning: 'ABSOLUTE' }),
  inst('Button', { Type: 'text' }, { id: 'cond-1', visibleWhen: 'Show-Drawer', children: [txt('Menu')] }),
  inst('Mystery Widget', {}, { id: 'unk-1' }),
], { id: 'ks', modes: { Theme: 'Primary', Surface: 'Surface' }, fills: [] });

// ── Type-checking emitted code against the REAL lib types ───────────────────

/** Diagnostics for in-memory .tsx files, resolved like a consumer project. */
function typecheck(files: Record<string, string>): string[] {
  const options: ts.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
  const virtual = new Map(Object.entries(files).map(([k, v]) => [path.join(ROOT, k), v]));
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (f, lang, onErr, create) => (virtual.has(f) ? ts.createSourceFile(f, virtual.get(f)!, lang, true, ts.ScriptKind.TSX) : getSourceFile(f, lang, onErr, create));
  host.fileExists = (f) => virtual.has(f) || fileExists(f);
  host.readFile = (f) => virtual.get(f) ?? readFile(f);
  const program = ts.createProgram([...virtual.keys()], options, host);
  return ts.getPreEmitDiagnostics(program)
    .filter((d) => !d.file || virtual.has(d.file.fileName))
    .map((d) => `${d.file ? path.basename(d.file.fileName) : ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}

// ── Golden + determinism ────────────────────────────────────────────────────

describe('compileFigmaFrame — the Design-to-Code test screen (synthetic _aaid)', () => {
  const result = compileFigmaFrame(SYNTHETIC);

  it('emits the golden file', () => {
    expect(result.code).toMatchSnapshot();
  });

  it('compiles every visible node with no FALLBACK', () => {
    expect(result.report.fallbacks).toEqual([]);
    expect(result.report.coverage).toEqual({ compiled: 40, visible: 40, ratio: 1 });
    expect(result.report.stats).toEqual({ nodes: 45, withNote: 26, pruned: 3 });
  });

  it('honours the hidden rows per row — never repeating or inventing text', () => {
    expect(result.code).not.toContain('Hidden title');
    expect(result.code).not.toContain('Hidden secondary');
    expect(result.code).not.toContain('Focus-Visible');
    // Row 2 has no title (2nd row off): its ListItem self-closes.
    expect(result.code).toMatch(/eyebrow="Restocked"\n\s+secondary="Back in every size"[\s\S]*?\/>/);
  });

  it('reads modes, variants and sizing the tables own', () => {
    const c = result.code;
    expect(c).toContain('surface="Surface-Bright"');
    expect(c).toContain('elevation={2}'); // Level-2, never subtracted
    expect(c).toContain('<DisplaySmall>Design to Code</DisplaySmall>');
    expect(c).toContain('variant="secondary"'); // Buttons mode on the third checkbox
    expect(c).toContain('defaultChecked');
    expect(c).toContain('style={{ height: 81 }}'); // FIXED row height to the pixel
    expect(c).toContain('<Avatar defaultPhoto size="large"');
    expect(c).not.toMatch(/primary/); // nothing marked primary, nothing emitted primary
  });

  it('is byte-identical across ten compiles', () => {
    const hashes = new Set(Array.from({ length: 10 }, () => compileFigmaFrame(SYNTHETIC).report.sha256));
    expect(hashes.size).toBe(1);
    expect([...hashes][0]).toBe(result.report.sha256);
  });

  it('does not depend on the key order of the input', () => {
    const reverseKeys = (v: any): any => {
      if (Array.isArray(v)) return v.map(reverseKeys);
      if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reverseKeys(v[k])]));
      return v;
    };
    const shuffled = reverseKeys(SYNTHETIC);
    /* The note strings are JSON too — reverse inside them as well. */
    const walk = (n: any) => {
      const s = n.sharedPluginData?.dino?.aaid;
      if (typeof s === 'string') n.sharedPluginData.dino.aaid = JSON.stringify(reverseKeys(JSON.parse(s)));
      (n.children ?? []).forEach(walk);
    };
    walk(shuffled);
    expect(irToJSON(buildIR(shuffled))).toBe(irToJSON(buildIR(SYNTHETIC)));
    expect(compileFigmaFrame(shuffled).report.sha256).toBe(result.report.sha256);
  });

  it('never mutates its input', () => {
    const before = JSON.stringify(SYNTHETIC);
    compileFigmaFrame(SYNTHETIC);
    comparePromptSizes(SYNTHETIC);
    expect(JSON.stringify(SYNTHETIC)).toBe(before);
  });

  it('reads the same frame identically in the three input shapes', () => {
    /* REST (note as a string) → lifted (_aaid) → enriched (note inline). */
    const lift = (n: any): any => {
      const { sharedPluginData, children, ...rest } = n;
      const out: any = { ...rest };
      if (sharedPluginData?.dino?.aaid) out._aaid = JSON.parse(sharedPluginData.dino.aaid);
      if (children) out.children = children.map(lift);
      return out;
    };
    expect(compileFigmaFrame(lift(SYNTHETIC)).report.sha256).toBe(result.report.sha256);
    const spread = (n: any): any => {
      const { _aaid, children, ...rest } = n;
      const out: any = { ...rest, ...(_aaid ?? {}) };
      delete out.v;
      if (children) out.children = children.map(spread);
      return out;
    };
    expect(compileFigmaFrame(spread(lift(SYNTHETIC))).report.sha256).toBe(result.report.sha256);
  });
});

describe('compileFigmaFrame — the metadata-only fixture (no _aaid)', () => {
  const result = compileFigmaFrame(MCP_FIXTURE);

  it('maps the components by layer name and marks what it cannot know', () => {
    expect(result.code).toMatchSnapshot();
    expect(result.report.coverage).toEqual({ compiled: 20, visible: 31, ratio: 0.6452 });
    const reasons = result.report.fallbacks.map((f) => f.reason);
    expect(reasons[0]).toMatch(/^frame without auto-layout/);
    expect(result.report.fallbacks[0].scope).toBe('self');
    expect(reasons.filter((r) => /no characters/.test(r))).toHaveLength(10);
  });
});

// ── FALLBACK markers ────────────────────────────────────────────────────────

describe('FALLBACK markers for what the tables cannot map', () => {
  const result = compileFigmaFrame(KITCHEN_SINK);
  const reasonFor = (id: string) => result.report.fallbacks.filter((f) => f.id === id).map((f) => f.reason);

  it.each([
    ['vec-1', /vector artwork/],
    ['det-1', /detached instance of Button/],
    ['rect-1', /raw rectangle with a literal fill/],
    ['rect-2', /image fill outside a Ratio slot/],
    ['abs-1', /absolute positioning/],
    ['cond-1', /visibility bound to variable "Show-Drawer"/],
    ['unk-1', /unknown component "Mystery Widget"/],
  ])('%s → %s', (id, re) => {
    expect(reasonFor(id).join(' | ')).toMatch(re);
    expect(result.code).toContain(`· node ${id} ·`);
  });

  it('writes each as a JSX comment in place, in the agreed format', () => {
    expect(result.code).toContain('{/* FALLBACK: vector artwork · node vec-1 · Logo mark */}');
    expect(result.code).toContain('{/* FALLBACK: looks like a detached instance of Button · node det-1 · Button */}');
  });

  it('counts a fallback subtree as not compiled', () => {
    const { compiled, visible } = result.report.coverage;
    // det-1 and cond-1 (each a node + its text) are 2; the five others are 1.
    expect(visible - compiled).toBe(9);
  });

  it('emits the golden kitchen-sink file', () => {
    expect(result.code).toMatchSnapshot();
  });
});

// ── Type-checking ───────────────────────────────────────────────────────────

describe('emitted code type-checks against @omni-design/components dist types', () => {
  it('the synthetic fixture, the metadata fixture and the kitchen sink', () => {
    const diags = typecheck({
      'aaid-synthetic.tsx': compileFigmaFrame(SYNTHETIC).code,
      'aaid-mcp.tsx': compileFigmaFrame(MCP_FIXTURE).code,
      'aaid-kitchen.tsx': compileFigmaFrame(KITCHEN_SINK).code,
    });
    expect(diags).toEqual([]);
  }, 60000);

  it('a type error is caught (the check is live)', () => {
    const diags = typecheck({ 'aaid-bad.tsx': "import { Button } from '@omni-design/components';\nexport default function X() { return <Button variant=\"primary-light\">x</Button>; }\n" });
    expect(diags.join('\n')).toMatch(/primary-light/);
  }, 60000);

  it('the vocabularies in propTables are values of the lib unions', () => {
    const list = (xs: readonly (string | number)[]) => JSON.stringify(xs);
    const diags = typecheck({
      'aaid-vocab.tsx': `import type { Theme, Surface, Color, Size, ButtonVariant, TextColor, RatioName, AvatarProps, BoxProps, CheckboxProps } from '@omni-design/components';
export const themes: readonly Theme[] = ${list(THEMES)};
export const surfaces: readonly Surface[] = ${list(SURFACES)};
export const colors: readonly Color[] = ${list(COLORS)};
export const buttonColors: readonly NonNullable<CheckboxProps['variant']>[] = ${list(BUTTON_COLORS)};
export const sizes: readonly Size[] = ${list(SIZES)};
export const buttonVariants: readonly ButtonVariant[] = ${list(BUTTON_VARIANTS)};
export const textColors: readonly TextColor[] = ${list(TEXT_COLORS)};
export const ratios: readonly RatioName[] = ${list(RATIO_NAMES)};
export const avatarSizes: readonly NonNullable<AvatarProps['size']>[] = ${list(AVATAR_SIZES)};
export const elevations: readonly NonNullable<BoxProps['elevation']>[] = [0, 1, 2, 3, 4, 5];
`,
    });
    expect(diags).toEqual([]);
  }, 60000);

  it('every typography export the table names exists in the lib', () => {
    const names = [...new Set(Object.values(TEXT_STYLE_TO_EXPORT))].sort();
    const diags = typecheck({ 'aaid-typo.tsx': `import { ${names.join(', ')} } from '@omni-design/components';\nexport const all = [${names.join(', ')}];\n` });
    expect(diags).toEqual([]);
  }, 60000);
});

// ── One row at a time ───────────────────────────────────────────────────────

/** A compilable instance for each table, so a single variant can be varied. */
const TABLE_SUBJECT: Record<string, (variant: N) => N> = {
  Button: (v) => inst('Button', v, { id: 'b', name: 'Profile', children: [icon('person'), txt('Label')] }),
  Checkbox: (v) => inst('Checkbox', v, { id: 'c' }),
  Divider: (v) => inst('Divider', v, { id: 'd' }),
  Avatar: (v) => inst('Avatar', v, { id: 'a', children: [txt('AB')] }),
  Chip: (v) => inst('Chip', v, { id: 'ch', children: [txt('Label')] }),
  Card: (v) => inst('Card', v, { id: 'cd', children: [txt('Body', { styleName: 'Body' })] }),
  List: (v) => inst('List', v, { id: 'l' }),
  ListItem: (v) => row('li', [['Subtitle-Large', 'Title']], undefined, undefined, v),
  Box: (v) => inst('Box', v, { id: 'bx', layout: { mode: 'VERTICAL', gap: 8 }, children: [txt('x', { styleName: 'Body' })] }),
};

function emitted(prop: string, value: string | number | true): RegExp {
  if (value === true) return new RegExp(`[\\s<]${prop}(\\s|/|>)`);
  if (typeof value === 'number') return new RegExp(`${prop}=\\{${value}\\}`);
  return new RegExp(`${prop}="${value}"`);
}

describe('variant tables — every row', () => {
  for (const [exportName, rows] of Object.entries(VARIANT_TABLES)) {
    for (const r of rows) {
      for (const [figmaValue, hit] of Object.entries(r.values)) {
        it(`${exportName} ${r.figma}=${figmaValue} → ${hit ? `${hit[0]}=${String(hit[1])}` : 'nothing'}`, () => {
          const { code, report } = compileFigmaFrame(TABLE_SUBJECT[exportName]({ [r.figma]: figmaValue }));
          expect(report.notes.filter((x) => x.message.includes(`${r.figma}=`))).toEqual([]);
          expect(report.fallbacks).toEqual([]);
          if (hit) {
            const isDefault = LIB_DEFAULTS[exportName]?.[hit[0]] === hit[1];
            if (!isDefault) expect(code).toMatch(emitted(hit[0], hit[1]));
          }
        });
      }
    }
  }

  it('reports a variant value the table does not know (rule 0c)', () => {
    const { report } = compileFigmaFrame(TABLE_SUBJECT.Checkbox({ Checked: 'sideways' }));
    expect(report.notes.map((x) => x.message)).toContain('variant Checked=sideways not mapped');
  });
});

// ── Specific mappings ───────────────────────────────────────────────────────

describe('Button (rule 4f)', () => {
  const code = (n: N) => compileFigmaFrame(n).code;
  it('composes the Buttons mode and the Style shape into one variant', () => {
    expect(code(inst('Button', { Style: 'outline' }, { modes: { Buttons: 'Error' }, children: [txt('Go')] }))).toContain('variant="error-outline"');
    expect(code(inst('Button', { Style: 'solid' }, { modes: { Buttons: 'Black-White' }, children: [txt('Go')] }))).toContain('variant="black-white"');
  });
  it('defaults to "default", never primary, and omits it', () => {
    const c = code(inst('Button', {}, { children: [txt('Go')] }));
    expect(c).toContain('<Button>Go</Button>');
  });
  it('ghost drops the palette and says so', () => {
    const r = compileFigmaFrame(inst('Button', { Style: 'ghost' }, { modes: { Buttons: 'Primary' }, children: [txt('Go')] }));
    expect(r.code).toContain('variant="ghost"');
    expect(r.report.notes.map((x) => x.message).join()).toMatch(/drops the primary palette/);
  });
  it('takes size from an ANCESTOR Component-Size mode, then the legacy name', () => {
    expect(code(frame('Board', 'VERTICAL', [inst('Button', {}, { children: [txt('Go')] })], { modes: { 'Component-Size': 'small' } }))).toContain('size="small"');
    expect(code(inst('Button-Large', {}, { children: [txt('Go')] }))).toContain('size="large"');
    expect(code(inst('Button-Elevated', {}, { children: [txt('Go')] }))).toContain('elevated');
  });
  it('takes the palette from a bound semantic fill when no mode says', () => {
    expect(code(inst('Button', {}, { boundVars: { fills: 'Buttons/Success/Button' }, children: [txt('Go')] }))).toContain('variant="success"');
  });
  it('icon-only: names the action from the glyph and flags it (rule 0d)', () => {
    const r = compileFigmaFrame(inst('Button', { Type: 'iconOnly' }, { children: [icon('search')] }));
    expect(r.code).toContain('aria-label="Search"');
    expect(r.code).toContain("import SearchIcon from '@omni-design/icons/Search';");
    expect(r.code).toContain('// DERIVED-ARIA-LABEL: "Search" on Button');
  });
  it('icon-only: an authored layer name is used and NOT flagged', () => {
    const r = compileFigmaFrame(inst('Button', { Type: 'iconOnly' }, { name: 'Open settings', children: [icon('settings')] }));
    expect(r.code).toContain('aria-label="Open settings"');
    expect(r.report.derivedLabels).toEqual([]);
  });
  it('letterNumber without an authored name is a FALLBACK, not aria-label="3"', () => {
    const r = compileFigmaFrame(inst('Button', { Type: 'letterNumber' }, { children: [txt('3')] }));
    expect(r.report.fallbacks[0].reason).toMatch(/accessible name not derivable/);
    expect(r.code).not.toContain('aria-label="3"');
  });
  it('FILL width → fullWidth; never an inline width/height', () => {
    const c = code(inst('Button', {}, { sizingH: 'FILL', sizingV: 'FIXED', width: 300, height: 40, children: [txt('Go')] }));
    expect(c).toContain('fullWidth');
    expect(c).not.toMatch(/width: 300|height: 40/);
  });
  it('start icon in the Round family → the Rounded component', () => {
    expect(compileFigmaFrame(KITCHEN_SINK).code).toContain("import { AddRounded as AddRoundedIcon } from '@omni-design/icons/rounded';");
  });
});

describe('Typography (rule 4c / 4e)', () => {
  it.each([
    ['Display-Small', 'DisplaySmall'], ['Display Large', 'DisplayLarge'], ['H3', 'H3'], ['Subtitle-Large', 'SubtitleLarge'],
    ['Body-Medium', 'Body'], ['Body/Small', 'BodySmall'], ['Overline-Small', 'EyebrowSmall'], ['Typography/Labels/Extra-Small', 'LabelExtraSmall'],
    ['body-bold', 'BodySemibold'], ['Caption', 'Caption'],
  ])('%s → %s', (style, exp) => {
    expect(typographyExport(style)).toBe(exp);
  });
  it('reads the style from a variant, then the text style, then the layer name', () => {
    expect(compileFigmaFrame(inst('Typography', { type: 'H4' }, { children: [txt('A')] })).code).toContain('<H4>A</H4>');
    expect(compileFigmaFrame(txt('B', { styleName: 'Body/Large' })).code).toContain('<BodyLarge>B</BodyLarge>');
    expect(compileFigmaFrame(txt('C', { name: 'Caption' })).code).toContain('<Caption>C</Caption>');
  });
  it('a bound Quiet fill → color="quiet"; a heading never gets a color', () => {
    expect(compileFigmaFrame(txt('Q', { styleName: 'Body', boundVars: { fills: 'Text-Quiet' } })).code).toContain('<Body color="quiet">Q</Body>');
    expect(compileFigmaFrame(txt('H', { name: 'H2', boundVars: { fills: 'Text-Primary' } })).code).toContain('<H2>H</H2>');
  });
  it('a style outside the ramp is a FALLBACK', () => {
    expect(compileFigmaFrame(txt('?', { name: 'Fancy 37px' })).report.fallbacks[0].reason).toMatch(/not in the type ramp/);
  });
  it('a native prose list → <List component="ul"> (rule 4d-2)', () => {
    const c = compileFigmaFrame(KITCHEN_SINK).code;
    expect(c).toMatch(/<List component="ul">\s*<ListItem>One<\/ListItem>\s*<ListItem>Two<\/ListItem>/);
  });
  it('text with JSX-special characters is quoted, not broken', () => {
    expect(compileFigmaFrame(txt('a {b} <c>', { styleName: 'Body' })).code).toContain("<Body>{'a {b} <c>'}</Body>");
  });
});

describe('Layout (rules 1, 1a, 2, 2a, 2d, 3, 4h)', () => {
  it('auto-layout → VStack / HStack with an exact Sizing token', () => {
    const c = compileFigmaFrame(frame('Col', 'VERTICAL', [txt('a', { styleName: 'Body', sizingH: 'FILL' })], { layout: { gap: 16 } })).code;
    expect(c).toContain('<VStack gap="var(--Sizing-2)">');
    // A HUG child on a MIN counter axis sits at the start, not stretched.
    const hug = compileFigmaFrame(frame('Col', 'VERTICAL', [txt('a', { styleName: 'Body' })], { layout: { gap: 16 } })).code;
    expect(hug).toContain('<VStack alignItems="flex-start" gap="var(--Sizing-2)">');
    const h = compileFigmaFrame(frame('Row', 'HORIZONTAL', [txt('a', { styleName: 'Body' })], { layout: { gap: 4, counterAxis: 'CENTER' } })).code;
    expect(h).toContain('<HStack gap="var(--Sizing-Half)">'); // center is HStack's default
  });
  it('an off-scale gap stays the designer’s px and is reported — never snapped', () => {
    const r = compileFigmaFrame(frame('Row', 'HORIZONTAL', [txt('a', { styleName: 'Body' })], { layout: { gap: 10 } }));
    expect(r.code).toContain('gap="10px"');
    expect(r.report.notes.map((x) => x.message).join()).toMatch(/gap 10px is off the Sizing scale/);
  });
  it('primary-axis CENTER → justifyContent, not alignItems', () => {
    const c = compileFigmaFrame(frame('Col', 'VERTICAL', [txt('a', { styleName: 'Body' })], { layout: { primaryAxis: 'CENTER' } })).code;
    expect(c).toContain('justifyContent="center"');
    expect(c).not.toContain('alignItems="center"');
  });
  it('Theme + Surface modes → a Box that paints; no fill → ThemedZone', () => {
    expect(compileFigmaFrame(frame('P', 'VERTICAL', [], { modes: { Theme: 'Tertiary', Surface: 'Container' } })).code).toMatch(/<Box\s+surface="Container"\s+theme="Tertiary"/);
    expect(compileFigmaFrame(KITCHEN_SINK).code).toMatch(/^ {4}<ThemedZone\n\s+surface="Surface"\n\s+theme="Primary"/m);
  });
  it('a page frame → Section > Container', () => {
    const c = compileFigmaFrame(frame('Mobile Home', 'VERTICAL', [txt('a', { styleName: 'Body' })], { modes: { Theme: 'Primary' } })).code;
    expect(c).toMatch(/<Section theme="Primary">\s*<Container>\s*<VStack/);
  });
  it('a frame NAMED Card is not a Card (rule 1a)', () => {
    const c = compileFigmaFrame(frame('Card', 'VERTICAL', [txt('a', { styleName: 'Body' })])).code;
    expect(c).not.toContain('<Card');
  });
  it('a Card instance is a Card, with its elevation and surface', () => {
    const c = compileFigmaFrame(KITCHEN_SINK).code;
    expect(c).toMatch(/<Card elevated surface="Container">\s*<BodySmall color="quiet">Card body<\/BodySmall>/);
  });
  it('FIXED sizes become px; FILL on the main axis → flexGrow; HUG → nothing', () => {
    const c = compileFigmaFrame(frame('Row', 'HORIZONTAL', [
      txt('fixed', { id: 'a', styleName: 'Body', sizingH: 'FIXED', width: 120, height: 20 }),
      txt('fill', { id: 'b', styleName: 'Body', sizingH: 'FILL' }),
      txt('hug', { id: 'c', styleName: 'Body' }),
    ])).code;
    expect(c).toContain('style={{ width: 120 }}');
    expect(c).toContain('style={{ flexGrow: 1 }}');
    expect(c).toContain('<Body>hug</Body>');
  });
  it('picks the cross-axis form needing fewer per-child overrides', () => {
    // Three FILL children and one HUG: stretch on the parent, alignSelf on the HUG one.
    const c = compileFigmaFrame(frame('Col', 'VERTICAL', [
      txt('a', { id: 'a', styleName: 'Body', sizingH: 'FILL' }), txt('b', { id: 'b', styleName: 'Body', sizingH: 'FILL' }),
      txt('c', { id: 'c', styleName: 'Body', sizingH: 'FILL' }), txt('d', { id: 'd', styleName: 'Body' }),
    ])).code;
    expect(c).toContain("<Body style={{ alignSelf: 'flex-start' }}>d</Body>");
    expect(c).not.toContain('alignItems');
  });
  it('padding collapses to shorthand, tokens per side', () => {
    expect(paddingShorthand([16, 24, 16, 24]).css).toBe('var(--Sizing-2) var(--Sizing-3)');
    expect(paddingShorthand([8, 8, 8, 8]).css).toBe('var(--Sizing-1)');
    expect(paddingShorthand([4, 10, 4, 10]).offScale).toEqual([10, 10]);
  });
  it('a bound spacing variable wins when it names a real token, and only then', () => {
    expect(spacing(9, 'Sizing/Sizing-1').css).toBe('var(--Sizing-1)');
    expect(spacing(9, 'Spacing/Made-Up').css).toBe('9px');
  });
});

describe('Modes (rule 0)', () => {
  it('elevation maps the number straight through — never subtracts', () => {
    expect(elevationFromMode('Level-0')).toBe(0);
    expect(elevationFromMode('Level-5')).toBe(5);
    expect(elevationFromMode('Elevation-3')).toBe(3);
    expect(elevationFromMode(undefined)).toBeUndefined();
  });
  it('a "*-Light" theme is split into the base theme on Surface-Brightest', () => {
    const r = themeAndSurface('Primary-Light', undefined);
    expect([r.theme, r.surface]).toEqual(['Primary', 'Surface-Brightest']);
    expect(r.problems).toHaveLength(1);
  });
  it('"Auto" modes are dropped from the IR — inheritance is the tree', () => {
    const ir = buildIR({ id: '1', name: 'F', type: 'FRAME', modes: { Theme: 'Auto (Primary)', '.Surface': 'Container' } });
    expect(ir.root.modes).toEqual({ Surface: 'Container' });
  });
});

describe('Small tables', () => {
  it('Ratio names', () => {
    expect(ratioName('Golden Horizontal')).toBe('Golden-Horizontal');
    expect(ratioName('16:9')).toBe('16:9');
    expect(ratioName('7:3')).toBeUndefined();
  });
  it('Ratio: Fill Vertical → fit="height", a content slot collapses into children', () => {
    expect(compileFigmaFrame(KITCHEN_SINK).code).toMatch(/<Ratio fit="height" ratio="Golden-Horizontal">\s*<Avatar size="xl" \/>/);
  });
  it('Icon names', () => {
    expect(iconComponentName('chevron-right')).toBe('ChevronRight');
    expect(iconComponentName('more_vert', 'Sharp')).toBe('MoreVertSharp');
    expect(iconComponentName('info_outline')).toBe('InfoOutlined');
    expect(iconComponentName('3d_rotation')).toBeNull();
  });
  it('Chip writes variant="default" — the lib default is neutral', () => {
    expect(compileFigmaFrame(KITCHEN_SINK).code).toMatch(/<Chip\s+label="Design"\s+selected\s+startDecorator=\{<Avatar defaultPhoto \/>\}\s+variant="default"/);
  });
  it('Divider thickness follows the Component-Size mode', () => {
    expect(compileFigmaFrame(KITCHEN_SINK).code).toContain('<Divider colored orientation="vertical" />');
  });
});

// ── The token metric ────────────────────────────────────────────────────────

describe('token saving: full LLM prompt vs fallback-only prompt', () => {
  it('a fully compiled frame needs no model call at all', () => {
    const cmp = comparePromptSizes(SYNTHETIC);
    expect(cmp.fallbackOnly).toEqual({ chars: 0, tokens: 0 });
    expect(cmp.saving).toBe(1);
    expect(cmp.full.tokens).toBeGreaterThan(10000);
  });

  it('a frame with fallbacks sends only those nodes, with the compiled file', () => {
    const result = compileFigmaFrame(KITCHEN_SINK);
    const prompt = buildFallbackPrompt(result)!;
    expect(prompt.user).toContain(result.code);
    for (const id of ['vec-1', 'det-1', 'unk-1']) expect(prompt.user).toContain(`"id":"${id}"`);
    // Compiled nodes are context in the code, not repeated as node data.
    expect(prompt.user).not.toContain('"id":"btn-1"');
    const cmp = comparePromptSizes(KITCHEN_SINK);
    expect(cmp.fallbackOnly.chars).toBeLessThan(cmp.full.chars / 3);
  });
});

describe('sha256', () => {
  it('matches node:crypto', () => {
    for (const s of ['', 'abc', 'a'.repeat(1000), 'é · 漢字 · 🦕', compileFigmaFrame(SYNTHETIC).code]) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });
});
