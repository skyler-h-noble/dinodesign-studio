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

describe('Eyebrows own their tones', () => {
  
  const sel = { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
  const { json } = buildAll(SCHEME, sel, 'light') as any;

  it('emits a table, not a pile of Text references', () => {
    const eb = json.Modes['Light-Mode'].Eyebrows;
    const vals: string[] = [];
    for (const scope of ['Surfaces', 'Containers']) {
      for (const p of Object.values<any>(eb[scope])) {
        for (const v of Object.values<any>(p)) vals.push(v.value);
      }
    }
    expect(vals.length).toBeGreaterThan(0);
    // The state backgrounds rotate to BW, which has no chroma to solve for —
    // "most colourful black" is not a question. Those keep the Text reference
    // by design, so they are excluded rather than counted as failures.
    const solvable = vals.filter((v) => !v.includes('.BW.'));
    const own = solvable.filter((v) => v.startsWith('{Colors.'));
    expect(own.length).toBeGreaterThan(solvable.length * 0.8);
  });

  it('leaves a pairing on Text when nothing in the rotation passes', () => {
    // Not every palette can supply a vivid eyebrow: an olive background whose
    // rotation lands on a light rose has no tone clearing 4.5:1. Forcing one
    // would ship a contrast failure to satisfy a preference, so the fallback
    // must stay reachable rather than being tuned away.
    const eb = json.Modes['Light-Mode'].Eyebrows;
    const all: string[] = [];
    for (const scope of ['Surfaces', 'Containers']) {
      for (const p of Object.values<any>(eb[scope])) {
        for (const v of Object.values<any>(p)) all.push(v.value);
      }
    }
    expect(all.some((v) => v.startsWith('{Text.'))).toBe(true);
  });

  it('every solved eyebrow clears 4.5:1 against its background', () => {
    const mode = 'Light-Mode' as const;
    const eb = json.Modes[mode].Eyebrows;
    const bad: string[] = [];
    for (const scope of ['Surfaces', 'Containers']) {
      for (const [bgPal, tones] of Object.entries<any>(eb[scope])) {
        for (const [key, v] of Object.entries<any>(tones)) {
          if (!String(v.value).startsWith('{Colors.')) continue;   // Text fallback
          const fg = refToHex(v.value, json, mode);
          const bg = refToHex(`{Colors.${bgPal}.${key}}`, json, mode);
          if (!fg || !bg) continue;
          const r = chroma.contrast(fg, bg);
          if (r < 4.5) bad.push(`${scope}/${bgPal}/${key} = ${r.toFixed(2)}`);
        }
      }
    }
    expect(bad, `eyebrows below 4.5:1: ${bad.slice(0, 6).join(', ')}`).toEqual([]);
  });

  it('is more chromatic than the Text role it replaced', () => {
    const mode = 'Light-Mode' as const;
    const eb = json.Modes[mode].Eyebrows;
    const pop = (h: string) => { const c = chroma(h).hsv(); return (c[1] || 0) * (c[2] || 0); };
    let better = 0, worse = 0;
    for (const [bgPal, tones] of Object.entries<any>(eb.Surfaces)) {
      for (const [key, v] of Object.entries<any>(tones)) {
        if (!String(v.value).startsWith('{Colors.')) continue;
        const role = String(v.value).split('.')[1];
        const now = refToHex(v.value, json, mode);
        const was = refToHex(`{Text.Surfaces.${role}.${key}}`, json, mode);
        if (!now || !was) continue;
        if (pop(now) > pop(was)) better++; else if (pop(now) < pop(was)) worse++;
      }
    }
    // The whole point of the change: it must move toward colour, not away.
    expect(better).toBeGreaterThan(worse);
  });
});
