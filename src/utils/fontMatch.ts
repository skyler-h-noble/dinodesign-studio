// fontMatch.ts — rank the suggested families against the lettering in the
// image. Entirely local: canvas plus arithmetic, no API, no model, no tokens.
//
// Ported from omni-type-studio's src/lib/fontMatch.js.
//
// Two independent scores, measuring deliberately different things:
//
//   A. Metric fingerprint. Render the candidate to a canvas and push it through
//      the SAME analyzeStrokes() the image crop goes through. Comparing stroke
//      weight, serif feet and stems-per-letter is only meaningful because both
//      sides are measured by one function on one ruler. Blind to proportion —
//      a condensed and an extended grotesque of the same weight fingerprint
//      alike.
//   B. Ink overlay. Binarise both, stretch to a common grid, score the overlap
//      plus the per-column ink profile, and score width-to-height separately.
//      This is the half that sees proportion. Needs the real OCR string, so it
//      is skipped when we don't have one.
//
// The scores are averaged when both are available. Neither is a similarity
// metric in any rigorous sense — they rank a fixed pool of candidates against
// one crop, which is all the UI claims.

import { analyzeStrokes, type StrokeAnalysis } from './textDetection';
import { fontFamilyParam } from './googleFontWeights';

/** Same cut the stroke analyzer binarises at, so "ink" means the same thing on
 *  both sides. */
const THRESHOLD = 120;
/** After the downsample to the comparison grid, antialiasing greys out thin
 *  strokes — a slightly looser cut keeps hairlines from vanishing. */
const GRID_THRESHOLD = 160;
const GRID_W = 256;
const GRID_H = 64;
/** Render size for candidates. Tight-cropped this lands near the 80px letter
 *  height analyzeStrokes wants, so it neither up- nor down-samples much. */
const RENDER_PX = 130;
/**
 * Candidates are always drawn at 400, NOT at the Display weight.
 *
 * Font requests return the default 400 instance, so asking canvas for 700 gets
 * SYNTHETIC bold — a uniform pixel dilation that has nothing to do with how
 * that family's bold is drawn. It thickens every candidate toward whatever the
 * heaviest face already is, which alone was enough to rank a heavy brush script
 * above a light pen one. Comparing every family at the instance we actually
 * have is the honest version.
 */
const RENDER_WEIGHT = 400;
/** Below this the ink is a speck (JPEG noise, an antialiased dot), not a mark. */
const MIN_BLOB = 6;

const letterCount = (t: string) => (t.match(/[A-Za-z]/g) || []).length;

/** Text we can actually set in a candidate face and compare like-for-like. */
export function isRenderableText(text: string | undefined): boolean {
  return letterCount(text || '') >= 2;
}

export interface FontScore {
  family: string;
  /** 0–1 overall. The number the chip shows. */
  score: number;
  /** 0–1 metric-fingerprint half, when measurable. */
  metric: number | null;
  /** 0–1 ink-overlay half, when an OCR string was available. */
  overlay: number | null;
  /** Position in the ranking; 0 is the closest. */
  rank: number;
}

// ─── canvas helpers ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('crop failed to load'));
    img.src = src;
  });
}

/** Draw one string in one family, tight-cropped to its ink. */
function renderCandidate(family: string, text: string): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const font = `${RENDER_WEIGHT} ${RENDER_PX}px "${family}"`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + RENDER_PX;
  const h = RENDER_PX * 3;
  canvas.width = Math.max(8, w);
  canvas.height = h;

  const c = canvas.getContext('2d', { willReadFrequently: true });
  if (!c) return null;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#000';
  c.textBaseline = 'alphabetic';
  c.font = font;
  c.fillText(text, RENDER_PX / 2, RENDER_PX * 1.8);

  return tightCrop(canvas);
}

/** Trim a rendered canvas to the bounding box of its ink. */
function tightCrop(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      if (lum < THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0 || y1 < 0) return null;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** A canvas → a binary ink grid of fixed size, so two differently-shaped
 *  images can be compared cell for cell. */
function inkGrid(canvas: HTMLCanvasElement): Uint8Array | null {
  const grid = document.createElement('canvas');
  grid.width = GRID_W;
  grid.height = GRID_H;
  const ctx = grid.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, GRID_W, GRID_H);
  ctx.drawImage(canvas, 0, 0, GRID_W, GRID_H);
  const data = ctx.getImageData(0, 0, GRID_W, GRID_H).data;
  const out = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    out[p] = lum < GRID_THRESHOLD ? 1 : 0;
  }
  return out;
}

/** Load a crop and tight-crop it, so both sides are measured on their ink
 *  rather than on whatever padding the crop was built with. */
async function cropCanvas(dataUrl: string): Promise<HTMLCanvasElement | null> {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return tightCrop(canvas);
  } catch {
    return null;
  }
}

// ─── the two scores ──────────────────────────────────────────────────────────

const WEIGHT_ORDER = ['thin', 'regular', 'heavy'];

/**
 * Half A — compare two stroke fingerprints measured by the same function.
 * Weight distance dominates; serif feet and stems-per-letter refine it.
 */
function metricScore(a: StrokeAnalysis, b: StrokeAnalysis): number {
  // Ratio distance is the real measurement; the bucket is the coarse backup
  // for when one side failed to measure a ratio at all.
  let weightTerm: number;
  if (a.weightRatio > 0 && b.weightRatio > 0) {
    const diff = Math.abs(a.weightRatio - b.weightRatio);
    weightTerm = Math.max(0, 1 - diff / 0.18);
  } else {
    const ia = WEIGHT_ORDER.indexOf(a.weight);
    const ib = WEIGHT_ORDER.indexOf(b.weight);
    weightTerm = ia < 0 || ib < 0 ? 0.5 : 1 - Math.abs(ia - ib) / 2;
  }

  // Serif feet is close to binary and highly diagnostic — a serif and a sans
  // are never the same face, whatever else agrees.
  const serifTerm = 1 - Math.abs(a.serifFootRatio - b.serifFootRatio);

  // Script and hand signals: agreeing on "this is joined-up writing" matters
  // more than any stroke measurement.
  const scriptTerm = (a.isLikelyScript === b.isLikelyScript ? 1 : 0);
  const handTerm = (a.isLikelyHand === b.isLikelyHand ? 1 : 0);

  return clamp01(
    weightTerm * 0.4 + serifTerm * 0.25 + scriptTerm * 0.2 + handTerm * 0.15
  );
}

/**
 * Half B — how much of the ink lands in the same places, plus whether the two
 * have the same proportion. This is the part that can tell a condensed face
 * from an extended one.
 */
function overlayScore(
  candidate: HTMLCanvasElement,
  crop: HTMLCanvasElement,
): number | null {
  const a = inkGrid(candidate);
  const b = inkGrid(crop);
  if (!a || !b) return null;

  let inter = 0, union = 0, aInk = 0, bInk = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) inter++;
    if (a[i]) aInk++;
    if (b[i]) bInk++;
  }
  if (aInk < MIN_BLOB || bInk < MIN_BLOB || union === 0) return null;

  // Intersection over union — the plain overlap.
  const iou = inter / union;

  // Per-column ink profile. Two faces setting the same word put their stems in
  // similar places even when the overlap is mediocre, so this rescues a good
  // match that happens to sit a pixel off.
  const colsA = new Float32Array(GRID_W);
  const colsB = new Float32Array(GRID_W);
  for (let x = 0; x < GRID_W; x++) {
    let ca = 0, cb = 0;
    for (let y = 0; y < GRID_H; y++) {
      ca += a[y * GRID_W + x];
      cb += b[y * GRID_W + x];
    }
    colsA[x] = ca / GRID_H;
    colsB[x] = cb / GRID_H;
  }
  let profile = 0;
  for (let x = 0; x < GRID_W; x++) profile += 1 - Math.abs(colsA[x] - colsB[x]);
  profile /= GRID_W;

  // Proportion: width per unit height, before both were stretched to the grid.
  const arA = candidate.width / Math.max(1, candidate.height);
  const arB = crop.width / Math.max(1, crop.height);
  const ratio = Math.min(arA, arB) / Math.max(arA, arB);

  return clamp01(iou * 0.45 + profile * 0.3 + ratio * 0.25);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ─── font loading ────────────────────────────────────────────────────────────

/**
 * Every candidate has to be LOADED before it can be measured.
 *
 * Canvas silently falls back when `ctx.font` names a family the document
 * doesn't have — so an unloaded pool renders every candidate in the same
 * default face, producing identical fingerprints and a ranking where all 33
 * families score the same. The fallback is invisible; the identical scores are
 * the only symptom.
 */
async function ensureFamiliesLoaded(families: string[]): Promise<void> {
  if (typeof document === 'undefined' || families.length === 0) return;

  const id = 'font-match-pool';
  const wanted = families.join('|');
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (!existing || existing.dataset.families !== wanted) {
    existing?.remove();
    // Only the 400 instance is measured (see RENDER_WEIGHT), so that is all we
    // ask for — a smaller request that is also the one we actually compare.
    const param = families.map((f) => fontFamilyParam(f, [RENDER_WEIGHT])).join('&');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${param}&display=swap`;
    link.dataset.families = wanted;
    document.head.appendChild(link);
  }

  if (!('fonts' in document)) return;
  await Promise.allSettled(
    families.map((f) => (document as Document).fonts.load(`${RENDER_WEIGHT} ${RENDER_PX}px "${f}"`))
  );
  // A face that arrives after the stylesheet parses still needs a tick before
  // canvas will use it.
  await new Promise((r) => setTimeout(r, 120));
}

// ─── the ranking ─────────────────────────────────────────────────────────────

export interface MatchInput {
  /** The crop the Display is sampled from. */
  dataUrl: string;
  /** The stroke fingerprint already measured on that crop. */
  stroke: StrokeAnalysis;
  /** What OCR read. Needed for the overlay half. */
  text: string;
}

/**
 * Rank `families` against one crop. Runs entirely on the main thread but is
 * chunked by `await`s so a 40-family pool doesn't freeze the panel.
 */
export async function rankFamilies(
  region: MatchInput,
  families: string[],
): Promise<FontScore[]> {
  await ensureFamiliesLoaded(families);
  const crop = await cropCanvas(region.dataUrl);
  const canOverlay = !!crop && isRenderableText(region.text);
  const text = region.text.trim();

  const scored: Omit<FontScore, 'rank'>[] = [];
  for (const family of families) {
    // Yield between candidates — each one rasterises a canvas.
    await new Promise((r) => setTimeout(r, 0));

    const sample = canOverlay ? text : 'Hamburgefonstiv';
    // A family that never loaded would be measured as the fallback face and
    // score like every other unloaded candidate — better to report nothing.
    const available = !('fonts' in document)
      || (document as Document).fonts.check(`${RENDER_WEIGHT} ${RENDER_PX}px "${family}"`);
    if (!available) {
      scored.push({ family, score: 0, metric: null, overlay: null });
      continue;
    }
    const rendered = renderCandidate(family, sample);
    if (!rendered) {
      scored.push({ family, score: 0, metric: null, overlay: null });
      continue;
    }

    // Metric half — same analyzer, same ruler as the crop.
    let metric: number | null = null;
    try {
      const asImage = new Image();
      asImage.src = rendered.toDataURL();
      await new Promise((res) => { asImage.onload = res; asImage.onerror = res; });
      if (asImage.naturalWidth > 0) {
        const fingerprint = analyzeStrokes(asImage, {
          x0: 0, y0: 0, x1: asImage.naturalWidth, y1: asImage.naturalHeight,
        });
        if (!fingerprint.measurementFailed) metric = metricScore(fingerprint, region.stroke);
      }
    } catch { /* metric stays null */ }

    const overlay = canOverlay && crop ? overlayScore(rendered, crop) : null;

    const parts = [metric, overlay].filter((v): v is number => v !== null);
    const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    scored.push({ family, score, metric, overlay });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i }));
}
