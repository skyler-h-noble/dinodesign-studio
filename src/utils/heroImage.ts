/**
 * Pull a hero image out of a moodboard collage.
 *
 * A moodboard is usually a board of separate panels on a flat background —
 * photographs, colour swatches, type specimens — not a single picture. Using the
 * whole board as a hero shows the gaps, the white background and the type
 * samples, which is not what anyone means by "the image from my moodboard".
 *
 * So: find the panels, work out which ones are photographs, and return the best
 * landscape crop.
 *
 * ── Why this needs no ML ──────────────────────────────────────────────────
 * The panels are axis-aligned rectangles on a near-uniform ground with visible
 * gaps, which is the easy case for connected-component analysis. The judgement
 * that DOES need care is telling a photograph from a type specimen, and that is
 * a statistics question rather than a recognition one: a type specimen is mostly
 * one flat colour with small high-contrast marks, a swatch block is a handful of
 * flat regions, a photograph has a broad colour distribution and busy edges.
 *
 * ── What is deliberately separated ────────────────────────────────────────
 * Everything below the canvas boundary is pure. `scorePanel`, `pickHero` and
 * `landscapeCrop` take numbers and return numbers, so the selection rules can be
 * tested without a DOM. Only `extractHeroImage` touches an image.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the pixel pass measures about one panel. */
export interface PanelStats {
  box: Box;
  /** Share of pixels that are the single most common colour, 0–1. High means
   *  flat — a type specimen's paper, or a swatch. */
  flatShare: number;
  /** Distinct quantised colours, normalised 0–1. Photographs run high. */
  colourSpread: number;
  /** Share of pixels differing sharply from the pixel to their right, 0–1.
   *  Type is all edge; a swatch block has almost none. */
  edgeDensity: number;
  /** Mean saturation 0–1. */
  saturation: number;
}

export interface HeroCandidate extends PanelStats {
  /** 0–1. How much this panel looks like a photograph. */
  photoScore: number;
  /** 0–1. Combined photo-ness, size and shape fit. */
  score: number;
}

/** 16:9 — the shape a hero band is usually asked for. */
export const DEFAULT_HERO_ASPECT = 16 / 9;

/**
 * How much this panel looks like a photograph rather than type or a swatch.
 *
 * Each term is a reason on its own, so they are weighted rather than multiplied:
 * one unusual measurement should cost a candidate some score, not disqualify it.
 * A moody near-monochrome photo is exactly the case that a strict rule gets
 * wrong, and it is a legitimate hero.
 */
export function scorePanel(s: PanelStats): number {
  // Flatness is the strongest signal against. A type specimen is typically
  // 80%+ one colour; a photograph rarely exceeds 30% even with a plain sky.
  const notFlat = clamp01(1 - (s.flatShare - 0.25) / 0.5);
  // Spread is the strongest signal for.
  const spread = clamp01(s.colourSpread / 0.5);
  // Edge density is bimodal: type is very high, swatches very low, photographs
  // in between. So the useful shape is a band, not "more is better".
  const edges = clamp01(1 - Math.abs(s.edgeDensity - 0.18) / 0.28);
  const sat = clamp01(s.saturation / 0.35);
  return clamp01(notFlat * 0.35 + spread * 0.3 + edges * 0.2 + sat * 0.15);
}

/**
 * Rank panels for use as a hero.
 *
 * Prefers a panel that is ALREADY landscape, because using one whole is always
 * truer to the board than cropping a band out of a portrait. A tall panel is not
 * excluded — it is just asked to be a better photograph to win, since it will
 * have to be cropped.
 */
export function pickHero(
  panels: PanelStats[],
  totalArea: number,
  targetAspect: number = DEFAULT_HERO_ASPECT,
): HeroCandidate[] {
  return panels
    .map((p) => {
      const photoScore = scorePanel(p);
      const aspect = p.box.w / Math.max(1, p.box.h);
      // 1 when the panel is already at or wider than the target, falling off as
      // it gets taller. A 16:9 panel needs no crop; a 3:4 portrait loses most of
      // its height to one.
      const shapeFit = clamp01(aspect / targetAspect);
      // Bigger panels carry more of the board's character, but the term is
      // deliberately weak — a small sharp photo beats a large flat swatch.
      const sizeFit = clamp01(Math.sqrt((p.box.w * p.box.h) / Math.max(1, totalArea)) / 0.5);
      const score = clamp01(photoScore * 0.6 + shapeFit * 0.28 + sizeFit * 0.12);
      return { ...p, photoScore, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * The widest band of `targetAspect` that fits inside `box`, centred.
 *
 * Centred rather than top-anchored: a portrait photograph's subject is usually
 * nearer the middle than the top, and a top crop of the skateboarder on this
 * board would return sky.
 */
export function landscapeCrop(box: Box, targetAspect: number = DEFAULT_HERO_ASPECT): Box {
  const currentAspect = box.w / box.h;
  if (currentAspect >= targetAspect) {
    // Already wide enough — trim the sides rather than the top, keeping height.
    const w = Math.round(box.h * targetAspect);
    return { x: box.x + Math.round((box.w - w) / 2), y: box.y, w, h: box.h };
  }
  const h = Math.round(box.w / targetAspect);
  return { x: box.x, y: box.y + Math.round((box.h - h) / 2), w: box.w, h };
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

// ── Canvas boundary ────────────────────────────────────────────────────────
// Everything above is pure. Everything below needs an image.

/** Detection runs downscaled — a 3000px board is 9M pixels and the panels are
 *  hundreds of pixels wide, so nothing is lost and the flood fill stays fast.
 *  Boxes are mapped back to full resolution before cropping. */
const DETECT_MAX = 700;

/** How far a pixel may sit from the board's ground and still count as ground.
 *  The dotted texture on a typical board moves a few units, so this is not zero. */
const BG_TOLERANCE = 18;

/** Panels below this share of the board are noise — dots, rules, stray marks. */
const MIN_PANEL_AREA = 0.004;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** The board's ground colour, taken from the border ring. A collage is padded,
 *  so the outermost pixels are background far more often than not. */
function estimateBackground(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<string, number>();
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const k = `${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  let best = '', top = -1;
  for (const [k, n] of counts) if (n > top) { top = n; best = k; }
  const [r, g, b] = best.split(',').map(Number);
  return [r << 3, g << 3, b << 3];
}

/** Bounding boxes of non-background regions, via iterative flood fill.
 *  Iterative rather than recursive: a large panel would blow the call stack. */
function findPanels(mask: Uint8Array, w: number, h: number): Box[] {
  const seen = new Uint8Array(w * h);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w); }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return boxes;
}

/** Measure one region the way scorePanel expects. */
function measure(d: Uint8ClampedArray, w: number, box: Box): PanelStats {
  const counts = new Map<number, number>();
  let edges = 0, satSum = 0, n = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      satSum += max === 0 ? 0 : (max - min) / max;
      if (x < box.x + box.w - 1) {
        const j = i + 4;
        if (Math.abs(d[j] - r) + Math.abs(d[j + 1] - g) + Math.abs(d[j + 2] - b) > 90) edges++;
      }
      n++;
    }
  }
  let top = 0;
  for (const c of counts.values()) if (c > top) top = c;
  return {
    box,
    flatShare: n ? top / n : 1,
    // 4096 is the quantised space; a photograph typically fills a few hundred.
    colourSpread: Math.min(1, counts.size / 400),
    edgeDensity: n ? edges / n : 0,
    saturation: n ? satSum / n : 0,
  };
}

export interface HeroResult {
  /** PNG data URL of the crop. */
  dataUrl: string;
  /** The crop, in the ORIGINAL image's pixels. */
  crop: Box;
  /** Every panel considered, best first — so a UI can offer alternatives. */
  candidates: HeroCandidate[];
  /** True when no panel was found and the whole board was cropped instead. */
  fellBack: boolean;
}

/**
 * Find the best landscape hero in a moodboard and return it as a PNG data URL.
 *
 * Falls back to a centred band of the whole board when no panel is found —
 * a board that is one full-bleed photograph is a legitimate input, and returning
 * nothing there would be worse than returning the obvious crop.
 */
export async function extractHeroImage(
  imageUrl: string,
  targetAspect: number = DEFAULT_HERO_ASPECT,
): Promise<HeroResult> {
  const img = await loadImage(imageUrl);
  const scale = Math.min(1, DETECT_MAX / Math.max(img.width, img.height));
  const dw = Math.max(1, Math.round(img.width * scale));
  const dh = Math.max(1, Math.round(img.height * scale));

  const small = document.createElement('canvas');
  small.width = dw; small.height = dh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('Canvas 2D unavailable');
  sctx.drawImage(img, 0, 0, dw, dh);
  const { data } = sctx.getImageData(0, 0, dw, dh);

  const [br, bg, bb] = estimateBackground(data, dw, dh);
  const mask = new Uint8Array(dw * dh);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const diff = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
    mask[p] = diff > BG_TOLERANCE ? 1 : 0;
  }

  const area = dw * dh;
  const panels = findPanels(mask, dw, dh)
    .filter(b => (b.w * b.h) / area >= MIN_PANEL_AREA)
    // A box spanning nearly the whole board is the board, not a panel.
    .filter(b => (b.w * b.h) / area < 0.92)
    .map(b => measure(data, dw, b));

  const candidates = pickHero(panels, area, targetAspect);
  const fellBack = candidates.length === 0;
  const chosen = fellBack
    ? { x: 0, y: 0, w: dw, h: dh }
    : candidates[0].box;
  const cropSmall = landscapeCrop(chosen, targetAspect);

  // Back to full resolution for the actual crop, so the hero is not a
  // 700px-wide thumbnail.
  const crop: Box = {
    x: Math.round(cropSmall.x / scale),
    y: Math.round(cropSmall.y / scale),
    w: Math.round(cropSmall.w / scale),
    h: Math.round(cropSmall.h / scale),
  };

  const out = document.createElement('canvas');
  out.width = crop.w; out.height = crop.h;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D unavailable');
  octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  return { dataUrl: out.toDataURL('image/png'), crop, candidates, fellBack };
}
