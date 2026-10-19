/**
 * Turning an uploaded logo into ink: one shape in currentColor, on nothing,
 * cropped tight. Browser only (DOMParser, canvas).
 *
 *   An SVG in one color    kept as vectors — sanitized, its color swapped for
 *                          currentColor, its viewBox cropped to the ink.
 *   Anything else          drawn to a canvas, split into ink and background,
 *                          and traced back to a vector. Covers PNG and JPEG,
 *                          and SVGs whose colors cannot become one: several
 *                          colors, white knocked out of a shape, gradients.
 *
 * "Background" is whatever the logo sits on: transparency, or — when the
 * corners are opaque — the corners' color. Near-white inside the logo is
 * background too, so letters knocked out of a badge stay holes in the ink
 * rather than filling in.
 *
 * The SVG is parsed and cleaned before anything draws it: no scripts, no
 * foreignObject, no event handlers, no outside references (see brandAsset.ts
 * for why an uploaded SVG is never trusted).
 */
import ImageTracer from 'imagetracerjs';

export interface InkResult {
  svg: string;
  aspect: number;
  source: 'vector' | 'traced';
  note: string;
}

export const INK_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_INK_BYTES = 2 * 1024 * 1024;

const NS = 'http://www.w3.org/2000/svg';
const DROP = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'animate', 'set', 'animateTransform', 'animateMotion'];

type RGB = { r: number; g: number; b: number };

/** Any CSS color as RGB, through the canvas parser; null for none / unparseable. */
function parseColor(c: string): RGB | null {
  const v = c.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent' || v === 'currentcolor' || v.startsWith('url(') || v === 'inherit') return null;
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = '#010203';
  ctx.fillStyle = v;
  const out = ctx.fillStyle as string;
  if (out === '#010203' && v !== '#010203') return null;
  const m = out.match(/^#([0-9a-f]{6})$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  const n = out.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  return n ? { r: +n[1], g: +n[2], b: +n[3] } : null;
}
const nearWhite = (c: RGB) => c.r > 235 && c.g > 235 && c.b > 235;
const dist = (a: RGB, b: RGB) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

/** Parse and clean an SVG. Returns the document and the colors it paints with. */
function sanitize(text: string): { doc: Document; colors: RGB[]; complex: boolean } {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('That SVG could not be read. Export it again from your design tool, or upload a PNG.');
  }
  for (const tag of DROP) doc.querySelectorAll(tag).forEach((n) => n.remove());
  let complex = false;
  // Pictures inside an SVG cannot become one color as vectors: trace them.
  doc.querySelectorAll('image').forEach((n) => { complex = true; const h = n.getAttribute('href') || n.getAttribute('xlink:href') || ''; if (!h.startsWith('data:image/')) n.remove(); });
  if (doc.querySelector('linearGradient, radialGradient, pattern, mask, filter')) complex = true;
  const colors: RGB[] = [];
  const add = (c: string | null) => { if (c) { const rgb = parseColor(c); if (rgb) colors.push(rgb); } };
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(a.name);
      else if ((name === 'href' || name === 'xlink:href') && !a.value.startsWith('#') && !(el.nodeName === 'image' && a.value.startsWith('data:image/'))) el.removeAttribute(a.name);
    }
    add(el.getAttribute('fill')); add(el.getAttribute('stroke'));
    const st = el.getAttribute('style') || '';
    for (const m of st.matchAll(/(?:^|;)\s*(?:fill|stroke)\s*:\s*([^;]+)/g)) add(m[1]);
    if (/opacity/.test(st) || el.hasAttribute('opacity') || el.hasAttribute('fill-opacity')) {
      const o = Number(el.getAttribute('opacity') || el.getAttribute('fill-opacity') || (st.match(/opacity\s*:\s*([\d.]+)/) || [])[1] || 1);
      if (o < 0.95) complex = true;
    }
  });
  doc.querySelectorAll('style').forEach((s) => {
    const css = (s.textContent || '').replace(/@import[^;]+;/g, '').replace(/url\(\s*['"]?(?!#)[^)]*\)/g, 'none');
    s.textContent = css;
    for (const m of css.matchAll(/(?:fill|stroke)\s*:\s*([^;}]+)/g)) add(m[1]);
  });
  return { doc, colors, complex };
}

/** Its own colors, with near-duplicates merged. */
function distinct(colors: RGB[]): RGB[] {
  const out: RGB[] = [];
  for (const c of colors) if (!out.some((o) => dist(o, c) < 24)) out.push(c);
  return out;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('That image could not be opened.'));
  img.src = src;
});

/** Draw an image (or an SVG string at a set size) and return its pixels. */
async function pixels(src: string, w: number, h: number): Promise<ImageData> {
  const img = await loadImage(src);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Which pixels are ink: opaque, and unlike the background (the corners' color
 *  when they are opaque, white otherwise — white inside a logo is a knockout). */
function inkMask(px: ImageData): { mask: Uint8Array; box: { x0: number; y0: number; x1: number; y1: number } | null } {
  const { width: w, height: h, data: d } = px;
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const opaque = corners.every((i) => d[i + 3] > 240);
  const bg: RGB = opaque
    ? { r: corners.reduce((t, i) => t + d[i], 0) / 4, g: corners.reduce((t, i) => t + d[i + 1], 0) / 4, b: corners.reduce((t, i) => t + d[i + 2], 0) / 4 }
    : { r: 255, g: 255, b: 255 };
  const mask = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    const c = { r: d[i], g: d[i + 1], b: d[i + 2] };
    const ink = d[i + 3] >= 128 && dist(c, bg) > 64 && !(nearWhite(c) && !opaque);
    if (ink) { mask[y * w + x] = 1; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return { mask, box: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Trace a mask's box to an ink SVG. */
function trace(mask: Uint8Array, w: number, box: { x0: number; y0: number; x1: number; y1: number }): string {
  const pad = 2;
  const bw = box.x1 - box.x0 + 1 + pad * 2; const bh = box.y1 - box.y0 + 1 + pad * 2;
  const data = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const sx = x + box.x0 - pad; const sy = y + box.y0 - pad;
    const on = sx >= 0 && sy >= 0 && sx < w && sy * w + sx < mask.length && sx <= box.x1 + pad && mask[sy * w + sx] === 1;
    const o = (y * bw + x) * 4;
    data[o] = on ? 0 : 255; data[o + 1] = on ? 0 : 255; data[o + 2] = on ? 0 : 255; data[o + 3] = 255;
  }
  const raw: string = ImageTracer.imagedataToSVG({ width: bw, height: bh, data }, {
    numberofcolors: 2, colorsampling: 0, colorquantcycles: 1, mincolorratio: 0,
    pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ltres: 0.5, qtres: 0.5, pathomit: 6, rightangleenhance: true, blurradius: 0,
    strokewidth: 0, linefilter: false, roundcoords: 1, viewbox: true, desc: false, scale: 1,
  });
  // Keep the black layer only — the white is the background — and make it the ink.
  const paths = [...raw.matchAll(/<path[^>]*>/g)].map((m) => m[0]).filter((p) => /fill="rgb\(0,0,0\)"/.test(p))
    .map((p) => (p.match(/\sd="([^"]+)"/) || [])[1]).filter(Boolean);
  if (!paths.length) throw new Error('No logo was found in that image — it may be the same color as its background.');
  return `<svg xmlns="${NS}" viewBox="0 0 ${bw} ${bh}"><path fill="currentColor" fill-rule="evenodd" d="${paths.join(' ')}"/></svg>`;
}

/** The longest side a logo is drawn at to find or trace its ink. */
const RASTER = 900;

export async function makeInk(file: File): Promise<InkResult> {
  if (!INK_TYPES.includes(file.type)) throw new Error(`${file.name} is a ${file.type || 'file of unknown type'}. Use an SVG (best — it stays sharp and adapts), or a PNG, JPEG or WebP.`);
  if (file.size > MAX_INK_BYTES) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)}MB — a logo should be under 2MB. A larger file is usually a photo picked by mistake.`);

  if (file.type === 'image/svg+xml') {
    const { doc, colors, complex } = sanitize(await file.text());
    const root = doc.documentElement;
    let vb = (() => {
      const v = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (v.length === 4 && v.every(isFinite) && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], w: v[2], h: v[3] };
      const w = parseFloat(root.getAttribute('width') || ''); const h = parseFloat(root.getAttribute('height') || '');
      return w > 0 && h > 0 ? { x: 0, y: 0, w, h } : null;
    })();
    if (!vb) vb = { x: 0, y: 0, w: 100, h: 100 };
    root.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const k = RASTER / Math.max(vb.w, vb.h);
    const W = Math.max(1, Math.round(vb.w * k)); const H = Math.max(1, Math.round(vb.h * k));
    root.setAttribute('width', String(W)); root.setAttribute('height', String(H));
    const cleaned = new XMLSerializer().serializeToString(doc);
    const px = await pixels(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`, W, H);
    const { mask, box } = inkMask(px);
    if (!box) throw new Error('That SVG draws nothing that could be found — it may be white on transparent. Upload the dark version.');
    const own = distinct(colors);
    const oneColor = !complex && own.filter((c) => !nearWhite(c)).length <= 1 && !own.some(nearWhite);
    if (oneColor) {
      // Every paint becomes currentColor; unpainted shapes default to it too.
      doc.querySelectorAll('*').forEach((el) => {
        for (const attr of ['fill', 'stroke']) { const v = el.getAttribute(attr); if (v && parseColor(v)) el.setAttribute(attr, 'currentColor'); }
        const st = el.getAttribute('style');
        if (st) el.setAttribute('style', st.replace(/((?:fill|stroke)\s*:\s*)([^;]+)/g, (m, p, v) => (parseColor(v) ? p + 'currentColor' : m)));
      });
      doc.querySelectorAll('style').forEach((s) => { s.textContent = (s.textContent || '').replace(/((?:fill|stroke)\s*:\s*)([^;}]+)/g, (m, p, v) => (parseColor(v) ? p + 'currentColor' : m)); });
      root.setAttribute('fill', root.getAttribute('fill') && !parseColor(root.getAttribute('fill')!) ? root.getAttribute('fill')! : 'currentColor');
      // Crop the viewBox to the ink, found on the drawing.
      const x = vb.x + box.x0 / k; const y = vb.y + box.y0 / k;
      const w = (box.x1 - box.x0 + 1) / k; const h = (box.y1 - box.y0 + 1) / k;
      root.setAttribute('viewBox', `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}`);
      root.removeAttribute('width'); root.removeAttribute('height');
      return { svg: new XMLSerializer().serializeToString(doc), aspect: w / h, source: 'vector', note: 'Kept as your vectors, in one color that adapts to each surface.' };
    }
    const svg = trace(mask, W, box);
    return { svg, aspect: (box.x1 - box.x0 + 5) / (box.y1 - box.y0 + 5), source: 'traced', note: 'Your SVG uses several colors (or white cut out of a shape), so its shape was traced into one color. Compare it with the original.' };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, RASTER / Math.max(img.naturalWidth, img.naturalHeight)) * (Math.max(img.naturalWidth, img.naturalHeight) < 300 ? 3 : 1);
    const W = Math.max(1, Math.round(img.naturalWidth * k)); const H = Math.max(1, Math.round(img.naturalHeight * k));
    const { mask, box } = inkMask(await pixels(url, W, H));
    if (!box) throw new Error('No logo was found in that image — it may be the same color as its background.');
    const svg = trace(mask, W, box);
    return { svg, aspect: (box.x1 - box.x0 + 5) / (box.y1 - box.y0 + 5), source: 'traced', note: 'Traced from your image into a vector in one color. An SVG would be sharper — compare it with the original.' };
  } finally { URL.revokeObjectURL(url); }
}
