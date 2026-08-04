// functions/data/promptDictionaries.js
//
// CLIP-prompt vocab + typographic defaults extracted from the v4 font-matcher
// notebook. The Cloud Function embeds these prompts with CLIP and cosine-
// scores them against the moodboard image to pick a typographic category
// and weight/width modifier. The category then drives font-pool selection
// against `font_library.json` (body_pool, pairing_rules, categories).
//
// Keep the prompt text in lock-step with the notebook — these strings define
// the model's prior, so editing them changes classification behavior.

/** Each category has 5 descriptive prompts. Image embedding is cosine-scored
 *  against the average of the 5; softmax × 10 picks the winner. */
const CATEGORIES = {
  serif_editorial: [
    'elegant serif font with small projecting feet and dramatic high contrast strokes',
    'luxury high contrast serif typeface with prominent serif terminals like Didot or Bodoni',
    'fashion magazine serif font with thin delicate strokes and elegant serif feet',
    'refined editorial serif typography with strong stroke contrast and traditional serifs',
    'classical serif font with high contrast letterforms and visible projecting serif feet',
  ],
  serif_workhorse: [
    'sturdy readable serif font with visible serif feet like Times New Roman or Baskerville',
    'traditional book serif typeface with moderate contrast and small projecting serifs',
    'authoritative newspaper serif font with classical serif terminals',
    'classic workhorse serif typography with visible serif feet for body text',
    'reliable moderate contrast serif font with traditional projecting serif terminals',
  ],
  serif_slab: [
    'slab serif font with thick rectangular block feet at stroke ends',
    'industrial mechanical slab serif typeface with chunky square serif terminals',
    'bold chunky slab serif with uniform thick strokes and prominent block feet',
    'sturdy slab serif font with heavy rectangular serif terminals and no stroke contrast',
    'egyptian slab serif typeface with thick block serifs at every stroke end',
  ],
  sans_clean: [
    'clean modern sans serif font with no serifs and flat stroke endings like Helvetica or Inter',
    'minimal utilitarian sans serif typeface with unembellished stroke terminals for UI',
    'neutral grotesque sans serif font with uniform strokes and no projecting feet',
    'professional workhorse sans serif typography clean invisible and without serifs',
    'simple legible sans serif font with flat stroke endings for body text',
    'bold modern sans serif headline with thick uniform strokes and no serifs at all',
    'heavy black sans serif headline with thick clean stroke ends and absolutely no ornaments',
  ],
  sans_geometric: [
    'geometric sans serif font built on circles and squares like Futura with no serifs',
    'modern geometric sans serif typeface with circular letterforms and flat terminals',
    'constructed mathematical sans serif with consistent forms and clean stroke endings',
    'bauhaus inspired geometric sans serif with no projecting feet or serifs',
    'heavy bold geometric sans serif headline like Montserrat Black or Manrope Black with no serifs',
    'bold condensed sans serif headline with thick uniform vertical strokes and flat ends like Bebas Neue or Oswald',
    'tall narrow condensed sans serif font with clean flat stroke ends and zero ornaments',
  ],
  sans_friendly: [
    'friendly rounded sans serif font with soft rounded stroke endings and no serifs',
    'warm approachable sans serif with rounded terminals like Nunito or Quicksand',
    'playful rounded sans serif typeface soft humanist and without serifs',
    'humanist sans serif headline with friendly rounded shapes and no projecting feet',
    'modern rounded sans serif display font for warm friendly headlines',
  ],
  expressive_display: [
    'highly decorative novelty font with illustrated comic book style letterforms',
    'retro poster lettering with elaborate ornaments and decorative shapes inside the letters',
    'character driven novelty typeface with visual gimmicks like outlines shadows fills or 3D effects',
    'vintage themed circus poster or western lettering with unique decorations on every letter',
    'art deco or carnival style font with elaborate ornamental glyphs not just bold sans serif',
    'illustrated picture font with shapes inside the letters not a clean sans serif',
  ],
  expressive_script_formal: [
    'elegant calligraphic script typeface with engraved formal letterforms',
    'wedding invitation style cursive font with refined connected letters',
    'classical copperplate calligraphy with high contrast strokes and flourishes',
    'formal pointed pen script font with thin upstrokes and thick downstrokes',
    'engraved invitation script with elegant swashes and decorative ligatures',
  ],
  expressive_script_handwritten: [
    'casual handwritten cursive font with flowing connected letters',
    'relaxed everyday cursive script like a friendly handwritten note',
    'casual brush cursive typeface with informal connected letterforms',
    'hand-written cursive style font with natural loose connections between letters',
    'informal flowing handwritten script with the rhythm of a real pen',
  ],
  expressive_handwritten: [
    'casual handwritten font that looks like pen or marker writing',
    'informal handwriting style typeface with unconnected printed letters',
    'hand lettered casual font like someone printed it by hand',
    'sketchy handwritten typeface personal and informal not connected',
    'casual handwritten font with irregular unconnected printed letterforms',
  ],
};

/** 3-way pre-classifier — run BEFORE the 9-way CATEGORIES classifier so the
 *  category winner is constrained to the right branch. Prompts emphasize the
 *  binary "are there serifs or not" question to give CLIP a strong visual
 *  anchor — most font misclassifications come from CLIP conflating bold
 *  display sans with bold display serif because both prompts mention
 *  "bold... headlines and posters". */
const PRIMARY_BRANCH = {
  serif: [
    'letters with small projecting feet at the ends of every stroke',
    'serif typeface with visible decorative terminals at letter ends',
    'font with traditional serif feet on every letter stem',
    'lettering with prominent triangular or rectangular serifs at stroke ends',
    'classical font with serifs at the top and bottom of vertical strokes',
  ],
  sans_serif: [
    'letters with clean flat stroke endings and no projecting feet',
    'sans serif typeface without any serifs or decorative terminals',
    'font with completely unembellished line endings and no serif feet',
    'modern lettering with uniform strokes and no projecting decorative ends',
    'minimal letterforms with cut-off stroke ends and absolutely no serifs',
    'bold condensed sans serif headline with thick vertical strokes and flat ends',
    'tall narrow sans serif font with clean flat stroke ends and zero ornaments inside the letters',
  ],
  expressive: [
    'highly stylized illustrated lettering with elaborate decorative shapes inside the letters',
    'novelty cartoon style typeface with unique visual gimmicks like outlines shadows or 3D effects',
    'comic book or themed circus poster font with elaborate ornaments on every glyph',
    'cursive flowing script handwriting with curved connected letters',
    'casual hand printed handwriting with informal irregular letterforms',
    'illustrated picture font with shapes patterns or decorations inside the letterforms',
  ],
};

/** Which CATEGORIES belong to which branch — used to filter CATEGORIES
 *  before the 9-way classifier so the category winner is in-branch. */
const CATEGORIES_BY_BRANCH = {
  serif:      ['serif_editorial', 'serif_workhorse', 'serif_slab'],
  sans_serif: ['sans_clean', 'sans_geometric', 'sans_friendly'],
  expressive: ['expressive_display', 'expressive_script_formal', 'expressive_script_handwritten', 'expressive_handwritten'],
};

const MODIFIERS = {
  weight: {
    thin: [
      'very thin light weight font with hairline strokes',
      'ultra light thin typeface barely visible strokes',
    ],
    regular: [
      'regular weight font normal stroke width',
      'standard medium weight typeface normal thickness',
    ],
    heavy: [
      'bold heavy black weight font with thick strokes',
      'extra bold heavy typeface with very thick strokes',
    ],
  },
  width: {
    condensed: [
      'condensed narrow compressed font tall and narrow letters',
      'compressed condensed typeface with narrow letter spacing',
    ],
    normal: [
      'normal regular width font standard proportions',
      'standard width typeface normal letter proportions',
    ],
    extended: [
      'wide extended font with broad letter spacing',
      'expanded wide typeface with broad letterforms',
    ],
  },
};

/** Display labels per category: [branch, style]. Branch buckets a category
 *  into Serif / Sans serif / Expressive — used to choose the body-pool
 *  primary axis and to color UI badges. */
const CATEGORY_LABELS = {
  serif_editorial:        ['Serif',      'Editorial / High contrast'],
  serif_workhorse:        ['Serif',      'Workhorse / Traditional'],
  serif_slab:             ['Serif',      'Slab / Industrial'],
  sans_clean:             ['Sans serif', 'Clean / Neutral'],
  sans_geometric:         ['Sans serif', 'Geometric / Constructed'],
  sans_friendly:          ['Sans serif', 'Friendly / Rounded'],
  expressive_display:            ['Expressive', 'Display / Decorative'],
  expressive_script_formal:      ['Expressive', 'Formal Script'],
  expressive_script_handwritten: ['Expressive', 'Handwritten Script'],
  expressive_handwritten:        ['Expressive', 'Handwritten / Informal'],
};

/** Letter-spacing (em) per role per category. Tuned in the notebook for each
 *  family's visual rhythm — editorial serifs run tight, expressive scripts run
 *  slightly loose. Body stays at 0em across the board. */
const LETTER_SPACING = {
  header: {
    serif_editorial:        '-0.03em',
    serif_workhorse:        '-0.01em',
    serif_slab:             '0em',
    sans_clean:             '-0.01em',
    sans_geometric:         '-0.02em',
    sans_friendly:          '0.01em',
    expressive_display:            '0em',
    expressive_script_formal:      '0.02em',
    expressive_script_handwritten: '0.02em',
    expressive_handwritten:        '0.02em',
  },
  decorative: {
    serif_editorial:               '-0.01em',
    serif_workhorse:               '0em',
    serif_slab:                    '0.02em',
    sans_clean:                    '0em',
    sans_geometric:                '0em',
    sans_friendly:                 '0.02em',
    expressive_display:            '0.02em',
    expressive_script_formal:      '0.03em',
    expressive_script_handwritten: '0.03em',
    expressive_handwritten:        '0.03em',
  },
  body: '0em',
};

/** Header font-weight per detected weight modifier. */
const HEADER_WEIGHT     = { thin: '300', regular: '600', heavy: '800' };
/** Decorative weight — one step lighter than header to build hierarchy. */
const DECORATIVE_WEIGHT = { thin: '300', regular: '400', heavy: '700' };
/** Body weights are always the same trio. */
const BODY_WEIGHTS      = { regular: '400', semibold: '600', bold: '700' };

module.exports = {
  CATEGORIES,
  PRIMARY_BRANCH,
  CATEGORIES_BY_BRANCH,
  MODIFIERS,
  CATEGORY_LABELS,
  LETTER_SPACING,
  HEADER_WEIGHT,
  DECORATIVE_WEIGHT,
  BODY_WEIGHTS,
};
