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
      'radial-gradient(circle at 0% 0%, var(--Primary-Color-10) 0%, transparent 66%), '
      + 'radial-gradient(circle at 80% 100%, var(--Secondary-Color-8) 0%, transparent 36%), '
      + 'radial-gradient(circle at 26% 23%, var(--Primary-Color-7) 0%, transparent 45%), '
      + 'radial-gradient(circle at 2% 50%, var(--Tertiary-Color-9) 0%, transparent 45%), '
      + 'radial-gradient(circle at 100% 72%, var(--Primary-Color-9) 0%, transparent 55%), '
      + 'var(--Primary-Color-10)',
    color: 'var(--BW-Color-6)',
  },


  // Chocolate — two stops. Authored deliberately sparse; the base colour repeats
  // the first stop, so the field reads as one wash rather than a mesh of blobs.
  'b36585cd-f290-4a74-9749-4ae99e1986c0': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Primary-Color-3) 0%, transparent 50%), '
      + 'radial-gradient(circle at 80% 70%, var(--Secondary-Color-4) 0%, transparent 45%), '
      + 'var(--Primary-Color-3)',
    color: 'var(--BW-Color-1)',
  },

  // Surf's Up
  'a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Neutral-Color-12) 0%, transparent 50%), '
      + 'radial-gradient(circle at 100% 54%, var(--Secondary-Color-9) 0%, transparent 48%), '
      + 'radial-gradient(circle at 0% 23%, var(--Tertiary-Color-7) 0%, transparent 45%), '
      + 'var(--Neutral-Color-12)',
    color: 'var(--BW-Color-6)',
  },

  'd1bd0ba4-4906-4801-93c3-49db251f10d2': {
    background:
      'radial-gradient(circle at 20% 30%, var(--Primary-Color-11) 0%, transparent 50%), '
      + 'radial-gradient(circle at 100% 3%, var(--Secondary-Color-9) 0%, transparent 45%), '
      + 'radial-gradient(circle at 0% 19%, var(--Primary-Color-7) 0%, transparent 45%), '
      + 'radial-gradient(circle at 78% 100%, var(--Primary-Color-8) 0%, transparent 55%), '
      + 'var(--Primary-Color-11)',
    color: 'var(--BW-Color-6)',
  },
};
