/**
 * Icons on saturated mid-tone surfaces.
 *
 * The fixed icon table puts tone 5 on every light surface. On a saturated
 * tone-7 surface that lands just under 3:1 — measured on published systems
 * (2026-11-03): Popsicle's lilac #cc90d8 at 2.94:1, Surf's orange #f0843c at
 * 2.67:1. accessibleIconTone steps only those cells along the icon's own
 * palette until they clear 3:1. Palettes below are Popsicle's published
 * light-mode Primary and Neutral ramps, tones 1-12.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { accessibleIconTone, iconToneAt } from '../utils/cssgen/exportColorSystem';

const PRIMARY = ['#231725', '#3c2641', '#593462', '#784284', '#784284', '#b771c6', '#cc90d8', '#d599e1', '#e8b8ef', '#f4d6f8', '#fceaff', '#fff5ff'];
const NEUTRAL = ['#000000', '#1b1b1b', '#303030', '#474747', '#575757', '#919191', '#ababab', '#c6c6c6', '#e2e2e2', '#f1f1f1', '#f9f9f9', '#fcfcfc'];
const at = (ramp: string[]) => (t: number) => ramp[t - 1];

describe('accessibleIconTone', () => {
  it('steps an icon that misses 3:1 on a mid-tone surface, and it then clears', () => {
    const base = iconToneAt(7, false, false);
    const bg = PRIMARY[6];
    expect(chroma.contrast(PRIMARY[base - 1], bg)).toBeLessThan(3);
    const tone = accessibleIconTone(base, at(PRIMARY), [bg, NEUTRAL[6]]);
    expect(tone).toBeLessThan(base);
    expect(chroma.contrast(PRIMARY[tone - 1], bg)).toBeGreaterThanOrEqual(3);
  });

  it('leaves a tone that already passes exactly where it is', () => {
    const base = iconToneAt(12, false, false);
    expect(accessibleIconTone(base, at(PRIMARY), [PRIMARY[11]])).toBe(base);
  });

  it('keeps the table tone when no tone can pass, rather than guessing', () => {
    expect(accessibleIconTone(5, () => '#808080', ['#7f7f7f'])).toBe(5);
  });
});
