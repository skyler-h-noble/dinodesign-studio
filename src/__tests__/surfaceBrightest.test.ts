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
describe('Surface-Brightest', () => {
  const sel = { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' } as never;
  const { json } = buildAll(SCHEME, sel, 'light') as any;
  const withStyle = () => {
    const j = JSON.parse(JSON.stringify(json));
    j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100, cardPadding: 24,
      buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, bevel: 17 };
    return figmaGen(j);
  };

  it('exists on every theme, in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const themes = json.Modes[mode].Themes;
      const missing = Object.entries<any>(themes)
        .filter(([, t]) => t && t.Surfaces && !t['Surfaces-Brightest'])
        .map(([n]) => n);
      expect(missing, `${mode}: themes without Surfaces-Brightest: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('carries the full foreground set, not just a background', () => {
    const s = json.Modes['Light-Mode'].Themes.Primary['Surfaces-Brightest'];
    for (const role of ['Background', 'Text', 'Header', 'Quiet', 'Border', 'Text-BW']) {
      expect(s?.[role]?.value, `Surfaces-Brightest missing ${role}`).toBeTruthy();
    }
  });

  it('lands on tone 11, stepping to 12 when Bright has taken it', () => {
    const toneOf = (theme: string, sec: string) =>
      (String(json.Modes['Light-Mode'].Themes[theme]?.[sec]?.Background?.value || '')
        .match(/Background-(\d+)/) || [])[1];
    expect(toneOf('Neutral', 'Surfaces-Brightest')).toBe('12');
    for (const t of ['Primary', 'Secondary', 'Info']) {
      expect(toneOf(t, 'Surfaces-Brightest'), `${t} should land on 11`).toBe('11');
    }
  });

  // Neutral's window is LOCKED (black / 9 / 10 / 11 / white), not derived. It is
  // the theme that replaced White, Light-Gray and Black, so it has to span the
  // whole scale.
  //
  // This regressed once already, in the quietest possible way: neutralSurfaceWindow()
  // shipped with its own passing tests while NOTHING called it, so the generator
  // kept deriving Dimmest as surface-minus-two and Neutral's darkest surface painted
  // Color-8 - a mid grey - on a page whose markup already said Surface-Dimmest.
  // A module tested in isolation proves the rule, not that the rule is in force.
  it('locks Neutral Surface-Dimmest to true black, in BOTH modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode'] as const) {
      const bg = json.Modes[mode].Themes.Neutral?.['Surfaces-Dimmest']?.Background?.value;
      expect(bg, `${mode} Neutral Surface-Dimmest`).toBe('#000000');
    }
  });

  it('does not lock Default, which only borrows the Neutral palette', () => {
    // Default sets theme: 'Neutral' on any grey system, so keying the lock off
    // the PALETTE instead of the theme name blacked out Default's dark end too.
    const bg = json.Modes['Light-Mode'].Themes.Default?.['Surfaces-Dimmest']?.Background?.value;
    expect(bg).toMatch(/^\{Backgrounds\./);
  });

  it('keeps Neutral Surface-Brightest mode-aware rather than a literal white', () => {
    // Color-12 is already pure white in light mode, so the reference paints the
    // same colour AND still aliases into Modes. A hard #ffffff would light up
    // dark mode's brightest surface as pure white.
    const light = json.Modes['Light-Mode'].Themes.Neutral?.['Surfaces-Brightest']?.Background?.value;
    expect(light).toMatch(/Background-12/);
  });

  // The BlackWhite button's Lowlight is answered WITHOUT a Modes variable.
  //
  // Modes is at its ceiling (~4,700 variables per mode), so BlackWhite's twelve
  // bevel variables cannot be added to the Figma file. An alias to a variable
  // that is not there does not fail loudly - the binding is just absent and the
  // button paints no bevel, which is how this was reported.
  it('resolves BlackWhite Lowlight with no alias into a BlackWhite variable', () => {
    const f: any = withStyle();
    let aliased = 0;
    const walk = (n: any, d: number) => {
      if (!n || typeof n !== 'object' || d > 14) return;
      if (typeof n.value === 'string') {
        if (/^\{Buttons\.BlackWhite\.Color-\d+\.Lowlight\}$/.test(n.value)) aliased++;
        return;
      }
      for (const k of Object.keys(n)) if (k !== 'type') walk(n[k], d + 1);
    };
    walk(f, 0);
    expect(aliased, 'no Themes entry may still alias the absent BlackWhite variable').toBe(0);
  });

  it('gives the black face pure black, and the white face Neutral Color-12', () => {
    const f: any = withStyle();
    const seen = new Set<string>();
    const walk = (n: any, path: string, d: number) => {
      if (!n || typeof n !== 'object' || d > 14) return;
      if (typeof n.value === 'string') {
        if (/Themes\/.*BlackWhite\/Lowlight$/.test(path)) seen.add(n.value);
        return;
      }
      for (const k of Object.keys(n)) if (k !== 'type') walk(n[k], path + '/' + k, d + 1);
    };
    walk({ Themes: f.Themes }, '', 0);
    // Pure black specifically: it is at or below the fill in BOTH modes
    // (#040404 light, #0b0b0b dark), so a literal frozen across the Themes
    // collection's theme-modes can never render lighter than the button.
    //
    // The trailing 80 is the bevel alpha at the default 50% opacity, matching
    // what the white face receives through Neutral Color-12. Opaque black would
    // make the black button's shadow read twice as strong as the white one's.
    expect([...seen].sort()).toEqual(['#00000080', '{Button-Lowlight.Neutral.Color-12}']);
  });

  // Every theme the CSS emits must also reach Figma.
  //
  // generateFigmaJSON iterates a hand-written THEMES list while the CSS iterates
  // whatever the generator produced, so the two can disagree with nothing
  // failing: the list still held the pre-consolidation eighteen (six -Light
  // variants, White, Light-Gray, Black) and had never gained Neutral. Ten dead
  // names skipped in silence and Neutral - fully emitted in CSS, and the theme
  // whose ends we deliberately locked to black and white - never reached Figma
  // at all. The Theme collection was simply one mode short.
  //
  // Nav-Bar / App-Bar / Status are excluded by design: they are themes in CSS
  // but live in the Navigation collection in Figma, not Theme.
  const NAV_ONLY = ['Nav-Bar', 'App-Bar', 'Status'];

  it('exports every CSS theme to the Figma Theme collection', () => {
    const f: any = withStyle();
    const lm = generateCSSFiles(json)['Light-Mode.css'] || '';
    const cssThemes = new Set<string>();
    for (const m of lm.matchAll(/\[data-theme="([^"]+)"\]\[data-surface=/g)) cssThemes.add(m[1]);

    const figThemes = Object.keys(f.Themes || {});
    const missing = [...cssThemes].filter((t) => !NAV_ONLY.includes(t) && !figThemes.includes(t));
    expect(missing, `themes in CSS but absent from Figma: ${missing.join(', ')}`).toEqual([]);

    // and nothing in Figma that the CSS does not emit
    const stale = figThemes.filter((t) => !cssThemes.has(t));
    expect(stale, `themes in Figma that CSS never emits: ${stale.join(', ')}`).toEqual([]);

    for (const t of NAV_ONLY) expect(Object.keys(f.Navigation || {})).toContain(t);
  });

  it('gives every Figma theme all five surfaces', () => {
    const f: any = withStyle();
    for (const [name, groups] of Object.entries<any>(f.Themes || {})) {
      expect(Object.keys(groups), `${name} surface groups`).toEqual([
        'Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest', 'Containers',
      ]);
    }
  });

  it('stays within the ten-mode cap Figma allows', () => {
    const f: any = withStyle();
    expect(Object.keys(f.Themes || {}).length).toBeLessThanOrEqual(10);
  });

  // --Lg-Button-Min-Width is the standard floor + 40, emitted by BOTH the CSS
  // export and the Figma payload from their own copies of that rule. Neither
  // reads the other, so this asserts they agree — and that the offset is a
  // relationship rather than a second number someone can edit on one side.
  //
  // It shipped to Figma and to generateDesignSystem long before the CSS bundle
  // had either token, which is why this test exists at the bundle boundary.
  it('emits Button-Min-Width and its large sibling, agreeing with Figma', () => {
    const MIN_W = 72;
    const j = JSON.parse(JSON.stringify(json));
    j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100, cardPadding: 24,
      buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, bevel: 17, minButtonWidth: MIN_W };

    const base = generateCSSFiles(j)['base.css'] || '';
    const num = (re: RegExp) => Number((base.match(re) || [])[1]);
    const cssStd = num(/--Button-Min-Width:\s*(\d+)px;/);
    const cssLg = num(/--Lg-Button-Min-Width:\s*(\d+)px;/);
    expect(cssStd).toBe(MIN_W);
    expect(cssLg, 'large floor is the standard floor + 40').toBe(MIN_W + 40);

    const comp: any = figmaGen(j).Components?.Button || {};
    expect(comp['Button-Min-Width'], 'Figma and CSS must agree').toBe(cssStd);
    expect(comp['Lg-Button-Min-Width'], 'Figma and CSS must agree').toBe(cssLg);
  });

  // The five surface levels must ASCEND in lightness, in BOTH modes.
  //
  // Dark mode had this wrong in every theme and nothing failed: Surface-Dim was
  // pinned to the literal #000000 (correct when Dim was the floor, wrong once
  // Surface-Dimmest took that job), so Dim sat BELOW Dimmest and the level names
  // stopped describing the order. 7 of 8 themes inverted, 0 clean. It is invisible
  // without measuring, because each surface looks fine on its own.
  it('orders the five surface levels by lightness, in both modes', () => {
    const files = generateCSSFiles(json);
    const LEVELS = ['Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest'];
    const THEMES = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];

    for (const mode of ['Light-Mode', 'Dark-Mode'] as const) {
      const css = files[`${mode}.css`] || '';
      const defs: Record<string, string> = {};
      for (const m of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) if (!defs[m[1]]) defs[m[1]] = m[2];
      const resolve = (v: string): string | null => {
        let cur = (v || '').trim();
        for (let i = 0; i < 8; i++) {
          if (cur.startsWith('#')) return cur;
          const m = cur.match(/^var\((--[\w-]+)\)$/);
          if (!m) return null;
          cur = defs[m[1]] || '';
          if (!cur) return null;
        }
        return null;
      };

      for (const t of THEMES) {
        const Ls = LEVELS.map((lvl) => {
          const re = new RegExp(`\\[data-theme="${t}"\\]\\[data-surface="${lvl}"\\]\\s*\\{([^}]*)\\}`);
          const blk = (css.match(re) || [])[1] || '';
          const hex = resolve((blk.match(/--Background:\s*([^;]+);/) || [])[1] || '');
          return hex ? chroma(hex).get('lab.l') : null;
        });
        expect(Ls.every((x) => x !== null), `${mode}/${t}: a level did not resolve`).toBe(true);
        const v = Ls as number[];
        for (let k = 1; k < v.length; k++) {
          expect(
            v[k] >= v[k - 1] - 0.5,
            `${mode}/${t}: ${LEVELS[k]} (L${v[k].toFixed(0)}) is darker than ${LEVELS[k - 1]} (L${v[k - 1].toFixed(0)}) — [${v.map((x) => x.toFixed(0)).join(', ')}]`,
          ).toBe(true);
        }
      }
    }
  });

  // Button padding is TWO numbers: small and standard share 8px, large gets 16px.
  //
  // --Lg-Button-Padding is the canonical large name. The CSS used to spell it
  // --Large-Button-Padding while Figma always emitted Lg-, so a consumer
  // following the Sm-/Lg- convention (as --Lg-Button-Min-Width and
  // --Lg-Input-Radius do) wrote var(--Lg-Button-Padding) and got a silent
  // fallback. Both names now ship, with the old spelling as an alias.
  it('emits both button paddings, with the legacy names aliased', () => {
    const j = JSON.parse(JSON.stringify(json));
    j._componentStyle = { buttonRadius: 100, iconButtonRadius: 100, inputRadius: 100, cardPadding: 24,
      buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, bevel: 17, minButtonWidth: 60 };
    const base = generateCSSFiles(j)['base.css'] || '';

    expect(base).toContain('--Button-Padding: 8px;');
    expect(base).toContain('--Lg-Button-Padding: 16px;');
    // Aliases, not second literals — two numbers for one value is how they drift.
    expect(base).toContain('--Sm-Button-Padding: var(--Button-Padding);');
    expect(base).toContain('--Large-Button-Padding: var(--Lg-Button-Padding);');

    const comp: any = figmaGen(j).Components?.Button || {};
    expect(comp['Button-Padding'], 'Figma and CSS must agree').toBe(8);
    expect(comp['Lg-Button-Padding'], 'Figma and CSS must agree').toBe(16);
    // Sm- stays out of Figma: it equals Button-Padding, so nothing selects
    // between the copies. Lg- is a genuinely different number.
    expect(comp['Sm-Button-Padding']).toBeUndefined();
  });

  // Outline-Text is a Buttons-collection variable in Figma, not a per-theme one.
  //
  // The Buttons collection has a mode PER PALETTE, so one variable covers every
  // palette: its Primary mode aliases Surface/Text-Primary, Secondary aliases
  // Surface/Text-Secondary, and so on. The palette that a per-theme token would
  // encode in its name IS the mode.
  //
  // Emitting the per-theme copies fights the file rather than merely wasting
  // space: the importer only upserts, so every regenerate would recreate the
  // variables that were deliberately deleted — in a Modes collection already at
  // its ceiling.
  //
  // CSS keeps its per-theme copies, because there the surface cascade is what
  // resolves the palette. A deliberate divergence, asserted in both directions
  // so neither side can quietly adopt the other's shape.
  it('keeps Outline-Text out of the Figma Theme collection but in the CSS', () => {
    const f: any = withStyle();
    let inFigma = 0;
    const walk = (n: any, d: number) => {
      if (!n || typeof n !== 'object' || d > 14) return;
      if (typeof n.value === 'string') return;
      for (const k of Object.keys(n)) {
        if (k === 'Outline-Text' && n[k] && typeof n[k] === 'object' && 'value' in n[k]) {
          inFigma++;
          continue;
        }
        walk(n[k], d + 1);
      }
    };
    walk(f.Themes, 0);
    walk(f.SurfacesContainers, 0);
    expect(inFigma, 'no per-theme Outline-Text may reach Figma').toBe(0);

    const css = generateCSSFiles(json)['Light-Mode.css'] || '';
    expect(
      (css.match(/--Buttons-[\w-]+-Outline-Text:/g) || []).length,
      'the CSS still resolves it through the surface cascade',
    ).toBeGreaterThan(0);
  });

  // Tonal containers sit on Color-10 on a light background, Color-2 on a dark
  // one — flat across all five levels, because light-mode elevation comes from
  // drop shadows rather than tone.
  //
  // Asserted in BOTH targets. The CSS emits a token reference and the Figma
  // payload emits the resolved hex, so a divergence here reads as two correct
  // looking values rather than as an error.
  it('puts tonal containers on Color-10, in the CSS and in Figma alike', () => {
    const THEMES = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
    const css = generateCSSFiles(json)['Light-Mode.css'] || '';
    let checked = 0;
    for (const blk of css.split('}')) {
      const sel = (blk.split('{')[0] || '').replace(/\s+/g, ' ');
      const t = (sel.match(/Theme: ([\w-]+) - Containers/) || [])[1];
      if (!t || !THEMES.includes(t)) continue;
      const raw = (((blk.split('{')[1] || '').match(/--Container:\s*([^;]+);/)) || [])[1] || '';
      expect(raw.trim(), `${t} container`).toBe(`var(--${t}-Color-10)`);
      checked++;
    }
    expect(checked, 'every theme must declare a container').toBe(THEMES.length);

    // Figma resolves it to a hex, so compare against the palette entry itself
    // rather than restating the colour.
    const lm = (withStyle() as any).Modes['Light-Mode'];
    const expected = lm.Colors.Primary['Color-10'].value;
    for (const row of ['Background-8', 'Background-10', 'Background-12']) {
      expect(lm.Backgrounds.Primary[row]?.Containers?.Container?.value, `${row}`).toBe(expected);
    }
    // and NOT the tone it used to be
    expect(expected).not.toBe(lm.Colors.Primary['Color-11'].value);
  });

  it('reaches the CSS as its own data-surface selector', () => {
    const css = generateCSSFiles(json)['Light-Mode.css'] || '';
    expect((css.match(/\[data-surface="Surface-Brightest"\]/g) || []).length).toBeGreaterThan(10);
  });

  it('appears as a Figma group beside the other four', () => {
    const f: any = withStyle();
    expect(Object.keys(f.Themes?.Primary || {})).toEqual([
      'Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest', 'Containers',
    ]);
  });

  it('is covered by Default indirection in the Figma payload', () => {
    // Default routes foregrounds through Default-Background. A level missing
    // there resolves to nothing — which is how Surface/Dim/Bright shipped with
    // unlinked Text-BW while Containers, needing no indirection, worked.
    const f: any = withStyle();
    const db = f.Modes?.['Light-Mode']?.['Default-Background'] || {};
    const keys = Object.keys(db).filter((k) => k.startsWith('Surface-Brightest-'));
    expect(keys.length).toBeGreaterThan(20);
    expect(db['Surface-Brightest-Text']?.value).toMatch(/^#[0-9a-f]{6}$/i);
    expect(db['Surface-Brightest-Text-BW']?.value).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
