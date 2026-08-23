/**
 * Token parity — the preview, the exported CSS and the Figma payload must agree.
 *
 * This drives the REAL pipeline. The older parity.test.ts reimplements each
 * mapping inside the test and compares the two copies to each other, so it
 * passes whatever buildPreviewCSS actually does; these tests call
 * buildPreviewCSS / exportColorSystemToJSON / generateFigmaJSON and compare
 * their outputs.
 *
 * Why it matters: every colour bug found this week was preview-side while the
 * export was correct, because the preview carries its own private contrast
 * implementation (getAccessibleTones lives in buildPreviewCSS.ts and is used
 * nowhere else). Nothing failed when they diverged — a person had to notice a
 * periwinkle button. This is the detector.
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
 *  the picked colours (see the lockedHex fix in ColorStage). */
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


import { generateFigmaJSON as figmaGen } from '../utils/generateFigmaJSON';

/**
 * Surface-Brightest — the fifth surface level.
 *
 * It absorbs the <Palette>-Light themes: their Surface was tone 11, so landing
 * there makes the replacement the same colour rather than an approximation.
 * When Surface sits at 10 its Bright already occupies 11, so Brightest steps to
 * 12; above that the ramp is exhausted and it paints white.
 *
 * The tone rule is written in THREE places — generateCompleteThemes (the
 * theme), exportToCSS (Default's CSS indirection) and generateFigmaJSON
 * (Default's Figma indirection). They must agree, or Default's brightest
 * surface pairs foregrounds solved for one tone with a background painted at
 * another.
 */

/**
 * Every reference in the generated CSS must reach a variable that exists.
 *
 * The cheapest guard against this codebase's most common failure: one concept
 * declared in several places, one copy falling behind. An undefined custom
 * property is NOT an error — CSS drops the declaration and the element keeps
 * what it inherited — so a broken reference looks like a slightly wrong colour,
 * or like nothing at all.
 *
 * It caught a real one on its first run: --Default-Background-Surface-Brightest.
 * The Default theme routes its surfaces through the Default-Background
 * indirection, which is load-bearing — it is how a mode-INDEPENDENT theme layer
 * gets a mode-DEPENDENT tone (see the comment above overrideSurface). That
 * routing is hand-maintained in THREE places: overrideSurface in
 * generateCompleteThemes, tokenLookup in exportToCSS, and ROLE_SOURCES in
 * generateFigmaJSON. Surface-Brightest went into the first and not the second,
 * and every [data-theme="Default"][data-surface="Surface-Brightest"] painted
 * its parent's background instead.
 *
 * Asserting RESOLUTION rather than asserting the three lists match is
 * deliberate: it catches the same class of bug arriving by any route.
 */
describe('every reference resolves', () => {
  // Default's palette and tone follow the background selection, so the
  // indirection resolves differently for each one.
  const BACKGROUNDS = ['primary', 'white', 'black'] as const;

  for (const background of BACKGROUNDS) {
    it(`leaves no dangling var() with background="${background}"`, () => {
      const sel = { background, button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
      const { json } = buildAll(SCHEME, sel, 'light') as any;
      const files = generateCSSFiles(json);

      const defined = new Set<string>();
      for (const m of Object.values(files).join('\n').matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);

      for (const mode of ['Light-Mode', 'Dark-Mode'] as const) {
        const css = files[`${mode}.css`] || '';
        const dangling = new Map<string, string>();
        let blocks = 0;
        for (const blk of css.split('}')) {
          const sel2 = (blk.split('{')[0] || '').replace(/\s+/g, ' ').trim();
          if (!/\[data-theme="[^"]+"\]\[data-surface="[^"]+"\]/.test(sel2)) continue;
          blocks++;
          for (const m of (blk.split('{')[1] || '').matchAll(/var\((--[\w-]+)/g)) {
            if (!defined.has(m[1]) && !dangling.has(m[1])) dangling.set(m[1], sel2.slice(0, 70));
          }
        }
        expect(blocks, `${mode}: no theme/surface blocks emitted at all`).toBeGreaterThan(0);
        expect(
          [...dangling].map(([v, s]) => `${v} @ ${s}`),
          `${mode} references variables nothing defines`,
        ).toEqual([]);
      }
    });
  }
});
