/**
 * Build a design system's published sheets the way the studio does, and grade
 * them with the rendered accessibility report.
 *
 * Shared by renderedContrast.test.ts (the brand x selection matrix) and any
 * test that needs "what does the page actually render for these choices".
 * The scheme is built the way ColorStage builds one, and the export is called
 * with the arguments generateDesignSystem passes, so a failure here is a
 * failure a published system would have.
 */
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../../utils/cssgen/exportColorSystem';
import { generateCSSFiles, generateBaseCSS } from '../../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../../utils/colorScale';
import { parseBackground, SURFACE_LEVELS, BACKGROUND_THEMES, formatBackground } from '../../utils/backgroundSelection';
import { buildRenderedAccessibilityReport, orderSheets } from '../../utils/renderedAccessibilityReport';
import type { ReportCheck, ReportSection } from '../../utils/accessibilityReport';
import type { ColorScheme } from '../../types';

export const BRANDS: Record<string, [string, string, string]> = {
  Cocktails: ['#849054', '#d06f71', '#be7d44'],
  Popsicle: ['#b771c6', '#00a8cc', '#d565a0'],
  Surf: ['#9d8a5c', '#009f87', '#e26801'],
  Chocolate: ['#b68143', '#cb771d', '#9c9078'],
  Grape: ['#7b3f9d', '#2563eb', '#b8329b'],
};

/** Every background the picker offers: Primary or Neutral at each level. */
export const BACKGROUNDS: string[] = BACKGROUND_THEMES.flatMap((theme) =>
  SURFACE_LEVELS.map((surface) => formatBackground({ theme, surface })));

/** Every Default-button choice, as generateDesignSystem maps it. */
export const BUTTONS: Record<string, string> = {
  primary: 'primary-fixed',
  secondary: 'secondary-fixed',
  tonal: 'tonal-fixed',
  laddered: 'laddered-fixed',
  match: 'match-fixed',
  'black-white': 'black-white',
};
export const CARDS = ['tonal', 'white', 'black'] as const;
export const TEXTS = ['tonal', 'black-white'] as const;

export interface Selection {
  background: string;
  button: string;
  cardColoring: typeof CARDS[number];
  textColoring: typeof TEXTS[number];
}

export function makeScheme(colors: [string, string, string]): ColorScheme {
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

const FACES = {
  header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
};

/** The tokens JSON and published CSS files for one brand + selection. */
export function buildSystem(colors: [string, string, string], sel: Selection) {
  const scheme = makeScheme(colors);
  const button = BUTTONS[sel.button] ?? 'primary-fixed';
  const bgTheme = parseBackground(sel.background).theme;
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
    bgTheme === 'Primary' ? 'primary' : 'neutral',
    button as never,
    scheme.extractedTones,
    'modern',
    FACES as never,
    'Rendered', undefined, undefined, undefined, 'light-tonal', undefined,
    {
      background: sel.background as never,
      button: button as never,
      cardColoring: sel.cardColoring as never,
      textColoring: sel.textColoring as never,
    },
  );
  (json as unknown as Record<string, unknown>)._userSelections = { ...sel };
  const files: Record<string, string> = { ...generateCSSFiles(json) };
  files['base.css'] = generateBaseCSS(json);
  return { json, files };
}

/** Run a function with the generator's console chatter switched off. */
export function quietly<T>(fn: () => T): T {
  const saved = { log: console.log, warn: console.warn, info: console.info, debug: console.debug };
  console.log = console.warn = console.info = console.debug = () => {};
  try { return fn(); } finally { Object.assign(console, saved); }
}

export interface Failure { mode: string; background: string; surfaceLevel: string; check: ReportCheck }

/** Every failing check the rendered report finds for one brand + selection. */
export function renderedFailures(colors: [string, string, string], sel: Selection): Failure[] {
  const { files } = quietly(() => buildSystem(colors, sel));
  const sections: ReportSection[] = buildRenderedAccessibilityReport({
    light: orderSheets(files, 'Light'),
    dark: orderSheets(files, 'Dark'),
  });
  const out: Failure[] = [];
  for (const s of sections) {
    for (const c of s.checks) {
      if (!c.passes) out.push({ mode: s.mode, background: s.background, surfaceLevel: s.surfaceLevel, check: c });
    }
  }
  return out;
}

/** A short, stable description of one failure, for messages. */
export const describeFailure = (f: Failure) =>
  `${f.mode} · ${f.background} · ${f.surfaceLevel} · ${f.check.label} (${f.check.token}) ` +
  `${f.check.fgColor} on ${f.check.bgColor} = ${f.check.ratio.toFixed(2)}:1 < ${f.check.required}`;
