/**
 * The six surface levels a theme exposes, derived from its Surface tone.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Themes used to come in pairs: Primary and Primary-Light, Secondary and
 * Secondary-Light, and so on. Measured across shipped systems, every one of the
 * seven `-Light` themes held the IDENTICAL tone window (9-10-11-12) and all four
 * state themes held another (3-4-5-6). Nothing selected between them — the
 * palette was already the selector — so eighteen themes were really two axes
 * enumerated as one flat list, and Figma's ten-mode limit was being spent on the
 * duplication rather than on colour.
 *
 * Widening each theme from four levels to five absorbs `-Light` into the theme it
 * belongs to, which is what frees the mode slots for Info/Success/Warning/Error.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 * Anchored at both ends, relative in the middle, and squeezed when the Surface
 * sits near an extreme:
 *
 *   Dimmest    3, unless Dim has reached it — then Dim-1, then black
 *   Dim        S-1
 *   Surface    S
 *   Bright     S+1
 *   Brightest  11, unless Bright has reached it — then 12, then white
 *
 * Brightest lands on 11 because that is the tone `<Palette>-Light`'s Surface
 * used, so the replacement is the same colour rather than an approximation of it.
 *
 * ── Paint is not the same as index ─────────────────────────────────────────
 * A level can PAINT black or white while still being INDEXED by a tone. That is
 * not a convenience: every foreground table — Text, Quiet, Header, Border,
 * Eyebrow, Focus-Visible — is keyed by the background's tone, so a surface with
 * no index has nothing to look up, and decoupling the index from the surface
 * invalidates all of them at once. Hence `toneIndex` alongside `paint`.
 *
 * Both anchors are safe to paint: contrast is monotonic in background lightness,
 * so painting white where tone 12 was indexed can only RAISE contrast with dark
 * foregrounds, and black where tone 1 was indexed can only raise it with light
 * ones. Measured, the gain is +0.14 to +0.52 — nothing that passed can fail.
 */

export const SURFACE_LEVELS = [
  'Surface-Dimmest',
  'Surface-Dim',
  'Surface',
  'Surface-Bright',
  'Surface-Brightest',
] as const;

export type SurfaceLevel = (typeof SURFACE_LEVELS)[number];

/** What a level paints. `black` and `white` are the palette-independent
 *  anchors used when the ramp runs out at either end. */
export type SurfacePaint =
  | { kind: 'tone'; tone: number }
  | { kind: 'black' }
  | { kind: 'white' };

export interface SurfaceStep {
  level: SurfaceLevel;
  paint: SurfacePaint;
  /** The tone every foreground table is keyed by for this level. Equals the
   *  painted tone, or 1 for black / 12 for white. */
  toneIndex: number;
}

/**
 * Surface tones this rule can express as five distinct ascending levels.
 *
 * Below 2 there is no room beneath Surface; above 11 there is none above it.
 * Real extracted tones sit between 5 and 9, so the guard should never fire —
 * and if it does, that is a genuine problem worth stopping for. Silently
 * clamping would emit a Color-13 that resolves to nothing and paints
 * transparent, which is the failure this throw exists to prevent.
 */
export const MIN_SURFACE_TONE = 2;
export const MAX_SURFACE_TONE = 11;

const toneStep = (level: SurfaceLevel, tone: number): SurfaceStep =>
  ({ level, paint: { kind: 'tone', tone }, toneIndex: tone });
const blackStep = (level: SurfaceLevel): SurfaceStep =>
  ({ level, paint: { kind: 'black' }, toneIndex: 1 });
const whiteStep = (level: SurfaceLevel): SurfaceStep =>
  ({ level, paint: { kind: 'white' }, toneIndex: 12 });

export function surfaceWindow(surfaceTone: number): SurfaceStep[] {
  if (!Number.isInteger(surfaceTone)
    || surfaceTone < MIN_SURFACE_TONE
    || surfaceTone > MAX_SURFACE_TONE) {
    throw new RangeError(
      `surfaceWindow: Surface tone ${surfaceTone} cannot carry six levels ` +
      `(expected ${MIN_SURFACE_TONE}-${MAX_SURFACE_TONE}). ` +
      'Clamping here would emit an out-of-range Color-N that resolves to nothing.',
    );
  }

  // ── dark end ──────────────────────────────────────────────────────────
  const dimTone = surfaceTone - 1;
  const dim = dimTone < 1 ? blackStep('Surface-Dim') : toneStep('Surface-Dim', dimTone);
  let dimmest: SurfaceStep;
  if (dim.paint.kind !== 'tone' || dim.paint.tone === 1) {
    dimmest = blackStep('Surface-Dimmest');           // nothing below tone 1
  } else if (dim.paint.tone <= 3) {
    dimmest = toneStep('Surface-Dimmest', dim.paint.tone - 1);  // squeeze under Dim
  } else {
    dimmest = toneStep('Surface-Dimmest', 3);         // locked
  }

  // ── light end, the mirror image ───────────────────────────────────────
  const brightTone = surfaceTone + 1;
  const bright = brightTone > 12 ? whiteStep('Surface-Bright') : toneStep('Surface-Bright', brightTone);

  let brightest: SurfaceStep;
  if (bright.paint.kind !== 'tone') {
    brightest = whiteStep('Surface-Brightest');       // Bright already ran out
  } else if (bright.paint.tone >= 12) {
    brightest = whiteStep('Surface-Brightest');       // 12 taken, only white left
  } else if (bright.paint.tone >= 11) {
    brightest = toneStep('Surface-Brightest', 12);    // 11 taken, step to 12
  } else {
    brightest = toneStep('Surface-Brightest', 11);    // the -Light Surface tone
  }

  return [dimmest, dim, toneStep('Surface', surfaceTone), bright, brightest];
}

/**
 * Neutral's window is LOCKED rather than derived — it is the theme that replaces
 * the old White / Light-Gray / Black themes, so it has to span the whole scale
 * instead of sitting in a four-tone band. Those three collapse into one because
 * White and Light-Gray already shipped identical container definitions; only the
 * dark end differed.
 */
export function neutralSurfaceWindow(): SurfaceStep[] {
  return [
    blackStep('Surface-Dimmest'),
    toneStep('Surface-Dim', 9),
    toneStep('Surface', 10),
    toneStep('Surface-Bright', 11),
    whiteStep('Surface-Brightest'),
  ];
}
