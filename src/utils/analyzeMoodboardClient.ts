import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from './firebase/client';
import { extractImageProps } from './imageAnalysis';
import type { ImageProps } from './imageAnalysis';
import { cropFromBboxes, cropPixelFallback } from './textDetection';
import type { TextCrops, OcrDiag, ExtractedTextRegion } from './textDetection';

export type { ExtractedTextRegion } from './textDetection';

const functions = getFunctions(firebaseApp);

export type TrioType = 'mood_preset' | 'mood_alt' | 'same_style' | 'cross_pair';
export type Branch = 'Serif' | 'Sans serif' | 'Expressive';

export interface RoleSpec {
  weight: string;
  letter_spacing: string;
}

export interface TypographySpecs {
  header: RoleSpec;
  decorative: RoleSpec;
  body: {
    regular:  RoleSpec;
    semibold: RoleSpec;
    bold:     RoleSpec;
  };
}

export interface FontTrio {
  header: string;
  decorative: string;
  body: string;
  type: TrioType;
  mood?: { key: string; label: string; confidence: number };
}

export type RoleSource = 'text_crop' | 'whole_image';

export type Modifiers = {
  weight: 'thin' | 'regular' | 'heavy';
  width: 'condensed' | 'normal' | 'extended';
};

export interface MoodboardAnalysis {
  category: string;
  branch: Branch;
  style: string;
  modifiers: Modifiers;
  /** CLIP-classified modifiers against the header crop's embedding (when a
   *  crop was provided); falls back to whole-image modifiers otherwise. */
  headerModifiers?: Modifiers;
  decorativeModifiers?: Modifiers;
  /** Per-crop category labels — the actual category CLIP picked for the
   *  header / decorative text crop, distinct from the whole-image category. */
  headerCategory?: string;
  headerBranch?: Branch;
  headerStyle?: string;
  headerCategoryConfidence?: number;     // 0..1 softmax for the winning header category
  decorativeCategory?: string;
  decorativeBranch?: Branch;
  decorativeStyle?: string;
  decorativeCategoryConfidence?: number;
  decorativePickReason?: 'second_tallest_or_all_caps' | 'script_handwritten' | 'none';
  specs: TypographySpecs;
  mood: { key: string; label: string; confidence: number } | null;
  trios: FontTrio[];
  debug?: {
    categoryScores: Record<string, number>;
    moodScores: Record<string, number>;
    elapsedMs: number;
    headerSource: RoleSource;
    decorativeSource: RoleSource;
    ocrRegionCount: number;
    ocr?: OcrDiag;
  };
  /** Client-only: every text region the browser OCR found on the moodboard,
   *  tallest first. Surfaced so the picker can show "all text styles
   *  extracted from your file" without re-running OCR. */
  extractedText: ExtractedTextRegion[];
}

interface CallPayload {
  imageUrl: string;
  props: ImageProps;
  crops?: {
    header?: string;
    decorative?: string;
    regionCount: number;
    /** Other detected regions (not used for header) — server uses these
     *  for the Phase 2 script/handwritten Decorative fallback when the
     *  client's Phase 1 (all-caps) pick didn't find a match. */
    candidates?: Array<{ dataUrl: string; isAllCaps: boolean }>;
  };
}

/** Module-level analysis cache keyed by URL. Lets the create flow kick off
 *  the (slow, 6-15s warm, 20-40s cold) analyze call at UPLOAD time and have
 *  the result waiting when the user finally lands on the typography stage —
 *  the user is staring at color/color-assignment screens in the meantime,
 *  so the analysis budget runs in their dead time, not their attention time. */
const analysisPromiseCache = new Map<string, Promise<MoodboardAnalysis>>();

/** Start (or retrieve a cached) analysis for the given URL. Safe to call
 *  many times — subsequent calls return the same promise. */
export function getOrStartMoodboardAnalysis(imageUrl: string): Promise<MoodboardAnalysis> {
  let promise = analysisPromiseCache.get(imageUrl);
  if (!promise) {
    promise = analyzeMoodboard(imageUrl).catch((err) => {
      // Failed runs shouldn't poison the cache — let the next caller retry.
      analysisPromiseCache.delete(imageUrl);
      throw err;
    });
    analysisPromiseCache.set(imageUrl, promise);
  }
  return promise;
}

/** Run the full CLIP pipeline server-side. Expect ~6–15s warm, ~20–40s cold —
 *  callers should show a loading state. Pre-call `warmAnalyzeMoodboard()` at
 *  upload time if you want to avoid the cold-start tax.
 *
 *  Text detection is server-side via Google Cloud Vision. The client just
 *  forwards the image URL and the resulting word-level bboxes are cropped
 *  client-side from the original image before being sent to CLIP. */
export async function analyzeMoodboard(imageUrl: string): Promise<MoodboardAnalysis> {
  const [props, crops] = await Promise.all([
    extractImageProps(imageUrl),
    safelyGetCrops(imageUrl),
  ]);
  const call = httpsCallable<CallPayload, MoodboardAnalysis>(functions, 'analyzeMoodboard');
  const { diag, regions, ...crops_payload } = crops;
  // Build candidates from every non-header region so the server has options
  // for the Phase 2 script/handwritten Decorative fallback.
  const candidates = regions.slice(1).map((r) => ({
    dataUrl: r.dataUrl,
    isAllCaps: r.isAllCaps,
  }));
  const { data } = await call({
    imageUrl,
    props,
    crops: { ...crops_payload, candidates },
  });
  return {
    ...data,
    debug: data.debug ? { ...data.debug, ocr: diag } : undefined,
    extractedText: regions,
  };
}

// detectTextRegionsGCV is an onRequest function (raw HTTP, explicit CORS) —
// onCall + cors:true was unreliable from localhost in v2. We call it with
// fetch directly to its Cloud Functions URL.
const GCV_ENDPOINT = 'https://us-central1-dino-design.cloudfunctions.net/detectTextRegionsGCV';

/** Try GCV first; if it errors or returns no regions, run the pixel-fallback
 *  heuristic client-side so the rest of the pipeline still gets crops to
 *  work with. The GCV error (when present) is preserved in the diag string. */
async function safelyGetCrops(imageUrl: string): Promise<TextCrops> {
  const gcv = await safelyCropTextGCV(imageUrl);
  if (gcv.regions.length > 0) return gcv;
  console.info('[crop] GCV returned 0 regions or failed; trying pixel-fallback');
  const pixel = await cropPixelFallback(imageUrl);
  if (gcv.diag.error && !pixel.diag.error) {
    pixel.diag.error = `gcv failed → pixel-fallback: ${gcv.diag.error}`;
  }
  return pixel;
}

/** Call the Google Cloud Vision text-detection cloud function and turn its
 *  word-level bboxes into phrase-level CLIP-ready crops. */
async function safelyCropTextGCV(imageUrl: string): Promise<TextCrops> {
  const t0 = Date.now();
  try {
    const response = await fetch(GCV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }
    const data: {
      words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
      fullText: string;
      elapsedMs: number;
    } = await response.json();
    console.info('[gcv] words:', data.words.length, 'elapsedMs:', data.elapsedMs);
    if (data.words.length === 0) {
      return {
        regionCount: 0,
        regions: [],
        diag: { wordCount: 0, elapsedMs: data.elapsedMs },
      };
    }
    const bboxes = data.words.map((w) => ({ ...w.bbox, text: w.text }));
    return await cropFromBboxes(imageUrl, bboxes, { elapsedMs: data.elapsedMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('GCV text crop failed:', err);
    return {
      regionCount: 0,
      regions: [],
      diag: { wordCount: 0, elapsedMs: Date.now() - t0, error: msg },
    };
  }
}

/** Re-run the cloud matcher with the user's picked header / decorative crops
 *  instead of the OCR defaults. Used by the Header / Decorative tabs when the
 *  user selects a different extracted text region as the source.
 *
 *  We send BOTH crops in every call so the role that wasn't touched keeps its
 *  original ranking — the server doesn't know which role the UI is re-matching.
 *  The original extractedText list is carried through unchanged so the per-role
 *  tabs don't lose their crops between matches. */
export async function rematchWithCrops(
  imageUrl: string,
  originalExtracted: ExtractedTextRegion[],
  picks: { headerIdx: number; decorativeIdx: number }
): Promise<MoodboardAnalysis> {
  const props = await extractImageProps(imageUrl);
  const header = originalExtracted[picks.headerIdx]?.dataUrl;
  const decorative = originalExtracted[picks.decorativeIdx]?.dataUrl;
  const cropsPayload = {
    header,
    decorative,
    regionCount: originalExtracted.length,
  };
  const call = httpsCallable<CallPayload, MoodboardAnalysis>(functions, 'analyzeMoodboard');
  const { data } = await call({ imageUrl, props, crops: cropsPayload });
  return { ...data, extractedText: originalExtracted };
}

/** Fire-and-forget warm-up. Call right after the moodboard finishes uploading
 *  so the model is loaded by the time the user reaches the typography stage.
 *  Swallows errors — the real call later will surface anything that matters. */
export function warmAnalyzeMoodboard(): void {
  const call = httpsCallable<Record<string, never>, { ok: boolean; elapsedMs: number }>(
    functions,
    'warmAnalyzeMoodboard'
  );
  call({}).catch((err) => {
    console.warn('warmAnalyzeMoodboard failed (non-fatal):', err);
  });
}
