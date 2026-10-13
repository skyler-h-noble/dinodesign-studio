/**
 * Getting a chart back into the studio without saving it anywhere.
 *
 * A chart already lives where it is used: the Figma build carries its spec on
 * the frame, and the exported HTML carries it on the <figure>. So the studio
 * never stores charts — it reads one back from whichever of these it is
 * handed, the user edits it, and it is rebuilt or re-exported.
 *
 * Three ways in, one format: the spec JSON.
 *   a link      …/add-ons/charts/<id>#spec=<base64url JSON>   (the Figma plugin opens these)
 *   the HTML    <figure class="omni-chart" data-omni-spec="…">  (pasted from code)
 *   the spec    { "version": "chart1", … }                     (the Export to Figma tab)
 *
 * The spec rides in the URL's fragment, which the browser never sends to a
 * server: no length limit worth worrying about, and nothing logged.
 */

/** The spec as URL-safe base64 of its UTF-8 JSON. */
export function encodeChartSpec(spec: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeChartSpec(token: string): unknown {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const unescapeHtml = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/**
 * Whatever was pasted — a link, the exported HTML, or the spec itself — as a
 * spec object. Throws with a sentence a person can act on.
 */
export function extractChartSpec(text: string): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('Paste a chart first: its link, its HTML, or its spec.');

  const frag = t.match(/[#&]spec=([A-Za-z0-9_-]+)/);
  if (frag) {
    try { return decodeChartSpec(frag[1]) as Record<string, unknown>; }
    catch { throw new Error('That link\'s chart could not be read — it may have been cut off when copying.'); }
  }

  const attr = t.match(/data-omni-spec="([^"]*)"/);
  if (attr) {
    try { return JSON.parse(unescapeHtml(attr[1])); }
    catch { throw new Error('The chart in that HTML could not be read — copy the whole <figure> again.'); }
  }

  if (t.startsWith('{')) {
    try { return JSON.parse(t); }
    catch { throw new Error('That spec is not valid JSON — it may have been cut off when copying.'); }
  }

  if (/<figure[^>]*omni-chart/.test(t)) {
    throw new Error('That chart was exported before charts carried their spec. Export it again from the studio, or paste its spec from the Export to Figma tab.');
  }
  throw new Error('That does not look like a chart: paste its link, its HTML, or its spec.');
}
