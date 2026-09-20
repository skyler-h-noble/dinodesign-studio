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

/** The properties that switch with the face. Font-Size is NOT one — see above. */
export const SWITCHED_PROPS = [
  'Font-Weight',
  'Line-Height',
  'Letter-Spacing',
] as const;

/** The property that stays with the device regardless of face. */
export const DEVICE_PROPS = ['Font-Size'] as const;

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
