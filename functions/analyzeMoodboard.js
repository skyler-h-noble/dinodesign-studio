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
  // How many colours, as opposed to which one. 0 = monochrome, 1 = rainbow.
  // Older callers do not send it; 0.35 is the middle of the observed range and
  // leaves the hue-spread terms close to neutral rather than skewing them.
  const spread = props.hueSpread ?? 0.35;
  // Convenience: 1 when the board is monochrome, 0 when it is a rainbow.
  const mono = 1 - spread;

  const inFamily = (...families) => families.includes(hue);

  const scores = {
    neon_cyberpunk:         inFamily('purple','cyan','pink','green') ? ((1-b)*0.4 + s*0.4 + c*0.2) : 0,
    soft_romantic:          inFamily('pink','neutral') ? (b*0.4 + (1-s)*0.3 + (1-c)*0.3) : b*0.2,
    luxury_editorial_black: inFamily('neutral','amber') ? ((1-b)*0.6 + (1-s)*0.2 + c*0.2) : 0,
    old_money:              inFamily('neutral','amber') ? (b*0.4 + (1-s)*0.4 + (1-c)*0.2) : 0,
    // Rescaled to span 0..1 like every other mood. It used to read
    //   0.5 + (1-|b-0.55|)*0.3 + (1-|s-0.25|)*0.2
    // — the only mood with a constant term, so its score never fell below 0.5
    // while every other mood could reach 0. That unearned floor made it win
    // 34% of the entire input space: whenever nothing else scored strongly, it
    // took the board by default. The SHAPE is unchanged (it still wants a
    // mid-bright, gently-saturated image); only the unearned half point is
    // gone, and the weights are scaled 0.3/0.2 -> 0.6/0.4 to keep the same
    // maximum as its peers.
    natural_organic:        inFamily('green','amber','orange','neutral') ? ((1-Math.abs(b-0.55))*0.6 + (1-Math.abs(s-0.25))*0.4) : 0.2,
    clean_tech:             inFamily('blue','neutral','cyan') ? (b*0.4 + (1-s)*0.3 + (1-c)*0.3) : b*0.15,
    warm_retro_vintage:     inFamily('amber','orange','red') ? ((1-Math.abs(b-0.45))*0.4 + (1-Math.abs(s-0.4))*0.3) : 0.15,
    // Rainbow boards live here. Spread is the whole point of the mood — a
    // single vivid hue is not whimsical, several are.
    whimsical_playful:      b*0.25 + s*0.4 + c*0.15 + spread*0.2,
    // Also dead before. Concrete and steel is a narrow palette, so mono
    // carries weight that (1-s) alone could not.
    industrial_urban:       inFamily('neutral','blue') ? ((1-b)*0.3 + (1-s)*0.3 + c*0.15 + mono*0.25) : 0,
    boho_festival:          inFamily('orange','red','amber','pink') ? ((1-Math.abs(b-0.5))*0.3 + (1-Math.abs(s-0.45))*0.4) : 0.15,
    minimal_scandinavian:   inFamily('neutral','blue') ? (b*0.4 + (1-s)*0.3 + (1-c)*0.05 + mono*0.25) : b*0.2,
    dark_romance_gothic:    inFamily('purple','blue','red','neutral') ? ((1-b)*0.5 + (1-Math.abs(s-0.4))*0.3 + c*0.2) : 0,
    // Was winning ZERO of the sampled space: a neutral-gated mood competing
    // against ungated ones on brightness alone. Monochrome is the actual
    // signal — one restrained colour, not the absence of colour.
    // Separated from minimal_scandinavian on CONTRAST. Both wanted bright,
    // desaturated, monochrome neutrals, so their formulas were near-identical
    // and Scandinavian's heavier brightness weight took the shared corner
    // every time — this mood won 0 of 40,960 sampled inputs. Fashion editorial
    // is stark (black on white); Scandinavian is soft (grey on off-white).
    // That is the real difference between them, and it is measurable.
    // The three monochrome-neutral moods, separated on the two axes that
    // actually distinguish them rather than on tuned weights:
    //
    //            brightness   contrast
    //   fashion     bright      high      white ground, stark black type
    //   scandi      bright      low       soft greys on off-white
    //   editorial   dark        high      black ground
    //
    // Before this, fashion used max(b, 1-b) and drifted DARK, into a corner
    // already held by luxury_editorial_black, dark_romance_gothic and
    // industrial_urban — four moods within 0.014 of each other. It peaked at
    // rank 4 and won 0 of 40,960 sampled inputs.
    modern_luxury_fashion:  hue === 'neutral' ? (b*0.35 + c*0.35 + (1-s)*0.15 + mono*0.15) : b*0.1,
    editorial_modern:       b*0.3 + (1-s)*0.4 + (1-Math.abs(c-0.25))*0.3,

    // ── Bright / joyful moods ────────────────────────────────────────────
    // Added because seven font pools were unreachable — Happy, Cute,
    // Childlike, Excited, Loud and Active had no mood that mapped to them, so
    // whimsical_playful was the only route into the entire bright register and
    // a rainbow board had nowhere else to land.
    //
    // Each is hue-gated where the concept genuinely implies a hue (candy is
    // pink, sport is not) and ungated where it does not, following the
    // existing convention.
    // These four all want saturation AND contrast, so they are separated on
    // BRIGHTNESS — otherwise they compete for one corner of the space and the
    // strongest simply takes it. A first pass without this left three of them
    // winning zero of 13,310 sampled inputs: present in the table, dead in
    // practice, which is worse than not adding them.
    bright_cheerful:        inFamily('yellow','orange','amber','pink','red') ? (b*0.4 + s*0.4 + (1-Math.abs(c-0.3))*0.2) : b*0.15,
    candy_pastel:           inFamily('pink','purple','cyan') ? (b*0.5 + (1-Math.abs(s-0.45))*0.4 + (1-c)*0.1) : 0.1,
    // Light ground, primary hues: a children's book, not a nightclub.
    // Several primaries, not one. Gated on hue AND on there being more than
    // one of them, which is what separates it from a plain red board.
    kids_primary:           inFamily('red','yellow','blue','green') ? ((1-Math.abs(b-0.72))*0.3 + s*0.35 + spread*0.35) : 0.05,
    // Mid brightness — colour doing the work, neither bright nor dark.
    high_energy:            (1-Math.abs(b-0.5))*0.35 + s*0.45 + c*0.2,
    // Poster logic: extreme brightness either way, contrast above all.
    bold_graphic:           Math.max(b, 1-b)*0.3 + s*0.25 + c*0.45,
    // Team colour on a dark ground.
    // Team colour: two strong hues, not a rainbow and not a monochrome.
    sport_dynamic:          inFamily('blue','red','orange') ? ((1-b)*0.3 + c*0.3 + s*0.2 + (1-Math.abs(spread-0.45))*0.2) : 0.05,
  };

  const total = Object.values(scores).reduce((acc, v) => acc + v, 0);
  const normalized = total > 0
    ? Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v / total]))
    : scores;

  const ranked = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
  const [bestKey, bestConf] = ranked[0] || [null, 0];
  const [runnerUpKey, runnerUpConf] = ranked[1] || [null, 0];

  // MARGIN, not share, is how sure we actually are.
  //
  // `confidence` has always been the winner's share of the total, which reads
  // like a probability and is not one: with 20 moods a uniform split is 0.05,
  // so a "confidence" of 0.14 is a decisive win that looks like a poor one.
  //
  // Margin is the useful number. Measured across 40,960 sampled inputs the
  // median margin is 0.094 — the top mood typically beats the runner-up by
  // under 10% — and 52.9% of inputs have the top two within 0.10 of each
  // other. So for about half of all boards the choice is nearly a coin flip
  // between two moods, and reporting only the winner hides that completely.
  // It is why the same board could be read as Playful once and Business the
  // next time: nothing had changed much, because there was never much in it.
  //
  // Callers should treat a low margin as "these two, pick one" rather than as
  // a verdict, which is what runnerUp is returned for.
  const margin = bestConf > 0 ? (bestConf - runnerUpConf) / bestConf : 0;

  const cleared = bestConf >= MOOD_THRESHOLD && MOOD_PRESETS.moods?.[bestKey];
  return {
    key: cleared ? bestKey : null,
    // Kept under its old name so already-published callers keep working; it is
    // the share, and `share` is the honest name for it.
    confidence: bestConf,
    share: bestConf,
    margin,
    runnerUp: runnerUpKey && MOOD_PRESETS.moods?.[runnerUpKey] ? runnerUpKey : null,
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

  // Text-vs-non-text gate rejections. Each entry: { role, cropUrl, index?,
  // topLabel, scores }. Returned with the response so the studio can show
  // a "Not text" indicator + Step B can log them to Firestore for training.
  const rejected = [];

  if (crops?.header) {
    try {
      const candEmb = await clip.getImageEmbedding(crops.header);
      const gate = await clip.classifyTextVsNonText(candEmb);
      if (gate.verdict === 'text') {
        headerEmb = candEmb;
        headerSource = 'text_crop';
      } else {
        rejected.push({
          role: 'header',
          cropUrl: crops.header,
          topLabel: gate.topLabel,
          scores: gate.scores,
        });
        logger.info('header crop rejected by text gate', { topLabel: gate.topLabel });
      }
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
      const candEmb = await clip.getImageEmbedding(crops.decorative);
      const gate = await clip.classifyTextVsNonText(candEmb);
      if (gate.verdict === 'text') {
        decorativeEmb = candEmb;
        decorativeSource = 'text_crop';
      } else {
        rejected.push({
          role: 'decorative',
          cropUrl: crops.decorative,
          topLabel: gate.topLabel,
          scores: gate.scores,
        });
        // Reset the pick reason — the client-provided crop didn't pass the gate
        // so Phase 2 (script/handwritten fallback) gets a chance below.
        decorativePickReason = 'gate_rejected_client_crop';
        logger.info('decorative crop rejected by text gate', { topLabel: gate.topLabel });
      }
    } catch (err) {
      logger.warn('decorative crop embedding failed, using whole image', { err: String(err) });
    }
  }

  // Same-style guard. When the header and decorative crops come from text
  // that's visually the same style (e.g. a moodboard where every headline
  // is the same hand-painted brush lettering — "LEMON" + "TYPEFACE" both
  // brush), the decorative embedding adds no new signal — it just doubles
  // the header's vote. Result is the suggestion picks two fonts from the
  // same category that read as the same family even though their names
  // differ. Cosine similarity > 0.92 between the two crop embeddings is
  // tight enough to mean "same drawn style" without flagging legitimate
  // pairings (header sans + decorative sans of a different weight typically
  // sit around 0.75–0.85). When triggered, fall the decorative back to the
  // whole-image embedding so it ranks against the broader moodboard vibe.
  if (headerSource === 'text_crop' && decorativeSource === 'text_crop') {
    const sim = clip.cosineSimilarity(headerEmb, decorativeEmb);
    if (sim > 0.92) {
      logger.info('decorative crop matches header style; falling back to whole image', { sim });
      decorativeEmb = imgEmb;
      decorativeSource = 'whole_image';
      decorativePickReason = 'same_style_as_header';
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
        // Gate candidates too — phase 2 is otherwise the most permissive
        // path into the decorative slot and would happily accept any icon
        // that CLIP misreads as expressive script.
        const gate = await clip.classifyTextVsNonText(candEmb);
        if (gate.verdict !== 'text') {
          rejected.push({
            role: 'candidate',
            index: i,
            cropUrl: cand.dataUrl,
            topLabel: gate.topLabel,
            scores: gate.scores,
          });
          continue;
        }
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
      ? {
          key: mood.key,
          label: moodPreset.label,
          confidence: mood.confidence,
          // Share and margin are different questions: share is how much of the
          // total this mood took, margin is how far ahead of the next one it
          // was. Half of all boards have a margin under 0.10, so the UI needs
          // the runner-up to offer rather than assert.
          share: mood.share,
          margin: mood.margin,
          runnerUp: mood.runnerUp,
          runnerUpLabel: mood.runnerUp ? (MOOD_PRESETS.moods[mood.runnerUp] || {}).label || null : null,
        }
      : null,
    trios,
    rejected,
    debug: {
      categoryScores: catScores,
      moodScores: mood.scores,
      elapsedMs,
      headerSource,
      decorativeSource,
      headerCategory,
      decorativeCategory,
      ocrRegionCount: crops?.regionCount ?? 0,
      rejectedCount: rejected.length,
    },
  };
});

exports.warmAnalyzeMoodboard = onCall(RUNTIME_OPTS, async () => {
  const t0 = Date.now();
  await clip.warmup();
  return { ok: true, elapsedMs: Date.now() - t0 };
});
