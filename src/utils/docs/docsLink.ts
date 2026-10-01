/**
 * The public URL of one component's reference page.
 *
 * Per DESIGN SYSTEM, not per component library: every user imports their own
 * copy of the .fig and gets their own uuid, so a link baked into the template
 * would send all of them to whoever built it.
 *
 * That splits the two Figma fields:
 *
 *   description          generic. Identical for every user, so it can live in
 *                        the template and be written once.
 *   documentationLinks   per user. The plugin writes it at import time, when it
 *                        knows the design system id and nothing else does.
 *
 * Any path resolves on the host — `public/_redirects` is `/* /index.html 200`,
 * a catch-all that hands every URL to the router — so this needs no server
 * configuration and no anchor.
 */

export const DOCS_ORIGIN = 'https://omni-design.netlify.app';

/** A component name as it appears in a URL. */
export function docsSlug(component: string): string {
  return component.trim().replace(/\s+/g, '-');
}

/**
 * Where one component's docs live for one design system.
 *
 * A path per component rather than an anchor on a single long page: an anchor
 * depends on the page rendering headings a browser can jump to, and the
 * existing /api/tokens/:uuid/md route serves its content into a <pre>, which
 * has none. A path cannot half-work.
 */
export function componentDocsUrl(
  designSystemId: string,
  component: string,
  origin: string = DOCS_ORIGIN,
): string {
  return `${origin.replace(/\/+$/, '')}/docs/${encodeURIComponent(designSystemId)}/${docsSlug(component)}`;
}

/** The index of every component, for the same design system. */
export function componentDocsIndexUrl(
  designSystemId: string,
  origin: string = DOCS_ORIGIN,
): string {
  return `${origin.replace(/\/+$/, '')}/docs/${encodeURIComponent(designSystemId)}`;
}
