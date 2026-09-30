/**
 * A brand mark for the preview.
 *
 * ── Rendered as an IMAGE, never inlined ───────────────────────────────────
 * An SVG is a document, not a picture: it can carry <script>, event handlers,
 * <foreignObject> with arbitrary HTML, and references that fetch on load.
 * Inlining an uploaded one — dangerouslySetInnerHTML or anything equivalent —
 * runs all of that with the page's own origin and session.
 *
 * Loaded into an <img> it is treated as an image instead: scripts do not run,
 * external references are not fetched, and it cannot reach the document around
 * it. That is the whole mitigation, and it costs nothing here because a brand
 * mark only needs to be looked at. Anything that later needs the SVG's INSIDES
 * — recolouring paths with brand tokens, say — has to sanitise first, and this
 * comment is the reason why.
 *
 * ── And it does not go into the spec ──────────────────────────────────────
 * A published add-on is imported by every design system, so a brand baked into
 * one would put the author's logo in everyone's file. Brand is a SLOT for
 * exactly that reason. This fills the slot locally so the nav can be judged
 * with a real mark in it; nothing here reaches toAddonSpec.
 */

export interface BrandAsset {
  url: string;
  name: string;
  type: string;
}

/** Formats a brand mark is plausibly supplied in. SVG is the point; the raster
 *  formats are here because a logo often only exists as one. */
export const BRAND_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

/** Generous for a logo, small enough that a mis-picked photo is caught. */
export const MAX_BRAND_BYTES = 2 * 1024 * 1024;

export type BrandLoadResult =
  | { ok: true; asset: BrandAsset }
  | { ok: false; error: string };

export function loadBrandAsset(file: File): BrandLoadResult {
  if (!BRAND_TYPES.includes(file.type)) {
    /* Checked by type rather than extension: a .svg that is really something
       else would still be handed to the browser as whatever it is. */
    return { ok: false, error: `${file.name} is a ${file.type || 'unknown type'}. Use an SVG, PNG, JPEG or WebP.` };
  }
  if (file.size > MAX_BRAND_BYTES) {
    return {
      ok: false,
      error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. A brand mark should be under ${MAX_BRAND_BYTES / 1024 / 1024}MB — a larger file is usually a photo picked by mistake.`,
    };
  }
  return {
    ok: true,
    asset: { url: URL.createObjectURL(file), name: file.name, type: file.type },
  };
}

/** Object URLs hold their blob until revoked, so replacing a mark without
 *  releasing the previous one leaks it for the life of the page. */
export function releaseBrandAsset(asset: BrandAsset | null): void {
  if (asset) URL.revokeObjectURL(asset.url);
}
