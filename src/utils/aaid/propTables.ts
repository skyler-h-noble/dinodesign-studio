// propTables.ts — the converter's prose rules, as lookup tables.
//
// figmaToCode.ts carries ~1,000 lines of rules that tell a model how to read a
// Figma node. Most of them are not judgement at all — they are tables written
// as sentences: "Style=outline + Buttons mode Error → variant='error-outline'",
// "Level-3 → elevation={3}, never subtract", "a Ratio's fill direction is in
// the component-set name". A table in code gives the same answer every time,
// costs no tokens, and can be tested one row at a time.
//
// The rule each table replaces is cited beside it (rule 0, 0c, 4c, 4f, …) so a
// change to one side can be found from the other.
//
// VOCABULARIES mirror the lib's TypeScript unions (types/core-props.d.ts and
// types/props/*.d.ts in @omni-design/components). They are written out rather
// than imported because the studio's typecheck resolves the package through
// the ambient shim in src/types/dynodesign.d.ts, which does not carry them —
// src/__tests__/aaidCompiler.test.ts compiles every list against the REAL
// types, so a value the lib drops fails a test instead of shipping.

import { buttonVariant, buttonVariantLosesColor, COMPONENT_SIZE_DEFAULT, type ButtonShape } from '../figmaModeMapping';
import type { IRNode } from './ir';
import { el, lit, node as nodeProp, str, style, text, yes, type JsxElement, type JsxFallback, type JsxNode, type PropValue } from './jsx';

// ── Vocabularies (= the lib's unions) ───────────────────────────────────────

export const THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'App-Bar', 'Nav-Bar', 'Status'] as const;
export const SURFACES = ['Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest', 'Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest'] as const;
export const COLORS = ['default', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error'] as const;
/** The ten Buttons modes: every Color plus black-white. */
export const BUTTON_COLORS = [...COLORS, 'black-white'] as const;
export const SIZES = ['small', 'medium', 'large'] as const;
export const ELEVATIONS = [0, 1, 2, 3, 4, 5] as const;
export const TEXT_COLORS = ['standard', 'default', 'inherit', 'quiet', 'eyebrow', 'primary', 'secondary', 'tertiary', 'neutral', 'info', 'success', 'warning', 'error'] as const;
export const RATIO_NAMES = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '1:2', '2:1', '9:21', '21:9', '5:7', '7:5', '4:5', '5:4', '5:3', '3:5', '16:10', '10:16', 'Golden-Horizontal', 'Golden-Vertical'] as const;
/** Avatar sizes — realigned to Figma's Icons & Avatars names on 2026-09-28. */
export const AVATAR_SIZES = ['xxs', 'xs', 'small', 'medium', 'large', 'xl', 'xxl'] as const;
/** Button variants the compiler emits: solid + -outline per palette, and ghost. */
export const BUTTON_VARIANTS = [...BUTTON_COLORS, ...BUTTON_COLORS.map((c) => `${c}-outline` as const), 'ghost'] as const;

const has = <T extends string | number>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

// ── Spacing tokens (rule 2 / 2d / 4h) ───────────────────────────────────────
//
// A gap or padding becomes a Sizing token ONLY on an exact match. Rule 2 is
// explicit that snapping to the nearest token is wrong — 10px is not 8px — so
// an off-scale value stays the designer's literal px and is reported, never
// rounded into a token that says something else.

export const SIZING_TOKENS: Record<number, string> = {
  2: 'Sizing-Quarter', 4: 'Sizing-Half', 8: 'Sizing-1', 12: 'Sizing-1-and-Half', 16: 'Sizing-2',
  20: 'Sizing-2-and-Half', 24: 'Sizing-3', 32: 'Sizing-4', 40: 'Sizing-5', 48: 'Sizing-6', 56: 'Sizing-7',
  64: 'Sizing-8', 72: 'Sizing-9', 80: 'Sizing-10', 88: 'Sizing-11', 96: 'Sizing-12', 104: 'Sizing-13',
  112: 'Sizing-14', 120: 'Sizing-15', 128: 'Sizing-16', 160: 'Sizing-20', 240: 'Sizing-30',
};
const SIZING_NAMES = new Set(Object.values(SIZING_TOKENS));

/**
 * A spacing value as CSS. A bound variable wins when it names a real Sizing
 * token; otherwise an exact px match; otherwise the literal px.
 */
export function spacing(px: number, boundName?: string): { css: string; onScale: boolean } {
  if (boundName) {
    const last = boundName.split('/').pop()!.trim().replace(/\s+/g, '-');
    if (SIZING_NAMES.has(last)) return { css: `var(--${last})`, onScale: true };
  }
  if (px === 0) return { css: '0', onScale: true };
  const tok = SIZING_TOKENS[px];
  return tok ? { css: `var(--${tok})`, onScale: true } : { css: `${px}px`, onScale: false };
}

/** CSS padding shorthand, collapsed the way a person would write it. */
export function paddingShorthand(p: [number, number, number, number], bound: Record<string, string> = {}): { css: string; offScale: number[] } {
  const keys = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const parts = p.map((v, i) => spacing(v, bound[keys[i]]));
  const off = p.filter((_, i) => !parts[i].onScale);
  const [t, r, b, l] = parts.map((x) => x.css);
  let css: string;
  if (t === r && r === b && b === l) css = t;
  else if (t === b && r === l) css = `${t} ${r}`;
  else if (r === l) css = `${t} ${r} ${b}`;
  else css = `${t} ${r} ${b} ${l}`;
  return { css, offScale: off };
}

// ── Modes (rule 0) ──────────────────────────────────────────────────────────

/** "Level-3", "Elevation-3", "Level 3" → 3. Zero-based, NEVER subtract (rule 4i). */
export function elevationFromMode(mode: string | undefined): 0 | 1 | 2 | 3 | 4 | 5 | undefined {
  if (!mode) return undefined;
  const m = /(?:level|elevation)[\s-]*(\d)/i.exec(mode);
  if (!m) return undefined;
  const k = Number(m[1]);
  return has(ELEVATIONS, k) ? (k as 0 | 1 | 2 | 3 | 4 | 5) : undefined;
}

/** A Buttons mode name → the lib's lower-case color. "Black-White" → "black-white". */
export function buttonColorFromMode(mode: string | undefined): (typeof BUTTON_COLORS)[number] | undefined {
  if (!mode) return undefined;
  const c = mode.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return has(BUTTON_COLORS, c) ? c : undefined;
}

/**
 * A Theme / Surface mode, validated. A "*-Light" theme does not exist — a tint
 * is the base theme at a brighter surface (TOKEN_CATALOG) — so it is split
 * rather than emitted as a theme no sheet defines.
 */
export function themeAndSurface(theme: string | undefined, surface: string | undefined): {
  theme?: (typeof THEMES)[number]; surface?: (typeof SURFACES)[number]; problems: string[];
} {
  const problems: string[] = [];
  let t: string | undefined = theme;
  let s: string | undefined = surface;
  if (t && /-light$/i.test(t)) {
    problems.push(`theme "${t}" does not exist — emitted as ${t.replace(/-light$/i, '')} on Surface-Brightest`);
    t = t.replace(/-light$/i, '');
    s = s ?? 'Surface-Brightest';
  }
  const out: { theme?: (typeof THEMES)[number]; surface?: (typeof SURFACES)[number]; problems: string[] } = { problems };
  if (t) {
    if (has(THEMES, t)) out.theme = t;
    else problems.push(`theme "${t}" is not a lib Theme — omitted`);
  }
  if (s) {
    if (has(SURFACES, s)) out.surface = s;
    else problems.push(`surface "${s}" is not a lib Surface — omitted`);
  }
  return out;
}

// ── Typography (rule 4c / 4e / 4e0) ─────────────────────────────────────────
//
// A text style NAME maps 1:1 to the lib component of the same name. Eyebrow is
// the canonical name for what Figma files still call Overline (CLAUDE.md:
// "Eyebrow and Overline are one concept under two names").

export const TEXT_STYLE_TO_EXPORT: Record<string, string> = {
  'display-large': 'DisplayLarge', 'display-medium': 'DisplayMedium', 'display-small': 'DisplaySmall',
  'alt-display-large': 'AltDisplayLarge', 'alt-display-medium': 'AltDisplayMedium', 'alt-display-small': 'AltDisplaySmall',
  h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6',
  'subtitle-large': 'SubtitleLarge', subtitle: 'Subtitle', 'subtitle-medium': 'Subtitle', 'subtitle-small': 'SubtitleSmall',
  'body-large': 'BodyLarge', body: 'Body', 'body-medium': 'Body', 'body-small': 'BodySmall',
  'body-semibold': 'BodySemibold', 'body-medium-semibold': 'BodySemibold',
  'body-large-semibold': 'BodyLargeSemibold', 'body-small-semibold': 'BodySmallSemibold',
  /* body-bold is a back-compat alias of SEMIBOLD in the lib (CLAUDE.md, Body
     weights) — emit the name that says what renders. */
  'body-bold': 'BodySemibold', 'body-medium-bold': 'BodySemibold',
  'body-large-bold': 'BodyLargeSemibold', 'body-small-bold': 'BodySmallSemibold',
  caption: 'Caption', 'caption-bold': 'CaptionBold', legal: 'Legal', 'legal-semibold': 'LegalSemibold',
  label: 'Label', 'label-medium': 'Label', 'label-small': 'LabelSmall', 'label-large': 'LabelLarge', 'label-extra-small': 'LabelExtraSmall',
  eyebrow: 'Eyebrow', 'eyebrow-medium': 'Eyebrow', 'eyebrow-small': 'EyebrowSmall', 'eyebrow-large': 'EyebrowLarge',
  overline: 'Eyebrow', 'overline-medium': 'Eyebrow', 'overline-small': 'EyebrowSmall', 'overline-large': 'EyebrowLarge',
  'number-small': 'NumberSmall', 'number-medium': 'NumberMedium', 'number-large': 'NumberLarge',
  /* The live file names the lib's one caption size Caption-Medium (it also has
     Caption-Small / -Large, which no lib export draws — left unmapped). */
  'caption-medium': 'Caption', 'caption-medium-bold': 'CaptionBold',
};

/**
 * The other direction: a typography export → the live Figma text style that
 * draws it, spelled exactly. TEXT_STYLE_TO_EXPORT is many-to-one (body,
 * body-medium → Body), so the inverse has to name which style is the real one.
 * code2figma.test.ts checks each value is a live style AND reads back through
 * TEXT_STYLE_TO_EXPORT to the same export, so the two tables cannot drift.
 */
export const EXPORT_TO_TEXT_STYLE: Record<string, string> = {
  DisplayLarge: 'Display-Large', DisplayMedium: 'Display-Medium', DisplaySmall: 'Display-Small',
  AltDisplayLarge: 'Alt-Display-Large', AltDisplayMedium: 'Alt-Display-Medium', AltDisplaySmall: 'Alt-Display-Small',
  H1: 'H1', H2: 'H2', H3: 'H3', H4: 'H4', H5: 'H5', H6: 'H6',
  SubtitleLarge: 'Subtitle-Large', Subtitle: 'Subtitle-Medium', SubtitleSmall: 'Subtitle-Small',
  BodyLarge: 'Body-Large', Body: 'Body-Medium', BodySmall: 'Body-Small',
  BodyLargeSemibold: 'Body-Large-Semibold', BodySemibold: 'Body-Medium-Semibold', BodySmallSemibold: 'Body-Small-Semibold',
  Caption: 'Caption-Medium', CaptionBold: 'Caption-Medium-Bold', Legal: 'Legal', LegalSemibold: 'Legal-Semibold',
  LabelLarge: 'Label-Large', Label: 'Label-Medium', LabelSmall: 'Label-Small',
  EyebrowLarge: 'Eyebrow-Large', Eyebrow: 'Eyebrow-Medium', EyebrowSmall: 'Eyebrow-Small',
  NumberLarge: 'Number-Large', NumberMedium: 'Number-Medium', NumberSmall: 'Number Small',
};

/** Display and heading exports: never given a color prop (rule 4e). */
export const HEADING_EXPORTS = new Set(['DisplayLarge', 'DisplayMedium', 'DisplaySmall', 'AltDisplayLarge', 'AltDisplayMedium', 'AltDisplaySmall', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** "Typography/Body/Medium", "Body Medium", "Overline_Small" → "body-medium" … */
export function normalizeStyleName(name: string): string {
  let s = name.trim().toLowerCase().replace(/[\s_/]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  s = s.replace(/^typography-/, '').replace(/^headings?-/, '').replace(/^labels-/, 'label-');
  return s;
}

export function typographyExport(styleName: string | undefined): string | undefined {
  if (!styleName) return undefined;
  return TEXT_STYLE_TO_EXPORT[normalizeStyleName(styleName)];
}

/** A bound fill token → the typography color prop. Plain Text / Header = default. */
export function textColorFromToken(token: string | undefined): (typeof TEXT_COLORS)[number] | undefined {
  if (!token) return undefined;
  const t = token.split('/').pop()!.trim().toLowerCase();
  if (/(^|-)quiet$/.test(t)) return 'quiet';
  const m = /^(?:text-)?(primary|secondary|tertiary|neutral|info|success|warning|error)$/.exec(t);
  return m ? (m[1] as (typeof TEXT_COLORS)[number]) : undefined;
}

// ── Lib defaults (props equal to these are not written) ─────────────────────

export const LIB_DEFAULTS: Record<string, Record<string, string | number | boolean>> = {
  Avatar: { size: 'medium', color: 'default' },
  Box: { elevation: 0, radius: 'none' },
  Button: { variant: 'default', size: 'medium' },
  Card: { size: 'medium', variant: 'solid', orientation: 'vertical' },
  Checkbox: { variant: 'default', size: 'medium' },
  Chip: { variant: 'neutral' },
  Divider: { size: 'small', orientation: 'horizontal' },
  List: { size: 'medium', orientation: 'vertical', variant: 'default' },
  ListItem: { size: 'medium', variant: 'default' },
  Ratio: { ratio: '1:1', fit: 'width' },
};

// ── Variant tables (rule 0c: map EVERY variant) ─────────────────────────────
//
// Each row reads one Figma variant property (case-insensitive key) and maps its
// value (case-insensitive) to a [prop, literal] pair, or null = "emit nothing,
// and that is correct" (a runtime state, a default). A value missing from the
// row is reported as unmapped — rule 0c says a variant the designer set is a
// fact, so silently dropping one is the failure.
//
// The tables run BOTH ways. Figma → code reads them as written. Code → Figma
// (src/utils/code2figma/) reads them backwards: for each row it draws the
// value whose [prop, literal] the code sets, else the row's `draw` value. So:
//
//   - value keys are spelled EXACTLY as the live Figma set spells them
//     ("Non-clickable", "iconOnly", "Focus-Visible") — Figma variant values
//     are case-sensitive, and this is where the spelling lives;
//   - `draw` is the value a component with none of the row's props gets. A row
//     without `draw` is read-only: an axis older files have and the live
//     library no longer does (Button Size, Card Elevation, ListItem Type). It
//     still compiles old files and is never drawn.
//
// src/utils/code2figma/figmaLibrary.live.json is the live capture these
// spellings are checked against (code2figma.test.ts).

export type VariantRow = {
  figma: string;
  values: Record<string, [string, string | number | true] | null>;
  /** The value drawn when the code sets none of this row's props. */
  draw?: string;
};

const STATES_RUNTIME = { Default: null, Hover: null, Pressed: null, 'Focus-Visible': null, Focus: null } as const;

export const VARIANT_TABLES: Record<string, VariantRow[]> = {
  /* rule 4f — Size / Elevation / Type / State / Status. Style (the shape) and
     the Buttons mode compose into `variant` in mapButton, not here. Size and
     Elevation are older files' axes: the live set takes size from the
     Component-Size mode and has no elevation axis. */
  Button: [
    { figma: 'Size', values: { small: ['size', 'small'], medium: null, large: ['size', 'large'] } },
    { figma: 'Elevation', values: { elevated: ['elevated', true], default: null, flat: null, none: null } },
    { figma: 'Type', draw: 'text', values: { text: null, iconOnly: ['iconOnly', true], letterNumber: ['letterNumber', true], Avatar: ['avatar', true] } },
    { figma: 'State', draw: 'Default', values: { ...STATES_RUNTIME, Disabled: ['disabled', true] } },
    { figma: 'Status', draw: 'unselected', values: { selected: ['selected', true], unselected: null } },
    { figma: 'Badge', draw: 'false', values: { true: ['badge', true], false: null } },
  ],
  /* rule 4f-2 — no shape axis; color is the Buttons mode. Checked becomes
     defaultChecked: the output is static, and `checked` without onChange is a
     read-only control React warns about. State=error is an older file's way of
     saying what the live set's Validation boolean says. */
  Checkbox: [
    { figma: 'Size', values: { small: ['size', 'small'], medium: null, large: ['size', 'large'] } },
    { figma: 'Checked', draw: 'unchecked', values: { checked: ['defaultChecked', true], unchecked: null, indeterminate: ['indeterminate', true] } },
    { figma: 'State', draw: 'Default', values: { ...STATES_RUNTIME, Disabled: ['disabled', true], error: ['error', true] } },
    { figma: 'Validation', draw: 'false', values: { true: ['error', true], false: null } },
  ],
  /* rule 4f-3 — the lib's color is a palette; "Colored" draws the line in it.
     Figma's Size axis has one option; thickness follows Component-Size. The
     palette values are older files'; the live set has Default | Colored. */
  Divider: [
    { figma: 'Orientation', draw: 'horizontal', values: { horizontal: null, vertical: ['orientation', 'vertical'] } },
    {
      figma: 'Color',
      draw: 'Default',
      values: {
        Default: null, 'border-variant': null, Colored: ['colored', true],
        primary: ['color', 'primary'], secondary: ['color', 'secondary'], tertiary: ['color', 'tertiary'],
        neutral: ['color', 'neutral'], info: ['color', 'info'], success: ['color', 'success'],
        warning: ['color', 'warning'], error: ['color', 'error'],
      },
    },
    { figma: 'Size', draw: 'small', values: { small: null } },
    /* The live set's Pill boolean draws a nested Divider-Pill with text —
       indicatorText in the lib. Not mapped yet, so Pill=true is reported. */
    { figma: 'Pill', draw: 'false', values: { false: null } },
  ],
  /* Avatar's Style axis (parity: Photo · Default · Initials). Older files
     called it Type / Content with Icon for the glyph. Container=Shape draws an
     Avatar Shape — which shape is a nested instance, not mapped yet. */
  Avatar: [
    { figma: 'Style', draw: 'Default', values: { Photo: ['defaultPhoto', true], Default: null, icon: null, Initials: null } },
    { figma: 'Type', values: { photo: ['defaultPhoto', true], default: null, icon: null, initials: null } },
    { figma: 'Content', values: { photo: ['defaultPhoto', true], default: null, icon: null, initials: null } },
    { figma: 'Container', draw: 'Circle', values: { Circle: null } },
  ],
  Chip: [
    { figma: 'State', draw: 'Default', values: { ...STATES_RUNTIME, Disabled: ['disabled', true] } },
    { figma: 'Status', draw: 'unselected', values: { selected: ['selected', true], unselected: null } },
  ],
  /* The live Card (2026-11) is Orientation × State × Elevated, with State=Drag
     and a Selected BOOLEAN. Older files had Elevation=elevated and a Status
     axis; both still compile. */
  Card: [
    { figma: 'State', draw: 'Non-clickable', values: { 'Non-clickable': null, ...STATES_RUNTIME, Disabled: ['disabled', true], Drag: ['draggable', true] } },
    { figma: 'Status', values: { selected: ['selected', true], unselected: null } },
    { figma: 'Selected', draw: 'false', values: { true: ['selected', true], false: null } },
    { figma: 'Orientation', draw: 'vertical', values: { vertical: null, horizontal: ['orientation', 'horizontal'] } },
    { figma: 'Elevated', draw: 'false', values: { true: ['elevated', true], false: null } },
    { figma: 'Elevation', values: { elevated: ['elevated', true], default: null, flat: null } },
    { figma: 'No Bleed Content', draw: 'false', values: { false: null } },
  ],
  List: [
    { figma: 'Type', draw: 'Non-clickable', values: { Clickable: ['clickable', true], 'Non-clickable': null } },
    { figma: 'Orientation', draw: 'vertical', values: { vertical: null, horizontal: ['orientation', 'horizontal'] } },
    { figma: 'Size', values: { small: ['size', 'small'], medium: null, large: ['size', 'large'] } },
  ],
  /* The live List Item says clickable through State (Non-clickable vs the
     interaction states) — mapListItem reads that; older files used Type. */
  ListItem: [
    { figma: 'Type', values: { clickable: ['clickable', true], 'non-clickable': null } },
    { figma: 'Size', values: { small: ['size', 'small'], medium: null, large: ['size', 'large'] } },
    { figma: 'Status', values: { selected: ['selected', true], unselected: null } },
    { figma: 'Selected', draw: 'false', values: { true: ['selected', true], false: null } },
    { figma: 'State', draw: 'Non-clickable', values: { 'Non-clickable': null, ...STATES_RUNTIME, Disabled: ['disabled', true] } },
    { figma: 'Bottom Border', draw: 'false', values: { true: ['bottomBorder', true], false: null } },
    { figma: 'Right Border', draw: 'false', values: { true: ['rightBorder', true], false: null } },
  ],
  Box: [
    { figma: 'Radius', values: { none: null, small: ['radius', 'small'], medium: ['radius', 'medium'], large: ['radius', 'large'] } },
  ],
};

/**
 * Variant keys a mapper reads itself (shape, ratio, booleans that become
 * decorators). They are consumed, not unmapped.
 */
export const CONSUMED_KEYS: Record<string, string[]> = {
  Button: ['style', 'appearance', 'color', 'fit', 'start-avatar', 'start-icon', 'end-icon', 'end-avatar'],
  Chip: ['start-avatar', 'start-icon', 'end-icon', 'end-avatar', 'deletable', 'color'],
  Ratio: ['ratio', 'property 1', 'image placeholder', 'fill'],
  Typography: ['type', 'style', 'property 1', 'variant'],
  Icon: ['style', 'icon name'],
  Tag: ['color', 'theme', 'fit'],
  ListItem: ['1st row', '2nd row', '3rd row', 'show eyebrow', 'show title', 'show secondary', 'start slot', 'end slot', 'beginning slot', 'image'],
};

export interface MappedVariants {
  props: Array<[string, PropValue]>;
  unmapped: string[];
}

/** A row's value entry, matched case-insensitively. */
export function rowValue(row: VariantRow, value: string): { key: string; hit: [string, string | number | true] | null } | undefined {
  const v = value.trim().toLowerCase();
  for (const key of Object.keys(row.values)) if (key.toLowerCase() === v) return { key, hit: row.values[key] };
  return undefined;
}

/** Apply one component's variant table to an instance's props. */
export function applyVariantTable(exportName: string, props: Record<string, string> | undefined): MappedVariants {
  const rows = VARIANT_TABLES[exportName] ?? [];
  const consumed = new Set(CONSUMED_KEYS[exportName] ?? []);
  const out: Array<[string, PropValue]> = [];
  const unmapped: string[] = [];
  const seen = new Set<string>();
  for (const key of Object.keys(props ?? {}).sort()) {
    const k = key.trim().toLowerCase();
    const raw = props![key];
    const row = rows.find((r) => r.figma.toLowerCase() === k);
    if (!row) {
      if (!consumed.has(k)) unmapped.push(`${key}=${raw}`);
      continue;
    }
    const entry = rowValue(row, raw);
    if (!entry) {
      unmapped.push(`${key}=${raw}`);
      continue;
    }
    const hit = entry.hit;
    if (hit && !seen.has(hit[0])) {
      seen.add(hit[0]);
      out.push([hit[0], lit(hit[1])]);
    }
  }
  return { props: out, unmapped };
}

/**
 * The inverse of applyVariantTable: code props → Figma variant values, for the
 * rows that are drawn (`draw` set). `hasValue` says whether the target set has
 * that axis and value — a value the live set lacks is never drawn, and a row
 * whose axis the set lacks is skipped. Returns the props the rows consumed, so
 * the caller can tell what was not expressed.
 */
export function invertVariantTable(
  exportName: string,
  code: Record<string, unknown>,
  hasValue: (axis: string, value: string) => boolean = () => true,
): { variant: Record<string, string>; used: string[] } {
  const variant: Record<string, string> = {};
  const used: string[] = [];
  for (const row of VARIANT_TABLES[exportName] ?? []) {
    if (row.draw === undefined || !hasValue(row.figma, row.draw)) continue;
    let chosen = row.draw;
    for (const [key, hit] of Object.entries(row.values)) {
      if (!hit) continue;
      const [prop, want] = hit;
      const got = code[prop];
      const match = want === true ? got === true : got === want;
      if (match && hasValue(row.figma, key)) { chosen = key; used.push(prop); break; }
    }
    variant[row.figma] = chosen;
  }
  return { variant, used };
}

/** Read a variant value by case-insensitive key. */
export function variantOf(n: IRNode, ...keys: string[]): string | undefined {
  if (!n.props) return undefined;
  for (const want of keys) {
    for (const k of Object.keys(n.props)) if (k.trim().toLowerCase() === want.toLowerCase()) return n.props[k];
  }
  return undefined;
}

export function isTrue(v: string | undefined): boolean {
  return v !== undefined && /^(true|on|yes|shown|show)$/i.test(v.trim());
}

// ── Which component is this node? ───────────────────────────────────────────

export type ComponentKind =
  | 'button' | 'checkbox' | 'divider' | 'ratio' | 'listItem' | 'list' | 'avatar'
  | 'typography' | 'chip' | 'tag' | 'card' | 'icon' | 'box';

export const COMPONENT_NAME_PATTERNS: Array<[RegExp, ComponentKind]> = [
  [/^button(-small|-large)?(-elevated)?$/, 'button'],
  [/^checkbox$/, 'checkbox'],
  [/^divider$/, 'divider'],
  [/^ratio( - fill (horizontal|vertical))?$/, 'ratio'],
  [/^list item$/, 'listItem'],
  [/^list$/, 'list'],
  [/^avatar$/, 'avatar'],
  [/^typography$/, 'typography'],
  [/^chip$/, 'chip'],
  [/^tag$/, 'tag'],
  [/^card$/, 'card'],
  [/^icon$/, 'icon'],
  [/^box$/, 'box'],
];

/** The kind for a component-set name (or a layer name when there is none). */
export function componentKindFromName(name: string | undefined): ComponentKind | undefined {
  if (!name) return undefined;
  const s = name.trim().replace(/^[._]+/, '').toLowerCase();
  for (const [re, kind] of COMPONENT_NAME_PATTERNS) if (re.test(s)) return kind;
  return undefined;
}

/**
 * Layer names that, on a plain FRAME, mean the instance was detached. Card and
 * Box are left out on purpose: people name their own containers that, and rule
 * 1a says such a frame is a Box, not a detached Card.
 */
export const DETACHED_NAMES = ['Button', 'Checkbox', 'Divider', 'Avatar', 'Chip', 'Tag', 'Typography', 'Ratio - Fill Horizontal', 'Ratio - Fill Vertical', 'List Item', 'Icon'];

// ── Mapping context ─────────────────────────────────────────────────────────

export type Slot = 'flow' | 'decorator' | 'inline';

/** What a mapper may ask of the compiler. Implemented in emitJsx.ts. */
export interface MapCtx {
  mode(n: IRNode, collection: string, defaultMode: string): string;
  mode(n: IRNode, collection: string): string | undefined;
  /** Compile a child in a slot. */
  compile(n: IRNode, slot: Slot): JsxNode | null;
  fallback(n: IRNode, reason: string): JsxFallback;
  note(n: IRNode, message: string): void;
  /** A DERIVED-ARIA-LABEL line for the header (rule 0d). */
  derived(line: string): void;
  /** Layout style the PARENT asks this node to carry (flexGrow, alignSelf, …). */
  layoutStyle(n: IRNode, opts?: { box?: boolean }): Array<[string, string | number]>;
}

// ── Small helpers ───────────────────────────────────────────────────────────

/** Drop props equal to the lib default; keep the rest in table order. */
export function stripDefaults(exportName: string, props: Array<[string, PropValue]>): Array<[string, PropValue]> {
  const d = LIB_DEFAULTS[exportName] ?? {};
  return props.filter(([k, v]) => {
    if (!(k in d)) return true;
    const def = d[k];
    if (v.kind === 'string') return v.value !== def;
    if (v.kind === 'number') return v.value !== def;
    if (v.kind === 'true') return def !== true;
    return true;
  });
}

function withStyle(props: Array<[string, PropValue]>, s: Array<[string, string | number]>): Array<[string, PropValue]> {
  return s.length ? [...props, ['style', style(s)]] : props;
}

/** First visible TEXT descendant with characters, depth-first. */
export function firstText(n: IRNode): IRNode | undefined {
  if (n.type === 'TEXT' && n.text && n.text.content.trim()) return n;
  for (const c of n.children ?? []) {
    const t = firstText(c);
    if (t) return t;
  }
  return undefined;
}

/** All descendants (not self) matching a predicate, pre-order. */
export function findAll(n: IRNode, pred: (x: IRNode) => boolean): IRNode[] {
  const out: IRNode[] = [];
  const walk = (x: IRNode) => {
    for (const c of x.children ?? []) {
      if (pred(c)) out.push(c);
      walk(c);
    }
  };
  walk(n);
  return out;
}

const kindOf = (x: IRNode) => componentKindFromName(x.component ?? (x.type === 'INSTANCE' ? x.name : undefined));

/** Layer names that are generic or automatic — not an accessible name (rule 0d). */
export function isMeaningfulName(name: string, componentName?: string): boolean {
  const s = name.trim();
  if (!s) return false;
  if (/^\d+$/.test(s)) return false;
  if (/^(frame|group|rectangle|ellipse|vector|instance|component|layer|slot|icon|text)( \d+)?$/i.test(s)) return false;
  if (componentKindFromName(s)) return false;
  if (componentName && s.toLowerCase() === componentName.toLowerCase()) return false;
  if (/^(button|checkbox|avatar)[-\s]/i.test(s)) return false;
  return true;
}

// ── Icon (rule 4d0) ─────────────────────────────────────────────────────────

const ICON_STYLE_SUFFIX: Record<string, string> = { default: '', round: 'Rounded', rounded: 'Rounded', sharp: 'Sharp' };

/** "chevron-right" + Round → "ChevronRightRounded". null when not nameable. */
export function iconComponentName(glyph: string, figmaStyle?: string): string | null {
  const words = glyph.trim().toLowerCase().split(/[\s_-]+/).filter(Boolean);
  if (!words.length || /^\d/.test(words[0])) return null;
  if (words[words.length - 1] === 'outline') words[words.length - 1] = 'outlined';
  const base = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(base)) return null;
  const suffix = ICON_STYLE_SUFFIX[(figmaStyle ?? 'default').trim().toLowerCase()];
  if (suffix === undefined) return null;
  return base + suffix;
}

/**
 * The inverse of iconComponentName, for code → Figma: "ChevronRightRounded" →
 * { glyph: "chevron_right", style: "Round" }. Material ligatures use
 * underscores. iconComponentName(glyph, style) gives the name back (tested).
 * undefined for a family Figma's Icon set does not draw (TwoTone).
 */
export function iconGlyphFromComponent(name: string): { glyph: string; style: 'Default' | 'Round' | 'Sharp' } | undefined {
  let base = name.replace(/Icon$/, '');
  let style: 'Default' | 'Round' | 'Sharp' = 'Default';
  if (/TwoTone$/.test(base)) return undefined;
  if (/Rounded$/.test(base)) { style = 'Round'; base = base.slice(0, -'Rounded'.length); }
  else if (/Sharp$/.test(base)) { style = 'Sharp'; base = base.slice(0, -'Sharp'.length); }
  const words = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  if (words[words.length - 1] === 'outlined') words[words.length - 1] = 'outline';
  return { glyph: words.join('_'), style };
}

/** The glyph an Icon instance draws: its ligature text, else its child's name. */
export function iconGlyph(icon: IRNode): string | undefined {
  const t = firstText(icon);
  if (t) return t.text!.content.trim();
  const child = (icon.children ?? []).find((c) => c.type === 'INSTANCE' || c.type === 'COMPONENT');
  return child?.name;
}

export function mapIcon(n: IRNode, ctx: MapCtx): JsxNode {
  const glyph = iconGlyph(n);
  const figmaStyle = variantOf(n, 'Style');
  const name = glyph ? iconComponentName(glyph, figmaStyle) : null;
  if (!name) return ctx.fallback(n, glyph ? `icon glyph "${glyph}" has no @omni-design/icons name` : 'icon glyph not identifiable');
  /* Filled icons keep their own path; @omni-design/icons 0.2.0 serves the
     Rounded / Sharp styles from one module each (a named import). */
  const style = /(Rounded|Sharp|Outlined|TwoTone)$/.exec(name)?.[1];
  const glyphEl = el(`${name}Icon`, [], [], style
    ? `@omni-design/icons/${style.toLowerCase()}#${name}`
    : `@omni-design/icons/${name}`);
  return el('Icon', [], [glyphEl]);
}

// ── Typography (rule 4c) ────────────────────────────────────────────────────

export function mapTypography(n: IRNode, ctx: MapCtx): JsxNode {
  const textNode = n.type === 'TEXT' ? n : firstText(n);
  const variantStyle = variantOf(n, 'type', 'style', 'property 1', 'variant');
  const exportName = typographyExport(variantStyle) ?? typographyExport(textNode?.text?.style) ?? typographyExport(n.name)
    ?? (textNode && textNode !== n ? typographyExport(textNode.name) : undefined);
  if (!textNode || !textNode.text?.content.trim()) return ctx.fallback(n, 'text layer has no characters');
  if (!exportName) {
    const tried = variantStyle ?? textNode.text.style ?? n.name;
    return ctx.fallback(n, `text style "${tried}" is not in the type ramp`);
  }
  if (textNode.text.list) return mapProseList(n, textNode, exportName, ctx);
  const props: Array<[string, PropValue]> = [];
  if (!HEADING_EXPORTS.has(exportName)) {
    const color = textColorFromToken(textNode.tokens?.fills ?? n.tokens?.fills);
    if (color) props.push(['color', str(color)]);
  }
  return el(exportName, withStyle(props, ctx.layoutStyle(n, { box: true })), [text(textNode.text.content)]);
}

/** rule 4d-2 — a native Figma list: <List component="ul|ol"> with one item per line. */
function mapProseList(n: IRNode, textNode: IRNode, exportName: string, ctx: MapCtx): JsxNode {
  const list = textNode.text!.list!;
  const lines = textNode.text!.content.split('\n');
  if (list.type && !list.indent) {
    return el('List', [['component', str(list.type === 'ORDERED' ? 'ol' : 'ul')]],
      lines.filter((l) => l.trim()).map((l) => el('ListItem', [], [text(l)])));
  }
  if (!list.lines || list.lines.some((x) => x.i > 0)) return ctx.fallback(n, 'nested prose list (indent levels)');
  /* Mixed: prose lines stay outside, runs of one list type group into a List. */
  const out: JsxNode[] = [];
  let run: { t: string; items: JsxNode[] } | null = null;
  const flush = () => {
    if (run) out.push(el('List', [['component', str(run.t === 'O' ? 'ol' : 'ul')]], run.items));
    run = null;
  };
  lines.forEach((line, i) => {
    const t = list.lines![i]?.t ?? 'N';
    if (t === 'N') {
      flush();
      if (line.trim()) out.push(el(exportName, [], [text(line)]));
      return;
    }
    if (!run || run.t !== t) { flush(); run = { t, items: [] }; }
    run.items.push(el('ListItem', [], [text(line)]));
  });
  flush();
  return out.length === 1 ? out[0] : el('VStack', [], out);
}

// ── Button (rule 4f, 4f-3b, 0d) ─────────────────────────────────────────────

const BUTTON_SHAPE: Record<string, ButtonShape> = { solid: 'solid', filled: 'solid', outline: 'outline', outlined: 'outline', ghost: 'ghost', text: 'ghost' };

/** A bound fill like "Buttons-Error-Button" → "error" (rule 4f PALETTE step 2). */
export function buttonColorFromFillToken(token: string | undefined): (typeof BUTTON_COLORS)[number] | undefined {
  if (!token) return undefined;
  const m = /buttons[-/](.+?)[-/]button$/i.exec(token.trim());
  return m ? buttonColorFromMode(m[1]) : undefined;
}

export function buttonColor(n: IRNode, ctx: MapCtx): (typeof BUTTON_COLORS)[number] {
  /* Mode first (rule 0: "the MODE wins"), then an un-migrated Color variant,
     then a bound semantic fill, then default — never primary by guess. */
  return buttonColorFromMode(ctx.mode(n, 'Buttons'))
    ?? buttonColorFromMode(variantOf(n, 'Color'))
    ?? buttonColorFromFillToken(n.tokens?.fills)
    ?? 'default';
}

function componentSize(n: IRNode, ctx: MapCtx): (typeof SIZES)[number] {
  const v = variantOf(n, 'Size')?.toLowerCase();
  if (has(SIZES, v)) return v;
  const m = ctx.mode(n, 'Component-Size', COMPONENT_SIZE_DEFAULT).toLowerCase();
  return has(SIZES, m) ? m : 'medium';
}

/** The decorator nodes of a Button / Chip, honouring its booleans. */
function decorators(n: IRNode, ctx: MapCtx): { start?: JsxNode; end?: JsxNode } {
  const icons = findAll(n, (x) => kindOf(x) === 'icon');
  const avatars = findAll(n, (x) => kindOf(x) === 'avatar');
  const b = (k: string) => {
    const v = variantOf(n, k);
    return v === undefined ? undefined : isTrue(v);
  };
  const out: { start?: JsxNode; end?: JsxNode } = {};
  const startAvatar = b('start-avatar') ?? false;
  const startIcon = b('start-icon') ?? false;
  const endIcon = b('end-icon') ?? false;
  const endAvatar = b('end-avatar') ?? false;
  const avatarEl = (a: IRNode | undefined) => {
    const isPhoto = a ? /photo/i.test(variantOf(a, 'Style', 'Type', 'Content') ?? '') : false;
    return el('Avatar', isPhoto ? [['defaultPhoto', yes]] : []);
  };
  const iconEl = (i: IRNode | undefined) => (i ? mapIcon(i, ctx) : ctx.fallback(n, 'decorator icon not found in the instance'));
  if (startAvatar) out.start = avatarEl(avatars[0]);
  else if (startIcon) out.start = iconEl(icons[0]);
  if (endIcon) out.end = iconEl(icons.length > (startIcon ? 1 : 0) ? icons[icons.length - 1] : undefined);
  else if (endAvatar) out.end = avatarEl(avatars[avatars.length - 1]);
  return out;
}

export function mapButton(n: IRNode, ctx: MapCtx): JsxNode {
  const name = (n.component ?? n.name).trim();
  const shapeRaw = (variantOf(n, 'Style', 'Appearance') ?? 'solid').toLowerCase();
  const shape = BUTTON_SHAPE[shapeRaw];
  if (!shape) return ctx.fallback(n, `button Style "${shapeRaw}" is not solid / outline / ghost`);
  const color = buttonColor(n, ctx);
  const variant = buttonVariant(color, shape);
  if (buttonVariantLosesColor(shape, color)) ctx.note(n, `ghost button drops the ${color} palette — the lib's ghost is colorless by design`);

  const mapped = applyVariantTable('Button', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [['variant', str(variant)]];
  /* Size: the variant wins, then the Component-Size mode, then the legacy
     name (Button-Small / Button-Large). */
  if (!variantOf(n, 'Size')) {
    let size: string = componentSize(n, ctx);
    if (!n.modes?.['Component-Size'] && ctx.mode(n, 'Component-Size') === undefined) {
      if (/-small\b/i.test(name)) size = 'small';
      else if (/-large\b/i.test(name)) size = 'large';
    }
    props.push(['size', str(size)]);
  }
  if (!variantOf(n, 'Elevation') && /-elevated$/i.test(name)) props.push(['elevated', yes]);
  props.push(...mapped.props);

  const type = (variantOf(n, 'Type') ?? 'text').toLowerCase();
  const children: JsxNode[] = [];
  if (type === 'icononly') {
    const icon = findAll(n, (x) => kindOf(x) === 'icon')[0];
    const glyph = icon ? iconGlyph(icon) : undefined;
    let label: string | undefined;
    if (isMeaningfulName(n.name, n.component)) label = n.name.trim();
    else if (glyph) {
      label = glyph.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
      ctx.derived(`"${label}" on Button — ${glyph} icon, from the glyph name`);
    }
    if (!label) return ctx.fallback(n, 'icon-only button: no accessible name derivable');
    props.push(['aria-label', str(label)]);
    children.push(icon ? mapIcon(icon, ctx) : ctx.fallback(n, 'icon-only button without an icon'));
  } else if (type === 'letternumber' || type === 'avatar') {
    /* The characters are CONTENT, not a name (rule 0d step 4) — only an
       authored layer name will do, and without one this needs a person. */
    if (!isMeaningfulName(n.name, n.component)) return ctx.fallback(n, `${type === 'avatar' ? 'avatar' : 'letterNumber'} button: accessible name not derivable from the design`);
    props.push(['aria-label', str(n.name.trim())]);
    if (type === 'letternumber') {
      const t = firstText(n);
      if (t) children.push(text(t.text!.content.trim()));
    } else {
      const a = findAll(n, (x) => kindOf(x) === 'avatar')[0];
      children.push(el('Avatar', a && /photo/i.test(variantOf(a, 'Style') ?? '') ? [['defaultPhoto', yes]] : []));
    }
  } else {
    const label = findAll(n, (x) => x.type === 'TEXT' && !!x.text?.content.trim()).find((t) => !isInside(n, t, (a) => kindOf(a) === 'icon'));
    if (!label) return ctx.fallback(n, 'text button without a label');
    children.push(text(label.text!.content.trim()));
    const d = decorators(n, ctx);
    if (d.start) props.push(['startDecorator', nodeProp(d.start)]);
    if (d.end) props.push(['endDecorator', nodeProp(d.end)]);
    if (n.sizing?.h === 'FILL') props.push(['fullWidth', yes]); // rule 4f-3b
  }
  /* rule 4f HEIGHT: never an inline width/height on a Button. */
  return el('Button', withStyle(stripDefaults('Button', props), ctx.layoutStyle(n, { box: false })), children);
}

function isInside(root: IRNode, target: IRNode, pred: (x: IRNode) => boolean): boolean {
  const path: IRNode[] = [];
  const find = (x: IRNode): boolean => {
    if (x === target) return true;
    path.push(x);
    for (const c of x.children ?? []) if (find(c)) return true;
    path.pop();
    return false;
  };
  find(root);
  return path.slice(1).some(pred);
}

// ── Checkbox (rule 4f-2) ────────────────────────────────────────────────────

export function mapCheckbox(n: IRNode, ctx: MapCtx, ariaLabel?: string): JsxNode {
  const mapped = applyVariantTable('Checkbox', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [['variant', str(buttonColor(n, ctx))]];
  if (!variantOf(n, 'Size')) props.push(['size', str(componentSize(n, ctx))]);
  props.push(...mapped.props);
  const label = firstText(n);
  if (label) props.push(['label', str(label.text!.content.trim())]);
  else if (ariaLabel) props.push(['aria-label', str(ariaLabel)]);
  return el('Checkbox', withStyle(stripDefaults('Checkbox', props), ctx.layoutStyle(n, { box: false })));
}

// ── Divider (rule 4f-3) ─────────────────────────────────────────────────────

export function mapDivider(n: IRNode, ctx: MapCtx): JsxNode {
  const mapped = applyVariantTable('Divider', n.props);
  for (const u of mapped.unmapped) {
    if (/^color=border$/i.test(u)) ctx.note(n, 'Divider Color=Border has no lib equivalent (the lib draws Border-Variant or a palette)');
    else ctx.note(n, `variant ${u} not mapped`);
  }
  /* Thickness follows the Component-Size MODE (parity note on Divider); the
     collection default is medium and the lib's is small, so it is written. */
  const size = ctx.mode(n, 'Component-Size', COMPONENT_SIZE_DEFAULT).toLowerCase();
  const props: Array<[string, PropValue]> = [...mapped.props];
  if (has(SIZES, size)) props.push(['size', str(size)]);
  return el('Divider', withStyle(stripDefaults('Divider', props), ctx.layoutStyle(n, { box: false })));
}

// ── Ratio (LIB_CATALOG Ratio entry, rule 4d thumbnail sizing, 4g) ───────────

export function ratioName(raw: string | undefined): (typeof RATIO_NAMES)[number] | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(/^golden[\s-]+/i, 'Golden-').replace(/^Golden-(\w)/, (_, c) => `Golden-${c.toUpperCase()}`);
  return has(RATIO_NAMES, s) ? s : undefined;
}

export function mapRatio(n: IRNode, ctx: MapCtx, slot: Slot): JsxNode {
  const raw = variantOf(n, 'Ratio', 'Property 1');
  const ratio = raw === undefined ? '1:1' : ratioName(raw);
  if (!ratio) return ctx.fallback(n, `ratio "${raw}" is not a lib RatioName`);
  const props: Array<[string, PropValue]> = [['ratio', str(ratio)]];
  const comp = n.component ?? '';
  const fillVar = variantOf(n, 'Fill');
  const vertical = /fill vertical/i.test(comp) || (!/fill horizontal/i.test(comp) && /^vertical$/i.test(fillVar ?? ''));
  /* In a list row the thumbnail gets an explicit square instead of a fit —
     ListItem has no definite height, so fit="height" collapses (rule 4d). */
  if (slot !== 'decorator') props.push(['fit', str(vertical ? 'height' : 'width')]);
  const imageFill = n.fills?.includes('image');
  /* "Content Slot" in older files; the live sets name it "Ratio Slot". */
  const content = (n.children ?? []).find((c) => /content slot|ratio slot/i.test(c.name));
  const placeholder = isTrue(variantOf(n, 'Image Placeholder')) || (imageFill && !content);
  if (placeholder) props.push(['placeholder', yes]);
  const children: JsxNode[] = [];
  if (content && !placeholder) {
    for (const c of content.children ?? []) {
      const k = ctx.compile(c, 'inline');
      if (k) children.push(k);
    }
  }
  const s: Array<[string, string | number]> = [];
  if (slot === 'decorator') {
    s.push(['width', n.box?.w ?? 48], ['height', n.box?.h ?? 48]);
  } else {
    s.push(...ctx.layoutStyle(n, { box: false }));
  }
  return el('Ratio', withStyle(stripDefaults('Ratio', props), s), children);
}

// ── Avatar (rule 4g, Icons & Avatars mode) ──────────────────────────────────

/** Avatar px → size name, as the lib's ladder draws them. */
export const AVATAR_PX_TO_SIZE: Record<number, (typeof AVATAR_SIZES)[number]> = { 16: 'xxs', 20: 'xs', 24: 'small', 32: 'medium', 40: 'large', 56: 'xl', 72: 'xxl' };
const ICON_AVATAR_CONTEXTS = ['in-check', 'in-button', 'button-decorator'];

export function avatarSize(n: IRNode, ctx: MapCtx): (typeof AVATAR_SIZES)[number] | undefined {
  const mode = ctx.mode(n, 'Icons & Avatars')?.trim().toLowerCase();
  if (mode && ICON_AVATAR_CONTEXTS.includes(mode)) return undefined; // the parent sizes it
  if (mode && has(AVATAR_SIZES, mode)) return mode;
  return n.box ? AVATAR_PX_TO_SIZE[n.box.w] : undefined;
}

export function mapAvatar(n: IRNode, ctx: MapCtx): JsxNode {
  const mapped = applyVariantTable('Avatar', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [...mapped.props];
  const styleV = (variantOf(n, 'Style', 'Type', 'Content') ?? '').toLowerCase();
  if (styleV === 'initials') {
    const t = firstText(n);
    if (!t) return ctx.fallback(n, 'initials avatar without initials');
    props.push(['initials', str(t.text!.content.trim())]);
  }
  const size = avatarSize(n, ctx);
  if (size) props.push(['size', str(size)]);
  else if (n.box && !ctx.mode(n, 'Icons & Avatars')) ctx.note(n, `avatar ${n.box.w}px is not on the size ladder — size left at the default`);
  const color = buttonColorFromMode(ctx.mode(n, 'Buttons'));
  if (color && color !== 'black-white') props.push(['color', str(color)]);
  return el('Avatar', withStyle(stripDefaults('Avatar', props), ctx.layoutStyle(n, { box: false })));
}

// ── Chip / Tag ──────────────────────────────────────────────────────────────

export function mapChip(n: IRNode, ctx: MapCtx): JsxNode {
  const mapped = applyVariantTable('Chip', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const label = findAll(n, (x) => x.type === 'TEXT' && !!x.text?.content.trim()).find((t) => !isInside(n, t, (a) => kindOf(a) === 'icon'));
  if (!label) return ctx.fallback(n, 'chip without a label');
  const color = buttonColor(n, ctx);
  if (color === 'black-white') ctx.note(n, 'Chip has no black-white palette — default used');
  const props: Array<[string, PropValue]> = [
    ['label', str(label.text!.content.trim())],
    ['variant', str(color === 'black-white' ? 'default' : color)],
    ...mapped.props,
  ];
  const d = decorators(n, ctx);
  if (d.start) props.push(['startDecorator', nodeProp(d.start)]);
  if (d.end) props.push(['endDecorator', nodeProp(d.end)]);
  if (isTrue(variantOf(n, 'Deletable'))) ctx.note(n, 'Deletable chip: onDelete needs a handler — not emitted');
  return el('Chip', withStyle(stripDefaults('Chip', props), ctx.layoutStyle(n, { box: false })));
}

export function mapTag(n: IRNode, ctx: MapCtx): JsxNode {
  const t = firstText(n);
  if (!t) return ctx.fallback(n, 'tag without a label');
  /* The live Tag set calls its palette axis Theme (Default · Primary … Error);
     older files called it Color. */
  const theme = buttonColorFromMode(variantOf(n, 'Theme'));
  const color = buttonColorFromMode(variantOf(n, 'Color')) ?? (theme === 'default' ? undefined : theme) ?? buttonColorFromMode(ctx.mode(n, 'Buttons'));
  const props: Array<[string, PropValue]> = [];
  if (color && color !== 'black-white') props.push(['color', str(color)]);
  if (/^fill$/i.test(variantOf(n, 'Fit') ?? '')) props.push(['width', str('fill')]);
  return el('Tag', withStyle(props, ctx.layoutStyle(n, { box: false })), [text(t.text!.content.trim())]);
}

// ── Card (rule 1a — only when the design says Card) ─────────────────────────

export function mapCard(n: IRNode, ctx: MapCtx): JsxNode {
  const mapped = applyVariantTable('Card', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [...mapped.props];
  const clickableState = variantOf(n, 'State');
  /* Drag is the live set's dragged state — `draggable`, from the table — not
     a click target. */
  if (clickableState && !/^(non-clickable|drag)$/i.test(clickableState)) props.push(['clickable', yes]);
  const ts = themeAndSurface(n.modes?.Theme, n.modes?.Surface);
  for (const p of ts.problems) ctx.note(n, p);
  if (ts.theme) props.push(['data-theme', str(ts.theme)]);
  if (ts.surface) props.push(['surface', str(ts.surface)]);
  const level = elevationFromMode(n.modes?.Elevation ?? n.modes?.Effects);
  if (level && !props.some(([k]) => k === 'elevated')) props.push(['elevated', yes]);
  if (level && level > 0) ctx.note(n, `Card elevation Level-${level} → elevated (Card has one shadow, not a level)`);
  const size = componentSize(n, ctx);
  props.push(['size', str(size)]);
  /* Collapse a lone content/slot frame — its children are the card's. */
  let kids = n.children ?? [];
  if (kids.length === 1 && /slot|content/i.test(kids[0].name)) kids = kids[0].children ?? [];
  /* The live Card nests its slots: Card Container > Card Content >
     [No Bleed Card Content, Padded Card Content]. The card's children are what
     those slots hold, in that order. */
  else if (kids.length === 1 && /^card container$/i.test(kids[0].name)) kids = cardSlotChildren(kids[0]);
  const children: JsxNode[] = [];
  for (const c of kids) {
    const k = ctx.compile(c, 'flow');
    if (k) children.push(k);
  }
  return el('Card', withStyle(stripDefaults('Card', props), ctx.layoutStyle(n, { box: true })), children);
}

/** The children of a live Card's slots, found under Card Container. */
function cardSlotChildren(container: IRNode): IRNode[] {
  const slots = findAll(container, (x) => /^(no bleed card content|padded card content)$/i.test(x.name));
  if (!slots.length) return container.children ?? [];
  return slots.flatMap((s) => s.children ?? []);
}

// ── List rows (rule 4d) ─────────────────────────────────────────────────────

/* Older files: Beginning Slot / Text / End Slot as direct children. The live
   List Item (2026-11): a Content frame holding Start Decorator / Text /
   End Decorator (slots), plus Divider instances for its borders. */
const START_SLOT = /^((beginning|start|left)[\s-]*slot|start decorator)$/i;
const END_SLOT = /^((end|right)[\s-]*slot|end decorator)$/i;
const TEXT_FRAME = /^text$/i;
const isRowPart = (c: IRNode) => START_SLOT.test(c.name) || END_SLOT.test(c.name) || TEXT_FRAME.test(c.name);

/** A row's slot and text frames — direct children, or the live set's Content frame's. */
function rowParts(n: IRNode): { parts: IRNode[]; border: IRNode[] } {
  const kids = n.children ?? [];
  if (kids.some(isRowPart)) return { parts: kids, border: [] };
  const content = kids.find((c) => /^content$/i.test(c.name) && (c.children ?? []).some(isRowPart));
  if (!content) return { parts: kids, border: [] };
  /* The border Dividers are the Bottom/Right Border booleans drawn — the
     table reads those, so the layers themselves are not content. */
  const border = kids.filter((c) => c !== content && /^divider$/i.test(c.name));
  const rest = kids.filter((c) => c !== content && !border.includes(c));
  return { parts: [...(content.children ?? []), ...rest], border };
}

/** True for an instance that IS a row: it has a start/text/end slot child. */
export function isListRow(n: IRNode): boolean {
  const kind = kindOf(n);
  if (kind !== 'listItem' && kind !== 'list') return false;
  return rowParts(n).parts.some(isRowPart);
}

/** Which ListItem prop a text layer feeds, from its type style. */
function rowTextRole(t: IRNode): 'eyebrow' | 'title' | 'secondary' | undefined {
  const style = variantOf(t, 'type', 'style', 'property 1') ?? firstText(t)?.text?.style ?? t.name;
  const s = normalizeStyleName(style ?? '');
  if (/^(overline|eyebrow)/.test(s)) return 'eyebrow';
  if (/^subtitle/.test(s)) return 'title';
  if (/^body/.test(s)) return 'secondary';
  return undefined;
}

export function mapListItem(n: IRNode, ctx: MapCtx): JsxNode {
  const mapped = applyVariantTable('ListItem', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  const props: Array<[string, PropValue]> = [];
  const { parts } = rowParts(n);
  const start = parts.find((c) => START_SLOT.test(c.name));
  const end = parts.find((c) => END_SLOT.test(c.name));
  const textFrame = parts.find((c) => TEXT_FRAME.test(c.name));
  const other = parts.filter((c) => c !== start && c !== end && c !== textFrame);
  for (const o of other) ctx.note(o, `row layer "${o.name}" is not a slot or the text frame — not emitted`);

  /* Per-row algorithm (rule 4d): only THIS row's rendered text decides its
     props. Hidden layers were pruned in the IR, so what is here is shown. */
  const roles: Record<'eyebrow' | 'title' | 'secondary', string | undefined> = { eyebrow: undefined, title: undefined, secondary: undefined };
  const order: Array<'eyebrow' | 'title' | 'secondary'> = ['eyebrow', 'title', 'secondary'];
  const texts = (textFrame?.children ?? []).filter((c) => firstText(c));
  /* A visible text layer with no characters is missing data, not an empty
     line — say so rather than drop it (rule 4d: NEVER invent text). */
  const missing: JsxNode[] = (textFrame?.children ?? []).filter((c) => !firstText(c))
    .map((c) => ctx.fallback(c, 'row text layer has no characters'));
  let ordinal = 0;
  for (const t of texts) {
    const content = firstText(t)!.text!.content.trim();
    let role = rowTextRole(t);
    if (!role || roles[role] !== undefined) {
      while (ordinal < order.length && roles[order[ordinal]] !== undefined) ordinal++;
      role = order[ordinal];
      if (role) ctx.note(t, `row text "${t.name}" placed as ${role} by position — its style does not say`);
    }
    if (!role) { ctx.note(t, 'a fourth text line in a list row — not emitted'); continue; }
    roles[role] = content;
  }
  const decorator = (slot: IRNode | undefined, which: 'start' | 'end') => {
    if (!slot) return undefined;
    const kids = slot.children ?? [];
    if (!kids.length) return undefined;
    if (kids.length > 1) return ctx.fallback(slot, `${which} slot holds ${kids.length} layers — a decorator is one`);
    const k = kids[0];
    if (kindOf(k) === 'checkbox') {
      const name = roles.title ?? roles.eyebrow;
      if (name) {
        ctx.derived(`"Select ${name}" on Checkbox — list-row checkbox, from the row's own text`);
        return mapCheckbox(k, ctx, `Select ${name}`);
      }
    }
    return ctx.compile(k, 'decorator') ?? undefined;
  };
  const s = decorator(start, 'start');
  const e = decorator(end, 'end');
  if (s) props.push(['startDecorator', nodeProp(s)]);
  if (e) props.push(['endDecorator', nodeProp(e)]);
  if (roles.eyebrow) props.push(['eyebrow', str(roles.eyebrow)]);
  if (roles.secondary) props.push(['secondary', str(roles.secondary)]);
  if (!variantOf(n, 'Size')) props.push(['size', str(componentSize(n, ctx))]);
  props.push(...mapped.props);
  /* The live set has no Type axis: an interaction State (anything but
     Non-clickable) is what says the row is clickable. */
  const rowState = variantOf(n, 'State');
  if (variantOf(n, 'Type') === undefined && rowState && !/^non-clickable$/i.test(rowState) && !props.some(([k]) => k === 'clickable')) {
    props.push(['clickable', yes]);
  }
  /* rule 4d ROW SIZE — a FIXED row carries its height to the pixel. */
  const rowStyle: Array<[string, string | number]> = [];
  if (n.sizing?.v === 'FIXED' && n.box) rowStyle.push(['height', n.box.h]);
  if (n.sizing?.h === 'FIXED' && n.box) rowStyle.push(['width', n.box.w]);
  return el('ListItem', withStyle(stripDefaults('ListItem', props), rowStyle), [...(roles.title ? [text(roles.title)] : []), ...missing]);
}

export function listProps(n: IRNode | undefined, ctx: MapCtx): Array<[string, PropValue]> {
  if (!n) return [];
  const mapped = applyVariantTable('List', n.props);
  for (const u of mapped.unmapped) ctx.note(n, `variant ${u} not mapped`);
  return stripDefaults('List', mapped.props);
}

export { withStyle };
export type { JsxElement };
