/**
 * Getting a share image back into the studio, and starting one from a hero.
 *
 *   a link      …/add-ons/share/<id>#spec=<base64url JSON>
 *   the spec    { "version": "share1", … }                   (the Export tab)
 *   a hero      its spec, its link or its HTML — it becomes the share image's
 *               background and text, ready to size (buttons dropped)
 *
 * The photo does not come back, as with a hero: drop it in again.
 */
import { encodeChartSpec, decodeChartSpec } from '../charts/chartShare';
import { HERO_SPEC_VERSION } from '../hero/heroSpec';
import { SHARE_SPEC_VERSION } from './shareSpec';

export const encodeShareSpec = encodeChartSpec;

const unescapeHtml = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Whatever was pasted, as a share or hero spec. Throws with a sentence a person can act on. */
export function extractShareSpec(text: string): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('Paste a share image\'s spec or link — or a hero\'s, to start from it.');
  let spec: unknown;
  const frag = t.match(/[#&]spec=([A-Za-z0-9_-]+)/);
  const attr = t.match(/data-omni-hero="([^"]*)"/);
  try {
    if (frag) spec = decodeChartSpec(frag[1]);
    else if (attr) spec = JSON.parse(unescapeHtml(attr[1]));
    else if (t.startsWith('{')) spec = JSON.parse(t);
    else throw new Error('shape');
  } catch (e) {
    if ((e as Error).message === 'shape') throw new Error('That does not look like a share image or a hero: paste its spec, its link, or a hero\'s HTML.');
    throw new Error('That could not be read — it may have been cut off when copying.');
  }
  const v = spec && typeof spec === 'object' ? (spec as { version?: unknown }).version : undefined;
  if (v !== SHARE_SPEC_VERSION && v !== HERO_SPEC_VERSION) {
    throw new Error('That is not a Share Images or Hero Generator spec.');
  }
  return spec as Record<string, unknown>;
}
