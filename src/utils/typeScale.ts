// typeScale.ts — expand the three chosen font roles into the full named type
// scale. Ported from omni-type-studio's src/lib/typeScale.js so the studio,
// the CSS export and the Figma payload all read one structure.
//
// The studio's matcher produces one specimen per role (Header / Decorative /
// Body). A real type system needs the whole ramp, so this file owns it:
//
//   Display   Large, Medium, Small    → Decorative face
//   Header    H1…H6                   → Header face
//   Body      Small 14 / Medium 16 / Large 18, each × Regular / Semibold / Bold
//   Eyebrow   Small, Medium, Large    → uppercase, tracked
//   Subtitle · Caption · Label · Legal · Number · Button → Body face
//
// Two things carried over from omni that the old static ramp did not have:
//
//  1. Every COMPUTED Display/Header line height lands on a 4px multiple, so
//     type sits on the same rhythm as the spacing scale. The ratios look
//     arbitrary read on their own (1.1111, 1.1667) and are the opposite —
//     they are what 80/72 and 56/48 require. H4–H6 are 24/20/18 for the same
//     reason; 26/22/19 could not be made to land on the grid at any sane ratio.
//
//  2. Line height is never 1.0. A 1.0 line box hugs the type, which is fine
//     until a heading wraps — at which point the second line's ascenders sit
//     inside the first line's descenders.
//
// Token NAMES stay on the studio/lib spelling (--H1-Font-Size, not
// --Header-H1-Font-Size) so @omni-design/components keeps resolving them
// untouched. Only the values and the generation logic come from omni.

import type { TypographyStyle } from '../types';
import { HEADER_FAMILY, moodToAxes } from './moodAxes';

/** The eyebrow renders in the OS UI font, which has no Figma equivalent. Inter
 *  is the closest neutral stand-in and is always present. */
export const EYEBROW_FIGMA_FAMILY = 'Inter';

/** The OS UI stack the eyebrow renders in on the web. */
export const SYSTEM_UI_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * The four faces. Every style points at one of them, and each publishes a
 * single token — --Font-Family-Display / -Header / -Eyebrow / -Body — that
 * every other family variable is relative to.
 *
 * `display` is the face the user picks as Decorative; the token is named for
 * the job it does rather than the picker it came from. `eyebrow` has no picker
 * of its own yet and falls back to the Body face, so the token is in place for
 * the day it gets one.
 */
export type FamilyRole = 'display' | 'header' | 'eyebrow' | 'body';

/** Face → the name it goes by in a token. */
export const FACE_LABEL: Record<FamilyRole, string> = {
  display: 'Display',
  header: 'Header',
  eyebrow: 'Eyebrow',
  body: 'Body',
};

/** Face → the --Font-Family-* token it publishes. */
export const FACE_TOKEN: Record<FamilyRole, string> = {
  display: `Font-Family-${FACE_LABEL.display}`,
  header: `Font-Family-${FACE_LABEL.header}`,
  eyebrow: `Font-Family-${FACE_LABEL.eyebrow}`,
  body: `Font-Family-${FACE_LABEL.body}`,
};

/**
 * Variable-font axes, in the words the studio's sliders use rather than the
 * four-letter tag — Optical size, not opsz. One variable per axis per face, so
 * an axis can be nudged on its own instead of by rewriting an opaque
 * font-variation-settings string.
 *
 * Google Sans Flex (the Header face) exposes all six. Any axis not listed here
 * still gets a variable, named off its raw tag.
 */
export const AXIS_LABEL: Record<string, string> = {
  wght: 'Weight',
  wdth: 'Width',
  opsz: 'Optical-Size',
  slnt: 'Slant',
  GRAD: 'Grade',
  ROND: 'Roundness',
  ital: 'Italic',
};

/** The variable one axis of one face publishes, e.g. Font-Width-Header. */
export const axisToken = (tag: string, face: FamilyRole): string =>
  `Font-${AXIS_LABEL[tag] || `Axis-${tag}`}-${FACE_LABEL[face]}`;

/** The weight axis is spelled as a normal font-weight, so it gets the same
 *  token whether or not the face is variable. */
export const weightToken = (face: FamilyRole): string => axisToken('wght', face);

/** A weight token that hangs off another style's size, the way the lib models
 *  Body-Small-Semibold / Caption-Bold / Legal-Semibold — same size and line
 *  height, one extra --…-Font-Weight token. */
export interface ExtraWeight {
  /** Token infix, e.g. 'Semibold' → --Body-Small-Semibold-Font-Weight */
  suffix: string;
  weight: number;
}

export interface TypeStyle {
  /** Token base — the string the lib interpolates, e.g. 'H1', 'Display-Large',
   *  'Eyebrow-Small', 'Button-Standard'. */
  token: string;
  /** Slash name used by Figma text styles, e.g. 'Header/H1'. */
  name: string;
  group: string;
  step: string;
  familyRole: FamilyRole;
  size: number;
  weight: number;
  /** Computed line height in px. Display/Header land on the 4px grid. */
  lineHeight: number;
  /** em string, so tracking scales with the reader's font size. */
  letterSpacing: string;
  textTransform: 'none' | 'uppercase';
  /** Space BETWEEN paragraphs of this style, in px (Figma's paragraphSpacing). */
  paragraphSpacing: number;
  extraWeights?: ExtraWeight[];
  /** True when the weight is the FACE's weight rather than one this style
   *  fixes for itself. Those styles reference --Font-Weight-<Face> so the
   *  face's wght axis drives them; Subtitle 700, Label 600 and the rest keep
   *  their own number. */
  weightFromFace?: boolean;
  /** A step that reads a DIFFERENT weight variable than its face's.
   *  H4-H6 use --Header-Clamped-Weight so small headers can carry more weight
   *  than the brand's display pick without changing H1-H3. Matches the Figma
   *  variable of the same name — the two have to agree or they drift. */
  weightVar?: string;
  /** Variable-font axes, when the role's family is variable. */
  axes?: Record<string, number>;
  /** Display only — 0–100 grain amount rendered as SVG turbulence. */
  noise?: number;
  /** Display only — 0–100 hand-lettering rise and fall. */
  bounce?: number;
  description?: string;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

/** ~1.22 modular scale seeded from the 16px body, tightened at the top where
 *  large type needs less leading. Line height in px, on the 4px grid.
 *
 *  Three steps, doing three different jobs rather than sitting on one even
 *  ratio: Large is a hero, Medium opens a section, Small is sized to work
 *  INSIDE a component — a card title, a stat, a pull quote. */
export const DEFAULT_DISPLAY_SIZE = 72;

/** H1's size, shared with HEADER_STEPS below.
 *
 *  Display-Small is pinned to it so the two ramps hand off at a single number:
 *  the smallest Display is the same size as the largest Header, differing only
 *  in voice — the expressive face, its weight, its leading, its letter spacing.
 *  That makes "swap an H1 for a Display-Small" a change of tone that costs the
 *  layout nothing.
 *
 *  (Small used to sit at 40 — H2's size — for the same reason one step down.
 *  Pinning to H1 tightens the ramp: at the default Large the steps go 72 / 60 /
 *  48 rather than 72 / 56 / 40, so the three are closer together.) */
export const H1_SIZE = 48;

/* Three steps here, two in Figma.
 *
 * The design file carries Large and Small only, so Display-Medium is dropped
 * from the Figma payload (EXCLUDED_STYLES in typographyPlatform.ts). It stays
 * in the CSS, because the lib READS it — Typography.js:124-128 resolves
 * --Display-Medium-Font-Size and friends for the DisplayMedium export, and
 * dropping the tokens would render that component unstyled on every page
 * already using it.
 *
 * That is the rule for all three of these: a CSS token is something a consumer
 * may already depend on, while a Figma variable is an OFFER. Withdrawing the
 * offer costs nothing; withdrawing the token breaks a build. The step leaves
 * the CSS when the lib stops exporting it, and not before.
 */
const DISPLAY_STEP_TOKENS = {
  large: { token: 'Display-Large', step: 'Large' },
  medium: { token: 'Display-Medium', step: 'Medium' },
  small: { token: 'Display-Small', step: 'Small' },
} as const;

/** Nearest even whole number — the ramp stays on round sizes as the slider moves. */
const evenRound = (n: number) => Math.round(n / 2) * 2;

/**
 * Leading for a Display size, always landing on the 4px grid.
 *
 * One ratio for the whole Display ramp rather than tightening at the top: the
 * previous 1.11 hugged the type so closely that a wrapped hero line looked
 * cramped, which is the same failure 1.0 leading has, just less extreme.
 * At the defaults this gives 72→96, 56→76, 40→52.
 */
export const DISPLAY_LEADING = 1.3;

/** The band Display leading is allowed to move within. */
export const DISPLAY_LEADING_LOOSE = 1.3;   // smallest Display size
export const DISPLAY_LEADING_TIGHT = 1.1;   // largest Display size

/** The Display size slider's ends, which the leading is interpolated across. */
export const DISPLAY_SIZE_MIN = 32;
export const DISPLAY_SIZE_MAX = 120;

/**
 * Leading for a Display size — calculated, not chosen.
 *
 * Big type needs tighter leading: the same ratio that reads as comfortable at
 * 32px opens a visible gap at 120px, because the space between lines grows with
 * the size while the eye's need for it does not. So the ratio slides from 1.3
 * at the small end to 1.1 at the large end rather than staying flat.
 *
 * This replaces a user-facing slider. A ratio is a poor thing to ask someone to
 * set — it has to be re-judged every time the size moves, and the earlier flat
 * 1.3 was chosen for a 72px hero and then applied unchanged to every size.
 */
export function displayLeadingFor(size: number): number {
  const span = DISPLAY_SIZE_MAX - DISPLAY_SIZE_MIN;
  const t = Math.min(1, Math.max(0, (size - DISPLAY_SIZE_MIN) / span));
  return DISPLAY_LEADING_LOOSE - t * (DISPLAY_LEADING_LOOSE - DISPLAY_LEADING_TIGHT);
}

/**
 * Line height in px, on the 4px grid.
 *
 * `leading` stays overridable for callers that genuinely have one, but the
 * default is now derived from the size rather than a single constant — so each
 * Display step gets its own ratio instead of the whole ramp sharing Large's.
 */
export function displayLineHeight(size: number, leading = displayLeadingFor(size)): number {
  // Round to the NEAREST 4px, then clamp back inside the 1.1-1.3 band.
  //
  // Always rounding up (the previous behaviour) pushed small sizes out the top:
  // 32px at 1.30 is 41.6, which ceils to 44 — an effective 1.375, above the
  // ceiling. The band is the requirement and the 4px grid is the constraint, so
  // the grid has to yield where the two disagree.
  const target = size * leading;
  let px = Math.round(target / 4) * 4;
  const floorPx = size * DISPLAY_LEADING_TIGHT;
  const ceilPx = size * DISPLAY_LEADING_LOOSE;
  if (px < floorPx) px = Math.ceil(floorPx / 4) * 4;
  if (px > ceilPx) px = Math.floor(ceilPx / 4) * 4;
  // The band is 20% of the size, so it holds a 4px multiple for every size the
  // Display ramp can take. This is the floor if one ever does not.
  return Math.max(4, px);
}

/**
 * The three Display steps for a chosen Large size.
 *
 * Large is whatever the slider says. Small is H1, so the Display ramp lands on
 * the Header ramp instead of near it. Medium is the midpoint of the two,
 * rounded to an even number.
 *
 * Below 48 there is no room between the two ends, so Small follows Large down
 * and the three steps converge rather than inverting — a Display-Small larger
 * than its Display-Large would be worse than a flat ramp.
 */
export function displaySteps(largeSize = DEFAULT_DISPLAY_SIZE, leading?: number) {
  const large = Math.max(16, evenRound(largeSize));
  const small = Math.min(H1_SIZE, large);
  const medium = Math.min(large, Math.max(small, evenRound((large + small) / 2)));
  const sizes = { large, medium, small };
  return (['large', 'medium', 'small'] as const).map((key) => ({
    ...DISPLAY_STEP_TOKENS[key],
    size: sizes[key],
    // Each step computes its own ratio from its own size. An explicit `leading`
    // still wins, so a caller with a real reason can flatten the ramp.
    lineHeight: displayLineHeight(sizes[key], leading ?? displayLeadingFor(sizes[key])),
  }));
}

/** The default ramp, for callers that don't have a design in hand. */
export const DISPLAY_STEPS = displaySteps();

/** The floor for small headers.
 *
 *  A 250 that reads elegant at 48px reads washed out at 18px, so H4-H6 take
 *  max(brand's pick, this) while H1-H3 keep the brand's weight untouched. A
 *  FLOOR, not a fixed value: a brand that picked 700 keeps 700 rather than
 *  being lightened by a rule meant to strengthen it. */
export const HEADER_CLAMPED_WEIGHT_FLOOR = 500;

/** Steps that read --Header-Clamped-Weight instead of --Font-Weight-Header. */
export const CLAMPED_HEADER_STEPS = ['H4', 'H5', 'H6'];

export const HEADER_STEPS = [
  { token: 'H1', step: 'H1', size: H1_SIZE, lineHeight: 56 },
  { token: 'H2', step: 'H2', size: 40, lineHeight: 48 },
  { token: 'H3', step: 'H3', size: 32, lineHeight: 40 },
  { token: 'H4', step: 'H4', size: 24, lineHeight: 32 },
  { token: 'H5', step: 'H5', size: 20, lineHeight: 28 },
  { token: 'H6', step: 'H6', size: 18, lineHeight: 24 },
];

export const BODY_LINE_HEIGHT = 1.5;

export const BODY_SIZES = [
  { token: 'Body-Small', step: 'Small', size: 14 },
  { token: 'Body-Medium', step: 'Medium', size: 16 },
  { token: 'Body-Large', step: 'Large', size: 18 },
];

/** Body ships one size token plus ONE extra weight: Standard and Semibold.
 *  Bold at body sizes is what Subtitle is for, so a third weight here would be
 *  the same three styles under two names. */
export const BODY_EXTRA_WEIGHTS: ExtraWeight[] = [
  { suffix: 'Semibold', weight: 600 },
];

/** Subtitle is Body at bold — same sizes, same leading, weight 700. Derived
 *  from BODY_SIZES rather than restated, so the two can never drift apart. */
export const SUBTITLE_WEIGHT = 700;

/** Eyebrow: small utility labels, uppercase, tracked out, 1.5 leading. Smaller
 *  sizes get MORE tracking — the standard optical correction. Weight is fixed
 *  at 600; an eyebrow reads as a label, not as body copy, and it is too small
 *  for the body role's weight to carry it.
 *
 *  This used to be called Overline, and the size tokens carried that name even
 *  after the face and colour role became Eyebrow — which meant an eyebrow was
 *  spelled two ways depending on which property you were setting. The tokens
 *  are Eyebrow now; --Overline-* is still emitted as an alias so design systems
 *  and lib versions from before the rename keep resolving. */
/** Tracking DECREASES as the type grows, and that direction is the rule, not a
 *  coincidence: an eyebrow is set in caps, and tight spacing is what makes small
 *  caps hard to read, so the smallest step needs the most air. The ramp was
 *  loosened wholesale from 0.12/0.10/0.08 — keep the ordering when retuning it,
 *  or Medium ends up airier than Small and the steps stop reading as a scale. */
export const EYEBROW_STEPS = [
  // Sizes match the Figma type styles: 12 / 16 / 18. Code had 12 / 13 / 15, so
  // Small agreed and the two larger steps drifted — a Medium eyebrow rendered
  // three points smaller than the design, which reads as "slightly off" rather
  // than as a mismatch, and survives exactly because of that.
  { token: 'Eyebrow-Small', step: 'Small', size: 12, letterSpacing: '0.06em' },
  { token: 'Eyebrow-Medium', step: 'Medium', size: 16, letterSpacing: '0.05em' },
  { token: 'Eyebrow-Large', step: 'Large', size: 18, letterSpacing: '0.04em' },
];

/** The pre-rename token names, kept so the CSS export can emit aliases. */
export const EYEBROW_LEGACY_TOKEN = {
  'Eyebrow-Small': 'Overline-Small',
  'Eyebrow-Medium': 'Overline-Medium',
  'Eyebrow-Large': 'Overline-Large',
};

export const EYEBROW_LINE_HEIGHT = 1.5;
export const EYEBROW_WEIGHT = 600;

/**
 * The rest of the system. Every one of these uses the BODY face — they're
 * interface and reading styles, not expressive ones, so they follow whatever
 * Body is set to rather than the Decorative face.
 *
 * Values are the design system's Desktop tokens verbatim: size, weight, line
 * height and character/paragraph spacing all in px. Character spacing is
 * converted to em on the way out so it scales with the reader's font size.
 */
interface SystemStyleSpec {
  token: string;
  group: string;
  step: string;
  size: number;
  weight: number;
  /** line height, px */
  lh: number;
  /** character spacing, px */
  cs?: number;
  /** paragraph spacing, px */
  ps?: number;
  uppercase?: boolean;
  extraWeights?: ExtraWeight[];
}

export const SYSTEM_STYLES: SystemStyleSpec[] = [
  { token: 'Caption', group: 'Caption', step: 'Standard', size: 14, weight: 500, lh: 21, cs: 0.1, ps: 28,
    extraWeights: [{ suffix: 'Bold', weight: 700 }] },

  { token: 'Label-ExtraSmall', group: 'Label', step: 'Extra Small', size: 11, weight: 600, lh: 16.5, cs: 0.5 },
  { token: 'Label-Small', group: 'Label', step: 'Small', size: 12.5, weight: 600, lh: 18.75, cs: 0.25 },
  { token: 'Label-Medium', group: 'Label', step: 'Medium', size: 16, weight: 600, lh: 24 },
  { token: 'Label-Medium-All-Caps', group: 'Label', step: 'Medium All Caps', size: 16, weight: 600, lh: 24, uppercase: true },
  { token: 'Label-Large', group: 'Label', step: 'Large', size: 18, weight: 600, lh: 27 },

  { token: 'Legal', group: 'Legal', step: 'Standard', size: 10, weight: 400, lh: 15, ps: 20,
    extraWeights: [{ suffix: 'Semibold', weight: 600 }] },

  { token: 'Number-Small', group: 'Number', step: 'Small', size: 16, weight: 700, lh: 16 },
  { token: 'Number-Medium', group: 'Number', step: 'Medium', size: 28, weight: 700, lh: 28 },
  { token: 'Number-Large', group: 'Number', step: 'Large', size: 36, weight: 700, lh: 36 },

  { token: 'Button-ExtraSmall', group: 'Button', step: 'Extra Small', size: 11, weight: 600, lh: 11 },
  { token: 'Button-Small', group: 'Button', step: 'Small', size: 14, weight: 600, lh: 14 },
  // The lib's `button` / `button-standard` styles read the aggregate
  // --Button-Font-Size / --Button-Line-Height, which core.css owns per
  // platform. This is the per-step token the Figma variables are named after.
  { token: 'Button-Standard', group: 'Button', step: 'Standard', size: 16, weight: 600, lh: 16 },
  { token: 'Button-Large', group: 'Button', step: 'Large', size: 24, weight: 600, lh: 24 },

  /* Badge — the counter's digits. Its own style, not a Button step.
     11/12 sits between Button Extra Small (11/11) and the Button-Numbers
     ladder's rungs (10 / 12 / 16), so no existing token carries it: the lib
     was reading --Sm-Button-Numbers (10) and --Button-Small-Line-Height (14)
     and rendering a badge a pixel small on a leading four too loose.
     Face, weight and tracking still come from the Buttons/Small role, which is
     what the Figma style binds — only the size and leading are its own. */
  { token: 'Badge', group: 'Badge', step: 'Standard', size: 11, weight: 600, lh: 12 },
];

/** Order the exports and the Figma payload use. */
export const GROUP_ORDER = [
  'Display', 'Header', 'Subtitle', 'Body', 'Caption',
  'Label', 'Legal', 'Eyebrow', 'Number', 'Button', 'Badge',
];

/** Usage guidance per group. Travels into the Figma text-style description so
 *  the rule sits next to the style where a designer will actually meet it. */
export const GROUP_DESCRIPTIONS: Record<string, string> = {
  Display: 'Large and Medium belong in Header or Hero areas. Small is the one sized to sit inside a component — a card title, a stat, a pull quote.',
  Eyebrow: 'Eyebrow label — uppercase and tracked. Sits above a heading.',
};

// ─── Role resolution ─────────────────────────────────────────────────────────

export interface ResolvedRole {
  family: string;
  weight: number;
  /** Display only — the chosen Display-Large size in px. */
  size?: number;
  /** Display only — the chosen leading ratio for the Display ramp. */
  leading?: number;
  letterSpacing: string;
  textTransform: 'none' | 'uppercase';
  axes?: Record<string, number>;
  noise?: number;
  bounce?: number;
}

export type ResolvedRoles = Record<FamilyRole, ResolvedRole>;

const DEFAULT_WEIGHTS: Record<FamilyRole, number> = { header: 600, display: 600, eyebrow: 600, body: 400 };

/** Which picker each face reads. Display is the user's Decorative choice;
 *  Eyebrow has no picker yet, so it borrows the Body face. */
const ROLE_SOURCE: Record<FamilyRole, TypographyStyle['type']> = {
  display: 'decorative',
  header: 'header',
  eyebrow: 'body',
  body: 'body',
};

/** Strip the style classification the matcher appends ("Fraunces, Serif") — the
 *  ramp only wants the family name. */
function extractFamily(family?: string): string {
  if (!family) return '';
  return family.includes(',') ? family.split(',')[0].trim() : family.trim();
}

export function resolveRoles(styles: TypographyStyle[] | undefined | null): ResolvedRoles {
  const pick = (role: FamilyRole): ResolvedRole => {
    const s = (styles || []).find((t) => t.type === ROLE_SOURCE[role]);
    const weight = parseInt(String(s?.weight ?? ''), 10);
    return {
      family: extractFamily(s?.family) || 'Open Sans',
      weight: Number.isFinite(weight) ? weight : DEFAULT_WEIGHTS[role],
      letterSpacing: s?.letterSpacing || '0em',
      textTransform: s?.allCaps ? 'uppercase' : 'none',
      axes: s?.axes,
      size: s?.displaySize,
      leading: s?.displayLeading,
      noise: s?.noise ?? 0,
      bounce: s?.bounce ?? 0,
    };
  };

  const header = pick('header');
  // The Header face is never a picked family — it is always Google Sans Flex,
  // and its character comes from the axes so it can be set AGAINST the Display
  // rather than echoing it. A design saved before this (or one whose axes never
  // got computed) still resolves: it falls back to the neutral Modern setting.
  header.family = HEADER_FAMILY;
  if (header.axes) {
    // Weight is the wght axis, so the two can never disagree.
    header.weight = header.axes.wght ?? header.weight;
  } else {
    // No axes recorded — the Figma payload rebuilds roles from tokens.json,
    // which carries a weight but not the axis set. Synthesise the neutral
    // setting for the variation string, but seed wght from the weight the
    // design actually states: overwriting it with Modern's 520 shipped every
    // header at the default weight instead of the one on the slider.
    header.axes = { ...moodToAxes('Modern'), wght: header.weight };
  }

  const eyebrow = pick('eyebrow');
  // The eyebrow is a system stack, not a chosen face — a plain UI label in
  // whatever the reader's OS uses. FACE_SOURCE emits the stack; this family is
  // only what the Figma payload substitutes.
  eyebrow.family = EYEBROW_FIGMA_FAMILY;

  return { display: pick('display'), header, eyebrow, body: pick('body') };
}

// ─── Build ───────────────────────────────────────────────────────────────────

/** px → em against a font size, trimmed to 4 decimals. */
const pxToEm = (px: number | undefined, size: number): string =>
  px ? `${+(px / size).toFixed(4)}em` : '0em';

/* ── Header tracking follows optical size ─────────────────────────────────
 *
 * The header ramp spans H1 to H6 — 48px down to 18px by default, a 2.7x range
 * — and every step used to take ONE letter-spacing value, the user's pick,
 * applied flat. There is no number that is right at both ends of that range.
 * Type tightens as it grows: a value tuned at 18px reads visibly loose at
 * 48px, and one tuned at 48px looks cramped at 18px.
 *
 * So the user's value becomes an ANCHOR rather than the answer, and each step
 * takes a delta off it. Their choice still decides the character of the
 * tracking; the size decides how much of it each step gets.
 *
 * ── Why the anchor is the SMALLEST header ─────────────────────────────────
 *
 * Anchoring at H6 means "this is my tracking at small header sizes" and
 * everything larger tightens from there. Anchoring at H1 would make their
 * value describe the display end and loosen the small ones — worse, because a
 * wrong value costs more readability at 18px than at 48px.
 *
 * H6 is where the SIZE delta is zero, not where the output equals the input.
 * The face adjustment below applies at every step including this one, because
 * it is about the face and not about the size: a Bold H6 wants different
 * tracking from a Thin H6, and exempting one step would make that step the
 * only one ignoring the weight. So the anchor is the baseline the two deltas
 * are measured from, not a value that survives to the stylesheet verbatim.
 *
 * ── Derived from the SIZE, not from the token ─────────────────────────────
 *
 * A table keyed by H1..H6 would be simpler and would quietly stop being right
 * the moment the scale moves — H1_SIZE is configurable, and the Display ramp
 * hands off to it. Keying on the actual size means the curve follows the
 * scale wherever the user puts it.
 */

/** The step the user's own value lands on, unmodified: H6's size. */
export const HEADER_TRACKING_ANCHOR_PX = 18;

/* em of tightening per px of size above the anchor.
   1/1500 puts H1 at -0.02em when H1 is 48 — about -1px. Enough to take the
   looseness off a large heading, not so much that a face which never needed
   it looks mannered. */
const MIXED_CASE_RATE = 1 / 1500;

/* All-caps barely moves, and this is the conditional that matters most.
   Capitals are uniform in width and have no descenders, so they read CRAMPED
   at the tracking that suits mixed case — they want air, at every size. The
   optical-size effect is real for caps too but much weaker, so the curve
   flattens to a tenth rather than inverting. A caps ramp that tightened like
   mixed case would undo the one thing caps actually need. */
const CAPS_RATE = 1 / 15000;

/* ── The face's own axes shift the curve ──────────────────────────────────
 *
 * The Header is always Google Sans Flex and its character comes from the
 * axes, so "which face did the user pick" is really "where are wght, wdth and
 * GRAD set". All three change how much air a line needs, and the direction is
 * worth stating because it is the opposite of the usual shorthand about
 * tightening bold headlines — that advice is about SIZE, which the curve above
 * already handles.
 *
 * WEIGHT. Picture "AV" at 48px in Thin and in Black. In Black the stems are
 * thick and the letters nearly touch: pull them further together and they
 * collide. In Thin the stems are hairlines and the gap yawns: it wants
 * closing. So HEAVIER asks for MORE tracking and LIGHTER for less — the
 * sidebearings are drawn for the middle of the range and the stroke eats into
 * them as weight climbs. Across the moods that is Elegant at 250 against Bold
 * at 800, which is most of the axis.
 *
 * WIDTH. A condensed face has narrower letterforms AND proportionally tighter
 * sidebearings, so it crowds sooner. Tech sits at 72 — well below the 100
 * default and the most condensed setting any mood uses — and wants the air
 * back. Expanded needs slightly less.
 *
 * GRADE. Grade thickens the stems WITHOUT changing the advance width, which is
 * the whole point of the axis. So unlike weight, nothing compensates: the ink
 * grows and the gap shrinks by exactly that much. Per unit it therefore counts
 * for more than weight does, and Bold's GRAD of 80 is the largest in the
 * table.
 *
 * The three together stay deliberately smaller than the size curve — roughly
 * half its magnitude at the extremes — so size still leads and the face
 * adjusts. These are heuristics with a defensible direction, not measured
 * values, and they are meant to be looked at.
 */
const WEIGHT_REF = 400;
const WEIGHT_RATE = 1 / 60000;   // Bold's 800 -> +0.0067em; Elegant's 250 -> -0.0025em
const WIDTH_REF = 100;
const WIDTH_RATE = 1 / 12000;    // Tech's 72 -> +0.0023em
const GRADE_RATE = 1 / 25000;    // Bold's 80 -> +0.0032em

/** How far the face's own settings move the tracking, in em. */
export function faceTrackingDelta(axes?: Record<string, number>): number {
  if (!axes) return 0;
  const wght = axes.wght ?? WEIGHT_REF;
  const wdth = axes.wdth ?? WIDTH_REF;
  const grad = axes.GRAD ?? 0;
  return (wght - WEIGHT_REF) * WEIGHT_RATE
       + (WIDTH_REF - wdth) * WIDTH_RATE
       + grad * GRADE_RATE;
}

/* Guard rails, in em. Not opinions about good tracking — just a floor and a
   ceiling so a pathological anchor cannot produce unreadable type at the far
   end of the ramp. */
const TRACKING_MIN_EM = -0.05;
const TRACKING_MAX_EM = 0.2;

export interface TrackingContext {
  /** roles.<role>.textTransform === 'uppercase' */
  caps: boolean;
  /**
   * The face's `opsz` axis VARIES WITH THE RENDERED SIZE.
   *
   * Not "the face has an opsz axis" — that was the first version of this flag
   * and it was wrong in a way that made the whole function a no-op. An
   * optical-size axis only compensates when its value follows the size it is
   * set at. The header role pins ONE opsz for the whole ramp (moodToAxes
   * supplies 72 and every step inherits it), so across 48px down to 18px the
   * font is held at a single optical size and compensates for nothing.
   *
   * Every header therefore passes `false` today. The flag stays because the
   * real fix is to emit `opsz` per step — that is what the axis is for — and
   * on the day that happens this tracking curve must back off or the two
   * corrections stack.
   */
  opszTracksSize: boolean;
  /**
   * The face's variable axes. For the Header this is always Google Sans Flex's
   * set, where the user's pick lives — the family is fixed, so wght / wdth /
   * GRAD are what "which face" actually means here.
   */
  axes?: Record<string, number>;
}

/** Split "0.02em" / "1.25px" / "0" into a number and its unit. */
function parseTracking(value: string): { n: number; unit: 'em' | 'px' } {
  const m = String(value ?? '').trim().match(/^(-?[\d.]+)\s*(em|px)?$/);
  if (!m) return { n: 0, unit: 'em' };
  return { n: parseFloat(m[1]) || 0, unit: (m[2] as 'em' | 'px') || 'em' };
}

/**
 * The user's tracking, adjusted for one header size.
 *
 * Returns the value in the SAME UNIT it arrived in. That is deliberate: em is
 * the better unit for tracking and px is what the current export emits, and
 * quietly switching the unit would change every brand's stylesheet shape on
 * top of changing the number. One change at a time.
 *
 * Note what a flat PX value means in the first place — 1.25px is 0.069em at
 * 18px and 0.026em at 48px. So a px anchor applied flat is ALREADY
 * size-dependent, in the right direction but by an accident of the unit and
 * by far too much. Converting through em is what makes the curve deliberate.
 */
export function suggestedHeaderTracking(
  anchor: string,
  size: number,
  ctx: TrackingContext,
): string {
  const { n, unit } = parseTracking(anchor);

  /* A face whose opsz FOLLOWS the size is already tightening itself as it
     scales. Adding this on top double-corrects and the large end comes out
     too tight — the one case where doing nothing is the correct answer. */
  if (ctx.opszTracksSize) return anchor;

  const anchorEm = unit === 'px' ? n / HEADER_TRACKING_ANCHOR_PX : n;
  const rate = ctx.caps ? CAPS_RATE : MIXED_CASE_RATE;
  const em = Math.min(TRACKING_MAX_EM, Math.max(TRACKING_MIN_EM,
    anchorEm
      - (size - HEADER_TRACKING_ANCHOR_PX) * rate
      + faceTrackingDelta(ctx.axes)));

  return unit === 'px'
    ? `${+(em * size).toFixed(3)}px`
    : `${+em.toFixed(4)}em`;
}

/**
 * Build the full scale from the chosen faces.
 *
 * Face mapping (differs from the pre-omni studio ramp on two points):
 *   Display  → the DISPLAY face, which is the user's Decorative pick. It used
 *              to follow Header, which left the expressive face with nowhere
 *              to appear at size.
 *   Eyebrow  → the EYEBROW face and spec (12/13/15, uppercase,
 *              tracked). It used to be the decorative face at 14/16/18.
 */
export function buildTypeScale(styles: TypographyStyle[] | undefined | null): TypeStyle[] {
  const roles = resolveRoles(styles);
  const out: TypeStyle[] = [];

  const push = (s: Omit<TypeStyle, 'description'> & { description?: string }) => {
    out.push({ ...s, description: s.description ?? GROUP_DESCRIPTIONS[s.group] ?? '' });
  };

  // No stored leading is passed: it is calculated per step from the size now.
  for (const step of displaySteps(roles.display.size ?? DEFAULT_DISPLAY_SIZE)) {
    push({
      token: step.token, name: `Display/${step.step}`, group: 'Display', step: step.step,
      familyRole: 'display', weightFromFace: true,
      size: step.size, weight: roles.display.weight, lineHeight: step.lineHeight,
      letterSpacing: roles.display.letterSpacing,
      textTransform: roles.display.textTransform,
      paragraphSpacing: 0,
      axes: roles.display.axes,
      noise: roles.display.noise || 0,
      bounce: roles.display.bounce || 0,
    });
  }

  for (const step of HEADER_STEPS) {
    push({
      token: step.token, name: `Header/${step.step}`, group: 'Header', step: step.step,
      familyRole: 'header', weightFromFace: true,
      ...(CLAMPED_HEADER_STEPS.includes(step.token)
        ? { weightVar: 'Header-Clamped-Weight' }
        : {}),
      size: step.size, weight: roles.header.weight, lineHeight: step.lineHeight,
      /* The user's value is the ANCHOR at H6, not a flat answer for all six —
         see suggestedHeaderTracking. Type tightens as it grows, and one value
         across a 48-to-18 ramp is wrong at whichever end it was not tuned
         for. Caps flatten the curve rather than inverting it, and a face with
         an opsz axis is left alone because it is already compensating. */
      letterSpacing: suggestedHeaderTracking(roles.header.letterSpacing, step.size, {
        caps: roles.header.textTransform === 'uppercase',
        /* FALSE on purpose, even though the header face always has an opsz
           axis. The axis is pinned to one value for the whole role, so it is
           not tracking the size and is compensating for nothing — see
           TrackingContext. Reading `axes.opsz !== undefined` here made this
           function a no-op for every brand, which is how it was written
           first. */
        opszTracksSize: false,
        /* Google Sans Flex's settings — where the user's header choice
           actually lives, since the family is fixed and the mood moves the
           axes. */
        axes: roles.header.axes,
      }),
      textTransform: roles.header.textTransform,
      paragraphSpacing: 0,
      axes: roles.header.axes,
    });
  }

  // Subtitle mirrors Body exactly, at bold.
  for (const size of BODY_SIZES) {
    push({
      token: `Subtitle-${size.step}`, name: `Subtitle/${size.step}`,
      group: 'Subtitle', step: size.step,
      familyRole: 'body',
      size: size.size, weight: SUBTITLE_WEIGHT,
      lineHeight: Math.round(size.size * BODY_LINE_HEIGHT * 100) / 100,
      letterSpacing: '0em', textTransform: 'none', paragraphSpacing: 0,
      axes: roles.body.axes,
    });
  }

  for (const size of BODY_SIZES) {
    push({
      token: size.token, name: `Body/${size.step}`, group: 'Body', step: size.step,
      familyRole: 'body', weightFromFace: true,
      size: size.size, weight: roles.body.weight,
      lineHeight: Math.round(size.size * BODY_LINE_HEIGHT * 100) / 100,
      letterSpacing: '0em', textTransform: 'none', paragraphSpacing: 0,
      extraWeights: BODY_EXTRA_WEIGHTS,
      axes: roles.body.axes,
    });
  }

  for (const step of EYEBROW_STEPS) {
    push({
      token: step.token, name: `Eyebrow/${step.step}`, group: 'Eyebrow', step: step.step,
      familyRole: 'eyebrow',
      size: step.size, weight: EYEBROW_WEIGHT,
      lineHeight: Math.round(step.size * EYEBROW_LINE_HEIGHT * 100) / 100,
      letterSpacing: step.letterSpacing, textTransform: 'uppercase', paragraphSpacing: 0,
      axes: roles.eyebrow.axes,
    });
  }

  for (const s of SYSTEM_STYLES) {
    push({
      token: s.token, name: `${s.group}/${s.step}`, group: s.group, step: s.step,
      familyRole: 'body',
      size: s.size, weight: s.weight, lineHeight: s.lh,
      letterSpacing: pxToEm(s.cs, s.size),
      textTransform: s.uppercase ? 'uppercase' : 'none',
      paragraphSpacing: s.ps || 0,
      extraWeights: s.extraWeights,
      axes: roles.body.axes,
    });
  }

  return out;
}

// ─── Variable-font axes ──────────────────────────────────────────────────────

/** The axes that belong in font-variation-settings. wght is left out: it is
 *  already carried by font-weight, and declaring it twice lets the two
 *  disagree. */
export function variationAxes(axes?: Record<string, number>): [string, number][] {
  if (!axes) return [];
  return Object.entries(axes).filter(([tag]) => tag !== 'wght');
}

/**
 * Axes → a font-variation-settings value built out of the per-axis variables,
 * e.g. `"wdth" var(--Font-Width-Header), "opsz" var(--Font-Optical-Size-Header)`.
 * Nudging one axis then means setting one variable, not restating the whole
 * string — which is the point of having the variables at all.
 */
export function axesToCss(axes: Record<string, number> | undefined, face: FamilyRole): string {
  return variationAxes(axes)
    .map(([tag]) => `"${tag}" var(--${axisToken(tag, face)})`)
    .join(', ');
}

// ─── Display noise / bounce ──────────────────────────────────────────────────

export const NOISE_FILTER_ID = 'dino-display-noise';

/** 0–100 grain amount → SVG turbulence parameters. */
export const noiseParams = (noise: number) => ({
  scale: +(noise * 0.06).toFixed(2),
  baseFrequency: +(0.5 + noise * 0.006).toFixed(3),
});

/**
 * Fixed per-character offsets for hand-lettering bounce. Deterministic, not
 * random, so the lettering looks the same on every load and the exported CSS
 * matches what the studio previewed.
 */
export function bounceChars(count: number, amount: number) {
  const a = Math.max(0, Math.min(100, amount)) / 100;
  const chars = [];
  for (let i = 0; i < count; i++) {
    // Two out-of-phase sines so the rise and fall never reads as a wave.
    const wave = Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.9 + 1.3) * 0.4;
    chars.push({
      dy: +(wave * 0.06 * a).toFixed(4),
      rot: +(wave * 4 * a).toFixed(2),
      scale: +(1 + Math.cos(i * 1.3) * 0.04 * a).toFixed(3),
    });
  }
  return chars;
}
