/**
 * What the PLATFORM's own type looks like — the System half of the switch.
 *
 * Omni carries the user's choices. System carries Apple's and Google's, and
 * the two must actually differ or the switch shows nothing. An earlier pass
 * seeded both sides from the same numbers and changed only the font family,
 * which made "System" a relabelled Omni in a different face.
 *
 * ── What is grounded and what is shape ────────────────────────────────────
 *
 * WEIGHTS are published and unambiguous, and they are the biggest visible
 * difference. Material 3 sets headlines in Roboto REGULAR (400) and uses
 * Medium (500) for titles and labels; it has no 600. Apple sets headings in
 * Semibold (600) and body in Regular. A brand ramp that runs 600 across every
 * header is therefore a long way from both, and further from Material.
 *
 * TRACKING anchors are the published direction and magnitude, interpolated
 * between. They are honest about the SHAPE of each platform's curve — which
 * is the thing that differs — rather than claiming to reproduce every value in
 * Apple's eleven-row Dynamic Type table from memory. Treat them as a starting
 * point to be eyeballed, not as a citation.
 *
 * The shapes really are different, and that is the point:
 *
 *   Apple / SF Pro   negative through the TEXT range, tightest around 17px,
 *                    easing back toward zero as it grows. SF also swaps from
 *                    SF Text to SF Display at 20pt, which resets the tracking —
 *                    the curve here smooths across that rather than modelling
 *                    two faces.
 *
 *   Google / Roboto  POSITIVE at small sizes — Material tracks Body and Label
 *                    out, which is the opposite of Apple — crossing to zero
 *                    around the headline sizes and going slightly negative
 *                    only at Display.
 *
 * So a 12px label is tracked OUT on Android and IN on iOS. That single
 * disagreement is most of why a system-font mode is worth having.
 */

export type SystemFamily = 'apple' | 'material' | 'desktop';

/** Which platform's conventions a device follows. */
export const SYSTEM_FAMILY_OF: Record<string, SystemFamily> = {
  'Desktop': 'desktop',
  'IOS-Mobile': 'apple',
  'IOS-Tablet-Vertical': 'apple',
  'IOS-Tablet-Horizontal': 'apple',
  'Android-Mobile': 'material',
  'Android-Tablet-Vertical': 'material',
  'Android-Tablet-Horizontal': 'material',
};

/** The job a style does, which is what the platform specs are keyed by. */
export type TypeRole = 'display' | 'heading' | 'title' | 'body' | 'label';

/**
 * Style name → role.
 *
 * Matched on the name the stylesheet uses, longest-prefix first so
 * `Subtitle-Large` does not fall into `Subtitle`'s neighbour by accident.
 * Anything unmatched is body, which is the safe default: it is the role with
 * the most conservative weight and the least tracking.
 */
export function roleOf(style: string): TypeRole {
  if (/^Display/.test(style)) return 'display';
  if (/^H[1-6]$/.test(style)) return 'heading';
  if (/^Subtitle/.test(style)) return 'title';
  if (/^(Label|Overline|Eyebrow|Button|Caption|Legal)/.test(style)) return 'label';
  return 'body';
}

/**
 * The weight each platform sets a role in.
 *
 * Material's headline Regular is the surprising one and it is correct: M3
 * headlines are Roboto 400, not a bold. Its emphasis weight is Medium 500 and
 * it does not use 600 at all. Apple leans on Semibold 600 for headings and
 * Regular for running text.
 *
 * Desktop has no single system convention — the face is whatever the OS
 * supplies — so it keeps a neutral ramp rather than borrowing either
 * platform's.
 */
export const SYSTEM_WEIGHT: Record<SystemFamily, Record<TypeRole, number>> = {
  apple:    { display: 700, heading: 600, title: 600, body: 400, label: 500 },
  material: { display: 400, heading: 400, title: 500, body: 400, label: 500 },
  desktop:  { display: 600, heading: 600, title: 600, body: 400, label: 500 },
};

/**
 * Tracking anchors: [size in px, tracking in em], ascending by size.
 *
 * em rather than px so the value means the same thing wherever the size ramp
 * lands — the devices do not share one scale, and a px anchor would mean
 * something different on each.
 */
type Anchor = [number, number];

const SYSTEM_TRACKING: Record<SystemFamily, Anchor[]> = {
  /* Tightest through the text range, easing back as it grows. */
  apple: [
    [11, 0.006], [12, 0], [13, -0.006], [15, -0.015], [17, -0.025],
    [20, -0.019], [28, -0.013], [34, -0.011], [48, -0.009],
  ],
  /* Tracked OUT at small sizes, crossing zero around the headlines. */
  material: [
    [11, 0.045], [12, 0.04], [14, 0.018], [16, 0.031],
    [22, 0], [24, 0], [32, 0], [45, 0], [57, -0.004],
  ],
  /* Neutral: the OS face is unknown, so claiming a curve for it would be
     inventing one. Flat zero is the honest answer and leaves the brand's own
     Desktop tracking as the only opinion on that surface. */
  desktop: [[11, 0], [57, 0]],
};

/**
 * LEADING — the platform's own line heights, as published.
 *
 * Unlike the tracking anchors above, these are not a shape: they are the
 * literal tables. Apple's Dynamic Type at the default Large size, and Material
 * 3's type scale. Both quantise — Material to 4sp — which is why the RATIOS
 * look noisy (11->16 is 1.45, 12->16 is 1.33) and why the leading is
 * interpolated rather than the ratio.
 *
 *   Apple      34/41  28/34  22/28  20/25  17/22  16/21  15/20  13/18  12/16  11/13
 *   Material   57/64  45/52  36/44  32/40  28/36  24/32  22/28  16/24  14/20  12/16  11/16
 *
 * Both curves say the same thing and it is the thing worth knowing: the RATIO
 * falls as the size grows. 1.5 at body, ~1.2 at display. At 16px `x1.5` and
 * `+8px` are the same number; at 72px they are 108 and 80.
 *
 * Sources: Apple HIG Typography; Material Design 3 Applying type.
 */
const SYSTEM_LEADING: Record<SystemFamily, Anchor[]> = {
  apple: [
    [11, 13], [12, 16], [13, 18], [15, 20], [16, 21],
    [17, 22], [20, 25], [22, 28], [28, 34], [34, 41],
  ],
  material: [
    [11, 16], [12, 16], [14, 20], [16, 24], [22, 28], [24, 32],
    [28, 36], [32, 40], [36, 44], [45, 52], [57, 64],
  ],
  /* Desktop has no published table — "the system font" is Segoe, SF or
     whatever the distro picked. The curve below is used there instead. */
  desktop: [],
};

/**
 * Line height with NO platform table: max(size x 1.15, size + 8).
 *
 * Fitted to the two tables above rather than invented. Read them as ADDED
 * leading instead of as ratios and both collapse to one rule — Material adds
 * 7, 7, 8, 8, 8, 8, 6, 8, 6, 4; Apple adds 7, 6, 6, 5, 5, 5, 5, 5, 4 — a near
 * constant across a five-fold size range, with a floor ratio taking over once
 * the type is large. The crossover is 53px.
 *
 * Checked against Material: 16->24 exact, 28->36 exact, 36->44 exact, 57->65.6
 * against 64. And against this repo's own Desktop ramp, which already followed
 * it without anybody writing it down: H1 48->56, H2 40->48, H3 32->40,
 * H4 24->32, H5 20->28, all exact.
 */
export const LINE_HEIGHT_MIN_RATIO = 1.15;
export const LINE_HEIGHT_ADDED_LEADING = 8;
export function suggestedLineHeight(size: number): number {
  return Math.round(Math.max(size * LINE_HEIGHT_MIN_RATIO, size + LINE_HEIGHT_ADDED_LEADING));
}

/**
 * The platform's line height for a size, in px.
 *
 * Interpolated between the published anchors; OUTSIDE them the nearest
 * anchor's RATIO is extended rather than its leading held flat. Flat would give
 * a 72px display Apple's 41px — the largest row in a table that stops at 34 —
 * which is not a leading, it is a clipped line.
 */
export function systemLineHeight(family: SystemFamily, size: number): number {
  const a = SYSTEM_LEADING[family];
  if (!a.length) return suggestedLineHeight(size);
  const [firstSize, firstLead] = a[0];
  const [lastSize, lastLead] = a[a.length - 1];
  if (size <= firstSize) return Math.round(size * (firstLead / firstSize));
  if (size >= lastSize) return Math.round(size * (lastLead / lastSize));
  for (let i = 1; i < a.length; i++) {
    const [x1, y1] = a[i - 1];
    const [x2, y2] = a[i];
    if (size <= x2) return Math.round(y1 + ((size - x1) / (x2 - x1)) * (y2 - y1));
  }
  return suggestedLineHeight(size);
}

/** Linear interpolation between the anchors, flat outside them. */
export function systemTracking(family: SystemFamily, size: number): number {
  const a = SYSTEM_TRACKING[family];
  if (size <= a[0][0]) return a[0][1];
  if (size >= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 1; i < a.length; i++) {
    const [x1, y1] = a[i - 1];
    const [x2, y2] = a[i];
    if (size <= x2) return y1 + ((size - x1) / (x2 - x1)) * (y2 - y1);
  }
  return 0;
}

/** The platform's weight for a style. */
export function systemWeight(family: SystemFamily, style: string): number {
  return SYSTEM_WEIGHT[family][roleOf(style)];
}
