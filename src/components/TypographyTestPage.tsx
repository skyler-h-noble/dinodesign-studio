// Internal dev page for the new CLIP typography pipeline. Lets us drop a
// moodboard, see what `analyzeMoodboard` returns, and pick fonts across four
// tabs (Trios / Header / Decorative / Body) with per-role overrides.
//
// Font previews render through raw <div>s with explicit `fontFamily` — the
// lib's typography components only emit the brand's fonts, but the whole
// point of this page is to preview *arbitrary* Google Fonts. That's the
// shell-only-chrome exception. The wrapping <div> is also shell chrome —
// Section is exported by the lib at runtime but the package ships no .d.ts
// files, so TS can't resolve the named import.
//
// MISSING-LIB-COMPONENT: FileInput
// Needed for: the moodboard picker + the "Upload a font" affordances on the
// Header / Decorative / Body tabs.
// Proposed API: <FileInput accept="image/*" onSelect={(file) => …} children={<Button>Pick file</Button>} />
// Lib-track: add to @dynodesign/components/src/components/FileInput/

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Button, ButtonGroup, H1, H2, H3, Body, BodySmall, Caption, OverlineSmall,
  Card, VStack, HStack, Divider, Alert, Link, Checkbox, Slider,
  AccordionGroup, Accordion, AccordionSummary, AccordionDetails,
  Modal,
} from '@dynodesign/components';
import { useAuth } from '../contexts/AuthContext';
import { analyzeMoodboard, warmAnalyzeMoodboard, getOrStartMoodboardAnalysis } from '../utils/analyzeMoodboardClient';
import type { MoodboardAnalysis, ExtractedTextRegion, FontTrio } from '../utils/analyzeMoodboardClient';
import { uploadDesignSystemFile, getPublicFileUrl } from '../utils/firebase/storage';
import { logGateFeedback, logGateRejections } from '../utils/textGateFeedback';

const TEST_FOLDER = 'test-typography';

type Status = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
type BodyFamily = 'sans' | 'serif';

type TextCase = 'normal' | 'uppercase';

interface StylePreset {
  label: string;
  family: string;
  category: string;
  modifiers: { weight: string; width: string };
  weight: string;          // CSS font-weight to apply
  letterSpacing: string;   // CSS letter-spacing to apply
  textTransform?: TextCase; // 'uppercase' for all-caps presets
}

interface FontSuggestion {
  label: string;             // e.g. "From your moodboard text"
  description: string;       // e.g. CLIP detected category
  family: string;
  weight: string;
  letterSpacing: string;
  textTransform?: TextCase;
}

// Curated preset palette: 12 core options shown by default, ~20 additional
// behind a "Show more" reveal. Every category and every common modifier
// combination (thin, heavy, condensed, all-caps) is represented so the user
// can rescue the matcher when CLIP's whole-image classification misfires
// (the FIT AND FREE / Lato Thin case). Preset.category MUST match a key in
// CATEGORY_FAMILY_POOLS so the trio cards can cycle through that pool when
// the preset is picked.
const HEADER_STYLE_PRESETS: StylePreset[] = [
  // ── Core 12 (visible by default) ────────────────────────────────────
  { label: 'Editorial serif',           family: 'Playfair Display', category: 'Serif / Editorial',    modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Workhorse serif',           family: 'Lora',             category: 'Serif / Workhorse',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '600', letterSpacing: '0em' },
  { label: 'Slab serif',                family: 'Roboto Slab',      category: 'Serif / Slab',         modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Clean sans',                family: 'Inter',            category: 'Sans / Clean',         modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '-0.01em' },
  { label: 'Clean sans thin all-caps',  family: 'Inter',            category: 'Sans / Clean',         modifiers: { weight: 'thin',    width: 'normal'    }, weight: '300', letterSpacing: '0.18em', textTransform: 'uppercase' },
  { label: 'Geometric sans',            family: 'Montserrat',       category: 'Sans / Geometric',     modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Lato thin all-caps',        family: 'Lato',             category: 'Sans / Clean',         modifiers: { weight: 'thin',    width: 'normal'    }, weight: '300', letterSpacing: '0.22em', textTransform: 'uppercase' },
  { label: 'Friendly sans',             family: 'Nunito',           category: 'Sans / Friendly',      modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Bebas Neue (condensed)',    family: 'Bebas Neue',       category: 'Sans / Geometric',     modifiers: { weight: 'regular', width: 'condensed' }, weight: '400', letterSpacing: '0.08em', textTransform: 'uppercase' },
  { label: 'Condensed sans all-caps',   family: 'Oswald',           category: 'Sans / Geometric',     modifiers: { weight: 'regular', width: 'condensed' }, weight: '400', letterSpacing: '0.12em', textTransform: 'uppercase' },
  { label: 'Formal script',             family: 'Dancing Script',   category: 'Expressive / Formal Script',      modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Handwritten script',        family: 'Sacramento',       category: 'Expressive / Handwritten Script', modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Handwritten',               family: 'Caveat',           category: 'Expressive / Hand',               modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  // ── Show more (hidden until the user expands) ───────────────────────
  { label: 'Bodoni (high contrast)',    family: 'Bodoni Moda',      category: 'Serif / Editorial',    modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '800', letterSpacing: '0em' },
  { label: 'Cormorant (light serif)',   family: 'Cormorant Garamond', category: 'Serif / Editorial',  modifiers: { weight: 'thin',    width: 'normal'    }, weight: '300', letterSpacing: '0.02em' },
  { label: 'Libre Baskerville',         family: 'Libre Baskerville', category: 'Serif / Workhorse',   modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Merriweather',              family: 'Merriweather',     category: 'Serif / Workhorse',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Arvo (slab)',               family: 'Arvo',             category: 'Serif / Slab',         modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Roboto',                    family: 'Roboto',           category: 'Sans / Clean',         modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Work Sans',                 family: 'Work Sans',        category: 'Sans / Clean',         modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Manrope',                   family: 'Manrope',          category: 'Sans / Clean',         modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '800', letterSpacing: '-0.01em' },
  { label: 'Open Sans',                 family: 'Open Sans',        category: 'Sans / Clean',         modifiers: { weight: 'regular', width: 'normal'    }, weight: '600', letterSpacing: '0em' },
  { label: 'Poppins',                   family: 'Poppins',          category: 'Sans / Geometric',     modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Jost',                      family: 'Jost',             category: 'Sans / Geometric',     modifiers: { weight: 'regular', width: 'normal'    }, weight: '500', letterSpacing: '0em' },
  { label: 'Raleway (light)',           family: 'Raleway',          category: 'Sans / Geometric',     modifiers: { weight: 'thin',    width: 'normal'    }, weight: '300', letterSpacing: '0.04em' },
  { label: 'DM Sans',                   family: 'DM Sans',          category: 'Sans / Geometric',     modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '700', letterSpacing: '-0.01em' },
  { label: 'Anton (condensed)',         family: 'Anton',            category: 'Sans / Geometric',     modifiers: { weight: 'regular', width: 'condensed' }, weight: '400', letterSpacing: '0.04em', textTransform: 'uppercase' },
  { label: 'Quicksand',                 family: 'Quicksand',        category: 'Sans / Friendly',      modifiers: { weight: 'regular', width: 'normal'    }, weight: '500', letterSpacing: '0em' },
  { label: 'Comfortaa',                 family: 'Comfortaa',        category: 'Sans / Friendly',      modifiers: { weight: 'regular', width: 'normal'    }, weight: '500', letterSpacing: '0em' },
  { label: 'Bangers',                   family: 'Bangers',          category: 'Expressive / Display', modifiers: { weight: 'heavy',   width: 'normal'    }, weight: '400', letterSpacing: '0.02em' },
  { label: 'Righteous',                 family: 'Righteous',        category: 'Expressive / Display', modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Great Vibes (formal)',      family: 'Great Vibes',      category: 'Expressive / Formal Script',      modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Sacramento (handwritten)',  family: 'Sacramento',       category: 'Expressive / Handwritten Script', modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Patrick Hand',              family: 'Patrick Hand',     category: 'Expressive / Hand',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Indie Flower',              family: 'Indie Flower',     category: 'Expressive / Hand',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
];

type BranchKey = 'sans' | 'serif' | 'expressive';
type BranchFilter = {
  sans: boolean;
  serif: boolean;
  expressive: boolean;
};

/** Map a preset's display category to one of the three branch filters in
 *  the Customize modal. Sans/Serif categories map to their obvious branch;
 *  every Expressive subcategory (Script, Hand, Display/Novelty) collapses
 *  to a single "Script / Handwritten" filter so we keep the UI to three
 *  checkboxes per the request. */
function presetBranch(category: string): BranchKey {
  if (category.startsWith('Sans /'))  return 'sans';
  if (category.startsWith('Serif /')) return 'serif';
  return 'expressive';
}

const DEFAULT_BRANCH_FILTER: BranchFilter = {
  sans: true, serif: true, expressive: true,
};

// Decorative reuses the same family palette but a step lighter; all-caps
// variants stay all-caps since that's the choice that defines them.
const DECORATIVE_STYLE_PRESETS: StylePreset[] = HEADER_STYLE_PRESETS.map((p) => ({
  ...p,
  weight: p.textTransform === 'uppercase'
    ? p.weight
    : (p.family === 'Bebas Neue' ? '400' : String(Math.max(300, parseInt(p.weight, 10) - 200))),
  letterSpacing: p.textTransform === 'uppercase' ? p.letterSpacing : '0.04em',
}));


// Category → varied family pool, lifted from functions/data/font_library.json.
// When the user clicks a style preset on the left, each trio shows a DIFFERENT
// family from the matching pool (instead of every trio locking to the picked
// family). Keep these lists in sync with font_library.json — the server-side
// font_library is the source of truth for the curated picks.
const CATEGORY_FAMILY_POOLS: Record<string, string[]> = {
  'Serif / Editorial':    ['Playfair Display', 'Cormorant Garamond', 'Cormorant', 'Spectral', 'GFS Didot', 'EB Garamond', 'Crimson Text', 'Libre Caslon Text'],
  'Serif / Workhorse':    ['Libre Baskerville', 'Merriweather', 'PT Serif', 'Lora', 'Source Serif 4', 'Noto Serif', 'Charis SIL', 'Vollkorn'],
  'Serif / Slab':         ['Roboto Slab', 'Arvo', 'Zilla Slab', 'Alfa Slab One', 'Bitter', 'Kameron', 'Rokkitt', 'Kreon'],
  'Sans / Clean':         ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'IBM Plex Sans', 'Manrope', 'Noto Sans'],
  'Sans / Geometric':     ['Poppins', 'Montserrat', 'Josefin Sans', 'DM Sans', 'Jost', 'Raleway', 'Space Grotesk', 'Outfit', 'Bebas Neue', 'Oswald', 'Anton', 'Barlow Condensed', 'Saira Condensed', 'Big Shoulders Display'],
  'Sans / Friendly':      ['Nunito', 'Comfortaa', 'Quicksand', 'Varela Round', 'Rubik', 'Fredoka', 'Dosis', 'Baloo 2'],
  'Expressive / Display':            ['Bangers', 'Righteous', 'Boogaloo', 'Titan One', 'Bungee', 'Lilita One', 'Passion One', 'Luckiest Guy'],
  'Expressive / Formal Script':      ['Dancing Script', 'Great Vibes', 'Allura', 'Pinyon Script', 'Italianno', 'Parisienne', 'Mr De Havilland', 'Cookie'],
  'Expressive / Handwritten Script': ['Sacramento', 'Satisfy', 'Yellowtail', 'Kaushan Script', 'Alex Brush', 'Courgette', 'Leckerli One', 'Yesteryear'],
  'Expressive / Hand':               ['Caveat', 'Indie Flower', 'Patrick Hand', 'Permanent Marker', 'Shadows Into Light', 'Architects Daughter', 'Amatic SC', 'Rock Salt'],
};

/** When the user has picked a category preset, snap a CLIP-detected family
 *  to the same pool so the auto-suggestion respects the user's intent.
 *  Returns the original family unchanged if no category is set, if the
 *  category has no pool, or if CLIP's pick already lives in the pool. */
function clampFamilyToCategory(
  detectedFamily: string,
  category: string | null,
  excludeFamily: string | null,
): string {
  if (!category) return detectedFamily;
  const pool = CATEGORY_FAMILY_POOLS[category];
  if (!pool || pool.length === 0) return detectedFamily;
  if (pool.includes(detectedFamily)) return detectedFamily;
  return pool.find((f) => f !== excludeFamily) ?? pool[0];
}

/** Resolve the family to render in trio card #index for one role.
 *  - With a category picked, cycle through that category's pool so each trio
 *    shows a different family in the same style. The user's specifically-
 *    picked family takes slot 0 so they always see their pick first.
 *  - Without a category, fall back to the server's per-trio ranking — the
 *    override is shown in the "Your current pick" card at the top instead of
 *    being smeared across every trio. */
function familyForTrioRole(
  index: number,
  presetCategory: string | null,
  presetFamily: string | null,
  fallback: string,
): string {
  if (presetCategory) {
    const pool = CATEGORY_FAMILY_POOLS[presetCategory];
    if (pool && pool.length > 0) {
      const ordered = presetFamily
        ? [presetFamily, ...pool.filter((f) => f !== presetFamily)]
        : pool;
      return ordered[index % ordered.length];
    }
  }
  return fallback;
}

// Sans / serif body fallbacks used when the user toggles or uploads. Each
// side has one canonical family — body doesn't get a style picker.
const BODY_SANS_DEFAULT = 'Inter';
const BODY_SERIF_DEFAULT = 'Source Serif Pro';
const BODY_SAMPLE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

/** Pick the more trustworthy weight signal. The pixel-based stroke
 *  analysis measures stroke_width / letter_height directly on the source
 *  bbox and isn't fooled by wide-tracked all-caps display layouts the way
 *  CLIP's modifier classifier is. We only trust the pixel signal when the
 *  region had ≥2 vertical stems detected — words made entirely of curved
 *  letters (OO, oo) don't give the stroke detector anything to measure. */
function effectiveWeight(
  clipWeight: 'thin' | 'regular' | 'heavy',
  region: ExtractedTextRegion | undefined,
): 'thin' | 'regular' | 'heavy' {
  // Script fonts almost universally only ship in regular weight (no Bold
  // Dancing Script, no Black Sacramento). Rendering them at CLIP's heavy
  // guess produces an awkwardly synthesized bold. Force regular.
  if (region && region.stroke.isLikelyScript) return 'regular';
  if (region && region.stroke.strokeCount >= 2) return region.stroke.weight;
  return clipWeight;
}

const SERIF_POOL_KEYS = ['Serif / Editorial', 'Serif / Workhorse', 'Serif / Slab'];
const SANS_POOL_KEYS  = ['Sans / Clean', 'Sans / Geometric', 'Sans / Friendly'];

/** What branch does a family live in, according to our pools? Returns null
 *  for expressive / unknown families (we don't override those). */
function familyBranch(family: string): 'serif' | 'sans' | null {
  for (const key of SERIF_POOL_KEYS) {
    if (CATEGORY_FAMILY_POOLS[key]?.includes(family)) return 'serif';
  }
  for (const key of SANS_POOL_KEYS) {
    if (CATEGORY_FAMILY_POOLS[key]?.includes(family)) return 'sans';
  }
  return null;
}

/** Resolve the displayed branch + style for a suggestion, letting the
 *  pixel-detected signals override CLIP when they disagree. The pixel
 *  detector speaks to two things CLIP misses at 224×224:
 *    - serif feet (binary serif vs sans on visible terminal extensions)
 *    - script-ness (substantial text with very few clean vertical stems)
 *  Returns the corrected branch + style and a flag the caller can use to
 *  mark the description as pixel-corrected in the UI. */
function effectiveBranchAndStyle(
  clipBranch: string,
  clipStyle: string,
  region: ExtractedTextRegion | undefined,
): { branch: string; style: string; pixelOverride: boolean } {
  if (!region) {
    return { branch: clipBranch, style: clipStyle, pixelOverride: false };
  }
  // Script signal first — sparse stems mean cursive. Pixel can't tell
  // formal calligraphy from casual cursive on its own; if CLIP landed
  // on either Formal Script or Handwritten Script, trust CLIP's pick;
  // otherwise default to Formal Script as the safe call (Dancing
  // Script is a closer visual match for most ambiguous cases than
  // Sacramento is).
  if (region.stroke.isLikelyScript) {
    if (clipBranch === 'Expressive' && clipStyle.includes('Script')) {
      return { branch: clipBranch, style: clipStyle, pixelOverride: false };
    }
    return {
      branch: 'Expressive',
      style: 'Formal Script',
      pixelOverride: true,
    };
  }
  // Hand-drawn / brush signal — CLIP routinely reads brush headlines like
  // LEMON BIRD / DREAM / Squeeze as "Display / Decorative", which pulls
  // block display fonts. The right pool depends on case: all-caps brush
  // ≈ printed display ("Handwritten / Informal"), mixed-case brush ≈
  // casual cursive ("Handwritten Script"). Pre-empt CLIP unless CLIP
  // already landed somewhere in the hand family.
  if (region.stroke.isLikelyHand) {
    const clipAlreadyHand = clipBranch === 'Expressive'
      && (clipStyle.includes('Hand') || clipStyle.includes('Informal'));
    if (clipAlreadyHand) {
      return { branch: clipBranch, style: clipStyle, pixelOverride: false };
    }
    return {
      branch: 'Expressive',
      style: region.isAllCaps ? 'Handwritten / Informal' : 'Handwritten Script',
      pixelOverride: true,
    };
  }
  if (region.stroke.strokeCount < 2) {
    return { branch: clipBranch, style: clipStyle, pixelOverride: false };
  }
  const pixelSerif = region.stroke.hasSerifFeet;
  const clipSerif = clipBranch === 'Serif';
  if (pixelSerif === clipSerif) {
    return { branch: clipBranch, style: clipStyle, pixelOverride: false };
  }
  // Pixel says serif → override to Serif regardless of what CLIP said,
  // WITH ONE EXCEPTION: when CLIP confidently classified as Expressive ·
  // Script/Handwritten, trust CLIP. Script glyphs have flowing connecting
  // terminals that look like horizontal serif extensions to the per-stem
  // scan — that's a known false-positive case. CLIP at 224×224 reads
  // script as script reliably; only its serif-vs-sans signal struggles.
  // For Expressive · Display / Decorative we still override (that's the
  // "Mood in Cormorant" case where CLIP misread a thin serif as
  // expressive_display).
  if (pixelSerif) {
    if (clipBranch === 'Expressive' && (clipStyle.includes('Script') || clipStyle.includes('Hand'))) {
      return { branch: clipBranch, style: clipStyle, pixelOverride: false };
    }
    return {
      branch: 'Serif',
      style: 'pixel-detected serifs',
      pixelOverride: true,
    };
  }
  // Pixel says sans. Only override CLIP's Serif (we trust the pixel scan
  // on absence of feet for what CLIP labeled as serif). Don't override
  // Expressive → Sans — pixel "no serifs" alone isn't enough evidence
  // that the font isn't novelty/decorative.
  if (clipBranch === 'Serif') {
    return {
      branch: 'Sans serif',
      style: 'pixel-detected flat terminals',
      pixelOverride: true,
    };
  }
  return { branch: clipBranch, style: clipStyle, pixelOverride: false };
}

/** When the pixel detector contradicts CLIP's branch, swap the suggested
 *  family for a default from the correct branch's pool. Picks the first
 *  family of `Serif / Workhorse` (Libre Baskerville) for a serif override
 *  or `Sans / Clean` (Inter) for a sans override — safe middle-of-the-road
 *  choices the user can refine via the Customize modal. Leaves the family
 *  alone when the user has explicitly picked a preset category. */
function clampFamilyToPixelBranch(
  detectedFamily: string,
  region: ExtractedTextRegion | undefined,
  userPickedCategory: string | null,
  clipBranch?: string,
  clipStyle?: string,
): string {
  if (userPickedCategory) return detectedFamily;
  if (!region) return detectedFamily;
  // Script signal fires for flowing-cursive crops with sparse stems
  // (Jui, Squee in cursive scripts). Routes to Formal Script (Dancing
  // Script et al.) — engraved calligraphy is the calibration point for
  // "looks like script."
  if (region.stroke.isLikelyScript) {
    return CATEGORY_FAMILY_POOLS['Expressive / Formal Script'][0];
  }
  // Hand-drawn signal — split by case. All-caps brush headlines (DREAM,
  // LEMON BIRD, TYPEFACE) read as printed hand, so route to the Hand
  // pool (Caveat / Permanent Marker / Shadows Into Light). Mixed-case
  // brush text (hare, casual script-like chalk) reads as handwritten
  // cursive, so route to Handwritten Script (Sacramento / Yellowtail /
  // Kaushan). Cursive ↔ printed isn't directly detectable from pixels
  // alone, but isAllCaps is a strong proxy: brush all-caps is almost
  // always printed display, brush mixed-case skews cursive.
  if (region.stroke.isLikelyHand) {
    return region.isAllCaps
      ? CATEGORY_FAMILY_POOLS['Expressive / Hand'][0]
      : CATEGORY_FAMILY_POOLS['Expressive / Handwritten Script'][0];
  }
  // Same script-trust guard as effectiveBranchAndStyle: when CLIP said
  // Expressive · Script/Handwritten, don't let the pixel serif-feet
  // detector pull us into the serif pool — script terminals are a known
  // false positive.
  if (
    clipBranch === 'Expressive'
    && clipStyle
    && (clipStyle.includes('Script') || clipStyle.includes('Hand'))
  ) {
    return detectedFamily;
  }
  if (region.stroke.strokeCount < 2) return detectedFamily;
  const pixelSerif = region.stroke.hasSerifFeet;
  const currentBranch = familyBranch(detectedFamily);
  // Pixel says serif — strong unambiguous signal. Override REGARDLESS of
  // where the server-picked family lives (including expressive). This
  // catches the case where CLIP picked an expressive font (Abril Fatface,
  // Lobster, etc.) for a crop that pixel-scans as a clean serif (Mood in
  // Cormorant). Previously the clamp early-exited on currentBranch=null
  // and the rendered family stayed the original expressive pick.
  if (pixelSerif) {
    if (currentBranch === 'serif') return detectedFamily;
    return CATEGORY_FAMILY_POOLS['Serif / Workhorse'][0];
  }
  // Pixel says sans (no feet). Only override CLIP's Serif — expressive
  // families with no feet (Bangers, Righteous, etc.) could still be
  // legitimate display picks; pixel "no feet" alone isn't strong enough
  // evidence to dethrone them.
  if (currentBranch === 'serif') {
    return CATEGORY_FAMILY_POOLS['Sans / Clean'][0];
  }
  return detectedFamily;
}

/** Same idea as `clampFamilyToPixelBranch`, but returns the POOL CATEGORY
 *  so the trio cards can cycle through every family in the pixel-corrected
 *  branch instead of locking on one default. Returns null when no override
 *  is needed (user already picked a category, no region, or pixel agrees
 *  with whatever the server picked). */
function pixelOverrideCategory(
  userPickedCategory: string | null,
  region: ExtractedTextRegion | undefined,
  clipBranch: string,
  clipStyle?: string,
): string | null {
  if (userPickedCategory) return null;
  if (!region) return null;
  // Script signal — trio cycles through Formal Script (calligraphy).
  if (region.stroke.isLikelyScript) {
    return 'Expressive / Formal Script';
  }
  // Hand-drawn — split by case (see clampFamilyToPixelBranch for the
  // same all-caps vs mixed-case proxy).
  if (region.stroke.isLikelyHand) {
    return region.isAllCaps
      ? 'Expressive / Hand'
      : 'Expressive / Handwritten Script';
  }
  // Trust CLIP when it confidently classified as Expressive ·
  // Script/Handwritten — script flourishes false-positive the per-stem
  // serif-foot detector and would otherwise pull us into Serif / Workhorse.
  if (
    clipBranch === 'Expressive'
    && clipStyle
    && (clipStyle.includes('Script') || clipStyle.includes('Hand'))
  ) {
    return null;
  }
  if (region.stroke.strokeCount < 2) return null;
  const pixelSerif = region.stroke.hasSerifFeet;
  if (pixelSerif && clipBranch !== 'Serif') {
    return 'Serif / Workhorse';
  }
  if (!pixelSerif && clipBranch === 'Serif') {
    return 'Sans / Clean';
  }
  return null;
}

/** Translate the server's per-crop modifier classification + the client's
 *  pixel-spacing heuristic into actual CSS values for a suggestion card.
 *  When the moodboard's primary text is all-caps, the spacing gets bumped
 *  because uppercase typography is almost always tracked open. */
function cssForDetectedSpec(opts: {
  weight: 'thin' | 'regular' | 'heavy';
  spacing: 'tight' | 'normal' | 'wide';
  allCaps: boolean;
}) {
  const weight = opts.weight === 'thin' ? '300' : opts.weight === 'heavy' ? '700' : '400';
  let letterSpacing;
  if (opts.allCaps && opts.spacing === 'wide') letterSpacing = '0.22em';
  else if (opts.allCaps && opts.spacing === 'normal') letterSpacing = '0.15em';
  else if (opts.spacing === 'tight') letterSpacing = '-0.01em';
  else if (opts.spacing === 'wide') letterSpacing = '0.10em';
  else letterSpacing = '0em';
  return { weight, letterSpacing };
}

const UPLOAD_PHRASES = [
  'Squinting at the moodboard',
  'Measuring letters',
  'Eyeballing the biggest text',
  'Cropping like a pro',
  'Tracing glyph edges',
];

const ANALYZE_PHRASES = [
  'Pontificating',
  'Lallygagging',
  'Ruminating on serifs',
  'Noodling on the vibe',
  'Cogitating',
  'Marinating in embeddings',
  'Conferring with CLIP',
  'Wrangling fonts',
  'Mulling letterforms',
  'Finagling a trio',
  'Percolating',
  'Consulting the font spirits',
];

function useLoadingPhrase(status: Status): string | null {
  const [idx, setIdx] = useState(0);
  const active = status === 'uploading' || status === 'analyzing';

  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const t = setInterval(() => setIdx((n) => n + 1), 1800);
    return () => clearInterval(t);
  }, [active, status]);

  if (!active) return null;
  const pool = status === 'uploading' ? UPLOAD_PHRASES : ANALYZE_PHRASES;
  return pool[idx % pool.length];
}

/** Inject one combined Google Fonts <link> for every font in the result so
 *  arbitrary previews can render in their actual face. */
function useGoogleFonts(families: string[]) {
  useEffect(() => {
    if (families.length === 0) return;

    const param = families
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;600;700;800`)
      .join('&');

    const id = 'typo-test-fonts';
    document.getElementById(id)?.remove();
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${param}&display=swap`;
    document.head.appendChild(link);
  }, [families.join('|')]);
}

export interface TypographyTestPageProps {
  /** When provided, the page skips the file picker and runs analyzeMoodboard
   *  on this URL on mount. Used when the upload happened in a prior stage
   *  (the moodboard is already in storage). */
  preloadedMoodboardUrl?: string | null;
  /** When true, the "Pick a moodboard" button and upload affordance are
   *  hidden — typically paired with preloadedMoodboardUrl. */
  hideUploadUI?: boolean;
  /** Current decorative-mode toggle from the upstream selection state.
   *  When present, a "Decorative Mode" toggle appears in the trios column. */
  decorativeMode?: 'surface-components' | 'only-selected';
  onDecorativeModeChange?: (mode: 'surface-components' | 'only-selected') => void;
  /** Fired when the user clicks Next. Receives a TypographyStyle[] derived
   *  from the SuggestedCards' current picks (auto + Customize overrides). */
  onTypographyComplete?: (styles: TypographyStyleOutput[]) => void;
  /** Previously-saved selections. When the user returns to this stage from
   *  a later step, we seed the per-role override state from these so their
   *  family / weight / spacing / case customizations don't reset. Pass an
   *  empty array (or omit) on first visit; we fall back to the matcher's
   *  defaults. */
  initialTypography?: TypographyStyleOutput[];
  /** UI state to restore on re-entry — trio selection, body family mode,
   *  customize-modal category picks. Paired with initialTypography. */
  initialMeta?: TypographyMeta;
  /** Fired whenever the meta state changes so the parent can persist it
   *  alongside typographyStyles. */
  onMetaChange?: (meta: TypographyMeta) => void;
  /** Previously-uploaded custom fonts per role. On mount, the matcher
   *  fetches each file from Firebase Storage and re-registers it via
   *  FontFace so the persisted family name resolves. */
  initialUploads?: TypographyUploads;
  /** Fired whenever the upload set changes so the parent can persist it. */
  onUploadsChange?: (uploads: TypographyUploads) => void;
  onNext?: () => void;
  onBack?: () => void;
}

/** Subset of the app-wide TypographyStyle we emit on Next. Kept local so the
 *  test page can be opened without importing the app's types. */
export interface TypographyStyleOutput {
  type: 'header' | 'decorative' | 'body';
  family: string;
  weight: string;
  letterSpacing: string;
  allCaps: boolean;
}

/** One persisted custom font upload. The `family` is the synthetic name the
 *  matcher registered via FontFace; storagePath is the file's location in
 *  Firebase Storage so the matcher can re-fetch and re-register it on a
 *  fresh page load. fileName is kept for display. */
export interface TypographyUpload {
  family: string;
  fileName: string;
  storagePath: string;
}

/** Per-role custom font uploads. Persisted alongside TypographyStyleOutput[]
 *  so the user's custom fonts survive a stage re-entry, page reload, or
 *  Stripe redirect. */
export interface TypographyUploads {
  header?: TypographyUpload;
  decorative?: TypographyUpload;
  body?: TypographyUpload;
}

/** UI state the matcher needs to restore on stage re-entry but that doesn't
 *  fit per-role (it's either shared or it's metadata about a user-driven
 *  choice rather than typographic data). Persisted alongside the per-role
 *  TypographyStyleOutput[] so customizations survive a round-trip through
 *  later stages or a Stripe redirect. */
export interface TypographyMeta {
  /** Selected trio card index (position in the sorted trio list). */
  trioIndex: number;
  /** Body family-mode toggle (sans vs serif). */
  bodyFamily: 'sans' | 'serif';
  /** Whether the user has explicitly touched the body family toggle. When
   *  false the Body SuggestedCard reads "Style: Suggested"; when true it
   *  reads "Style: Customized". */
  bodyFamilyTouched: boolean;
  /** The category the user picked from the customize modal for the Header
   *  role (e.g. "Sans / Geometric"). Drives the trio cycling + the
   *  Suggested / Customized label state. Null when no preset was picked. */
  headerPresetCategory: string | null;
  decorativePresetCategory: string | null;
}

export default function TypographyTestPage({
  preloadedMoodboardUrl,
  hideUploadUI,
  decorativeMode,
  onDecorativeModeChange,
  onTypographyComplete,
  initialTypography,
  initialMeta,
  onMetaChange,
  initialUploads,
  onUploadsChange,
  onNext,
  onBack,
}: TypographyTestPageProps = {}) {
  // Index initialTypography by type so we can pluck the saved value for each
  // role at initialization time. Read once on first render — subsequent
  // re-renders shouldn't snap user edits back to the saved values.
  const initialByType = (() => {
    const m: Partial<Record<'header' | 'decorative' | 'body', TypographyStyleOutput>> = {};
    for (const s of initialTypography ?? []) m[s.type] = s;
    return m;
  })();
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(preloadedMoodboardUrl ?? null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MoodboardAnalysis | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Selection state. Trio sets the baseline; per-role overrides win.
  // Initial values come from initialTypography (saved on a prior visit)
  // when present, otherwise null so the matcher's auto pick is used.
  const [trioIdx, setTrioIdx] = useState(initialMeta?.trioIndex ?? 0);
  const [headerOverride, setHeaderOverride] = useState<string | null>(initialByType.header?.family ?? null);
  const [decorativeOverride, setDecorativeOverride] = useState<string | null>(initialByType.decorative?.family ?? null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(initialByType.body?.family ?? null);
  // When a category preset is picked (e.g. "Sans / Geometric"), the trio
  // cards cycle through that category's font pool so each trio shows a
  // different family. Suggestion / upload picks leave these null so the
  // trios stay on the server's per-trio ranked families.
  const [headerPresetCategory, setHeaderPresetCategory] = useState<string | null>(initialMeta?.headerPresetCategory ?? null);
  const [decorativePresetCategory, setDecorativePresetCategory] = useState<string | null>(initialMeta?.decorativePresetCategory ?? null);
  const [bodyFamily, setBodyFamily] = useState<BodyFamily>(initialMeta?.bodyFamily ?? 'sans');
  // Weight + letter-spacing overrides — populated when the user picks a
  // style preset so the visual matches the preset's vibe (Display = heavy
  // extended, Script = regular, etc.). Null means use the server specs.
  // On stage re-entry, seed from initialTypography so prior fine-tuning
  // (per-role weight slider, letter-spacing slider, All-caps toggle) sticks.
  const headerCaseFromSaved: TextCase | null = initialByType.header
    ? (initialByType.header.allCaps ? 'uppercase' : 'normal') : null;
  const decoCaseFromSaved: TextCase | null = initialByType.decorative
    ? (initialByType.decorative.allCaps ? 'uppercase' : 'normal') : null;
  const [headerWeightOverride, setHeaderWeightOverride] = useState<string | null>(initialByType.header?.weight ?? null);
  const [headerSpacingOverride, setHeaderSpacingOverride] = useState<string | null>(initialByType.header?.letterSpacing ?? null);
  const [headerCaseOverride, setHeaderCaseOverride] = useState<TextCase | null>(headerCaseFromSaved);
  const [decorativeWeightOverride, setDecorativeWeightOverride] = useState<string | null>(initialByType.decorative?.weight ?? null);
  const [decorativeSpacingOverride, setDecorativeSpacingOverride] = useState<string | null>(initialByType.decorative?.letterSpacing ?? null);
  const [decorativeCaseOverride, setDecorativeCaseOverride] = useState<TextCase | null>(decoCaseFromSaved);
  // Uploaded custom fonts per role. Each entry holds the synthetic family
  // name we registered via FontFace + the original file name for display +
  // the Firebase Storage path so the file can be re-fetched on rehydrate.
  const [headerUpload, setHeaderUpload] = useState<TypographyUpload | null>(initialUploads?.header ?? null);
  const [decorativeUpload, setDecorativeUpload] = useState<TypographyUpload | null>(initialUploads?.decorative ?? null);
  const [bodyUpload, setBodyUpload] = useState<TypographyUpload | null>(initialUploads?.body ?? null);
  // The image URL on Firebase Storage. Set after upload; consumed by the
  // analyzeMoodboard call.
  const [imageUrl, setImageUrl] = useState<string | null>(preloadedMoodboardUrl ?? null);
  // Roles the user has marked "Not text" on the current run. Used to hide
  // the corresponding CropDetail and to skip re-logging on toggle.
  const [notTextMarked, setNotTextMarked] = useState<Set<string>>(new Set());

  // Customize modal state — null when closed, otherwise the role whose
  // gallery should render. Filters persist across opens so a user who
  // unchecked Script doesn't see it come back the next time they customize.
  const [customizeRole, setCustomizeRole] = useState<'header' | 'decorative' | null>(null);
  const [branchFilter, setBranchFilter] = useState<BranchFilter>(DEFAULT_BRANCH_FILTER);
  // Which trio card has its inline weight+spacing adjuster expanded. The
  // adjuster writes back to the role-level overrides (header / decorative /
  // body), so adjustments made under one trio card are reflected across
  // every preview — but only one card shows the controls at a time to keep
  // the panel scannable.
  const [adjusterOpenTrioIdx, setAdjusterOpenTrioIdx] = useState<number | null>(null);
  const [bodyWeightOverride, setBodyWeightOverride] = useState<string | null>(null);
  const [bodySpacingOverride, setBodySpacingOverride] = useState<string | null>(null);
  // Becomes true the first time the user clicks the sans/serif ButtonGroup,
  // so the Body SuggestedCard label flips from "Style: Suggested" to
  // "Style: Customized" — flipping the body family is an explicit user
  // choice, not the auto-pick.
  const [bodyFamilyTouched, setBodyFamilyTouched] = useState(initialMeta?.bodyFamilyTouched ?? false);

  // When the user comes back to this stage from a later step, we don't want
  // the first-result auto-seed to wipe the choices they made before. Track
  // whether we still need to honor initialTypography on the next result tick.
  // Resets to true if the moodboard URL changes (i.e. genuinely new analysis).
  const skipAutoSeedRef = useRef((initialTypography ?? []).length > 0);

  // When a fresh result lands, default-select the "From your moodboard text"
  // suggestion — that's the CLIP + OCR-driven pick and what most users will
  // want as their starting point. The user can switch to the mood-driven
  // suggestion or any preset, but they shouldn't have to make a click just
  // to apply what we already think is the best match.
  //
  // BUT: when the user is RETURNING to this stage with previously-saved
  // picks (initialTypography seeded our state above), we keep their values
  // and only seed the pieces that weren't saved — the auto-seed effect
  // would otherwise overwrite their fine-tuning with the matcher's defaults.
  useEffect(() => {
    if (!result) return;
    // Stage re-entry — leave all customize state alone. The state was already
    // seeded from initialTypography + initialMeta at construction; auto-
    // seeding from `result` would overwrite the user's prior selections.
    if (skipAutoSeedRef.current) {
      skipAutoSeedRef.current = false;
      return;
    }
    setTrioIdx(0);
    setBodyOverride(initialByType.body?.family ?? null);
    setHeaderPresetCategory(null);
    setDecorativePresetCategory(null);
    setBodyFamily('sans');
    setHeaderUpload(null);
    setDecorativeUpload(null);
    setBodyUpload(null);
    setBodyWeightOverride(null);
    setBodySpacingOverride(null);
    setBodyFamilyTouched(false);
    setAdjusterOpenTrioIdx(null);

    const clipTrio = result.trios.find((t) => t.type === 'same_style' || t.type === 'cross_pair');
    if (clipTrio) {
      const hMod = result.headerModifiers ?? result.modifiers;
      const hCrop = result.extractedText[0];
      const hCss = cssForDetectedSpec({
        weight: effectiveWeight(hMod.weight, hCrop),
        spacing: hCrop?.spacing ?? 'normal',
        allCaps: hCrop?.isAllCaps ?? false,
      });
      // Run the server-picked family through the same pixel-branch clamp
      // the SuggestedCard's description uses. Without this, the description
      // can flip to "Serif · pixel-corrected" while the rendered family
      // stays whatever CLIP picked from the expressive_display pool —
      // visible mismatch the user notices.
      setHeaderOverride(clampFamilyToPixelBranch(
        clipTrio.header,
        hCrop,
        null,
        result.headerBranch ?? result.branch,
        result.headerStyle ?? result.style,
      ));
      setHeaderWeightOverride(hCss.weight);
      setHeaderSpacingOverride(hCss.letterSpacing);
      setHeaderCaseOverride(hCrop?.isAllCaps ? 'uppercase' : 'normal');

      const dMod = result.decorativeModifiers ?? result.modifiers;
      const dCrop = result.extractedText[1];
      const dCss = cssForDetectedSpec({
        weight: effectiveWeight(dMod.weight, dCrop),
        spacing: dCrop?.spacing ?? 'normal',
        allCaps: dCrop?.isAllCaps ?? false,
      });
      setDecorativeOverride(clampFamilyToPixelBranch(
        clipTrio.decorative,
        dCrop,
        null,
        result.decorativeBranch ?? result.branch,
        result.decorativeStyle ?? result.style,
      ));
      setDecorativeWeightOverride(dCss.weight);
      setDecorativeSpacingOverride(dCss.letterSpacing);
      setDecorativeCaseOverride(dCrop?.isAllCaps ? 'uppercase' : 'normal');
    } else {
      setHeaderOverride(null);
      setDecorativeOverride(null);
      setHeaderWeightOverride(null);
      setHeaderSpacingOverride(null);
      setHeaderCaseOverride(null);
      setDecorativeWeightOverride(null);
      setDecorativeSpacingOverride(null);
      setDecorativeCaseOverride(null);
    }
  }, [result]);

  // The trio array shown in TriosTab is sorted (same_style / cross_pair
  // first, then mood_preset / mood_alt). The selectedIdx (trioIdx) reflects
  // a position in that SORTED list, so the parent must compute the same
  // sort here — otherwise `result.trios[trioIdx]` references the original
  // server order and we get a different trio than the one the user
  // clicked.
  const sortedTrios = useMemo(() => {
    if (!result) return [];
    return [...result.trios].sort((a, b) => {
      const rank = (t: typeof a) =>
        (t.type === 'same_style' || t.type === 'cross_pair') ? 0 : 1;
      return rank(a) - rank(b);
    });
  }, [result]);
  const trio = sortedTrios[trioIdx];
  // Resolve the current pick's family the SAME way the trio cards do — through
  // familyForTrioRole with the pixel-corrected category — so "Your current
  // pick: #N" matches the selected trio card AND the exported font. Without
  // this, the top card showed the raw server family (e.g. a Sacramento script)
  // while the trio showed the pixel-corrected family (e.g. IBM Plex Sans),
  // because only the trios applied the Sans/Serif correction.
  const headerCategoryEffective = headerPresetCategory ?? (result
    ? pixelOverrideCategory(headerPresetCategory, result.extractedText[0], result.headerBranch ?? result.branch, result.headerStyle ?? result.style)
    : null);
  const decorativeCategoryEffective = decorativePresetCategory ?? (result
    ? pixelOverrideCategory(decorativePresetCategory, result.extractedText[1], result.decorativeBranch ?? result.branch, result.decorativeStyle ?? result.style)
    : null);
  const currentHeader = familyForTrioRole(trioIdx, headerCategoryEffective, headerOverride, trio?.header ?? '');
  const currentDecorative = familyForTrioRole(trioIdx, decorativeCategoryEffective, decorativeOverride, trio?.decorative ?? '');

  // Swap the Header and Decorative styles. Materializes each side's currently-
  // resolved family as an explicit override (so the swap sticks even when a
  // side is on its auto pick) and resets the trio to slot 0 so those overrides
  // display. Category, weight, spacing, case, and upload swap with the family.
  const swapHeaderDecorative = () => {
    const hFam = currentHeader, dFam = currentDecorative;
    setHeaderOverride(dFam || null);
    setDecorativeOverride(hFam || null);
    setHeaderPresetCategory(decorativePresetCategory);
    setDecorativePresetCategory(headerPresetCategory);
    setHeaderWeightOverride(decorativeWeightOverride);
    setDecorativeWeightOverride(headerWeightOverride);
    setHeaderSpacingOverride(decorativeSpacingOverride);
    setDecorativeSpacingOverride(headerSpacingOverride);
    setHeaderCaseOverride(decorativeCaseOverride);
    setDecorativeCaseOverride(headerCaseOverride);
    setHeaderUpload(decorativeUpload);
    setDecorativeUpload(headerUpload);
    setTrioIdx(0);
  };
  const currentBody = bodyOverride ?? (bodyFamily === 'serif' ? BODY_SERIF_DEFAULT : (trio?.body ?? BODY_SANS_DEFAULT));

  // Effective spec values — preset overrides win; otherwise fall back to the
  // server-detected weight + letter-spacing for the role.
  const currentHeaderWeight = headerWeightOverride ?? result?.specs.header.weight ?? '700';
  const currentHeaderSpacing = headerSpacingOverride ?? result?.specs.header.letter_spacing ?? '0em';
  const currentHeaderCase: TextCase = headerCaseOverride ?? 'normal';
  const currentDecorativeWeight = decorativeWeightOverride ?? result?.specs.decorative.weight ?? '400';
  const currentDecorativeSpacing = decorativeSpacingOverride ?? result?.specs.decorative.letter_spacing ?? '0em';
  const currentDecorativeCase: TextCase = decorativeCaseOverride ?? 'normal';

  // Suggestions: one CLIP-matched (from extracted text) + one mood-matched.
  // Tapping a suggestion applies its font / weight / spacing as a role override.
  // If the moodboard's largest text crop was all-caps, we propagate that
  // styling so the suggestion preview matches what's literally on the board.
  const headerCrop = result?.extractedText[0];
  const decorativeCrop = result?.extractedText[1];

  // Short category label matching the modal preset format
  // ("Expressive / Display") instead of the CATEGORY_LABELS long form
  // ("Expressive · Display / Decorative"). Splits "Display / Decorative" on
  // " / " and keeps the first segment so the Suggested Card description
  // reads the same as the modal's preset rows.
  const shortCategoryLabel = (branch: string, style: string): string => {
    const shortStyle = style.split(' / ')[0];
    return `${branch} / ${shortStyle}`;
  };

  const headerSuggestions: FontSuggestion[] = useMemo(() => {
    if (!result) return [];
    const out: FontSuggestion[] = [];
    const clipTrio = result.trios.find((t) => t.type === 'same_style' || t.type === 'cross_pair');
    if (clipTrio) {
      const mod = result.headerModifiers ?? result.modifiers;
      const spacing = headerCrop?.spacing ?? 'normal';
      const allCaps = headerCrop?.isAllCaps ?? false;
      const weight = effectiveWeight(mod.weight, headerCrop);
      const clipBranch = result.headerBranch ?? result.branch;
      const clipStyle = result.headerStyle ?? result.style;
      const { branch, style, pixelOverride } = effectiveBranchAndStyle(clipBranch, clipStyle, headerCrop);
      const conf = result.headerCategoryConfidence;
      const css = cssForDetectedSpec({ weight, spacing, allCaps });
      // First clamp to pixel branch (when CLIP's branch is wrong), then to
      // user preset category (which always wins). Description shows the
      // user's category when picked, otherwise the effective branch.
      const familyAfterPixel = clampFamilyToPixelBranch(
        clipTrio.header, headerCrop, headerPresetCategory, clipBranch, clipStyle,
      );
      const family = clampFamilyToCategory(familyAfterPixel, headerPresetCategory, headerOverride);
      // categoryStr matches the modal's preset format: "Expressive / Display"
      // (or whatever the user explicitly picked). When auto-detected we
      // shorten the long CATEGORY_LABELS style ("Display / Decorative" →
      // "Display") so the SuggestedCard label reads the same as the modal.
      const categoryStr = headerPresetCategory ?? shortCategoryLabel(branch, style);
      // No internal-process annotation — "clamped to your pick" / "pixel-
      // corrected" leak the matcher's decision-making into the UI, which the
      // user neither needs nor wants. The visible category + weight is the
      // verdict.
      out.push({
        label: 'From your moodboard text',
        description: `${categoryStr} · ${weight}, ${mod.width}`,
        family,
        weight: css.weight,
        letterSpacing: css.letterSpacing,
        textTransform: allCaps ? 'uppercase' : undefined,
      });
    }
    // Mood-driven suggestion ONLY surfaces as a fallback — when we couldn't
    // detect any header text on the moodboard. The text-derived suggestion
    // is always more precise when we have it, and showing both confuses
    // users into thinking we're indecisive. headerCrop is the moodboard's
    // tallest detected text region; null when OCR found nothing or the
    // text gate rejected every candidate.
    if (!headerCrop) {
      const moodTrio = result.trios.find((t) => t.type === 'mood_preset' || t.type === 'mood_alt');
      if (moodTrio && moodTrio.mood) {
        const family = clampFamilyToCategory(moodTrio.header, headerPresetCategory, headerOverride);
        const wasClamped = family !== moodTrio.header;
        out.push({
          label: `From mood: ${moodTrio.mood.label}`,
          description: wasClamped
            ? 'Color-driven preset · clamped to your category pick'
            : 'Color-driven preset (brightness, saturation, hue)',
          family,
          weight: result.specs.header.weight,
          letterSpacing: result.specs.header.letter_spacing,
        });
      }
    }
    return out;
  }, [result, headerCrop, headerPresetCategory, headerOverride]);

  const decorativeSuggestions: FontSuggestion[] = useMemo(() => {
    if (!result) return [];
    const out: FontSuggestion[] = [];
    const clipTrio = result.trios.find((t) => t.type === 'same_style' || t.type === 'cross_pair');
    if (clipTrio) {
      const mod = result.decorativeModifiers ?? result.modifiers;
      const spacing = decorativeCrop?.spacing ?? 'normal';
      const allCaps = decorativeCrop?.isAllCaps ?? false;
      const weight = effectiveWeight(mod.weight, decorativeCrop);
      const clipBranch = result.decorativeBranch ?? result.branch;
      const clipStyle = result.decorativeStyle ?? result.style;
      const { branch, style, pixelOverride } = effectiveBranchAndStyle(clipBranch, clipStyle, decorativeCrop);
      const conf = result.decorativeCategoryConfidence;
      const css = cssForDetectedSpec({ weight, spacing, allCaps });
      const familyAfterPixel = clampFamilyToPixelBranch(
        clipTrio.decorative, decorativeCrop, decorativePresetCategory, clipBranch, clipStyle,
      );
      const family = clampFamilyToCategory(familyAfterPixel, decorativePresetCategory, decorativeOverride);
      // See header branch for rationale — categoryStr / description match
      // the modal's preset row format.
      const categoryStr = decorativePresetCategory ?? shortCategoryLabel(branch, style);
      // No process annotations — see header branch.
      out.push({
        label: 'From your moodboard text',
        description: `${categoryStr} · ${weight}, ${mod.width}`,
        family,
        weight: css.weight,
        letterSpacing: css.letterSpacing,
        textTransform: allCaps ? 'uppercase' : undefined,
      });
    }
    // Mood-driven decorative — fallback path, two cases:
    //   1. No header crop at all (truly no text on moodboard).
    //   2. Header crop but no decorative crop (only ONE text region found).
    //      Designers expect a decorative pairing even with a single source —
    //      synthesize one from the mood preset's decorative recommendation,
    //      then clamp it to contrast with the header (different category
    //      pool — handled by clampFamilyToCategory + the trio's cross_pair
    //      entry which already pairs against the header's category).
    // When BOTH crops exist, the text-derived suggestion already covers it
    // and adding a mood card here just makes the user pick between two
    // visually similar options. Drop it.
    if (!decorativeCrop) {
      const moodTrio = result.trios.find((t) => t.type === 'mood_preset' || t.type === 'mood_alt');
      if (moodTrio && moodTrio.mood) {
        const family = clampFamilyToCategory(moodTrio.decorative, decorativePresetCategory, decorativeOverride);
        const wasClamped = family !== moodTrio.decorative;
        // Label nods to what the synthesis is based on — "From mood" when
        // there's no text at all; "Paired with header" when we have a
        // header but no decorative source.
        const label = headerCrop
          ? `Paired with header · ${moodTrio.mood.label}`
          : `From mood: ${moodTrio.mood.label}`;
        const description = headerCrop
          ? 'Synthesized to contrast with your header'
          : (wasClamped
              ? 'Color-driven preset · clamped to your category pick'
              : 'Color-driven preset (brightness, saturation, hue)');
        out.push({
          label,
          description,
          family,
          weight: result.specs.decorative.weight,
          letterSpacing: result.specs.decorative.letter_spacing,
        });
      }
    }
    return out;
  }, [result, headerCrop, decorativeCrop, decorativePresetCategory, decorativeOverride]);

  // Every font the page might render — kept as one list so the Google Fonts
  // <link> rebuilds once per result rather than per tab click.
  const allFamilies = useMemo(() => {
    const set = new Set<string>();
    if (result) {
      result.trios.forEach((t) => {
        set.add(t.header); set.add(t.decorative); set.add(t.body);
      });
    }
    HEADER_STYLE_PRESETS.forEach((p) => set.add(p.family));
    DECORATIVE_STYLE_PRESETS.forEach((p) => set.add(p.family));
    // Pool families across every category — the trio cards may cycle through
    // these the moment a preset is picked, so they need to be in the
    // Google Fonts <link> already.
    Object.values(CATEGORY_FAMILY_POOLS).forEach((pool) =>
      pool.forEach((f) => set.add(f)),
    );
    set.add(BODY_SANS_DEFAULT);
    set.add(BODY_SERIF_DEFAULT);
    return Array.from(set);
  }, [result]);

  useGoogleFonts(allFamilies);
  const loadingPhrase = useLoadingPhrase(status);

  const FONTS_FOLDER = 'typography-v2-fonts';

  const handleFontUpload = useCallback(async (file: File, role: 'header' | 'decorative' | 'body') => {
    try {
      const family = `custom-${role}-${Date.now()}`;
      const buffer = await file.arrayBuffer();
      const face = new FontFace(family, buffer);
      await face.load();
      document.fonts.add(face);
      // Upload the file bytes to Firebase Storage so the font survives a
      // stage re-entry / page reload / Stripe redirect. Fire-and-forget for
      // the UI side — the in-memory FontFace is already registered, so the
      // current session keeps working even if the upload is in flight. On
      // rehydrate we'll fetch this back and re-register under the same
      // synthetic family name. Filename includes the role and timestamp so
      // collisions are impossible across users / sessions.
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const storagePath = `${family}.${ext}`;
      uploadDesignSystemFile(FONTS_FOLDER, storagePath, file, file.type)
        .catch((e) => console.warn(`font storage upload failed for ${role}:`, e));
      const upload: TypographyUpload = { family, fileName: file.name, storagePath };
      if (role === 'header') {
        setHeaderUpload(upload);
        setHeaderOverride(family);
        setHeaderWeightOverride(null);
        setHeaderSpacingOverride(null);
        setHeaderPresetCategory(null);
      } else if (role === 'decorative') {
        setDecorativeUpload(upload);
        setDecorativeOverride(family);
        setDecorativeWeightOverride(null);
        setDecorativeSpacingOverride(null);
        setDecorativePresetCategory(null);
      } else {
        setBodyUpload(upload);
        setBodyOverride(family);
      }
    } catch (e) {
      console.error(`font upload failed for ${role}:`, e);
      alert(`Couldn't load that font file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Re-register custom font FontFaces from initialUploads on mount. The
  // persisted family name (e.g. "custom-header-1780868130246") is also the
  // current headerOverride / decorativeOverride / bodyOverride seeded from
  // initialTypography — so as soon as document.fonts has that family,
  // every text element using it re-renders. Browsers auto-reflow when
  // document.fonts changes, so we don't need to force anything. Each
  // FontFace.load() is async; render shows a brief fallback flash while
  // bytes download (typically <300 ms on warm Firebase Storage).
  useEffect(() => {
    if (!initialUploads) return;
    const roles: Array<keyof TypographyUploads> = ['header', 'decorative', 'body'];
    for (const role of roles) {
      const entry = initialUploads[role];
      if (!entry) continue;
      // Skip if already registered (HMR / repeat mounts).
      if (Array.from(document.fonts).some((f) => f.family === entry.family)) continue;
      (async () => {
        try {
          const url = getPublicFileUrl(FONTS_FOLDER, entry.storagePath);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
          const buffer = await res.arrayBuffer();
          const face = new FontFace(entry.family, buffer);
          await face.load();
          document.fonts.add(face);
        } catch (e) {
          console.warn(`failed to re-register custom font for ${role}:`, e);
        }
      })();
    }
    // Run once on mount per initialUploads ref. We don't depend on individual
    // role entries because we want the registration to happen as soon as the
    // matcher loads, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickPreset = useCallback((role: 'header' | 'decorative', preset: StylePreset) => {
    if (role === 'header') {
      setHeaderOverride(preset.family);
      setHeaderWeightOverride(preset.weight);
      setHeaderSpacingOverride(preset.letterSpacing);
      setHeaderCaseOverride(preset.textTransform ?? 'normal');
      setHeaderPresetCategory(preset.category);
    } else {
      setDecorativeOverride(preset.family);
      setDecorativeWeightOverride(preset.weight);
      setDecorativeSpacingOverride(preset.letterSpacing);
      setDecorativeCaseOverride(preset.textTransform ?? 'normal');
      setDecorativePresetCategory(preset.category);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!user) {
      setError('Sign in first — uploads require an authenticated session.');
      setStatus('error');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setError(null);
    setResult(null);
    setStatus('uploading');

    // Fire the warmup the moment the file lands. The CLIP model takes
    // 20-40s to cold-start in the cloud function, and the upload itself
    // takes a few seconds — running them in parallel means the model is
    // already loaded by the time we issue the real analyze call below.
    warmAnalyzeMoodboard();

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filename = `${Date.now()}.${ext}`;
      await uploadDesignSystemFile(TEST_FOLDER, filename, file, file.type);
      const url = getPublicFileUrl(TEST_FOLDER, filename);
      setImageUrl(url);

      setStatus('analyzing');
      const t0 = Date.now();
      const r = await analyzeMoodboard(url);
      setElapsedMs(Date.now() - t0);
      setResult(r);
      setStatus('done');
      // Auto-log every server-side gate rejection as a weak negative for the
      // future fine-tuned classifier (Step C). Fire-and-forget — Firestore
      // failures shouldn't surface in the matcher UI.
      logGateRejections(url, r.rejected ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  // Stage-mode entrypoint: when a preloaded URL is provided, skip the file
  // picker and fire the analyzeMoodboard call directly. Only runs once per
  // URL change; user can re-customize on the resulting UI like any other
  // moodboard.
  useEffect(() => {
    if (!preloadedMoodboardUrl) return;
    let cancelled = false;
    setError(null);
    setResult(null);
    setStatus('analyzing');
    warmAnalyzeMoodboard();
    const t0 = Date.now();
    // getOrStart returns the cached in-flight promise when UploadStage
    // started the analysis early — otherwise it begins one now. Either
    // way the user sees the loading state until the result lands.
    getOrStartMoodboardAnalysis(preloadedMoodboardUrl)
      .then((r) => {
        if (cancelled) return;
        setElapsedMs(Date.now() - t0);
        setResult(r);
        setStatus('done');
        logGateRejections(preloadedMoodboardUrl, r.rejected ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [preloadedMoodboardUrl]);

  // Stage mode: the create-flow wrapper provides its own page title / nav,
  // so the dev-page H1 and "Drop a moodboard" copy are suppressed.
  const inStageMode = !!onTypographyComplete;

  // Auto-sync the user's current picks back to the stage wrapper whenever
  // any of the role-driving state changes. The wrapper persists this into
  // App.tsx's typographyStyles, which downstream stages (component-style,
  // review, export) read. The shell's Continue button just calls onNext —
  // it doesn't know about our state shape — so the sync has to happen via
  // an effect, not on click.
  useEffect(() => {
    if (!onTypographyComplete) return;
    if (!result) return;
    if (!currentHeader && !currentDecorative && !currentBody) return;
    onTypographyComplete([
      {
        type: 'header',
        family: currentHeader,
        weight: currentHeaderWeight,
        letterSpacing: currentHeaderSpacing,
        allCaps: currentHeaderCase === 'uppercase',
      },
      {
        type: 'decorative',
        family: currentDecorative,
        weight: currentDecorativeWeight,
        letterSpacing: currentDecorativeSpacing,
        allCaps: currentDecorativeCase === 'uppercase',
      },
      {
        type: 'body',
        family: currentBody,
        weight: bodyWeightOverride ?? result.specs.body.regular.weight,
        letterSpacing: bodySpacingOverride ?? result.specs.body.regular.letter_spacing,
        allCaps: false,
      },
    ]);
  }, [
    onTypographyComplete, result,
    currentHeader, currentHeaderWeight, currentHeaderSpacing, currentHeaderCase,
    currentDecorative, currentDecorativeWeight, currentDecorativeSpacing, currentDecorativeCase,
    currentBody, bodyWeightOverride, bodySpacingOverride,
  ]);

  // Sync UI meta (trio index, body family mode, preset categories) back to
  // the parent so it persists alongside typographyStyles. Same effect-based
  // approach as onTypographyComplete — fires on every meta change.
  useEffect(() => {
    if (!onMetaChange) return;
    onMetaChange({
      trioIndex: trioIdx,
      bodyFamily,
      bodyFamilyTouched,
      headerPresetCategory,
      decorativePresetCategory,
    });
  }, [
    onMetaChange,
    trioIdx, bodyFamily, bodyFamilyTouched,
    headerPresetCategory, decorativePresetCategory,
  ]);

  // Mirror uploads back to the parent. Each role's record is null when no
  // upload exists; we omit the key entirely for null so the parent always
  // sees a consistent shape ({ header: {...} } not { header: null }).
  useEffect(() => {
    if (!onUploadsChange) return;
    const next: TypographyUploads = {};
    if (headerUpload) next.header = headerUpload;
    if (decorativeUpload) next.decorative = decorativeUpload;
    if (bodyUpload) next.body = bodyUpload;
    onUploadsChange(next);
  }, [onUploadsChange, headerUpload, decorativeUpload, bodyUpload]);

  return (
    // Dim the page one surface step below the accordions. The lib Accordion
    // paints data-surface="Surface"; without this the page (which inherits the
    // parent theme's Surface) is the SAME tone, so the accordion sections blend
    // into the background when a colored brand theme is active. Sitting the page
    // on Surface-Dim lets the Surface accordions and Container preview cards
    // both read as raised panels. data-surface re-resolves --Background within
    // the inherited data-theme, so this honors the brand cascade.
    <div data-surface="Surface-Dim" style={{ padding: '40px 24px', background: 'var(--Background)', minHeight: '100%' }}>
      <VStack spacing={4} style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {!inStageMode && (
          <VStack spacing={1}>
            <H1>Typography matcher test</H1>
            <Body color="quiet">
              Drop a moodboard. Trios tab gives a recommended set; Header /
              Decorative / Body tabs let you override each role independently.
            </Body>
          </VStack>
        )}

        <HStack spacing={2} alignItems="center">
          {!hideUploadUI && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              <Button variant="primary" onClick={() => fileRef.current?.click()}>
                Pick a moodboard
              </Button>
            </>
          )}
          {loadingPhrase && (
            <VStack spacing={0}>
              <BodySmall>{loadingPhrase}…</BodySmall>
              {status === 'analyzing' && (
                <Caption color="quiet">15–25s on cold start</Caption>
              )}
            </VStack>
          )}
        </HStack>

        {error && (
          <Alert severity="error">
            <strong>Couldn't analyze the moodboard.</strong> {error}
            {inStageMode && (
              <>
                <br />
                This is usually a temporary server issue — the font-matching
                service can be busy or rate-limited, especially on a cold start.
                Wait a moment and click Analyze again. If it keeps failing after a
                few tries, go back and re-upload the moodboard.
                <br />
                <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
                  Technical detail: image was{' '}
                  <code style={{ wordBreak: 'break-all' }}>{preloadedMoodboardUrl ?? '(none)'}</code>
                </span>
              </>
            )}
          </Alert>
        )}

        {/* Stage-mode visible loading state. Without this, a blank page is
            all the user sees while we wait the 15-40s for the cloud
            functions to respond. */}
        {inStageMode && !result && !error && (
          <Card padding="large">
            <VStack spacing={1} alignItems="center">
              <H2>Analyzing your moodboard…</H2>
              <Body color="quiet">
                {status === 'analyzing'
                  ? 'Extracting text regions and matching fonts. Cold start can take 20-40 seconds.'
                  : 'Loading…'}
              </Body>
            </VStack>
          </Card>
        )}

        {preview && result && (
          <DetectionDetails
            preview={preview}
            result={result}
            moodboardUrl={imageUrl ?? preloadedMoodboardUrl ?? preview}
            notTextMarked={notTextMarked}
            onMarkNotText={(role, region) => {
              setNotTextMarked(prev => new Set(prev).add(role));
              logGateFeedback({
                cropUrl: region.dataUrl,
                moodboardUrl: imageUrl ?? preloadedMoodboardUrl ?? preview,
                verdict: 'not-text',
                role,
              });
            }}
          />
        )}

        {result && (
          <>
            <Divider />
            <HStack spacing={3} alignItems="flex-start" style={{ width: '100%' }}>
              {/* Left column: lib Accordion sections. Header is expanded by
                  default so the user lands on the suggested font; Decorative
                  and Body collapse so the panel stays scannable. */}
              <VStack spacing={2} style={{ width: 380, flexShrink: 0 }}>
                <Button variant="default-outline" size="small" onClick={swapHeaderDecorative} style={{ width: '100%' }}>
                  ⇄ Swap Header &amp; Decorative
                </Button>
                <AccordionGroup spacing={1}>
                  <Accordion defaultExpanded>
                    <AccordionSummary>Header</AccordionSummary>
                    <AccordionDetails>
                      <VStack spacing={2}>
                        <SuggestedCard
                          current={currentHeader}
                          weight={currentHeaderWeight}
                          letterSpacing={currentHeaderSpacing}
                          textCase={currentHeaderCase}
                          sampleText="The quick brown fox"
                          fontSize={28}
                          description={headerSuggestions[0]?.description ?? 'No suggestion yet'}
                          uploadedFont={headerUpload}
                          customized={headerPresetCategory !== null || headerUpload !== null}
                        />
                        <Button variant="primary-outline" size="small" onClick={() => setCustomizeRole('header')}>
                          Customize…
                        </Button>
                      </VStack>
                    </AccordionDetails>
                  </Accordion>
                  <Accordion defaultExpanded>
                    <AccordionSummary>Decorative</AccordionSummary>
                    <AccordionDetails>
                      <VStack spacing={2}>
                        <SuggestedCard
                          current={currentDecorative}
                          weight={currentDecorativeWeight}
                          letterSpacing={currentDecorativeSpacing}
                          textCase={currentDecorativeCase}
                          sampleText="jumps over the lazy dog"
                          fontSize={20}
                          description={decorativeSuggestions[0]?.description ?? 'No suggestion yet'}
                          uploadedFont={decorativeUpload}
                          customized={decorativePresetCategory !== null || decorativeUpload !== null}
                        />
                        <Button variant="primary-outline" size="small" onClick={() => setCustomizeRole('decorative')}>
                          Customize…
                        </Button>
                      </VStack>
                    </AccordionDetails>
                  </Accordion>
                  <Accordion>
                    <AccordionSummary>Body</AccordionSummary>
                    <AccordionDetails>
                      <VStack spacing={2}>
                        <ButtonGroup value={bodyFamily} onChange={(f: BodyFamily) => {
                          setBodyFamily(f);
                          setBodyOverride(null);
                          setBodyUpload(null);
                          setBodyFamilyTouched(true);
                        }} size="small" style={{ width: '100%' }}>
                          <Button value="sans" size="small" style={{ flex: 1 }}>Sans-serif</Button>
                          <Button value="serif" size="small" style={{ flex: 1 }}>Serif</Button>
                        </ButtonGroup>
                        <SuggestedCard
                          current={currentBody}
                          weight={bodyWeightOverride ?? result.specs.body.regular.weight}
                          letterSpacing={bodySpacingOverride ?? result.specs.body.regular.letter_spacing}
                          textCase="normal"
                          sampleText={BODY_SAMPLE}
                          fontSize={14}
                          description={bodyFamily === 'serif' ? 'Serif' : 'Sans serif'}
                          uploadedFont={bodyUpload}
                          customized={bodyFamilyTouched || bodyUpload !== null}
                        />
                        <FontUploadButton onUpload={(file) => handleFontUpload(file, 'body')} />
                      </VStack>
                    </AccordionDetails>
                  </Accordion>
                </AccordionGroup>
              </VStack>

              {/* Right / main: trios that reflect the user's current picks */}
              <VStack spacing={2} style={{ flex: 1, minWidth: 0 }}>
                <TriosTab
                  result={result}
                  sortedTrios={sortedTrios}
                  selectedIdx={trioIdx}
                  currentHeader={currentHeader}
                  currentHeaderWeight={currentHeaderWeight}
                  currentHeaderSpacing={currentHeaderSpacing}
                  currentHeaderCase={currentHeaderCase}
                  currentDecorative={currentDecorative}
                  currentDecorativeWeight={currentDecorativeWeight}
                  currentDecorativeSpacing={currentDecorativeSpacing}
                  currentDecorativeCase={currentDecorativeCase}
                  currentBody={currentBody}
                  bodyFamilyMode={bodyFamily}
                  bodyWeight={bodyWeightOverride ?? result.specs.body.regular.weight}
                  bodySpacing={bodySpacingOverride ?? result.specs.body.regular.letter_spacing}
                  headerOverride={headerOverride}
                  decorativeOverride={decorativeOverride}
                  bodyOverride={bodyOverride}
                  headerPresetCategory={headerPresetCategory}
                  decorativePresetCategory={decorativePresetCategory}
                  headerPixelCategory={pixelOverrideCategory(
                    headerPresetCategory,
                    result.extractedText[0],
                    result.headerBranch ?? result.branch,
                    result.headerStyle ?? result.style,
                  )}
                  decorativePixelCategory={pixelOverrideCategory(
                    decorativePresetCategory,
                    result.extractedText[1],
                    result.decorativeBranch ?? result.branch,
                    result.decorativeStyle ?? result.style,
                  )}
                  hasOverrides={
                    headerOverride !== null
                    || decorativeOverride !== null
                    || bodyOverride !== null
                  }
                  adjusterOpenIdx={adjusterOpenTrioIdx}
                  onToggleAdjuster={(i) => setAdjusterOpenTrioIdx((cur) => cur === i ? null : i)}
                  onHeaderWeightChange={setHeaderWeightOverride}
                  onHeaderSpacingChange={setHeaderSpacingOverride}
                  onHeaderCaseChange={setHeaderCaseOverride}
                  onDecorativeWeightChange={setDecorativeWeightOverride}
                  onDecorativeSpacingChange={setDecorativeSpacingOverride}
                  onDecorativeCaseChange={setDecorativeCaseOverride}
                  onBodyWeightChange={setBodyWeightOverride}
                  onBodySpacingChange={setBodySpacingOverride}
                  onSelect={(i) => {
                    // Selection-only: clicking a trio updates the highlighted
                    // card but does NOT reset the user's role overrides. The
                    // SuggestedCard on the left (auto-detected pick or
                    // Customize-modal choice) persists across trio clicks.
                    setTrioIdx(i);
                  }}
                />
              </VStack>
            </HStack>
            {/* Decorative-mode toggle (only shown when the upstream stage
                passes the controlled value + handler). Sits between the
                trios grid and the stage navigation row. */}
            {decorativeMode !== undefined && onDecorativeModeChange && (
              <Card padding="medium">
                <VStack spacing={1}>
                  <H3>Decorative usage</H3>
                  <Caption color="quiet">
                    Choose where the decorative font appears in your generated
                    components.
                  </Caption>
                  <ButtonGroup
                    value={decorativeMode}
                    onChange={onDecorativeModeChange}
                    size="small"
                    style={{ width: '100%' }}
                  >
                    <Button value="surface-components" size="small" style={{ flex: 1 }}>
                      Surface components
                    </Button>
                    <Button value="only-selected" size="small" style={{ flex: 1 }}>
                      Only where I select it
                    </Button>
                  </ButtonGroup>
                </VStack>
              </Card>
            )}
          </>
        )}
      </VStack>

      <CustomizeModal
        open={customizeRole !== null}
        onClose={() => setCustomizeRole(null)}
        role={customizeRole ?? ''}
        presets={customizeRole === 'decorative' ? DECORATIVE_STYLE_PRESETS : HEADER_STYLE_PRESETS}
        current={customizeRole === 'decorative' ? currentDecorative : currentHeader}
        sampleText={customizeRole === 'decorative' ? 'jumps over the lazy dog' : 'The quick brown fox'}
        fontSize={customizeRole === 'decorative' ? 20 : 28}
        uploadedFont={customizeRole === 'decorative' ? decorativeUpload : headerUpload}
        currentWeight={customizeRole === 'decorative' ? currentDecorativeWeight : currentHeaderWeight}
        currentLetterSpacing={customizeRole === 'decorative' ? currentDecorativeSpacing : currentHeaderSpacing}
        currentCase={customizeRole === 'decorative' ? currentDecorativeCase : currentHeaderCase}
        onPickPreset={(p) => {
          if (customizeRole) handlePickPreset(customizeRole, p);
        }}
        onUpload={(file) => {
          if (customizeRole) handleFontUpload(file, customizeRole);
        }}
        branchFilter={branchFilter}
        onBranchFilterChange={setBranchFilter}
      />
    </div>
  );
}

// ── subcomponents ───────────────────────────────────────────────────

function DetectionDetails({
  preview, result, moodboardUrl: _moodboardUrl, notTextMarked, onMarkNotText,
}: {
  preview: string;
  result: MoodboardAnalysis;
  moodboardUrl: string;
  notTextMarked: Set<string>;
  onMarkNotText: (role: string, region: ExtractedTextRegion) => void;
}) {
  const header = result.extractedText[0];
  const decorative = result.extractedText[1];
  return (
    <AccordionGroup spacing={1}>
      <Accordion>
        <AccordionSummary>Detection details</AccordionSummary>
        <AccordionDetails>
          <VStack spacing={2}>
            <Caption color="quiet">
              The actual crops the matcher used. If the wrong text region is being
              highlighted as Header, that's why the suggestion below doesn't
              reflect your intended source.
            </Caption>
            <HStack spacing={3} alignItems="flex-start" style={{ flexWrap: 'wrap' }}>
              <img
                src={preview}
                alt="Moodboard preview"
                style={{
                  width: 240,
                  height: 240,
                  objectFit: 'cover',
                  borderRadius: 'var(--Style-Border-Radius)',
                  flexShrink: 0,
                }}
              />
              {header && !notTextMarked.has('header') ? (
                <CropDetail
                  role="Header (tallest)"
                  region={header}
                  branch={result.headerBranch ?? result.branch}
                  style={result.headerStyle ?? result.style}
                  modifiers={result.headerModifiers ?? result.modifiers}
                  onMarkNotText={() => onMarkNotText('header', header)}
                />
              ) : !header ? (
                <Caption color="quiet">No header crop — using whole image.</Caption>
              ) : (
                <Caption color="quiet">Header reported as not text — thanks!</Caption>
              )}
              {decorative && !notTextMarked.has('decorative') ? (
                <CropDetail
                  role={`Decorative (${
                    result.decorativePickReason === 'script_handwritten'
                      ? 'script / handwritten pick'
                      : decorative.isAllCaps
                      ? 'all-caps pick'
                      : '2nd tallest'
                  })`}
                  region={decorative}
                  branch={result.decorativeBranch ?? result.branch}
                  style={result.decorativeStyle ?? result.style}
                  modifiers={result.decorativeModifiers ?? result.modifiers}
                  onMarkNotText={() => onMarkNotText('decorative', decorative)}
                />
              ) : decorative ? (
                <Caption color="quiet">Decorative reported as not text — thanks!</Caption>
              ) : null}
            </HStack>
          </VStack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  );
}

function CropDetail({
  role, region, branch, style, modifiers, onMarkNotText,
}: {
  role: string;
  region: ExtractedTextRegion;
  branch: string;
  style: string;
  modifiers: { weight: string; width: string };
  /** Optional — when provided, renders a small "Not text" button at the
   *  bottom of the card. Click logs a `not-text` verdict to Firestore
   *  via the parent's handler and hides this card from the current view. */
  onMarkNotText?: () => void;
}) {
  return (
    <Card padding="small" style={{ flex: 1, minWidth: 280 }}>
      <VStack spacing={1}>
        <Caption color="primary"><strong>{role}</strong></Caption>
        <img
          src={region.dataUrl}
          alt={region.text || 'detected crop'}
          style={{
            width: '100%',
            height: 120,
            objectFit: 'contain',
            background: 'var(--Container)',
            borderRadius: 'var(--Style-Border-Radius)',
          }}
        />
        <BodySmall>"{region.text || '(text not readable)'}"</BodySmall>
        {/* Show the EFFECTIVE classification (pixel-corrected when CLIP and
            the stroke scan disagreed) — same as the SuggestedCard on the
            left. The raw CLIP label still shows on a second line so the
            diagnostic value isn't lost. */}
        {(() => {
          const eff = effectiveBranchAndStyle(branch, style, region);
          return (
            <Caption color="quiet">
              {eff.branch} · {eff.style}
            </Caption>
          );
        })()}
        <Caption color="quiet">
          {/* Pixel-measured weight wins over CLIP's modifier when there are
              enough vertical stems to trust the measurement. Falls back to
              CLIP for words made of only curved letters. */}
          {region.stroke.strokeCount >= 2 ? region.stroke.weight : modifiers.weight}, {modifiers.width}
          {' · '}{region.spacing} tracking
          {region.isAllCaps ? ' · ALL CAPS' : ''}
        </Caption>
        {region.stroke.strokeCount >= 2 && (
          <Caption color="quiet">
            Pixel scan: stroke ratio {(region.stroke.weightRatio * 100).toFixed(0)}% ·
            {' '}{region.stroke.hasSerifFeet ? 'serif feet detected' : 'flat terminals (sans)'} ·
            {' '}{region.stroke.strokeCount} stems
          </Caption>
        )}
        {onMarkNotText && (
          <Button
            variant="default-outline"
            size="small"
            onClick={onMarkNotText}
            sx={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Not text
          </Button>
        )}
      </VStack>
    </Card>
  );
}

function TriosTab({
  result, sortedTrios, selectedIdx,
  currentHeader, currentHeaderWeight, currentHeaderSpacing, currentHeaderCase,
  currentDecorative, currentDecorativeWeight, currentDecorativeSpacing, currentDecorativeCase,
  currentBody, bodyFamilyMode, bodyWeight, bodySpacing,
  headerOverride, decorativeOverride, bodyOverride,
  headerPresetCategory, decorativePresetCategory,
  headerPixelCategory, decorativePixelCategory,
  hasOverrides, onSelect,
  adjusterOpenIdx, onToggleAdjuster,
  onHeaderWeightChange, onHeaderSpacingChange, onHeaderCaseChange,
  onDecorativeWeightChange, onDecorativeSpacingChange, onDecorativeCaseChange,
  onBodyWeightChange, onBodySpacingChange,
}: {
  result: MoodboardAnalysis;
  sortedTrios: FontTrio[];
  selectedIdx: number;
  currentHeader: string;
  currentHeaderWeight: string;
  currentHeaderSpacing: string;
  currentHeaderCase: TextCase;
  currentDecorative: string;
  currentDecorativeWeight: string;
  currentDecorativeSpacing: string;
  currentDecorativeCase: TextCase;
  currentBody: string;
  bodyFamilyMode: BodyFamily;
  bodyWeight: string;
  bodySpacing: string;
  headerOverride: string | null;
  decorativeOverride: string | null;
  bodyOverride: string | null;
  headerPresetCategory: string | null;
  decorativePresetCategory: string | null;
  /** Pixel-detector category override — when set, all trio cards cycle
   *  through the corrected branch's pool so the trio rendering matches
   *  what the SuggestedCard advertises (no more "left says serif, trios
   *  show sans"). User's explicit preset pick still wins. */
  headerPixelCategory: string | null;
  decorativePixelCategory: string | null;
  hasOverrides: boolean;
  onSelect: (i: number) => void;
  adjusterOpenIdx: number | null;
  onToggleAdjuster: (i: number) => void;
  onHeaderWeightChange: (w: string) => void;
  onHeaderSpacingChange: (ls: string) => void;
  onHeaderCaseChange: (c: TextCase) => void;
  onDecorativeWeightChange: (w: string) => void;
  onDecorativeSpacingChange: (ls: string) => void;
  onDecorativeCaseChange: (c: TextCase) => void;
  onBodyWeightChange: (w: string) => void;
  onBodySpacingChange: (ls: string) => void;
}) {
  return (
    <VStack spacing={2}>
      {hasOverrides && (
        <VStack spacing={1}>
          <Caption color="primary">Your current pick: #{selectedIdx + 1}</Caption>
          <Card padding="medium">
            <VStack spacing={1}>
              <FontPreview
                family={currentHeader}
                weight={currentHeaderWeight}
                letterSpacing={currentHeaderSpacing}
                fontSize={36}
                lineHeight={1.1}
                fallback="serif"
                textTransform={currentHeaderCase}
              >
                The quick brown fox
              </FontPreview>
              <FontPreview
                family={currentDecorative}
                weight={currentDecorativeWeight}
                letterSpacing={currentDecorativeSpacing}
                fontSize={24}
                lineHeight={1.2}
                fallback="serif"
                textTransform={currentDecorativeCase}
              >
                jumps over the lazy dog
              </FontPreview>
              <FontPreview
                family={currentBody}
                weight={bodyWeight}
                letterSpacing={bodySpacing}
                fontSize={14}
                lineHeight={1.5}
                fallback="sans-serif"
              >
                {BODY_SAMPLE}
              </FontPreview>
              <BodySmall color="quiet">
                {currentHeader} · {currentDecorative} · {currentBody}
              </BodySmall>
            </VStack>
          </Card>
        </VStack>
      )}
      {/* Cards stay in their sorted order (same_style / cross_pair first,
          then mood). Selecting one just toggles the checkbox and highlights
          the card — re-ordering on selection was visually unsettling. The
          "Your current pick: #N" label at the top tells the user which
          card is active. */}
      {sortedTrios.map((trio, i) => (
        <Card
          key={i}
          clickable
          selected={i === selectedIdx}
          onClick={() => onSelect(i)}
          padding="medium"
        >
          <VStack spacing={1}>
            <HStack spacing={1} alignItems="center" justifyContent="space-between">
              <Caption color="quiet"><strong>#{i + 1}</strong></Caption>
              {/* Top-right pick checkbox. Clicking the checkbox is equivalent
                  to clicking the card itself — both fire onSelect(i). */}
              <Checkbox
                checked={i === selectedIdx}
                onChange={() => onSelect(i)}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
            </HStack>
            {/* When a category preset is picked, each trio cycles through that
                category's pool so every card shows a DIFFERENT family in the
                same style. Without a category, the per-trio server family is
                used — the user's specific override is shown in the "Your
                current pick" card at the top instead of being smeared across
                every trio. Weight / spacing / case always follow the user's
                left-panel picks. */}
            {(() => {
              // User's explicit preset pick wins; otherwise fall back to the
              // pixel-detector override (when CLIP and pixels disagreed on
              // serif vs sans); otherwise use the server's per-trio family.
              const headerCategoryEffective = headerPresetCategory ?? headerPixelCategory;
              const decorativeCategoryEffective = decorativePresetCategory ?? decorativePixelCategory;
              const headerFamily = familyForTrioRole(i, headerCategoryEffective, headerOverride, trio.header);
              const decorativeFamily = familyForTrioRole(i, decorativeCategoryEffective, decorativeOverride, trio.decorative);
              // Body family resolution: user-typed override wins; otherwise
              // the sans/serif toggle decides — serif mode swaps in the body
              // serif default so every trio's body reflects the user's pick.
              const bodyFamily = bodyOverride
                ?? (bodyFamilyMode === 'serif' ? BODY_SERIF_DEFAULT : trio.body);
              const adjusterOpen = adjusterOpenIdx === i;
              return (
                <>
                  <FontPreview
                    family={headerFamily}
                    weight={currentHeaderWeight}
                    letterSpacing={currentHeaderSpacing}
                    fontSize={36}
                    lineHeight={1.1}
                    fallback="sans-serif"
                    textTransform={currentHeaderCase}
                  >
                    The quick brown fox
                  </FontPreview>
                  <FontPreview
                    family={decorativeFamily}
                    weight={currentDecorativeWeight}
                    letterSpacing={currentDecorativeSpacing}
                    fontSize={24}
                    lineHeight={1.2}
                    fallback="sans-serif"
                    textTransform={currentDecorativeCase}
                  >
                    jumps over the lazy dog
                  </FontPreview>
                  <FontPreview
                    family={bodyFamily}
                    weight={bodyWeight}
                    letterSpacing={bodySpacing}
                    fontSize={14}
                    lineHeight={1.5}
                    fallback="sans-serif"
                  >
                    {BODY_SAMPLE}
                  </FontPreview>
                  <Divider />
                  <HStack
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                    style={{ paddingRight: 12 }}
                  >
                    <BodySmall color="quiet">
                      {headerFamily} · {decorativeFamily} · {bodyFamily ?? '—'}
                    </BodySmall>
                    <Link
                      textStyle="body-small"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleAdjuster(i); }}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Settings {adjusterOpen ? '▾' : '▸'}
                    </Link>
                  </HStack>
                  {adjusterOpen && (
                    <VStack spacing={1} onClick={(e) => e.stopPropagation()}>
                      <Caption color="quiet">Header</Caption>
                      <InlineAdjuster
                        family={headerFamily}
                        weight={currentHeaderWeight}
                        letterSpacing={currentHeaderSpacing}
                        onWeightChange={onHeaderWeightChange}
                        onLetterSpacingChange={onHeaderSpacingChange}
                        allCaps={currentHeaderCase === 'uppercase'}
                        onAllCapsChange={(b) => onHeaderCaseChange(b ? 'uppercase' : 'normal')}
                      />
                      <Caption color="quiet">Decorative</Caption>
                      <InlineAdjuster
                        family={decorativeFamily}
                        weight={currentDecorativeWeight}
                        letterSpacing={currentDecorativeSpacing}
                        onWeightChange={onDecorativeWeightChange}
                        onLetterSpacingChange={onDecorativeSpacingChange}
                        allCaps={currentDecorativeCase === 'uppercase'}
                        onAllCapsChange={(b) => onDecorativeCaseChange(b ? 'uppercase' : 'normal')}
                      />
                      <Caption color="quiet">Body</Caption>
                      <InlineAdjuster
                        family={bodyFamily}
                        weight={bodyWeight}
                        letterSpacing={bodySpacing}
                        onWeightChange={onBodyWeightChange}
                        onLetterSpacingChange={onBodySpacingChange}
                      />
                    </VStack>
                  )}
                </>
              );
            })()}
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

function PresetList({
  presets, current, sampleText, fontSize, onPickPreset, branchFilter,
  weightOverride, letterSpacingOverride, caseOverride,
}: {
  presets: StylePreset[];
  current: string;
  sampleText: string;
  fontSize: number;
  onPickPreset: (preset: StylePreset) => void;
  /** Optional checkbox filter — only presets whose category maps to an
   *  enabled branch are shown. When omitted, every preset is included. */
  branchFilter?: BranchFilter;
  /** Shared style values from the modal's top controls. When provided,
   *  every row renders with these instead of the preset's own hardcoded
   *  weight/spacing/case so the user can compare families head-to-head
   *  at one consistent style. */
  weightOverride?: string;
  letterSpacingOverride?: string;
  caseOverride?: TextCase;
}) {
  const filtered = branchFilter
    ? presets.filter((p) => branchFilter[presetBranch(p.category)])
    : presets;
  return (
    <VStack spacing={1}>
      {filtered.map((preset) => {
        const isSelected = preset.family === current;
        const renderWeight = weightOverride ?? preset.weight;
        const renderSpacing = letterSpacingOverride ?? preset.letterSpacing;
        const renderCase = caseOverride ?? preset.textTransform;
        return (
          <Card
            key={preset.label}
            clickable
            selected={isSelected}
            onClick={() => onPickPreset(preset)}
            padding="small"
          >
            <VStack spacing={0}>
              <OverlineSmall color="quiet">{isSelected ? '✓ Sample' : 'Sample'}</OverlineSmall>
              <FontPreview
                family={preset.family}
                weight={renderWeight}
                letterSpacing={renderSpacing}
                fontSize={fontSize}
                lineHeight={1.1}
                fallback="sans-serif"
                textTransform={renderCase}
              >
                {sampleText}
              </FontPreview>
              <Caption color={isSelected ? 'primary' : 'quiet'}>
                {preset.category}
              </Caption>
            </VStack>
          </Card>
        );
      })}
    </VStack>
  );
}

function FontUploadButton({ onUpload }: { onUpload: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <HStack spacing={2}>
      <input
        ref={ref}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          if (ref.current) ref.current.value = '';
        }}
        style={{ display: 'none' }}
      />
      <Button variant="primary-outline" size="small" onClick={() => ref.current?.click()}>
        Upload a font
      </Button>
    </HStack>
  );
}

/** The simplified per-role panel content. Just the auto-picked font preview
 *  with a "Style: Suggested" / "Style: Customized" overline and a one-line
 *  description. The Customize button lives OUTSIDE the card so the card
 *  itself is purely a presentation of the current pick. */
function SuggestedCard({
  current, weight, letterSpacing, textCase, sampleText, fontSize,
  description, uploadedFont, customized = false,
}: {
  current: string;
  weight: string;
  letterSpacing: string;
  textCase: TextCase;
  sampleText: string;
  fontSize: number;
  description: string;
  uploadedFont: { family: string; fileName: string } | null;
  /** True when the user explicitly picked a style via the Customize modal
   *  or uploaded a font. Flips the label from "Suggested" to "Customized"
   *  so the user can tell which roles still reflect the auto-pick. */
  customized?: boolean;
}) {
  return (
    <Card padding="medium">
      <VStack spacing={2}>
        <OverlineSmall color="quiet">
          Style: {customized ? 'Customized' : 'Suggested'}
        </OverlineSmall>
        <FontPreview
          family={current}
          weight={weight}
          letterSpacing={letterSpacing}
          fontSize={fontSize + 4}
          lineHeight={1.1}
          fallback="sans-serif"
          textTransform={textCase}
        >
          {sampleText}
        </FontPreview>
        <Caption color="quiet">{description}</Caption>
        {uploadedFont && (
          <Caption color="primary">Using uploaded font: {uploadedFont.fileName}</Caption>
        )}
      </VStack>
    </Card>
  );
}

/** Inline weight + letter-spacing adjuster. Toggled open per role; shows
 *  the chosen family (read-only — to change it the user opens the Customize
 *  modal) and lets them dial weight in 100-step increments and letter
 *  spacing in 0.01em increments. */
function InlineAdjuster({
  family, weight, letterSpacing, onWeightChange, onLetterSpacingChange,
  allCaps, onAllCapsChange,
}: {
  family: string;
  weight: string;
  letterSpacing: string;
  onWeightChange: (w: string) => void;
  onLetterSpacingChange: (ls: string) => void;
  /** Optional all-caps toggle — only passed for Header / Decorative, where
   *  flipping case is part of the design choice. Body never goes all-caps. */
  allCaps?: boolean;
  onAllCapsChange?: (v: boolean) => void;
}) {
  // letterSpacing comes in as a string like "0.18em" — strip the unit so
  // the slider/number input can work in a number domain.
  const lsNumber = parseFloat(letterSpacing.replace(/em$/, '')) || 0;
  const weightNumber = parseInt(weight, 10) || 400;
  return (
    <Card padding="small">
      <VStack spacing={2}>
        <VStack spacing={0}>
          <OverlineSmall color="quiet">Font family</OverlineSmall>
          <BodySmall>{family || '—'}</BodySmall>
        </VStack>
        <VStack spacing={0}>
          <OverlineSmall color="quiet">Weight ({weightNumber})</OverlineSmall>
          <Slider
            min={100}
            max={900}
            step={100}
            value={weightNumber}
            onChange={(_: unknown, value: number | number[]) => onWeightChange(String(Array.isArray(value) ? value[0] : value))}
          />
        </VStack>
        <VStack spacing={0}>
          <OverlineSmall color="quiet">
            Letter spacing ({lsNumber.toFixed(2)}em)
          </OverlineSmall>
          <Slider
            min={-0.05}
            max={0.30}
            step={0.01}
            value={lsNumber}
            onChange={(_: unknown, value: number | number[]) => {
              const v = Array.isArray(value) ? value[0] : value;
              onLetterSpacingChange(`${v}em`);
            }}
          />
        </VStack>
        {onAllCapsChange && (
          <Checkbox
            label="All caps"
            checked={!!allCaps}
            onChange={(e) => onAllCapsChange((e.target as HTMLInputElement).checked)}
          />
        )}
      </VStack>
    </Card>
  );
}

/** Opens from the Customize button on each role. Houses the full preset
 *  gallery (filterable by branch) and the font-upload affordance. One modal
 *  instance shared across roles — the role + the preset list to show are
 *  driven by props. */
/** Snap an arbitrary CSS weight string to the closest entry in the modal's
 *  three-step ButtonGroup so the control reflects the current pick instead
 *  of silently sitting on "Regular" when the saved weight is 600/800/etc. */
function snapWeightToBucket(weight: string): '300' | '500' | '700' {
  const n = parseInt(weight, 10);
  if (Number.isNaN(n)) return '500';
  if (n <= 350) return '300';
  if (n >= 650) return '700';
  return '500';
}

/** Same idea for letter spacing — snap to the four buckets the ButtonGroup
 *  exposes so an opened modal shows the matching segment. */
function snapSpacingToBucket(spacing: string): '-0.02em' | '0em' | '0.05em' | '0.18em' {
  const n = parseFloat(spacing);
  if (Number.isNaN(n)) return '0em';
  if (n <= -0.005) return '-0.02em';
  if (n <= 0.025) return '0em';
  if (n <= 0.1) return '0.05em';
  return '0.18em';
}

function CustomizeModal({
  open, onClose, role, presets, current, sampleText, fontSize,
  uploadedFont, onPickPreset, onUpload,
  branchFilter, onBranchFilterChange,
  currentWeight, currentLetterSpacing, currentCase,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  presets: StylePreset[];
  current: string;
  sampleText: string;
  fontSize: number;
  uploadedFont: { family: string; fileName: string } | null;
  onPickPreset: (preset: StylePreset) => void;
  onUpload: (file: File) => void;
  branchFilter: BranchFilter;
  onBranchFilterChange: (next: BranchFilter) => void;
  /** The role's current weight / letter-spacing / case. Used to seed the
   *  modal's top controls on open so the user starts from where the role
   *  already is, not a generic default. */
  currentWeight: string;
  currentLetterSpacing: string;
  currentCase: TextCase;
}) {
  const setFlag = (key: keyof BranchFilter, value: boolean) =>
    onBranchFilterChange({ ...branchFilter, [key]: value });

  // Modal-local state for the shared weight / spacing / case controls. Init
  // from the role's current pick so opening the modal doesn't reset what the
  // user already had. Re-sync each time the modal opens.
  const [modalWeight, setModalWeight] = useState(snapWeightToBucket(currentWeight));
  const [modalSpacing, setModalSpacing] = useState(snapSpacingToBucket(currentLetterSpacing));
  const [modalCase, setModalCase] = useState<TextCase>(currentCase);

  useEffect(() => {
    if (open) {
      setModalWeight(snapWeightToBucket(currentWeight));
      setModalSpacing(snapSpacingToBucket(currentLetterSpacing));
      setModalCase(currentCase);
    }
  }, [open, currentWeight, currentLetterSpacing, currentCase]);

  // One row per unique CATEGORY. With weight/spacing/case shared at the
  // top, the only thing left to differentiate rows is the style family —
  // and the user thinks in categories ("Sans / Clean", "Serif / Editorial"),
  // not individual fonts. Pick the first preset of each category as that
  // category's representative; the font engine substitutes other families
  // from the category pool when needed.
  const uniquePresets = useMemo(() => {
    const seen = new Set<string>();
    return presets.filter((p) => {
      if (seen.has(p.category)) return false;
      seen.add(p.category);
      return true;
    });
  }, [presets]);

  return (
    <Modal open={open} onClose={onClose} title={`Customize ${role.toLowerCase()}`} size="large">
      {/* Three-region layout: top controls + filters and bottom upload are
          fixed; the middle preset list is the only thing that scrolls.
          The outer container caps its own height so the Modal body never
          overflows — that would introduce a second scrollbar. */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 180px)',
        minHeight: 400,
      }}>
        {/* Top — style controls + filters */}
        <VStack spacing={3} style={{ flexShrink: 0 }}>
          <VStack spacing={1}>
            <Caption color="quiet">Style — applied to every option</Caption>
            <VStack spacing={2}>
              <HStack spacing={3}>
                <VStack spacing={0}>
                  <Caption color="quiet">Weight</Caption>
                  <ButtonGroup
                    value={modalWeight}
                    onChange={(v: string) => setModalWeight(v as '300' | '500' | '700')}
                    size="small"
                  >
                    <Button value="300" size="small">Thin</Button>
                    <Button value="500" size="small">Regular</Button>
                    <Button value="700" size="small">Heavy</Button>
                  </ButtonGroup>
                </VStack>
                <VStack spacing={0}>
                  <Caption color="quiet">Letter spacing</Caption>
                  <ButtonGroup
                    value={modalSpacing}
                    onChange={(v: string) => setModalSpacing(v as '-0.02em' | '0em' | '0.05em' | '0.18em')}
                    size="small"
                  >
                    <Button value="-0.02em" size="small">Tight</Button>
                    <Button value="0em" size="small">Normal</Button>
                    <Button value="0.05em" size="small">Wide</Button>
                    <Button value="0.18em" size="small">Spaced</Button>
                  </ButtonGroup>
                </VStack>
              </HStack>
              <Checkbox
                label="All caps"
                checked={modalCase === 'uppercase'}
                onChange={(e) =>
                  setModalCase((e.target as HTMLInputElement).checked ? 'uppercase' : 'normal')
                }
              />
            </VStack>
          </VStack>
          <Divider />
          <VStack spacing={1}>
            <Caption color="quiet">Filter styles</Caption>
            <HStack spacing={2}>
              <Checkbox
                label="Sans serif"
                checked={branchFilter.sans}
                onChange={(e) => setFlag('sans', (e.target as HTMLInputElement).checked)}
              />
              <Checkbox
                label="Serif"
                checked={branchFilter.serif}
                onChange={(e) => setFlag('serif', (e.target as HTMLInputElement).checked)}
              />
              <Checkbox
                label="Script / Handwritten"
                checked={branchFilter.expressive}
                onChange={(e) => setFlag('expressive', (e.target as HTMLInputElement).checked)}
              />
            </HStack>
          </VStack>
          <Divider />
        </VStack>

        {/* Middle — scrolling preset gallery. flex:1 + minHeight:0 lets it
            shrink inside the flex column so overflow:auto actually kicks
            in instead of pushing the footer off-screen. */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '16px 8px 16px 0' }}>
          <PresetList
            presets={uniquePresets}
            current={current}
            sampleText={sampleText}
            fontSize={fontSize}
            weightOverride={modalWeight}
            letterSpacingOverride={modalSpacing}
            caseOverride={modalCase}
            onPickPreset={(p) => {
              // Apply the family the user clicked, but carry over the
              // modal's shared style values so the role lands exactly
              // where the user saw it in the preview row.
              onPickPreset({
                ...p,
                weight: modalWeight,
                letterSpacing: modalSpacing,
                textTransform: modalCase,
              });
              onClose();
            }}
            branchFilter={branchFilter}
          />
        </div>

        {/* Bottom — upload block, fixed in footer */}
        <VStack spacing={1} style={{ flexShrink: 0 }}>
          <Divider />
          <Caption color="quiet">
            Or upload your own — .ttf, .otf, .woff, .woff2.
          </Caption>
          <FontUploadButton onUpload={(file) => { onUpload(file); onClose(); }} />
          {uploadedFont && (
            <Caption color="primary">Using uploaded font: {uploadedFont.fileName}</Caption>
          )}
        </VStack>
      </div>
    </Modal>
  );
}

function FontPreview({
  family, weight, letterSpacing, fontSize, lineHeight, fallback, textTransform, children,
}: {
  family: string;
  weight: string | number;
  letterSpacing: string | number;
  fontSize: number;
  lineHeight: number;
  fallback: 'serif' | 'sans-serif';
  textTransform?: TextCase;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: family ? `"${family}", ${fallback}` : fallback,
        fontSize,
        fontWeight: weight,
        letterSpacing,
        color: 'var(--Text)',
        lineHeight,
        // CSS expects "none" — passing "normal" is invalid and the browser
        // silently keeps the previously-applied transform (which is why
        // switching from an all-caps preset to a non-all-caps preset wasn't
        // clearing the uppercase styling).
        textTransform: textTransform === 'uppercase' ? 'uppercase' : 'none',
      }}
    >
      {children}
    </div>
  );
}
