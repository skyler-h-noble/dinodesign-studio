import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/client';
import { uploadDesignSystemFile, getPublicFileUrl } from './firebase/storage';

/**
 * Per-design-system mesh gradient.
 *
 * Unlike everything else the studio emits, this is AUTHORED rather than
 * derived — one mesh hand-tuned per system. The stop positions are the whole
 * point of a mesh, and no rule over the tone scale produces them; two systems
 * with the same palette can want completely different meshes.
 *
 * What is stored is the BACKGROUND STACK alone, not a finished rule. Every
 * consumer — the hero, the text-over-gradient card, anything added later —
 * reads it through one custom property, so a mesh cannot end up applied to the
 * card and not the hero, or drift between them after an edit. That is the
 * failure this shape exists to prevent: the pasted CSS came as a `.gradient-
 * figure` rule with the stack, the size, the text layout and two font families
 * fused together, and copying it to a second consumer would have duplicated
 * all four.
 *
 * Follows the entitlements pattern:
 *   1. Source of truth: Firestore — `designSystems/{id}.meshGradient`
 *   2. Public file: Storage — `${id}/mesh-gradient.css`, so the hosted
 *      environment can load it without auth or a full re-export.
 */

const MESH_FILENAME = 'mesh-gradient.css';

export interface MeshGradient {
  /** The layered background value: the radial-gradient stack plus its base. */
  background: string;
  /** Foreground colour for text sitting on the mesh. A token, not a hex. */
  color?: string;
}

/**
 * Accept either a bare background value or a whole pasted CSS rule.
 *
 * The mesh is authored in a browser dev-tools panel and arrives as a full
 * `.gradient-figure { ... }` block. Requiring the value to be extracted by
 * hand first is how a trailing brace or a missing semicolon ends up inside the
 * stored string, where it silently invalidates the whole declaration — a CSS
 * parser drops the property and paints nothing, with no error anywhere.
 */
export function parseMeshGradient(input: string): MeshGradient | null {
  const src = (input || '').trim();
  if (!src) return null;

  const pick = (prop: string): string | null => {
    // Match `prop: <value>;` at a declaration boundary, so `background` does
    // not also match `background-color` or the `-color` half of it.
    const re = new RegExp(`(?:^|[{;\\s])${prop}\\s*:\\s*([^;}]+)`, 'i');
    const m = src.match(re);
    return m ? m[1].trim() : null;
  };

  const background = src.includes('{') || /background\s*:/i.test(src)
    ? pick('background')
    : src;
  if (!background) return null;

  const color = pick('color');
  return { background, ...(color ? { color } : {}) };
}

/**
 * The CSS a system publishes for its mesh.
 *
 * The stack is declared ONCE as a custom property and every consumer reads it.
 * Sizing and type deliberately stay out: a hero is full-bleed and a card is
 * not, so baking the card's 800x450 into the shared value would make the hero
 * wrong, and baking its font families in would override whatever typography
 * the system actually chose.
 */
export function generateMeshGradientCSS(mesh: MeshGradient): string {
  const color = mesh.color || 'var(--Text)';
  return `/* Mesh gradient — authored per design system, not derived.
   Consumers read --Mesh-Gradient rather than restating the stack, so the hero
   and the card cannot drift apart. */
:root {
  --Mesh-Gradient: ${mesh.background};
  --Mesh-Gradient-Text: ${color};
}

/* Any region that should carry the mesh. */
.mesh-gradient,
.gradient-figure,
.hero-mesh {
  background: var(--Mesh-Gradient);
  color: var(--Mesh-Gradient-Text);
}

/* The card is a fixed figure; the hero is not. Only the card constrains its
   own box, and it caps at the viewport so a narrow screen does not scroll
   sideways. */
.gradient-figure {
  position: relative;
  width: 800px;
  height: 450px;
  max-width: 100%;
}

/* Text sitting on the mesh. Type comes from the system's own roles — the
   authored mesh decides colour and position, never which face to set. */
.gradient-figure .gradient-text {
  position: absolute;
  left: 6%;
  top: 49.33%;
  width: 65.63%;
  height: 40%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
  text-align: left;
}

.gradient-figure .t-eyebrow {
  margin: 0;
  font-family: var(--Font-Family-Eyebrow);
  font-size: var(--Eyebrow-Large-Font-Size, 18px);
  font-weight: var(--Font-Weight-Eyebrow, 400);
  letter-spacing: var(--Eyebrow-Large-Letter-Spacing, 0.04em);
  line-height: 1.5;
}

.gradient-figure .t-title {
  margin: 0;
  font-family: var(--Font-Family-Header);
  font-size: var(--H2-Font-Size, 40px);
  font-weight: var(--Font-Weight-Header, 400);
  line-height: 1.2;
}
`;
}

/** Read a system's authored mesh, or null when it has none. */
export async function getMeshGradient(designSystemId: string): Promise<MeshGradient | null> {
  const snap = await getDoc(doc(db, 'designSystems', designSystemId));
  if (!snap.exists()) return null;
  const data = snap.data() as { meshGradient?: MeshGradient };
  return data.meshGradient ?? null;
}

/**
 * Save a mesh and publish its CSS.
 *
 * Firestore first, then the file — a published file the document does not
 * know about is worse than a document with no file, because a later save
 * would not notice it needed to overwrite one.
 */
export async function setMeshGradient(
  designSystemId: string,
  input: string | MeshGradient,
): Promise<string> {
  const mesh = typeof input === 'string' ? parseMeshGradient(input) : input;
  if (!mesh) throw new Error('No background value found in the mesh gradient input.');

  await updateDoc(doc(db, 'designSystems', designSystemId), {
    meshGradient: mesh,
    meshGradientUpdatedAt: serverTimestamp(),
  });
  await uploadDesignSystemFile(
    designSystemId,
    MESH_FILENAME,
    generateMeshGradientCSS(mesh),
    'text/css',
  );
  return getPublicFileUrl(designSystemId, MESH_FILENAME);
}
