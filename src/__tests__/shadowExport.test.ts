/**
 * The shadow model reaches Figma and the CSS as ONE colour per surface plus a
 * global per-layer opacity set — not five colours per surface.
 *
 * Invariant 5 says the preview and the export diverge silently, so both are
 * asserted here. Invariant 7 says parity alone is not correctness: the SHAPE is
 * asserted independently on each side, so the two agreeing on something wrong
 * still fails.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import {
  dropshadowAlphas, shadowLayers, shadowLayerCount, dropshadowBaseHex,
  shadowOptionsFromStyle, SHADOW_LEVELS, SHADOW_DEFAULTS,
} from '../utils/dropshadow';
import type { ColorScheme } from '../types';

const TYPOGRAPHY = [
  { type: 'header' as const, family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  { type: 'decorative' as const, family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  { type: 'body' as const, family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
];

function makeScheme(colors: [string, string, string]): ColorScheme {
  const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const dark = (h: string) => generateSemanticDarkModeScale(h);
  return {
    name: 'Test', colors,
    extractedTones: {
      primary: chroma(colors[0]).lch()[0],
      secondary: chroma(colors[1]).lch()[0],
      tertiary: chroma(colors[2]).lch()[0],
    },
    tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
    darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
  } as unknown as ColorScheme;
}

const SCHEME = makeScheme(['#7b3f9d', '#2563eb', '#b8329b']);

/** A non-default shadow setting, so a hard-coded default cannot pass. */
const CUSTOM = {
  shadowIntensity: 0.62, shadowCrispy: 0.8, shadowResolution: 0.9,
  shadowLightX: 0, shadowLightY: -1, shadowTint: true,
};

function buildFigma(componentStyle?: Record<string, unknown>) {
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(
      SCHEME.tonePalettes!.primary as never,
      SCHEME.tonePalettes!.secondary as never,
      SCHEME.tonePalettes!.tertiary as never,
    ),
    generateFullDarkPalettes(
      SCHEME.darkModeTonePalettes!.primary as never,
      SCHEME.darkModeTonePalettes!.secondary as never,
      SCHEME.darkModeTonePalettes!.tertiary as never,
    ),
    'neutral', 'primary-fixed' as never, SCHEME.extractedTones, 'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'ShadowExport', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'neutral' as never, button: 'primary-fixed' as never,
      cardColoring: 'tonal' as never, textColoring: 'standard' as never },
  ) as unknown as Record<string, unknown>;
  if (componentStyle) json._componentStyle = componentStyle;
  return generateFigmaJSON(json as never);
}

describe('Figma carries one shadow colour, not five', () => {
  const figma = buildFigma();

  it('emits a Dropshadow-Color section and no numbered ones', () => {
    const mode = (figma as never as Record<string, any>).Modes['Light-Mode'];
    const numbered = Object.keys(mode).filter((k) => /^Dropshadow-Color-\d$/.test(k));
    expect(`single: ${!!mode['Dropshadow-Color']}, numbered: ${numbered.length}`)
      .toBe('single: true, numbered: 0');
  });

  /* The colour must be OPAQUE. The opacity lives on the effect layer and is
     bound separately; baking an alpha into the colour would apply it twice. */
  it('emits the colour opaque, as 6-digit hex', () => {
    const sec = (figma as never as Record<string, any>).Modes['Light-Mode']['Dropshadow-Color'];
    const vals = Object.values(sec).flatMap((p) => Object.values(p as object)).map((v: any) => v.value);
    expect(vals.length).toBeGreaterThan(0);
    expect(vals.every((v: string) => /^#[0-9a-f]{6}$/i.test(v))).toBe(true);
  });
});

describe('Figma carries the per-layer geometry and opacity globally', () => {
  const figma = buildFigma() as never as Record<string, any>;

  it('gives every level ten slots', () => {
    for (const l of SHADOW_LEVELS) {
      const slots = Object.keys(figma.Shadow[`Level-${l}`]);
      expect(`L${l}: ${slots.length}`).toBe(`L${l}: 10`);
    }
  });

  /* Slots past a level's layer count must be ZERO, not absent — the effect
     styles are premade at full width, so lowering Resolution has to silence
     the tail rather than restructure the style. */
  it('zeroes the slots past the active layer count', () => {
    for (const l of SHADOW_LEVELS) {
      const n = shadowLayerCount(l);
      for (let i = n; i < 10; i++) {
        const s = figma.Shadow[`Level-${l}`][`Layer-${i + 1}`];
        expect(`L${l} slot ${i + 1}: ${s.Opacity.value}/${s.X.value}/${s.Y.value}/${s.Blur.value}`)
          .toBe(`L${l} slot ${i + 1}: 0/0/0/0`);
      }
    }
  });

  it('matches the generator for the active slots', () => {
    for (const l of SHADOW_LEVELS) {
      const layers = shadowLayers(l);
      const alphas = dropshadowAlphas(l);
      layers.forEach(([x, y, blur, spread], i) => {
        const s = figma.Shadow[`Level-${l}`][`Layer-${i + 1}`];
        expect(`L${l}.${i + 1}: ${s.X.value}/${s.Y.value}/${s.Blur.value}/${s.Spread.value}/${s.Opacity.value}`)
          .toBe(`L${l}.${i + 1}: ${x}/${y}/${blur}/${spread}/${Math.round(alphas[i] * 1000) / 1000}`);
      });
    }
  });
});

describe('the user\'s Shadow controls actually reach the exports', () => {
  /* A hard-coded default would pass every assertion above. These force the
     non-default settings through the real pipeline. */
  it('changes the Figma geometry and opacity', () => {
    const custom = buildFigma(CUSTOM) as never as Record<string, any>;
    const o = shadowOptionsFromStyle(CUSTOM);
    const layers = shadowLayers(5, o);
    const alphas = dropshadowAlphas(5, o);
    expect(`slots: ${layers.length}`).not.toBe(`slots: ${shadowLayers(5).length}`);
    layers.forEach(([x, y, blur, spread], i) => {
      const s = custom.Shadow['Level-5'][`Layer-${i + 1}`];
      expect(`${s.X.value}/${s.Y.value}/${s.Blur.value}/${s.Spread.value}/${s.Opacity.value}`)
        .toBe(`${x}/${y}/${blur}/${spread}/${Math.round(alphas[i] * 1000) / 1000}`);
    });
  });

  /* Intensity moves the COLOUR, not only the alpha. A call site that drops the
     options emits a plausible-but-wrong hex, which is exactly the failure this
     pins — light position 0 also proves the geometry is straight-down. */
  it('changes the Figma shadow colour', () => {
    const custom = buildFigma(CUSTOM) as never as Record<string, any>;
    const dflt = buildFigma() as never as Record<string, any>;
    /* Compare the WHOLE section, not one tone. LIGHT_MAX caps shadow lightness
       at 52, so on a very light surface two different intensities can land on
       the same clamped hex — a single-tone probe would report "no change" from
       the clamp rather than from a broken pipeline. */
    const all = (f: Record<string, any>) => JSON.stringify(f.Modes['Light-Mode']['Dropshadow-Color']);
    expect(all(custom)).not.toBe(all(dflt));
  });

  it('changes the preview CSS recipes', () => {
    const css = (cs?: Record<string, unknown>) => buildPreviewCSS({
      colorScheme: SCHEME,
      userSelections: { background: 'neutral', button: 'primary', cardColoring: 'tonal', textColoring: 'standard' },
      componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
      ...(cs ? { styleCustomizations: cs } : {}),
    } as never);
    const line = (s: string) => (s.match(/--Effect-Level-5:[^;]*/) || ['none'])[0];
    expect(line(css(CUSTOM))).not.toBe(line(css()));
  });
});

describe('the preview and the CSS export agree on the recipe shape', () => {
  const css = buildPreviewCSS({
    colorScheme: SCHEME,
    userSelections: { background: 'neutral', button: 'primary', cardColoring: 'tonal', textColoring: 'standard' },
    componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
  } as never);

  /* The dead per-level tokens. Nothing reads them since the recipes moved to
     the single var, and they cost five variables on every surface. */
  it('emits no --Dropshadow-Color-N anywhere', () => {
    expect(/--Dropshadow-Color-\d/.test(css)).toBe(false);
  });

  /* rgba() with a COMMA triple, because @omni-design/components consumes
     rgba(var(--Dropshadow-Color), a). The space-separated form is invalid
     inside rgba() and paints nothing, silently. */
  it('emits a comma triple and rgba(), the form the lib consumes', () => {
    const triple = css.match(/--Dropshadow-Color:\s*([^;]+);/);
    expect(triple && /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(triple[1].trim())).toBe(true);
    expect(/--Effect-Level-5:[^;]*rgba\(var\(--Dropshadow-Color\),/.test(css)).toBe(true);
  });

  it('gives level 5 one recipe entry per layer', () => {
    const recipe = (css.match(/--Effect-Level-5:([^;]*)/) || ['', ''])[1];
    const entries = (recipe.match(/rgba\(var\(--Dropshadow-Color\),/g) || []).length;
    expect(`entries: ${entries}`).toBe(`entries: ${shadowLayerCount(5)}`);
  });
});

/* The lib compiles its own shadow geometry in, so without this override the
   Shadow controls reach a Card's COLOUR and nothing else — every card in the
   app looks identical however the sliders move. */
describe('the lib\'s own components are repointed at the recipes', () => {
  const css = buildPreviewCSS({
    colorScheme: SCHEME,
    userSelections: { background: 'neutral', button: 'primary', cardColoring: 'tonal', textColoring: 'standard' },
    componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
  } as never);

  /* The shadow override that used to be asserted here is gone: the lib reads
     var(--Effect-Level-N) itself now, and a :root-declared custom property has
     its inner var() resolved at :root — so the override gave every card the
     root's shadow colour instead of its own surface's. */
  it('emits no box-shadow override for lib components', () => {
    expect(/\.card\.card\s*\{\s*box-shadow/.test(css)).toBe(false);
    expect(/\.appbar\.appbar\s*\{\s*box-shadow/.test(css)).toBe(false);
  });

  /* Doubled class, not a bare one: the lib's styles come from emotion as a
     single generated class, so `.card` alone ties on specificity and the
     winner depends on stylesheet insertion order. Doubling wins outright, so
     the override must not need !important either. */
  /* TextArea wraps MUI's TextField, so it inherits MUI's corner rather than
     reading --Input-Radius — a TextArea and a TextInput side by side had
     different corners. The notched outline needs it too: that fieldset draws
     the visible border, so leaving it square shows a square outline inside a
     rounded box. */
  it('repoints MUI-backed fields at --Input-Radius, outline included', () => {
    expect(/\.MuiOutlinedInput-root\.MuiOutlinedInput-root[^{]*\{[^}]*var\(--Input-Radius/.test(css)).toBe(true);
    expect(css.includes('.MuiOutlinedInput-notchedOutline')).toBe(true);
  });

  it('outranks emotion by specificity rather than !important', () => {
    const rules = [...css.matchAll(/^\.MuiOutlinedInput-root[^{]*\{[^}]*border-radius[^}]*\}/gm)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(`doubled: ${/^\.(\S+?)\.\1/.test(r)}`).toBe('doubled: true');
      expect(`important: ${r.includes('!important')}`).toBe('important: false');
    }
  });
});

describe('the shadow controls have defaults for a system that never set them', () => {
  it('falls back to SHADOW_DEFAULTS on an empty record', () => {
    expect(shadowOptionsFromStyle(undefined)).toEqual(SHADOW_DEFAULTS);
    expect(shadowOptionsFromStyle({})).toEqual(SHADOW_DEFAULTS);
  });

  it('keeps the shadow darker than the surface at every intensity', () => {
    const lum = (hex: string) => {
      const h = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const surface of ['#f0ebe0', '#3b6ea5', '#ffffff']) {
      for (const intensity of [0.05, 0.4, 1]) {
        const ok = lum(dropshadowBaseHex(surface, { intensity })) < lum(surface);
        expect(`${surface} @${intensity}: ${ok}`).toBe(`${surface} @${intensity}: true`);
      }
    }
  });
});


/* ── Every consumer must hand over the sliders ──────────────────────────────
 *
 * buildPreviewCSS covers colour and typography from its own arguments, but the
 * component-style sliders arrive only through styleCustomizations. A call site
 * that omits them renders a PLAUSIBLE design system that silently ignores the
 * user's choices — there is no error, the shadows are simply the defaults.
 *
 * This has now happened twice: first with button radii (the detail page showed
 * 4px corners for a system saved at 86%), then with the Shadow step, where the
 * studio's own chrome, the detail page and the phone mock-up all rendered
 * default shadows. Both times the bug was a missing property at a call site, so
 * that is what this asserts.
 */
describe('every buildPreviewCSS call site passes the sliders', () => {
  const srcRoot = new URL('..', import.meta.url).pathname;

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
      return /\.tsx?$/.test(name) ? [full] : [];
    });

  it('names styleCustomizations in every call', () => {
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      if (file.includes('/utils/buildPreviewCSS.ts')) continue;
      const src = readFileSync(file, 'utf8');
      let i = src.indexOf('buildPreviewCSS({');
      while (i !== -1) {
        // the call's argument object, up to its closing brace
        let depth = 0;
        let end = src.indexOf('{', i);
        for (let k = end; k < src.length; k++) {
          if (src[k] === '{') depth++;
          else if (src[k] === '}') { depth--; if (depth === 0) { end = k; break; } }
        }
        const call = src.slice(i, end + 1);
        if (!call.includes('styleCustomizations')) {
          offenders.push(`${file.replace(srcRoot, '')}:${src.slice(0, i).split('\n').length}`);
        }
        i = src.indexOf('buildPreviewCSS({', end);
      }
    }
    expect(offenders.join(', ')).toBe('');
  });
});

/* ── Display caps reach Figma ───────────────────────────────────────────────
 *
 * The Display's All-caps checkbox has to arrive as a text style property, not
 * just as CSS: Figma applies case through textCase on the style, so a payload
 * that omits it leaves the Display in sentence case in the file while the web
 * export renders it uppercase.
 *
 * Both directions are asserted. Only checking the caps case would pass on an
 * emitter that hardcoded UPPER, which is the failure that actually matters —
 * unchecking the box has to REMOVE the case, not merely stop adding it.
 */
describe('the Display\'s all-caps setting reaches the Figma text styles', () => {
  const build = (allCaps: boolean) => {
    const json = exportColorSystemToJSON(
      generateFullLightPalettes(
        SCHEME.tonePalettes!.primary as never,
        SCHEME.tonePalettes!.secondary as never,
        SCHEME.tonePalettes!.tertiary as never,
      ),
      generateFullDarkPalettes(
        SCHEME.darkModeTonePalettes!.primary as never,
        SCHEME.darkModeTonePalettes!.secondary as never,
        SCHEME.darkModeTonePalettes!.tertiary as never,
      ),
      'neutral', 'primary-fixed' as never, SCHEME.extractedTones, 'modern',
      {
        header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
        decorative: { family: 'Bebas Neue', weight: '400', letterSpacing: '0em', allCaps },
        body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
      },
      'CapsTest', undefined, undefined, undefined, 'light-tonal', undefined,
      { background: 'neutral' as never, button: 'primary-fixed' as never,
        cardColoring: 'tonal' as never, textColoring: 'standard' as never },
    ) as unknown as Record<string, any>;
    const figma = generateFigmaJSON(json as never) as never as Record<string, any>;
    // The type styles live under Typography.styles, not at the top level.
    const styles: any[] = (figma.TypeStyles ?? figma.Typography?.styles ?? figma.textStyles ?? []) as any[];
    return {
      token: json?.Typography?.['Set-Decorative-Caps']?.value,
      display: styles.filter((s) => /display/i.test(String(s.group ?? ''))),
    };
  };

  it('sets UPPER on every Display step when all-caps is on', () => {
    const { token, display } = build(true);
    expect(token).toBe('uppercase');
    expect(display.length).toBeGreaterThan(0);
    expect(display.map((s) => `${s.step}:${s.textCase}`).join(' '))
      .toBe(display.map((s) => `${s.step}:UPPER`).join(' '));
  });

  it('removes it again when all-caps is off', () => {
    const { token, display } = build(false);
    expect(token).toBe('none');
    expect(display.length).toBeGreaterThan(0);
    expect(display.map((s) => `${s.step}:${s.textCase}`).join(' '))
      .toBe(display.map((s) => `${s.step}:ORIGINAL`).join(' '));
  });
});
