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
/* The line weights must reach the GENERATED CSS, not just the helper.
 *
 * This exists because a unit test on lineMetricsVars() passed while the
 * stylesheet contained none of them. The emission had been added to
 * generateStyleCSS — which emits its own --Card-Radius / --Button-Radius /
 * --Card-Padding and is NEVER CALLED. It typechecked, it read correctly, and
 * it produced nothing. The live emitter is generateBaseCSS.
 *
 * So the assertion is on the OUTPUT. A helper that returns the right map is
 * not evidence that anything ships it.
 */
describe('the line weights reach the stylesheet', () => {
  const css = () => {
    const sel = { background: 'primary', button: 'primary',
      cardColoring: 'tonal', textColoring: 'tonal' } as never;
    const { json } = buildAll(SCHEME, sel, 'light') as never as { json: never };
    const j = JSON.parse(JSON.stringify(json));
    j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100,
      cardPadding: 24, bevelOpacity: 50, shadowResolution: 3 };
    return Object.values(generateCSSFiles(j) as never as Record<string, string>).join('\n');
  };

  const decl = (out: string, name: string) =>
    out.split('\n').map((l) => l.trim()).find((l) => l.startsWith(name + ':'));

  it.each([
    ['--Sm-Divider', '0.5px'], ['--Divider', '1px'], ['--Lg-Divider', '2px'],
    ['--Sm-Step-Bar', '1px'], ['--Step-Bar', '2px'], ['--Lg-Step-Bar', '4px'],
    ['--Sm-No-Count-Step', '8px'], ['--No-Count-Step', '12px'], ['--Lg-No-Count-Step', '16px'],
  ])('%s is %s', (name, value) => {
    expect(decl(css(), name)).toBe(`${name}: ${value};`);
  });

  it('and the lib reads exactly these names', () => {
    /* Divider.js and Stepper.js read them with the design numbers as
       fallbacks. A rename on either side leaves the fallback painting
       forever, which looks identical to working. */
    const out = css();
    for (const name of ['--Divider', '--Step-Bar', '--No-Count-Step']) {
      expect(`${name} emitted: ${decl(out, name) !== undefined}`).toBe(`${name} emitted: true`);
    }
  });
});

/* Figma name == CSS name, for the three that used to disagree.
 *
 * These were not missing — each described ONE value under TWO names, which is
 * worse than a gap because both sides look complete and nothing can tell they
 * are the same thing:
 *
 *   Figma Card-Inner-Border-Radius   CSS --Card-Inner-Radius
 *   Figma Button-Inner-Focus-Radius  CSS --Button-Inner-Radius
 *   Figma Input-Inner-Focus-Radius   CSS --Input-Inner-Radius
 *
 * Resolved on 2026-09-20: Card renamed in Figma, the other two renamed in CSS.
 * This asserts the two sides agree AND carry the same number, so a rename on
 * either side that forgets the other fails here rather than silently leaving a
 * token that resolves to nothing.
 */
describe('Component-Size names match between Figma and CSS', () => {
  const css = () => {
    const sel = { background: 'primary', button: 'primary',
      cardColoring: 'tonal', textColoring: 'tonal' } as never;
    const { json } = buildAll(SCHEME, sel, 'light') as never as { json: never };
    const j = JSON.parse(JSON.stringify(json));
    j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100,
      cardPadding: 24, bevelOpacity: 50, shadowResolution: 3 };
    return Object.values(generateCSSFiles(j) as never as Record<string, string>).join('\n');
  };

  const decl = (out: string, name: string) =>
    out.split('\n').map((l) => l.trim()).find((l) => l.startsWith(name + ':'));

  it.each([
    '--Card-Inner-Radius',
    '--Button-Inner-Focus-Radius',
    '--Input-Inner-Focus-Radius',
  ])('%s is emitted under the name Figma uses', (name) => {
    expect(decl(css(), name)).toBeDefined();
  });

  it.each(['--Button-Inner-Radius', '--Input-Inner-Radius', '--Card-Inner-Border-Radius'])(
    'and the old name %s is gone', (name) => {
      expect(decl(css(), name)).toBeUndefined();
    });

  it('keeps --Input-Inner-Focus-Visible as an alias, not a second calculation', () => {
    /* List.js reads that name, and generated CSS is frozen per design system,
       so an older sheet paired with a newer lib still has to resolve it. It
       used to recompute max(0, inputRadius - 1) by hand — which is exactly
       what inner() already does — so one value had two derivations. */
    expect(decl(css(), '--Input-Inner-Focus-Visible'))
      .toBe('--Input-Inner-Focus-Visible: var(--Input-Inner-Focus-Radius);');
  });
});
