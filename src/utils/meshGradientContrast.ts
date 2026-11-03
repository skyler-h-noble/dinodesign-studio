/**
 * Does one text color read everywhere on a mesh? — measured against a real
 * system's palette.
 *
 * The mesh text rule is the gradient tool's: the whole fill shares ONE text
 * color, so it has to clear the ratio at every stop. The maths is the hero
 * add-on's (heroContrast: `ratio`, `meshColorAt`, `worstOverMesh`), not a
 * second copy — this module only turns an authored CSS stack into the stops
 * those functions take.
 *
 * Pure, so the publish scripts can run it under Node against the published
 * mode sheets, and the tests against a fixture of them.
 */

import { hexToRgb, ratio, worstOverMesh, type MeshStop, type RGB } from './addOns/hero/heroContrast.ts';

/** `--Name: #hex` pairs from a mode sheet. Palette tones are defined once, at
 *  :root, so the first definition of each name is the one that counts. */
export function readPalette(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--([A-Za-z]+-Color-(?:\d+|Vibrant)):\s*(#[0-9a-fA-F]{3,8})\b/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}

export interface MeshLayer {
  /** The token as written, e.g. `--Primary-Color-11`. */
  token: string;
  /** Where the blob sits, 0..1 of the box. The base layer has none. */
  x?: number;
  y?: number;
  /** The blob's radius as a fraction of the box (from its `transparent N%`). */
  spread?: number;
}

/**
 * The layers of an authored stack, BOTTOM first (the base color, then each
 * radial-gradient from the last listed to the first) — the order the hero's
 * `meshColorAt` composites in. CSS paints the first listed layer on top.
 */
export function meshLayers(background: string): MeshLayer[] {
  const blobs: MeshLayer[] = [];
  const re = /radial-gradient\(\s*circle at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*var\(\s*(--[\w-]+)\s*\)[^,]*,\s*transparent\s+([\d.]+)%\s*\)/g;
  for (const m of background.matchAll(re)) {
    blobs.push({ token: m[3], x: +m[1] / 100, y: +m[2] / 100, spread: +m[4] / 100 });
  }
  const base = /,\s*var\(\s*(--[\w-]+)\s*\)\s*$/.exec(background);
  return [...(base ? [{ token: base[1] }] : []), ...blobs.reverse()];
}

export interface MeshContrast {
  /** Each layer's color and its ratio against the text. */
  stops: { token: string; hex: string; ratio: number }[];
  /** The lowest ratio at any stop. */
  worstStop: number;
  /** The lowest ratio anywhere on the fill (hero `worstOverMesh`). */
  worstMesh: number;
  /** Tokens the palette does not define — the mesh would paint nothing there. */
  missing: string[];
}

/**
 * The text's contrast against every stop and across the whole fill.
 *
 * The blob geometry is approximate (CSS sizes a `circle` to the farthest
 * corner; the hero model uses the box). For LIGHT text that does not matter:
 * relative luminance is convex in the sRGB channels, so no blend of two stops
 * is lighter than the lighter of them, and the per-stop check is already the
 * worst case. For dark text the sampled `worstMesh` is the closer answer.
 */
export function meshContrast(background: string, text: string, palette: Record<string, string>): MeshContrast {
  const layers = meshLayers(background);
  const textRgb = hexToRgb(text);
  const missing: string[] = [];
  const resolved: { layer: MeshLayer; hex: string; rgb: RGB }[] = [];
  for (const layer of layers) {
    const hex = palette[layer.token.replace(/^--/, '')];
    if (!hex) { missing.push(layer.token); continue; }
    resolved.push({ layer, hex, rgb: hexToRgb(hex) });
  }
  const stops = resolved.map(({ layer, hex, rgb }) => ({ token: layer.token, hex, ratio: ratio(rgb, textRgb) }));
  const meshStops: MeshStop[] = resolved.map(({ layer, rgb }) => ({
    rgb, x: layer.x ?? 0.5, y: layer.y ?? 0.5, spread: layer.spread ?? 1,
  }));
  return {
    stops,
    worstStop: stops.length ? Math.min(...stops.map((s) => s.ratio)) : 0,
    worstMesh: meshStops.length ? worstOverMesh(meshStops, textRgb) : 0,
    missing,
  };
}

/** Resolve a text value (`var(--BW-Color-6, #040404)`, `#ffffff`) to a hex
 *  against a palette, the way the browser would: the token if the sheet
 *  defines it, else its fallback. */
export function resolveTextColor(value: string, palette: Record<string, string>): string | null {
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  const m = /^var\(\s*--([\w-]+)\s*(?:,\s*(#[0-9a-fA-F]{3,8})\s*)?\)$/.exec(v);
  if (!m) return null;
  return palette[m[1]] ?? m[2] ?? null;
}
