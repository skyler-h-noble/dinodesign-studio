// functions/analyzeMoodboard.js
//
// CLIP-driven typography matcher. Replaces the studio's old Teachable
// Machine + OCR pipeline. Given a moodboard image URL (Firebase Storage)
// plus a few pre-computed image properties (brightness, saturation,
// contrast, hue family) the function returns:
//
//   - the matched mood preset (or null if no preset clears threshold)
//   - the detected typographic category + branch/style labels
//   - weight/width modifiers
//   - a `specs` block with header/decorative/body weights + letter-spacing
//   - 20 font trios (10 same-style, 10 cross-pair) ranked by CLIP score
//
// Two exported callables:
//   analyzeMoodboard — the real classifier
//   warmAnalyzeMoodboard — no-op that triggers model load; studio calls this
//                          when the user uploads the moodboard so the real
//                          call later doesn't pay the cold-start cost.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');

const FONT_LIBRARY = require('./data/font_library.json');
const MOOD_PRESETS = require('./data/mood_presets.json');
const {
  CATEGORIES,
  PRIMARY_BRANCH,
  CATEGORIES_BY_BRANCH,
  MODIFIERS,
  CATEGORY_LABELS,
  LETTER_SPACING,
  HEADER_WEIGHT,
  DECORATIVE_WEIGHT,
  BODY_WEIGHTS,
} = require('./data/promptDictionaries');
const clip = require('./clipHelpers');

/** Classify category with a 3-way branch pre-check. Cuts CLIP confusion
 *  between e.g. bold display sans and bold display serif by forcing the
 *  category winner into the in-branch subset of CATEGORIES. */
async function classifyCategoryWithBranch(emb) {
  const branchResult = await clip.classifyFont(emb, PRIMARY_BRANCH);
  const branch = branchResult.category; // 'serif' | 'sans_serif' | 'expressive'
  const eligibleNames = CATEGORIES_BY_BRANCH[branch] || Object.keys(CATEGORIES);
  const filtered = {};
  for (const name of eligibleNames) {
    if (CATEGORIES[name]) filtered[name] = CATEGORIES[name];
  }
  const catResult = await clip.classifyFont(emb, filtered);
  return {
    branch,
    branchConfidence: branchResult.scores[branch] ?? 0,
    category: catResult.category,
    scores: catResult.scores,
  };
}

const RUNTIME_OPTS = {
  region: 'us-central1',
  // 2 GiB — CLIP fp32 OOMs at 1 GiB even with int8 weights, because the
  // intermediate activations + ONNX runtime buffers still need headroom.
  memory: '2GiB',
  timeoutSeconds: 120,
  // Keep one warm instance — covers the typical "upload then generate"
  // gap without paying for an idle pool.
  minInstances: 0,
  concurrency: 1,
};

// ── MOOD DETECTION ───────────────────────────────────────────────────
//
// Verbatim JS port of match_mood() from font_matcher_v4 cell 4. The studio
// computes the image properties client-side and passes them in.

const MOOD_THRESHOLD = 0.12;

function matchMood(props) {
  if (!props) return { key: null, confidence: 0, scores: {} };

  const b = props.brightness ?? 0.5;
  const s = props.saturation ?? 0.3;
  const c = props.contrast   ?? 0.2;
  const hue = props.hueFamily ?? 'neutral';

  const inFamily = (...families) => families.includes(hue);

  const scores = {
    neon_cyberpunk:         inFamily('purple','cyan','pink','green') ? ((1-b)*0.4 + s*0.4 + c*0.2) : 0,
    soft_romantic:          inFamily('pink','neutral') ? (b*0.4 + (1-s)*0.3 + (1-c)*0.3) : b*0.2,
    luxury_editorial_black: inFamily('neutral','amber') ? ((1-b)*0.6 + (1-s)*0.2 + c*0.2) : 0,
    old_money:              inFamily('neutral','amber') ? (b*0.4 + (1-s)*0.4 + (1-c)*0.2) : 0,
    natural_organic:        inFamily('green','amber','orange','neutral') ? (0.5 + (1-Math.abs(b-0.55))*0.3 + (1-Math.abs(s-0.25))*0.2) : 0.2,
    clean_tech:             inFamily('blue','neutral','cyan') ? (b*0.4 + (1-s)*0.3 + (1-c)*0.3) : b*0.15,
    warm_retro_vintage:     inFamily('amber','orange','red') ? ((1-Math.abs(b-0.45))*0.4 + (1-Math.abs(s-0.4))*0.3) : 0.15,
    whimsical_playful:      b*0.3 + s*0.5 + c*0.2,
    industrial_urban:       inFamily('neutral','blue') ? ((1-b)*0.4 + (1-s)*0.4 + c*0.2) : 0,
    boho_festival:          inFamily('orange','red','amber','pink') ? ((1-Math.abs(b-0.5))*0.3 + (1-Math.abs(s-0.45))*0.4) : 0.15,
    minimal_scandinavian:   inFamily('neutral','blue') ? (b*0.5 + (1-s)*0.4 + (1-c)*0.1) : b*0.2,
    dark_romance_gothic:    inFamily('purple','blue','red','neutral') ? ((1-b)*0.5 + (1-Math.abs(s-0.4))*0.3 + c*0.2) : 0,
    modern_luxury_fashion:  hue === 'neutral' ? (b*0.5 + (1-s)*0.35 + (1-c)*0.15) : b*0.1,
    editorial_modern:       b*0.3 + (1-s)*0.4 + (1-Math.abs(c-0.25))*0.3,
  };

  const total = Object.values(scores).reduce((acc, v) => acc + v, 0);
  const normalized = total > 0
    ? Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v / total]))
    : scores;

  let bestKey = null;
  let bestConf = -Infinity;
  for (const [k, v] of Object.entries(normalized)) {
    if (v > bestConf) { bestConf = v; bestKey = k; }
  }

  const cleared = bestConf >= MOOD_THRESHOLD && MOOD_PRESETS.moods?.[bestKey];
  return {
    key: cleared ? bestKey : null,
    confidence: bestConf,
    scores: normalized,
  };
}

// ── SPECS BUILDER ────────────────────────────────────────────────────

function buildSpecs(category, weightModifier) {
  const hSpacing = LETTER_SPACING.header[category];
  const dSpacing = LETTER_SPACING.decorative[category];
  const bSpacing = LETTER_SPACING.body;
  return {
    header:     { weight: HEADER_WEIGHT[weightModifier],     letter_spacing: hSpacing },
    decorative: { weight: DECORATIVE_WEIGHT[weightModifier], letter_spacing: dSpacing },
    body: {
      regular:  { weight: BODY_WEIGHTS.regular,  letter_spacing: bSpacing },
      semibold: { weight: BODY_WEIGHTS.semibold, letter_spacing: bSpacing },
      bold:     { weight: BODY_WEIGHTS.bold,     letter_spacing: bSpacing },
    },
  };
}

// ── TRIO COMPOSITION ─────────────────────────────────────────────────

function pick(arr, i) {
  return arr[i % arr.length];
}

function buildTrios(headerSame, headerCross, decoSame, decoCross, body) {
  const trios = [];
  for (let i = 0; i < 10; i++) {
    trios.push({
      header:     pick(headerSame, i),
      decorative: pick(decoSame, i),
      body:       pick(body, i),
      type:       'same_style',
    });
  }
  for (let i = 0; i < 10; i++) {
    trios.push({
      header:     pick(headerCross, i),
      decorative: pick(decoCross, i),
      body:       pick(body, i + 10),
      type:       'cross_pair',
    });
  }
  return trios;
}

// ── MAIN CALLABLE ────────────────────────────────────────────────────

exports.analyzeMoodboard = onCall(RUNTIME_OPTS, async (request) => {
  const { imageUrl, props, crops } = request.data || {};
  if (!imageUrl) {
    throw new HttpsError('invalid-argument', 'imageUrl is required');
  }

  const t0 = Date.now();
  logger.info('analyzeMoodboard start', {
    imageUrl,
    hasProps: !!props,
    headerCrop: !!crops?.header,
    decorativeCrop: !!crops?.decorative,
    ocrRegionCount: crops?.regionCount ?? 0,
  });

  // 1. Whole-image embedding — used for category, modifiers, body, and as the
  //    fallback when OCR didn't find a header or decorative text region.
  //    (Cold start happens here on first call.)
  const imgEmb = await clip.getImageEmbedding(imageUrl);

  // 2. Per-role embeddings from the OCR crops, when available. Failure here is
  //    non-fatal — we degrade to the whole-image embedding for that role so the
  //    pipeline never breaks on a malformed crop.
  let headerEmb = imgEmb;
  let decorativeEmb = imgEmb;
  let headerSource = 'whole_image';
  let decorativeSource = 'whole_image';

  if (crops?.header) {
    try {
      headerEmb = await clip.getImageEmbedding(crops.header);
      headerSource = 'text_crop';
    } catch (err) {
      logger.warn('header crop embedding failed, using whole image', { err: String(err) });
    }
  }
  // Phase 2 decorative pick — only kicks in when the client didn't already
  // provide a decorative crop (no all-caps region was found client-side) AND
  // the request supplies candidates we can inspect.
  let decorativePickReason = crops?.decorative ? 'second_tallest_or_all_caps' : 'none';
  if (crops?.decorative) {
    try {
      decorativeEmb = await clip.getImageEmbedding(crops.decorative);
      decorativeSource = 'text_crop';
    } catch (err) {
      logger.warn('decorative crop embedding failed, using whole image', { err: String(err) });
    }
  }

  // 3. Category + whole-image modifiers (the overall aesthetic). Now goes
  //    through the branch pre-check so a moodboard full of bold display
  //    sans doesn't accidentally land on a serif category.
  const wholeCatBranchResult = await classifyCategoryWithBranch(imgEmb);
  const category = wholeCatBranchResult.category;
  const catScores = wholeCatBranchResult.scores;
  const modifiers = await clip.classifyModifiers(imgEmb, MODIFIERS);
  const [branch, style] = CATEGORY_LABELS[category];

  // 3a. Per-crop modifier classification. Same rationale as the category
  //     fix below — the whole-image embedding is dominated by photos and
  //     decor, so the actual text crop is a much better signal for the
  //     header / decorative weight + width.
  const headerModifiers = headerSource === 'text_crop'
    ? await clip.classifyModifiers(headerEmb, MODIFIERS)
    : modifiers;
  const decorativeModifiers = decorativeSource === 'text_crop'
    ? await clip.classifyModifiers(decorativeEmb, MODIFIERS)
    : modifiers;

  // 3b. Per-crop category classification. When a crop is available we run
  //     classifyFont against the crop's embedding so the suggestion picks
  //     fonts from the category the actual text belongs to (e.g. the
  //     "Mood Boards" headline → Serif/Editorial), not from whatever
  //     category the noisy whole-image vibe lands on. The font pool used
  //     for ranking that role follows.
  const headerCatResult = headerSource === 'text_crop'
    ? await classifyCategoryWithBranch(headerEmb)
    : { category, scores: catScores };
  let decorativeCatResult = decorativeSource === 'text_crop'
    ? await classifyCategoryWithBranch(decorativeEmb)
    : { category, scores: catScores };
  const headerCategory = headerCatResult.category;
  let decorativeCategory = decorativeCatResult.category;
  const [headerBranch, headerStyle] = CATEGORY_LABELS[headerCategory];

  // 3c. Phase 2 — script / handwritten Decorative fallback. Only runs when:
  //   - No decorative was picked client-side (no all-caps existed, and the
  //     client opted to defer to the server), AND
  //   - The header itself isn't already script / handwritten (otherwise a
  //     decorative script is redundant pairing).
  // Server classifies each candidate crop and picks the first one whose
  // category is expressive_script or expressive_handwritten.
  const SCRIPT_LIKE = new Set(['expressive_script', 'expressive_handwritten']);
  const candidates = Array.isArray(crops?.candidates) ? crops.candidates : [];
  if (decorativeSource === 'whole_image'
      && !SCRIPT_LIKE.has(headerCategory)
      && candidates.length > 0) {
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (!cand?.dataUrl) continue;
      try {
        const candEmb = await clip.getImageEmbedding(cand.dataUrl);
        const candCat = await classifyCategoryWithBranch(candEmb);
        if (SCRIPT_LIKE.has(candCat.category)) {
          decorativeEmb = candEmb;
          decorativeSource = 'text_crop';
          decorativeCatResult = candCat;
          decorativeCategory = candCat.category;
          decorativePickReason = 'script_handwritten';
          logger.info('phase2 decorative pick', { idx: i, category: candCat.category });
          break;
        }
      } catch (err) {
        logger.warn('candidate classify failed', { idx: i, err: String(err) });
      }
    }
  }

  const [decorativeBranch, decorativeStyle] = CATEGORY_LABELS[decorativeCategory];

  // Confidence = the softmax score of the winning category, in [0, 1].
  const headerCategoryConfidence = headerCatResult.scores?.[headerCategory] ?? 0;
  const decorativeCategoryConfidence = decorativeCatResult.scores?.[decorativeCategory] ?? 0;

  // 4. Mood (color-based, runs off pre-computed props from the client)
  const mood = matchMood(props);
  const moodPreset = mood.key ? MOOD_PRESETS.moods[mood.key] : null;

  // 5. Font pool selection per pairing_rules — using per-role categories
  //    so the header pool reflects the header crop's category, and the
  //    decorative pool reflects the decorative crop's category.
  const headerRules = FONT_LIBRARY.pairing_rules[headerCategory];
  const headerSamePool = FONT_LIBRARY.categories[headerCategory];
  const decorativeRules = FONT_LIBRARY.pairing_rules[decorativeCategory];
  const decorativeSamePool = FONT_LIBRARY.categories[decorativeCategory];

  const neverPair = Array.from(new Set([
    ...((headerRules.never_pair || []).flatMap((c) => FONT_LIBRARY.categories[c] || [])),
    ...((decorativeRules.never_pair || []).flatMap((c) => FONT_LIBRARY.categories[c] || [])),
  ]));

  const headerCrossPools = (headerRules.header_cross || []).map((c) => FONT_LIBRARY.categories[c] || []);
  const decoCrossPools   = (decorativeRules.decorative_cross || []).map((c) => FONT_LIBRARY.categories[c] || []);

  const header = await clip.getFontGroup(headerEmb, headerSamePool, headerCrossPools, neverPair, [], 10);
  const deco   = await clip.getFontGroup(
    decorativeEmb,
    decorativeSamePool,
    decoCrossPools,
    neverPair,
    [...header.same, ...header.cross],
    10
  );
  const body   = await clip.getBodyGroup(
    imgEmb,
    branch,
    [...header.same, ...header.cross, ...deco.same, ...deco.cross],
    FONT_LIBRARY.body_pool,
    20
  );

  // 5. Compose 20 CLIP-ranked trios + optional mood preset as option 0
  const trios = buildTrios(header.same, header.cross, deco.same, deco.cross, body);
  if (moodPreset) {
    trios.unshift({
      header:     moodPreset.trio.header,
      decorative: moodPreset.trio.decorative,
      body:       moodPreset.trio.body,
      type:       'mood_preset',
      mood:       { key: mood.key, label: moodPreset.label, confidence: mood.confidence },
    });
    (moodPreset.alternates || []).forEach((alt, i) => {
      trios.splice(1 + i, 0, {
        header:     alt.header,
        decorative: alt.decorative,
        body:       alt.body,
        type:       'mood_alt',
        mood:       { key: mood.key, label: moodPreset.label, confidence: mood.confidence },
      });
    });
  }

  // 6. Typographic specs (weights + letter-spacing per role)
  const specs = buildSpecs(category, modifiers.weight);

  const elapsedMs = Date.now() - t0;
  logger.info('analyzeMoodboard done', {
    category, branch, style, mood: mood.key,
    headerSource, decorativeSource, elapsedMs,
  });

  return {
    category,
    branch,
    style,
    modifiers,
    headerModifiers,
    decorativeModifiers,
    headerCategory,
    headerBranch,
    headerStyle,
    headerCategoryConfidence,
    decorativeCategory,
    decorativeBranch,
    decorativeStyle,
    decorativeCategoryConfidence,
    decorativePickReason,
    specs,
    mood: moodPreset
      ? { key: mood.key, label: moodPreset.label, confidence: mood.confidence }
      : null,
    trios,
    debug: {
      categoryScores: catScores,
      moodScores: mood.scores,
      elapsedMs,
      headerSource,
      decorativeSource,
      headerCategory,
      decorativeCategory,
      ocrRegionCount: crops?.regionCount ?? 0,
    },
  };
});

exports.warmAnalyzeMoodboard = onCall(RUNTIME_OPTS, async () => {
  const t0 = Date.now();
  await clip.warmup();
  return { ok: true, elapsedMs: Date.now() - t0 };
});
