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

export type { MeshGradient } from './meshGradientCSS';
export { parseMeshGradient, generateMeshGradientCSS } from './meshGradientCSS';

import type { MeshGradient } from './meshGradientCSS';
import { parseMeshGradient, generateMeshGradientCSS } from './meshGradientCSS';

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
