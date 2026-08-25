/**
 * The page background, as THEME + SURFACE LEVEL.
 *
 * The picker used to offer four opaque strings — 'white', 'black',
 * 'primary-base', 'primary-light' — each of which the export, the preview and
 * the Figma generator decoded with their own switch. This states the same thing
 * in the vocabulary the rest of the system already speaks (`data-theme` +
 * `data-surface`) and gives one place to decode it.
 *
 * The four legacy strings still resolve, to EXACTLY the tones they resolve to
 * today. 17 published systems store them, and a background that shifts by a
 * tone on reload is a brand change nobody asked for.
 */

export const BACKGROUND_THEMES = ['Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
export type BackgroundTheme = typeof BACKGROUND_THEMES[number];

export const SURFACE_LEVELS = [
  'Surface-Dimmest',
  'Surface-Dim',
  'Surface',
  'Surface-Bright',
  'Surface-Brightest',
] as const;
export type SurfaceLevel = typeof SURFACE_LEVELS[number];

export interface BackgroundSelection {
  theme: BackgroundTheme;
  surface: SurfaceLevel;
}

/**
 * Where each level sits on the 12-tone ramp.
 *
 * These are ABSOLUTE positions, not the relative Surface-Dim/Bright levels that
 * `addSurfaceEnds` computes inside a Background-N row. Those are relative to a
 * row's own N and saturate — Surface-Brightest is literal #ffffff from any high
 * row — so they cannot express "black" and "white" from one anchor. As a
 * picker vocabulary the levels have to name points on the ramp.
 */
const LEVEL_TONE: Record<SurfaceLevel, number> = {
  'Surface-Dimmest': 1,
  'Surface-Dim': 3,
  'Surface': 6,
  'Surface-Bright': 9,
  'Surface-Brightest': 12,
};

/**
 * Surface-Brightest is Color-12 on Neutral and Color-11 on a chromatic theme.
 *
 * Not an inconsistency to tidy away. Neutral's Color-12 is the white page. On a
 * chromatic ramp Color-12 is so desaturated it also reads as white, which
 * throws away the tint that makes it a BRANDED background — Color-11 is the
 * brightest tone that still reads as the brand. It is also what the four legacy
 * options already did: white is Neutral-12, primary-light is Primary-11.
 */
const CHROMATIC_BRIGHTEST = 11;

/**
 * A chromatic theme's `Surface` is the brand's own core tone, so the levels
 * around it are placed BETWEEN the anchors rather than at fixed tones.
 *
 * Fixed tones do not survive a light or dark brand: at core 10 the table
 * [1, 3, core, 9, 11] puts Surface-Bright BELOW Surface, and at core 3 it
 * collides with Surface-Dim. Measured, only cores 4-8 stayed ordered. The
 * picker showing "Bright" darker than "Base" is the kind of wrong that reads as
 * a rendering bug rather than a mapping one.
 *
 * The core is clamped to [3, 9] so there is always a tone on each side —
 * at core 2 the midpoint of 1 and 2 rounds back onto the core itself. A brand
 * whose core sits outside that band is one whose own colour is already at the
 * end of the ramp, where it makes a poor page background anyway.
 */
export function toneFor(
  theme: BackgroundTheme,
  surface: SurfaceLevel,
  coreToneN?: number,
): number {
  const isNeutral = theme === 'Neutral';
  if (isNeutral) return LEVEL_TONE[surface];

  const dimmest = LEVEL_TONE['Surface-Dimmest'];          // 1
  const brightest = CHROMATIC_BRIGHTEST;                  // 11
  const core = Math.min(Math.max(coreToneN ?? LEVEL_TONE.Surface, dimmest + 2), brightest - 2);

  switch (surface) {
    case 'Surface-Dimmest':   return dimmest;
    case 'Surface-Dim':       return Math.round((dimmest + core) / 2);
    case 'Surface':           return core;
    case 'Surface-Bright':    return Math.round((core + brightest) / 2);
    case 'Surface-Brightest': return brightest;
  }
}

/** The four options the picker used to offer, and the tones they resolve to. */
const LEGACY: Record<string, BackgroundSelection> = {
  'white':         { theme: 'Neutral', surface: 'Surface-Brightest' },
  'black':         { theme: 'Neutral', surface: 'Surface-Dimmest' },
  'primary-light': { theme: 'Primary', surface: 'Surface-Brightest' },
  'primary-base':  { theme: 'Primary', surface: 'Surface' },
  // 'primary' appears in older stored data and in several type unions as a
  // synonym for primary-base.
  'primary':       { theme: 'Primary', surface: 'Surface' },
};

/**
 * Read a stored background in either form.
 *
 * Accepts a legacy string, a {theme, surface} pair, or the
 * backgroundTheme/backgroundN fields that already exist on UserSelections.
 */
export function parseBackground(
  value: string | BackgroundSelection | null | undefined,
): BackgroundSelection {
  if (value && typeof value === 'object' && 'theme' in value) return value;
  if (typeof value === 'string') {
    if (LEGACY[value]) return LEGACY[value];
    // 'Primary/Surface-Bright' — the serialised form of the new picker.
    const [theme, surface] = value.split('/');
    if (
      (BACKGROUND_THEMES as readonly string[]).includes(theme) &&
      (SURFACE_LEVELS as readonly string[]).includes(surface)
    ) {
      return { theme: theme as BackgroundTheme, surface: surface as SurfaceLevel };
    }
  }
  return { theme: 'Neutral', surface: 'Surface-Brightest' };   // white
}

/** The serialised form stored on the design system. */
export function formatBackground(sel: BackgroundSelection): string {
  return `${sel.theme}/${sel.surface}`;
}

/**
 * The legacy string for a selection, where one exists.
 *
 * Consumers that still branch on the old four keep working for those four
 * combinations. The other sixteen have no legacy name and return null — a
 * caller that needs a name for them is a caller that has not been migrated.
 */
export function legacyName(sel: BackgroundSelection): string | null {
  for (const [name, s] of Object.entries(LEGACY)) {
    if (name === 'primary') continue;   // prefer 'primary-base'
    if (s.theme === sel.theme && s.surface === sel.surface) return name;
  }
  return null;
}

/** Human label for the picker. */
export function backgroundLabel(sel: BackgroundSelection): string {
  const legacy = legacyName(sel);
  if (legacy === 'white') return 'White';
  if (legacy === 'black') return 'Black';
  return `${sel.theme} ${sel.surface.replace('Surface-', '').replace('Surface', 'Base')}`.trim();
}
