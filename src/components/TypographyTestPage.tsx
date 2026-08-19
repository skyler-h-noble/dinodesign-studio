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
  Card, VStack, HStack, Divider, Alert, Checkbox, Slider, Link,
  AccordionGroup, Accordion, AccordionSummary, AccordionDetails,
  Modal,
} from '@dynodesign/components';
import { useAuth } from '../contexts/AuthContext';
import { analyzeMoodboard, warmAnalyzeMoodboard, getOrStartMoodboardAnalysis } from '../utils/analyzeMoodboardClient';
import type { MoodboardAnalysis, ExtractedTextRegion } from '../utils/analyzeMoodboardClient';
import { uploadDesignSystemFile, getPublicFileUrl } from '../utils/firebase/storage';
import { fontFamilyParam } from '../utils/googleFontWeights';
import {
  HEADER_FAMILY, moodToAxes, explainAxes, normalizeBranch, headerPresets,
  type AxisValues,
} from '../utils/moodAxes';
import {
  RolePanels, TypeSpecimen, NoiseFilter,
  type TypeSystem, type FontChoice, type RoleName,
  type DisplayRole, type HeaderRole, type EyebrowRole,
} from './typography/TypeRoles';
import { logGateFeedback, logGateRejections } from '../utils/textGateFeedback';
import { moodFontMapping, type MoodName } from '../data/moodFontMapping';
import { loadHeaderFlexFace } from '../utils/googleFontsManager';
import { useFontMatch } from '../hooks/useFontMatch';
import { DEFAULT_DISPLAY_SIZE, DISPLAY_LEADING } from '../utils/typeScale';

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
  label: string;             // e.g. "Suggested:"
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
  // An explicit pick ALWAYS wins. This used to be reachable only when the
  // category had an entry in CATEGORY_FAMILY_POOLS, so clicking a chip whose
  // category came from anywhere else — the mood pool labels its groups
  // "Calm · Monospace", which is not a pool key — was silently dropped and the
  // trio's family was used instead. The click looked like it did nothing.
  if (presetFamily) return presetFamily;
  if (presetCategory) {
    const pool = CATEGORY_FAMILY_POOLS[presetCategory];
    if (pool && pool.length > 0) return pool[index % pool.length];
  }
  return fallback;
}

// Sans / serif body fallbacks used when the user toggles or uploads. Each
// side has one canonical family — body doesn't get a style picker.
const BODY_SANS_DEFAULT = 'Inter';
const BODY_SERIF_DEFAULT = 'Source Serif Pro';

// Body pools for the role panel's chips. Kept short on purpose: body copy is a
// legibility decision, not an expressive one, so a long gallery would be a
// worse question than a handful of known-good reading faces.
const BODY_SANS_CHOICES = [
  'Inter', 'Muli', 'Open Sans', 'Lato', 'Source Sans Pro', 'Nunito Sans',
  'Work Sans', 'DM Sans', 'Karla', 'IBM Plex Sans',
];
const BODY_SERIF_CHOICES = [
  'Source Serif Pro', 'Lora', 'Merriweather', 'Crimson Text', 'Spectral',
  'PT Serif', 'Libre Baskerville', 'Bitter', 'Cardo', 'Noto Serif',
];
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

/** The Header face is never in the picked-families list — it is always Google
 *  Sans Flex — so it loads on its own, once, with every axis's full range. A
 *  plain family= request would ship only the default instance and the sliders
 *  would move nothing. */
function useHeaderFlexFace() {
  useEffect(() => { loadHeaderFlexFace(); }, []);
}

/** Inject one combined Google Fonts <link> for every font in the result so
 *  arbitrary previews can render in their actual face. */
function useGoogleFonts(families: string[]) {
  useEffect(() => {
    if (families.length === 0) return;

    // Request ONLY the weights each font actually ships (per Google's metadata),
    // so the css2 API never 400s the whole request over a single-weight
    // script/display font — while multi-weight fonts still load their real
    // heavy/light faces. Limited to the weights the previews render.
    // Batched, not one request. The pools now run to ~90 families, and a single
    // css2 URL carrying all of them is long enough to be rejected outright —
    // at which point NONE of the chips render in their own face, they all fall
    // back to the same one. Smaller requests fail independently, so one bad
    // family costs one batch instead of the whole panel.
    const BATCH = 12;
    document.querySelectorAll('link[data-typo-test-fonts]').forEach((l) => l.remove());
    for (let i = 0; i < families.length; i += BATCH) {
      const param = families
        .slice(i, i + BATCH)
        .map((f) => fontFamilyParam(f, [300, 400, 600, 700, 800]))
        .join('&');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${param}&display=swap`;
      link.setAttribute('data-typo-test-fonts', 'true');
      document.head.appendChild(link);
    }
  }, [families.join('|')]);
}

/**
 * The classifier's mood → a key moodFontMapping actually has.
 *
 * The two vocabularies overlap but aren't identical (the classifier emits
 * Modern, Warm, Tech, Professional; the mapping has Business, Futuristic,
 * Stiff…), so an unmatched mood lands on Calm rather than an empty pool.
 */
function moodKeyFor(mood?: string | null): MoodName {
  const raw = String(mood ?? '').replace(/-\d+$/, '').trim();
  const keys = Object.keys(moodFontMapping) as MoodName[];
  const exact = keys.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias: Record<string, MoodName> = {
    modern: 'Business', professional: 'Business', tech: 'Futuristic',
    warm: 'Happy', bold: 'Loud', minimal: 'Stiff', formal: 'Sophisticated',
    romantic: 'Elegant', friendly: 'Happy', energetic: 'Excited',
    nostalgic: 'Vintage', creative: 'Artistic', quiet: 'Calm',
  };
  return alias[raw.toLowerCase()] ?? 'Calm';
}

/** Axes → a font-variation-settings string. wght is omitted: it is passed as
 *  font-weight, and declaring it twice lets the two disagree. */
function variationCss(axes: AxisValues): string {
  return Object.entries(axes)
    .filter(([tag]) => tag !== 'wght')
    .map(([tag, v]) => `"${tag}" ${v}`)
    .join(', ');
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
  /** Kept in the contract so the value still reaches generateDesignSystem at
   *  its default; the picker itself was removed from this step. */
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
  type: 'header' | 'decorative' | 'body' | 'eyebrow';
  family: string;
  weight: string;
  letterSpacing: string;
  allCaps: boolean;
  /** Header only — the Google Sans Flex axis values. Persisted so the sliders
   *  come back where the user left them on stage re-entry. */
  axes?: AxisValues;
  /** Decorative (Display) only — the Display-Large size in px, which the
   *  Medium and Small steps scale from. */
  displaySize?: number;
  /** Decorative (Display) only — the leading ratio for the Display ramp. */
  displayLeading?: number;
  /** Decorative (Display) only — 0–100 grain and hand-lettering rise/fall. */
  noise?: number;
  bounce?: number;
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
   *  role (e.g. "Sans / Geometric"). Kept for designs saved before the Header
   *  became a Flex face; it no longer drives anything. */
  headerPresetCategory: string | null;
  /** Lettering ignored; the Display is suggested from the palette mood. */
  ignoreTextDetection?: boolean;
  /** The category the user picked from the customize modal for the Decorative
   *  role. Drives the trio cycling + the Suggested / Customized label state.
   *  Null when no preset was picked. */
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
    const m: Partial<Record<TypographyStyleOutput['type'], TypographyStyleOutput>> = {};
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
  // The Header face is Google Sans Flex, never a picked family, so its
  // character lives in the axes rather than in a font choice. Null means "use
  // the mood-derived recommendation"; the sliders write a full axis set here.
  const [headerAxesOverride, setHeaderAxesOverride] = useState<AxisValues | null>(
    initialByType.header?.axes ?? null
  );
  // Display grain and bounce. Neither is a font property — a font file can't be
  // roughened and every glyph in a face is identical — so they ride on the role
  // and are rendered by the CSS export as a filter and per-character offsets.
  const [displaySize, setDisplaySize] = useState<number>(
    initialByType.decorative?.displaySize ?? DEFAULT_DISPLAY_SIZE
  );
  const [displayLeading, setDisplayLeading] = useState<number>(
    initialByType.decorative?.displayLeading ?? DISPLAY_LEADING
  );
  const [displayNoise, setDisplayNoise] = useState<number>(initialByType.decorative?.noise ?? 0);
  const [displayBounce, setDisplayBounce] = useState<number>(initialByType.decorative?.bounce ?? 0);
  // The eyebrow is the OS UI stack, so there is no family to pick — only how
  // heavy and how tracked out the label sits.
  const [eyebrowWeight, setEyebrowWeight] = useState<string>(initialByType.eyebrow?.weight ?? '600');
  const [eyebrowSpacing, setEyebrowSpacing] = useState<string>(initialByType.eyebrow?.letterSpacing ?? '0.12em');
  // Which role panels are open, and whether the six raw axes are showing.
  const [openRoles, setOpenRoles] = useState<Set<RoleName>>(
    () => new Set<RoleName>(['Display', 'Eyebrow', 'Header', 'Body'])
  );
  const [axesAdvanced, setAxesAdvanced] = useState(false);
  // ONE region is sampled, not two. Detection picks the tallest block, which is
  // right most of the time and wrong in a way that's hard to correct otherwise
  // — OCR may have merged the words, or the interesting lettering may simply
  // not be the biggest. So the user can point at a different one.
  const [displayRegionIdx, setDisplayRegionIdx] = useState(0);
  // When on, the sampled lettering is ignored entirely and the Display is
  // suggested from the palette's MOOD instead. moodFontMapping exists for
  // exactly this ("Used when NO text is detected in the mood board") — this
  // makes it a choice rather than only a fallback, for boards whose lettering
  // is incidental or misleading.
  const [ignoreTextDetection, setIgnoreTextDetection] = useState(
    initialMeta?.ignoreTextDetection ?? false
  );
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  // Which role panel the pointer or focus is in. Drives the preview highlight
  // so a panel and the text it controls are visibly the same thing.
  const [activeRole, setActiveRole] = useState<RoleName | null>(null);
  // The preview is sticky at 72px and its height varies with the Display size,
  // so the role panels can't hardcode where it ends. Measure it and hand the
  // panels an offset to stick below.
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewH, setPreviewH] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setPreviewH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [result]);
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

  // When a fresh result lands, default-select the "Suggested:"
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
      // The Header never ACQUIRES caps. All-caps lettering in the image says
      // something about the Display, which is the face being matched to it —
      // propagating it here put two roles in caps at once, which is the pairing
      // the Display/Header coupling exists to prevent. Only the Header's own
      // checkbox turns it on.
      setHeaderCaseOverride('normal');

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
  const currentBody = bodyOverride ?? (bodyFamily === 'serif' ? BODY_SERIF_DEFAULT : (trio?.body ?? BODY_SANS_DEFAULT));

  // Effective spec values — preset overrides win; otherwise fall back to the
  // server-detected weight + letter-spacing for the role.
  const currentHeaderWeight = headerWeightOverride ?? result?.specs.header.weight ?? '700';
  const currentHeaderSpacing = headerSpacingOverride ?? result?.specs.header.letter_spacing ?? '0em';
  const currentHeaderCase: TextCase = headerCaseOverride ?? 'normal';
  const currentDecorativeWeight = decorativeWeightOverride ?? result?.specs.decorative.weight ?? '400';
  const currentDecorativeSpacing = decorativeSpacingOverride ?? result?.specs.decorative.letter_spacing ?? '0em';
  const currentDecorativeCase: TextCase = decorativeCaseOverride ?? 'normal';

  // ── The sampled region ────────────────────────────────────────────────────
  // Everything about the Display's character is measured off ONE crop. The
  // server classified the first two (header / decorative); beyond that we still
  // have the local pixel analysis on every region, so a hand-picked block falls
  // back to the whole-image classification plus its own strokes.
  const regions = result?.extractedText ?? [];
  // Detection off → no crop. Everything measured off the lettering (weight,
  // case, branch, and the whole font-match ranking) falls back to the mood.
  const sampledRegion: ExtractedTextRegion | undefined =
    ignoreTextDetection ? undefined : regions[displayRegionIdx];
  const sampledClip = useMemo(() => {
    if (displayRegionIdx === 1) {
      return {
        weight: result?.decorativeModifiers?.weight ?? result?.modifiers.weight ?? 'regular',
        branch: result?.decorativeBranch ?? result?.branch ?? '',
        style: result?.decorativeStyle ?? result?.style ?? '',
        category: result?.decorativeCategory,
      };
    }
    if (displayRegionIdx === 0) {
      return {
        weight: result?.headerModifiers?.weight ?? result?.modifiers.weight ?? 'regular',
        branch: result?.headerBranch ?? result?.branch ?? '',
        style: result?.headerStyle ?? result?.style ?? '',
        category: result?.headerCategory,
      };
    }
    return {
      weight: result?.modifiers.weight ?? 'regular',
      branch: result?.branch ?? '',
      style: result?.style ?? '',
      category: undefined as string | undefined,
    };
  }, [displayRegionIdx, result]);

  /** Weight and branch as MEASURED on the sampled crop — pixels overrule CLIP. */
  const sampledWeight = effectiveWeight(sampledClip.weight as 'thin' | 'regular' | 'heavy', sampledRegion);
  const sampledBranchStyle = effectiveBranchAndStyle(sampledClip.branch, sampledClip.style, sampledRegion);
  const sampledAllCaps = sampledRegion?.isAllCaps ?? false;

  // The lettering's own case is the starting point for the Display — if the
  // words in the image are set in caps, the Display is too until the user says
  // otherwise. `null` override means "follow the image".
  const displayAllCaps = decorativeCaseOverride !== null
    ? decorativeCaseOverride === 'uppercase'
    : sampledAllCaps;

  // The Header never runs in caps while the Display does — see the note where
  // it is applied. The user's own Header choice still stands when the Display
  // is mixed case.
  // Display in caps REMOVES caps from the Header. Display not in caps does not
  // ADD them — the Header keeps whatever its own checkbox says, which defaults
  // to off and is never set automatically.
  const headerAllCaps = displayAllCaps ? false : currentHeaderCase === 'uppercase';

  // ── Header axes ───────────────────────────────────────────────────────────
  // The Header is set AGAINST the Decorative face rather than picked to match
  // it: the Decorative role is the loud one by definition, so the Header's job
  // is to be the quiet one. moodToAxes inverts the measured weight, flattens
  // against a serif, and gets out of the way entirely when the Decorative face
  // is script or hand-lettering.
  const headerAxisOptions = useMemo(() => ({
    displayWeight: sampledWeight,
    displayBranch: normalizeBranch(sampledBranchStyle.branch, sampledClip.category ?? sampledBranchStyle.style),
    displayCategory: sampledClip.category ?? sampledBranchStyle.style,
  }), [sampledWeight, sampledBranchStyle.branch, sampledBranchStyle.style, sampledClip.category]);

  const suggestedHeaderAxes = useMemo(
    () => moodToAxes(result?.mood?.key ?? 'Modern', headerAxisOptions),
    [result?.mood?.key, headerAxisOptions]
  );
  const currentHeaderAxes = headerAxesOverride ?? suggestedHeaderAxes;
  const headerAxesRationale = useMemo(
    () => explainAxes(result?.mood?.key ?? 'Modern', headerAxisOptions),
    [result?.mood?.key, headerAxisOptions]
  );
  const headerAxesCustomized = headerAxesOverride !== null;
  const setHeaderAxis = useCallback((tag: string, value: number) => {
    setHeaderAxesOverride((prev) => ({ ...(prev ?? suggestedHeaderAxes), [tag]: value }));
  }, [suggestedHeaderAxes]);

  // ── The role panels ───────────────────────────────────────────────────────
  // One object the panels and the specimen both read, so a control and its
  // preview can never disagree about what the system currently is.
  const typeSystem: TypeSystem = useMemo(() => ({
    display: {
      family: currentDecorative,
      category: decorativePresetCategory ?? result?.decorativeCategory ?? '',
      weight: currentDecorativeWeight,
      letterSpacing: currentDecorativeSpacing,
      allCaps: displayAllCaps,
      size: displaySize,
      leading: displayLeading,
      noise: displayNoise,
      bounce: displayBounce,
      detectedWeight: sampledWeight,
      detectedAllCaps: sampledAllCaps,
    },
    header: {
      axes: currentHeaderAxes,
      letterSpacing: currentHeaderSpacing,
      // Two roles shouting at once reads as one voice. The Display is the loud
      // one by definition, so when it is set in caps the Header steps back to
      // sentence case — the same reasoning that inverts its weight.
      allCaps: headerAllCaps,
      rationale: headerAxesRationale,
    },
    eyebrow: { weight: eyebrowWeight, letterSpacing: eyebrowSpacing },
    body: { family: currentBody, branch: bodyFamily },
  }), [
    currentDecorative, decorativePresetCategory, result, currentDecorativeWeight,
    currentDecorativeSpacing, displayAllCaps, displaySize, displayLeading, displayNoise, displayBounce,
    currentHeaderAxes, currentHeaderSpacing, headerAllCaps, headerAxesRationale,
    eyebrowWeight, eyebrowSpacing, currentBody, bodyFamily,
  ]);

  // The headline the specimen sets — the biggest piece of text the matcher
  // actually found, so the preview shows the user's own words.
  const specimenHeadline = result?.extractedText?.[0]?.text?.trim() || 'Vivid Mornings';

  // Font pools for the Display, RESTRICTED to what was detected.
  //
  // Offering every category is worse than useless: a moodboard whose lettering
  // is hand-drawn was being shown Playfair, Lora and Roboto Slab first, none of
  // which have anything to do with it. The pool starts at the detected category
  // and widens only to the rest of that branch — an Expressive detection offers
  // the other Expressive pools, never Serif or Sans.
  const displayChoices: FontChoice[] = useMemo(() => {
    if (ignoreTextDetection) {
      // Straight from the palette's mood. The mapping groups by its own type
      // labels (Display/Decorative, Calligraphy, …), which become the headings.
      const key = moodKeyFor(result?.mood?.key ?? result?.mood?.label);
      const pool = moodFontMapping[key] ?? [];
      return pool.slice(0, 20).map((f) => ({
        family: f.name, category: `${key} · ${f.type}`, label: f.name,
      }));
    }
    const detectedCategory = sampledClip.category ?? sampledBranchStyle.style ?? '';
    // Branch vocabularies differ between the classifier ('Sans serif') and the
    // pool keys ('Sans / …'), so match on the first word rather than the label.
    const rawBranch = (detectedCategory.split('/')[0] || sampledBranchStyle.branch || '').trim();
    const branchKey = /serif/i.test(rawBranch) && !/sans/i.test(rawBranch) ? 'Serif'
      : /sans/i.test(rawBranch) ? 'Sans'
        : /express|script|hand|display/i.test(rawBranch) ? 'Expressive'
          : '';

    const allCategories = Object.keys(CATEGORY_FAMILY_POOLS);
    const inBranch = branchKey
      ? allCategories.filter((c) => c.startsWith(branchKey))
      : allCategories;
    // The detected category leads; its siblings follow. Anything unrecognised
    // falls back to the whole set rather than showing nothing.
    const exact = allCategories.find((c) => c.toLowerCase() === detectedCategory.toLowerCase());
    const near = exact ?? inBranch.find((c) => {
      const tail = detectedCategory.split('/').pop()?.trim().toLowerCase() ?? '';
      return tail && c.toLowerCase().includes(tail.split(' ')[0]);
    });
    const ordered = [
      ...(near ? [near] : []),
      ...(inBranch.length ? inBranch : allCategories).filter((c) => c !== near),
    ];

    // Capped at 20, the detected category taken whole before its siblings are
    // drawn on — the same budget omni uses. A branch's full pool ran to 30+,
    // which turns a decision into a scroll.
    const LIMIT = 20;
    const out: FontChoice[] = [];
    const seen = new Set<string>();
    for (const category of ordered) {
      if (out.length >= LIMIT) break;
      for (const family of CATEGORY_FAMILY_POOLS[category] ?? []) {
        if (out.length >= LIMIT) break;
        if (seen.has(family)) continue;
        seen.add(family);
        out.push({ family, category, label: family });
      }
    }
    return out;
  }, [ignoreTextDetection, result?.mood?.key, result?.mood?.label,
      sampledClip.category, sampledBranchStyle.style, sampledBranchStyle.branch]);
  const bodyChoices: FontChoice[] = useMemo(() => {
    const pool = bodyFamily === 'serif' ? BODY_SERIF_CHOICES : BODY_SANS_CHOICES;
    return pool.map((f) => ({ family: f, category: bodyFamily === 'serif' ? 'Serif' : 'Sans serif', label: f }));
  }, [bodyFamily]);

  // Rank the Display pool against the sampled crop — stroke fingerprint plus
  // ink overlay, both measured locally.
  // No crop, nothing to measure against — the ranking is skipped rather than
  // scoring every candidate against nothing.
  const matchInput = useMemo(
    () => sampledRegion
      ? { dataUrl: sampledRegion.dataUrl, stroke: sampledRegion.stroke, text: sampledRegion.text }
      : null,
    [sampledRegion]
  );
  const displayFamilyPool = useMemo(
    () => [...new Set(displayChoices.map((c) => c.family))],
    [displayChoices]
  );
  const match = useFontMatch(matchInput, displayFamilyPool);

  const headerAxisPresets = useMemo(
    () => headerPresets(result?.mood?.key ?? 'Modern', headerAxisOptions),
    [result?.mood?.key, headerAxisOptions]
  );

  const toggleRole = useCallback((role: RoleName) => {
    setOpenRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }, []);

  const applyDisplayPatch = useCallback((patch: Partial<DisplayRole>) => {
    if (patch.weight !== undefined) setDecorativeWeightOverride(patch.weight);
    if (patch.letterSpacing !== undefined) setDecorativeSpacingOverride(patch.letterSpacing);
    if (patch.allCaps !== undefined) setDecorativeCaseOverride(patch.allCaps ? 'uppercase' : 'normal');
    if (patch.size !== undefined) setDisplaySize(patch.size);
    if (patch.leading !== undefined) setDisplayLeading(patch.leading);
    if (patch.noise !== undefined) setDisplayNoise(patch.noise);
    if (patch.bounce !== undefined) setDisplayBounce(patch.bounce);
  }, []);

  const applyDisplayFont = useCallback((family: string, category: string) => {
    setDecorativeOverride(family);
    setDecorativePresetCategory(category);
    setDecorativeUpload(null);
  }, []);

  const applyHeaderPatch = useCallback((patch: Partial<HeaderRole>) => {
    if (patch.letterSpacing !== undefined) setHeaderSpacingOverride(patch.letterSpacing);
    if (patch.allCaps !== undefined) setHeaderCaseOverride(patch.allCaps ? 'uppercase' : 'normal');
  }, []);

  const applyEyebrowPatch = useCallback((patch: Partial<EyebrowRole>) => {
    if (patch.weight !== undefined) setEyebrowWeight(patch.weight);
    if (patch.letterSpacing !== undefined) setEyebrowSpacing(patch.letterSpacing);
  }, []);

  const applyBodyBranch = useCallback((branch: BodyFamily) => {
    setBodyFamily(branch);
    setBodyOverride(null);
    setBodyUpload(null);
    setBodyFamilyTouched(true);
  }, []);

  const applyBodyFont = useCallback((family: string) => {
    setBodyOverride(family);
    setBodyUpload(null);
    setBodyFamilyTouched(true);
  }, []);

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

  // The Header no longer has a suggested FAMILY — it is always Google Sans
  // Flex, and what gets suggested is the axis set (see suggestedHeaderAxes).
  // The old family-suggestion memo lived here.


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
        label: 'Suggested:',
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
    // The Body panel's own chips. Each chip sets its "Ag" in the family it
    // names, which only reads as a choice if that family is actually loaded —
    // an unloaded family silently renders in the fallback face and every chip
    // looks identical.
    BODY_SANS_CHOICES.forEach((f) => set.add(f));
    BODY_SERIF_CHOICES.forEach((f) => set.add(f));
    // The mood pool, for when the user ignores the lettering. These families
    // (Oleo Script, Merienda, Bangers, Kalam…) are mostly NOT in the category
    // pools, so without this every mood chip renders in the fallback face and
    // the switch looks like it did nothing.
    const moodPool = moodFontMapping[moodKeyFor(result?.mood?.key ?? result?.mood?.label)] ?? [];
    moodPool.forEach((f) => set.add(f.name));
    return Array.from(set);
  }, [result]);

  useGoogleFonts(allFamilies);
  useHeaderFlexFace();
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
        // Always the Flex face — the family is not the user's to pick here.
        family: HEADER_FAMILY,
        // Weight IS the wght axis, so font-weight and the axis can't disagree.
        weight: String(currentHeaderAxes.wght),
        letterSpacing: currentHeaderSpacing,
        allCaps: headerAllCaps,
        axes: currentHeaderAxes,
      },
      {
        type: 'decorative',
        family: currentDecorative,
        weight: currentDecorativeWeight,
        letterSpacing: currentDecorativeSpacing,
        allCaps: displayAllCaps,
        displaySize,
        displayLeading,
        noise: displayNoise,
        bounce: displayBounce,
      },
      {
        // The eyebrow has no family of its own — it renders in the OS UI stack.
        type: 'eyebrow',
        family: '',
        weight: eyebrowWeight,
        letterSpacing: eyebrowSpacing,
        allCaps: true,
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
    currentHeader, currentHeaderAxes, currentHeaderSpacing, headerAllCaps,
    currentDecorative, currentDecorativeWeight, currentDecorativeSpacing, displayAllCaps,
    displaySize, displayLeading, displayNoise, displayBounce, eyebrowWeight, eyebrowSpacing,
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
      ignoreTextDetection,
    });
  }, [
    onMetaChange,
    trioIdx, bodyFamily, bodyFamilyTouched,
    headerPresetCategory, decorativePresetCategory, ignoreTextDetection,
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
    <div data-surface="Surface-Dim" style={{ padding: '16px 24px 40px', background: 'var(--Background)', minHeight: '100%' }}>
      {/* The Display grain filter has to exist in the document for
          `filter: url(#…)` to resolve. Renders nothing when noise is 0. */}
      <NoiseFilter noise={displayNoise} />
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

        {/* The specimen leads and stays put: it is the thing being decided,
            so it sits above the reasoning and the controls rather than beside
            them. */}
        {result && (
          // 72px clears the shell's 65px sticky top bar; at a smaller offset the
          // preview sticks BEHIND it and reads as not sticking at all.
          <div
            ref={previewRef}
            style={{
              position: 'sticky',
              top: 72,
              zIndex: 2,
              // An opaque band, not just a sticky card: without a background the
              // detection crop and its caption scroll THROUGH the gaps around
              // the card. The padding gives the band edges to hide them behind.
              background: 'var(--Background)',
              padding: '8px 0 12px',
              marginBottom: 4,
            }}
          >
            <TypeSpecimen
              system={typeSystem}
              headline={specimenHeadline}
              activeRole={activeRole}
              onHoverRole={setActiveRole}
            />
          </div>
        )}

        {preview && result && (
          <DetectionDetails
            preview={preview}
            result={result}
            moodboardUrl={imageUrl ?? preloadedMoodboardUrl ?? preview}
            notTextMarked={notTextMarked}
            sampledIdx={displayRegionIdx}
            onPickRegion={() => setRegionPickerOpen(true)}
            ignoreTextDetection={ignoreTextDetection}
            onIgnoreTextDetectionChange={setIgnoreTextDetection}
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
            {/* The four roles run side by side — Display first, because it is
                the decision the other three are set against. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'flex-start',
                width: '100%',
              }}
            >
              <RolePanels
                system={typeSystem}
                displayChoices={displayChoices}
                bodyChoices={bodyChoices}
                match={match}
                headerPresets={headerAxisPresets}
                open={openRoles}
                onToggle={toggleRole}
                advanced={axesAdvanced}
                onToggleAdvanced={() => setAxesAdvanced((a) => !a)}
                onDisplayChange={applyDisplayPatch}
                onDisplayFont={applyDisplayFont}
                onHeaderAxis={setHeaderAxis}
                onHeaderAxes={(axes) => setHeaderAxesOverride(axes)}
                onHeaderChange={applyHeaderPatch}
                onEyebrowChange={applyEyebrowPatch}
                onBodyBranch={applyBodyBranch}
                onBodyFont={applyBodyFont}
                onActiveRole={setActiveRole}
                stickTop={previewH ? 72 + previewH + 8 : 0}
              />
            </div>
          </>
        )}
      </VStack>

      <RegionPickerModal
        open={regionPickerOpen}
        regions={regions}
        currentIdx={displayRegionIdx}
        onClose={() => setRegionPickerOpen(false)}
        onPick={(i) => { setDisplayRegionIdx(i); setRegionPickerOpen(false); }}
      />

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
  sampledIdx, onPickRegion, ignoreTextDetection, onIgnoreTextDetectionChange,
}: {
  preview: string;
  result: MoodboardAnalysis;
  moodboardUrl: string;
  notTextMarked: Set<string>;
  onMarkNotText: (role: string, region: ExtractedTextRegion) => void;
  /** Which detected block the Display is sampled from. */
  sampledIdx: number;
  onPickRegion: () => void;
  /** Ignore the lettering and suggest from the palette mood instead. */
  ignoreTextDetection: boolean;
  onIgnoreTextDetectionChange: (v: boolean) => void;
}) {
  // ONE sample, not two. The second crop existed to pick a second family; the
  // Header is a Flex face now, so there is a single piece of lettering the
  // whole system is matched against.
  const sampled = result.extractedText[sampledIdx];
  return (
    <AccordionGroup spacing={1}>
      <Accordion>
        <AccordionSummary>Detection details</AccordionSummary>
        <AccordionDetails>
          <VStack spacing={2}>
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
              {ignoreTextDetection ? (
                <Caption color="quiet">
                  Lettering ignored — the type system is being suggested from the
                  palette mood.
                </Caption>
              ) : sampled && !notTextMarked.has('display') ? (
                <CropDetail
                  role={`Display — "${sampled.text}"`}
                  region={sampled}
                  branch={result.headerBranch ?? result.branch}
                  style={result.headerStyle ?? result.style}
                  modifiers={result.headerModifiers ?? result.modifiers}
                />
              ) : !sampled ? (
                <Caption color="quiet">No text crop — using the whole image.</Caption>
              ) : (
                <Caption color="quiet">Reported as not text — thanks!</Caption>
              )}
            </HStack>
            {result.extractedText.length > 1 && !ignoreTextDetection && (
              <Link onClick={onPickRegion}>Analyze a new text region in the image</Link>
            )}
            <Divider />
            <Checkbox
              checked={ignoreTextDetection}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onIgnoreTextDetectionChange(e?.target?.checked ?? !ignoreTextDetection)}
              label="Ignore the lettering — suggest from the palette mood"
            />
            <Caption color="quiet">
              {ignoreTextDetection
                ? `Suggestions come from the ${result.mood?.label ?? 'detected'} mood of your colours. Nothing is measured against the image, so there are no match scores.`
                : 'Use this when the lettering on the board is incidental — a stock photo, a watermark, or type that has nothing to do with the brand.'}
            </Caption>
          </VStack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  );
}

/**
 * Pick which lettering the Display is measured against.
 *
 * Detection takes the tallest block, which is right most of the time and wrong
 * in a way that is hard to correct otherwise — OCR may have merged the words,
 * or the lettering worth matching may simply not be the biggest thing on the
 * board. This is the escape hatch, one click deep, rather than a permanent
 * grid of thumbnails competing with the controls.
 */
function RegionPickerModal({
  open, regions, currentIdx, onClose, onPick,
}: {
  open: boolean;
  regions: ExtractedTextRegion[];
  currentIdx: number;
  onClose: () => void;
  onPick: (idx: number) => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Analyze a new text region">
      <VStack spacing={2} style={{ maxWidth: 640 }}>
        <Caption color="quiet">
          Every block of lettering the detector found. Pick the one the type system
          should be matched against.
        </Caption>
        <VStack spacing={1} style={{ width: '100%' }}>
          {regions.map((r, i) => (
            <Card key={i} padding="small">
              <HStack spacing={2} alignItems="center" justifyContent="space-between">
                <img
                  src={r.dataUrl}
                  alt={r.text || `Detected lettering ${i + 1}`}
                  style={{ height: 44, maxWidth: 260, objectFit: 'contain' }}
                />
                <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
                  <BodySmall>{r.text || '(no text read)'}</BodySmall>
                  <Caption color="quiet">
                    {r.stroke.weight}{r.isAllCaps ? ' · all caps' : ''}
                  </Caption>
                </VStack>
                <Button
                  size="small"
                  variant={i === currentIdx ? 'primary' : 'default-outline'}
                  onClick={() => onPick(i)}
                >
                  {i === currentIdx ? 'Sampled' : 'Use this'}
                </Button>
              </HStack>
            </Card>
          ))}
        </VStack>
        <Button variant="default-outline" size="small" onClick={onClose}>Close</Button>
      </VStack>
    </Modal>
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
      </VStack>
    </Card>
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

/**
 * The Header panel. There is no font picker here on purpose: the Header face is
 * always Google Sans Flex, and its character comes from the six axes, set
 * against the Decorative face. The rationale line says why it landed where it
 * did, so the recommendation reads as a decision rather than magic.
 */

/** The simplified per-role panel content. Just the auto-picked font preview
 *  with a "Style: Suggested" / "Style: Customized" overline and a one-line
 *  description. The Customize button lives OUTSIDE the card so the card
 *  itself is purely a presentation of the current pick. */

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
  family, weight, letterSpacing, fontSize, lineHeight, fallback, textTransform,
  variationSettings, children,
}: {
  family: string;
  weight: string | number;
  letterSpacing: string | number;
  fontSize: number;
  lineHeight: number;
  fallback: 'serif' | 'sans-serif';
  textTransform?: TextCase;
  /** Variable-font axes, for the Google Sans Flex Header face. */
  variationSettings?: string;
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
        ...(variationSettings ? { fontVariationSettings: variationSettings } : {}),
      }}
    >
      {children}
    </div>
  );
}
