/**
 * Token parity — the preview, the exported CSS and the Figma payload must agree.
 *
 * This drives the REAL pipeline. The older parity.test.ts reimplements each
 * mapping inside the test and compares the two copies to each other, so it
 * passes whatever buildPreviewCSS actually does; these tests call
 * buildPreviewCSS / exportColorSystemToJSON / generateFigmaJSON and compare
 * their outputs.
 *
 * Why it matters: every color bug found this week was preview-side while the
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


/**
 * A state surface only offers its own button, plus Neutral and BlackWhite.
 *
 * The wrong choice is made unavailable rather than discouraged: a Primary
 * button on a warning banner competes with the message the surface exists to
 * deliver, and nothing in Figma signalled that. The variable still exists, so
 * nothing unbinds — it just resolves to the state's button.
 */
describe('state background buttons', () => {
  const sel = { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
  const { json } = buildAll(SCHEME, sel, 'light') as any;
  const STATES = ['Info', 'Success', 'Warning', 'Error'];

  const buttonsOf = (mode: string, theme: string, section = 'Surfaces') =>
    json.Modes[mode]?.Themes?.[theme]?.[section]?.Buttons || {};

  it('redirects every foreign palette to the state, in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      for (const st of STATES) {
        for (const theme of [st, `${st}-Light`]) {
          const b = buttonsOf(mode, theme);
          if (!Object.keys(b).length) continue;
          const own = b[st]?.Button?.value;
          expect(own, `${mode}/${theme} has no ${st} button`).toBeTruthy();
          for (const [pal, e] of Object.entries<any>(b)) {
            if (['Neutral', 'BlackWhite'].includes(pal)) continue;
            expect(e?.Button?.value, `${mode}/${theme}/${pal} was not redirected`).toBe(own);
          }
        }
      }
    }
  });

  it('keeps Neutral and BlackWhite as their own', () => {
    // The two neutral voices — a quiet secondary action and a high-contrast
    // one. Neither competes with the state color, so both survive.
    for (const st of STATES) {
      const b = buttonsOf('Light-Mode', st);
      expect(b.Neutral?.Button?.value).toContain('Buttons.Neutral');
      expect(b.BlackWhite?.Button?.value).toContain('Buttons.BlackWhite');
    }
  });

  it('redirects the WHOLE entry, not just the fill', () => {
    // Copying Button alone would leave the border, hover, pressed and
    // Outline-Text on the old palette — an Info button with a Primary edge.
    const b = buttonsOf('Light-Mode', 'Info');
    for (const key of ['Button', 'Text', 'Border', 'Hover', 'Pressed', 'Outline-Text']) {
      expect(b.Primary?.[key]?.value, `${key} not redirected`).toBe(b.Info?.[key]?.value);
    }
  });

  it('leaves non-state themes alone', () => {
    const b = buttonsOf('Light-Mode', 'Primary');
    const fills = new Set(Object.values<any>(b).map((e) => e?.Button?.value));
    // Ten palettes, and they must stay distinguishable on a brand surface.
    expect(fills.size).toBeGreaterThan(5);
    expect(b.Secondary?.Button?.value).not.toBe(b.Primary?.Button?.value);
  });

  it('does not remove any palette', () => {
    // Redirect, never delete: a missing variable unbinds every layer using it,
    // and a re-import cannot restore the id.
    const state = Object.keys(buttonsOf('Light-Mode', 'Info'));
    const brand = Object.keys(buttonsOf('Light-Mode', 'Primary'));
    expect(state.sort()).toEqual(brand.sort());
  });
});

/**
 * State buttons are TONAL: the fill takes the border's tone on every surface,
 * so it carries the 3:1 the border was chosen for — where it used to be one
 * fixed tone that matched the background on the plain Surface level (1.00:1).
 */
describe('tonal state buttons', () => {
  const sel = { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
  const { json, previewCss, figma } = buildAll(SCHEME, sel, 'light') as any;
  const STATES = ['Info', 'Success', 'Warning', 'Error'];
  const LEVELS = ['Surfaces-Dimmest', 'Surfaces-Dim', 'Surfaces', 'Surfaces-Bright', 'Surfaces-Brightest'];

  it('fill = border, 3:1 against the surface, and a 4.5:1 label — every theme, level and mode', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode'] as const) {
      for (const [theme, data] of Object.entries<any>(json.Modes[mode].Themes)) {
        for (const level of LEVELS) {
          const s = data[level];
          const bg = s && refToHex(s.Background?.value ?? s.Background, json, mode);
          if (!bg) continue;
          for (const st of STATES) {
            const b = s.Buttons?.[st];
            if (!b) continue;
            const fill = refToHex(b.Button.value, json, mode);
            const label = refToHex(b.Text.value, json, mode);
            const where = `${mode}/${theme}/${level}/${st}`;
            expect(fill, where).toBe(refToHex(b.Border.value, json, mode));
            expect(chroma.contrast(fill!, bg), `${where} fill vs surface`).toBeGreaterThanOrEqual(3);
            expect(chroma.contrast(fill!, label!), `${where} label`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it('the fill moves with the level — never one tone everywhere', () => {
    const fills = new Set(LEVELS.map((lv) => refToHex(json.Modes['Light-Mode'].Themes.Primary[lv].Buttons.Info.Button.value, json, 'Light-Mode')));
    expect(fills.size).toBeGreaterThan(2);
  });

  it('on a state surface the Default button is the tonal state button', () => {
    const s = json.Modes['Light-Mode'].Themes.Info.Surfaces.Buttons;
    expect(s.Default.Button.value).toBe(s.Info.Button.value);
  });

  it('the preview paints the same state button as the export', () => {
    // The preview's Primary theme block sits on Primary at the primary tone, as the export's Surfaces level does.
    const start = previewCss.indexOf('[data-theme="Primary"][data-surface="Surface"] {');
    const block = previewCss.slice(start, previewCss.indexOf('}', start));
    const pick = (v: string) => ((block.match(new RegExp(`${v}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1] || '').toLowerCase();
    const b = json.Modes['Light-Mode'].Themes.Primary.Surfaces.Buttons;
    for (const st of STATES) {
      for (const k of ['Button', 'Text', 'Hover', 'Pressed']) {
        expect(pick(`--Buttons-${st}-${k}`), `${st} ${k}`).toBe(refToHex(b[st][k].value, json, 'Light-Mode')?.toLowerCase());
      }
    }
  });

  it('Figma: the Theme layer points at Tonal-Button, which has the same variables in both modes', () => {
    const info = figma.Themes.Primary.Surface.Buttons.Info;
    expect(info.Button.value).toMatch(/^\{Tonal-Button\.Surfaces\.Info\.Color-\d+\.Button\}$/);
    expect(info.Border.value).toBe(info.Button.value);   // the border IS the fill
    const keys = (m: string) => JSON.stringify(Object.keys(figma.Modes[m]['Tonal-Button'].Surfaces.Info).sort());
    expect(keys('Light-Mode')).toBe(keys('Dark-Mode'));
    // Every Tonal-Button value is a color Figma can parse: hex, the bevel with its opacity as alpha.
    for (const m of ['Light-Mode', 'Dark-Mode']) {
      for (const entry of Object.values<any>(figma.Modes[m]['Tonal-Button'].Surfaces.Info)) {
        for (const [k, v] of Object.entries<any>(entry)) expect(v.value, `${m} ${k}`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
      }
    }
  });
});

describe('Figma Modes stays under the collection limit', () => {
  it('fewer than 5,000 variables — Figma refuses a collection past it', () => {
    const { figma } = buildAll(SCHEME, { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never, 'light') as any;
    const count = (o: any): number => (o && typeof o === 'object' ? ('value' in o ? 1 : Object.values(o).reduce((t: number, v: any) => t + count(v), 0)) : 0);
    // Each mode holds the same variables; the larger is the collection's size.
    const size = Math.max(count(figma.Modes['Light-Mode']), count(figma.Modes['Dark-Mode']));
    expect(size).toBeLessThan(5000);
  });
});
