/**
 * Getting a hero back into the studio to edit it — the same three ways in as
 * a chart (see chartShare.ts), one format: the hero spec.
 *
 *   a link      …/add-ons/hero/<id>#spec=<base64url JSON>   (the Figma plugin opens these)
 *   the HTML    <section class="omni-hero" data-omni-hero="…">  (pasted from code)
 *   the spec    { "version": "hero1", … }                    (the Export tab)
 *
 * The photo does not come back: the code points at the user's own file and
 * the Figma frame holds its own fill, so it is dropped in again.
 */
import { encodeChartSpec, decodeChartSpec } from '../charts/chartShare';
import { HERO_SPEC_VERSION } from './heroSpec';

export const encodeHeroSpec = encodeChartSpec;

const unescapeHtml = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Whatever was pasted, as a hero spec. Throws with a sentence a person can act on. */
export function extractHeroSpec(text: string): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('Paste a hero first: its link, its HTML, or its spec.');
  let spec: unknown;
  const frag = t.match(/[#&]spec=([A-Za-z0-9_-]+)/);
  const attr = t.match(/data-omni-hero="([^"]*)"/);
  try {
    if (frag) spec = decodeChartSpec(frag[1]);
    else if (attr) spec = JSON.parse(unescapeHtml(attr[1]));
    else if (t.startsWith('{')) spec = JSON.parse(t);
    else throw new Error('shape');
  } catch (e) {
    if ((e as Error).message === 'shape') throw new Error('That does not look like a hero: paste its link, its HTML, or its spec.');
    throw new Error('That hero could not be read — it may have been cut off when copying.');
  }
  if (!spec || typeof spec !== 'object' || (spec as { version?: unknown }).version !== HERO_SPEC_VERSION) {
    throw new Error('That is not a Hero Generator spec — a chart\'s spec goes in the Charts add-on.');
  }
  return spec as Record<string, unknown>;
}
