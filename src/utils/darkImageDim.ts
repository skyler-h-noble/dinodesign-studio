/**
 * Dark-mode photo dimming — one definition for the CSS export and the preview
 * (invariant 5: they are separate implementations and must not drift).
 *
 * Photos get a 30% black overlay in dark mode so they don't glare against the
 * page (brightness(0.7) is the same as compositing #0000004D over opaque
 * pixels, and works on <img> without a wrapper).
 *
 * PHOTOS ONLY. It used to be every <img>, which also darkened logos, brand
 * marks and icons. Left at full brightness:
 *   - SVG images (logos and icons are almost always SVG),
 *   - anything inside a header, footer or nav landmark (where logos live),
 *   - anything marked data-no-dim, or an <img> marked data-logo.
 * Every exclusion sits in :where(), so the rule keeps the specificity of a
 * bare `img` and any app style still overrides it.
 */
const KEEP_IMG = ':where([src$=".svg"], [src*=".svg?"], [src^="data:image/svg"], [data-no-dim], [data-logo])';
/* Landmarks, not theme names: a bar's data-theme can sit on a large wrapper
   (the studio's phone frame is Brand-Nav-Bar end to end), which would exempt
   every photo inside it. */
const KEEP_INSIDE = ':where(header, footer, nav, [role="banner"], [role="contentinfo"], [data-no-dim]) img';

/** The selector for a dimmed photo, optionally inside `scope` (the preview's Brand region). */
export function darkPhotoSelector(scope?: string): string {
  const img = `img:not(${KEEP_IMG}):not(${KEEP_INSIDE})`;
  return scope ? `:where(${scope}) ${img}` : img;
}

export function darkPhotoDimCSS(scope?: string): string {
  return `/* Dark-mode photo treatment — photos only, never logos (see darkImageDim.ts).
   Opt an image out with data-no-dim (or data-logo); a whole region with data-no-dim. */
${darkPhotoSelector(scope)} {
  filter: brightness(0.7);
}
`;
}
