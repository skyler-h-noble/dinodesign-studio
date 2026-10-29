/**
 * Dark mode: Color-6 … Color-12 ease their chroma (DARK_LIGHT_TONE_CHROMA_EASE).
 *
 * "In dark mode I want the light mode colors starting from 6 to 12 to ease from
 *  less saturated to more (the current saturation) — 6 is too bright in dark
 *  mode."
 *
 * In dark mode the tones from 6 up are the light end of the ramp, and they are
 * what lands on large areas: Color-6 IS a themed section's Surface, Color-7 its
 * Surface-Bright, Color-11 its Surface-Brightest. Color-6 had light mode's full
 * mid-tone chroma, so a whole dark-mode section was painted at the brand's
 * loudest.
 *
 * The ease lives in the dark-ramp generator, so the preview, the CSS export and
 * the Figma payload all read the same eased ramp. These tests drive the real
 * pipeline and assert:
 *   1. the SHAPE, independently of any pipeline (invariant 7): tone 6 calmest
 *      relative to today, rising to exactly today at tone 12; tones 1-5 and
 *      lightness untouched;
 *   2. the export, Figma and the preview all carry the eased value
 *      (invariant 5), including on a themed surface (invariant 6);
 *   3. light mode is byte-for-byte unchanged;
 *   4. every contrast check in the accessibility report still passes.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import {
  generateSemanticLightModeScale,
  generateSemanticDarkModeScale,
  getMatchingPeakChroma,
  darkLightToneChromaMultiplier,
  DARK_LIGHT_TONE_CHROMA_EASE,
} from '../utils/colorScale';
import { buildAccessibilityReport } from '../utils/accessibilityReport';
import type { ColorScheme, UserSelections } from '../types';

// ─── Fixture ─────────────────────────────────────────────────────────────────

type Palette = ReturnType<typeof generateSemanticDarkModeScale>;

/** A scheme built the way ColorStage builds one: light ramps pinned to the
 *  picked color under the 70 cap, dark ramps under the 42 cap. `eased: false`
 *  rebuilds the dark ramps exactly as they were before the ease. */
function makeScheme(colors: [string, string, string], eased = true): ColorScheme {
  const light = (hex: string) =>
    generateSemanticLightModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, false)), 70), hex);
  const dark = (hex: string) =>
    generateSemanticDarkModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, true)), 42), undefined, { easeLightTones: eased });
  return {
    name: 'Test',
    colors,
    originalColors: [...colors],
    extractedTones: {
      primary: chroma(colors[0]).lch()[0],
      secondary: chroma(colors[1]).lch()[0],
      tertiary: chroma(colors[2]).lch()[0],
    },
    tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
    darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
  } as unknown as ColorScheme;
}

const TYPOGRAPHY = [
  { type: 'header' as const, family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  { type: 'decorative' as const, family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  { type: 'body' as const, family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
];

const BUTTON_MAP: Record<string, string> = {
  primary: 'primary-fixed',
  secondary: 'secondary-fixed',
  tonal: 'tonal-fixed',
  laddered: 'laddered-fixed',
  'black-white': 'black-white',
};

function buildAll(scheme: ColorScheme, sel: UserSelections, mode: 'light' | 'dark') {
  const previewCss = buildPreviewCSS({
    colorScheme: scheme,
    userSelections: sel,
    componentStyle: 'modern',
    mode,
    typographyStyles: TYPOGRAPHY,
  } as never);
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(
      scheme.tonePalettes!.primary as never,
      scheme.tonePalettes!.secondary as never,
      scheme.tonePalettes!.tertiary as never,
    ),
    generateFullDarkPalettes(
      scheme.darkModeTonePalettes!.primary as never,
      scheme.darkModeTonePalettes!.secondary as never,
      scheme.darkModeTonePalettes!.tertiary as never,
    ),
    sel.background === 'primary' ? 'primary' : 'neutral',
    (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
    scheme.extractedTones,
    'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'Ease', undefined, undefined, undefined, 'light-tonal', undefined,
    {
      background: sel.background as never,
      button: (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
      cardColoring: sel.cardColoring as never,
      textColoring: sel.textColoring as never,
    },
  );
  (json as unknown as Record<string, unknown>)._userSelections = {
    background: sel.background, button: sel.button,
    cardColoring: sel.cardColoring, textColoring: sel.textColoring,
  };
  const css = generateCSSFiles(json as never) as Record<string, string>;
  return { previewCss, json, css, figma: generateFigmaJSON(json) };
}

// ─── Readers ─────────────────────────────────────────────────────────────────

/** A node in the exported token tree: a bag of keys, a {value} leaf, or a string. */
type Node = { [key: string]: Node | undefined; value?: Node } | string | undefined;

/** Walk a dotted path through the export (or Figma payload). */
function at(root: unknown, path: string): { [key: string]: Node; value: Node } {
  let node = root as Node;
  for (const key of path.split('.')) node = typeof node === 'object' ? node?.[key] : undefined;
  return node as never;
}
const valueOf = (node: Node): string =>
  String(typeof node === 'string' ? node : (node?.value as string | undefined) ?? '');
const norm = (hex: string | null | undefined) => (hex ? chroma(hex.trim()).hex().toLowerCase() : null);

/** Last declaration of a token in a block whose selector matches `scope`. */
function cssToken(css: string, scope: RegExp, token: string): string | null {
  let found: string | null = null;
  for (const block of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
    const i = block.indexOf('{');
    if (i < 0 || !scope.test(block.slice(0, i))) continue;
    const m = block.slice(i + 1).match(new RegExp(`--${token}\\s*:\\s*([^;]+);`));
    if (m) found = m[1].trim();
  }
  return found;
}

/** Resolve var(--X) chains against the :root block of the same sheet. */
function resolveVar(css: string, value: string | null): string | null {
  let v = value;
  for (let hops = 0; hops < 6 && v && v.startsWith('var('); hops++) {
    const name = v.slice(4, -1).split(',')[0].trim().replace(/^--/, '');
    v = cssToken(css, /^\s*:root\s*$/, name);
  }
  return v;
}

const lch = (hex: string) => chroma(hex).lch();

// ─── Sweep ───────────────────────────────────────────────────────────────────

/** Every hue band, including yellow (whose bell curve peaks at Color-7) and a
 *  pink like the one that prompted the change. */
const SWEEP: [string, string, string][] = [
  ['#e0408a', '#f2b33d', '#3fa7a0'],
  ['#7b3f9d', '#2563eb', '#b8329b'],
  ['#6b7a4f', '#c98b7e', '#e0c9a6'],
  ['#d92b2b', '#1e3a8a', '#84cc16'],
  ['#0891b2', '#7c2d12', '#f97316'],
  ['#22c55e', '#a855f7', '#eab308'],
];

const SELECTIONS: { label: string; sel: UserSelections }[] = [
  { label: 'white bg · tonal cards · primary buttons', sel: { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'primary' } as UserSelections },
  { label: 'black bg · black cards · secondary buttons', sel: { background: 'black', cardColoring: 'black', textColoring: 'black-white', button: 'secondary' } as UserSelections },
  { label: 'primary bg · tonal cards · laddered buttons', sel: { background: 'primary', cardColoring: 'tonal', textColoring: 'black-white', button: 'laddered' } as UserSelections },
];

// ─── 1. The shape ────────────────────────────────────────────────────────────

describe('the ease curve', () => {
  it('is 1 below Color-6, starts at startMultiplier, rises strictly, and is exactly 1 at Color-12', () => {
    for (let n = 1; n <= 5; n++) expect(darkLightToneChromaMultiplier(n)).toBe(1);
    expect(darkLightToneChromaMultiplier(6)).toBe(DARK_LIGHT_TONE_CHROMA_EASE.startMultiplier);
    expect(DARK_LIGHT_TONE_CHROMA_EASE.startMultiplier).toBeLessThan(1);
    for (let n = 6; n < 12; n++) {
      expect(darkLightToneChromaMultiplier(n + 1)).toBeGreaterThan(darkLightToneChromaMultiplier(n));
    }
    expect(darkLightToneChromaMultiplier(12)).toBe(1);
  });
});

describe('dark ramps: tone 6 calmest, easing back to today at tone 12', () => {
  const hexes = [...new Set(SWEEP.flat())];

  it.each(hexes)('%s', (hex) => {
    const cap = Math.min(Math.round(getMatchingPeakChroma(hex, true)), 42);
    const before: Palette = generateSemanticDarkModeScale(hex, cap, undefined, { easeLightTones: false });
    const after: Palette = generateSemanticDarkModeScale(hex, cap);

    // Tones 1-5 are not touched.
    for (let i = 0; i < 5; i++) expect(after[i].hex, `Color-${i + 1}`).toBe(before[i].hex);
    // Tone 12 is exactly today's.
    expect(after[11].hex, 'Color-12').toBe(before[11].hex);

    // Lightness is kept (hex rounding only), so labels and contrast stay put.
    for (let i = 5; i < 12; i++) {
      expect(Math.abs(lch(after[i].hex)[0] - lch(before[i].hex)[0]), `Color-${i + 1} lightness`).toBeLessThan(0.6);
    }

    // Tone 6 is calmer than it was, and is the calmest RELATIVE TO TODAY.
    const ratio = (i: number) => lch(after[i].hex)[1] / Math.max(lch(before[i].hex)[1], 1e-6);
    expect(lch(after[5].hex)[1], 'Color-6 chroma drops').toBeLessThan(lch(before[5].hex)[1]);
    for (let i = 6; i < 12; i++) {
      // Rising toward today's saturation; a hair of tolerance for 8-bit hex rounding.
      expect(ratio(i), `Color-${i + 1} vs Color-${i}`).toBeGreaterThanOrEqual(ratio(i - 1) - 0.02);
      expect(ratio(i), `Color-${i + 1} above Color-6`).toBeGreaterThan(ratio(5));
    }
  });
});

// ─── 2. Preview, export and Figma all carry the eased value ─────────────────

describe('preview, export and Figma agree on the eased tones', () => {
  const scheme = makeScheme(SWEEP[0]);
  const schemeBefore = makeScheme(SWEEP[0], false);
  const eased = scheme.darkModeTonePalettes.primary;
  const plain = schemeBefore.darkModeTonePalettes.primary;
  const sel = SELECTIONS[0].sel;
  const { previewCss, json, css, figma } = buildAll(scheme, sel, 'dark');

  it('the fixture actually moved Color-6 to Color-11', () => {
    for (let n = 6; n <= 11; n++) expect(eased[n - 1].hex, `Color-${n}`).not.toBe(plain[n - 1].hex);
  });

  it('export JSON, Dark-Mode.css and the Figma payload hold the eased ramp', () => {
    for (let n = 6; n <= 12; n++) {
      const want = norm(eased[n - 1].hex);
      expect(norm(valueOf(at(json, `Modes.Dark-Mode.Colors.Primary.Color-${n}`))), `JSON Color-${n}`).toBe(want);
      expect(norm(cssToken(css['Dark-Mode.css'], /^\s*:root\s*$/, `Primary-Color-${n}`)), `CSS Color-${n}`).toBe(want);
      expect(norm(valueOf(at(figma, `Modes.Dark-Mode.Colors.Primary.Color-${n}`))), `Figma Color-${n}`).toBe(want);
    }
  });

  it('a dark-mode Primary section (Surface) paints the eased Color-6 in the export', () => {
    // The case that prompted the change: <Section theme="Primary" surface="Surface">.
    const bg = cssToken(css['Dark-Mode.css'], /\[data-theme="Primary"\]\[data-surface="Surface"\]/, 'Background');
    expect(norm(resolveVar(css['Dark-Mode.css'], bg))).toBe(norm(eased[5].hex));
    // Surface-Bright and Surface-Brightest follow their own eased tones.
    const bright = cssToken(css['Dark-Mode.css'], /\[data-theme="Primary"\]\[data-surface="Surface-Bright"\]/, 'Background');
    expect(norm(resolveVar(css['Dark-Mode.css'], bright))).toBe(norm(eased[6].hex));
  });

  it('the preview reads the eased ramp where it draws from the dark palette', () => {
    // The page's Default button border is dark Color-6 in both pipelines.
    const preview = norm(cssToken(previewCss, /\[data-theme="Brand"\],\s*\[data-theme="Brand"\]\[data-surface="Surface"\]/, 'Buttons-Default-Border'));
    const exportRaw = cssToken(css['Dark-Mode.css'], /^\s*:root,/, 'Buttons-Default-Border');
    const exported = norm(resolveVar(css['Dark-Mode.css'], exportRaw));
    expect(preview).toBe(exported);
    expect(preview).toBe(norm(eased[5].hex));
    expect(preview).not.toBe(norm(plain[5].hex));
  });
});

// ─── 3. Light mode is byte-for-byte unchanged ───────────────────────────────

describe('light mode is untouched', () => {
  it.each(SELECTIONS)('$label', ({ sel }) => {
    for (const colors of SWEEP.slice(0, 3)) {
      const after = buildAll(makeScheme(colors), sel, 'light');
      const before = buildAll(makeScheme(colors, false), sel, 'light');
      expect(after.css['Light-Mode.css']).toBe(before.css['Light-Mode.css']);
      expect(after.previewCss).toBe(before.previewCss);
      expect(JSON.stringify(at(after.json, 'Modes.Light-Mode'))).toBe(JSON.stringify(at(before.json, 'Modes.Light-Mode')));
      expect(JSON.stringify(at(after.figma, 'Modes.Light-Mode'))).toBe(JSON.stringify(at(before.figma, 'Modes.Light-Mode')));
      // And the dark side really did change, so the comparison is not vacuous.
      expect(after.css['Dark-Mode.css']).not.toBe(before.css['Dark-Mode.css']);
    }
  });
});

// ─── 3b. Charts are not moved by the ease ───────────────────────────────────

describe('chart colors are solved against the pre-ease dark ramps', () => {
  /* Chart tones are shared across modes, so the calmer dark ramps would
     re-solve the LIGHT chart. The export records the pre-ease tones and the
     solver reads them — both modes' charts come out exactly as before. */
  it.each(SELECTIONS)('$label', ({ sel }) => {
    for (const colors of SWEEP) {
      const after = buildAll(makeScheme(colors), sel, 'dark');
      const before = buildAll(makeScheme(colors, false), sel, 'dark');
      for (const mode of ['Light-Mode', 'Dark-Mode']) {
        expect(JSON.stringify(at(after.figma, `Modes.${mode}.Chart`)), `${colors[0]} ${mode} Figma chart`)
          .toBe(JSON.stringify(at(before.figma, `Modes.${mode}.Chart`)));
      }
      const chartLines = (s: string) => s.split('\n').filter((l) => /--Chart-\d+:/.test(l)).join('\n');
      expect(chartLines(after.css['Dark-Mode.css']), `${colors[0]} dark CSS chart`).toBe(chartLines(before.css['Dark-Mode.css']));
      // The record exists only when something was eased, and holds the old tones.
      expect(valueOf(at(after.json, 'Metadata.Chart-Pre-Ease-Dark-Tones.Primary.Color-6')))
        .toBe(valueOf(at(before.json, 'Modes.Dark-Mode.Colors.Primary.Color-6')));
      expect(at(before.json, 'Metadata.Chart-Pre-Ease-Dark-Tones')).toBeUndefined();
    }
  }, 120_000);
});

// ─── 4. Contrast still passes ───────────────────────────────────────────────

describe('every dark-mode contrast check still passes', () => {
  it('across the sweep, with no check newly failing', () => {
    let checked = 0;
    let worst = Infinity;
    const failures: string[] = [];
    const newlyFailing: string[] = [];
    for (const colors of SWEEP) {
      for (const { label, sel } of SELECTIONS) {
        const after = buildAccessibilityReport(buildAll(makeScheme(colors), sel, 'dark').json).filter((s) => s.mode === 'Dark');
        const before = buildAccessibilityReport(buildAll(makeScheme(colors, false), sel, 'dark').json).filter((s) => s.mode === 'Dark');
        const passedBefore = new Set<string>();
        for (const s of before) for (const c of s.checks) if (c.passes) passedBefore.add(`${s.background}|${s.surfaceLevel}|${c.token}|${c.label}`);
        for (const s of after) {
          for (const c of s.checks) {
            checked++;
            worst = Math.min(worst, c.ratio / c.required);
            const key = `${s.background}|${s.surfaceLevel}|${c.token}|${c.label}`;
            if (!c.passes) {
              failures.push(`${colors[0]} · ${label} · ${key}: ${c.ratio.toFixed(2)} < ${c.required}`);
              if (passedBefore.has(key)) newlyFailing.push(key);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(newlyFailing.slice(0, 10).join('\n'), `${newlyFailing.length} checks newly failing`).toBe('');
    expect(failures.slice(0, 10).join('\n'), `${failures.length} checks below threshold`).toBe('');
    expect(worst).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
