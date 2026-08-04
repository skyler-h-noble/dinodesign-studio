// functions/clipHelpers.js
//
// CLIP wrappers used by analyzeMoodboard. Mirrors the Python v4 notebook
// (font_matcher_v4 cell 4) but built on @huggingface/transformers — the JS
// port that runs ONNX models in Node. The model lives in HF Hub and is
// downloaded to `/tmp` on first invocation, then cached for the lifetime
// of the warm container.
//
// Why Xenova/clip-vit-base-patch32: identical to the openai base model the
// notebook uses (`openai/clip-vit-base-patch32`) but pre-converted to ONNX
// with quantization variants. The `quantized: true` flag drops the model
// from ~150MB to ~60MB — well under Firebase Functions' 250MB deploy cap.

const path = require('path');

const MODEL_ID = 'Xenova/clip-vit-base-patch32';

// The model files are BUNDLED with the function under functions/models/ (see
// scripts to fetch them). Loading locally avoids downloading from HuggingFace
// at runtime, which was getting rate-limited (HTTP 429) on Cloud Functions'
// shared egress IP and crashing analyzeMoodboard with an opaque INTERNAL error.
const LOCAL_MODEL_DIR = path.join(__dirname, 'models');

// Cached singletons. Loaded once per warm container.
let _modulePromise = null;
let _visionModelPromise = null;
let _textModelPromise = null;
let _processorPromise = null;
let _tokenizerPromise = null;

// `@huggingface/transformers` is ESM-only; load via dynamic import so the
// CommonJS `functions/` package can still require this file at the top.
async function loadModule() {
  if (!_modulePromise) {
    _modulePromise = import('@huggingface/transformers').then((mod) => {
      // Load the model from the files bundled under functions/models/ and NEVER
      // reach out to HuggingFace at runtime. Runtime HF downloads were being
      // rate-limited (429) on the function's shared egress IP, which crashed
      // the call with an opaque INTERNAL. localModelPath resolves files as
      // `${localModelPath}/${MODEL_ID}/...`.
      mod.env.cacheDir = '/tmp/transformers-cache';
      mod.env.allowLocalModels = true;
      mod.env.localModelPath = LOCAL_MODEL_DIR;
      mod.env.allowRemoteModels = false;
      return mod;
    });
  }
  return _modulePromise;
}

// v3 split CLIPModel.get_{image,text}_features into two stand-alone projection
// models. Each is loaded q8-quantized (~30 MB each → ~60 MB total vs
// ~330 MB fp32). Keeps the function under 2 GiB during inference.

async function getVisionModel() {
  if (!_visionModelPromise) {
    const { CLIPVisionModelWithProjection } = await loadModule();
    _visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' });
  }
  return _visionModelPromise;
}

async function getTextModel() {
  if (!_textModelPromise) {
    const { CLIPTextModelWithProjection } = await loadModule();
    _textModelPromise = CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' });
  }
  return _textModelPromise;
}

async function getProcessor() {
  if (!_processorPromise) {
    const { AutoProcessor } = await loadModule();
    _processorPromise = AutoProcessor.from_pretrained(MODEL_ID);
  }
  return _processorPromise;
}

async function getTokenizer() {
  if (!_tokenizerPromise) {
    const { AutoTokenizer } = await loadModule();
    _tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID);
  }
  return _tokenizerPromise;
}

/** Embed a moodboard image. `imageUrl` may be any URL the runtime can fetch
 *  (https, data:, file:) — the studio passes a Firebase Storage download URL.
 *  Returns a Float32Array (length 512 for ViT-B/32). */
async function getImageEmbedding(imageUrl) {
  const { RawImage } = await loadModule();
  const [model, processor] = await Promise.all([getVisionModel(), getProcessor()]);

  const image = await RawImage.read(imageUrl);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  // Tensor.data is a typed array sized for the model's output dtype. For q8
  // the values are dequantized to fp32 in the projection head, so .data is
  // already Float32Array. Copy to be safe (the underlying buffer may be reused).
  return new Float32Array(image_embeds.data);
}

/** Embed N text prompts in a single batched forward pass. Returns an array
 *  of N Float32Arrays, each length 512. */
async function getTextEmbeddings(texts) {
  const [model, tokenizer] = await Promise.all([getTextModel(), getTokenizer()]);
  const inputs = tokenizer(texts, { padding: true, truncation: true });
  const { text_embeds } = await model(inputs);

  const dim = text_embeds.dims[text_embeds.dims.length - 1];
  const flat = text_embeds.data;
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    // Slice — typed-array views over the same buffer mean later batches
    // would overwrite earlier embeddings before we use them.
    out.push(new Float32Array(flat.slice(i * dim, (i + 1) * dim)));
  }
  return out;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity for two L2-norm-able Float32Array vectors of equal dim. */
function cosineSimilarity(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/** Softmax with temperature `t` (default 10 — matches the notebook). */
function softmax(values, t = 10) {
  const scaled = values.map((v) => Math.exp(v * t));
  const sum = scaled.reduce((acc, v) => acc + v, 0);
  return scaled.map((v) => v / sum);
}

/** Pick the best category for an image embedding by mean cosine sim against
 *  each category's prompt cluster, then softmax×10 normalize.
 *  Returns { category, scores } where scores is { categoryName: probability }. */
async function classifyFont(imgEmb, CATEGORIES) {
  const catNames = Object.keys(CATEGORIES);
  const rawScores = [];

  for (const cat of catNames) {
    const embs = await getTextEmbeddings(CATEGORIES[cat]);
    const sims = embs.map((e) => cosineSimilarity(imgEmb, e));
    rawScores.push(sims.reduce((a, b) => a + b, 0) / sims.length);
  }

  const probs = softmax(rawScores, 10);
  const scores = {};
  catNames.forEach((cat, i) => { scores[cat] = probs[i]; });

  let bestCat = catNames[0];
  let bestProb = -Infinity;
  for (const cat of catNames) {
    if (scores[cat] > bestProb) {
      bestProb = scores[cat];
      bestCat = cat;
    }
  }
  return { category: bestCat, scores };
}

/** Per-modifier-axis classifier: returns { weight: 'thin'|'regular'|'heavy',
 *  width: 'condensed'|'normal'|'extended' } picking the best option in each. */
async function classifyModifiers(imgEmb, MODIFIERS) {
  const result = {};
  for (const [axis, options] of Object.entries(MODIFIERS)) {
    const optNames = Object.keys(options);
    const optScores = {};
    for (const name of optNames) {
      const embs = await getTextEmbeddings(options[name]);
      const sims = embs.map((e) => cosineSimilarity(imgEmb, e));
      optScores[name] = sims.reduce((a, b) => a + b, 0) / sims.length;
    }
    let best = optNames[0];
    for (const name of optNames) {
      if (optScores[name] > optScores[best]) best = name;
    }
    result[axis] = best;
  }
  return result;
}

/** Score every font in `fontNames` against the image. Each font becomes the
 *  prompt "<name> font typeface typography" and is batched 20 at a time to
 *  amortize tokenization + forward pass overhead. */
async function scoreFonts(imgEmb, fontNames, batchSize = 20) {
  const scores = {};
  for (let i = 0; i < fontNames.length; i += batchSize) {
    const batch = fontNames.slice(i, i + batchSize);
    const prompts = batch.map((n) => `${n} font typeface typography`);
    const embs = await getTextEmbeddings(prompts);
    embs.forEach((emb, j) => {
      scores[batch[j]] = cosineSimilarity(imgEmb, emb);
    });
  }
  return scores;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function topN(scoresMap, n) {
  return Object.entries(scoresMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}

/** Build header/decorative pools. `samePool` is the detected category's own
 *  fonts; `crossPools` is an array of other categories per pairing_rules.
 *  Returns { same: [topN names], cross: [topN names] }, with excludes and
 *  never-pair filtering applied. */
async function getFontGroup(imgEmb, samePool, crossPools, neverPair, exclude, n = 10) {
  const excludeSet = new Set(exclude);
  const neverSet = new Set(neverPair);

  const cleanSame = samePool.filter((f) => !excludeSet.has(f) && !neverSet.has(f));
  const cleanSameSet = new Set(cleanSame);
  const cleanCross = uniq(
    crossPools.flat().filter((f) =>
      !excludeSet.has(f) && !neverSet.has(f) && !cleanSameSet.has(f)
    )
  );

  const [sameScores, crossScores] = await Promise.all([
    scoreFonts(imgEmb, cleanSame),
    scoreFonts(imgEmb, cleanCross),
  ]);

  return { same: topN(sameScores, n), cross: topN(crossScores, n) };
}

/** Body pool selection. Body is always sans-serif regardless of the detected
 *  branch — readability beats stylistic cohesion at body sizes, and the
 *  serif/sans split + 1.15× boost the notebook used was just a soft preference
 *  that occasionally surfaced unreadable display serifs as body fonts.
 *  `branch` is kept in the signature for callers that still pass it. */
async function getBodyGroup(imgEmb, _branch, exclude, BODY_POOL, n = 20) {
  const excludeSet = new Set(exclude);
  const pool = uniq(BODY_POOL.sans).filter((f) => !excludeSet.has(f));
  const scores = await scoreFonts(imgEmb, pool);
  return topN(scores, n);
}

// ── Text-vs-non-text gate ────────────────────────────────────────────────────
//
// Zero-shot CLIP gate that runs BEFORE typography classification. Filters out
// crops that are obviously not text — UI icons, photos, logo marks, decorative
// shapes — so downstream pixel + category analysis doesn't waste cycles trying
// to read serif feet off a camera icon.
//
// The prompt set deliberately mixes a couple of phrasings per class because
// CLIP is sensitive to prompt wording; averaging across siblings reduces noise.
// Class names ("text", "icon", "photo", "logo", "decoration") are returned as
// `topLabel` so Step B can log which type the gate thought a rejected crop was.
const TEXT_GATE_PROMPTS = {
  text: [
    'text or typography',
    'a letter, word, or written character',
    'a typeface sample',
  ],
  icon: [
    'a UI icon or symbol',
    'an interface icon',
    'a pictogram',
  ],
  photo: [
    'a photograph',
    'a photo of a person or scene',
  ],
  logo: [
    'a logo mark or brand symbol',
  ],
  decoration: [
    'a decorative pattern or shape',
    'abstract art or texture',
  ],
};

/** Run the text-vs-non-text gate on a precomputed image embedding. Returns
 *  { verdict: 'text' | 'reject', topLabel, scores } where topLabel is the
 *  winning class name (one of the keys of TEXT_GATE_PROMPTS). Verdict is
 *  'text' iff text wins outright. */
async function classifyTextVsNonText(imgEmb) {
  const result = await classifyFont(imgEmb, TEXT_GATE_PROMPTS);
  return {
    verdict: result.category === 'text' ? 'text' : 'reject',
    topLabel: result.category,
    scores: result.scores,
  };
}

/** Cheap warm-up: triggers model + processor + tokenizer download/load so the
 *  next real call doesn't pay the cold-start cost. Studio fires this when the
 *  user uploads their moodboard, ~30s before they hit "Generate". */
async function warmup() {
  await Promise.all([getVisionModel(), getTextModel(), getProcessor(), getTokenizer()]);
}

module.exports = {
  getImageEmbedding,
  getTextEmbeddings,
  cosineSimilarity,
  classifyFont,
  classifyModifiers,
  classifyTextVsNonText,
  scoreFonts,
  getFontGroup,
  getBodyGroup,
  warmup,
  TEXT_GATE_PROMPTS,
};
