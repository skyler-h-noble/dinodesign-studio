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

/* Everything the Component-Size payload writes to Figma must also reach the
 * stylesheet. Five values lived in Figma only:
 *
 *   Rail-Width / App-Bar Height / Nav-Bar Height   the nav chrome
 *   Accordion-Focus-Radius / -Inner-Focus-Radius   the concentric focus ring
 *
 * Rail.js is the visible symptom: it has read var(--Rail-Width, 80px) since it
 * was written and always got the FALLBACK, so the design's 80/72/96 ramp never
 * reached a consumer. A token that exists on one side only looks identical to
 * one that works.
 *
 * The two nav heights carry SPACES in Figma ("App-Bar Height"), so they go
 * through the same name map the line weights use — a custom property with a
 * space is invalid and silently dropped.
 */
describe('the nav chrome and accordion focus radii reach the stylesheet', () => {
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
    ['--Sm-Rail-Width', '72px'], ['--Rail-Width', '80px'], ['--Lg-Rail-Width', '96px'],
    ['--Sm-App-Bar-Height', '56px'], ['--App-Bar-Height', '64px'], ['--Lg-App-Bar-Height', '72px'],
    ['--Sm-Nav-Bar-Height', '73px'], ['--Nav-Bar-Height', '83px'], ['--Lg-Nav-Bar-Height', '93px'],
  ])('%s is %s', (name, value) => {
    expect(decl(css(), name)).toBe(`${name}: ${value};`);
  });

  it('emits each nav value exactly once', () => {
    /* navMetricsCSS() and navMetricsVars() are two shapes of ONE table, and
     * for a while they were two walks of it wired into two emitters — base.css
     * carried all nine twice. Identical values, so the duplicate was invisible
     * in the rendered page AND in an end-to-end check that grepped for the
     * name: the second copy just confirmed what the first already did. */
    const out = css().replace(/\/\*[\s\S]*?\*\//g, '');
    const names = [
      '--Rail-Width', '--Sm-Rail-Width', '--Lg-Rail-Width',
      '--App-Bar-Height', '--Sm-App-Bar-Height', '--Lg-App-Bar-Height',
      '--Nav-Bar-Height', '--Sm-Nav-Bar-Height', '--Lg-Nav-Bar-Height',
      '--Divider', '--Sm-Divider', '--Lg-Divider',
      '--Step-Bar', '--Sm-Step-Bar', '--Lg-Step-Bar',
      '--No-Count-Step', '--Sm-No-Count-Step', '--Lg-No-Count-Step',
      '--Accordion-Focus-Radius', '--Accordion-Inner-Focus-Radius',
      '--Radio-Size', '--Sm-Radio-Size', '--Lg-Radio-Size',
      '--Radio-Dot', '--Sm-Radio-Dot', '--Lg-Radio-Dot',
      '--Radio-Gap', '--Sm-Radio-Gap', '--Lg-Radio-Gap',
      '--Checkbox-Size', '--Sm-Checkbox-Size', '--Lg-Checkbox-Size',
      '--Checkbox-Icon', '--Sm-Checkbox-Icon', '--Lg-Checkbox-Icon',
      '--Checkbox-Gap', '--Sm-Checkbox-Gap', '--Lg-Checkbox-Gap',
      '--Touch-Target',
    ];
    const counts = names.map((name) => {
      const n = out.split('\n').map((l) => l.trim())
        .filter((l) => l.startsWith(name + ':')).length;
      return `${name} x${n}`;
    });
    expect(counts).toEqual(names.map((n) => `${n} x1`));
  });

  it('emits both accordion focus radii', () => {
    const out = css();
    expect(decl(out, '--Accordion-Focus-Radius')).toBeDefined();
    expect(decl(out, '--Accordion-Inner-Focus-Radius')).toBeDefined();
  });

  it('never emits a property name containing a space', () => {
    /* "App-Bar Height" and "Nav-Bar Height" are the Figma spellings.
     *
     * Strip block comments first. dropshadow.ts writes a comment whose
     * continuation line begins "   --Input-Radius. Repoint it..." — prose,
     * not a declaration, and a scanner that keys on the leading "--" alone
     * reports it as a malformed custom property. Require a trailing ";" too. */
    const out = css().replace(/\/\*[\s\S]*?\*\//g, '');
    for (const l of out.split('\n').map((x) => x.trim())) {
      if (!l.startsWith('--') || !l.endsWith(';') || !l.includes(':')) continue;
      const name = l.slice(0, l.indexOf(':'));
      expect(`${name} has a space: ${name.includes(' ')}`).toBe(`${name} has a space: false`);
    }
  });
});

/* Radio and Checkbox were the last controls holding their whole sizing table
 * as literals. The gap is the one that proves why it matters: Checkbox shipped
 * 6 / 8 / 10 against Radio's 4 / 8 / 12, so the two controls in one form sat
 * at different distances from their labels at small and large, and nothing
 * could see it because nothing wrote either number.
 */
describe('Radio and Checkbox sizing reaches the stylesheet', () => {
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
    ['--Sm-Radio-Size', '16px'],    ['--Radio-Size', '20px'],    ['--Lg-Radio-Size', '24px'],
    ['--Sm-Radio-Dot', '8px'],      ['--Radio-Dot', '9.5px'],    ['--Lg-Radio-Dot', '9.5px'],
    ['--Sm-Radio-Gap', '4px'],      ['--Radio-Gap', '8px'],      ['--Lg-Radio-Gap', '12px'],
    ['--Sm-Checkbox-Size', '16px'], ['--Checkbox-Size', '20px'], ['--Lg-Checkbox-Size', '24px'],
    ['--Sm-Checkbox-Icon', '12px'], ['--Checkbox-Icon', '14px'], ['--Lg-Checkbox-Icon', '18px'],
    ['--Sm-Checkbox-Gap', '4px'],   ['--Checkbox-Gap', '8px'],   ['--Lg-Checkbox-Gap', '12px'],
    ['--Touch-Target', '24px'],
  ])('%s is %s', (name, value) => {
    expect(decl(css(), name)).toBe(`${name}: ${value};`);
  });

  it('the box and the gap are the SAME at every size for both controls', () => {
    /* The assertion is on the shipped stylesheet, not on the table, because
     * the table being right is not the thing that failed — Checkbox's 6/8/10
     * and Radio's 4/8/12 were each internally consistent. What a form needs is
     * that the two agree where they stand side by side. */
    const out = css();
    for (const p of ['Sm-', '', 'Lg-']) {
      expect(decl(out, `--${p}Radio-Size`)?.split(':')[1])
        .toBe(decl(out, `--${p}Checkbox-Size`)?.split(':')[1]);
      expect(decl(out, `--${p}Radio-Gap`)?.split(':')[1])
        .toBe(decl(out, `--${p}Checkbox-Gap`)?.split(':')[1]);
    }
  });

  it('the touch target has no size modes', () => {
    /* 24 is a WCAG minimum, not a density choice — a Sm- sibling holding the
     * same 24 would imply a choice that does not exist, and a SMALLER one
     * would put the smallest control under the requirement. */
    const out = css();
    expect(decl(out, '--Sm-Touch-Target')).toBeUndefined();
    expect(decl(out, '--Lg-Touch-Target')).toBeUndefined();
  });
});
