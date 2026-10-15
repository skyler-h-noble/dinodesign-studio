/**
 * Hero Generator — the spec: one hero, over an image or over a gradient.
 *
 * Built on the two portfolio experiments (text over image, text on gradient),
 * remade for Omni: every color is the user's own token and every type style
 * is their own, so the hero is in their brand. The contrast is solved, not
 * checked — over an image the overlay is the lightest that still clears the
 * ratio under the text; over a gradient only stops that keep one text color
 * readable everywhere can be chosen.
 *
 * Like the chart spec, this is plain data: the studio renders code from it
 * and the Figma plugin builds from it.
 */

export const HERO_SPEC_VERSION = 'hero1';
export const HERO_MODES = ['image', 'gradient'] as const;
export const HERO_FAMILIES = ['Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
export const HERO_HEADLINE_STYLES = ['Display-Large', 'Display-Medium', 'Display-Small'] as const;
export const HERO_BODY_STYLES = ['Body-Large', 'Body-Medium', 'Body-Small'] as const;
export const HERO_EYEBROW_STYLES = ['Eyebrow-Large', 'Eyebrow-Medium', 'Eyebrow-Small'] as const;
export const HERO_TONES = 12;
export const HERO_RATIOS = ['21:9', '16:9', '3:1', '4:3'] as const;

export type HeroMode = typeof HERO_MODES[number];
export type HeroFamily = typeof HERO_FAMILIES[number];
export type HeroV = 'top' | 'center' | 'bottom';
export type HeroH = 'left' | 'center' | 'right';

/** A stop. pos places it on a linear or radial ramp; x, y and spread place
 *  it as a blob in a mesh (0..1 of the hero's width and height; spread is the
 *  blob's radius as a fraction of each). A mesh's first stop is its ground. */
export interface HeroStop { family: HeroFamily; tone: number; pos: number; x: number; y: number; spread: number }

export interface HeroSpec {
  version: string;
  name: string;
  designSystem: { id: string | null };
  mode: HeroMode;
  /** The hero's height. It is always the container's full width.
   *    screen   at least the screen's height (100svh) — a landing hero
   *    ratio    keeps a shape (21:9, 16:9, 3:1, 4:3) as it scales; grows if the text needs it
   *    fixed    a set height in px
   *  width / height are the size it is designed and solved at (the preview, and the Figma frame). */
  heightMode: 'screen' | 'ratio' | 'fixed';
  ratio: typeof HERO_RATIOS[number];
  width: number;
  height: number;
  /* No padding field: the space between the hero's edge and its text is the
     device's margin (--Margin in code, Devices-Type Default/Margin in Figma),
     so it follows the device rather than being one number for all of them. */
  text: {
    eyebrow: string;
    headline: string;
    body: string;
    headlineStyle: typeof HERO_HEADLINE_STYLES[number];
    bodyStyle: typeof HERO_BODY_STYLES[number];
    eyebrowStyle: typeof HERO_EYEBROW_STYLES[number];
    /** Call-to-action labels; '' leaves the button out. The first is solid, the second outline. */
    primaryAction: string;
    secondaryAction: string;
    v: HeroV;
    h: HeroH;
    /* No width setting: line length is capped by characters in heroCSS —
       about 20 for the headline, 60 for the body, the readable measure — so
       it is right on desktop and tablet and runs full width on a phone,
       where the screen is narrower than the cap. */
    /** Headline words (indexes into headlineWords()) set in the Alt Display face. */
    altWords: number[];
    /** The Alt words' color. 'alt' is the surface's own Alt-Display-Color,
     *  used only over a gradient and only when the studio measured it passing
     *  there; otherwise 'header' — the face changes, the color does not. */
    altColor: 'alt' | 'header';
  };
  image: {
    /** Where the photo sits when it is cropped to the hero's box. */
    alignX: HeroH;
    alignY: HeroV;
    /** The overlay between photo and text: solid, or strongest at the text. */
    overlay: 'solid' | 'gradient';
    /** The overlay's color family, picked by the user. 'BW' is black or white. */
    overlayFamily: 'BW' | HeroFamily;
    /** The tone of that family the studio chose: on the far side of the 5/6
     *  line from the text, the most colorful one that passes lightly. 0 when
     *  no tone of the family can pass, and the overlay falls back to BW. */
    overlayTone: number;
    /** 'auto' picks whichever text color needs the lighter overlay. */
    textColor: 'auto' | 'light' | 'dark';
    /** The solved opacity (0..1), written by the studio after it scans the photo. */
    alpha: number;
    /** The text color that alpha was solved for. */
    solvedText: 'light' | 'dark';
    /** The surface the text wears over the photo, so its Header, Text,
     *  Eyebrow and buttons are the system's own: the overlay family's theme
     *  (Neutral for black and white) at the level nearest the overlay's tone.
     *  Written by the studio; null means black and white throughout. */
    theme: HeroFamily;
    surface: HeroSurfaceLevel | null;
    /** Roles whose surface color cannot clear this photo at any overlay
     *  strength, and so are black or white instead. */
    bwRoles: HeroRole[];
    /** The button palette that works over this photo (see HERO_BUTTON_PALETTES). */
    buttonPalette: HeroButtonPalette;
  };
  gradient: {
    variant: 'linear' | 'radial' | 'mesh';
    /** Linear: the CSS angle in degrees. */
    angle: number;
    stops: HeroStop[];
    /** The design system surface the hero takes its text from: the theme of
     *  the first stop's family, at the surface level whose tone is closest to
     *  that stop. Measured by the studio (levels sit on different tones in
     *  each system and mode) and stored here, like the overlay's opacity. */
    surface: HeroSurfaceLevel;
    /** Roles whose surface color cannot clear the whole fill, and so are
     *  black or white (the fill's text side) instead — so any first tone can
     *  be picked, with only the pieces that would fail changing. */
    bwRoles: HeroRole[];
    /** The button palette that works on this fill (see HERO_BUTTON_PALETTES). */
    buttonPalette: HeroButtonPalette;
  };
}

export const HERO_SURFACES = ['Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest'] as const;
export const HERO_ROLES = ['headline', 'body', 'eyebrow', 'buttons'] as const;
/** The button palettes tried, in order, for a hero's buttons: the first whose
 *  fill, outline and label all clear what they sit on is used. */
export const HERO_BUTTON_PALETTES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
export type HeroButtonPalette = typeof HERO_BUTTON_PALETTES[number];
export type HeroRole = typeof HERO_ROLES[number];
export type HeroSurfaceLevel = typeof HERO_SURFACES[number];

const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const str = (v: unknown, d: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);

/** Text color for a gradient — set by its FIRST stop, Omni's rule: tones 1–5
 *  are dark and take white (BW-Color-1); 6–12 take near-black (BW-Color-6). */
/** The headline's words, as the Alt picker and the code both count them. */
export const headlineWords = (headline: string): string[] => headline.split(/\s+/).filter(Boolean);

/** The Alt Display step that pairs with a headline style: the same size step,
 *  and Small for the headings, which have no Alt of their own. */
export const altStyleFor = (headlineStyle: string): string =>
  (headlineStyle === 'Display-Large' ? 'Alt-Display-Large'
    : headlineStyle === 'Display-Medium' ? 'Alt-Display-Medium' : 'Alt-Display-Small');

export const textForTone = (tone: number): 'light' | 'dark' => (tone <= 5 ? 'light' : 'dark');

/** Tones a later stop may use: the same side of the 5/6 line as the first,
 *  so the whole fill keeps one readable text color. */
export const allowedTones = (firstTone: number): number[] =>
  (firstTone <= 5 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11, 12]);

/** Where blobs sit before they are moved: the ground first (unused), then corners and middle. */
export const MESH_SPOTS: [number, number][] = [[0.5, 0.5], [0.85, 0.15], [0.15, 0.9], [0.9, 0.85], [0.2, 0.15]];

export function normalizeHeroSpec(raw: unknown): HeroSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const t = r.text || {};
  const im = r.image || {};
  const g = r.gradient || {};
  const rawStops: any[] = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops.slice(0, 5) : [
    { family: 'Primary', tone: 3, pos: 0 },
    // Tone 3, not 4: tones 4–5 sit near the 5/6 line, where small text such
    // as the eyebrow dips under 4.5:1 (Surf: 4.41:1 at Secondary 4).
    { family: 'Secondary', tone: 3, pos: 1 },
  ];
  const first = num(rawStops[0] && rawStops[0].tone, 3, 1, HERO_TONES);
  const allowed = allowedTones(first);
  const stops: HeroStop[] = rawStops.map((s, i) => {
    let tone = Math.round(num(s && s.tone, first, 1, HERO_TONES));
    // A later stop off the first one's side moves to the nearest legal tone.
    if (i > 0 && !allowed.includes(tone)) tone = allowed.reduce((b, x) => (Math.abs(x - tone) < Math.abs(b - tone) ? x : b), allowed[0]);
    // A blob's default place: spread around the box, clear of each other.
    const spot = MESH_SPOTS[i % MESH_SPOTS.length];
    return {
      family: pick(s && s.family, HERO_FAMILIES, 'Primary'), tone,
      pos: num(s && s.pos, i / (rawStops.length - 1), 0, 1),
      x: num(s && s.x, spot[0], 0, 1), y: num(s && s.y, spot[1], 0, 1), spread: num(s && s.spread, 0.6, 0.15, 1.5),
    };
  });
  return {
    version: HERO_SPEC_VERSION,
    name: str(r.name, 'Hero', 60),
    designSystem: { id: r.designSystem && typeof r.designSystem.id === 'string' ? r.designSystem.id : null },
    mode: pick(r.mode, HERO_MODES, 'image'),
    width: num(r.width, 1200, 240, 3000),
    height: num(r.height, 560, 160, 2000),
    heightMode: pick(r.heightMode, ['screen', 'ratio', 'fixed'] as const, 'ratio'),
    ratio: pick(r.ratio, HERO_RATIOS, '21:9'),
    text: {
      eyebrow: str(t.eyebrow, 'New collection', 60),
      headline: str(t.headline, 'Made for long summer days', 120),
      body: str(t.body, 'Light layers and bright colors, designed to be worn from the first coffee to the last light.', 300),
      // Older specs: the headings map to the smallest Display, plain Body to Medium.
      headlineStyle: pick(t.headlineStyle === 'H1' || t.headlineStyle === 'H2' ? 'Display-Small' : t.headlineStyle, HERO_HEADLINE_STYLES, 'Display-Large'),
      bodyStyle: pick(t.bodyStyle === 'Body' ? 'Body-Medium' : t.bodyStyle, HERO_BODY_STYLES, 'Body-Large'),
      eyebrowStyle: pick(t.eyebrowStyle, HERO_EYEBROW_STYLES, 'Eyebrow-Medium'),
      primaryAction: str(t.primaryAction, 'Shop the collection', 40),
      secondaryAction: str(t.secondaryAction, 'Learn more', 40),
      v: pick(t.v, ['top', 'center', 'bottom'] as const, 'bottom'),
      h: pick(t.h, ['left', 'center', 'right'] as const, 'left'),
      altWords: (() => {
        const n = headlineWords(str(t.headline, 'Made for long summer days', 120)).length;
        const list: unknown[] = Array.isArray(t.altWords) ? t.altWords : [];
        return [...new Set(list.map(Number).filter((i: number) => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b);
      })(),
      altColor: pick(t.altColor, ['alt', 'header'] as const, 'header'),
    },
    image: {
      alignX: pick(im.alignX, ['left', 'center', 'right'] as const, 'center'),
      alignY: pick(im.alignY, ['top', 'center', 'bottom'] as const, 'center'),
      overlay: pick(im.overlay, ['solid', 'gradient'] as const, 'gradient'),
      overlayFamily: pick(im.overlayFamily, ['BW', ...HERO_FAMILIES] as const, 'BW'),
      overlayTone: Math.round(num(im.overlayTone, 0, 0, HERO_TONES)),
      textColor: pick(im.textColor, ['auto', 'light', 'dark'] as const, 'auto'),
      alpha: num(im.alpha, 0.5, 0, 1),
      solvedText: pick(im.solvedText, ['light', 'dark'] as const, 'light'),
      theme: pick(im.theme, HERO_FAMILIES, 'Neutral'),
      surface: HERO_SURFACES.includes(im.surface) ? im.surface : null,
      bwRoles: Array.isArray(im.bwRoles) ? HERO_ROLES.filter((r) => im.bwRoles.includes(r)) : [],
      buttonPalette: pick(im.buttonPalette, HERO_BUTTON_PALETTES, 'Default'),
    },
    gradient: {
      variant: pick(g.variant, ['linear', 'radial', 'mesh'] as const, 'linear'),
      angle: num(g.angle, 135, 0, 360),
      stops,
      surface: pick(g.surface, HERO_SURFACES, stops[0].tone <= 5 ? 'Surface-Dimmest' : 'Surface-Brightest'),
      bwRoles: Array.isArray(g.bwRoles) ? HERO_ROLES.filter((r) => g.bwRoles.includes(r)) : [],
      buttonPalette: pick(g.buttonPalette, HERO_BUTTON_PALETTES, 'Default'),
    },
  };
}
