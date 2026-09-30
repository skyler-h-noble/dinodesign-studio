// inputMetrics.ts — the input's derived geometry, per device and size.
//
// Four things Figma cannot work out for itself, because it cannot do
// arithmetic on a variable. The browser gets all of them free: an `outline` is
// drawn concentric with the border-radius it surrounds, and auto-layout would
// stretch an in-field button to the height it is given. Figma has to be told.
//
// Same reasoning as Accordion-Focus-Radius, which exists for exactly this and
// says so: "CSS needs neither of these... Figma cannot do arithmetic on a
// variable, so the two values have to be stated."
//
// ── Why these vary by DEVICE as well as by size ─────────────────────────────
//
// The input's height IS the button's height — Input.js binds
// var(--Small-Button-Height) / var(--Button-Height) / var(--Large-Button-Height)
// directly — and those differ per platform. The radius is a PERCENT of that
// height, so it differs too, and everything derived from it follows. Desktop
// 32/40/48, iOS 32/44/50 and Android 32/48/56 produce three different ladders
// from one brand percentage.
//
// This is unlike Button-Height itself, where the platform columns are
// hand-authored because Apple's 44 and Google's 48 are specs no brand ratio
// reproduces. Here the platform values ARE derivable — the brand's percentage
// applied to a known height — so all seven devices are written rather than
// Desktop alone.

import { pctRadius } from './componentRadii';

/** Heights for one device, in the order the size modes use. */
export interface FieldHeights { small: number; medium: number; large: number }

/**
 * The in-field button sits inside the field's content box with the focus ring
 * between it and the border.
 *
 *   field = border + ring + button + ring + border
 *
 * RING is the offset plus the stroke the lib actually draws — `outline: 2px
 * solid` at `outlineOffset: 2px` — so four pixels a side. Stated here rather
 * than taken from `focus()` in componentRadii, which adds 3: that constant
 * and the drawn offset have disagreed since the ring was written, and the
 * geometry has to follow what is on screen rather than what a token claims.
 */
export const INPUT_BUTTON_RING = 4;
export const INPUT_BORDER = 1;

/** How far the focus ring's corner sits from the button's, in radius terms. */
export const INPUT_FOCUS_OFFSET = 2;

/**
 * A floating field is a standard field plus one line for the shrunk label.
 *
 * Everything else — padding, borders, the input text's own leading — is
 * already inside the standard height, so the label line is the whole
 * difference. Derived rather than the hardcoded 48/56/64 the lib carries,
 * which track neither the platform nor the brand.
 *
 * The label's leading is the caller's, because it is computed per platform:
 * Desktop takes what the scale declares, the mobile devices take Apple's and
 * Material's tables. So a floating field is a few pixels shorter on iOS than
 * on Desktop, which is consistent with how every other leading behaves here.
 */
export interface InputMetricsInput {
  heights: FieldHeights;
  /** The brand's input radius, as a percent of the field height. */
  inputRadiusPct: number;
  /** Shrunk-label line height for this device, per size. */
  labelLeading: FieldHeights;
}

const SIZE_SUFFIX = { small: 'Small', medium: 'Medium', large: 'Large' } as const;

/** Every input variable one device column carries, keyed by its Figma name. */
export function inputMetrics(m: InputMetricsInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const size of ['small', 'medium', 'large'] as const) {
    const S = SIZE_SUFFIX[size];
    const field = m.heights[size];

    /* The field's own radius, as the CSS computes it. Recomputed here would be
       a second implementation; pctRadius is the same helper componentRadii
       uses, so the two cannot answer differently. */
    const inputR = pctRadius(m.inputRadiusPct, field);

    /* Concentric: the button sits `border + ring` inside the field, so its
       corner is that much tighter. Floors at 0 — a field rounder than its
       inset cannot give the button a negative corner. */
    const buttonR = Math.max(0, inputR - INPUT_BORDER - INPUT_BUTTON_RING);
    out[`Input-Button-Radius-${S}`] = buttonR;
    out[`Input-Button-Focus-Radius-${S}`] = buttonR + INPUT_FOCUS_OFFSET;

    const floating = field + m.labelLeading[size];
    out[`Floating-Input-${S}`] = floating;

    const floatingR = pctRadius(m.inputRadiusPct, floating);
    out[`Floating-Input-Radius-${S}`] = floatingR;
    out[`Floating-Input-Focus-Radius-${S}`] = floatingR + INPUT_FOCUS_OFFSET;
  }
  return out;
}

/** The names this writes, for a test that every device carries the same set. */
export function inputMetricNames(): string[] {
  return Object.keys(inputMetrics({
    heights: { small: 32, medium: 40, large: 48 },
    inputRadiusPct: 27,
    labelLeading: { small: 16, medium: 20, large: 24 },
  })).sort();
}

/**
 * The shrunk floating label's sizes.
 *
 * 12 / 14 / 16 rather than the 11 / 12 / 14 the lib currently draws, because
 * 11 and 12 land where both platform leading tables are at their coarsest:
 * Material gives BOTH of them a 16px line (its anchors are 11->16 and 12->16),
 * so the two steps collapse vertically on Android, while Apple jumps 13 -> 16
 * across the same 1px and over-separates them. 12 / 14 / 16 is monotonic on
 * both and on the 4px grid at Desktop.
 */
export const FLOATING_LABEL_SIZES: FieldHeights = { small: 12, medium: 14, large: 16 };

/** Desktop's leading for those sizes — declared, not computed, the way every
 *  Desktop leading is. 1.33 / 1.43 / 1.50: tighter than Body at the small end,
 *  which is right for a single line that never wraps, easing toward 1.5. */
const FLOATING_LABEL_DESKTOP_LEADING: Record<number, number> = { 12: 16, 14: 20, 16: 24 };

/**
 * The line a shrunk label occupies on one platform.
 *
 * Desktop takes the declared value; everything else takes the platform's own
 * table, exactly as type leading does. That means a floating field is a few
 * pixels shorter on iOS than on Desktop — consistent with how every other
 * leading behaves here, rather than a special case.
 */
export function floatingLabelLeading(
  family: 'apple' | 'material' | 'desktop',
  size: number,
  systemLeading: (f: 'apple' | 'material' | 'desktop', s: number) => number,
): number {
  return family === 'desktop'
    ? FLOATING_LABEL_DESKTOP_LEADING[size] ?? Math.round(size * 1.5)
    : systemLeading(family, size);
}
