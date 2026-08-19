// Per-font available Google Fonts weights, generated from Google's own font
// metadata (fonts.google.com/metadata/fonts) and filtered to the studio's
// curated library. Lets us request ONLY the weights a font actually ships, so
// the css2 API never 400s the whole request over a single-weight display/script
// font (e.g. Great Vibes → [400]) while multi-weight fonts still load their real
// faces (e.g. Assistant → [200..800]).
import weightsMap from '../data/googleFontWeights.json';
import axesMap from '../data/googleFontAxes.json';

const MAP = weightsMap as Record<string, number[]>;

export interface FontAxis {
  tag: string;    // 'wght' | 'wdth' | 'slnt' | 'ital' | 'opsz' | …
  min: number;
  max: number;
  default: number;
}
const AXES = axesMap as Record<string, FontAxis[]>;

/** Variable axes (with min/max/default) a Google Font exposes, or [] if it is
 *  not a variable font. Drives the fine-tune sliders. */
export function axesFor(family: string): FontAxis[] {
  return AXES[family] || [];
}

/** Standard weights (100..900) a Google Font actually offers, or [] if unknown. */
export function weightsFor(family: string): number[] {
  return MAP[family] || [];
}

/**
 * Build a css2 `family=Name[:wght@…]` param that requests only weights the font
 * has. `desired` limits the request to the weights you actually render (falling
 * back to 400 if none of them are available); omit it to load every available
 * weight. Unknown fonts fall back to the bare family (the font's regular face),
 * which always loads.
 */
export function fontFamilyParam(family: string, desired?: number[]): string {
  const url = encodeURIComponent(family).replace(/%20/g, '+');
  const avail = weightsFor(family);
  if (avail.length === 0) return `family=${url}`;
  let wts = avail;
  if (desired && desired.length) {
    const inter = desired.filter((w) => avail.includes(w));
    wts = inter.length ? inter : [avail.includes(400) ? 400 : avail[0]];
  }
  return `family=${url}:wght@${[...new Set(wts)].sort((a, b) => a - b).join(';')}`;
}
