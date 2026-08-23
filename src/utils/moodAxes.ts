// moodAxes.ts — mood → Google Sans Flex axes for the Header face, tuned to
// complement the Display. Ported from omni-type-studio's src/lib/robotoFlex.js
// (named for the font it used to use; Roboto Flex has no roundness axis).
//
// The Header is never a picked family. It is always Google Sans Flex, and its
// character comes from the axes — which is what lets it be set AGAINST the
// Display instead of echoing it.

import type { TypographyStyle } from '../types';

export const HEADER_FAMILY = 'Google Sans Flex';

export interface AxisSpec {
  min: number;
  max: number;
  def: number;
  label: string;
}

/** The six real axes, with the ranges Google Sans Flex actually ships. */
export const AXES: Record<string, AxisSpec> = {
  wght: { min: 1, max: 1000, def: 400, label: 'Weight' },
  wdth: { min: 25, max: 151, def: 100, label: 'Width' },
  opsz: { min: 6, max: 144, def: 18, label: 'Optical size' },
  slnt: { min: -10, max: 0, def: 0, label: 'Slant' },
  GRAD: { min: 0, max: 100, def: 0, label: 'Grade' },
  ROND: { min: 0, max: 100, def: 0, label: 'Roundness' },
};

export type AxisValues = Record<string, number>;

export type DisplayWeight = 'thin' | 'regular' | 'heavy';
export type DisplayBranch = 'serif' | 'sans' | 'script' | 'hand';

/**
 * Mood → axes. The Header is ALWAYS a sans — the handwriting and script live in
 * the Display role only. So the mood has to be carried by the axes rather than
 * by picking an expressive face: Elegant becomes thin and wide-set,
 * Playful/Creative becomes fully rounded, Tech becomes condensed and squared.
 */
export const MOOD_AXES: Record<string, AxisValues> = {
  //                     wght       wdth      opsz      slnt     GRAD      ROND       feeling
  Bold: { wght: 800, wdth: 104, opsz: 144, slnt: 0, GRAD: 80, ROND: 0 },        // impact, shout
  Elegant: { wght: 250, wdth: 108, opsz: 144, slnt: 0, GRAD: 0, ROND: 0 },      // thin, airy, refined
  Modern: { wght: 520, wdth: 100, opsz: 72, slnt: 0, GRAD: 0, ROND: 8 },        // clean, neutral
  Playful: { wght: 620, wdth: 108, opsz: 120, slnt: 0, GRAD: 40, ROND: 100 },   // creative, rounded
  Calm: { wght: 380, wdth: 104, opsz: 60, slnt: 0, GRAD: 0, ROND: 60 },         // soft, quiet
  Warm: { wght: 480, wdth: 106, opsz: 72, slnt: 0, GRAD: 10, ROND: 75 },        // friendly, human
  Vintage: { wght: 560, wdth: 96, opsz: 120, slnt: -4, GRAD: 30, ROND: 15 },    // set, characterful
  Tech: { wght: 640, wdth: 72, opsz: 96, slnt: 0, GRAD: 50, ROND: 0 },          // condensed, engineered
  Professional: { wght: 560, wdth: 100, opsz: 48, slnt: 0, GRAD: 0, ROND: 0 },  // stable, objective
};

export const MOODS = Object.keys(MOOD_AXES);

/**
 * The studio's mood vocabulary is wider than the nine the axes are defined for
 * — the moodboard classifier and the older colour-derived moods both feed in.
 * Anything unrecognised lands on Modern, which is the neutral setting.
 */
/**
 * matchMood()'s fourteen snake_case keys → the axis vocabulary.
 *
 * NONE of them matched before this: every one fell through to 'Modern', so
 * every design system got byte-identical Google Sans Flex axes no matter what
 * its board looked like. The mood was computed, scored and thresholded — then
 * discarded at the last step.
 *
 * Second time this shape appeared: moodKeyFor() collapsed the same fourteen
 * keys to a single font pool. A catch-all default hides a vocabulary mismatch,
 * because the fallback is a real value that renders.
 *
 * Exported so moodAxes.test.ts can assert it stays exhaustive over the server's
 * keys. 'Modern' is a legitimate destination, so coverage cannot be tested by
 * comparing against the default — it has to be tested against this table.
 */
export const SERVER_AXIS_MOOD: Record<string, string> = {
  whimsical_playful: 'Playful',
  neon_cyberpunk: 'Tech',
  warm_retro_vintage: 'Vintage',
  boho_festival: 'Warm',
  industrial_urban: 'Bold',
  dark_romance_gothic: 'Elegant',
  soft_romantic: 'Elegant',
  luxury_editorial_black: 'Elegant',
  modern_luxury_fashion: 'Elegant',
  old_money: 'Professional',
  clean_tech: 'Tech',
  editorial_modern: 'Modern',
  minimal_scandinavian: 'Modern',
  natural_organic: 'Calm',
  bright_cheerful: 'Warm',
  candy_pastel: 'Playful',
  kids_primary: 'Playful',
  high_energy: 'Bold',
  bold_graphic: 'Bold',
  sport_dynamic: 'Tech',
};

const MOOD_ALIASES: Record<string, string> = {
  // colour-derived moods (TypographyStage v1)
  business: 'Professional', security: 'Professional', timeless: 'Professional',
  formal: 'Professional', determined: 'Professional', ambitious: 'Professional',
  healthy: 'Calm', balanced: 'Calm', pensive: 'Calm', quiet: 'Calm',
  friendly: 'Warm', happy: 'Warm', giddy: 'Warm', spirited: 'Warm',
  cute: 'Playful', active: 'Bold', energetic: 'Bold', loud: 'Bold',
  rebellious: 'Bold', passionate: 'Bold', sassy: 'Bold',
  sophisticated: 'Elegant', wealth: 'Elegant', romantic: 'Elegant',
  feminine: 'Elegant', delicate: 'Elegant', charming: 'Elegant', proud: 'Elegant',
  nostalgic: 'Vintage', retro: 'Vintage', heritage: 'Vintage',
  minimal: 'Modern', clean: 'Modern', bright: 'Professional',
  technical: 'Tech', futuristic: 'Tech', digital: 'Tech',

  ...SERVER_AXIS_MOOD,
};

/** Any mood string → one of the nine the axes are defined for. */
export function normalizeMood(mood?: string | null): string {
  if (!mood) return 'Modern';
  const raw = String(mood).replace(/-\d+$/, '').trim();
  const exact = MOODS.find((m) => m.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const hit = MOOD_ALIASES[raw.toLowerCase()];
  if (hit) return hit;
  // Same silent catch-all as moodKeyFor had: all fourteen server moods landed
  // here, so every design system ever generated got identical Google Sans Flex
  // axes. Nothing failed — 'Modern' is a real setting that renders.
  if (raw && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[mood] no axis mapping for "${raw}" — falling back to Modern. ` +
      'Add it to SERVER_AXIS_MOOD in utils/moodAxes.ts.',
    );
  }
  return 'Modern';
}

/** The studio's Branch labels → the branch names the axis rules read. */
export function normalizeBranch(branch?: string | null, category?: string | null): DisplayBranch | undefined {
  const b = (branch || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (/script|hand|brush|marker|calligra/.test(c)) return /hand|brush|marker/.test(c) ? 'hand' : 'script';
  if (b.includes('serif') && !b.includes('sans')) return 'serif';
  if (b.includes('sans')) return 'sans';
  if (b.includes('expressive')) return /hand|brush|marker/.test(c) ? 'hand' : 'script';
  return undefined;
}

export interface PaletteStats {
  /** 0–1 */
  saturation: number;
  contrast: number;
  warmth: number;
  lightness: number;
}

export interface AxisOptions {
  /** The weight MEASURED off the sampled lettering — what the Header is set against. */
  displayWeight?: DisplayWeight;
  /** Texture rather than weight: how much detail the Display already carries. */
  displayBranch?: DisplayBranch;
  /** The full category, read for roundness. */
  displayCategory?: string;
  palette?: PaletteStats;
}

const clamp = (v: number, a: AxisSpec) => Math.round(Math.max(a.min, Math.min(a.max, v)));

/**
 * Header axes for a mood, set against the Display.
 *
 * The inversion is the point: the Display is the loud one by definition, so the
 * Header's job is to be the quiet one. Without this, a heavy condensed Display
 * paired with a Bold mood lands the Header near 800 too and the two roles read
 * as a single shouting voice.
 */
export function moodToAxes(mood = 'Modern', opts: AxisOptions = {}): AxisValues {
  const key = normalizeMood(mood);
  const base: AxisValues = { ...(MOOD_AXES[key] || MOOD_AXES.Modern) };
  const branch = opts.displayBranch;
  const dw = opts.displayWeight;

  // --- oppose the Display -----------------------------------------------
  // Weight is SET rather than nudged: a Bold mood and a heavy Display would
  // otherwise still land near 800, which is the pairing this exists to prevent.
  if (dw === 'heavy') {
    base.wght = Math.min(base.wght, 280);   // thin against heavy
    base.wdth = Math.max(base.wdth, 106);   // and given room to breathe
    base.GRAD = Math.min(base.GRAD, 10);
  } else if (dw === 'thin') {
    base.wght = Math.max(base.wght, 620);   // weighted against a light Display
    base.wdth = Math.min(base.wdth, 98);
  }

  // Roundness inverts too — a rounded Display gets a squared Header.
  if (/Rounded|Soft/i.test(opts.displayCategory || '')) base.ROND = 0;

  // --- texture, from the branch -----------------------------------------
  if (branch === 'serif') {
    // A serif Display already carries the detail; keep the Header flatter.
    base.GRAD -= 20;
  } else if (branch === 'sans' && dw !== 'heavy' && dw !== 'thin') {
    // Sans against sans with nothing measured to invert — separate them on
    // width instead, the only axis left that won't make them louder.
    base.wdth += 6;
  } else if (branch === 'script' || branch === 'hand') {
    // The Display is doing the expressive work. The Header must NOT echo it —
    // it stays an unmistakably plain sans and gets out of the way.
    base.wght = Math.min(base.wght, 300);
    base.slnt = 0;
  }

  // --- let the palette tune it ------------------------------------------
  const p = opts.palette;
  if (p) {
    // Washed-out, low-contrast imagery reads delicate; vivid high-contrast
    // imagery can carry more weight without feeling heavy.
    if (p.saturation < 0.25 && p.contrast < 0.5) base.wght = Math.max(200, base.wght - 60);
    else if (p.saturation > 0.55 && p.contrast > 0.6) base.wght = Math.min(1000, base.wght + 80);

    // Warm palettes soften; cool/desaturated ones stay crisp.
    if (p.warmth > 0.5) base.ROND = Math.min(100, base.ROND + 25);
    else if (p.warmth < 0.15 && p.saturation > 0.4) base.ROND = Math.max(0, base.ROND - 15);

    // Dark, dense images want a touch more grade so type holds up on them.
    if (p.lightness < 0.35) base.GRAD += 25;
  }

  // The palette must not undo the inversion — a vivid red-on-black image would
  // otherwise walk a deliberately thin Header back up toward its Display.
  if (dw === 'heavy') base.wght = Math.min(base.wght, 320);
  else if (dw === 'thin') base.wght = Math.max(base.wght, 560);

  const out: AxisValues = {};
  for (const k of Object.keys(AXES)) out[k] = clamp(base[k] ?? AXES[k].def, AXES[k]);
  return out;
}

/**
 * Why the Header ended up where it did. Shown in the UI so the recommendation
 * is legible rather than magic.
 */
export function explainAxes(mood: string, opts: AxisOptions = {}): string {
  const notes = [`${normalizeMood(mood)} mood`];
  const branch = opts.displayBranch;
  const dw = opts.displayWeight;

  // Weight first — it's the loudest decision and the one being inverted.
  if (dw === 'heavy') notes.push('thin against the heavy Display');
  else if (dw === 'thin') notes.push('weighted against the light Display');

  if (branch === 'script' || branch === 'hand') notes.push('kept plain — the Display carries the lettering');
  else if (branch === 'serif') notes.push('flattened against the serif Display');
  else if (branch === 'sans' && !dw) notes.push('widened for contrast with the sans Display');
  if (/Rounded|Soft/i.test(opts.displayCategory || '')) notes.push('squared against a rounded Display');

  const p = opts.palette;
  if (p) {
    if (p.saturation < 0.25 && p.contrast < 0.5) notes.push('lighter for a muted palette');
    else if (p.saturation > 0.55 && p.contrast > 0.6) notes.push('heavier for a vivid palette');
    if (p.warmth > 0.5) notes.push('rounder for warm color');
    else if (p.warmth < 0.15 && p.saturation > 0.4) notes.push('squarer for cool color');
    if (p.lightness < 0.35) notes.push('graded up for a dark image');
  }
  return notes.join(' · ');
}

/**
 * The Header role as a TypographyStyle. Weight comes off the wght axis, so the
 * face's font-weight and its axis can never disagree.
 */
export function headerRoleFromAxes(axes: AxisValues, letterSpacing = '0em', allCaps = false): TypographyStyle {
  return {
    type: 'header',
    family: HEADER_FAMILY,
    weight: String(axes.wght ?? AXES.wght.def),
    letterSpacing,
    allCaps,
    axes,
  };
}

export interface HeaderPreset {
  label: string;
  group: string;
  axes: AxisValues;
}

/**
 * Header presets: the detected mood first, then the other eight. Every one is
 * still set against the Display, so switching mood re-runs the inversion rather
 * than dropping in a raw preset.
 */
export function headerPresets(mood: string, opts: AxisOptions = {}): HeaderPreset[] {
  const detected = normalizeMood(mood);
  const out: HeaderPreset[] = [
    { label: `${detected} (detected)`, group: 'From your image', axes: moodToAxes(detected, opts) },
  ];
  for (const m of MOODS) {
    if (m === detected) continue;
    out.push({ label: m, group: 'Other moods', axes: moodToAxes(m, opts) });
  }
  return out;
}

/** css2 param for the Header face, with every axis's full range requested. */
export function headerFontQueryParam(): string {
  const tags = ['GRAD', 'ROND', 'opsz', 'slnt', 'wdth', 'wght'];
  const ranges = tags.map((t) => `${AXES[t].min}..${AXES[t].max}`).join(',');
  return `family=${HEADER_FAMILY.replace(/\s+/g, '+')}:${tags.join(',')}@${ranges}`;
}
