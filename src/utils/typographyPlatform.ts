/**
 * Typography by device type, switchable between the brand's faces and the
 * platform's own.
 *
 * ── The shape ─────────────────────────────────────────────────────────────
 *
 *   Devices-Type
 *     <Device>/Typography/Omni/<Style>-<Prop>     the brand's faces
 *     <Device>/Typography/System/<Style>-<Prop>   the platform's faces
 *
 *   Typography            modes: Omni | System
 *     <Style>-<Prop>  ->  an ALIAS to one of the two above
 *
 * Every Figma text style binds to the Typography collection and nothing else,
 * so flipping that collection's mode switches the whole system in one gesture.
 * A style never knows which face it is wearing.
 *
 * This is the pattern Icons & Avatars already uses: `Icon-Size` has modes
 * `in-check` and `in-button`, each aliasing to a different Component-Size
 * variable, and the SIZE ramp is inherited through the pointer rather than
 * restated. Same trick, one axis up.
 *
 * ── What switches, and what does not ──────────────────────────────────────
 *
 * Font-SIZE is deliberately absent. The size ramp is a DEVICE decision — 28px
 * at H1 on a phone — and it does not change because the face changed. Keeping
 * it out means flipping Omni/System never reflows a layout: line boxes keep
 * their heights, columns keep their measure, and the only thing that moves is
 * the shape of the glyphs.
 *
 * It also halves the table. Size lives once, per device, where it already is.
 *
 * What DOES switch is everything the face owns:
 *
 *   Font-Family      the face itself
 *   Font-Weight      SF Pro's 600 is not Roboto's 600 is not a brand face's
 *   Line-Height      different faces have different metrics at one size
 *   Letter-Spacing   a face tuned for UI needs different tracking
 */

/** Device types, in the order they appear in the file. */
export const DEVICE_TYPES = [
  'Desktop',
  'IOS-Mobile',
  'Android-Mobile',
  'IOS-Tablet-Vertical',
  'IOS-Tablet-Horizontal',
  'Android-Tablet-Vertical',
  'Android-Tablet-Horizontal',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** The two faces a device can be wearing. */
export const FACE_MODES = ['Omni', 'System'] as const;
export type FaceMode = (typeof FACE_MODES)[number];

/**
 * Which existing platform block each device seeds from.
 *
 * typography-tokens.css ships four blocks; this is seven device types. The map
 * says where each one's starting numbers come from rather than inventing them,
 * so nothing in the ramp changes on the day this lands — the structure moves,
 * the values do not.
 *
 * The two tablet orientations seed from the SAME block, which makes the
 * duplication explicit. If a rotation never changes a type value, those pairs
 * stay equal for good and the orientation split is carrying nothing for
 * typography (it still earns its keep in Device-Sizes, where layout lives).
 */
export const SEEDS_FROM: Record<DeviceType, string> = {
  'Desktop': 'Desktop',
  'IOS-Mobile': 'IOS-Mobile',
  'Android-Mobile': 'Android',
  'IOS-Tablet-Vertical': 'IOS-Tablet',
  'IOS-Tablet-Horizontal': 'IOS-Tablet',
  'Android-Tablet-Vertical': 'Android',
  'Android-Tablet-Horizontal': 'Android',
};

/**
 * The platform's own face, per device.
 *
 * Desktop has no single answer — "the system font" is Segoe on Windows, SF on
 * macOS, whatever the distro picked on Linux — so it gets the stack and the OS
 * resolves it. The mobile platforms have exactly one answer each.
 */
export const SYSTEM_FACE: Record<DeviceType, string> = {
  'Desktop': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  'IOS-Mobile': '"SF Pro"',
  'Android-Mobile': 'Roboto',
  'IOS-Tablet-Vertical': '"SF Pro"',
  'IOS-Tablet-Horizontal': '"SF Pro"',
  'Android-Tablet-Vertical': 'Roboto',
  'Android-Tablet-Horizontal': 'Roboto',
};

/**
 * The properties that switch with the face.
 *
 * Family, weight and tracking. A face has its own colour and its own natural
 * weight at a given size, and tracking is tuned per face.
 */
export const SWITCHED_PROPS = [
  'Font-Weight',
  'Letter-Spacing',
] as const;

/**
 * The properties that stay with the DEVICE, identical across both faces.
 *
 * Size and line-height together are the vertical rhythm, and holding them
 * fixed is what makes the switch safe: toggling Omni / System reshapes the
 * glyphs and moves nothing. Every line box keeps its height, every baseline
 * stays on the grid, and no screen reflows vertically.
 *
 * The sizes on the mobile devices are the PLATFORM's — Apple's and Material's
 * own ramps — not the brand's, and both faces sit on them. Desktop's come from
 * the user's chosen scale, because Desktop is the brand's own surface.
 *
 * Letter-spacing is the one switched property that does affect layout, and it
 * only affects it horizontally: a line gets wider or narrower, it does not
 * move down the page. That is a deliberate line — horizontal give is absorbed
 * by wrapping, vertical give breaks a grid.
 */
export const DEVICE_PROPS = ['Font-Size', 'Line-Height'] as const;

/* ── The device axis has to be MODES, not groups ───────────────────────────
 *
 * This is the constraint the whole structure turns on, and it is easy to get
 * backwards: "a Typography group under each Device Type" is the natural way to
 * say it in English, and it does not work.
 *
 * A Figma collection has ONE mode axis. Typography spends its axis on
 * Omni | System. So `Typography/H1-Font-Weight` is a single variable with two
 * values, and each value is one alias — it can point at exactly one target.
 * If the seven devices were GROUPS, there would be seven candidate targets and
 * no way to choose between them, because the collection has no axis left to
 * choose with.
 *
 * With the devices as MODES of Devices-Type, the alias points at one name and
 * the DEVICE resolves underneath it, exactly the way Icons & Avatars works:
 * `Icon-Size` spends its axis on in-check | in-button and aliases into
 * Component-Size, whose own axis supplies small | medium | large. Two
 * collections, two axes, composed through the pointer.
 *
 * The device therefore does NOT appear in these names. It is a column, not a
 * path segment. That also collapses the size of this: one variable per
 * style-property per face (~220) rather than one per device as well (~1,540).
 */
const GROUPED = (...parts: string[]) => parts.join('/');

/** Where the face values live in Devices-Type. The device is a MODE. */
export function sourceName(face: FaceMode, token: string): string {
  return GROUPED('Typography', face, token);
}

/** The alias string the Typography collection stores, pointing at that source. */
export function aliasTo(face: FaceMode, token: string): string {
  return `{Devices-Type.${sourceName(face, token).replace(/\//g, '.')}}`;
}

/* ── The CSS side ─────────────────────────────────────────────────────────
 *
 * Two attributes, mirroring the two Figma collections:
 *
 *   data-device="IOS-Mobile"    which device type   (Devices-Type)
 *   data-fonts="Omni"|"System"  which face          (Typography, its 2 modes)
 *
 * ── Why data-platform does not simply go away ─────────────────────────────
 *
 * A design system's CSS is FROZEN per system in Storage and cannot be
 * regenerated. A page written against an older system sets data-platform and
 * always will. Emitting only data-device would mean that page silently gets no
 * platform block at all — no error, no fallback, just Desktop's values (or
 * none) on a phone.
 *
 * This is the same call the Eyebrow rename made, and it was made the same way:
 * --Overline-* is still emitted, forever, as an alias. The old name keeps
 * resolving; the new name is the one to write.
 *
 * So every block is emitted under BOTH attributes. A selector list costs one
 * comma and nothing at runtime. data-device is the name to use; data-platform
 * keeps working and is not documented for new work.
 *
 * ── The value names moved too ─────────────────────────────────────────────
 *
 * `Android` became `Android-Mobile`, and the tablets split by orientation. An
 * old page says data-platform="Android" and means the phone, so that spelling
 * has to keep resolving to Android-Mobile rather than matching nothing.
 */
export const LEGACY_DEVICE_ALIAS: Record<string, DeviceType> = {
  'Android': 'Android-Mobile',
  'IOS-Tablet': 'IOS-Tablet-Vertical',
};

/**
 * The selector for one device's block: the new attribute, the old one, and any
 * legacy spelling that used to mean this device.
 */
export function deviceSelector(device: DeviceType, extra = ''): string {
  const names = [device, ...Object.entries(LEGACY_DEVICE_ALIAS)
    .filter(([, to]) => to === device).map(([from]) => from)];
  return names
    .flatMap((n) => [`[data-device="${n}"]`, `[data-platform="${n}"]`])
    .map((sel) => sel + extra)
    .join(',\n');
}

/**
 * The face selector, appended to a device selector.
 *
 * Omni is the DEFAULT and carries no attribute at all: a page that never sets
 * data-typography gets the brand's faces, which is the right thing to happen
 * when someone forgets. System is opt-in.
 *
 * That also fixes the cascade rather than relying on it. What ships today is
 *
 *     [data-platform="X"][data-fonts]           -> the brand faces
 *     [data-platform="X"][data-fonts="Default"] -> the system faces
 *
 * and a BARE attribute selector matches any value, "Default" included. Both
 * rules have identical specificity, so which one wins is decided purely by
 * SOURCE ORDER — it works now only because the Default blocks happen to sit
 * later in the file. One reordering and every brand silently renders in the
 * system face, with nothing to see in a diff.
 *
 * Here System carries one more attribute than Omni, so it wins on specificity
 * and the order of the file stops mattering.
 *
 * "Default" stays as a second spelling of System, and data-fonts as a second
 * spelling of the attribute, for the frozen-CSS reason above: pages already
 * set them and cannot be regenerated.
 */
export function faceSelector(face: FaceMode): string {
  if (face === 'Omni') return '';
  return '[data-typography="System"]';
}

/** The spellings of "system faces" that a frozen page might already carry. */
export const LEGACY_SYSTEM_SELECTORS = [
  '[data-typography="System"]',
  '[data-fonts="System"]',
  '[data-fonts="Default"]',
];

/**
 * Every selector for one device + face pair.
 *
 * Omni is one selector per device spelling. System multiplies by the legacy
 * face attributes, which is a handful of extra selectors in a file that
 * already runs to hundreds — cheap insurance against a page that cannot be
 * regenerated.
 */
export function blockSelector(device: DeviceType, face: FaceMode): string {
  if (face === 'Omni') return deviceSelector(device);
  return LEGACY_SYSTEM_SELECTORS
    .map((f) => deviceSelector(device, f))
    .join(',\n');
}

/* ── Values ───────────────────────────────────────────────────────────────
 *
 * Parsed out of the GENERATED stylesheet rather than computed again here.
 *
 * That direction is deliberate. Invariant 5 is that the preview and the export
 * are separate implementations and drift silently, and this file would have
 * been a third. Deriving the Figma payload FROM the CSS means the two cannot
 * disagree about a number — not "are kept in sync", but cannot disagree, since
 * there is only one computation and Figma reads its output.
 *
 * It also picks up the live Desktop ramp for free: buildTypographyTokensCSS
 * splices the user's chosen scale into the Desktop block, so parsing the
 * result gives the brand's real Desktop values and the static mobile ones in
 * a single pass.
 */

import { SYSTEM_FAMILY_OF, systemTracking, systemWeight } from './systemTypography';
import type { FamilyRole, ResolvedRoles } from './typeScale';

export interface TypeValue { value: string | number; type: string }
export type VarBag = Record<string, TypeValue>;

/** One style's properties, keyed by the property suffix. */
type StyleProps = Record<string, string>;

/**
 * What a `var(--X)` resolves to inside its own block.
 *
 * Does what the browser does and nothing more: follow the name, and on a miss
 * take the fallback. A reference that leads nowhere is returned unchanged — the
 * caller's parseFloat then drops it, which is the honest outcome for a value
 * this file genuinely cannot know (`--Set-Font-Family-Header` is the
 * consumer's to define, not ours).
 *
 * Depth-bounded because a cycle in the stylesheet would otherwise hang the
 * export rather than produce a wrong number.
 */
export function resolveVar(value: string, declared: Record<string, string>, depth = 0): string {
  const v = String(value).trim();
  if (depth > 8 || !v.startsWith('var(')) return v;
  const m = v.match(/^var\(\s*--([\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!m) return v;
  const [, name, fallback] = m;
  if (declared[name] !== undefined) return resolveVar(declared[name], declared, depth + 1);
  if (fallback !== undefined) return resolveVar(fallback, declared, depth + 1);
  return v;
}

/** Parse one `[data-platform="X"] { … }` block into style -> prop -> value. */
export function parsePlatformBlock(css: string, platform: string):
  { styles: Record<string, StyleProps>; families: Record<string, string> } {
  const re = new RegExp(`\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  const styles: Record<string, StyleProps> = {};
  const families: Record<string, string> = {};
  if (!m) return { styles, families };

  /* Every custom property the block declares, so a reference can be resolved
     against it.
   *
   * The generated Desktop block does not restate a weight per step — it writes
   *   --H1-Font-Weight: var(--Font-Weight-Header);
   * and declares the number once under `/* Face weights *\/`, which is the
   * right thing for CSS: one number, and a step that reads a DIFFERENT weight
   * (H4-H6 read --Header-Clamped-Weight) says so by naming it.
   *
   * Reading that with parseFloat gives NaN, the property is dropped, and the
   * Figma variable silently keeps whatever it held — which is how every Desktop
   * font weight came to read 0 while the mobile blocks, which are static and
   * spell their numbers out, were fine.
   *
   * Collected in a separate pass so declaration ORDER cannot matter: the face
   * weights are emitted after the styles that reference them. */
  const declared: Record<string, string> = {};
  for (const raw of m[1].split('\n')) {
    const d = raw.trim().match(/^--([\w-]+):\s*(.+?);$/);
    if (d) declared[d[1]] = d[2];   // last wins, matching the cascade
  }

  let section = '';
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    const sec = line.match(/^\/\*\s*(.+?)\s*\*\/$/);
    if (sec) { section = sec[1]; continue; }
    const decl = line.match(/^--([\w-]+):\s*(.+?);$/);
    if (!decl) continue;
    const [, name, value] = decl;
    const fam = name.match(/^Font-Family-(\w+)$/);
    /* Last one wins, matching the cascade. The mobile blocks declare
       --Font-Family-Body twice — once in Headers pointing at the DECORATIVE
       family, then again in Body pointing at Body — so reading the first would
       record a value the browser never uses. */
    if (fam) { families[section] = value; continue; }
    const prop = name.match(/^(.+?)-(Font-Size|Font-Weight|Line-Height|Letter-Spacing)$/);
    if (prop) {
      const style = styleVariable(prop[1]);
      if (EXCLUDED_STYLES.test(style)) continue;
      const into = (styles[style] ??= {});
      /* A pure `var(...)` is a BACK-COMPAT ALIAS, never a value.
       *
       * The generated Desktop block emits the canonical token and then
       * --Overline-<prop>: var(--Eyebrow-<prop>) right behind it. Folding the
       * two names together without this would let the alias land last and
       * overwrite the number it points at — and since a var() string parses to
       * NaN, the property would then be dropped entirely and the variable would
       * keep whatever it held before. That is how Overline-Small-Font-Weight
       * came to read 0 on Desktop and 500 on the tablets. */
      if (into[prop[2]] !== undefined && /^var\(/.test(value)) continue;
      into[prop[2]] = resolveVar(value, declared);
    }
  }
  return { styles, families };
}

/** px / unitless string to a bare number, for Figma's FLOAT variables. */
function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Any length to PX, against the style's own size.
 *
 * The stylesheet mixes units for letter-spacing and it is not sloppiness —
 * the mobile blocks are static and written in px, while the Desktop ramp is
 * generated and the header tracking curve emits em. Reading both with
 * parseFloat gives -0.018 and 0 and treats them as the same kind of number,
 * which is how an em value ends up in Figma meaning 0.018 PIXELS.
 *
 * Everything is normalised to px here because that is the unit the existing
 * mobile values are already in, and because Figma stores a bare float whose
 * unit lives on the text style — so the two sides have to agree before they
 * get there, not after.
 */
function toPx(v: string | undefined, size: number): number | undefined {
  if (v === undefined) return undefined;
  const m = String(v).trim().match(/^(-?[\d.]+)\s*(em|px|%)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return undefined;
  if (m[2] === 'em') return +(n * size).toFixed(4);
  if (m[2] === '%') return +((n / 100) * size).toFixed(4);
  return n;
}

/** Properties measured as a length, which therefore need unit normalising. */
const LENGTH_PROPS = new Set(['Letter-Spacing', 'Line-Height', 'Font-Size']);

const FLOAT_PROPS = new Set(['Font-Weight', 'Line-Height', 'Letter-Spacing', 'Font-Size']);

/**
 * Which family each type-style section wears, by the name of the variable that
 * holds it.
 *
 * Three roots carry a literal family name — Display, Headers, Body — and every
 * other style points at one of them. The roots are ordinary style names rather
 * than a separate `Faces/` group, because the Display style wears the Display
 * face and there is no third thing for the extra name to mean. It is also the
 * structure already built by hand in the file, and the file is the authority:
 * a name invented here that the file does not have is a silent no-op that
 * reports success, which has happened twice already (`Radio-Size` against the
 * file's `Radio`, `Checkbox-Size` against `Checkbox-Width`).
 *
 * Stated here rather than parsed out of the stylesheet, which departs from the
 * rest of this file — worth being explicit about.
 *
 * Invariant 5 says derive from the CSS so the two cannot disagree about a
 * VALUE. This is not a value; it is an assignment, and the stylesheet's copy of
 * it is wrong in two places:
 *
 *   mobile   Headers  -> --Font-Family-Body: var(--Platform-Font-Families-Decorative)
 *                        wrong token AND wrong face; Desktop has it right
 *   Overline          -> Decorative on Desktop, Body on mobile
 *
 * Deriving from that carried both bugs into Figma, which is what the previous
 * pass did. The stylesheet's Platform vars are also being removed, so there
 * will shortly be nothing there to derive from.
 *
 * `hasARootForEverySection` holds this table against the sections the CSS
 * actually declares, so a new section cannot be added on one side alone — the
 * drift invariant 5 guards against is caught by a test instead of by shared
 * derivation.
 */
export const FAMILY_ROOT_OF: Record<string, string> = {
  Display: 'Display',
  Headers: 'Headers',
  Body: 'Body',
  /* Everything below resolves to the Body face. The eyebrow has no picker of
     its own — resolveRoles maps the eyebrow role at the Body family — so there
     is no third literal to hold. */
  Subtitle: 'Body',
  Caption: 'Body',
  Label: 'Body',
  Legal: 'Body',
  Number: 'Body',
  Button: 'Body',

  /* Eyebrow is a SEAM, not a face: somewhere to change the eyebrow's family
     without touching Body. It resolves to Body today and the text styles bind
     to it, so a design that wants a distinct eyebrow face has one variable to
     repoint and every eyebrow follows.

     There is deliberately no `Overline-Font-Family`. Eyebrow is the name (the
     lib's CSS keeps emitting --Overline-* forever because a published
     stylesheet is frozen and cannot be regenerated — a Figma file is not, and
     this one has already dropped it). */
  Eyebrow: 'Body',
};

/**
 * Stylesheet section -> the variable that holds its family.
 *
 * Only ever needed where the two names differ. The CSS block is still headed
 * `/* Overline *\/` — the frozen-stylesheet reason that keeps --Overline-*
 * alive on the web does not reach a live Figma file, so the variable is
 * Eyebrow and only the section comment lags.
 */
export const SECTION_VARIABLE: Record<string, string> = { Overline: 'Eyebrow' };

/** The variable a stylesheet section's family lands in. */
export function variableForSection(section: string): string {
  return SECTION_VARIABLE[section] ?? section;
}

/**
 * Styles the stylesheet declares that must NOT reach Figma.
 *
 * `--Body-<step>-Bold-Font-Weight: 700` is a legacy token. Body ships standard
 * and SEMIBOLD only — bold at body sizes is what Subtitle is for — and the lib
 * resolves `variant="body-bold"` to the semibold style, not to a 700. The
 * generated Desktop block already knows this and emits only Semibold
 * (BODY_EXTRA_WEIGHTS); the static mobile blocks are older and declare both.
 *
 * The CSS has to keep emitting it, for the frozen-stylesheet reason: a
 * published system cannot be regenerated and a consumer may already read the
 * name. Figma does not, because a variable there is an OFFER — a designer who
 * picks Body-Large-Bold gets 700 in the mock and semibold in the build, and
 * nothing anywhere reports the difference.
 *
 * Caption-Bold and Legal-Semibold are NOT here: those styles really do ship
 * that weight (see SYSTEM_STYLES), so the name means what it says.
 */
export const EXCLUDED_STYLES = /^Body-(Small|Medium|Large)-Bold$/;

/**
 * The variable a stylesheet STYLE lands in. Overline is spelled Eyebrow.
 *
 * The two blocks disagree about the name and each carries half the ramp: the
 * generated Desktop block is post-rename and writes Eyebrow-*, while the static
 * mobile blocks still write Overline-*. Reading them as separate styles
 * produced two variables per property, each populated on the devices whose
 * block happened to use its spelling and untouched — so showing a stale 0 — on
 * the rest.
 *
 * Folding them here means one name, filled on all seven. The CSS keeps emitting
 * both spellings forever, for the frozen-stylesheet reason in
 * generateTypographyTokensCSS; Figma takes only the canonical one.
 */
export function styleVariable(style: string): string {
  return style.replace(/^Overline-/, 'Eyebrow-');
}

/**
 * A family name as FIGMA wants it.
 *
 * CSS quotes a family whose name has a space — `"SF Pro"` — and Figma does not:
 * it stores a font NAME, and the quotes would be part of it, so the font simply
 * would not match. Nothing reports that; the text renders in a fallback and
 * looks like a font choice.
 */
export function figmaFamily(cssFamily: string): string {
  return cssFamily.trim().replace(/^["']|["']$/g, '');
}

/**
 * Devices whose System face is the same as their Omni one.
 *
 * Desktop. "The system font" is not one font there — it is Segoe on Windows, SF
 * on macOS, whatever the distro picked on Linux — so the CSS answers with a
 * stack, and a stack is not something a Figma variable can hold: the field
 * takes one font name. Writing the stack in produced a variable no text style
 * could use.
 *
 * Desktop is also the brand's own surface, which is the substantive reason
 * rather than the mechanical one: there is nothing for System to mean there
 * that Omni does not already say.
 */
export function mirrorsOmni(device: DeviceType): boolean {
  return device === 'Desktop';
}

/** The three roots, and the face whose literal family each one holds. */
export const ROOT_ROLE: Record<string, FamilyRole> = {
  Display: 'display',
  Headers: 'header',
  Body: 'body',
};

/**
 * Sections the stylesheet declares that are NOT type styles.
 *
 * The generated Desktop block opens with a Faces group defining the four face
 * tokens themselves, and the parse — which keys families by whatever section
 * comment preceded them — read it as a style and produced `Faces-Font-Family`,
 * holding a var() reference to a collection that is being removed. It was the
 * first thing anyone noticed in the variables panel.
 */
export const NON_STYLE_SECTIONS = new Set(['Faces', 'Face weights']);

/** The variable that holds one section's family. */
export function familyName(face: FaceMode, section: string): string {
  return sourceName(face, `${section}-Font-Family`);
}

/** The alias a non-root style stores, pointing at its root. */
export function familyAlias(face: FaceMode, root: string): string {
  return `{${familyName(face, root).replace(/\//g, '.')}}`;
}

/**
 * The collection's name in the file, EXACTLY as Figma spells it.
 *
 * One constant because a wrong collection name is the quietest failure in this
 * system: the write lands nowhere and the run reports success. That has
 * already happened twice — `Radio-Size` against the file's `Radio`, and
 * `Checkbox-Size` against `Checkbox-Width`.
 *
 * Read off the variables panel on 2026-09-20 as "Devices-Type", plural on the
 * first word. It is NOT used inside the alias strings — those carry a path and
 * no collection — so this affects only the payload key.
 */
export const DEVICES_COLLECTION = 'Devices-Type';

/** Everything this writes into that collection sits under this prefix. */
export const DEVICES_TYPE_PREFIX = 'Typography/';

/**
 * The two collections, ready for the payload.
 *
 * `devices` is keyed by device type — each key is a MODE of Devices-Type, not
 * a group, so the variable names inside are identical across all seven and
 * only the values differ. That is what lets one alias serve every device.
 *
 * ── Devices-Type is ADDED TO, never replaced ──────────────────────────────
 *
 * The collection already holds ~100 variables that have nothing to do with
 * typography. This function names ONLY variables under `Typography/`, so an
 * importer that creates-or-updates by name leaves every other variable
 * untouched. `payloadIsAdditive()` asserts that and a test holds it, because
 * the failure mode is not a broken import — it is a silently emptied
 * collection, and a deleted Figma variable cannot be recovered by
 * re-importing (invariant 8): the recreated one gets a new id and every layer
 * bound to the old one stays unbound.
 *
 * The import itself has to be create-or-update rather than replace-collection.
 * Nothing here can enforce that; it is a property of the plugin.
 */
export function typographyVariablePayload(
  generatedCSS: string,
  /* The brand's four faces, already resolved to literal family names. Omitted
     only by older callers and the parse-shape tests; when it is missing the
     Omni face roots are skipped rather than filled with a placeholder, because
     a wrong family name in Figma is invisible and a missing one is not. */
  faces?: ResolvedRoles,
): {
  devices: Record<DeviceType, VarBag>;
  typography: Record<FaceMode, VarBag>;
} {
  const devices = {} as Record<DeviceType, VarBag>;
  const typography = { Omni: {} as VarBag, System: {} as VarBag };

  for (const device of DEVICE_TYPES) {
    const bag: VarBag = {};
    const { styles, families } = parsePlatformBlock(generatedCSS, SEEDS_FROM[device]);

    for (const [style, props] of Object.entries(styles)) {
      /* Font-Size is a DEVICE decision, not a face one — it sits outside the
         Omni/System split, together with Line-Height: the two are the vertical
         rhythm, and holding them fixed is what makes the switch safe. */
      const size = num(props['Font-Size']) ?? 16;
      for (const prop of DEVICE_PROPS) {
        const v = LENGTH_PROPS.has(prop) ? toPx(props[prop], size) : num(props[prop]);
        if (v !== undefined) bag[`Typography/${style}-${prop}`] = { value: v, type: 'number' };
      }

      /* Omni is the USER's — straight out of the stylesheet their choices
         generated. System is the PLATFORM's, from Apple's and Google's own
         conventions. The two have to actually differ or the switch shows
         nothing: an earlier pass wrote the same numbers to both and changed
         only the family, which made System a relabelled Omni. */
      const fam = SYSTEM_FAMILY_OF[device];
      for (const prop of SWITCHED_PROPS) {
        const omni = LENGTH_PROPS.has(prop) ? toPx(props[prop], size) : num(props[prop]);
        if (omni === undefined) continue;
        bag[sourceName('Omni', `${style}-${prop}`)] = { value: omni, type: 'number' };

        /* The platform's tables are in em — size-relative, because the seven
           devices do not share one scale — and land in px like everything
           else here. */
        const sys = mirrorsOmni(device)
          ? omni
          : prop === 'Font-Weight'
            ? systemWeight(fam, style)
            : +(systemTracking(fam, size) * size).toFixed(4);
        bag[sourceName('System', `${style}-${prop}`)] = { value: sys, type: 'number' };
      }
    }

    /* ── Families: four literal roots, every style an alias to one ────────
     *
     * What shipped before was the stylesheet's raw declaration —
     * `var(--Platform-Font-Families-Body)` — written into a Figma STRING. That
     * is a CSS reference, not a font name: Figma stores the text verbatim, no
     * text style can bind to it, and the collection it points at is being
     * removed, so it will not resolve on the web either.
     *
     * The literal now lives once per face, and Caption / Subtitle / Label /
     * H1-H6 alias the face they wear. Changing a face is one edit; the styles
     * follow. It is the shape the CSS already had, moved into the collection
     * because the collection it used to lean on is going away.
     */
    for (const face of FACE_MODES) {
      /* The three roots, each holding a literal family name. Omni is the
         brand's, already resolved; System is the platform's, one per device. */
      for (const [root, role] of Object.entries(ROOT_ROLE)) {
        const brand = faces && faces[role].family;
        const value = face === 'System' && !mirrorsOmni(device) ? SYSTEM_FACE[device] : brand;
        if (!value) continue;
        bag[familyName(face, root)] = { value: figmaFamily(value), type: 'string' };
      }

      /* Every other name points at what it wears.
       *
       * Driven by the TABLE rather than by the stylesheet's sections, because
       * Eyebrow is not a section — no `/* Eyebrow *\/` block declares it — and
       * iterating the CSS would drop the one name the text styles bind to. The
       * opposite direction is still guarded: a test holds the table against
       * the sections the CSS does declare. */
      for (const [name, target] of Object.entries(FAMILY_ROOT_OF)) {
        if (target === name) continue;             // a root holds its own literal
        bag[familyName(face, name)] = { value: familyAlias(face, target), type: 'string' };
      }
    }
    devices[device] = bag;
  }

  /* The alias collection. Built off Desktop's key set — every device carries
     the same names by construction, so any of them would do; asserting that
     is cheaper than trusting it, and the test does. */
  for (const name of Object.keys(devices.Desktop)) {
    const token = name.replace(/^Typography\/(Omni|System)\//, '').replace(/^Typography\//, '');
    if (/^Typography\/(Omni|System)\//.test(name)) {
      const isFamily = name.endsWith('-Font-Family');
      for (const face of FACE_MODES) {
        typography[face][token] =
          { value: `{${sourceName(face, token).replace(/\//g, '.')}}`,
            type: isFamily ? 'string' : 'number' };
      }
    } else {
      /* Font-Size does not switch, so BOTH modes alias the one value. Nothing
         selects between them — but a text style binds to the Typography
         collection only, so the size has to be reachable from there too. */
      for (const face of FACE_MODES) {
        typography[face][token] = { value: `{Typography.${token}}`, type: 'number' };
      }
    }
  }
  return { devices, typography };
}

/** Every mode carries the same names, or a style resolves to nothing at a size. */
export function payloadNames(bag: VarBag): string[] { return Object.keys(bag).sort(); }

/**
 * True when a bag touches nothing outside the Typography group.
 *
 * The guarantee this gives is narrow and worth stating exactly: it proves the
 * payload never NAMES another variable. It cannot prove the import is
 * non-destructive — an importer that replaces a whole collection would still
 * take the other hundred with it.
 */
export function payloadIsAdditive(bag: VarBag): boolean {
  return Object.keys(bag).every((n) => n.startsWith(DEVICES_TYPE_PREFIX));
}
