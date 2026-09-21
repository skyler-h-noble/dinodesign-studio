// altDisplay.ts — what makes the Alt Display style different from Display.
//
// A gradient when Primary and Secondary are analogous, solid Secondary when
// they are not. The rule is not decoration: a gradient across two hues that sit
// far apart on the wheel reads as two different words rather than one phrase,
// and it passes through the low-chroma middle where both ends lose contrast at
// once. Neighbours blend; opposites collide.

import chroma from 'chroma-js';

/**
 * How far apart two hues may sit and still count as analogous, in degrees.
 *
 * 60 is the conventional span of an analogous set — adjacent positions on a
 * twelve-spoke wheel, which is what "analogous" names in every colour-theory
 * text the rest of this codebase follows (see colorSchemes.ts, which builds an
 * Analogous scheme from a base plus its two nearest neighbours).
 *
 * Stated once so the CSS and any future Figma emission answer the same
 * question. A threshold that lives in two places is a threshold that will
 * eventually disagree with itself on a palette near the boundary.
 */
export const ANALOGOUS_MAX_HUE_DELTA = 60;

/** Shortest distance between two hues on the wheel, 0-180 degrees. */
export function hueDelta(a: string, b: string): number {
  const [, , h1] = chroma(a).lch();
  const [, , h2] = chroma(b).lch();
  /* NaN hue is what chroma returns for a true grey — it has no direction on the
     wheel. Treat it as maximally distant rather than as 0: a grey Secondary
     gradient-blended into a coloured Primary looks like a rendering fault, and
     0 would be the one answer that turns the gradient ON. */
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 180;
  const raw = Math.abs(h1 - h2) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Are these two close enough on the wheel to blend rather than collide? */
export function isAnalogous(a: string, b: string): boolean {
  return hueDelta(a, b) <= ANALOGOUS_MAX_HUE_DELTA;
}

export interface AltDisplayGradient {
  /**
   * 'duo'  — Text-Primary to Text-Secondary. Two hues near enough to blend.
   * 'mono' — Text-Primary to a lighter or darker shade of ITSELF, chosen
   *          against the background. One hue, so it cannot collide.
   */
  kind: 'duo' | 'mono';
  /** The hue distance the decision was made on, for reporting. */
  delta: number;
}

/**
 * Which GRADIENT the Alt Display gets. Not whether it gets one.
 *
 * Every brand can have a gradient — the analogous test only decides which
 * kind. Denying the treatment to the roughly half of palettes whose Primary
 * and Secondary sit far apart would make the feature a lottery; a same-hue
 * ramp gives those brands the same affordance without the collision.
 *
 * Solid Text-Secondary is the sibling VARIANT, not the failure case: the
 * designer picks between them. Two values are fine when something selects
 * between them — that is the whole of invariant 2 — and here the selector is
 * a person.
 *
 * An unanswerable palette lands on 'mono' because that is the treatment that
 * needs only ONE hue to be known.
 */
export function altDisplayGradient(primary?: string, secondary?: string): AltDisplayGradient {
  if (!primary || !secondary) return { kind: 'mono', delta: NaN };
  let delta: number;
  try {
    delta = hueDelta(primary, secondary);
  } catch {
    return { kind: 'mono', delta: NaN };   // not a colour chroma can parse
  }
  return { kind: delta <= ANALOGOUS_MAX_HUE_DELTA ? 'duo' : 'mono', delta };
}

/**
 * How far below the Display's weight the Alt aims.
 *
 * Large enough to read as a different voice rather than a rendering
 * inconsistency. Two adjacent Google weights (400 to 500) is a difference only
 * a designer looking for it would see; 300 clears three rungs.
 */
export const ALT_DISPLAY_WEIGHT_DROP = 300;

/** The lightest weight the Alt will drop to, so it stays legible at size. */
export const ALT_DISPLAY_MIN_WEIGHT = 200;

/**
 * The Alt's weight — a lighter weight of the SAME family, or undefined.
 *
 * Undefined is the common answer, and that is the point of returning it rather
 * than a number: 56% of the curated display pool ships exactly one weight
 * (Anton, Bangers, Lobster, Great Vibes, Alfa Slab One are all [400]), because
 * display faces usually do. Inventing 400 for a family that ships only 700
 * gets a synthesised thin on the web and a font Figma will not load.
 *
 * So weight is an ENHANCEMENT, not the distinction. Colour is what separates
 * the Alt on every brand; this sharpens it on the 44% that can carry it.
 *
 * `shipped` is the family's own weight list, from googleFontWeights.json —
 * which ships locally, so this is answerable at generation time without a warm
 * font-API cache. That is one reason weight works here and italic does not.
 *
 * The other reason is that italic is not a fallback for this case. Measured
 * against Google's own font metadata, of the 71 single-weight faces in the
 * curated display pool, ZERO ship an italic — while 67% of the multi-weight
 * faces do. The two arrive together: a family with one usually has the other,
 * and the display faces that have neither (Anton, Bangers, Lobster, Great
 * Vibes, Alfa Slab One, every script) have neither. So italic would add
 * nothing precisely where weight runs out, which is why colour carries the
 * distinction and this only sharpens it.
 */
export function altDisplayWeight(
  displayWeight: number,
  shipped: number[] | undefined,
): number | undefined {
  if (!shipped?.length) return undefined;
  const target = displayWeight - ALT_DISPLAY_WEIGHT_DROP;
  /* Only weights the family actually ships, strictly lighter than the Display's
     own, and not so light they disappear at display size. */
  const candidates = shipped
    .filter((w) => w < displayWeight && w >= ALT_DISPLAY_MIN_WEIGHT)
    .sort((a, b) => a - b);
  if (!candidates.length) return undefined;
  /* Nearest to the target. Ties go to the LIGHTER one: the whole purpose is to
     be visibly different, and the lighter of two equals is more different. */
  return candidates.reduce((best, w) =>
    Math.abs(w - target) < Math.abs(best - target) ? w : best, candidates[0]);
}
