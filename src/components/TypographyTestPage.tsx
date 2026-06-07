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
  { label: 'Script',                    family: 'Dancing Script',   category: 'Expressive / Script',  modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
  { label: 'Handwritten',               family: 'Caveat',           category: 'Expressive / Hand',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '700', letterSpacing: '0em' },
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
  { label: 'Great Vibes (script)',      family: 'Great Vibes',      category: 'Expressive / Script',  modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Sacramento (script)',       family: 'Sacramento',       category: 'Expressive / Script',  modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Patrick Hand',              family: 'Patrick Hand',     category: 'Expressive / Hand',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
  { label: 'Indie Flower',              family: 'Indie Flower',     category: 'Expressive / Hand',    modifiers: { weight: 'regular', width: 'normal'    }, weight: '400', letterSpacing: '0em' },
];

type BranchKey = 'sans' | 'serif' | 'expressive';
type BranchFilter = {
  sans: boolean;
  serif: boolean;
  expressive: boolean;
  /** Exclusive "show only all-caps presets" filter. When true, every preset
   *  whose textTransform isn't 'uppercase' gets hidden. When false (the
   *  default), case isn't filtered at all. Behaves opposite to the branch
   *  filters — those default-on and exclude when unchecked; this defaults
   *  off and narrows when checked. */
  allCaps: boolean;
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
  sans: true, serif: true, expressive: true, allCaps: false,
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
  'Expressive / Display': ['Bangers', 'Righteous', 'Boogaloo', 'Titan One', 'Bungee', 'Lilita One', 'Passion One', 'Luckiest Guy'],
  'Expressive / Script':  ['Dancing Script', 'Sacramento', 'Great Vibes', 'Satisfy', 'Allura', 'Pinyon Script', 'Yellowtail', 'Kaushan Script'],
  'Expressive / Hand':    ['Caveat', 'Indie Flower', 'Patrick Hand', 'Permanent Marker', 'Shadows Into Light', 'Architects Daughter', 'Amatic SC', 'Rock Salt'],
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
  // Script signal first — substantial text with very few clean vertical
  // stems is a categorical cursive call regardless of CLIP's branch.
  if (region.stroke.isLikelyScript) {
    if (clipBranch === 'Expressive' && clipStyle.includes('Script')) {
      return { branch: clipBranch, style: clipStyle, pixelOverride: false };
    }
    return {
      branch: 'Expressive',
      style: 'Script / Cursive',
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
  // Script wins regardless of strokeCount — isLikelyScript uses
  // text-length / stem-count and doesn't need stroke analysis to be
  // reliable. Default to Dancing Script (top of the script pool).
  if (region.stroke.isLikelyScript) {
    return CATEGORY_FAMILY_POOLS['Expressive / Script'][0];
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
  // Script signal first — when the region reads as script/handwritten, the
  // entire trio family should pool-cycle through Expressive / Script so
  // every alternative the user sees is on-brief.
  if (region.stroke.isLikelyScript) {
    return 'Expressive / Script';
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

export default function TypographyTestPage({
  preloadedMoodboardUrl,
  hideUploadUI,
  decorativeMode,
  onDecorativeModeChange,
  onTypographyComplete,
  onNext,
  onBack,
}: TypographyTestPageProps = {}) {
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(preloadedMoodboardUrl ?? null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MoodboardAnalysis | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Selection state. Trio sets the baseline; per-role overrides win.
  const [trioIdx, setTrioIdx] = useState(0);
  const [headerOverride, setHeaderOverride] = useState<string | null>(null);
  const [decorativeOverride, setDecorativeOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  // When a category preset is picked (e.g. "Sans / Geometric"), the trio
  // cards cycle through that category's font pool so each trio shows a
  // different family. Suggestion / upload picks leave these null so the
  // trios stay on the server's per-trio ranked families.
  const [headerPresetCategory, setHeaderPresetCategory] = useState<string | null>(null);
  const [decorativePresetCategory, setDecorativePresetCategory] = useState<string | null>(null);
  const [bodyFamily, setBodyFamily] = useState<BodyFamily>('sans');
  // Weight + letter-spacing overrides — populated when the user picks a
  // style preset so the visual matches the preset's vibe (Display = heavy
  // extended, Script = regular, etc.). Null means use the server specs.
  const [headerWeightOverride, setHeaderWeightOverride] = useState<string | null>(null);
  const [headerSpacingOverride, setHeaderSpacingOverride] = useState<string | null>(null);
  const [headerCaseOverride, setHeaderCaseOverride] = useState<TextCase | null>(null);
  const [decorativeWeightOverride, setDecorativeWeightOverride] = useState<string | null>(null);
  const [decorativeSpacingOverride, setDecorativeSpacingOverride] = useState<string | null>(null);
  const [decorativeCaseOverride, setDecorativeCaseOverride] = useState<TextCase | null>(null);
  // Uploaded custom fonts per role. Each entry holds the synthetic family
  // name we registered via FontFace + the original file name for display.
  const [headerUpload, setHeaderUpload] = useState<{ family: string; fileName: string } | null>(null);
  const [decorativeUpload, setDecorativeUpload] = useState<{ family: string; fileName: string } | null>(null);
  const [bodyUpload, setBodyUpload] = useState<{ family: string; fileName: string } | null>(null);
  // The image URL on Firebase Storage. Set after upload; consumed by the
  // analyzeMoodboard call.
  const [, setImageUrl] = useState<string | null>(null);

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
  const [bodyFamilyTouched, setBodyFamilyTouched] = useState(false);

  // When a fresh result lands, default-select the "From your moodboard text"
  // suggestion — that's the CLIP + OCR-driven pick and what most users will
  // want as their starting point. The user can switch to the mood-driven
  // suggestion or any preset, but they shouldn't have to make a click just
  // to apply what we already think is the best match.
  useEffect(() => {
    if (!result) return;
    setTrioIdx(0);
    setBodyOverride(null);
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
  const currentHeader = headerOverride ?? trio?.header ?? '';
  const currentDecorative = decorativeOverride ?? trio?.decorative ?? '';
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
      const wasClamped = family !== clipTrio.header;
      const categoryStr = headerPresetCategory ?? `${branch} · ${style}`;
      const confLabel = !wasClamped && !pixelOverride && conf !== undefined ? ` · ${Math.round(conf * 100)}% confidence` : '';
      const clampedNote = headerPresetCategory && family !== clipTrio.header && !pixelOverride
        ? ' · clamped to your pick'
        : pixelOverride ? ' · pixel-corrected' : '';
      out.push({
        label: 'From your moodboard text',
        description: `${categoryStr}${confLabel}${clampedNote} · ${weight}, ${mod.width} · ${spacing} tracking${allCaps ? ' · ALL CAPS' : ''}`,
        family,
        weight: css.weight,
        letterSpacing: css.letterSpacing,
        textTransform: allCaps ? 'uppercase' : undefined,
      });
    }
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
      const categoryStr = decorativePresetCategory ?? `${branch} · ${style}`;
      const confLabel = !pixelOverride && conf !== undefined ? ` · ${Math.round(conf * 100)}% confidence` : '';
      const clampedNote = decorativePresetCategory && family !== clipTrio.decorative && !pixelOverride
        ? ' · clamped to your pick'
        : pixelOverride ? ' · pixel-corrected' : '';
      out.push({
        label: 'From your moodboard text',
        description: `${categoryStr}${confLabel}${clampedNote} · ${weight}, ${mod.width} · ${spacing} tracking${allCaps ? ' · ALL CAPS' : ''}`,
        family,
        weight: css.weight,
        letterSpacing: css.letterSpacing,
        textTransform: allCaps ? 'uppercase' : undefined,
      });
    }
    const moodTrio = result.trios.find((t) => t.type === 'mood_preset' || t.type === 'mood_alt');
    if (moodTrio && moodTrio.mood) {
      const family = clampFamilyToCategory(moodTrio.decorative, decorativePresetCategory, decorativeOverride);
      const wasClamped = family !== moodTrio.decorative;
      out.push({
        label: `From mood: ${moodTrio.mood.label}`,
        description: wasClamped
          ? 'Color-driven preset · clamped to your category pick'
          : 'Color-driven preset (brightness, saturation, hue)',
        family,
        weight: result.specs.decorative.weight,
        letterSpacing: result.specs.decorative.letter_spacing,
      });
    }
    return out;
  }, [result, decorativeCrop, decorativePresetCategory, decorativeOverride]);

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

  const handleFontUpload = useCallback(async (file: File, role: 'header' | 'decorative' | 'body') => {
    try {
      const family = `custom-${role}-${Date.now()}`;
      const buffer = await file.arrayBuffer();
      const face = new FontFace(family, buffer);
      await face.load();
      document.fonts.add(face);
      const upload = { family, fileName: file.name };
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

  return (
    <div style={{ padding: '40px 24px' }}>
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
                The image URL the matcher received was{' '}
                <code style={{ wordBreak: 'break-all' }}>{preloadedMoodboardUrl ?? '(none)'}</code>.
                If that URL is a Firebase Storage signed URL it may have expired —
                go back, re-upload the moodboard, and try again.
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
          <DetectionDetails preview={preview} result={result} />
        )}

        {result && (
          <>
            <Divider />
            <HStack spacing={3} alignItems="flex-start" style={{ width: '100%' }}>
              {/* Left column: lib Accordion sections. Header is expanded by
                  default so the user lands on the suggested font; Decorative
                  and Body collapse so the panel stays scannable. */}
              <VStack spacing={2} style={{ width: 380, flexShrink: 0 }}>
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
                  <Accordion>
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

function DetectionDetails({ preview, result }: { preview: string; result: MoodboardAnalysis }) {
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
              {header ? (
                <CropDetail
                  role="Header (tallest)"
                  region={header}
                  branch={result.headerBranch ?? result.branch}
                  style={result.headerStyle ?? result.style}
                  modifiers={result.headerModifiers ?? result.modifiers}
                />
              ) : (
                <Caption color="quiet">No header crop — using whole image.</Caption>
              )}
              {decorative ? (
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
                />
              ) : null}
            </HStack>
          </VStack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  );
}

function CropDetail({
  role, region, branch, style, modifiers,
}: {
  role: string;
  region: ExtractedTextRegion;
  branch: string;
  style: string;
  modifiers: { weight: string; width: string };
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
            <>
              <Caption color="quiet">
                {eff.branch} · {eff.style}
                {eff.pixelOverride ? ' · pixel-corrected' : ''}
              </Caption>
              {eff.pixelOverride && (
                <Caption color="quiet">CLIP said: {branch} · {style}</Caption>
              )}
            </>
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
}: {
  presets: StylePreset[];
  current: string;
  sampleText: string;
  fontSize: number;
  onPickPreset: (preset: StylePreset) => void;
  /** Optional checkbox filter — only presets whose category maps to an
   *  enabled branch are shown. When omitted, every preset is included. */
  branchFilter?: BranchFilter;
}) {
  const filtered = branchFilter
    ? presets.filter((p) => {
        const branchOk = branchFilter[presetBranch(p.category)];
        // allCaps acts as an exclusive narrowing filter: when checked,
        // only presets whose textTransform is 'uppercase' survive; when
        // unchecked, case isn't filtered at all.
        const caseOk = !branchFilter.allCaps || p.textTransform === 'uppercase';
        return branchOk && caseOk;
      })
    : presets;
  return (
    <VStack spacing={1}>
      {filtered.map((preset) => {
        const isSelected = preset.family === current;
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
                weight={preset.weight}
                letterSpacing={preset.letterSpacing}
                fontSize={fontSize}
                lineHeight={1.1}
                fallback="sans-serif"
                textTransform={preset.textTransform}
              >
                {sampleText}
              </FontPreview>
              <Caption color={isSelected ? 'primary' : 'quiet'}>
                {preset.category} · {preset.modifiers.weight}, {preset.modifiers.width}
                {preset.textTransform === 'uppercase' ? ', ALL CAPS' : ''}
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
function CustomizeModal({
  open, onClose, role, presets, current, sampleText, fontSize,
  uploadedFont, onPickPreset, onUpload,
  branchFilter, onBranchFilterChange,
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
}) {
  const setFlag = (key: keyof BranchFilter, value: boolean) =>
    onBranchFilterChange({ ...branchFilter, [key]: value });
  return (
    <Modal open={open} onClose={onClose} title={`Customize ${role.toLowerCase()}`} size="large">
      <VStack spacing={3}>
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
            <Checkbox
              label="All caps only"
              checked={branchFilter.allCaps}
              onChange={(e) => setFlag('allCaps', (e.target as HTMLInputElement).checked)}
            />
          </HStack>
        </VStack>
        <Divider />
        {/* Scroll just the preset gallery so the filter row at the top and
            the Upload affordance at the bottom stay pinned while the user
            browses the whole list. The 320 px budget covers the modal
            title + close button + filter row + divider + upload row + the
            modal's own padding — anything left in the viewport is the
            scrolling preset body. */}
        <div style={{
          maxHeight: 'calc(100vh - 320px)',
          minHeight: 200,
          overflowY: 'auto',
          paddingRight: 8,
        }}>
          <PresetList
            presets={presets}
            current={current}
            sampleText={sampleText}
            fontSize={fontSize}
            onPickPreset={(p) => { onPickPreset(p); onClose(); }}
            branchFilter={branchFilter}
          />
        </div>
        <Divider />
        <VStack spacing={1}>
          <Caption color="quiet">
            Or upload your own — .ttf, .otf, .woff, .woff2.
          </Caption>
          <FontUploadButton onUpload={(file) => { onUpload(file); onClose(); }} />
          {uploadedFont && (
            <Caption color="primary">Using uploaded font: {uploadedFont.fileName}</Caption>
          )}
        </VStack>
      </VStack>
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
