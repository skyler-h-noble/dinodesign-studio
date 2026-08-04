// Browser-side Figma REST API client. Used by the admin-only Figma-to-Code
// dev tool. For Phase 2 (paid customers), these calls will move to a Cloud
// Function so the user's Figma token doesn't sit in browser localStorage —
// but for the internal dev tool, browser storage is acceptable.

export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string;
}

/** Parse a Figma URL like
 *    https://www.figma.com/design/abc123/Foo?node-id=6883-29407
 *  into { fileKey, nodeId } with nodeId normalized to colon form. */
export function parseFigmaUrl(url: string): FigmaUrlParts | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/(?:design|file)\/([^/]+)\//);
    if (!m) return null;
    const fileKey = m[1];
    const nodeIdRaw = u.searchParams.get('node-id');
    if (!nodeIdRaw) return null;
    const nodeId = nodeIdRaw.replace(/-/g, ':');
    return { fileKey, nodeId };
  } catch {
    return null;
  }
}

/** Fetch the node tree for a single frame. Returns the raw Figma API JSON
 *  for the node (including children, fills, strokes, layout, etc.). */
export async function fetchFigmaNode(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<any> {
  // plugin_data=shared makes the response include each node's sharedPluginData,
  // which is where the DinoDesign plugin's "Export to Code" step stamps the
  // resolved theme/surface/effect/sizing notes (namespace "dino", key "aaid").
  // This is how we get real Figma modes WITHOUT the Enterprise Variables API.
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&plugin_data=shared`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    throw new Error(`Figma API ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }
  const json = await res.json();
  const node = json.nodes?.[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found in file ${fileKey}.`);
  return node.document;
}

/** Fetch a rendered PNG of the frame at the given scale. */
export async function fetchFigmaImage(
  fileKey: string,
  nodeId: string,
  token: string,
  scale = 2,
): Promise<string> {
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    throw new Error(`Figma image API ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }
  const json = await res.json();
  const imgUrl = json.images?.[nodeId];
  if (!imgUrl) throw new Error('No image URL returned.');
  return imgUrl;
}

/** Fetch variables defined in the file (token bindings). Returns a flat
 *  map of { variableId: { name, resolvedValue } } the prompt can reference
 *  when matching tokens. Requires the file to use Figma variables (newer
 *  files). For files using older Figma styles, returns an empty map. */
export async function fetchFigmaVariables(
  fileKey: string,
  token: string,
): Promise<Record<string, { name: string; type: string; value: unknown }>> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
      headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const out: Record<string, { name: string; type: string; value: unknown }> = {};
    const vars = json.meta?.variables ?? {};
    for (const [id, v] of Object.entries<any>(vars)) {
      out[id] = {
        name: v.name,
        type: v.resolvedType,
        value: v.valuesByMode ? Object.values(v.valuesByMode)[0] : null,
      };
    }
    return out;
  } catch {
    return {};
  }
}
