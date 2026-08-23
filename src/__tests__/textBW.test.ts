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
import { generateFigmaJSON as figmaGen } from '../utils/generateFigmaJSON';
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


/**
 * --Text-BW: black or white text for the background it sits on.
 *
 * It references Default-Button-Border.<scope>.BlackWhite.<Color-N> rather than
 * restating "white below tone 6, black from 6 up". That map is the same one the
 * BlackWhite button face uses, so the two cannot end up disagreeing about where
 * the flip happens.
 */
const figmaOf = (j: any) => {
  j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100, cardPadding: 24,
    buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, bevel: 17 };
  return figmaGen(j);
};

describe('Text-BW', () => {
  const sel = { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
  const { json } = buildAll(SCHEME, sel, 'light') as any;

  const sections = (mode: string) => {
    const out: any[] = [];
    for (const t of Object.values<any>(json.Modes[mode].Themes)) {
      for (const s of Object.values<any>(t || {})) {
        if (s && typeof s === 'object' && (s as any)['Text-Primary']) out.push(s);
      }
    }
    return out;
  };

  it('is on essentially every painted surface, in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const all = sections(mode);
      const withBW = all.filter((s) => s['Text-BW']);
      expect(all.length).toBeGreaterThan(50);
      expect(withBW.length).toBeGreaterThan(all.length * 0.9);
    }
  });

  it('references a map rather than a literal', () => {
    // A hex here would be the bug: it would freeze the flip point at the moment
    // of generation and drift from the button face that shares the rule.
    //
    // Two legitimate shapes. Most themes point straight at the BlackWhite map.
    // The Default theme points at Default-Background instead, because its
    // background depends on the user's selection AND differs per mode, while
    // the Theme layer carries one value for both — so the mode-dependence has
    // to live in the indirection rather than in a baked tone.
    for (const s of sections('Light-Mode')) {
      if (!s['Text-BW']) continue;
      expect(String(s['Text-BW'].value)).toMatch(
        /^\{(Default-Button-Border\.(Surfaces|Containers)\.BlackWhite\.Color-[\w-]+|Default-Background\.[\w-]*Text-BW)\}$/,
      );
    }
  });

  it('resolves to only black or white, and actually flips', () => {
    const seen = new Set<string>();
    for (const s of sections('Light-Mode')) {
      if (!s['Text-BW']) continue;
      const hex = refToHex(s['Text-BW'].value, json, 'Light-Mode');
      if (hex) seen.add(hex.toLowerCase());
    }
    // Both must appear. One value everywhere would mean the tone is not being
    // read from the background at all.
    expect(seen.size).toBe(2);
    expect([...seen].every((h) => /^#(0[0-9a-f]{5}|f{6}|ffffff)$/.test(h) || h === '#040404' || h === '#ffffff')).toBe(true);
  });

  it('takes its tone from the surface it is on, not a fixed one', () => {
    const tones = new Set<string>();
    for (const s of sections('Light-Mode')) {
      if (!s['Text-BW']) continue;
      const t = String(s['Text-BW'].value).match(/(Color-[\w-]+)\}$/)?.[1];
      if (t) tones.add(t);
    }
    expect(tones.size).toBeGreaterThan(5);
  });

  it('covers the Default theme too, via the Default-Background indirection', () => {
    // The plugin builds its Figma variable list from the FIRST theme, so a role
    // missing from Default gets no variable for ANY theme. Default's Surface,
    // Surface-Dim and Surface-Bright route foregrounds through
    // Default-Background and carry no Color-N to read a tone from — they must
    // reference the indirection instead of being skipped.
    const d = json.Modes['Light-Mode'].Themes['Default'];
    for (const sn of ['Surfaces', 'Surfaces-Dim', 'Surfaces-Bright', 'Surfaces-Dimmest', 'Containers']) {
      expect(d?.[sn]?.['Text-BW']?.value, `Default/${sn} has no Text-BW`).toBeTruthy();
    }
    expect(String(d.Surfaces['Text-BW'].value)).toBe('{Default-Background.Text-BW}');
    expect(String(d['Surfaces-Dim']['Text-BW'].value)).toBe('{Default-Background.Surface-Dim-Text-BW}');
  });

  it('resolves in the Figma payload for every Default surface', () => {
    // Default's surfaces reach Text-BW through {Default-Background.*Text-BW},
    // and that section is built from ROLE_SOURCES in generateFigmaJSON — a
    // SEPARATE list from the CSS one. Missing there, the aliases pointed at a
    // key that did not exist and resolved to nothing, while Containers linked
    // fine because it needs no indirection.
    const f: any = figmaOf(json);
    const db = f.Modes?.['Light-Mode']?.['Default-Background'] || {};
    for (const key of ['Text-BW', 'Surface-Dim-Text-BW', 'Surface-Bright-Text-BW']) {
      expect(db[key]?.value, `Default-Background.${key} missing`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // And it must actually flip, not be one colour everywhere.
    expect(db['Surface-Dim-Text-BW'].value).not.toBe(db['Surface-Bright-Text-BW'].value);
  });

  it('reaches the CSS as --Text-BW', () => {
    const light = generateCSSFiles(json)['Light-Mode.css'] || '';
    const decls = light.match(/^\s*--Text-BW:\s*[^;]+;/gm) || [];
    expect(decls.length).toBeGreaterThan(50);
  });
});
