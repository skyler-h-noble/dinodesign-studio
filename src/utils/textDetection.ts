// Crop + analysis helpers for the GCV-driven typography pipeline.
//
// The text detection itself runs server-side via Google Cloud Vision (see
// functions/detectTextRegionsGCV.js). This file's job is:
//
//   cropFromBboxes(imageUrl, bboxes) -> base64 PNG crops of the regions
//                                       GCV identified, ready to pass to
//                                       the CLIP per-role pipeline
//   classifySpacingFromBbox(...)     -> coarse tight/normal/wide tracking
//                                       estimate from the crop's pixel
//                                       density
//
// Tesseract and pixel-fallback paths were removed — we trust GCV.

export interface TextRegion {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrDiag {
  wordCount: number;            // words GCV returned (or pixel regions, in fallback)
  elapsedMs: number;            // GCV call time
  pixelFallbackUsed?: boolean;  // true if we resorted to pixel flood-fill
  error?: string;               // populated if GCV failed
}

export type SpacingClass = 'tight' | 'normal' | 'wide';
export type VisualWeight = 'thin' | 'regular' | 'heavy';

export interface StrokeAnalysis {
  /** Weight bucket derived from stroke_width / letter_height. Independent
   *  of tracking — a wide-tracked thin display sans no longer reads as
   *  "thin" purely because of the air between letters. */
  weight: VisualWeight;
  /** Stroke width / letter height ratio (the underlying measurement). */
  weightRatio: number;
  /** True when ≥50% of vertical strokes have horizontal extensions at
   *  their top or bottom — i.e. visible serif feet. */
  hasSerifFeet: boolean;
  /** Fraction of detected strokes that had serif feet. */
  serifFootRatio: number;
  /** How many vertical strokes were detected total. Low numbers (< 3)
   *  mean the weight / serif signals are noisy and shouldn't be trusted
   *  hard — fall back to CLIP. */
  strokeCount: number;
  /** True when the region has substantial text but very few clean vertical
   *  stems — script and handwritten fonts curve/slant where regular fonts
   *  go straight up and down, so they leave few stems to count. Computed
   *  in cropFromBboxes (needs the OCR text length to normalise against
   *  strokeCount). */
  isLikelyScript: boolean;
  /** True when the region looks BRUSH / HAND-drawn (Squeeze brush headline,
   *  LEMON BIRD, chalk "hare") rather than a clean display sans. Distinct
   *  from script — script is thin and flowing, hand is THICK and irregular.
   *  Two triggers, either is enough:
   *    1. measurementFailed (weight ratio > 50%) — the binarizer gave up
   *       on heavy ink, which only happens on brush/painted/textured text;
   *    2. weightRatio > 0.25 — visible brush ink (25%+ stroke / letter
   *       height), regardless of whether stems were found.
   *  Used downstream to override CLIP's "Display / Decorative" verdict to
   *  "Handwritten / Informal" so the matcher pulls hand-drawn font pools
   *  (Caveat, Permanent Marker, Shadows Into Light) instead of display
   *  font pools (Bangers, Boogaloo). Computed in cropFromBboxes alongside
   *  isLikelyScript. */
  isLikelyHand: boolean;
  /** True when the pixel scanner gave up because the result was nonsense
   *  (e.g. heavy display lettering on a colored background where the
   *  binarizer can't separate ink and clusters wide ink bands into single
   *  "stems"). When set, ALL of strokeCount, weight, weightRatio, and
   *  hasSerifFeet are unreliable and should be treated as "unknown" by
   *  downstream classifiers — they should fall back to CLIP's verdict
   *  rather than inferring anything from these defaults. Without this
   *  flag, the script rule's "0 stems + large crop = script" path fires
   *  on every crop where measurement failed, mislabeling brush display
   *  headlines (DREAM, BIRD, etc.) as cursive. */
  measurementFailed: boolean;
}

export interface ExtractedTextRegion {
  dataUrl: string;
  height: number;
  text: string;
  isAllCaps: boolean;
  /** Coarse letter-spacing classification from pixel density inside the
   *  bbox. Tight = densely packed ink; wide = lots of air between glyphs.
   *  Approximate — meant as a hint, not a measurement. */
  spacing: SpacingClass;
  /** Pixel-based stroke analysis on the original source bbox: weight from
   *  stroke_width / letter_height, plus a binary serif/sans signal from
   *  stroke terminals. Replaces the spacing-class proxy for weight which
   *  conflated weight with tracking. */
  stroke: StrokeAnalysis;
}

export interface TextCrops {
  header?: string;
  decorative?: string;
  regionCount: number;
  regions: ExtractedTextRegion[];
  diag: OcrDiag;
}

// Decorative is only worth cropping if it's meaningfully smaller than the
// header — otherwise we'd embed two nearly-identical crops and the rankings
// would collapse onto the same fonts.
const DECORATIVE_HEIGHT_RATIO = 0.8;

// Padding around each crop so CLIP sees a little context.
const CROP_PADDING = 15;

// Square crop size we send to CLIP. ViT-B/32 resizes everything to 224.
const CROP_SIZE = 224;

type Vertex = { x: number; y: number };

/** Letter height = length of the SHORT side of GCV's rotated rect, i.e. the
 *  distance from top-left to bottom-left of the polygon. For un-rotated text
 *  this equals the bbox height; for a 30° tilted "breathe" sign the axis-
 *  aligned bbox is ~1.4× taller than the actual letter height, and we want
 *  the latter for height-sort. Falls back to axis-aligned height when poly
 *  is missing. */
function trueLetterHeight(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  poly: Vertex[] | undefined,
): number {
  if (!poly || poly.length !== 4) return bbox.y1 - bbox.y0;
  const [tl, , , bl] = poly;
  const dx = tl.x - bl.x;
  const dy = tl.y - bl.y;
  return Math.hypot(dx, dy);
}

/** Crop the source image at GCV-supplied bounding boxes and return the
 *  TextCrops shape the cloud function expects. */
export async function cropFromBboxes(
  imageUrl: string,
  bboxes: Array<{ x0: number; y0: number; x1: number; y1: number; text?: string; poly?: Vertex[] }>,
  meta: { elapsedMs: number },
  maxRegions = 10,
): Promise<TextCrops> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[gcv] image load failed:', msg);
    return {
      regionCount: 0,
      regions: [],
      diag: { wordCount: 0, elapsedMs: meta.elapsedMs, error: `image load: ${msg}` },
    };
  }

  // Merge word boxes into phrases (GCV returns word-level boxes; users
  // want phrase-level crops). First split any single token that packs two
  // fonts (cursive run + block-caps, e.g. "fitAND") so each gets its own crop.
  const phrases = mergeWordsIntoPhrases(splitCaseTransitionTokens(bboxes));

  // Drop single-character phrases. A standalone "B" or "a" in a moodboard
  // is almost always a decorative glyph specimen, a list bullet, or a
  // logo initial — none of which are useful typography samples for the
  // matcher. We count Unicode letters AND numbers (\p{L}|\p{N}) so
  // non-Latin scripts and alphanumeric tags like "X1" / "7B" survive,
  // while punctuation alone does not — "B." still counts as 1 char and
  // gets dropped. Multi-char phrases like "A B C" still pass (3 chars).
  const charCount = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const phrasesFiltered = phrases.filter(p => charCount(p.text) >= 2);
  const dropped = phrases.length - phrasesFiltered.length;
  if (dropped > 0) console.info('[gcv] dropped', dropped, 'single-letter phrases');

  // Sort by TRUE letter height (short side of the rotated polygon when
  // available). Diagonal text — like a tilted neon "breathe" sign — has
  // an axis-aligned bbox that's much taller than the actual letter height,
  // which otherwise lets a tiny rotated script beat a large upright headline
  // to the Header slot. For phrases with no poly we fall back to bbox
  // height so the sort still works.
  phrasesFiltered.sort((a, b) => trueLetterHeight(b, b.poly) - trueLetterHeight(a, a.poly));
  const top = phrasesFiltered.slice(0, maxRegions);

  const heightSorted: ExtractedTextRegion[] = top.map((b) => {
    const region: TextRegion = {
      text: b.text ?? '',
      confidence: 100,
      bbox: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 },
    };
    const stroke = analyzeStrokes(img, region.bbox);
    const text = (b.text ?? '').trim();
    // Text with very few clean vertical stems is a strong signal for script
    // / handwritten — those fonts curve and slant where regular fonts have
    // a clean vertical stem to count. "elegant" (7 letters, ~0-1 stems)
    // flags as script; "LOGO" (4 letters, 2 stems) and "Mood Boards" (11
    // letters, ~4 stems) don't. Letter floor sits at 3 so short cursive
    // crops like "Jui" (3 letters, 0 stems, large bbox) still flag — the
    // ratio check on Path A keeps short BLOCK words like "USA" / "the" /
    // "and" safe (each has ≥1 stem, and 1 × 5 = 5 > 3 fails the ratio).
    //
    // When strokeCount === 0 we have to distinguish two cases:
    //   - Tiny crop, scanner failed (TERRA: ~25 px tall): don't flag script.
    //   - Cursive at a reasonable size (Squee: ~60 px tall): DO flag script,
    //     because legitimate cursive at that size truly has no clean stems.
    // We use the source bbox's letter height as the discriminator — below
    // ~40 px the scanner can miss real stems to anti-aliasing, above that
    // a zero count is a real signal.
    //
    // ALSO: when stroke.measurementFailed is true (weight-ratio sanity
    // gate gave up on a nonsense measurement, typically heavy display
    // lettering on a colored background like DREAM/LEMON BIRD), don't
    // fire Path B. The 0 stems isn't "no stems found" — it's "we know
    // there ARE stems but the binarizer gave us garbage." Falling back to
    // CLIP is the right call in that case.
    const letterCount = (text.match(/[A-Za-z]/g) ?? []).length;
    const bboxLetterH = trueLetterHeight(b, b.poly);
    // Inline all-caps check so Path C below can exclude all-caps candidates
    // (they're the kicker pattern, not script). Mirrors the `isAllCaps`
    // computation a few lines down on the returned region.
    const isAllCapsInline = text.length > 1
      && text === text.toUpperCase()
      && /[A-Z]/.test(text);
    // Per-letter aspect ratio — cursive letters are wider per height than
    // block letters because each glyph spreads out into curves and
    // ligatures. Used by Path D below as a script signal independent of
    // stroke ratio (which can be misleading for high-contrast cursives
    // like Allura where the downstrokes are 20%+ thick despite the font
    // reading clearly as script).
    const bboxWidth = b.x1 - b.x0;
    const perLetterAspect = letterCount > 0 && bboxLetterH > 0
      ? (bboxWidth / letterCount) / bboxLetterH
      : 0;
    const isLikelyScript = letterCount >= 3 && !stroke.measurementFailed && (
      // Path A — strict ratio. Sparse stems relative to letter count
      // (5 letters / 1 stem = clearly cursive).
      (stroke.strokeCount >= 1 && stroke.strokeCount * 5 < letterCount)
      // Path B — zero stems on a crop large enough to trust the count.
      // Threshold 25 px (down from 40 → 30) catches small cursive like
      // "board" without false-positiving on TERRA-style all-caps small
      // crops, which the !isAllCaps guard handles.
      || (
        stroke.strokeCount === 0
        && bboxLetterH >= 25
        && !isAllCapsInline
      )
      // Path C — thin-stroked cursive with stems present. Stems fewer
      // than letters, thin strokes (< 10% of letter height), not all-caps.
      // Catches words like the calligraphic "Allura" where some uprights
      // register as stems but strokes are still thin.
      || (
        stroke.strokeCount >= 1
        && stroke.strokeCount < letterCount
        && stroke.weightRatio < 0.10
        && !isAllCapsInline
      )
      // Path D — wide-per-letter cursive. Each cursive glyph spreads >1×
      // its height because of curves and connectors; block letters sit at
      // ~0.5–0.9× wide-to-tall per letter. Combined with stems < letters
      // and letterCount ≥ 4 (so 3-letter words like "the" don't false-
      // positive when bbox padding inflates width) and !all-caps (kicker
      // pattern is its own thing), this catches "board" (5 letters, 1
      // upright stem, ~1.2× per-letter aspect, high-contrast cursive
      // strokes that Path C's ratio gate misses).
      || (
        letterCount >= 4
        && stroke.strokeCount >= 1
        && stroke.strokeCount < letterCount
        && perLetterAspect > 1.0
        && !isAllCapsInline
      )
    );
    // Hand-drawn / brush detection — distinct from script. Triggers on the
    // signals that mean "thick irregular ink": either the scanner's weight-
    // ratio sanity gate fired (heavy brush on a colored background broke
    // the binarizer — DREAM, LEMON BIRD) OR the measured ratio is in brush
    // territory (>25% of letter height — "hare" at 39%). Letter floor at 3
    // matches the script floor for consistency. Mutually exclusive with
    // isLikelyScript so a single crop never claims to be both — script
    // wins when the signals overlap (thin sparse strokes look script-like
    // even if the ratio sneaks past 25%).
    const isLikelyHand = letterCount >= 3
      && !isLikelyScript
      && (stroke.measurementFailed || stroke.weightRatio > 0.25);
    return {
      dataUrl: regionToDataUrl(img, region),
      // Use the polygon's short side for height so rotated text doesn't
      // win comparisons it shouldn't (downstream `r.height < header.height
      // * ratio` checks need a true letter-height, not a bbox-diagonal).
      height: trueLetterHeight(b, b.poly),
      text: b.text ?? '',
      isAllCaps: text.length > 1
        && text === text.toUpperCase()
        && /[A-Z]/.test(text),
      spacing: classifySpacingFromBbox(img, region.bbox),
      stroke: { ...stroke, isLikelyScript, isLikelyHand },
    };
  });

  // Decorative pick — hierarchical, with a weight-contrast preference woven
  // in. The design principle: heavy + heavy flattens typographic hierarchy,
  // so when the header reads visually heavy we'd rather pull a lighter
  // companion (and vice versa). Pixel-density classes from
  // classifySpacingFromBbox stand in for visual weight here — `tight` ≈
  // heavy ink coverage, `wide` ≈ thin/airy, `normal` is in between.
  //
  //   1. If the header is NOT all-caps, look for an all-caps region with
  //      CONTRASTING weight; if none has contrast, fall back to any
  //      all-caps. (Overline / kicker pairing is still preferred over a
  //      body-shaped second line.)
  //   2. Otherwise (header already all-caps) try a contrast-weight region
  //      among the rest; if none, fall back to the 2nd-tallest provided it's
  //      meaningfully smaller than the header.
  // Phase 2 — preferring script / calligraphy / handwritten when no
  // all-caps exists and the header isn't already one — needs per-crop
  // CLIP category classification on the server (not yet wired).
  const header = heightSorted[0];
  let decorativePickIdx: number | null = null;
  if (header) {
    // Prefer the pixel-measured stroke weight when we have enough strokes
    // to trust it (≥2); otherwise fall back to the density-derived proxy
    // for regions that are mostly curved letters or too small to scan.
    const weightOf = (r: ExtractedTextRegion): VisualWeight =>
      r.stroke.strokeCount >= 2 ? r.stroke.weight : visualWeightFromSpacing(r.spacing);
    const headerWeight = weightOf(header);
    const isContrast = (r: ExtractedTextRegion) =>
      contrastsWith(headerWeight, weightOf(r));
    const isSubheadLike = (r: ExtractedTextRegion) =>
      !r.isAllCaps && isContrast(r) && r.height < header.height * DECORATIVE_HEIGHT_RATIO;

    // Hard rule: header + decorative must differ in CASE when the header
    // is all-caps. Same-case pairing on a heavy display headline reads as
    // a label, not a hierarchical accent. (Mixed-case headers don't get
    // this restriction — the kicker pattern is mixed-case header + all-caps
    // overline.)
    const respectsCaseRule = (r: ExtractedTextRegion) =>
      !(header.isAllCaps && r.isAllCaps);

    // Earlier we had a "must come from a different panel" guard here to
    // prevent the LEMON / TYPEFACE case (header and decorative both brush
    // letters from the same specimen). It turned out to be redundant:
    // respectsCaseRule already rejects LEMON / TYPEFACE (both all-caps) AND
    // the server's font-pool exclude prevents the same family being picked
    // for both roles. Its only practical effect was breaking VALID contrast
    // pairings like "Mood" (mixed-case serif) + "Inspiration" (all-caps in
    // the same panel) where two different styles legitimately coexist on
    // one specimen. Trust the existing rules and let proximity work in our
    // favor (Phase 0.5 picks the closest candidate that meets the contrast
    // rules — exactly what designers intend when they stack a serif over a
    // small-caps line).

    // Soft rule: the candidate must differ from the header on at LEAST one
    // axis (case / serif-ness / weight / script-ness). Otherwise we'd be
    // stacking two visually identical lines and calling one a "decorative"
    // which fools no one. If nothing differs on any axis, we'd rather pick
    // nothing and let the server fall back to a mood trio than commit to
    // a non-pairing.
    const differsFromHeader = (r: ExtractedTextRegion) => {
      const caseDiffers   = header.isAllCaps !== r.isAllCaps;
      const serifDiffers  = header.stroke.hasSerifFeet !== r.stroke.hasSerifFeet;
      const weightDiffers = weightOf(header) !== weightOf(r);
      const scriptDiffers = header.stroke.isLikelyScript !== r.stroke.isLikelyScript;
      const handDiffers   = header.stroke.isLikelyHand !== r.stroke.isLikelyHand;
      return caseDiffers || serifDiffers || weightDiffers || scriptDiffers || handDiffers;
    };
    const isValid = (r: ExtractedTextRegion, i = -1) =>
      respectsCaseRule(r) && differsFromHeader(r) && isSpatiallyCoherent(i);

    // Spatial proximity helper. A region is "just below" the header when
    // its top edge is no more than ~1.5× the header height beneath the
    // header's bottom edge — this is the "natural subtitle/accent slot"
    // designers leave directly under a display line. Uses the original
    // bbox y-coordinates, which `top` is parallel to heightSorted on.
    const headerBbox = top[0];

    // Hard spatial cutoff. Decorative candidates must sit reasonably close
    // to the header — designers compose typographic specimens as a tight
    // cluster, not by scattering letterforms across the moodboard. Without
    // this, every "no good kicker exists" case turns into a hunt that
    // pulls all-caps from compass markings, watermarks, photo embedded
    // text, etc. Radius = 3× header height from the header bbox center.
    // Generous enough for a multi-line specimen ("Mood" + "board" +
    // "Inspiration" all qualify), tight enough to exclude anything from a
    // distant photo. When NO candidate qualifies, decorativePickIdx stays
    // null and the client synthesizes a header-paired decorative from
    // mood instead of a junk pick.
    const isSpatiallyCoherent = (i: number): boolean => {
      if (i === 0 || !headerBbox) return false;
      const bbox = top[i];
      if (!bbox) return false;
      const headerH = headerBbox.y1 - headerBbox.y0;
      const hcx = (headerBbox.x0 + headerBbox.x1) / 2;
      const hcy = (headerBbox.y0 + headerBbox.y1) / 2;
      const ccx = (bbox.x0 + bbox.x1) / 2;
      const ccy = (bbox.y0 + bbox.y1) / 2;
      const dist = Math.hypot(hcx - ccx, hcy - ccy);
      return dist <= headerH * 3;
    };
    const isJustBelowHeader = (i: number): boolean => {
      if (i === 0) return false;
      const bbox = top[i];
      if (!bbox || !headerBbox) return false;
      const headerH = headerBbox.y1 - headerBbox.y0;
      const slotTop = headerBbox.y1 - headerH * 0.3; // generous overlap allowed
      const slotBottom = headerBbox.y1 + headerH * 2.5;
      return bbox.y0 >= slotTop && bbox.y0 <= slotBottom;
    };

    // Priority order:
    //   1. script header → non-script decorative (only fires for script
    //      headers, which need a stable foil to read against)
    //   2. kicker (all-caps overline) — the classic editorial pairing for a
    //      mixed-case header. Preferred over any axis-contrast pattern.
    //   3. axis-contrast fallbacks for the cases where no all-caps line
    //      exists on the moodboard:
    //        a. heavy header → non-heavy mixed-case subhead
    //        b. thin header  → heavier anchor
    //   4. any-contrast / 2nd-tallest last resort
    // Phase 2 (script / handwritten fallback when no all-caps exists)
    // runs server-side after these.

    // Phase 0 — script header → non-script decorative.
    if (header.stroke.isLikelyScript && heightSorted.length > 1) {
      const nonScriptIdx = heightSorted.findIndex(
        (r, i) =>
          i !== 0
          && !r.stroke.isLikelyScript
          && r.height < header.height * DECORATIVE_HEIGHT_RATIO
          && isValid(r, i),
      );
      if (nonScriptIdx >= 0) decorativePickIdx = nonScriptIdx;
    }

    // Closest-to-header helper. Among regions matching the predicate,
    // returns the one whose top edge sits closest to the header's bottom
    // edge — the designer's intended decorative typically sits directly
    // under the headline. Returns null when no region qualifies.
    const findClosestMatch = (
      predicate: (r: ExtractedTextRegion, i: number) => boolean,
    ): number | null => {
      const matches: Array<{ idx: number; distance: number }> = [];
      for (let i = 1; i < heightSorted.length; i++) {
        const r = heightSorted[i];
        const bbox = top[i];
        if (!bbox || !headerBbox) continue;
        if (!predicate(r, i)) continue;
        matches.push({ idx: i, distance: Math.abs(bbox.y0 - headerBbox.y1) });
      }
      if (matches.length === 0) return null;
      matches.sort((a, b) => a.distance - b.distance);
      return matches[0].idx;
    };

    // Phase 0.3 — heavy serif header: refined accent pairing. A heavy
    // display serif calls for a delicate complement. Tier order matters:
    // a thin all-caps kicker beats a script flourish even when the
    // script sits closer — and within each tier, the closest candidate
    // to the header wins.
    if (
      decorativePickIdx === null
      && headerWeight === 'heavy'
      && header.stroke.hasSerifFeet
    ) {
      const thinAllCaps = findClosestMatch((r, i) =>
        r.isAllCaps
        && weightOf(r) === 'thin'
        && r.height < header.height * DECORATIVE_HEIGHT_RATIO
        && isValid(r, i),
      );
      if (thinAllCaps !== null) {
        decorativePickIdx = thinAllCaps;
      } else {
        const scriptIdx = findClosestMatch((r, i) =>
          r.stroke.isLikelyScript
          && r.height < header.height * DECORATIVE_HEIGHT_RATIO
          && isValid(r, i),
        );
        if (scriptIdx !== null) decorativePickIdx = scriptIdx;
      }
    }

    // Phase 0.5 — spatial proximity. Just-below + (all-caps OR script OR
    // hand-drawn). Hand-tagged regions belong here too — a brush "board"
    // sitting under a serif "Mood" header is a classic editorial kicker
    // and was being silently filtered out when only the script + all-caps
    // signals counted. Among multiple qualifying regions in the slot, the
    // one physically closest to the header wins.
    if (decorativePickIdx === null) {
      const proximityIdx = findClosestMatch((r, i) =>
        isJustBelowHeader(i)
        && (r.isAllCaps || r.stroke.isLikelyScript || r.stroke.isLikelyHand)
        && r.height < header.height * DECORATIVE_HEIGHT_RATIO
        && isValid(r, i),
      );
      if (proximityIdx !== null) decorativePickIdx = proximityIdx;
    }

    // Phase 1 — kicker pattern (mixed-case header → all-caps overline).
    // Prefer the candidate physically closest to the header to avoid
    // reaching across the image and grabbing junk all-caps from a photo
    // (compass markings, watermark, etc.). Falls back to closest-match
    // both for contrast-weighted and any-all-caps variants.
    if (decorativePickIdx === null && !header.isAllCaps) {
      const contrastAllCaps = findClosestMatch((r, i) => i !== 0 && r.isAllCaps && isContrast(r) && isValid(r, i));
      const anyAllCaps      = findClosestMatch((r, i) => i !== 0 && r.isAllCaps && isValid(r, i));
      const allCapsIdx = contrastAllCaps !== null ? contrastAllCaps : anyAllCaps;
      if (allCapsIdx !== null) decorativePickIdx = allCapsIdx;
    }

    // Phase 1a — heavy header → light subhead. Closest-match, same reason.
    if (decorativePickIdx === null && headerWeight === 'heavy' && heightSorted.length > 2) {
      const subheadIdx = findClosestMatch((r, i) => i !== 0 && isSubheadLike(r) && isValid(r, i));
      if (subheadIdx !== null) decorativePickIdx = subheadIdx;
    }

    // Phase 1b — thin header → heavier anchor. Closest-match, same reason.
    if (decorativePickIdx === null && headerWeight === 'thin' && heightSorted.length > 1) {
      const anchorIdx = findClosestMatch(
        (r, i) =>
          i !== 0
          && weightOf(r) !== 'thin'
          && !r.stroke.isLikelyScript
          && r.height < header.height * DECORATIVE_HEIGHT_RATIO
          && isValid(r, i),
      );
      if (anchorIdx !== null) decorativePickIdx = anchorIdx;
    }

    // Phase 2 — any-contrast fallback. Closest-match too so even this
    // last resort respects spatial coherence. If every smaller candidate
    // is visually identical to the header on every axis (or violates the
    // case rule when the header is all-caps), decorativePickIdx stays
    // null and the server surfaces a mood-driven decorative instead.
    if (decorativePickIdx === null && heightSorted.length > 1) {
      const contrastIdx = findClosestMatch(
        (r, i) =>
          i !== 0
          && isContrast(r)
          && r.height < header.height * DECORATIVE_HEIGHT_RATIO
          && isValid(r, i),
      );
      if (contrastIdx !== null) decorativePickIdx = contrastIdx;
    }
  }

  // Re-order so [0] = header, [1] = chosen decorative, then the rest by
  // height. Lets callers read the chosen pair as regions[0] / regions[1]
  // without tracking a separate decorativeIdx.
  const regions: ExtractedTextRegion[] = [];
  if (header) regions.push(header);
  if (decorativePickIdx !== null && decorativePickIdx !== 0) {
    regions.push(heightSorted[decorativePickIdx]);
  }
  for (let i = 0; i < heightSorted.length; i++) {
    if (i === 0) continue;
    if (i === decorativePickIdx) continue;
    regions.push(heightSorted[i]);
  }

  return {
    header: regions[0]?.dataUrl,
    decorative: decorativePickIdx !== null ? regions[1]?.dataUrl : undefined,
    regionCount: regions.length,
    regions,
    diag: { wordCount: bboxes.length, elapsedMs: meta.elapsedMs },
  };
}

/** Visual-weight bucket inferred from a region's bbox pixel density. The
 *  spacing classes from classifySpacingFromBbox already encode density:
 *  `tight` means lots of ink (a heavy bold), `wide` means lots of air (a
 *  thin/airy face). We treat that as a coarse weight proxy so the decorative
 *  picker can favour contrast with the header. */
function visualWeightFromSpacing(spacing: SpacingClass): VisualWeight {
  if (spacing === 'tight') return 'heavy';
  if (spacing === 'wide')  return 'thin';
  return 'regular';
}

/** Two visual weights contrast iff they're not identical. Pairing heavy
 *  with heavy (or thin with thin) flattens hierarchy — that's the case we
 *  want the decorative pick to avoid when there's an alternative. */
function contrastsWith(a: VisualWeight, b: VisualWeight): boolean {
  return a !== b;
}

/** Classify a single OCR word by case so we can refuse to merge across
 *  typographic boundaries. Returns 'unknown' when there isn't enough cased
 *  text to tell — short words and punctuation shouldn't block a merge. */
function wordCaseClass(text: string | undefined): 'caps' | 'mixed' | 'unknown' {
  const trimmed = (text ?? '').trim();
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2) return 'unknown';
  if (letters === letters.toUpperCase()) return 'caps';
  return 'mixed';
}

/** Two adjacent words can merge into one phrase only if their case classes
 *  don't disagree. 'unknown' is treated as agnostic — won't block a merge
 *  in either direction. This catches the "fit AND" cursive-next-to-caps
 *  bug without splitting normal sentences like "Fall is here" or
 *  homogeneous block-caps headlines like "MOOD BOARDS". */
function caseClassesMergeable(curText: string | undefined, nextText: string | undefined): boolean {
  const a = wordCaseClass(curText);
  const b = wordCaseClass(nextText);
  if (a === 'unknown' || b === 'unknown') return true;
  return a === b;
}

/** Stylized logos are sometimes OCR'd by GCV as ONE token that actually holds
 *  two fonts — a cursive lowercase run flowing straight into block-caps
 *  ("fitAND"). The phrase merger can't split a single token, so we pre-split at
 *  a lowercase-run → UPPERCASE-run boundary into two regions (proportional x),
 *  letting each get its own crop + classification.
 *
 *  Guarded to fire ONLY on `word` + `CAPS` (≥2 each, caps running to the end):
 *  "fitAND"/"fiTAND" split; "iPhone" / "eBay" / "McKinsey" (caps not trailing)
 *  are left intact. The all-caps part is given a shorter letter height (caps
 *  rise to ~72% of a flourished script's ascender-to-descender), so the script
 *  part wins the "tallest = header" sort — which is what these logos intend. */
function splitCaseTransitionTokens(
  bboxes: Array<{ x0: number; y0: number; x1: number; y1: number; text?: string; poly?: Vertex[] }>,
): Array<{ x0: number; y0: number; x1: number; y1: number; text?: string; poly?: Vertex[] }> {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number; text?: string; poly?: Vertex[] }> = [];
  for (const b of bboxes) {
    const t = (b.text ?? '').trim();
    // lowercase run (≥2, ending lowercase) directly followed by a CAPS run
    // (≥2) that reaches the end of the token.
    const m = /^([a-z][a-z0-9]*[a-z])([A-Z]{2,})$/.exec(t);
    if (!m) { out.push(b); continue; }
    const [, lower, upper] = m;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const splitX = b.x0 + Math.round(w * (lower.length / (lower.length + upper.length)));
    const capBand = Math.round(h * 0.72); // caps are shorter than a flourished script
    // Drop poly on the split parts — the axis-aligned bbox height is the
    // representative letter height for each half (script keeps full height,
    // caps get the shorter, baseline-anchored band).
    out.push({ x0: b.x0, y0: b.y0, x1: splitX, y1: b.y1, text: lower });
    out.push({ x0: splitX, y0: b.y1 - capBand, x1: b.x1, y1: b.y1, text: upper });
  }
  return out;
}

function mergeWordsIntoPhrases(
  bboxes: Array<{ x0: number; y0: number; x1: number; y1: number; text?: string; poly?: Vertex[] }>,
): Array<{ x0: number; y0: number; x1: number; y1: number; text: string; poly?: Vertex[] }> {
  if (bboxes.length === 0) return [];
  const sorted = [...bboxes].sort((a, b) => {
    const dy = a.y0 - b.y0;
    return Math.abs(dy) < 20 ? a.x0 - b.x0 : dy;
  });

  const out: Array<{ x0: number; y0: number; x1: number; y1: number; text: string; poly?: Vertex[] }> = [];
  // Keep the FIRST word's poly through the merge — for single-word phrases
  // this is exact; for merged phrases the words share a baseline so the
  // first word's rotation/letter-height is representative.
  let cur = { ...sorted[0], text: sorted[0].text ?? '', poly: sorted[0].poly };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const curH = cur.y1 - cur.y0;
    const nextH = next.y1 - next.y0;
    // Use the SMALLER of the two heights as the threshold reference.
    // Otherwise the cluster's height grows as words merge in, the tolerance
    // grows with it, and a single big headline ends up pulling in unrelated
    // small labels from across the page (e.g. "Mood Boards" + "1969" + the
    // Source Sans labels all getting glued together).
    const refH = Math.min(curH, nextH);
    const curMidY = (cur.y0 + cur.y1) / 2;
    const nextMidY = (next.y0 + next.y1) / 2;
    const onSameLine = Math.abs(curMidY - nextMidY) < refH * 0.5;
    const horizGap = next.x0 - cur.x1;
    const close = horizGap < refH * 1.5 && horizGap > -nextH;
    // Style-boundary check: text case mismatch is a strong signal that the
    // two words come from different typographic systems (e.g. cursive "fit"
    // next to block-caps "AND"). Refuse the merge so each gets its own
    // crop + classification.
    const caseCompatible = caseClassesMergeable(cur.text, next.text);
    if (onSameLine && close && caseCompatible) {
      cur.x1 = Math.max(cur.x1, next.x1);
      cur.y0 = Math.min(cur.y0, next.y0);
      cur.y1 = Math.max(cur.y1, next.y1);
      cur.text = `${cur.text} ${next.text ?? ''}`.trim();
    } else {
      out.push(cur);
      cur = { ...next, text: next.text ?? '', poly: next.poly };
    }
  }
  out.push(cur);
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function regionToDataUrl(img: HTMLImageElement, region: TextRegion): string {
  const { x0, y0, x1, y1 } = region.bbox;
  const sx = Math.max(0, x0 - CROP_PADDING);
  const sy = Math.max(0, y0 - CROP_PADDING);
  const sw = Math.min(img.width  - sx, x1 - x0 + CROP_PADDING * 2);
  const sh = Math.min(img.height - sy, y1 - y0 + CROP_PADDING * 2);

  const canvas = document.createElement('canvas');
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // White fill — CLIP treats transparent as black, which biases toward
  // dark/heavy font matches.
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

  // Letterbox-fit the source into 224×224 instead of stretching to fill.
  // The previous version squashed wide phrases like "LOGO" or "Mood Boards"
  // into a 1:1 box, stretching letters vertically by 3-5× and shrinking
  // serif feet to nothing — CLIP then classified the rounded mush as a
  // friendly sans. Preserving aspect ratio keeps the letterforms in the
  // proportions CLIP's training data expected.
  const aspect = sw / sh;
  let dw: number;
  let dh: number;
  if (aspect >= 1) {
    dw = CROP_SIZE;
    dh = Math.max(1, Math.round(CROP_SIZE / aspect));
  } else {
    dh = CROP_SIZE;
    dw = Math.max(1, Math.round(CROP_SIZE * aspect));
  }
  const dx = Math.round((CROP_SIZE - dw) / 2);
  const dy = Math.round((CROP_SIZE - dh) / 2);

  // `high` picks the browser's sharpest available downsampler. Default
  // bilinear/bicubic blurs serif terminals into rounded blobs at small
  // sizes, which contributed to the same misclassification.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  return canvas.toDataURL('image/png');
}

/** Estimate letter-spacing from a region's pixel density inside its bbox.
 *  Builds a small canvas of just the bbox, counts the fraction of dark
 *  pixels, and bins into tight / normal / wide. Headlines with tight
 *  tracking densely cover their bbox (>22% dark); tracked-out display
 *  text leaves lots of whitespace (<10% dark). Approximate. */
function classifySpacingFromBbox(
  img: HTMLImageElement,
  bbox: { x0: number; y0: number; x1: number; y1: number },
): SpacingClass {
  const w = bbox.x1 - bbox.x0;
  const h = bbox.y1 - bbox.y0;
  if (w <= 0 || h <= 0) return 'normal';

  const MAX = 600;
  const scale = Math.min(MAX / w, 1);
  const cw = Math.max(1, Math.floor(w * scale));
  const ch = Math.max(1, Math.floor(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'normal';

  ctx.drawImage(img, bbox.x0, bbox.y0, w, h, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const THRESHOLD = 120;
  let darkCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i + 3] > 0
      && data[i] < THRESHOLD
      && data[i + 1] < THRESHOLD
      && data[i + 2] < THRESHOLD
    ) {
      darkCount++;
    }
  }
  const density = darkCount / (cw * ch);
  if (density > 0.22) return 'tight';
  if (density < 0.10) return 'wide';
  return 'normal';
}

/** Pixel-based stroke analysis on the ORIGINAL-resolution source bbox.
 *  Outputs three signals the rest of the pipeline needs to be reliable:
 *
 *  - `weight` from stroke_width / letter_height — the actual ratio type
 *    designers use to describe weight (regular ≈ 0.08-0.15, bold ≈ 0.18-0.25,
 *    black ≈ 0.25+). Doesn't get fooled by wide-tracked all-caps display
 *    layouts the way the density proxy does.
 *  - `hasSerifFeet` from the density excess at the top/bottom rows vs the
 *    middle 30%. Serif terminals add horizontal projections at letter caps
 *    and baseline; sans terminals are flat. CLIP at 224×224 can't see this,
 *    a per-pixel scan on the source bbox can.
 *  - `strokeCount` so callers know how much to trust the signals — a word
 *    that's mostly curved letters (LOGO has 2 vertical stems, OOO has 0)
 *    gives a noisy answer.
 *
 *  Falls back to `weight: 'regular'`, `hasSerifFeet: false`, `strokeCount: 0`
 *  on degenerate inputs (zero-sized bbox, blank region, no vertical stems
 *  detected). Callers should check `strokeCount` before treating the result
 *  as ground truth. */
export function analyzeStrokes(
  img: HTMLImageElement,
  bbox: { x0: number; y0: number; x1: number; y1: number },
): StrokeAnalysis {
  const defaults: StrokeAnalysis = {
    weight: 'regular', weightRatio: 0,
    hasSerifFeet: false, serifFootRatio: 0,
    strokeCount: 0,
    isLikelyScript: false,
    isLikelyHand: false,
    measurementFailed: false,
  };
  const failed: StrokeAnalysis = { ...defaults, measurementFailed: true };
  const sourceW = bbox.x1 - bbox.x0;
  const sourceH = bbox.y1 - bbox.y0;
  if (sourceW <= 0 || sourceH <= 0) return defaults;

  // Render at a target letter height ~80 px so we have enough vertical
  // resolution to measure stroke widths (a regular sans is ~6-9 px wide at
  // that height, a thin is 2-4 px, a heavy is 12+ px). Never upscale more
  // than 2× — that just blurs pixels we don't have.
  const TARGET_H = 80;
  const scale = Math.min(TARGET_H / sourceH, 2);
  const w = Math.max(1, Math.round(sourceW * scale));
  const h = Math.max(1, Math.round(sourceH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return defaults;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, bbox.x0, bbox.y0, sourceW, sourceH, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const THRESHOLD = 120;
  const bin = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] > 0 && data[i] < THRESHOLD && data[i + 1] < THRESHOLD && data[i + 2] < THRESHOLD) {
      bin[p] = 1;
    }
  }

  // Trim whitespace rows so we measure relative to the actual letter
  // height, not the bbox padding.
  let firstRow = -1;
  let lastRow = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x]) { any = true; break; }
    }
    if (any) {
      if (firstRow < 0) firstRow = y;
      lastRow = y;
    }
  }
  if (firstRow < 0 || lastRow - firstRow < 4) return defaults;
  const letterHeight = lastRow - firstRow + 1;

  // Longest vertical dark-pixel run per column. Columns whose run covers
  // ≥40% of letter height are "stem columns" — that's the threshold that
  // captures the vertical stem of L, I, T, M, N, H without catching the
  // horizontal bar of an A or the diagonal of an X.
  const colRuns = new Uint16Array(w);
  for (let x = 0; x < w; x++) {
    let cur = 0;
    let max = 0;
    for (let y = firstRow; y <= lastRow; y++) {
      if (bin[y * w + x]) {
        cur++;
        if (cur > max) max = cur;
      } else {
        cur = 0;
      }
    }
    colRuns[x] = max;
  }
  const stemThreshold = letterHeight * 0.4;

  // Cluster contiguous stem columns into strokes, and for each stroke
  // capture its y-range so we can check the terminals (top/bottom rows)
  // for horizontal serif extensions.
  const stems: Array<{ xStart: number; xEnd: number; yStart: number; yEnd: number }> = [];
  let stemStart = -1;
  for (let x = 0; x <= w; x++) {
    const isStem = x < w && colRuns[x] >= stemThreshold;
    if (isStem) {
      if (stemStart < 0) stemStart = x;
    } else if (stemStart >= 0) {
      const stemEnd = x - 1;
      // Find this stem's actual y-range by scanning for dark pixels in
      // any of its columns.
      let yMin = h;
      let yMax = -1;
      for (let y = firstRow; y <= lastRow; y++) {
        for (let xs = stemStart; xs <= stemEnd; xs++) {
          if (bin[y * w + xs]) {
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
            break;
          }
        }
      }
      if (yMax >= yMin) {
        stems.push({ xStart: stemStart, xEnd: stemEnd, yStart: yMin, yEnd: yMax });
      }
      stemStart = -1;
    }
  }
  if (stems.length === 0) return defaults;

  // Median stroke width — robust to outliers like joined letterforms.
  const strokeWidths = stems.map((s) => s.xEnd - s.xStart + 1);
  const sortedWidths = [...strokeWidths].sort((a, b) => a - b);
  const medianWidth = sortedWidths[Math.floor(sortedWidths.length / 2)];
  const weightRatio = medianWidth / letterHeight;

  // Sanity gate. Real fonts cap at ~25–30% stroke ratio (extra-bold display
  // serif on dense slab). Anything above ~50% means the scanner failed —
  // typically a heavy display lettering on a colored background where the
  // binarizer can't separate ink from background and clusters wide bands
  // into single "stems" (DREAM at 217%, etc.). Return the defaults so
  // downstream classifiers fall back to CLIP / spacing-derived proxies
  // instead of trusting a nonsense weight / serif verdict.
  if (weightRatio > 0.5) return failed;

  let weight: VisualWeight = 'regular';
  if (weightRatio < 0.10) weight = 'thin';
  else if (weightRatio > 0.18) weight = 'heavy';

  // Per-stem serif detection. For each vertical stroke, measure the
  // horizontal extent of dark pixels at the top 3 rows and bottom 3 rows
  // of its y-range, looking up to 1× the stroke's own width on either
  // side. A serif foot shows up as a row that's noticeably wider than the
  // stroke itself (typically ≥2× the stroke width with a ≥2 px floor for
  // thin serifs). Vote across stems — a font with serifs has serif feet
  // on the majority of its vertical stems (L, T, M, N, H, etc.).
  const measureRowSpan = (y: number, xLow: number, xHigh: number): number => {
    let leftMost = -1;
    let rightMost = -1;
    const lo = Math.max(0, xLow);
    const hi = Math.min(w - 1, xHigh);
    for (let x = lo; x <= hi; x++) {
      if (bin[y * w + x]) {
        if (leftMost < 0) leftMost = x;
        rightMost = x;
      }
    }
    return rightMost < 0 ? 0 : rightMost - leftMost + 1;
  };

  // Sharpness offset — how far up the stem we sample to check whether the
  // widening is a SHARP foot (true serif) or a GRADIENT flare (brush
  // lettering, e.g. "LEMON" hand-painted display). True serifs return to
  // stem width within 2–3 px of the terminal; brush flares are still much
  // wider 6+ px up the stem because the brush carries weight gradually.
  // ~6% of letter height with a 4 px floor keeps the check meaningful at
  // tiny crops and proportional at large ones.
  const SHARPNESS_OFFSET = Math.max(4, Math.round(letterHeight * 0.06));

  let stemsWithBothFeet = 0;
  let stemsWithAnyFoot = 0;
  for (const stem of stems) {
    const mainWidth = stem.xEnd - stem.xStart + 1;
    // Look further to the sides than the stem's own width — Bodoni L feet
    // extend well beyond mainWidth, and we'd rather over-reach into white
    // space (no false hits there) than under-reach into a thin cap serif.
    const sideReach = Math.max(8, Math.floor(mainWidth * 1.5));
    const xLow = stem.xStart - sideReach;
    const xHigh = stem.xEnd + sideReach;
    const bottomSpan = Math.max(
      measureRowSpan(stem.yEnd,                                      xLow, xHigh),
      measureRowSpan(Math.max(stem.yStart, stem.yEnd - 1),           xLow, xHigh),
      measureRowSpan(Math.max(stem.yStart, stem.yEnd - 2),           xLow, xHigh),
    );
    const topSpan = Math.max(
      measureRowSpan(stem.yStart,                                    xLow, xHigh),
      measureRowSpan(Math.min(stem.yEnd, stem.yStart + 1),           xLow, xHigh),
      measureRowSpan(Math.min(stem.yEnd, stem.yStart + 2),           xLow, xHigh),
    );
    // Sharpness sample — span SHARPNESS_OFFSET px inside the stem. For a
    // true serif this row sits above the foot's flare and reads near stem
    // width. For a brush flare this row is still inside the gradient and
    // reads much wider.
    const innerBottomSpan = measureRowSpan(
      Math.max(stem.yStart, stem.yEnd - SHARPNESS_OFFSET),
      xLow, xHigh,
    );
    const innerTopSpan = measureRowSpan(
      Math.min(stem.yEnd, stem.yStart + SHARPNESS_OFFSET),
      xLow, xHigh,
    );
    // Sharpness threshold: anything more than 1.15× the stem at the inner
    // sample row counts as gradient (brush), not a true foot. Keep it
    // permissive — heavy slab serifs DO have some inward thickening, just
    // not as much as a brush carries.
    const bottomIsSharp = innerBottomSpan <= Math.max(mainWidth + 1, mainWidth * 1.15);
    const topIsSharp    = innerTopSpan    <= Math.max(mainWidth + 1, mainWidth * 1.15);
    // A terminal counts as a serif foot when:
    //   1. the terminal-row dark span is 2+ px wider than the stem AND
    //      ≥1.3× the stem width (catches the widening), AND
    //   2. the SHARPNESS sample is back near stem width (rules out brush
    //      flares that look "wide at the base" but never sharpen).
    const hasFootBottom = bottomSpan >= mainWidth + 2
                         && bottomSpan >= mainWidth * 1.3
                         && bottomIsSharp;
    const hasFootTop    = topSpan    >= mainWidth + 2
                         && topSpan    >= mainWidth * 1.3
                         && topIsSharp;
    if (hasFootBottom && hasFootTop) stemsWithBothFeet++;
    if (hasFootBottom || hasFootTop) stemsWithAnyFoot++;
  }

  const serifFootRatio = stemsWithBothFeet / Math.max(1, stems.length);
  // Count-based decision instead of ratio-based:
  //   - ≥1 stem with feet on BOTH terminals = unambiguous serif (L's stem
  //     in a Bodoni LOGO; M / B / d stems in a Bodoni "Mood"). Curve sides
  //     never produce this — they have one or zero terminal feet at most.
  //   - ≥2 stems with feet on either terminal = chunky slab pattern where
  //     cap serifs may be partly clipped or asymmetric.
  // Sans fonts never produce either signature because flat terminals
  // don't extend horizontally at all. This makes us immune to the
  // O/C/G/Q-vote-dilution problem that ratio-based detection had.
  const hasSerifFeet = stemsWithBothFeet >= 1 || stemsWithAnyFoot >= 2;

  return {
    weight,
    weightRatio,
    hasSerifFeet,
    serifFootRatio,
    strokeCount: stems.length,
    measurementFailed: false,
    isLikelyScript: false, // populated in cropFromBboxes once the text is known
    isLikelyHand: false,   // populated in cropFromBboxes alongside script
  };
}

/** Pixel flood-fill region detector — used as a fallback when GCV returns
 *  no regions or errors. Not OCR (no recognition); just finds bounding
 *  boxes of connected dark blobs in the image and applies size + aspect
 *  + density filters to drop obvious photo/swatch crops. Returns the same
 *  TextCrops shape so callers can swap detectors transparently. */
export async function cropPixelFallback(imageUrl: string): Promise<TextCrops> {
  const t0 = Date.now();
  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      regionCount: 0,
      regions: [],
      diag: { wordCount: 0, elapsedMs: Date.now() - t0, pixelFallbackUsed: true, error: `image load: ${msg}` },
    };
  }

  const detected = estimatePixelTextRegions(img, 3);
  console.info(`[pixel] fallback found ${detected.length} candidate regions`);
  const regions: ExtractedTextRegion[] = detected.map((r) => ({
    dataUrl: regionToDataUrl(img, r),
    height: r.bbox.y1 - r.bbox.y0,
    text: '',
    isAllCaps: false,
    spacing: classifySpacingFromBbox(img, r.bbox),
    stroke: analyzeStrokes(img, r.bbox),
  }));

  return {
    header: regions[0]?.dataUrl,
    decorative: regions.length > 1 && regions[1].height < regions[0].height * DECORATIVE_HEIGHT_RATIO
      ? regions[1].dataUrl
      : undefined,
    regionCount: regions.length,
    regions,
    diag: {
      wordCount: regions.length,
      elapsedMs: Date.now() - t0,
      pixelFallbackUsed: true,
    },
  };
}

function estimatePixelTextRegions(
  img: HTMLImageElement,
  maxRegions = 3,
): TextRegion[] {
  const canvas = document.createElement('canvas');
  // Downsample large moodboards so flood-fill stays cheap. Bboxes are
  // scaled back to original-image coordinates before returning.
  const MAX_DIM = 800;
  const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
  const w = Math.floor(img.width * scale);
  const h = Math.floor(img.height * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const THRESHOLD = 120;
  const visited = new Uint8Array(w * h);
  const isDark = (i: number) =>
    data[i + 3] > 0
    && data[i]     < THRESHOLD
    && data[i + 1] < THRESHOLD
    && data[i + 2] < THRESHOLD;

  const candidates: TextRegion[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      if (visited[idx] || !isDark(pIdx)) continue;

      let minX = x, minY = y, maxX = x, maxY = y;
      let pixelCount = 0;
      const queue: number[] = [idx];
      visited[idx] = 1;
      while (queue.length > 0) {
        const cur = queue.shift() as number;
        pixelCount++;
        const cx = cur % w;
        const cy = (cur - cx) / w;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          cy > 0     ? cur - w : -1,
          cy < h - 1 ? cur + w : -1,
          cx > 0     ? cur - 1 : -1,
          cx < w - 1 ? cur + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n < 0 || visited[n]) continue;
          if (!isDark(n * 4)) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }

      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const area = bboxW * bboxH;
      const imgArea = w * h;
      const aspect = bboxH > 0 ? bboxW / bboxH : Infinity;
      const density = area > 0 ? pixelCount / area : 0;

      const looksLikePhoto = bboxW > w * 0.4 || bboxH > h * 0.25;
      const looksLikeSpeck = area < imgArea * 0.001;
      // Real text headlines are usually wider than tall and rarely above 12:1.
      const odd = aspect < 1.2 || aspect > 12;
      const tooDense = density > 0.55;
      const tooSparse = density < 0.12;
      if (looksLikePhoto || looksLikeSpeck || odd || tooDense || tooSparse) continue;

      candidates.push({
        text: '',
        confidence: 50,
        bbox: {
          x0: Math.round(minX / scale),
          y0: Math.round(minY / scale),
          x1: Math.round(maxX / scale),
          y1: Math.round(maxY / scale),
        },
      });
    }
  }

  candidates.sort((a, b) => (b.bbox.y1 - b.bbox.y0) - (a.bbox.y1 - a.bbox.y0));
  return candidates.slice(0, maxRegions);
}

// ── deprecated shims ────────────────────────────────────────────────
// The legacy TypographyStage still imports these from this module. ESM
// verifies named imports at parse time, so removing them entirely breaks
// module load even though TypographyStage's classify call is never reached
// in the new flow. These will be deleted once TypographyStage is replaced.

/** @deprecated Old Teachable Machine shape — kept for module-load parity. */
export interface DetectedTypography {
  headerStyle: string;
  decorativeStyle: string | null;
  bodyStyle: string;
  headerWeight: number;
  decorativeWeight: number;
  bodyWeight: number;
  headerLetterSpacing: number;
  decorativeLetterSpacing: number;
  bodyLetterSpacing: number;
  headerIsAllCaps: boolean;
  decorativeIsAllCaps: boolean;
  hasText: boolean;
}

/** @deprecated Replaced by GCV + CLIP. Throws if invoked. */
export async function classifyTextRegions(
  _imageElement: HTMLImageElement,
  _regions: TextRegion[]
): Promise<DetectedTypography> {
  throw new Error(
    'classifyTextRegions has been removed. Use analyzeMoodboard from analyzeMoodboardClient.ts instead.'
  );
}

/** @deprecated The Tesseract-based detector was removed; this shim only
 *  exists so any lingering import in the legacy TypographyStage doesn't
 *  break module load. */
export async function detectTextRegions(
  _imageElement: HTMLImageElement
): Promise<{ regions: TextRegion[]; diag: OcrDiag }> {
  return { regions: [], diag: { wordCount: 0, elapsedMs: 0, error: 'detectTextRegions removed — GCV is now the only OCR path' } };
}
