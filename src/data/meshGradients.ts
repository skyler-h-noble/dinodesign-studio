import type { MeshGradient } from '../utils/meshGradient';

/**
 * Meshes authored so far, keyed by design system id.
 *
 * A mesh is hand-tuned per system — the stop positions are the whole point,
 * and nothing derives them from the tone scale. They arrive as pasted CSS
 * rules, so they live here in parsed form until they are written to Firestore,
 * rather than only in a chat log.
 *
 * This is a SEED, not the source of truth. Once `setMeshGradient` has written
 * one, `designSystems/{id}.meshGradient` is what counts; this table exists so
 * the authored values survive until then and can be replayed if a document is
 * ever rebuilt.
 *
 * Only `background` and `color` are kept. The pasted rules also carry the
 * card's 800x450 box, its text layout and a font family — none of which belong
 * to the mesh. The font in particular differs per system (Righteous, Anton,
 * Raleway) precisely because it is the system's own type role, not part of the
 * gradient.
 */
export const SEED_MESH_GRADIENTS: Record<string, MeshGradient> = {
  // Popsicle
  'd7ad345c-33d7-43f6-8f30-41728bf395e6': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Primary-Color-7) 0%, transparent 50%), '
      + 'radial-gradient(circle at 78% 64%, var(--Secondary-Color-7) 0%, transparent 45%), '
      + 'radial-gradient(circle at 30% 18%, var(--Primary-Color-9) 0%, transparent 45%), '
      + 'radial-gradient(circle at 21% 50%, var(--Tertiary-Color-6) 0%, transparent 45%), '
      + 'radial-gradient(circle at 0% 0%, var(--Primary-Color-9) 0%, transparent 45%), '
      + 'var(--Primary-Color-7)',
    color: 'var(--BW-Color-6)',
  },

  // Surf's Up
  'a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Neutral-Color-12) 0%, transparent 50%), '
      + 'radial-gradient(circle at 80% 31%, var(--Secondary-Color-9) 0%, transparent 45%), '
      + 'radial-gradient(circle at 0% 23%, var(--Tertiary-Color-7) 0%, transparent 45%), '
      + 'var(--Neutral-Color-12)',
    color: 'var(--BW-Color-6)',
  },

  'd1bd0ba4-4906-4801-93c3-49db251f10d2': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Neutral-Color-12) 0%, transparent 50%), '
      + 'radial-gradient(circle at 99% 24%, var(--Secondary-Color-9) 0%, transparent 45%), '
      + 'radial-gradient(circle at 11% 1%, var(--Primary-Color-6) 0%, transparent 32%), '
      + 'var(--Neutral-Color-12)',
    color: 'var(--BW-Color-6)',
  },
};
