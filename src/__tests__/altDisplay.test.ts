import { describe, it, expect } from 'vitest';
import {
  altDisplayGradient, altDisplayWeight, hueDelta, isAnalogous,
  ANALOGOUS_MAX_HUE_DELTA, ALT_DISPLAY_MIN_WEIGHT,
  ALT_DISPLAY_COLOR_TOKENS, ALT_DISPLAY_MIN_CONTRAST,
} from '../utils/altDisplay';

describe('the analogous test', () => {
  it('measures the SHORT way round the wheel', () => {
    /* 350 and 10 are 20 apart, not 340. A subtraction without the wrap calls
       every red-to-magenta pair opposite, which is the pair most likely to be
       analogous in a warm brand. */
    expect(Math.round(hueDelta('#ff0033', '#ff0088'))).toBeLessThan(60);
    expect(hueDelta('#ff0000', '#ff0000')).toBe(0);
  });

  it('is symmetric — order cannot change the answer', () => {
    const pairs: [string, string][] = [
      ['#7b2d8e', '#2d6f8e'], ['#ff8800', '#0088ff'], ['#123456', '#654321'],
    ];
    for (const [a, b] of pairs) {
      expect(hueDelta(a, b)).toBeCloseTo(hueDelta(b, a), 6);
    }
  });

  it('never exceeds half the wheel', () => {
    for (const [a, b] of [['#ff0000', '#00ffff'], ['#00ff00', '#ff00ff']] as const) {
      expect(hueDelta(a, b)).toBeLessThanOrEqual(180);
    }
  });
});

describe('which gradient the Alt Display gets', () => {
  it('blends two hues when Primary and Secondary are neighbours', () => {
    /* Purple and blue-violet — the case the rule exists for. */
    const c = altDisplayGradient('#7b2d8e', '#5b2d9e');
    expect(c.kind).toBe('duo');
    expect(c.delta).toBeLessThanOrEqual(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('ramps ONE hue when they are opposites', () => {
    /* Blending across the wheel passes through the desaturated middle, where
       both ends lose contrast at once. A same-hue ramp still gives the brand a
       gradient — the treatment is never denied, only changed. */
    const c = altDisplayGradient('#7b2d8e', '#8e7b2d');
    expect(c.kind).toBe('mono');
    expect(c.delta).toBeGreaterThan(ANALOGOUS_MAX_HUE_DELTA);
  });

  it('treats a grey as distant, not as a perfect match', () => {
    /* chroma gives a true grey a NaN hue. Read as 0 it would be the ONE value
       that switches the gradient on, and a grey-to-purple blend looks like a
       rendering fault rather than a decision. */
    expect(altDisplayGradient('#7b2d8e', '#808080').kind).toBe('mono');
    expect(hueDelta('#808080', '#7b2d8e')).toBe(180);
  });

  it('falls back to the one-hue ramp rather than guessing', () => {
    /* mono needs only ONE hue to be known, so it is the answer that survives a
       missing or unparseable palette. */
    expect(altDisplayGradient(undefined, '#5b2d9e').kind).toBe('mono');
    expect(altDisplayGradient('#7b2d8e', undefined).kind).toBe('mono');
    expect(altDisplayGradient('not-a-colour', '#5b2d9e').kind).toBe('mono');
  });

  it('agrees with isAnalogous', () => {
    /* Two entry points, one threshold. */
    for (const [a, b] of [['#7b2d8e', '#5b2d9e'], ['#7b2d8e', '#8e7b2d'],
                          ['#ff0000', '#00ff00']] as const) {
      expect(altDisplayGradient(a, b).kind === 'duo').toBe(isAnalogous(a, b));
    }
  });
});

describe('the Alt Display weight', () => {
  it('drops to a markedly lighter weight the family actually ships', () => {
    expect(altDisplayWeight(800, [100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(500);
    expect(altDisplayWeight(700, [400, 500, 600, 700, 800, 900])).toBe(400);
  });

  it('returns undefined for a one-weight family', () => {
    /* The COMMON case, not an edge: 56% of the curated display pool ships one
       weight — Anton, Bangers, Lobster, Great Vibes, Alfa Slab One. Returning
       a number here would mean a synthesised thin on the web and a font Figma
       refuses to load. Colour is what distinguishes the Alt; weight only
       sharpens it where the family can. */
    expect(altDisplayWeight(400, [400])).toBeUndefined();
    expect(altDisplayWeight(700, [700])).toBeUndefined();
    expect(altDisplayWeight(400, undefined)).toBeUndefined();
    expect(altDisplayWeight(400, [])).toBeUndefined();
  });

  it('never goes heavier, and never below the legibility floor', () => {
    /* Heavier would read as emphasis, which is the opposite of the intent. */
    expect(altDisplayWeight(300, [300, 400, 500])).toBeUndefined();
    const w = altDisplayWeight(400, [100, 400]);
    expect(w === undefined || w >= ALT_DISPLAY_MIN_WEIGHT).toBe(true);
  });

  it('breaks a tie toward the lighter weight', () => {
    /* 300 either side of the target: the point is to be visibly different, and
       the lighter of two equals is more different. */
    expect(altDisplayWeight(700, [300, 500])).toBe(300);
  });
});

describe('the colour family the Alt Display wears', () => {
  it('is Header, never Text', () => {
    /* A Display is a heading. The two families are tuned to different
       thresholds — Text 4.5:1, Header 3:1 — so they pick different tones, and
       using the Text tokens would not be a stricter reading of the rule, it
       would be a different colour on the page. */
    expect(ALT_DISPLAY_COLOR_TOKENS.primary).toBe('--Header-Primary');
    expect(ALT_DISPLAY_COLOR_TOKENS.secondary).toBe('--Header-Secondary');
    expect(JSON.stringify(ALT_DISPLAY_COLOR_TOKENS)).not.toContain('Text-');
  });

  it('clamps at 3:1, the threshold for headers and for large text alike', () => {
    expect(ALT_DISPLAY_MIN_CONTRAST).toBe(3);
  });
});

describe('the Alt Display type styles', () => {
  it('mirrors Display step for step, on every device', async () => {
    /* The pairing sets ONE WORD on one baseline — "Omni" in Display, "Design"
       in the Alt. Any divergence in size or leading and the two halves stop
       lining up, which is the whole feature.

       Checked through the payload, not the scale, because the device blocks
       are where this breaks: a style the mobile blocks do not declare gets
       filled from Desktop by the device-floor merge, so the Alt reported
       Desktop's 72px on every phone until the static blocks carried it. Same
       failure Display-Medium had. */
    const { generateFigmaJSON } = await import('../utils/generateFigmaJSON');
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const { DEVICES_COLLECTION, DEVICE_TYPES } = await import('../utils/typographyPlatform');
    const out = generateFigmaJSON(
      {
        Typography: {
          'Set-Font-Family-Header': { value: 'Poppins' },
          'Set-Font-Family-Body': { value: 'Inter' },
          'Set-Font-Family-Decorative': { value: 'Playfair Display' },
        },
        _componentStyle: {
          buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
          bevelOpacity: 50, shadowResolution: 3,
          buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
        },
      },
      buildTypographyTokensCSS([
        { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
        { type: 'header', family: 'Poppins', weight: '600' },
        { type: 'body', family: 'Inter', weight: '400' },
      ] as never),
    );
    for (const device of DEVICE_TYPES) {
      const bag = out[DEVICES_COLLECTION][device];
      const ramp = (prefix: string) => (['Small', 'Medium', 'Large'] as const)
        .map((s) => bag[`Typography/Displays/${prefix}Display-${s}-Font-Size`]?.value).join('/');
      expect(`${device}: ${ramp('Alt-')}`).toBe(`${device}: ${ramp('')}`);
      expect(ramp('Alt-')).not.toContain('undefined');
    }
  });

  it('takes a lighter weight only when the family ships one', async () => {
    const { buildTypeScale } = await import('../utils/typeScale');
    const alt = (family: string, weight: string) =>
      buildTypeScale([{ type: 'decorative', family, weight, displaySize: '72' }] as never)
        .find((s) => s.token === 'Alt-Display-Large');

    /* Playfair ships 400-900, so the Alt drops away from the Display's 800. */
    const multi = alt('Playfair Display', '800');
    expect(multi?.weight).toBe(500);
    expect(multi?.weightFromFace).toBe(false);

    /* Anton ships [400] alone. The Alt must track the FACE rather than pin a
       number — pinning would stop it following the user's slider, and there is
       no lighter weight to pin anyway. Colour carries the distinction here. */
    const single = alt('Anton', '400');
    expect(single?.weight).toBe(400);
    expect(single?.weightFromFace).toBe(true);
  });
});

describe('the Alt Display theme tokens', () => {
  const gen = async () =>
    (await import('../utils/cssgen/generateCompleteThemes'))
      .generateAllThemesWithSurfacesAndContainers;

  const build = async (scheme: string) =>
    (await gen())('Light-Mode', { primary: 71, secondary: 71, tertiary: 71 },
      'light-tonal', scheme as never) as any;

  it('reaches every surface level AND the containers, on every theme', async () => {
    /* Asserted on the OUTPUT of the live generator, not on the helper.
       generateModesThemes in exportColorSystem.ts emits the same token shapes
       and is DEAD CODE — nothing calls it, as the comment at its old call site
       says. Adding these tokens there would have compiled, typechecked and
       shipped nothing, which is the failure this repo has already paid for
       once (a unit test passing while the emission sat in dead code). */
    const themes = await build('analogous');
    const names = Object.keys(themes);
    expect(names.length).toBeGreaterThan(5);
    for (const name of names) {
      for (const [group, bag] of Object.entries<any>(themes[name])) {
        if (!bag || typeof bag !== 'object' || !bag['Header-Primary']) continue;
        for (const token of ['Alt-Display-Color', 'Alt-Color-Gradient-Stop-1',
                             'Alt-Color-Gradient-Stop-2']) {
          expect(`${name}/${group}/${token}`)
            .toBe(bag[token] ? `${name}/${group}/${token}` : `MISSING ${name}/${group}/${token}`);
        }
      }
    }
  });

  it('uses three distinct palettes, the same ones for every scheme', async () => {
    /* Tertiary solid, Primary -> Secondary gradient, unconditionally.
     *
     * Three separate palettes rather than a computed shade of one: a shade has
     * to be derived from somewhere, and at background tones 5 and 6 the ramp
     * can run out, landing the derived colour on the base it came from. The
     * gradient then renders as a flat fill with nothing to say it failed.
     *
     * Scheme-independent on purpose. A stop that moves per brand is a stop a
     * designer cannot reason about, and the earlier analogous branch only ever
     * chose which palette the second stop came from. */
    for (const scheme of ['analogous', 'monochromatic', 'complementary',
                          'triadic', 'split-complementary', 'tetradic']) {
      const surfaces = (await build(scheme)).Default.Surfaces;
      const at = (t: string) => String(surfaces[t].value);
      expect(`${scheme} solid`).toBe(at('Alt-Display-Color').includes('.Tertiary.')
        ? `${scheme} solid` : `${scheme} solid was ${at('Alt-Display-Color')}`);
      expect(`${scheme} stop1`).toBe(at('Alt-Color-Gradient-Stop-1').includes('.Primary.')
        ? `${scheme} stop1` : `${scheme} stop1 was ${at('Alt-Color-Gradient-Stop-1')}`);
      expect(`${scheme} stop2`).toBe(at('Alt-Color-Gradient-Stop-2').includes('.Secondary.')
        ? `${scheme} stop2` : `${scheme} stop2 was ${at('Alt-Color-Gradient-Stop-2')}`);
    }
  });

  it('keeps the three on different palettes, so none can collapse into another', async () => {
    /* The property that makes this safe at tones 5 and 6: the solid and the
       two stops are drawn from three different palettes, so they cannot
       resolve to one another however the ramp behaves. */
    const s = (await build('analogous')).Default.Surfaces;
    const vals = ['Alt-Display-Color', 'Alt-Color-Gradient-Stop-1', 'Alt-Color-Gradient-Stop-2']
      .map((t) => String(s[t].value));
    expect(new Set(vals).size).toBe(3);
  });

  it('tracks the surface it sits on', async () => {
    /* Every token is an ALIAS carrying the surface's own Color-N, never a baked
       hex — a baked pair stops following data-surface and comes out wrong on
       every surface but the one it was sampled on. Different levels must
       therefore resolve to different tones. */
    const d = (await build('analogous')).Default;
    const at = (g: string) => d[g]['Alt-Color-Gradient-Stop-1'].value as string;
    expect(at('Surfaces')).toMatch(/^\{Header\.Surfaces\.Primary\.Color-\d+\}$/);
    expect(at('Surfaces')).not.toBe(at('Surfaces-Dimmest'));
  });
});

describe('the Alt Display CSS', () => {
  it('publishes the three colour tokens in the PREVIEW as well as the export', async () => {
    /* Invariant 5. The export gets them free — processTokens walks the theme
       JSON — while the preview builds its tokens by hand. A token in one and
       not the other raises nothing: no error, no unresolved var, just an Alt
       that is coloured in the export and inherits in the preview. */
    const { buildPreviewCSS } = await import('../utils/buildPreviewCSS');
    const chroma = (await import('chroma-js')).default;
    const { generateSemanticLightModeScale, generateSemanticDarkModeScale } =
      await import('../utils/colorScale');
    const C: [string, string, string] = ['#7b3f9d', '#2563eb', '#b8329b'];
    const css = buildPreviewCSS({
      colorScheme: {
        name: 'Alt', colors: C,
        extractedTones: {
          primary: chroma(C[0]).lch()[0], secondary: chroma(C[1]).lch()[0],
          tertiary: chroma(C[2]).lch()[0],
        },
        tonePalettes: {
          primary: generateSemanticLightModeScale(C[0], undefined, C[0]),
          secondary: generateSemanticLightModeScale(C[1], undefined, C[1]),
          tertiary: generateSemanticLightModeScale(C[2], undefined, C[2]),
        },
        darkModeTonePalettes: {
          primary: generateSemanticDarkModeScale(C[0]),
          secondary: generateSemanticDarkModeScale(C[1]),
          tertiary: generateSemanticDarkModeScale(C[2]),
        },
      },
      userSelections: { background: 'default', button: 'primary-fixed',
                        cardColoring: 'tonal', textColoring: 'tonal' },
      componentStyle: 'modern', mode: 'light',
      typographyStyles: [{ type: 'body', family: 'Inter', weight: '400' }],
    } as never);

    for (const token of ['--Alt-Display-Color', '--Alt-Color-Gradient-Stop-1',
                         '--Alt-Color-Gradient-Stop-2']) {
      expect(`${token} in preview: ${css.includes(token)}`).toBe(`${token} in preview: true`);
    }
  });

  it('defaults to solid and keeps the gradient opt-in, with a forced-colors way out', async () => {
    /* background-clip: text needs color: transparent, so the glyphs are painted
       by a background. In forced-colors the UA drops background-image — without
       the fallback the headline is invisible to exactly the readers who turned
       high contrast on. */
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const css = buildTypographyTokensCSS([
      { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never);

    // Solid on the bare class; the gradient only on .gradient.
    expect(css).toMatch(/\.typography-alt-display-large,[\s\S]{0,200}?color: var\(--Alt-Display-Color/);
    expect(css).toMatch(/\.typography-alt-display-large\.gradient[\s\S]{0,400}?background-clip: text/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]{0,400}?color: CanvasText/);

    /* Every colour is a token read, never a literal — so an add-on can
       re-point a stop per hero, and the Alt follows data-surface. */
    const block = css.slice(css.indexOf('Alt Display colour'));
    const upTo = block.slice(0, block.indexOf('forced-colors') + 400);
    expect(upTo).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
