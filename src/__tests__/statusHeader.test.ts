/**
 * A status section's heading comes from its OWN palette.
 *
 * "Info should have info color for heading, success a success color, etc."
 *
 * Every theme's Header used to read the Primary header table, so a pink brand
 * painted pink headings on its Info, Success, Warning and Error sections (in
 * both modes, on every surface level). Status themes now read
 * Header.{Surfaces,Containers}.<Status>.Color-N, the same curated 3:1 table
 * each palette's own Header-<Status> already used.
 *
 * Checked on all three sides: the export JSON and its CSS, the Figma payload,
 * and the studio preview (resolved against the lib's static sheet it layers
 * over). Header is a 3:1 role.
 */
/* The export and Figma payloads are deep untyped token trees; walking them
   here is deliberately untyped, as in tokenParity.test.ts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale, getMatchingPeakChroma } from '../utils/colorScale';
import { contrastRatio } from '../utils/quietOpacity';
import type { ColorScheme } from '../types';

const STATUS = ['Info', 'Success', 'Warning', 'Error'] as const;
const LEVELS = ['Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest'];
const T = { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false };
const SEL = { background: 'white', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' };

function scheme(colors: [string, string, string]): ColorScheme {
  const light = (hex: string) => generateSemanticLightModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, false)), 70), hex);
  const dark = (hex: string) => generateSemanticDarkModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, true)), 42));
  return {
    name: 'H', colors, originalColors: colors,
    extractedTones: { primary: chroma(colors[0]).lch()[0], secondary: chroma(colors[1]).lch()[0], tertiary: chroma(colors[2]).lch()[0] },
    tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
    darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
  } as unknown as ColorScheme;
}
function exportFor(s: ColorScheme) {
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(s.tonePalettes.primary as never, s.tonePalettes.secondary as never, s.tonePalettes.tertiary as never),
    generateFullDarkPalettes(s.darkModeTonePalettes.primary as never, s.darkModeTonePalettes.secondary as never, s.darkModeTonePalettes.tertiary as never),
    'neutral', 'primary-fixed' as never, s.extractedTones, 'modern', { header: T, decorative: T, body: T } as never,
    'H', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'white', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' } as never,
  ) as unknown as Record<string, any>;
  json._userSelections = SEL;
  return json;
}

type Block = { sel: string; decl: Record<string, string> };
function blocks(css: string): Block[] {
  const out: Block[] = [];
  for (const b of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
    const i = b.indexOf('{');
    if (i < 0) continue;
    const decl: Record<string, string> = {};
    for (const m of b.slice(i + 1).matchAll(/--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) decl[m[1]] = m[2].trim();
    out.push({ sel: b.slice(0, i).trim(), decl });
  }
  return out;
}
/** Declarations for an exact `[data-theme="T"][data-surface="L"]` selector, later sheets winning. */
function scopeDecl(sheets: string[], theme: string, level: string): Record<string, string> {
  const out: Record<string, string> = {};
  const exact = `[data-theme="${theme}"][data-surface="${level}"]`;
  const wildcard = `[data-theme="${theme}"][data-surface]`;
  for (const css of sheets) {
    for (const b of blocks(css)) {
      const sels = b.sel.split(',').map((x) => x.trim());
      if (sels.includes(exact) || sels.includes(wildcard)) Object.assign(out, b.decl);
    }
  }
  return out;
}
function rootDecl(sheets: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const css of sheets) for (const b of blocks(css)) if (/^:root$/.test(b.sel)) Object.assign(out, b.decl);
  return out;
}
/** Resolve a value to [hex, the Color variable it came from]. */
function resolve(v: string | undefined, scope: Record<string, string>, root: Record<string, string>): [string | null, string | null] {
  let name: string | null = null;
  for (let k = 0; k < 8 && v; k++) {
    const m = v.match(/^var\(--([A-Za-z0-9-]+)\s*(?:,\s*(.+))?\)$/);
    if (!m) break;
    if (/-Color-\d+$/.test(m[1])) name = m[1];
    v = scope[m[1]] ?? root[m[1]] ?? m[2];
  }
  return [v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null, name];
}

const BRANDS: [string, string, string][] = [
  ['#e0408a', '#f2b33d', '#3fa7a0'],
  ['#b5e61d', '#7b3f9d', '#f97316'],
  ['#2563eb', '#0f766e', '#eab308'],
];

describe('export: status headings come from their own palette and clear 3:1', () => {
  it.each(BRANDS)('%s', (...colors) => {
    const json = exportFor(scheme(colors as [string, string, string]));
    const css = generateCSSFiles(json as never) as Record<string, string>;
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      for (const theme of STATUS) {
        const node = json.Modes[mode].Themes[theme];
        for (const [section, data] of Object.entries<any>(node)) {
          const branch = section.startsWith('Containers') ? 'Containers' : 'Surfaces';
          expect(data.Header.value, `${mode} ${theme}/${section}`).toMatch(new RegExp(`^\\{Header\\.${branch}\\.${theme}\\.Color-\\d+\\}$`));
        }
        const sheet = css[`${mode}.css`];
        const root = rootDecl([sheet]);
        for (const level of LEVELS) {
          const scope = scopeDecl([sheet], theme, level);
          const [bg] = resolve(scope.Background, scope, root);
          const [head, from] = resolve(scope.Header, scope, root);
          expect(bg && head, `${mode} ${theme}/${level}`).toBeTruthy();
          expect(from, `${mode} ${theme}/${level} heading palette`).toMatch(new RegExp(`^${theme}-Color-\\d+$`));
          expect(contrastRatio(head!, bg!), `${mode} ${theme}/${level} ${head} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  }, 60_000);
});

describe('Figma: the Theme collection binds status headings to their own palette', () => {
  it('every status section Header aliases Header.<branch>.<Status>', () => {
    const figma = generateFigmaJSON(exportFor(scheme(BRANDS[0])) as never) as any;
    for (const theme of STATUS) {
      for (const [section, data] of Object.entries<any>(figma.Themes[theme])) {
        if (!data?.Header) continue;
        expect(String(data.Header.value), `${theme}/${section}`).toMatch(new RegExp(`^\\{Header\\.(Surfaces|Containers)\\.${theme}\\.Color-\\d+\\}$`));
      }
    }
  });
});

describe('preview: status headings follow their own palette over the lib sheet', () => {
  const require = createRequire(import.meta.url);
  const libDir = require.resolve('@omni-design/components/public/styles/Light-Mode.css').replace(/Light-Mode\.css$/, '');
  it.each(['light', 'dark'] as const)('%s mode', (mode) => {
    const lib = readFileSync(libDir + (mode === 'light' ? 'Light-Mode.css' : 'Dark-Mode.css'), 'utf8');
    const preview = buildPreviewCSS({ colorScheme: scheme(BRANDS[0]), userSelections: SEL, componentStyle: 'modern', mode, typographyStyles: [] } as never);
    const sheets = [lib, preview];
    const root = rootDecl(sheets);
    let checked = 0;
    for (const theme of STATUS) {
      for (const level of LEVELS) {
        const scope = scopeDecl(sheets, theme, level);
        const [bg] = resolve(scope.Background, scope, root);
        const [head, from] = resolve(scope.Header, scope, root);
        if (!bg || !head) continue; // a level the lib does not define
        expect(from, `${mode} ${theme}/${level}`).toMatch(new RegExp(`^${theme}-Color-\\d+$`));
        expect(contrastRatio(head, bg), `${mode} ${theme}/${level} ${head} on ${bg}`).toBeGreaterThanOrEqual(3);
        checked++;
      }
    }
    expect(checked).toBe(STATUS.length * LEVELS.length);
  });
});
