/**
 * The mesh in dark mode.
 *
 * Palette tones are the same lightness in both mode sheets, so a mesh authored
 * on tones 7-12 stayed a pale card on a dark page, and on current systems its
 * BW text token turned white there (the dark sheet mirrors BW) — white on pale.
 *
 * The fixture is the four portfolio systems as published (2026-11-03): each
 * one's mesh-gradient.css and the palette tones from its Light-Mode.css and
 * Dark-Mode.css. Real values, because a dark variant can "look" right in a
 * diff and still be pale against the sheet it actually meets.
 */
import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/meshGradientSystems.json';
import { SEED_MESH_GRADIENTS } from '../data/meshGradients';
import {
  generateMeshGradientCSS, darkMeshBackground, darkTone, DARK_MESH_TEXT,
} from '../utils/meshGradientCSS';
import { meshContrast, meshLayers, resolveTextColor } from '../utils/meshGradientContrast';
import { hexToRgb, luminance } from '../utils/addOns/hero/heroContrast';
import { textForTone } from '../utils/addOns/hero/heroSpec';

type Sys = {
  /** What the generator produced for this seed before the dark variant existed. */
  generatorBefore: string;
  /** The mesh-gradient.css in Storage on 2026-11-03. */
  published: string;
  Light: Record<string, string>;
  Dark: Record<string, string>;
};
const SYSTEMS = fixture as Record<string, Sys>;
const NAMES: Record<string, string> = {
  'd1bd0ba4-4906-4801-93c3-49db251f10d2': 'Cocktails',
  'a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2': "Surf's Up",
  'b36585cd-f290-4a74-9749-4ae99e1986c0': 'Chocolate',
  'd7ad345c-33d7-43f6-8f30-41728bf395e6': 'Popsicle',
};
const IDS = Object.keys(NAMES);

/** The value of a declaration inside the first block matching `selector`. */
function declIn(css: string, selector: string, prop: string): string | null {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const block = css.slice(at, css.indexOf('}', at));
  const m = new RegExp(`${prop}:\\s*([^;]+);`).exec(block);
  return m ? m[1].trim() : null;
}

describe('the light file is unchanged', () => {
  it.each(IDS)('%s: the previous output is a byte-for-byte prefix of the new one', (id) => {
    const css = generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]);
    const before = SYSTEMS[id].generatorBefore;
    // A prefix, not "contains the same tokens": the dark block is only ever
    // APPENDED, so nothing the light page reads can have moved.
    expect(css.slice(0, before.length)).toBe(before);
    expect(css.length).toBeGreaterThan(before.length);
  });

  it.each(IDS)('%s: every rule in the published file is still emitted unchanged', (id) => {
    // The published files predate a US-spelling pass over one comment
    // ("colour" -> "color"), so they are compared with comments removed. The
    // rules — every selector and declaration — must match exactly.
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
    const css = strip(generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]));
    const published = strip(SYSTEMS[id].published);
    expect(css.slice(0, published.length)).toBe(published);
  });

  it('adds nothing for a mesh that has no derivable dark twin', () => {
    // A raw color has no place on the ramp; inventing a dark twin is guessing.
    const mesh = { background: 'radial-gradient(circle at 0% 0%, #ff0000 0%, transparent 50%), var(--Primary-Color-11)' };
    expect(darkMeshBackground(mesh.background)).toBeNull();
    expect(generateMeshGradientCSS(mesh)).not.toContain('@container');
  });
});

describe('the tone mapping', () => {
  it('lands every light tone on the white-text side of the 5/6 line', () => {
    for (let t = 1; t <= 12; t++) {
      expect(textForTone(darkTone(t)), `tone ${t} -> ${darkTone(t)}`).toBe('light');
    }
  });

  it('mirrors the ramp, so a paler light stop is a darker dark one', () => {
    for (let t = 6; t < 12; t++) expect(darkTone(t + 1)).toBeLessThanOrEqual(darkTone(t));
    expect(darkTone(12)).toBe(1);
    expect(darkTone(11)).toBe(2);
    // Already dark: left alone.
    for (let t = 1; t <= 5; t++) expect(darkTone(t)).toBe(t);
  });

  it('leaves BW, Vibrant and fallback-carrying tokens without a dark twin', () => {
    expect(darkMeshBackground('var(--BW-Color-6)')).toBeNull();
    expect(darkMeshBackground('var(--Primary-Color-Vibrant)')).toBeNull();
    expect(darkMeshBackground('var(--Primary-Color-11, #eee)')).toBeNull();
  });
});

describe('the dark variant', () => {
  it.each(IDS)('%s: switches on from the dark sheet and from data-mode', (id) => {
    const css = generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]);
    // The flag is the dark sheet's own mirrored BW value — check it really is
    // what that sheet defines, and that the light sheet does NOT match it.
    expect(SYSTEMS[id].Dark['BW-Color-6']).toBe('#ffffff');
    expect(SYSTEMS[id].Light['BW-Color-6']).not.toBe('#ffffff');
    expect(css).toContain('@container style(--BW-Color-6: #ffffff)');
    expect(css).toContain(':root[data-mode="dark"]');
    // Both triggers carry the same stack.
    const viaQuery = declIn(css, ':where(body)', '--Mesh-Gradient');
    const viaAttr = declIn(css, ':root[data-mode="dark"]', '--Mesh-Gradient');
    expect(viaQuery).toBe(viaAttr);
    expect(declIn(css, ':where(body)', '--Mesh-Gradient-Text')).toBe(DARK_MESH_TEXT);
    expect(declIn(css, ':root[data-mode="dark"]', '--Mesh-Gradient-Text')).toBe(DARK_MESH_TEXT);
  });

  it.each(IDS)('%s: is actually dark against the dark sheet', (id) => {
    const css = generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]);
    const dark = declIn(css, ':where(body)', '--Mesh-Gradient')!;
    const pal = SYSTEMS[id].Dark;
    for (const layer of meshLayers(dark)) {
      const hex = pal[layer.token.slice(2)];
      expect(hex, `${layer.token} undefined in Dark-Mode.css`).toBeDefined();
      // Darker than the dark sheet's own tone 6 of that family — i.e. on the
      // dark side of the line in the sheet it meets, not just by index.
      const family = layer.token.slice(2).replace(/-Color-\d+$/, '');
      expect(luminance(hexToRgb(hex)), layer.token).toBeLessThan(luminance(hexToRgb(pal[`${family}-Color-6`])));
    }
    // And darker than the light mesh it replaces, at the base.
    const lightBase = meshLayers(SEED_MESH_GRADIENTS[id].background)[0].token.slice(2);
    const darkBase = meshLayers(dark)[0].token.slice(2);
    expect(luminance(hexToRgb(pal[darkBase]))).toBeLessThanOrEqual(luminance(hexToRgb(pal[lightBase])));
  });

  it.each(IDS)('%s: white text clears 4.5:1 at every stop and across the fill', (id) => {
    const css = generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]);
    const dark = declIn(css, ':where(body)', '--Mesh-Gradient')!;
    const r = meshContrast(dark, DARK_MESH_TEXT, SYSTEMS[id].Dark);
    expect(r.missing).toEqual([]);
    expect(r.stops.length).toBe(meshLayers(SEED_MESH_GRADIENTS[id].background).length);
    for (const s of r.stops) expect(s.ratio, `${s.token} ${s.hex}`).toBeGreaterThanOrEqual(4.5);
    expect(r.worstMesh).toBeGreaterThanOrEqual(4.5);
  });

  it.each(IDS)('%s: also reads with data-mode="dark" over the LIGHT sheet', (id) => {
    // The attribute can fire with either sheet loaded, which is why the dark
    // text is a literal rather than a BW tone (BW-6 is near-black there).
    const css = generateMeshGradientCSS(SEED_MESH_GRADIENTS[id]);
    const dark = declIn(css, ':root[data-mode="dark"]', '--Mesh-Gradient')!;
    const r = meshContrast(dark, DARK_MESH_TEXT, SYSTEMS[id].Light);
    expect(r.missing).toEqual([]);
    expect(r.worstStop).toBeGreaterThanOrEqual(4.5);
  });

  it('documents the bug it fixes: the old file put white text on a pale mesh in dark mode', () => {
    // Cocktails, published: text var(--BW-Color-6) resolves to white in the
    // dark sheet while the stops stay on tones 7-11.
    const id = IDS[0];
    const old = SYSTEMS[id].published;
    const text = resolveTextColor(declIn(old, ':root', '--Mesh-Gradient-Text')!, SYSTEMS[id].Dark)!;
    expect(text).toBe('#ffffff');
    const r = meshContrast(declIn(old, ':root', '--Mesh-Gradient')!, text, SYSTEMS[id].Dark);
    expect(r.worstStop).toBeLessThan(4.5);
  });
});
