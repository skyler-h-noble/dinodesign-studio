/**
 * Adaptive alpha for the "-Variant" tokens (Border-Variant, Icon-Variant).
 *
 * A variant is its base colour at reduced opacity. A FLAT alpha does not read
 * consistently, because what the eye registers is the luminance shift the
 * overlay produces — roughly `alpha × |L(colour) − L(background)|`. Where the
 * variant colour sits close to its background that product collapses and the
 * token becomes invisible; where they are far apart it reads heavy.
 *
 * Measured across all 324 theme × surface contexts at a flat 20%, the perceived
 * shift ranged 0.0125 → 0.3421 — a 27× spread. The Black theme's border was
 * effectively invisible while Success containers were strong.
 *
 * So alpha adapts: the base is a FLOOR, raised as the colour approaches its
 * background, capped so it can never become opaque.
 *
 *   targetShift = baseAlpha × 0.5      calibrated for a mid-luminance pairing
 *   required    = targetShift / |L(colour) − L(background)|
 *   alpha       = clamp(required, baseAlpha, cap)
 *
 * This restores the semantics of the `adaptiveAlpha` helper that used to live in
 * accessibilityReport.ts for button hover/active, which has since been removed.
 *
 * With base 0.20 this yields alpha 0.20–0.41 and narrows the spread to ~15×.
 * It only lifts the weak end — a wide-gap pairing keeps its strong shift,
 * because the base is a floor and never lowers. Making it a target instead
 * (lowering as well as raising) measured no better, so the floor is kept for
 * being the more predictable of the two.
 *
 * NOTE: variants are exempt from contrast requirements — Border-Variant is a
 * decorative divider and Icon-Variant a de-emphasised icon — so alpha here is a
 * purely visual control and cannot affect the accessibility audit.
 */

/** Per-token base alpha. TUNABLE. */
export const BORDER_VARIANT_ALPHA = 0.20;
export const ICON_VARIANT_ALPHA = 0.50;

/** Never let a variant become effectively opaque. */
const ALPHA_CAP = 0.95;

function toRgb(hex: string): [number, number, number] {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Alpha for `colorHex` overlaid on `backgroundHex`, floored at `baseAlpha`.
 * Falls back to the base when either colour is unusable.
 */
export function adaptiveVariantAlpha(
  baseAlpha: number,
  colorHex: string,
  backgroundHex?: string,
): number {
  if (!backgroundHex || !colorHex.startsWith('#') || !backgroundHex.startsWith('#')) {
    return baseAlpha;
  }
  const distance = Math.abs(luminance(colorHex) - luminance(backgroundHex));
  if (distance < 0.001) return ALPHA_CAP;   // indistinguishable — push to the cap
  const required = (baseAlpha * 0.5) / distance;
  return Math.min(ALPHA_CAP, Math.max(baseAlpha, required));
}

/** Two-digit hex for an alpha in 0..1. */
export function alphaToHex(alpha: number): string {
  return Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16).padStart(2, '0');
}

/**
 * 8-digit `#RRGGBBAA` for a variant token. Pass the background it will sit on
 * to get the adaptive alpha; omit it to fall back to the flat base.
 */
export function variantHex8(
  colorHex: string,
  baseAlpha: number,
  backgroundHex?: string,
): string {
  const rgb = String(colorHex).slice(0, 7);
  return `${rgb}${alphaToHex(adaptiveVariantAlpha(baseAlpha, colorHex, backgroundHex))}`;
}
