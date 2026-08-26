/**
 * There is ONE definition of what an elevation level is.
 *
 * There were three. dropshadow.ts computed the levels from LEVEL_LAYERS —
 * angled, N layers for level N, each with its own --Dropshadow-Color-(i+1).
 * exportColorSystem.ts restated them as a two-layer straight-down recipe. The
 * lib rebuilds the same geometry again in _shadows.js.
 *
 * Both studio copies reached the published CSS, both at :root in base.css, and
 * the correct one won only because it was emitted second. Nothing was wrong on
 * screen, so nothing reported it — and a reorder would have changed every
 * shadow in every system with no diff to point at.
 */
import { describe, it, expect } from 'vitest';
import { effectLevelRecipe, shadowLayers } from '../utils/dropshadow';

describe('effect level recipes', () => {
  it('emit one layer per level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const layers = effectLevelRecipe(level).split(/,(?![^(]*\))/).length;
      expect(`level ${level}: ${layers} layers`).toBe(`level ${level}: ${level} layers`);
    }
  });

  it('give each layer its own numbered colour token', () => {
    // The aggregate --Dropshadow-Color is a FALLBACK for consumers outside a
    // themed scope; the recipe itself must name the per-layer tokens, or every
    // layer renders the same colour and the stack flattens.
    for (const level of [1, 3, 5] as const) {
      const recipe = effectLevelRecipe(level);
      for (let i = 1; i <= level; i++) {
        expect(`L${level} uses Color-${i}: ${recipe.includes(`--Dropshadow-Color-${i}`)}`)
          .toBe(`L${level} uses Color-${i}: true`);
      }
    }
  });

  it('match shadowLayers geometry exactly', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const recipe = effectLevelRecipe(level);
      for (const [x, y, blur] of shadowLayers(level)) {
        expect(`L${level} has ${x}px ${y}px ${blur}px: ${recipe.includes(`${x}px ${y}px ${blur}px`)}`)
          .toBe(`L${level} has ${x}px ${y}px ${blur}px: true`);
      }
    }
  });

  // The stale copy that used to live in exportColorSystem.ts. If any of these
  // reappear, a second definition has been reintroduced.
  it('are not the old straight-down two-layer recipe', () => {
    const all = [1, 2, 3, 4, 5].map((l) => effectLevelRecipe(l as 1)).join(' ');
    expect(all).not.toContain('0 4px 8px');
    expect(all).not.toContain('0 2px 4px');
    expect(all).not.toContain('0 16px 32px');
  });
});
