/**
 * Accessibility report, read from what a page RENDERS.
 *
 * The older report (accessibilityReport.ts) read tokens.json and decided for
 * itself which token applied to each surface. That decision was its own, so
 * when the generator's was different the two agreed with each other and both
 * missed the page: every palette theme's dark-mode card eyebrow measured
 * 1.2-1.5:1 on the published portfolio while the report showed it passing,
 * because the report checked the eyebrow it EXPECTED (filed under the card's
 * own tone) rather than the one the CSS assigned (filed under the surface
 * behind the card). Parity is not correctness.
 *
 * This one checks the published CSS itself. For every theme x surface level
 * x mode it computes the custom properties an element actually ends up with
 * (cssCascade.ts — the browser's cascade for the selector forms the generator
 * emits, verified value-for-value against Chrome) and measures each role
 * against that element's own --Background.
 *
 * Contexts are modelled the way pages build them:
 *   - nested:       <div data-theme=T><div data-surface=S>   (a card in a section)
 *   - same element: <div data-theme=T data-surface=S>        (a Section)
 *   - page default: <html><div data-surface=S>               (no data-theme at all)
 * The nested form is reported; the same-element form adds a check only where
 * it resolves differently, so the two cannot quietly disagree.
 *
 * Thresholds are WCAG 2.2 AA and are the requirement, not a floor to pad:
 * 4.5:1 for text (eyebrows and links included), 3:1 for headers (large text)
 * and for non-text (borders, focus ring, icons, a button's edge).
 */
import { Cascade, type CascadeElement, parseColor, composite, contrast, toHex, type RGBA } from './cssCascade';
import type { ReportCheck, ReportSection } from './accessibilityReport';

export const REPORT_THEMES = [
  'Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral',
  'Info', 'Success', 'Warning', 'Error', 'App-Bar', 'Nav-Bar', 'Status',
] as const;

export const REPORT_SURFACES = [
  'Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest',
  'Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest',
] as const;

const PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
const BUTTONS = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'BlackWhite', 'Info', 'Success', 'Warning', 'Error'];
const TAGS = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];

type Category = ReportCheck['category'];
/** A role measured against the element's own background. */
type SurfaceRole = { role: string; label: string; category: Category; required: number };

const SURFACE_ROLES: SurfaceRole[] = [
  { role: '--Text', label: 'Text', category: 'Text', required: 4.5 },
  ...PALETTES.map((p) => ({ role: `--Text-${p}`, label: `${p} Text`, category: 'Text' as Category, required: 4.5 })),
  { role: '--Text-Match', label: 'Match Text', category: 'Text', required: 4.5 },
  { role: '--Text-BW', label: 'Black/White Text', category: 'Text', required: 4.5 },
  { role: '--Quiet', label: 'Quiet Text', category: 'Text', required: 4.5 },
  // No accent Quiet: the system has one quiet role. The generator still emits
  // --Quiet-<Palette>, but nothing in the design uses it, so it is not graded.
  { role: '--Hotlink', label: 'Link', category: 'Text', required: 4.5 },
  { role: '--Hotlink-Visited', label: 'Visited Link', category: 'Text', required: 4.5 },
  { role: '--Eyebrow', label: 'Eyebrow', category: 'Eyebrow', required: 4.5 },
  { role: '--Header', label: 'Header', category: 'Header', required: 3 },
  ...PALETTES.map((p) => ({ role: `--Header-${p}`, label: `${p} Header`, category: 'Header' as Category, required: 3 })),
  { role: '--Header-Match', label: 'Match Header', category: 'Header', required: 3 },
  { role: '--Border', label: 'Border', category: 'Border', required: 3 },
  { role: '--Focus-Visible', label: 'Focus-Visible Ring', category: 'Focus', required: 3 },
  { role: '--Icons-Default', label: 'Icon', category: 'Border', required: 3 },
  ...PALETTES.map((p) => ({ role: `--Icons-${p}`, label: `${p} Icon`, category: 'Border' as Category, required: 3 })),
];

export interface ModeSheets {
  /** Sheets in page load order (foundation, core, mode sheet, base, styles). */
  light: string[];
  dark: string[];
}

/** One context: an element and a label for where it sits. */
type Context = { background: string; surfaceLevel: string; el: CascadeElement; alt?: CascadeElement };

function contexts(): Context[] {
  const out: Context[] = [];
  const root: CascadeElement = { attrs: {}, root: true };
  for (const theme of REPORT_THEMES) {
    const themeEl: CascadeElement = { attrs: { 'data-theme': theme }, parent: root };
    for (const s of REPORT_SURFACES) {
      out.push({
        background: `${theme} theme`,
        surfaceLevel: s,
        el: { attrs: { 'data-surface': s }, parent: themeEl },
        alt: { attrs: { 'data-theme': theme, 'data-surface': s }, parent: root },
      });
    }
  }
  for (const s of REPORT_SURFACES) {
    out.push({ background: 'Page (no data-theme)', surfaceLevel: s, el: { attrs: { 'data-surface': s }, parent: root } });
  }
  return out;
}

/** The opaque color an element paints: its --Background over its parent's. */
function paintedBackground(c: Cascade, el: CascadeElement): RGBA | null {
  const own = parseColor(c.computed(el)['--Background'] ?? '');
  if (!own) return null;
  if (own.a >= 1) return own;
  const under = el.parent ? paintedBackground(c, el.parent) : { r: 255, g: 255, b: 255, a: 1 };
  return under ? composite(own, under) : null;
}

function measure(
  category: Category, label: string, token: string,
  fgRaw: string | undefined, bg: RGBA, required: number,
): ReportCheck | null {
  if (!fgRaw) return null;
  const fg = parseColor(fgRaw);
  if (!fg) return null;
  const fgOpaque = fg.a < 1 ? composite(fg, bg) : fg;
  const ratio = contrast(fgOpaque, bg);
  return {
    category, label, token, fgColor: toHex(fgOpaque), bgColor: toHex(bg), ratio, required,
    passes: ratio >= required,
  };
}

function checksFor(c: Cascade, el: CascadeElement, bg: RGBA): ReportCheck[] {
  const v = c.computed(el);
  const checks: (ReportCheck | null)[] = [];

  for (const r of SURFACE_ROLES) checks.push(measure(r.category, r.label, r.role, v[r.role], bg, r.required));

  // A clickable surface changes under its text on hover and press.
  for (const [state, role] of [['Hover', '--Hover'], ['Pressed', '--Pressed']] as const) {
    const s = parseColor(v[role] ?? '');
    if (!s) continue;
    const stateBg = s.a < 1 ? composite(s, bg) : s;
    checks.push(measure('Text', `Text → ${state}`, role, v['--Text'], stateBg, 4.5));
  }

  for (const b of BUTTONS) {
    const p = `--Buttons-${b}`;
    const fill = parseColor(v[`${p}-Button`] ?? '');
    if (fill) {
      const fillOpaque = fill.a < 1 ? composite(fill, bg) : fill;
      checks.push(measure('Button', `${b} Button text → fill`, `${p}-Text`, v[`${p}-Text`], fillOpaque, 4.5));
      for (const state of ['Hover', 'Pressed']) {
        const s = parseColor(v[`${p}-${state}`] ?? '');
        if (!s) continue;
        const sBg = s.a < 1 ? composite(s, fillOpaque) : s;
        checks.push(measure('Button', `${b} Button ${state.toLowerCase()} → text`, `${p}-${state}`, v[`${p}-Text`], sBg, 4.5));
      }
    }
    // The button's edge against the surface: non-text, 3:1 (WCAG 1.4.11). The
    // control is identifiable if EITHER its fill or its border separates it
    // from the surface — a white button needs no contrasting border on black.
    {
      const viaBorder = measure('Button', `${b} Button edge → surface`, `${p}-Border`, v[`${p}-Border`], bg, 3);
      const viaFill = measure('Button', `${b} Button edge → surface`, `${p}-Button`, v[`${p}-Button`], bg, 3);
      const best = [viaBorder, viaFill].filter((x): x is ReportCheck => !!x).sort((a, z) => z.ratio - a.ratio)[0];
      checks.push(best ?? null);
    }
    // An outline button's label sits on the surface itself.
    checks.push(measure('Button', `${b} Outline label`, `${p}-Outline-Text`, v[`${p}-Outline-Text`], bg, 4.5));
    checks.push(measure('Button', `${b} Outline label (rest)`, `${p}-Outline-Quiet`, v[`${p}-Outline-Quiet`], bg, 4.5));
  }

  for (const t of TAGS) {
    const tagBg = parseColor(v[`--Tag-${t}-BG`] ?? '');
    if (!tagBg) continue;
    const tagOpaque = tagBg.a < 1 ? composite(tagBg, bg) : tagBg;
    checks.push(measure('Text', `${t} Tag text`, `--Tag-${t}-Text`, v[`--Tag-${t}-Text`], tagOpaque, 4.5));
  }

  return checks.filter((x): x is ReportCheck => !!x);
}

/** Same check, same verdict and same colors: nothing to add. */
const sameCheck = (a: ReportCheck, b: ReportCheck) =>
  a.fgColor === b.fgColor && a.bgColor === b.bgColor;

export function buildRenderedAccessibilityReport(sheets: ModeSheets): ReportSection[] {
  const sections: ReportSection[] = [];
  for (const [mode, css] of [['Light', sheets.light], ['Dark', sheets.dark]] as const) {
    if (!css?.length) continue;
    const cascade = new Cascade(css);
    for (const ctx of contexts()) {
      const bg = paintedBackground(cascade, ctx.el);
      if (!bg) continue;
      const checks = checksFor(cascade, ctx.el, bg);

      if (ctx.alt) {
        const altBg = paintedBackground(cascade, ctx.alt);
        if (altBg) {
          const byToken = new Map(checks.map((x) => [x.token + '|' + x.label, x]));
          for (const a of checksFor(cascade, ctx.alt, altBg)) {
            const n = byToken.get(a.token + '|' + a.label);
            if (n && sameCheck(n, a)) continue;
            checks.push({ ...a, label: `${a.label} (theme + surface on one element)` });
          }
        }
      }

      sections.push({ mode, background: ctx.background, surfaceLevel: ctx.surfaceLevel, surfaceBg: toHex(bg), checks });
    }
  }
  return sections;
}

/** Sheet order a page loads. Missing files are skipped. */
export function orderSheets(files: Record<string, string | undefined>, mode: 'Light' | 'Dark'): string[] {
  return ['foundation.css', 'core.css', `${mode}-Mode.css`, 'base.css', 'styles.css']
    .map((f) => files[f])
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
}
