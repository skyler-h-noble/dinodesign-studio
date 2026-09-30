// figmaModeMapping.ts — the three Figma MODE collections, and what each one
// means as a lib prop.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// The lib takes `size` and `color` as PROPS. Figma expresses neither as a
// variant axis — it expresses them as MODES on a collection, selected by
// pinning rather than by choosing a variant. Sampled across the whole file,
// the only components carrying a `Size` variant are Divider, Progress Bar and
// Progress Dial, and all three have a single option.
//
// So a converter that reads only `componentProperties` learns nothing about
// size or colour, emits every component at the default, and is silently wrong
// on every screen that pinned a mode. Nothing reports it, because the design
// looks right in Figma and the code compiles.
//
// ── How a mode is actually selected ─────────────────────────────────────────
//
// NOT on the instance. On an ANCESTOR. Sampling the Buttons page, 47 nodes pin
// a mode and the pins sit on boards and wrappers:
//
//   Buttons  [FRAME]     Component-Size: small      ← a board showing one row
//   Header   [FRAME]     Theme: Primary
//   Avatar   [INSTANCE]  Icons & Avatars: button-decorator
//
// So resolution is: walk from the node up through its parents, take the first
// ancestor with an `explicitVariableModes` entry for that collection, and fall
// back to the collection's default mode if none does. `resolveMode` below is
// that walk, written once so three call sites cannot disagree about it.

/** A minimal shape so this module does not depend on the plugin typings. */
export interface ModeNode {
  explicitVariableModes?: Record<string, string>;
  parent?: ModeNode | null;
}

/**
 * The nearest ancestor's mode for one collection, or the default.
 *
 * `collectionId` and `modeNames` come from the file; they are passed in rather
 * than hardcoded because a collection's id changes per file and the converter
 * may run against a copy.
 */
export function resolveMode(
  node: ModeNode | null | undefined,
  collectionId: string,
  modeNames: Record<string, string>,
  defaultModeName: string,
): string {
  let n: ModeNode | null | undefined = node;
  while (n) {
    const pinned = n.explicitVariableModes?.[collectionId];
    if (pinned && modeNames[pinned]) return modeNames[pinned];
    n = n.parent;
  }
  return defaultModeName;
}

// ── 1. Component-Size → the `size` prop ─────────────────────────────────────
//
// The cleanest of the three: three modes, three prop values, same words.
//
// `medium` is the collection default, which matters — a component on a board
// that pins nothing renders medium, so the converter must emit `size="medium"`
// rather than omitting the prop, unless the lib's own default is also medium.
// Most are; Avatar's is `x-small`, so that one needs the prop written out.

export const COMPONENT_SIZE_TO_PROP: Record<string, 'small' | 'medium' | 'large'> = {
  small: 'small',
  medium: 'medium',
  large: 'large',
};

export const COMPONENT_SIZE_DEFAULT = 'medium';

// ── 2. Buttons → the `variant` string ───────────────────────────────────────
//
// TWO Figma axes compose into ONE lib string:
//
//   colour  the Buttons MODE      default · primary · … · black-white
//   shape   the `Style` VARIANT   solid · outline · ghost
//
//   variant="primary"           = mode primary  + Style solid
//   variant="primary-outline"   = mode primary  + Style outline
//   variant="ghost"             = Style ghost   + colour DISCARDED
//
// That last line is a real capability gap, not a naming one. Figma can draw a
// ghost button in any of the ten palettes, because the mode drives
// Buttons::Text, ::Hover and ::Pressed. The lib's ghost takes no colour at all
// — `ghostStyles(isTextContent, selected)` in Button.js has no colour
// parameter, and a text ghost reads --Hotlink while an icon ghost reads
// something else. So ten Figma combinations collapse to one lib variant and
// the palette is lost in translation.
//
// SETTLED 2026-09-28: ghost stays colourless, and Figma drops its fill effects.
//
// The question arrived as "ghost needs colour to get the drop shadows to work",
// which was half right. Figma's ghost variants carried four DROP_SHADOWs AND an
// inner bevel, while the lib gives ghost `boxShadow: 'none'` at rest, hover and
// active. A bevel's GEOMETRY comes from Component-Size (Button-Highlight-Offset-x)
// but its COLOUR comes from Buttons::Highlight — per mode — so a colourless
// ghost genuinely could not have drawn one.
//
// The premise was the thing to question. A bevel is a lighting effect on a
// SURFACE, and a ghost's fill is transparent — it was lighting a surface that
// is not drawn, which is the signature of a variant duplicated from solid with
// the effects left on. And elevation says "this floats", which is the opposite
// of what the lowest-emphasis control in the set should say.
//
// So the fill effects come off in Figma, and the lib is unchanged. The colour
// is still DISCARDED here, because Figma can render a ghost in any of the ten
// modes and the lib's ghost reads --Hotlink for text and --Quiet for icons by
// design. That loss is real but small, and `buttonVariantLosesColour` reports
// it so a converted line can carry a note rather than lose it silently.
//
// Do NOT "fix" it by inventing `{color}-ghost`. The tokens exist
// (--Buttons-Primary-Text and friends), so it is not a token problem — it is a
// decision that ghost should read like a link rather than like a palette, and
// that decision is recorded in Button.js beside the style itself.

export type ButtonShape = 'solid' | 'outline' | 'ghost';

export function buttonVariant(colourMode: string, shape: ButtonShape): string {
  if (shape === 'ghost') {
    /* Colour discarded — see above. The caller should emit a note beside the
       line so a reviewer can see the design asked for a palette the component
       cannot express. */
    return 'ghost';
  }
  const colour = colourMode === 'black-white' ? 'black-white' : colourMode;
  return shape === 'outline' ? `${colour}-outline` : colour;
}

/** True when the mapping drops information the design carried. */
export function buttonVariantLosesColour(shape: ButtonShape, colourMode: string): boolean {
  return shape === 'ghost' && colourMode !== 'default';
}

// ── 3. Menu-Levels → nesting depth ──────────────────────────────────────────
//
// Seven modes, ONE variable: `Left-Margin`. It is the indent of a menu row at
// depth N, and it is the only thing the collection carries.
//
//   level-0   8      level-1  36      level-2  64      level-3   92
//   level-4 120      level-5 148      level-6 176
//
// A REGULAR LADDER: base 8, step 28, verified against the file 2026-09-28.
//
// It did not start that way. The authored values were 8 · 36 · 48 · 72 · 88 ·
// 112 · 128 — steps of 28, 12, 24, 16, 24, 16, with no constant indent and no
// ratio that produced them. The even rungs alone were clean (8 · 48 · 88 · 128,
// step 40) while the odd ones sat 8px above where a 20-per-level rule would put
// them. That is the signature of a hand-typed ladder, and this file said so.
//
// The fix kept level-0 and level-1 and took the step from that first rung —
// 36 - 8 = 28 — rather than fitting a step to the old endpoints. Worth knowing,
// because a 20-step ladder from 8 also looks defensible on paper: it reproduces
// 8 · 48 · 88 · 128, every clean rung of the old table. It is the wrong answer
// anyway. The rungs it reproduces were themselves hand-typed, so matching them
// is matching the arbitrary part; and at seven levels a 20-step ladder ends at
// 128 where the component's own 360px hug needs 176. Agreeing with the old
// numbers is not evidence when the old numbers are what was being replaced.
//
// The lib has no `level` prop — nesting is structural there, so depth comes
// from how deep the element sits. So the mapping is: depth in the DOM, and the
// indent follows from the token rather than from a prop the converter writes.

/** The rule the ladder now follows. */
export const MENU_LEVEL_BASE = 8;
export const MENU_LEVEL_STEP = 28;

/**
 * The authored values, as the Figma collection holds them.
 *
 * Written out rather than generated from the rule above, even though the two
 * agree exactly. Figma is the authority for what a menu row is indented by;
 * the rule is a description of what Figma currently holds. Generating the
 * table from the rule would make them agree by construction, which is the one
 * thing that cannot then be checked — and "does it still follow the rule" is
 * the question worth being able to ask, because last time the answer was no.
 */
export const MENU_LEVEL_LEFT_MARGIN: Record<string, number> = {
  'level-0': 8,
  'level-1': 36,
  'level-2': 64,
  'level-3': 92,
  'level-4': 120,
  'level-5': 148,
  'level-6': 176,
};

/** The indent a regular ladder gives at this depth. */
export function menuLevelIfRegular(
  level: number,
  base = MENU_LEVEL_BASE,
  step = MENU_LEVEL_STEP,
): number {
  return base + level * step;
}

/**
 * Levels whose authored value does not match the rule.
 *
 * Empty today, and that is the point: it was six entries long, and it is what
 * tells you if the ladder is hand-edited back out of shape. Keep it rather
 * than deleting it now that it returns nothing.
 */
export function irregularMenuLevels(
  base = MENU_LEVEL_BASE,
  step = MENU_LEVEL_STEP,
): string[] {
  return Object.entries(MENU_LEVEL_LEFT_MARGIN)
    .filter(([name, value]) => {
      const n = Number(name.replace('level-', ''));
      return value !== menuLevelIfRegular(n, base, step);
    })
    .map(([name]) => name);
}

// ── 4. Icons & Avatars → the `size` prop, and a two-step NAME OFFSET ────────
//
// Ten modes that are two different kinds of thing in one axis:
//
//   SIZES     xxs · xs · small · medium · large · xl · xxl
//   CONTEXTS  in-check · in-button · button-decorator
//
// One axis is defensible because they are mutually exclusive — an icon is
// either at a named size or sized by the thing containing it. But the two
// halves emit differently: a size becomes a `size` prop, a context means DO
// NOT emit one, because the parent component owns it (Button's
// DECORATOR_SIZE_MAP, Checkbox's box). The context values are aliases in the
// file for the same reason.
//
// ── THE NAMES ARE OFFSET BY TWO STEPS ───────────────────────────────────────
//
//   Figma  xxs 16 · xs 20 · small 24 · medium 32 · large 40 · xl  56 · xxl 72
//   Lib                     xx-small 24 · x-small 32 · small 40 · medium 56 …
//
// The pixel values line up; the NAMES do not. Figma's `small` is the lib's
// `xx-small`, Figma's `medium` is the lib's `x-small`, and so on. Confirmed
// twice over, because the initials ramp offsets identically: Figma small -> 14
// is lib xx-small -> 14, Figma xl -> 28 is lib medium -> 28.
//
// So a designer picking "medium" gets 32px and a developer writing
// size="medium" gets 56px. Nothing errors. This is the single most dangerous
// mapping in the file, because both sides use the same vocabulary for
// different rungs — a converter that passes the mode name straight through as
// the prop is wrong on every icon and avatar while looking correct in review.
//
// The two ends do not survive the offset at all: Figma's xxs (16) and xs (20)
// have no lib size, and the lib's large (64), x-large (80) and xx-large (160)
// have no Figma mode. Figma's xxl is 72, which is neither 64 nor 80.

export const ICON_AVATAR_PX: Record<string, number> = {
  xxs: 16, xs: 20, small: 24, medium: 32, large: 40, xl: 56, xxl: 72,
};

/** Figma mode -> the lib size prop with the SAME pixel value, or null. */
export const ICON_AVATAR_MODE_TO_LIB_SIZE: Record<string, string | null> = {
  xxs: null,            // 16 — the lib has no 16px standalone size
  xs: null,             // 20 — nor a 20
  small: 'xx-small',    // 24
  medium: 'x-small',    // 32
  large: 'small',       // 40
  xl: 'medium',         // 56
  xxl: null,            // 72 — the lib jumps 64 -> 80
};

export const ICON_AVATAR_CONTEXTS = ['in-check', 'in-button', 'button-decorator'] as const;

export function isIconAvatarContext(mode: string): boolean {
  return (ICON_AVATAR_CONTEXTS as readonly string[]).includes(mode);
}

/**
 * What to emit for an icon or avatar at this mode.
 *
 * `null` means emit NO size prop: either the parent sizes it (a context), or
 * the mode has no lib equivalent and a `customSize` in pixels is the only
 * honest translation.
 */
export function iconAvatarSize(mode: string): { prop: string | null; px: number | null; reason: string } {
  if (isIconAvatarContext(mode)) {
    return { prop: null, px: null, reason: 'context — the parent component sizes it' };
  }
  const prop = ICON_AVATAR_MODE_TO_LIB_SIZE[mode] ?? null;
  const px = ICON_AVATAR_PX[mode] ?? null;
  if (prop) return { prop, px, reason: 'name offset by two steps — see the table above' };
  return { prop: null, px, reason: 'no lib size at this value; pass customSize' };
}

// ── 5, 6, 7. Devices-Type · Device-Sizes · Typography → AMBIENT, not props ──
//
// The remaining three collections map to NOTHING the converter writes on a
// component, and saying so is the mapping:
//
//   Devices-Type   7 modes   Desktop · IOS/Android Tablet V+H · IOS/Android Mobile
//   Device-Sizes   5 modes   Default · Common · Wide · Narrow · Rare
//   Typography     2 modes   Omni · System
//
// All three are ENVIRONMENT. The consumer sets them once at the root — the
// platform via `data-platform`, the face via which stylesheet is loaded — and
// every token underneath resolves against them. There is no per-component prop
// because there is no per-component choice: two buttons on one screen cannot
// be on different platforms.
//
// The converter must therefore NOT try to express them. A `platform="IOS"` or
// `typography="System"` prop on a component would be inventing an API, and
// would let two components on one screen disagree about something that is a
// property of the device.
//
// What it SHOULD do is read them to resolve VALUES — the same walk as every
// other mode. A component on a board pinned to IOS-Mobile has 44px buttons,
// and the converter needs that number even though it writes no prop for it.
//
// Device-Sizes is the subtler one: its five modes are viewport CLASSES, not
// devices, and Devices-Type aliases into it (Desktop -> Default, IOS-Mobile ->
// Narrow, Android-Mobile -> Rare). So resolving a Device-Sizes value means
// resolving the Devices-Type mode first and following the alias. Reading
// Device-Sizes directly gets the DEFAULT class and is silently wrong on six of
// the seven devices.

export const AMBIENT_COLLECTIONS = ['Devices-Type', 'Device-Sizes', 'Typography'] as const;

export function isAmbientCollection(name: string): boolean {
  return (AMBIENT_COLLECTIONS as readonly string[]).includes(name);
}

/** Devices-Type mode -> the Device-Sizes class it aliases into. */
export const DEVICE_TO_SIZE_CLASS: Record<string, string> = {
  'Desktop': 'Default',
  'IOS-Tablet-Vertical': 'Common',
  'IOS-Tablet-Horizontal': 'Wide',
  'Android-Tablet-Vertical': 'Common',
  'Android-Tablet-Horizontal': 'Wide',
  'IOS-Mobile': 'Narrow',
  'Android-Mobile': 'Rare',
};

// ── 8. Alt-Display → ambient, and the one collection that is a TREATMENT ────
//
// Three modes, two variables, both colour stops for the Alt-Display face:
//
//   Default    Color-Stop-1 = Surface::Header
//              Color-Stop-2 = Surface::Header                 (one flat colour)
//   Colored    Color-Stop-1 = Theme::Surface/Alt-Display-Color
//              Color-Stop-2 = Surface::Alt-Display-Color      (two tones)
//   Gradient   Color-Stop-1 = Surface::Alt-Color-Gradient-Stop-1
//              Color-Stop-2 = Surface::Alt-Color-Gradient-Stop-2
//
// It is ambient like Typography and Devices-Type — a brand picks one treatment
// for its display face, not one per heading — so the converter writes no prop
// for it. But it differs from the other ambient collections in an important
// way, and that is why it gets its own note rather than a row in the list.
//
// The other three ambient collections select a MEASUREMENT: a platform's
// button height, a viewport's margin, a face's letter-spacing. Alt-Display
// selects a RENDERING STRATEGY. Default paints one flat colour; Colored paints
// two tones; Gradient paints a gradient between two stops. Those are not three
// values of one property — they are three different paint constructions, and a
// consumer cannot express "Gradient" by reading a colour token, because a
// gradient is not a colour.
//
// Consequence for the converter: reading Color-Stop-1 alone produces a flat
// fill on every mode, and Gradient silently renders as its first stop. The
// mode has to be read to know WHICH construction to emit, then the stops read
// to fill it — two steps, unlike every other collection here.
//
// Both stops resolving to the SAME variable in Default is the tell that this is
// a strategy and not a ramp. A ramp with identical ends would be redundant
// (invariant 2); a one-colour strategy expressed through a two-stop interface
// is not, because the interface has to serve all three modes.

export const ALT_DISPLAY_MODES = ['Default', 'Colored', 'Gradient'] as const;
export type AltDisplayMode = (typeof ALT_DISPLAY_MODES)[number];

/** How a mode paints — the thing a colour lookup alone cannot tell you. */
export const ALT_DISPLAY_PAINT: Record<AltDisplayMode, 'flat' | 'two-tone' | 'gradient'> = {
  Default: 'flat',
  Colored: 'two-tone',
  Gradient: 'gradient',
};

/** True when both stops are one colour, so a single fill is faithful. */
export function altDisplayIsFlat(mode: AltDisplayMode): boolean {
  return ALT_DISPLAY_PAINT[mode] === 'flat';
}

// ── The whole picture ───────────────────────────────────────────────────────
//
//   COLLECTION         MODES  →  WHAT THE CONVERTER DOES
//   Component-Size       3       size prop, 1:1, emit even at the default
//   Buttons             10       colour half of the `variant` string
//   Icons & Avatars     10       size prop, NAMES OFFSET TWO STEPS (now fixed
//                                in the lib), plus 3 context modes that mean
//                                emit no size at all
//   Menu-Levels          7       nothing — nesting is structural; the indent
//                                follows from the token
//   Devices-Type         7       nothing — ambient; read to resolve values
//   Device-Sizes         5       nothing — ambient; resolve the Devices-Type
//                                mode FIRST and follow its alias
//   Typography           2       nothing — ambient; the face choice
//   Alt-Display          3       nothing — ambient, but pick a PAINT STRATEGY
//
// Three of eight become props. Five are environment. A converter that treats
// all eight alike will either invent props for the environment or drop the
// three that matter — and the Icons & Avatars row is the one that fails
// silently, because both sides speak the same words for different rungs.

export const COLLECTIONS_THAT_BECOME_PROPS = ['Component-Size', 'Buttons', 'Icons & Avatars'] as const;
