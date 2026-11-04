/**
 * A card in a colored band casts that band's shadow color — never grey.
 *
 * Found on a clean-room store (Cocktail Hour): four Cards inside
 * `<Section theme="Secondary">` cast rgba(133, 133, 133, …) in light mode and
 * rgba(21, 21, 21, …) in dark mode — the Default page's grey and near-black —
 * instead of a red tint. Two generator defects, either of which was enough:
 *
 * 1. --Effect-Level-N was declared only at :root. A custom property's var() is
 *    substituted on the element that DECLARES it, so `rgba(var(
 *    --Dropshadow-Color), a)` resolved against the root and every element on
 *    the page inherited the root's color. effectLevelScopeCSS re-declares the
 *    recipes on [data-theme], [data-surface].
 *
 * 2. The published --Dropshadow-Color for every themed Surface / Surface-Dim /
 *    Surface-Bright was `8, 8, 8`: exportColorSystem resolved the section's
 *    background token one hop, got the STRING "{Colors.Secondary.Color-6}",
 *    and the shadow math read it as black. Dark sections were also computed
 *    before the dark ladder re-pointed their backgrounds.
 *
 * The cascade below reads the CSS the way a browser does (cssCascade.ts), so
 * these assert what the element RENDERS, not what a token table says.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { dropshadowRGB, effectLevelScopeCSS, effectLevelScopeFromCSS, EFFECT_LEVEL_SCOPE_SELECTOR } from '../utils/dropshadow';

// Cocktail Hour's three brand colors (its Color-6 tones).
const COLORS: [string, string, string] = ['#849054', '#d06f71', '#be7d45'];
const light = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
const dark = (hex: string) => generateSemanticDarkModeScale(hex);
const SCHEME: any = {
  name: 'Cocktail-like',
  colors: COLORS,
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: light(COLORS[0]), secondary: light(COLORS[1]), tertiary: light(COLORS[2]) },
  darkModeTonePalettes: { primary: dark(COLORS[0]), secondary: dark(COLORS[1]), tertiary: dark(COLORS[2]) },
};
const SEL = { background: 'default', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' };

let cached: { json: any; css: Record<string, string>; figma: any } | null = null;
const build = () => {
  if (cached) return cached;
  const json: any = exportColorSystemToJSON(
    generateFullLightPalettes(SCHEME.tonePalettes.primary, SCHEME.tonePalettes.secondary, SCHEME.tonePalettes.tertiary),
    generateFullDarkPalettes(SCHEME.darkModeTonePalettes.primary, SCHEME.darkModeTonePalettes.secondary, SCHEME.darkModeTonePalettes.tertiary),
    'neutral', 'primary-fixed' as never, SCHEME.extractedTones, 'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'Dropshadow tint', undefined, undefined, undefined, 'light-tonal', undefined, SEL as never,
  );
  const css = generateCSSFiles(json);
  json._userSelections = SEL;
  cached = { json, css, figma: generateFigmaJSON(json) };
  return cached;
};

type Mode = 'Light-Mode' | 'Dark-Mode';
const MODES: Mode[] = ['Light-Mode', 'Dark-Mode'];
const cascades = new Map<Mode, Cascade>();
const cascade = (mode: Mode) => {
  if (!cascades.has(mode)) {
    const { css } = build();
    // Load order a consumer uses: core, the mode sheet, then base.
    cascades.set(mode, new Cascade([css['core.css'] ?? '', css[`${mode}.css`], css['base.css']]));
  }
  return cascades.get(mode)!;
};

/** html (no theme) → provider root (Default / Surface) → a band → a card shell
 *  with no data-* of its own (Card's outer element, which casts the shadow). */
const chain = (theme: string, surface: string) => {
  const root: CascadeElement = { attrs: {}, root: true };
  const provider: CascadeElement = { attrs: { 'data-theme': 'Default', 'data-surface': 'Surface' }, parent: root };
  const band: CascadeElement = { attrs: { 'data-theme': theme, 'data-surface': surface }, parent: provider };
  const shell: CascadeElement = { attrs: {}, parent: band };
  return { root, band, shell };
};

const triple = (s: string | undefined) => (s ?? '').split(',').map((v) => Number(v.trim()));
const isGrey = (s: string | undefined) => { const [r, g, b] = triple(s); return r === g && g === b; };
/** The color the first layer of a recipe paints. */
const recipeColor = (recipe: string | undefined) => recipe?.match(/rgba\((\d+, \d+, \d+), /)?.[1];

const BRAND = ['Primary', 'Secondary', 'Tertiary'];
const SURFACES = ['Surface', 'Surface-Dim', 'Surface-Bright', 'Surface-Brightest', 'Container'];

describe('--Dropshadow-Color is derived from the background each section paints', () => {
  it.each(MODES.flatMap((mode) => [...BRAND, 'Neutral'].flatMap((theme) => SURFACES.map((surface) => ({ mode, theme, surface })))))(
    '$mode $theme / $surface', ({ mode, theme, surface }) => {
      const { band } = chain(theme, surface);
      const v = cascade(mode).computed(band);
      const bg = v['--Background'];
      expect(bg, 'band paints a hex').toMatch(/^#[0-9a-f]{6}/i);
      expect(v['--Dropshadow-Color']).toBe(dropshadowRGB(bg));
    });

  it.each(MODES.flatMap((mode) => BRAND.map((theme) => ({ mode, theme }))))(
    '$mode $theme band: tinted, not grey and not the old 8, 8, 8', ({ mode, theme }) => {
      for (const surface of ['Surface', 'Surface-Dim', 'Surface-Bright']) {
        const ds = cascade(mode).computed(chain(theme, surface).band)['--Dropshadow-Color'];
        expect(ds, `${surface}`).not.toBe('8, 8, 8');
        expect(isGrey(ds), `${surface} ${ds}`).toBe(false);
      }
    });

  it('a Neutral band and the Default (neutral) page stay grey', () => {
    for (const mode of MODES) {
      expect(isGrey(cascade(mode).computed(chain('Neutral', 'Surface').band)['--Dropshadow-Color'])).toBe(true);
    }
  });
});

describe('a card shell in a band casts the band\'s color, not the root\'s', () => {
  it.each(MODES.flatMap((mode) => [...BRAND, 'Neutral'].map((theme) => ({ mode, theme }))))(
    '$mode — card in a $theme band', ({ mode, theme }) => {
      const { root, band, shell } = chain(theme, 'Surface');
      const c = cascade(mode);
      const bandDS = c.computed(band)['--Dropshadow-Color'];
      for (const level of [1, 2, 3, 4, 5]) {
        const recipe = c.computed(shell)[`--Effect-Level-${level}`];
        expect(recipeColor(recipe), `Level ${level}`).toBe(bandDS);
      }
      // The trap this guards: the root has its own (core.css fallback) color,
      // and before the scoped block every level carried it.
      if (BRAND.includes(theme)) {
        expect(recipeColor(c.computed(shell)['--Effect-Level-1'])).not.toBe(c.computed(root)['--Dropshadow-Color']);
      }
    });

  it('base.css re-declares the five tinted recipes on every themed scope', () => {
    const base = build().css['base.css'];
    expect(base).toContain(`${EFFECT_LEVEL_SCOPE_SELECTOR} {`);
    const block = base.slice(base.indexOf(`${EFFECT_LEVEL_SCOPE_SELECTOR} {`));
    const body = block.slice(0, block.indexOf('}'));
    for (const l of [1, 2, 3, 4, 5]) expect(body).toContain(`--Effect-Level-${l}: `);
    // The neutral set is literal black; it is not re-declared.
    expect(body).not.toContain('-Neutral');
  });

  it('copies the LAST :root recipe when base.css declares two', () => {
    const css = ':root {\n  --Effect-Level-1: 0 1px 2px 0 rgba(var(--Dropshadow-Color), 0.5);\n}\n'
      + ':root {\n  --Effect-Level-1: 0 2px 3px 0 rgba(var(--Dropshadow-Color), 0.3);\n  --Effect-Level-1-Neutral: 0 2px 3px 0 rgba(0, 0, 0, 0.3);\n}';
    expect(effectLevelScopeFromCSS(css)).toBe(`${EFFECT_LEVEL_SCOPE_SELECTOR} {\n  --Effect-Level-1: 0 2px 3px 0 rgba(var(--Dropshadow-Color), 0.3);\n}`);
  });

  it('the preview emits the same block from the same helper (invariant 5)', () => {
    const preview = buildPreviewCSS({
      colorScheme: SCHEME, userSelections: SEL, componentStyle: 'modern', mode: 'light', typographyStyles: [],
    } as never);
    expect(preview).toContain(effectLevelScopeCSS());
    // The export copies the recipes its own :root declares; with the default
    // controls on both sides that is the same text.
    expect(build().css['base.css']).toContain(effectLevelScopeCSS());
  });
});

describe('the CSS shadow color equals Figma\'s for each band surface (invariants 5-7)', () => {
  const FIGMA_SECTION: Record<string, string> = {
    Surface: 'Surface', 'Surface-Dim': 'Surface-Dim', 'Surface-Bright': 'Surface-Bright', 'Surface-Brightest': 'Surface-Brightest',
  };
  it.each(MODES.flatMap((mode) => BRAND.flatMap((theme) => Object.keys(FIGMA_SECTION).map((surface) => ({ mode, theme, surface })))))(
    '$mode $theme / $surface', ({ mode, theme, surface }) => {
      const { figma } = build();
      const ref: string = figma.Themes?.[theme]?.[FIGMA_SECTION[surface]]?.['Dropshadow-Color']?.value;
      const cell = ref.match(/^\{Dropshadow-Color\.([\w-]+)\.(Color-\d+)\}$/);
      const band = ref.match(/^\{Band\.([\w-]+)\}$/);
      expect(cell || band, `Figma aliases the shadow color (${ref})`).toBeTruthy();
      const hex: string = cell
        ? figma.Modes?.[mode]?.['Dropshadow-Color']?.[cell[1]]?.[cell[2]]?.value
        : figma.Modes?.[mode]?.Band?.[band![1]]?.value;
      const figmaRGB = chroma(hex).rgb().join(', ');
      const cssRGB = cascade(mode).computed(chain(theme, surface).band)['--Dropshadow-Color'];
      expect(cssRGB).toBe(figmaRGB);
    });
});
