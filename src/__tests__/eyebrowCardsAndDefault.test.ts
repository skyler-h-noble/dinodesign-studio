/**
 * Eyebrows on CARDS and on the Default theme, in both modes.
 *
 * Two bugs found on a published portfolio (2026-11-03):
 * - Dark mode: every themed card's eyebrow was solved against the SURFACE the
 *   card sits on, not the card, so a tone-7 Secondary surface's dark card
 *   (#2a1717) carried a dark eyebrow — 1.2-1.5:1 on all 25 palette-theme
 *   cards, while Text (solved against the card) passed.
 * - The Default theme routes its roles through Default-Background and the
 *   eyebrow was not among them, so it fell back to Text-Secondary: a body-copy
 *   tone, darker than the eyebrow solve picks.
 *
 * Fixture helpers are copied from eyebrowTones.test.ts.
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

const SCHEMES: Array<[string, [string, string, string]]> = [
  ['Cocktails', ['#849054', '#d06f71', '#be7d44']],
  ['Popsicle', ['#b771c6', '#00a8cc', '#d565a0']],
];
const LEVELS = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
const sel = { background: 'neutral', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;

for (const [name, colors] of SCHEMES) {
  describe(`eyebrows on cards and the Default theme — ${name}`, () => {
    const scheme = makeScheme(colors);
    for (const mode of ['Light-Mode', 'Dark-Mode'] as const) {
      const { json, figma } = buildAll(scheme, sel, mode === 'Dark-Mode' ? 'dark' : 'light') as any;

      it(`${mode}: every themed card's eyebrow clears 4.5:1 on all five card levels`, () => {
        const bad: string[] = [];
        let checked = 0;
        for (const [t, th] of Object.entries<any>(json.Modes[mode].Themes)) {
          const sec = th?.Containers;
          if (t === 'Default' || !sec?.Eyebrow) continue;
          const fg = refToHex(sec.Eyebrow.value, json, mode);
          if (!fg) continue;
          for (const level of LEVELS) {
            const bg = refToHex(String(sec[level]?.value ?? ''), json, mode);
            if (!bg) continue;
            checked++;
            const r = chroma.contrast(fg, bg);
            if (r < 4.5) bad.push(`${t}/${level}: ${fg} on ${bg} = ${r.toFixed(2)}`);
          }
        }
        expect(checked).toBeGreaterThan(20);
        expect(bad, bad.slice(0, 6).join('; ')).toEqual([]);
      });

      it(`${mode}: the Default theme's eyebrow comes from the Eyebrows table and passes`, () => {
        const def = json.Modes[mode].Themes.Default;
        expect(def.Surfaces.Eyebrow.value).toBe('{Default-Background.Eyebrow}');
        expect(def.Containers.Eyebrow.value).toBe('{Default-Background.Container-Eyebrow}');
        const bg = figma.Modes[mode]['Default-Background'];
        const pairs: Array<[string, string]> = [['Eyebrow', 'Surface'], ['Container-Eyebrow', 'Container']];
        for (const [fgKey, bgKey] of pairs) {
          const fg = bg?.[fgKey]?.value, b = bg?.[bgKey]?.value;
          expect(fg, `${fgKey} written`).toMatch(/^#/);
          expect(b, `${bgKey} written`).toMatch(/^#/);
          expect(chroma.contrast(fg, b)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
}

it('Popsicle light: the Default eyebrow is brighter than Text-Secondary, still passing', () => {
  const { figma } = buildAll(makeScheme(SCHEMES[1][1]), sel, 'light') as any;
  const bg = figma.Modes['Light-Mode']['Default-Background'];
  const eb = chroma.contrast(bg.Eyebrow.value, bg.Surface.value);
  const ts = chroma.contrast(bg['Text-Secondary'].value, bg.Surface.value);
  expect(eb).toBeGreaterThanOrEqual(4.5);
  expect(eb).toBeLessThan(ts);
});
