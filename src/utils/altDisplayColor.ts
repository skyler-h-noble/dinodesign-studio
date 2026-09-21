// altDisplayColor.ts — how the Alt Display style is coloured.
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

export interface AltDisplayColor {
  /** 'gradient' when Primary and Secondary are analogous, else 'solid'. */
  kind: 'gradient' | 'solid';
  /** The hue distance the decision was made on, for reporting. */
  delta: number;
}

/**
 * The colour treatment for the Alt Display style.
 *
 * Returns 'solid' whenever the decision cannot be made — a missing palette is
 * not evidence of a near hue, and the solid is the safe answer: it is a plain
 * colour with a known contrast, where a gradient's contrast varies along the
 * text and has to be checked at both ends.
 */
export function altDisplayColor(primary?: string, secondary?: string): AltDisplayColor {
  if (!primary || !secondary) return { kind: 'solid', delta: NaN };
  let delta: number;
  try {
    delta = hueDelta(primary, secondary);
  } catch {
    return { kind: 'solid', delta: NaN };   // not a colour chroma can parse
  }
  return { kind: delta <= ANALOGOUS_MAX_HUE_DELTA ? 'gradient' : 'solid', delta };
}
