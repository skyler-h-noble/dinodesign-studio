/**
 * Buttons › Match — the theme's own Buttons palette, per theme and level.
 *
 * Covers the helper (buttonsMatch.ts), both emitters on a real generated
 * system (the CSS export and the Figma payload must carry the same thing —
 * invariant 5), and the contrast claim Match rests on: in every theme and
 * surface level, Match's Border (the outline / progress-fill edge, the 3:1
 * role) clears 3:1 against that level's Background, in both modes.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import { matchPaletteFor, withButtonsMatchCSS, addButtonsMatchToThemes } from '../utils/buttonsMatch';
import { THEME_MODES } from '../utils/themes';
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
  match: 'match-fixed',
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
      // The tone fields, as generateDesignSystem passes them.
      buttonTone: sel.buttonTone,
      buttonCellTones: sel.buttonCellTones as never,
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


// ─── The helper ──────────────────────────────────────────────────────────────

describe('buttonsMatch helper', () => {
  it('maps a theme to its own palette; bar themes have none', () => {
    expect(matchPaletteFor('Default')).toBe('Default');
    expect(matchPaletteFor('Primary')).toBe('Primary');
    expect(matchPaletteFor('Error')).toBe('Error');
    expect(matchPaletteFor('App-Bar')).toBeNull();
  });

  it('aliases Match to the block\'s own theme palette, in the same block', () => {
    const css = '[data-theme="Success"][data-surface="Surface"] {\n  --Buttons-Success-Border: #123456;\n  --Buttons-Primary-Border: #654321;\n}';
    const out = withButtonsMatchCSS(css);
    expect(out).toContain('--Buttons-Match-Border: var(--Buttons-Success-Border);');
    expect(out).not.toContain('var(--Buttons-Primary-Border)');
  });

  it('treats a block that names no theme as Default, and skips bar themes', () => {
    expect(withButtonsMatchCSS(':root {\n  --Buttons-Default-Button: #111;\n}')).toContain('--Buttons-Match-Button: var(--Buttons-Default-Button);');
    const bar = '[data-theme="App-Bar"] {\n  --Buttons-Default-Button: #111;\n}';
    expect(withButtonsMatchCSS(bar)).toBe(bar);
  });

  it('copies the palette group in the payload data', () => {
    const themes: Record<string, any> = { Primary: { Surface: { Buttons: { Primary: { Border: { value: '{X}' } } } } } };
    addButtonsMatchToThemes(themes);
    expect(themes.Primary.Surface.Buttons.Match).toEqual({ Border: { value: '{X}' } });
  });
});

// ─── On a generated system ───────────────────────────────────────────────────

const SEL = { background: 'neutral', button: 'primary', cardColoring: 'tonal', textColoring: 'standard' } as unknown as UserSelections;
const LEVELS = ['Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest'];

/** Resolve a CSS value to a hex: a literal, or var(--X) looked up first in the
 *  block, then anywhere in the file (the palette ramps sit at :root). */
function cssResolver(css: string) {
  const global = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) if (!global.has(m[1])) global.set(m[1], m[2].trim());
  return (value: string | undefined, block: string, depth = 0): string | null => {
    if (!value || depth > 12) return null;
    const hex = value.match(/^#[0-9a-f]{6}/i);
    if (hex) return hex[0];
    const v = value.match(/^var\((--[\w-]+)/);
    if (!v) return null;
    const local = block.match(new RegExp(`${v[1]}:\\s*([^;]+);`));
    const next = local ? local[1].trim() : global.get(v[1]);
    return (cssResolver(css) as any)(next, block, depth + 1);
  };
}

describe('Buttons › Match on a generated system', () => {
  const scheme = makeScheme(['#2f6f5e', '#b0603a', '#5a4fa0']);
  const { json, figma, previewCss } = buildAll(scheme, SEL, 'light');
  const files = generateCSSFiles(json as never) as Record<string, string>;

  it('the export declares Match in every theme × level block, aliased to that theme', () => {
    const css = files['Light-Mode.css'];
    for (const theme of THEME_MODES) {
      const pal = matchPaletteFor(theme)!;
      for (const level of LEVELS) {
        const sel = `[data-theme="${theme}"][data-surface="${level}"]`;
        const i = css.indexOf(sel);
        expect(i, sel).toBeGreaterThan(-1);
        const block = css.slice(i, css.indexOf('}', i));
        expect(block, sel).toContain(`--Buttons-Match-Border: var(--Buttons-${pal}-Border);`);
      }
    }
  });

  it('the preview declares Match too (invariant 5)', () => {
    expect(previewCss).toMatch(/--Buttons-Match-Border: var\(--Buttons-[A-Za-z]+-Border\);/);
  });

  it('the Figma payload carries Buttons/Match as the theme\'s own palette', () => {
    for (const theme of THEME_MODES) {
      const pal = matchPaletteFor(theme)!;
      for (const level of LEVELS) {
        const group = figma.Themes?.[theme]?.[level]?.Buttons;
        expect(group?.Match, `${theme}/${level}`).toEqual(group?.[pal]);
      }
    }
  });

  it.each(['Light-Mode', 'Dark-Mode'])('Match Border clears 3:1 on its own background in every theme and level — %s', (mode) => {
    const css = files[`${mode}.css`];
    const res = cssResolver(css);
    const failures: string[] = [];
    let checked = 0;
    for (const theme of THEME_MODES) {
      for (const level of LEVELS) {
        const sel = `[data-theme="${theme}"][data-surface="${level}"]`;
        const i = css.indexOf(sel);
        if (i < 0) continue;
        const block = css.slice(i, css.indexOf('}', i));
        const pal = matchPaletteFor(theme)!;
        const border = res(block.match(new RegExp(`--Buttons-${pal}-Border:\\s*([^;]+);`))?.[1], block);
        const bg = res(block.match(/--Background:\s*([^;]+);/)?.[1], block);
        if (!border || !bg) continue;
        checked++;
        const c = chroma.contrast(border, bg);
        if (c < 3) failures.push(`${theme}/${level}: ${border} on ${bg} = ${c.toFixed(2)}`);
      }
    }
    expect(checked).toBeGreaterThan(30);
    expect(failures).toEqual([]);
  });
});
