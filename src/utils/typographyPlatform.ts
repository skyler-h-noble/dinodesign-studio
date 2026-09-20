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

export interface TypeValue { value: string | number; type: string }
export type VarBag = Record<string, TypeValue>;

/** One style's properties, keyed by the property suffix. */
type StyleProps = Record<string, string>;

/** Parse one `[data-platform="X"] { … }` block into style -> prop -> value. */
export function parsePlatformBlock(css: string, platform: string):
  { styles: Record<string, StyleProps>; families: Record<string, string> } {
  const re = new RegExp(`\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  const styles: Record<string, StyleProps> = {};
  const families: Record<string, string> = {};
  if (!m) return { styles, families };
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
    if (prop) (styles[prop[1]] ??= {})[prop[2]] = value;
  }
  return { styles, families };
}

/** px / unitless string to a bare number, for Figma's FLOAT variables. */
function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

const FLOAT_PROPS = new Set(['Font-Weight', 'Line-Height', 'Letter-Spacing', 'Font-Size']);

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
export function typographyVariablePayload(generatedCSS: string): {
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
      for (const prop of DEVICE_PROPS) {
        const v = num(props[prop]);
        if (v !== undefined) bag[`Typography/${style}-${prop}`] = { value: v, type: 'number' };
      }

      for (const prop of SWITCHED_PROPS) {
        const v = num(props[prop]);
        if (v === undefined) continue;
        /* Both faces start from the same metrics. The System side is seeded,
           not derived — a system face genuinely wants its own leading and
           tracking, and those are design decisions rather than arithmetic.
           Seeding means this lands without changing a rendered value, and the
           System column is then tuned in Figma. */
        for (const face of FACE_MODES) {
          bag[sourceName(face, `${style}-${prop}`)] = { value: v, type: 'number' };
        }
      }
    }

    for (const [section, family] of Object.entries(families)) {
      bag[sourceName('Omni', `${section}-Font-Family`)] = { value: family, type: 'string' };
      bag[sourceName('System', `${section}-Font-Family`)] =
        { value: SYSTEM_FACE[device], type: 'string' };
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
