/**
 * A bento back into the studio to edit it — the same three ways in as a chart
 * or a hero: a link (#spec=), the exported HTML (data-omni-bento), or the spec.
 * Only bentos made by the add-on carry their spec, so only those reopen.
 */
import { encodeChartSpec, decodeChartSpec } from '../charts/chartShare';
import { BENTO_SPEC_VERSION } from './bentoSpec';

export const encodeBentoSpec = encodeChartSpec;

const unescapeHtml = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function extractBentoSpec(text: string): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('Paste a bento first: its link, its HTML, or its spec.');
  let spec: unknown;
  const frag = t.match(/[#&]spec=([A-Za-z0-9_-]+)/);
  const attr = t.match(/data-omni-bento="([^"]*)"/);
  try {
    if (frag) spec = decodeChartSpec(frag[1]);
    else if (attr) spec = JSON.parse(unescapeHtml(attr[1]));
    else if (t.startsWith('{')) spec = JSON.parse(t);
    else throw new Error('shape');
  } catch (e) {
    if ((e as Error).message === 'shape') throw new Error('That does not look like a bento: paste its link, its HTML, or its spec.');
    throw new Error('That bento could not be read — it may have been cut off when copying.');
  }
  if (!spec || typeof spec !== 'object' || (spec as { version?: unknown }).version !== BENTO_SPEC_VERSION) {
    throw new Error('That is not a Bento Grid spec — only bentos made with the add-on carry one.');
  }
  return spec as Record<string, unknown>;
}
