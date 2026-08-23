import { describe, it, expect } from 'vitest';
import { detectedPoolChoices } from '../utils/displayPool';

const POOLS: Record<string, string[]> = {
  'Serif / Editorial': ['Playfair Display', 'Lora'],
  'Sans / Clean': ['Inter', 'Roboto', 'Open Sans', 'Lato'],
  'Sans / Geometric': ['Poppins', 'Montserrat'],
  'Expressive / Display': ['Oswald', 'Anton'],
  'Expressive / Formal Script': ['Dancing Script', 'Great Vibes'],
  'Expressive / Handwritten Script': ['Caveat', 'Shadows Into Light'],
};

describe('detected font pool', () => {
  // The bug: a hand-lettered cover whose Detection panel correctly read
  // "Expressive · Formal Script" was offered Oswald, Lato and Inter. The panel
  // renders the PIXEL-CORRECTED verdict; the pool was reading CLIP's raw
  // category, which had already been overruled. Both are lists of real fonts,
  // so nothing looked wrong from the outside.
  it('follows the pixel-corrected verdict, not the overruled CLIP category', () => {
    const out = detectedPoolChoices({
      clipCategory: 'Sans / Clean',       // what CLIP said
      branch: 'Expressive',                // what the stroke scan corrected it to
      style: 'Formal Script',
      pixelOverride: true,
      categoryPools: POOLS,
    });
    expect(out[0].category).toBe('Expressive / Formal Script');
    expect(out[0].family).toBe('Dancing Script');
    // and it must not lead with the sans pool it used to
    expect(out.slice(0, 2).map((c) => c.family)).not.toContain('Inter');
  });

  it('keeps using CLIP when the scan did NOT overrule it', () => {
    const out = detectedPoolChoices({
      clipCategory: 'Sans / Clean',
      branch: 'Sans serif',
      style: 'Clean',
      pixelOverride: false,
      categoryPools: POOLS,
    });
    expect(out[0].category).toBe('Sans / Clean');
  });

  it('widens to the branch siblings, never across branches', () => {
    const out = detectedPoolChoices({
      clipCategory: null,
      branch: 'Expressive',
      style: 'Formal Script',
      pixelOverride: true,
      categoryPools: POOLS,
    });
    expect(out.every((c) => c.category.startsWith('Expressive'))).toBe(true);
  });

  it('falls back to everything rather than nothing on an unknown branch', () => {
    const out = detectedPoolChoices({
      clipCategory: null, branch: '', style: '', pixelOverride: false, categoryPools: POOLS,
    });
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('style strings reach the pool they name', () => {
  const P: Record<string, string[]> = {
    'Expressive / Display': ['Oswald', 'Anton'],
    'Expressive / Formal Script': ['Dancing Script'],
    'Expressive / Handwritten Script': ['Caveat'],
    'Expressive / Hand': ['Patrick Hand', 'Indie Flower'],
  };
  const lead = (style: string) => detectedPoolChoices({
    clipCategory: null, branch: 'Expressive', style, pixelOverride: true, categoryPools: P,
  })[0]?.category;

  // The classifier returns a bare style ('Hand'); the pools are keyed by the
  // full 'Expressive / Hand'. Without qualifying the exact match by branch, a
  // bare style fell through to a fuzzy contains-first-word test and 'Hand'
  // landed on 'Expressive / Handwritten Script' — another hand pool, so it
  // looked right and was wrong.
  it('sends Hand to the Hand pool, not to Handwritten Script', () => {
    expect(lead('Hand')).toBe('Expressive / Hand');
  });

  it('keeps the other expressive styles on their own pools', () => {
    expect(lead('Handwritten Script')).toBe('Expressive / Handwritten Script');
    expect(lead('Formal Script')).toBe('Expressive / Formal Script');
    expect(lead('Display')).toBe('Expressive / Display');
  });
});

describe('editing a saved system, with no analysis', () => {
  const P: Record<string, string[]> = {
    'Serif / Editorial': ['Playfair Display', 'Lora'],
    'Sans / Clean': ['Inter', 'Roboto'],
    'Expressive / Hand': ['Patrick Hand'],
  };

  // Re-opening a saved design system does NOT re-run the analysis, so the role
  // panels render with result === null. They stay fully adjustable, which means
  // the font pickers must still be populated — an empty pool would leave the
  // user looking at controls they cannot use.
  it('falls back to every category rather than to nothing', () => {
    const out = detectedPoolChoices({
      clipCategory: null, branch: '', style: '', pixelOverride: false, categoryPools: P,
    });
    expect(out.length).toBeGreaterThan(0);
    // and spans the branches, rather than collapsing onto whichever is first
    expect(new Set(out.map((c) => c.category)).size).toBeGreaterThan(1);
  });
});
