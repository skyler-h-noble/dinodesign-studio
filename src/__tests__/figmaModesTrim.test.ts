/**
 * The Figma Modes trim (generateFigmaJSON.ts, "Drop what nothing in Figma reads")
 * may not cut off a reader: every reference in the payload into a Modes group
 * resolves to a variable the payload still emits, in both modes, for every
 * button style across very different brands. And Modes stays well under
 * Figma's 5,000-variable ceiling, which an additive import can only add to.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import { buildAccessibilityReport } from '../utils/accessibilityReport';
import type { ColorScheme, UserSelections } from '../types';

// ─── Fixture ─────────────────────────────────────────────────────────────────

/** A scheme built the way ColorStage builds one, so the palettes pass through
 *  the picked colors (see the lockedHex fix in ColorStage). */
function makeScheme(colors: [string, string, string]): ColorScheme {
  const light = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
  const dark = (hex: string) => generateSemanticDarkModeScale(hex);
  return {
    name: 'Test',
    colors,
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

/** Everything downstream of one set of user choices. */
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
    sel.background === 'primary' || sel.background === 'primary-light' ? 'primary' : 'neutral',
    (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
    scheme.extractedTones,
    'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'Parity', undefined, undefined, undefined, 'light-tonal', undefined,
    {
      background: sel.background as never,
      button: (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
      cardColoring: sel.cardColoring as never,
      textColoring: sel.textColoring as never,
    },
  );

  // generateDesignSystem attaches this before calling the Figma generator.
  // Omitting it makes every palette lookup fall back to Primary, so the
  // harness reports divergences the real pipeline does not have.
  (json as unknown as Record<string, unknown>)._userSelections = {
    background: sel.background, button: sel.button,
    cardColoring: sel.cardColoring, textColoring: sel.textColoring,
  };
  return { previewCss, json, figma: generateFigmaJSON(json) };
}

const SCHEME = makeScheme(['#7b3f9d', '#2563eb', '#b8329b']);

/** Resolve a {Colors.Pal.Color-N} / {Text...} reference to a hex. */
function refToHex(ref: string, json: any, mode: 'Light-Mode' | 'Dark-Mode'): string | null {
  let cur: any = ref;
  for (let hop = 0; hop < 8 && typeof cur === 'string' && cur.startsWith('{'); hop++) {
    const path = cur.slice(1, -1).split('.');
    let node: any = json.Modes?.[mode];
    for (const k of path) node = node?.[k];
    if (node === undefined) { node = json; for (const k of path) node = node?.[k]; }
    cur = typeof node === 'string' ? node : node?.value;
  }
  return typeof cur === 'string' && cur.startsWith('#') ? cur : null;
}



const walk = (o: any, path: string[], fn: (p: string, v: any) => void) => {
  if (!o || typeof o !== 'object') return;
  if ('value' in o) { fn(path.join('.'), o); return; }
  for (const [k, v] of Object.entries(o)) walk(v, [...path, k], fn);
};
const refsIn = (v: any): string[] => (typeof v === 'string' ? [...v.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]) : []);

describe('Figma Modes trim', () => {
  const BRANDS: [string, string, string][] = [['#7b3f9d', '#2563eb', '#b8329b'], ['#f2c94c', '#2d9cdb', '#27ae60'], ['#222222', '#999999', '#dddddd']];
  const BUTTONS = ['primary', 'secondary', 'tonal', 'laddered', 'black-white'];

  it('leaves no reference pointing at a name it trimmed', () => {
    const dangling: string[] = [];
    for (const brand of BRANDS) for (const button of BUTTONS) {
      const { figma } = buildAll(makeScheme(brand), { background: 'primary', button, cardColoring: 'tonal', textColoring: 'tonal' } as never, 'light') as any;
      for (const mode of ['Light-Mode', 'Dark-Mode']) {
        const names = new Set<string>();
        walk(figma.Modes[mode], [], (p) => names.add(p));
        const groups = new Set(Object.keys(figma.Modes[mode]));
        const check = (where: string, v: any) => {
          for (const r of refsIn(v.value)) {
            const key = r.replace(/^Modes\.(Light|Dark)-Mode\./, '');
            if (groups.has(key.split('.')[0]) && !names.has(key)) dangling.push(`${button} ${mode} ${where} -> ${key}`);
          }
        };
        for (const [coll, data] of Object.entries<any>(figma)) {
          if (coll === 'Modes') walk(data[mode], [], (p, v) => check(`Modes.${p}`, v));
          else walk(data, [coll], (p, v) => check(p, v));
        }
      }
    }
    expect(dangling.slice(0, 10), `${dangling.length} dangling`).toEqual([]);
  });

  it('keeps the variable a template layer binds directly', () => {
    const { figma } = buildAll(makeScheme(BRANDS[0]), { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never, 'light') as any;
    expect(figma.Modes['Light-Mode'].Buttons.Neutral.Border).toBeTruthy();
  });

  it('trims what nothing reads, and leaves Modes room under 5,000', () => {
    const { figma } = buildAll(makeScheme(BRANDS[0]), { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never, 'light') as any;
    const M = figma.Modes['Light-Mode'];
    expect(Object.keys(M['Button-Hover'])).toEqual(['BlackWhite']);
    expect(Object.keys(M['Default-Button'])).toEqual(['Default']);
    expect(M.Buttons.Info).toBeUndefined();
    expect(M.Buttons.Primary.Border).toBeUndefined();
    let n = 0; walk(M, [], () => n++);
    expect(n).toBeLessThan(4300);
  });
});
