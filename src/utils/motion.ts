// src/utils/motion.ts
//
// ONE source of truth for motion — durations and easing curves — feeding the
// CSS export, the Figma export, and the component library. Same arrangement as
// bevelGeometry.ts: the numbers live here once so the three artifacts cannot
// disagree, and only the units differ.
//
// ── Why these durations ──────────────────────────────────────────────────────
// They are not invented. They are what the library already used, counted across
// every transition in src/components: 0.1s (53 uses), 0.15s (99), 0.2s (65),
// 0.3s (12). Naming the existing clusters makes adoption a rename rather than a
// redesign, and means nothing has to be re-tuned by eye.
//
// ── Why no spring ───────────────────────────────────────────────────────────
// A spring/overshoot curve (cubic-bezier(0.34, 1.56, 0.64, 1)) exists in the
// library today, on one component. It is deliberately NOT published here: an
// overshoot token is an invitation to use it, and overshoot was ruled out for
// this system. Leaving it out of the scale is the enforcement.
//
// ── Why the easings are asymmetric ──────────────────────────────────────────
// ease-in-out is symmetric: slow to start AND slow to stop. On a control the
// user has just pressed — a switch thumb, a checkbox tick — the slow start is
// felt as lag, because the input already happened and the element hesitates.
// So motion that responds to input decelerates instead: it leaves immediately
// and settles gently. Symmetry is only right when nothing is waiting on it.

/** Durations in milliseconds, keyed by the ROLE of the motion, not its length. */
export const MOTION_DURATION = {
  /** Feedback on something already under the pointer — press, thumb travel. */
  Instant: 100,
  /** The default. Colour, background and border swaps. */
  Fast: 150,
  /** Things that move or resize a little. */
  Moderate: 200,
  /** Surfaces entering or leaving — drawer, dialog, sheet. */
  Slow: 300,
} as const;

/**
 * Easing curves, keyed by where the motion starts and ends.
 *
 * Standard is the fallback for anything on-screen moving to another on-screen
 * position. Enter decelerates because the thing is arriving and should settle.
 * Exit accelerates because the thing is leaving and should get out of the way.
 * Linear is ONLY for continuous progress — spinners, progress bars — where any
 * curve reads as the machine speeding up or slowing down.
 */
export const MOTION_EASING = {
  Standard:   'cubic-bezier(0.2, 0, 0, 1)',
  Enter:      'cubic-bezier(0, 0, 0, 1)',
  Exit:       'cubic-bezier(0.3, 0, 1, 1)',
  Linear:     'linear',
} as const;

export type MotionDurationName = keyof typeof MOTION_DURATION;
export type MotionEasingName = keyof typeof MOTION_EASING;

/** The CSS custom properties, ready to drop into a :root block. */
export function motionCSS(indent = '  '): string {
  const durations = Object.entries(MOTION_DURATION)
    .map(([name, ms]) => `${indent}--Motion-Duration-${name}: ${ms}ms;`);
  const easings = Object.entries(MOTION_EASING)
    .map(([name, curve]) => `${indent}--Motion-Easing-${name}: ${curve};`);
  return [...durations, ...easings].join('\n');
}

/**
 * The same values for the Figma export.
 *
 * Durations are bare numbers so Figma stores them as FLOAT — those are directly
 * usable as Smart Animate durations. The easings can only be STRING: Figma
 * prototypes pick from their own easing presets, so the curve is a reference
 * value a designer pastes into a Custom bezier rather than something Figma can
 * bind. Shipping them anyway keeps the two definitions in one place.
 */
export function motionJSON(): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [name, ms] of Object.entries(MOTION_DURATION)) {
    out[`Motion-Duration-${name}`] = ms;
  }
  for (const [name, curve] of Object.entries(MOTION_EASING)) {
    out[`Motion-Easing-${name}`] = curve;
  }
  return out;
}

/**
 * Motion as a MODE, the same shape as data-theme / data-style / data-surface.
 *
 *   data-motion="Motion"      durations as defined
 *   data-motion="No-Motion"   every duration 0s
 *
 * Two mechanisms, because they cover different things:
 *
 * 1. Redefining the --Motion-Duration-* tokens to 0s handles everything that
 *    reads a token. This is the clean path and the one to grow into.
 * 2. A blanket transition-duration / animation-duration override handles
 *    everything that does NOT — the library still has literal durations written
 *    inline, and a mode that only worked on migrated components would be a mode
 *    you could not trust.
 *
 * 0s is safe here specifically: nothing in the system listens for transitionend
 * or animationend, and MUI's Fade/Grow/Slide/Collapse/Zoom run off timers via
 * react-transition-group rather than CSS events. In a system that DID wait on
 * those events, 0s would mean the event never fires and the wait never resolves.
 *
 * The OS preference is honoured by default, and the explicit attribute wins over
 * it — that is the point of a mode. It is ordered last for that reason. Set it
 * from a user-facing control, never to override the preference silently.
 */
export function motionModeCSS(): string {
  const zero = (sel: string) =>
    `${sel} {\n` +
    Object.keys(MOTION_DURATION).map((n) => `  --Motion-Duration-${n}: 0s;`).join('\n') +
    `\n}`;

  const full = (sel: string) =>
    `${sel} {\n` +
    Object.entries(MOTION_DURATION).map(([n, ms]) => `  --Motion-Duration-${n}: ${ms}ms;`).join('\n') +
    `\n}`;

  // Written flat rather than nested. CSS Nesting is widely supported now, but a
  // design system's stylesheet is consumed by whatever the customer's build
  // targets, and a nested block that fails to parse takes the whole rule with
  // it — including the token redefinitions above it.
  const kill = (base: string) =>
    `${base},\n${base} *,\n${base} *::before,\n${base} *::after {\n` +
    `  transition-duration: 0s !important;\n` +
    `  animation-duration: 0s !important;\n` +
    `  animation-iteration-count: 1 !important;\n` +
    `  scroll-behavior: auto !important;\n}`;

  const auto = ':root:not([data-motion="Motion"])';
  const off = '[data-motion="No-Motion"]';
  const on = '[data-motion="Motion"]';

  return [
    '/* ── Motion mode ─────────────────────────────────────────────────────────',
    '   Durations are tokens, so a mode is a redefinition rather than a rewrite.',
    '   The blanket rule beside them catches transitions still written as',
    '   literals, so the mode can be trusted before every component migrates. */',
    '',
    '/* Follows the operating system unless data-motion overrides it. */',
    '@media (prefers-reduced-motion: reduce) {',
    zero(auto).split('\n').map((l) => '  ' + l).join('\n'),
    kill(auto).split('\n').map((l) => '  ' + l).join('\n'),
    '}',
    '',
    '/* Explicit: no motion. */',
    zero(off),
    kill(off),
    '',
    '/* Explicit: motion, even where the OS asks for less. */',
    full(on),
  ].join('\n');
}

/** The two values data-motion accepts. */
export const MOTION_MODES = ['Motion', 'No-Motion'] as const;
export type MotionMode = (typeof MOTION_MODES)[number];
