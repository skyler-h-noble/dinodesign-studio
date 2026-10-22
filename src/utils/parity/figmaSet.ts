/* eslint-disable @typescript-eslint/no-explicit-any -- raw Figma REST JSON, which has no published types here */
/**
 * A Figma component set, read through the REST API, reduced to what the
 * parity page draws and measures: where each variant sits, what its variant
 * properties are, and the resolved look of the parts being compared.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface FigmaPart {
  /** Top-left relative to the variant's own top-left. */
  x?: number;
  y?: number;
  w: number;
  h: number;
  radius: number | null;
  strokeWeight: number | null;
  /** INSIDE | CENTER | OUTSIDE — where the stroke sits relative to the box. */
  strokeAlign?: string;
  stroke: string | null;
  fill: string | null;
  effects: string[];
  /** TEXT parts only. */
  font?: { size: number; family: string; weight: number; color: string | null; align?: string };
}

export interface FigmaVariant {
  id: string;
  props: Record<string, string>;
  /** Relative to the set's top-left. */
  box: Box;
  opacity: number;
  /** By layer name, the first visible layer with that name. */
  parts: Record<string, FigmaPart>;
}

export interface FigmaSet {
  name: string;
  box: Box;
  /** Where the exported image's top-left sits, relative to the set: the image
   *  covers the render bounds, which include shadows and overflow. */
  imageOffset: { x: number; y: number; w: number; h: number };
  booleanDefaults: Record<string, boolean>;
  variants: FigmaVariant[];
}

const channel = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');

/** #rrggbb, or #rrggbbaa when the color is not opaque. */
export function figmaColor(c: { r: number; g: number; b: number; a?: number } | undefined, opacity = 1): string | null {
  if (!c) return null;
  const a = (c.a ?? 1) * opacity;
  return `#${channel(c.r)}${channel(c.g)}${channel(c.b)}${a < 0.999 ? channel(a) : ''}`;
}

const visiblePaint = (paints: any[] | undefined) =>
  (paints || []).find((p) => p.visible !== false && p.type === 'SOLID');

function partOf(node: any, origin?: { x: number; y: number }): FigmaPart {
  const fill = visiblePaint(node.fills);
  const stroke = visiblePaint(node.strokes);
  const b = node.absoluteBoundingBox || { width: 0, height: 0 };
  const effects = (node.effects || [])
    .filter((e: any) => e.visible !== false && (e.color?.a ?? 1) > 0.001)
    .map((e: any) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${figmaColor(e.color)}`);
  // A layer's own opacity tints its paints — the radio halo is the button
  // Border on a layer at 10%, and that 10% is part of its color.
  const layerOpacity = node.opacity ?? 1;
  const part: FigmaPart = {
    ...(origin && b.x !== undefined ? { x: Math.round((b.x - origin.x) * 100) / 100, y: Math.round((b.y - origin.y) * 100) / 100 } : {}),
    w: Math.round(b.width * 100) / 100,
    h: Math.round(b.height * 100) / 100,
    radius: typeof node.cornerRadius === 'number' ? node.cornerRadius : (node.rectangleCornerRadii?.[0] ?? null),
    strokeWeight: stroke ? (node.strokeWeight ?? null) : null,
    strokeAlign: node.strokeAlign,
    stroke: stroke ? figmaColor(stroke.color, (stroke.opacity ?? 1) * layerOpacity) : null,
    fill: fill ? figmaColor(fill.color, (fill.opacity ?? 1) * layerOpacity) : null,
    effects,
  };
  if (node.type === 'TEXT' && node.style) {
    part.font = { size: node.style.fontSize, family: node.style.fontFamily, weight: node.style.fontWeight, color: fill ? figmaColor(fill.color, fill.opacity ?? 1) : null, align: node.style.textAlignHorizontal };
  }
  return part;
}

/** By layer name, in document order. The first copy is `name`; later copies
 *  of a repeated layer (the segments of a group) are `name#2`, `name#3`… */
function indexParts(node: any, into: Record<string, FigmaPart>, origin: { x: number; y: number }) {
  for (const c of node.children || []) {
    if (c.visible === false) continue;
    if (!into[c.name]) into[c.name] = partOf(c, origin);
    else {
      let k = 2;
      while (into[`${c.name}#${k}`]) k++;
      into[`${c.name}#${k}`] = partOf(c, origin);
    }
    indexParts(c, into, origin);
  }
}

export function parseVariantName(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of name.split(',')) {
    const [k, ...v] = pair.split('=');
    if (k && v.length) out[k.trim()] = v.join('=').trim();
  }
  return out;
}

export function parseFigmaSet(doc: any): FigmaSet {
  const sb = doc.absoluteBoundingBox;
  const rb = doc.absoluteRenderBounds || sb;
  const booleanDefaults: Record<string, boolean> = {};
  for (const [k, d] of Object.entries<any>(doc.componentPropertyDefinitions || {})) {
    if (d.type === 'BOOLEAN') booleanDefaults[k.split('#')[0]] = Boolean(d.defaultValue);
  }
  const variants: FigmaVariant[] = (doc.children || [])
    .filter((c: any) => c.type === 'COMPONENT')
    .map((c: any) => {
      const b = c.absoluteBoundingBox;
      // `__root__` is the variant itself — where a component-level effect,
      // like the Alert's Level 1 shadow, lives.
      const parts: Record<string, FigmaPart> = { __root__: partOf(c, { x: b.x, y: b.y }) };
      indexParts(c, parts, { x: b.x, y: b.y });
      return {
        id: c.id,
        props: parseVariantName(c.name),
        box: { x: b.x - sb.x, y: b.y - sb.y, w: b.width, h: b.height },
        opacity: c.opacity ?? 1,
        parts,
      };
    });
  return {
    name: doc.name,
    box: { x: 0, y: 0, w: sb.width, h: sb.height },
    imageOffset: { x: rb.x - sb.x, y: rb.y - sb.y, w: rb.width, h: rb.height },
    booleanDefaults,
    variants,
  };
}
