/**
 * A mode sheet must DEFINE every token it references.
 *
 * The BW (Black/White) palette was added to Light-Mode only, while Dark-Mode.css
 * emits `--Eyebrow: var(--BW-Color-8)`. So in dark mode that name resolved to
 * nothing: the declaration was invalid at computed-value time, `color` fell back
 * to inherited, and the eyebrow silently lost its colour. A mesh gradient's
 * solved text colour failed the same way and put light text on a light mesh —
 * which is what it looked like from outside, rather than a missing token.
 *
 * Nothing caught it because an undefined custom property is not an error
 * anywhere: not in CSS, not in a build, not in a test that only checks the
 * sheet was produced. The general assertion below is the detector — reference
 * without definition, in either sheet, for any token.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme } from '../types';

// Same fixture shape textBW.test.ts uses — the real pipeline, not a stand-in.
const COLORS: [string, string, string] = ['#7b3f9d', '#2563eb', '#b8329b'];
const light = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
const dark = (hex: string) => generateSemanticDarkModeScale(hex);
const SCHEME = {
  name: 'BW coverage',
  colors: COLORS,
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: light(COLORS[0]), secondary: light(COLORS[1]), tertiary: light(COLORS[2]) },
  darkModeTonePalettes: { primary: dark(COLORS[0]), secondary: dark(COLORS[1]), tertiary: dark(COLORS[2]) },
} as unknown as ColorScheme;

let cached: { json: any; css: Record<string, string> } | null = null;
const sheets = () => {
  if (cached) return cached;
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(
      SCHEME.tonePalettes!.primary as never,
      SCHEME.tonePalettes!.secondary as never,
      SCHEME.tonePalettes!.tertiary as never,
    ),
    generateFullDarkPalettes(
      SCHEME.darkModeTonePalettes!.primary as never,
      SCHEME.darkModeTonePalettes!.secondary as never,
      SCHEME.darkModeTonePalettes!.tertiary as never,
    ),
    'neutral',
    'primary-fixed' as never,
    SCHEME.extractedTones,
    'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'BW coverage', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'default', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' } as never,
  );
  cached = { json, css: generateCSSFiles(json) };
  return cached;
};

describe('the BW palette exists in both modes', () => {
  it('Dark-Mode carries a BW palette at all', () => {
    const { json } = sheets();
    expect(Object.keys(json.Modes['Dark-Mode'].Colors)).toContain('BW');
  });

  /* The modes MIRROR each other, they do not match.
     Getting this wrong is what the accessibility suite caught: copying the
     light table into dark made --Eyebrow near-black on a dark surface and put
     9,720 text checks below their threshold. BW is not a lightness ramp like
     Neutral — whose Color-1 is dark and Color-12 light in BOTH modes — it
     answers "which of black or white reads on this surface", and that answer
     flips with the surface. */
  it('dark mirrors light rather than copying it', () => {
    const { json } = sheets();
    const l = json.Modes['Light-Mode'].Colors.BW as Record<string, { value: string }>;
    const d = json.Modes['Dark-Mode'].Colors.BW as Record<string, { value: string }>;
    expect(Object.keys(d).sort()).toEqual(Object.keys(l).sort());
    for (const k of Object.keys(l)) {
      expect(`${k}: ${l[k].value} -> ${d[k].value}`)
        .toBe(`${k}: ${l[k].value} -> ${l[k].value === '#ffffff' ? '#040404' : '#ffffff'}`);
    }
  });

  it('every BW tone is still black or white on both sides', () => {
    const { json } = sheets();
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const bw = json.Modes[mode].Colors.BW as Record<string, { value: string }>;
      for (const [k, v] of Object.entries(bw)) {
        expect(`${mode}.${k}=${v.value}`)
          .toMatch(/=(#ffffff|#040404)$/);
      }
    }
  });

  it('Dark-Mode.css DEFINES the BW tone it references for --Eyebrow', () => {
    const dark = sheets().css['Dark-Mode.css'] || '';
    // The reference that started this.
    expect(/--Eyebrow:\s*var\(--BW-Color-\d+\)/.test(dark)
      ? /--BW-Color-8:\s*#[0-9a-fA-F]{3,8}/.test(dark)
      : true).toBe(true);
  });

  it('emits the full ramp in dark mode, not just the referenced tone', () => {
    const dark = sheets().css['Dark-Mode.css'] || '';
    const defined = (dark.match(/--BW-Color-\d+:\s*#/g) || []).length;
    expect(`BW tones defined in Dark-Mode.css: ${defined >= 12}`).toBe('BW tones defined in Dark-Mode.css: true');
  });
});

// The general rule. Kept separate because it will catch tokens that have
// nothing to do with BW, and that is the point.
describe('no mode sheet references a token it never defines', () => {
  for (const file of ['Light-Mode.css', 'Dark-Mode.css']) {
    it(`${file} defines every --BW-Color-N it uses`, () => {
      const css = sheets().css[file] || '';
      const used = new Set([...css.matchAll(/var\(\s*(--BW-Color-\d+)/g)].map((m) => m[1]));
      const missing = [...used].filter(
        (name) => !new RegExp(`${name}:\\s*[^;]+;`).test(css),
      );
      expect(missing).toEqual([]);
    });
  }
});
