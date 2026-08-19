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
//   Overline  Small, Medium, Large    → the eyebrow spec: uppercase, tracked
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
// --Header-H1-Font-Size) so @dynodesign/components keeps resolving them
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
   *  'Overline-Small', 'Button-Standard'. */
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

export function displayLineHeight(size: number, leading = DISPLAY_LEADING): number {
  return Math.ceil((size * leading) / 4) * 4;
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
export function displaySteps(largeSize = DEFAULT_DISPLAY_SIZE, leading = DISPLAY_LEADING) {
  const large = Math.max(16, evenRound(largeSize));
  const small = Math.min(H1_SIZE, large);
  const medium = Math.min(large, Math.max(small, evenRound((large + small) / 2)));
  const sizes = { large, medium, small };
  return (['large', 'medium', 'small'] as const).map((key) => ({
    ...DISPLAY_STEP_TOKENS[key],
    size: sizes[key],
    lineHeight: displayLineHeight(sizes[key], leading),
  }));
}

/** The default ramp, for callers that don't have a design in hand. */
export const DISPLAY_STEPS = displaySteps();

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

/** Overline is omni's Eyebrow role: small utility labels, uppercase, tracked
 *  out, 1.5 leading. Smaller sizes get MORE tracking — the standard optical
 *  correction. Weight is fixed at 600; an eyebrow reads as a label, not as
 *  body copy, and it is too small for the body role's weight to carry it. */
export const OVERLINE_STEPS = [
  { token: 'Overline-Small', step: 'Small', size: 12, letterSpacing: '0.12em' },
  { token: 'Overline-Medium', step: 'Medium', size: 13, letterSpacing: '0.1em' },
  { token: 'Overline-Large', step: 'Large', size: 15, letterSpacing: '0.08em' },
];

export const OVERLINE_LINE_HEIGHT = 1.5;
export const OVERLINE_WEIGHT = 600;

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
];

/** Order the exports and the Figma payload use. */
export const GROUP_ORDER = [
  'Display', 'Header', 'Subtitle', 'Body', 'Caption',
  'Label', 'Legal', 'Overline', 'Number', 'Button',
];

/** Usage guidance per group. Travels into the Figma text-style description so
 *  the rule sits next to the style where a designer will actually meet it. */
export const GROUP_DESCRIPTIONS: Record<string, string> = {
  Display: 'Large and Medium belong in Header or Hero areas. Small is the one sized to sit inside a component — a card title, a stat, a pull quote.',
  Overline: 'Eyebrow label — uppercase and tracked. Sits above a heading.',
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

/**
 * Build the full scale from the chosen faces.
 *
 * Face mapping (differs from the pre-omni studio ramp on two points):
 *   Display  → the DISPLAY face, which is the user's Decorative pick. It used
 *              to follow Header, which left the expressive face with nowhere
 *              to appear at size.
 *   Overline → the EYEBROW face and the eyebrow spec (12/13/15, uppercase,
 *              tracked). It used to be the decorative face at 14/16/18.
 */
export function buildTypeScale(styles: TypographyStyle[] | undefined | null): TypeStyle[] {
  const roles = resolveRoles(styles);
  const out: TypeStyle[] = [];

  const push = (s: Omit<TypeStyle, 'description'> & { description?: string }) => {
    out.push({ ...s, description: s.description ?? GROUP_DESCRIPTIONS[s.group] ?? '' });
  };

  for (const step of displaySteps(roles.display.size ?? DEFAULT_DISPLAY_SIZE, roles.display.leading ?? DISPLAY_LEADING)) {
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
      size: step.size, weight: roles.header.weight, lineHeight: step.lineHeight,
      letterSpacing: roles.header.letterSpacing,
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

  for (const step of OVERLINE_STEPS) {
    push({
      token: step.token, name: `Overline/${step.step}`, group: 'Overline', step: step.step,
      familyRole: 'eyebrow',
      size: step.size, weight: OVERLINE_WEIGHT,
      lineHeight: Math.round(step.size * OVERLINE_LINE_HEIGHT * 100) / 100,
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
