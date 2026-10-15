/**
 * WCAG contrast, the photo scan and both solvers — ported from the two
 * portfolio experiments (dino-overlay's overlaySolver / imageAnalysis and
 * text-on-gradient's gradientSolver), unchanged in their maths.
 */

export interface RGB { r: number; g: number; b: number }
export interface Sample extends RGB { px: number; py: number }

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Any CSS color the browser resolved (rgb(), #hex) as RGB. */
export function cssToRgb(css: string): RGB | null {
  const s = css.trim();
  if (s.startsWith('#')) return hexToRgb(s);
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
}

const lin = (c8: number) => { const c = c8 / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const luminance = ({ r, g, b }: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function ratio(a: RGB, b: RGB): number {
  const la = luminance(a); const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG large text — ≥ 24px, or ≥ 18.66px bold — needs 3:1; anything else 4.5:1. */
export const requiredRatio = (sizePx: number, bold = false) => (sizePx >= 24 || (bold && sizePx >= 18.66) ? 3 : 4.5);

const over = (top: RGB, bottom: RGB, a: number): RGB => ({
  r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a),
});

/* ── Photo ──────────────────────────────────────────────────────────────── */

/**
 * The photo as it will be shown — cropped to the hero's aspect with
 * object-fit: cover at its alignment — and the pixels under the text box.
 * This is what makes the contrast honest: the solver sees exactly the pixels
 * the text will sit on.
 */
export function samplePhoto(img: HTMLImageElement, opts: {
  frameW: number; frameH: number; alignX: string; alignY: string;
  box: { x: number; y: number; w: number; h: number };
}): Sample[] {
  const aspect = opts.frameW / opts.frameH;
  const aw = aspect >= 1 ? 480 : Math.round(480 * aspect);
  const ah = aspect >= 1 ? Math.round(480 / aspect) : 480;
  const c = document.createElement('canvas');
  c.width = Math.max(1, aw); c.height = Math.max(1, ah);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const s = Math.max(c.width / img.width, c.height / img.height);
  const dw = img.width * s; const dh = img.height * s;
  const dx = opts.alignX === 'left' ? 0 : opts.alignX === 'right' ? c.width - dw : (c.width - dw) / 2;
  const dy = opts.alignY === 'top' ? 0 : opts.alignY === 'bottom' ? c.height - dh : (c.height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  const x0 = Math.max(0, Math.floor(opts.box.x * c.width));
  const y0 = Math.max(0, Math.floor(opts.box.y * c.height));
  const x1 = Math.min(c.width, Math.ceil((opts.box.x + opts.box.w) * c.width));
  const y1 = Math.min(c.height, Math.ceil((opts.box.y + opts.box.h) * c.height));
  if (x1 <= x0 || y1 <= y0) return [];
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const out: Sample[] = [];
  const w = x1 - x0; const h = y1 - y0;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      out.push({ r: data[i], g: data[i + 1], b: data[i + 2], px: (x0 + x) / c.width, py: (y0 + y) / c.height });
    }
  }
  return out;
}

/**
 * The overlay's strength at a point, 0..1. Solid is 1 everywhere; the
 * gradient is strongest at the text's edge of the hero and fades to nothing
 * at the far edge, so the photo shows where there is no text.
 */
export function overlayStrength(kind: 'solid' | 'gradient', v: string, h: string, p: { px: number; py: number }): number {
  if (kind === 'solid') return 1;
  if (v === 'bottom') return p.py;
  if (v === 'top') return 1 - p.py;
  if (h === 'left') return 1 - p.px;
  if (h === 'right') return p.px;
  return 1;
}

/**
 * The lowest overlay opacity at which every sampled pixel clears `target`
 * against the text. A fine linear scan, robust to the non-monotonic cases a
 * bisection would miss.
 */
export function solveOverlay(samples: Sample[], overlay: RGB, text: RGB, target: number,
  kind: 'solid' | 'gradient', v: string, h: string): { alpha: number; ratio: number; ok: boolean } {
  const worstAt = (a: number) => {
    let worst = Infinity;
    for (const s of samples) {
      const k = overlayStrength(kind, v, h, s) * a;
      const c = ratio(over(overlay, s, k), text);
      if (c < worst) worst = c;
    }
    return worst;
  };
  if (!samples.length) return { alpha: 0, ratio: 21, ok: true };
  for (let a = 0; a <= 1.0001; a += 0.01) {
    const w = worstAt(Math.min(1, a));
    if (w >= target) return { alpha: Math.round(Math.min(1, a) * 100) / 100, ratio: w, ok: true };
  }
  return { alpha: 1, ratio: worstAt(1), ok: false };
}

/* ── Gradient ───────────────────────────────────────────────────────────── */

/** The color at t along the stops, lerped in sRGB as the browser paints it. */
export function colorAt(stops: { rgb: RGB; pos: number }[], t: number): RGB {
  const s = [...stops].sort((a, b) => a.pos - b.pos);
  if (t <= s[0].pos) return s[0].rgb;
  if (t >= s[s.length - 1].pos) return s[s.length - 1].rgb;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]; const b = s[i + 1];
    if (t >= a.pos && t <= b.pos) {
      const k = b.pos - a.pos <= 0 ? 0 : (t - a.pos) / (b.pos - a.pos);
      return { r: a.rgb.r + (b.rgb.r - a.rgb.r) * k, g: a.rgb.g + (b.rgb.g - a.rgb.g) * k, b: a.rgb.b + (b.rgb.b - a.rgb.b) * k };
    }
  }
  return s[s.length - 1].rgb;
}

/**
 * The worst contrast between the text and the gradient across the whole
 * fill — sampled, not checked at the stops alone, because luminance along an
 * sRGB lerp between two hues can dip below both ends.
 */
export function worstOverGradient(stops: { rgb: RGB; pos: number }[], text: RGB): number {
  let worst = Infinity;
  for (let i = 0; i <= 200; i++) {
    const c = ratio(colorAt(stops, i / 200), text);
    if (c < worst) worst = c;
  }
  return worst;
}

export interface MeshStop { rgb: RGB; x: number; y: number; spread: number }

/**
 * The mesh's color at (x, y), both 0..1 of the hero: the first stop is the
 * ground, each later one an elliptical blob whose alpha falls linearly from 1
 * at its center to 0 at its edge, later blobs on top — the composite heroCode's
 * meshBackground paints. The ellipse is a fraction of width and height alike,
 * so in these unit coordinates every blob is a circle and the answer does not
 * depend on the device.
 */
export function meshColorAt(stops: MeshStop[], x: number, y: number): RGB {
  let c = { ...stops[0].rgb };
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i];
    const d = Math.hypot(x - b.x, y - b.y) / Math.max(b.spread, 1e-6);
    const a = Math.max(0, 1 - d);
    if (a > 0) c = { r: b.rgb.r * a + c.r * (1 - a), g: b.rgb.g * a + c.g * (1 - a), b: b.rgb.b * a + c.b * (1 - a) };
  }
  return c;
}

/** The worst contrast between the text and a mesh, over a grid across the
 *  whole hero plus every blob's center (its purest point). */
export function worstOverMesh(stops: MeshStop[], text: RGB, grid = 20): number {
  let worst = Infinity;
  const at = (x: number, y: number) => { const c = ratio(meshColorAt(stops, x, y), text); if (c < worst) worst = c; };
  for (let i = 0; i <= grid; i++) for (let j = 0; j <= grid; j++) at(i / grid, j / grid);
  stops.slice(1).forEach((b) => at(Math.min(1, Math.max(0, b.x)), Math.min(1, Math.max(0, b.y))));
  return worst;
}
