/**
 * Default text-over-image scrims, one per theme.
 *
 * ── What this is ──────────────────────────────────────────────────────────
 * Putting text on a photograph is the one place the token system cannot answer
 * on its own: `--Text` and `--Background` are a verified pair, but the photo
 * sits between them and nothing in the palette knows what is in it. So every
 * design system ships a scrim opacity per theme that keeps its own `--Text`
 * legible over ANY image.
 *
 * ── Why it can be computed without an image ───────────────────────────────
 * Alpha compositing is monotonic in the backdrop: the composited colour always
 * lies on the segment between the overlay and whatever is behind it. So the
 * worst backdrop is always one of the two extremes of the sRGB cube — pure
 * black or pure white — and solving for both covers every pixel of every photo
 * that could ever sit there. No sampling, no image required.
 *
 * Which extreme bites depends on the theme: light text on a dark scrim is
 * hurt by a WHITE backdrop (it lightens the composite toward the text), dark
 * text on a light scrim by a BLACK one. Both are evaluated and the worse taken,
 * so the answer holds either way without needing to know which case applies.
 *
 * ── This is a floor, not a verdict ────────────────────────────────────────
 * dino-overlay's rule is that the tool states what a choice costs and leaves
 * the call with the designer. A worst-case number is the honest version of a
 * default: it is the opacity below which SOME image would fail, not the
 * opacity any particular image needs. A real photograph is almost always
 * lighter than this. The emitted CSS says so, so nobody reads a safe default
 * as a recommended one.
 *
 * The maths mirrors dino-overlay/src/lib/overlaySolver.js — sRGB-space
 * compositing (`compositeOver`), WCAG relative luminance, and the same 0.01
 * linear scan — so a value produced here and one produced by the tool agree.
 */

/** WCAG AA for body text. Large display text may sit lower, but a default
 *  cannot know which it is being used for, so it assumes the stricter case. */
export const TEXT_OVER_IMAGE_TARGET = 4.5;

/** Scan granularity. Matches overlaySolver.js's `step`. */
const ALPHA_STEP = 0.01;

interface Rgb { r: number; g: number; b: number }

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG relative luminance. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Source-over compositing, in sRGB channel space — what the browser does. */
function compositeOver(overlay: Rgb, base: Rgb, alpha: number): Rgb {
  return {
    r: overlay.r * alpha + base.r * (1 - alpha),
    g: overlay.g * alpha + base.g * (1 - alpha),
    b: overlay.b * alpha + base.b * (1 - alpha),
  };
}

function contrast(aL: number, bL: number): number {
  return (Math.max(aL, bL) + 0.05) / (Math.min(aL, bL) + 0.05);
}

/** The two backdrops that bound every possible image pixel. */
const EXTREMES: Rgb[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
];

export interface ScrimResult {
  /** Opacity 0–1, or null when even a fully opaque scrim cannot reach the
   *  target — which means the theme's own Text/Background pair fails, not the
   *  scrim. */
  alpha: number | null;
  /** Contrast actually achieved at `alpha` (or at 1 when infeasible). */
  ratio: number;
  feasible: boolean;
}

/**
 * Minimum scrim opacity that holds `targetRatio` over any backdrop.
 *
 * At alpha 1 the backdrop is gone entirely and this reduces to the theme's own
 * Text-on-Background contrast — which the design system already guarantees. So
 * an infeasible result here is a signal about the THEME, not about images.
 */
export function solveWorstCaseScrim(
  overlayHex: string,
  textHex: string,
  targetRatio: number = TEXT_OVER_IMAGE_TARGET,
): ScrimResult {
  const overlay = hexToRgb(overlayHex);
  const text = hexToRgb(textHex);
  if (!overlay || !text) return { alpha: null, ratio: 0, feasible: false };

  const textL = relativeLuminance(text);
  const worstAt = (alpha: number) => {
    let worst = Infinity;
    for (const base of EXTREMES) {
      const c = contrast(relativeLuminance(compositeOver(overlay, base, alpha)), textL);
      if (c < worst) worst = c;
    }
    return worst;
  };

  for (let a = 0; a <= 1.0001; a += ALPHA_STEP) {
    const alpha = Math.min(1, a);
    const worst = worstAt(alpha);
    if (worst >= targetRatio) {
      return { alpha: Math.round(alpha * 100) / 100, ratio: worst, feasible: true };
    }
  }
  return { alpha: null, ratio: worstAt(1), feasible: false };
}

/** A foreground that will sit on the scrim, and the ratio it owes. */
export interface Foreground {
  /** Token name, for the emitted comment. */
  role: string;
  hex: string;
  /** 4.5 for body-sized text, 3 for large text (Header). */
  target: number;
}

export interface ThemeScrim extends ScrimResult {
  theme: string;
  background: string;
  /** Which foreground forced the chosen alpha. */
  driver: string;
  foregrounds: Foreground[];
}

/**
 * Solve one scrim per theme.
 *
 * `themes` maps a theme name to its resolved `--Background` / `--Text` pair —
 * the same two values the theme already publishes, so the scrim can never
 * disagree with the text it is protecting.
 */
export function solveThemeScrims(
  themes: Record<string, { background: string; foregrounds: Foreground[] }>,
): ThemeScrim[] {
  return Object.entries(themes).map(([theme, entry]) => {
    // Solve EVERY foreground that can land on this scrim and keep the one that
    // needs most. Solving only --Text produced a scrim that guaranteed nothing
    // for a poster whose title is --Header and whose eyebrow is --Eyebrow: the
    // maths was right and the token was wrong, so the text came out unreadable
    // at a value that reported as passing.
    let alpha: number | null = null;
    let ratio = Infinity;
    let feasible = true;
    let driver = '';

    for (const fg of entry.foregrounds) {
      const r = solveWorstCaseScrim(entry.background, fg.hex, fg.target);
      if (!r.feasible || r.alpha === null) {
        feasible = false;
        driver = fg.role;
        ratio = r.ratio;
        alpha = null;
        break;
      }
      if (alpha === null || r.alpha > alpha) {
        alpha = r.alpha;
        driver = fg.role;
      }
      if (r.ratio < ratio) ratio = r.ratio;
    }

    return {
      theme,
      background: entry.background,
      driver,
      foregrounds: entry.foregrounds,
      alpha,
      ratio: ratio === Infinity ? 0 : ratio,
      feasible: feasible && alpha !== null,
    };
  });
}

/**
 * Emit the CSS.
 *
 * The scrim is painted with `color-mix(in srgb, var(--Background) N%,
 * transparent)` rather than a baked rgba, matching dino-overlay's non-literal
 * output — so the overlay keeps following the theme instead of freezing one
 * theme's colour into the rule.
 */
export function generateTextOverImageCSS(scrims: ThemeScrim[]): string {
  if (!scrims.length) return '';
  const lines: string[] = [];

  lines.push('/* ── Text over image ─────────────────────────────────────────');
  lines.push(' *');
  lines.push(' * --Overlay-Scrim: the minimum overlay opacity that keeps EVERY foreground');
  lines.push(' * this theme can put on an image — --Text, --Header, --Eyebrow, --Quiet —');
  lines.push(' * at its required ratio over ANY image. The strictest one sets the value.');
  lines.push(' *');
  lines.push(' * This is a FLOOR for the worst possible photograph, not a recommendation.');
  lines.push(' * Most images need considerably less; measure against the real image and');
  lines.push(' * lower it. Going below this value means some images will fail.');
  lines.push(' */');

  for (const s of scrims) {
    if (!s.feasible || s.alpha === null) {
      lines.push(`/* ${s.theme}: no opacity satisfies ${s.driver} `
        + `(best ${s.ratio.toFixed(2)}:1 at full opacity) — this theme's own `
        + `${s.driver}/Background pair is the limit, not the image. */`);
      continue;
    }
    const pct = Math.round(s.alpha * 1000) / 10;
    lines.push(`/* ${s.theme}: set by ${s.driver} */`);
    lines.push(`[data-theme="${s.theme}"] {`);
    lines.push(`  --Overlay-Scrim: ${s.alpha};`);
    lines.push(`  --Overlay-Scrim-Paint: color-mix(in srgb, var(--Background) ${pct}%, transparent);`);
    lines.push(`}`);
  }

  // One utility so the tokens are usable without the consumer reinventing the
  // stacking context every time.
  lines.push('');
  lines.push('.text-over-image { position: relative; isolation: isolate; }');
  lines.push('.text-over-image > img { display: block; width: 100%; height: 100%; object-fit: cover; }');
  lines.push('.text-over-image::after {');
  lines.push('  content: ""; position: absolute; inset: 0;');
  lines.push('  background: var(--Overlay-Scrim-Paint, transparent);');
  lines.push('  pointer-events: none;');
  lines.push('}');
  lines.push('.text-over-image > .text-over-image-content { position: relative; color: var(--Text); }');

  return lines.join('\n');
}
