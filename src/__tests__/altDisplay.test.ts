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

  it('steps UP toward Bold when the Display is not already bold', () => {
    /* A drop alone cannot work at both ends. Display 400 minus three rungs is
       200 — Thin, which reads as a rendering fault rather than a second voice.
       So a lighter Display goes the other way and the Alt is a contrast either
       direction. */
    expect(altDisplayWeight(400, [100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(700);
    expect(altDisplayWeight(600, [100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(700);
    /* Nearest to Bold among what the family actually ships. */
    expect(altDisplayWeight(300, [300, 400, 500])).toBe(500);
    /* Nothing heavier shipped — track the face rather than invent a weight. */
    expect(altDisplayWeight(400, [100, 400])).toBeUndefined();
  });

  it('steps DOWN, and never below the legibility floor, once Display is bold', () => {
    expect(altDisplayWeight(800, [100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(500);
    expect(altDisplayWeight(700, [400, 500, 600, 700, 800, 900])).toBe(400);
    /* The floor is 300: Light is a display voice, Thin is not — at 34px on a
       phone a 200 loses the stroke contrast the face was chosen for.

       It only binds on a SPARSE ramp. Stepping down needs Display at 700+, so
       the target is never under 400; the floor matters for a family that ships
       nothing between a hairline and a heavy, where the nearest candidate
       would otherwise be a 200. */
    const w = altDisplayWeight(700, [100, 400]);
    expect(w === undefined || w >= ALT_DISPLAY_MIN_WEIGHT).toBe(true);
    expect(altDisplayWeight(700, [100])).toBeUndefined();
    expect(altDisplayWeight(800, [200, 800])).toBeUndefined();     // 200 refused
    expect(altDisplayWeight(800, [300, 800])).toBe(300);           // 300 allowed
    expect(ALT_DISPLAY_MIN_WEIGHT).toBe(300);
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
  it('mirrors Display step for step, in every platform block', async () => {
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    /* The pairing sets ONE WORD on one baseline — "Omni" in Display, "Design"
       in the Alt — so any divergence in size or leading and the halves stop
       lining up.

       Asserted in the STYLESHEET, not the payload, and that is the point of
       the trim: Figma no longer offers Alt's size, leading or tracking,
       because nothing may ever select between them and Display's. The CSS
       still declares all four, since the lib reads them by name. So the
       stylesheet is now the only place the pairing can be checked — and the
       only place it can break. */
    const css = buildTypographyTokensCSS([
      { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never);

    for (const platform of ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android']) {
      const block = css.match(
        new RegExp(`\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      expect(`${platform} block found: ${block.length > 0}`).toBe(`${platform} block found: true`);
      for (const step of ['Small', 'Medium', 'Large']) {
        for (const prop of ['Font-Size', 'Line-Height']) {
          const read = (name: string) =>
            block.match(new RegExp(`--${name}-${step}-${prop}:\\s*([^;]+);`))?.[1]?.trim();
          expect(`${platform}/${step}/${prop}: ${read('Alt-Display')}`)
            .toBe(`${platform}/${step}/${prop}: ${read('Display')}`);
        }
      }
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

  it('takes stop 2 from the cascade: Secondary, else Tertiary, else a Primary tone', async () => {
    /* A two-hue gradient between distant hues cannot look right, and no
       interpolation space rescues it — measured on a real brand, green (151)
       to pink (350) is 160 degrees apart and the sRGB midpoint lands at
       chroma 5, flat grey, against ends of 53 and 62. OKLCH keeps the chroma
       but invents a third hue the brand does not own, and Figma interpolates
       in sRGB anyway. So the fix is WHICH colours are blended. */
    const gen = (await import('../utils/cssgen/generateCompleteThemes'))
      .generateAllThemesWithSurfacesAndContainers;
    const at = (stop2: string) => {
      const themes: any = gen('Light-Mode', { primary: 71, secondary: 71, tertiary: 71 },
        'light-tonal', 'complementary' as never, undefined, stop2 as never);
      return String(themes.Default.Surfaces['Alt-Color-Gradient-Stop-2'].value);
    };
    expect(at('Secondary')).toContain('Header.Surfaces.Secondary');
    expect(at('Tertiary')).toContain('Header.Surfaces.Tertiary');
    /* mono is a tone of PRIMARY, and reaches past the Header table on purpose:
       that table gives one tone per background, so a neighbouring index is
       frequently the same colour — backgrounds 9-12 all resolve alike — and a
       gradient whose stops collapse renders as a flat fill that looks like it
       worked. */
    expect(at('mono')).toMatch(/^\{Colors\.Primary\.Color-\d+\}$/);
  });

  it('sends the mono stop AWAY from the background, never toward it', async () => {
    /* Contrast is distance from the background, and stop 1 is already the
       accessible Header colour for it — so moving further can only raise
       contrast, and moving toward it is the only way to break 3:1.
       Backgrounds 1-6 are dark, 7-12 light, per the background tables' own
       comments. */
    const { monoStopTone, MONO_STOP_TONE, DARK_BACKGROUND_MAX } =
      await import('../utils/altDisplay');
    for (let n = 1; n <= DARK_BACKGROUND_MAX; n++) {
      expect(`bg ${n}: ${monoStopTone(n)}`).toBe(`bg ${n}: ${MONO_STOP_TONE.dark}`);
    }
    for (let n = DARK_BACKGROUND_MAX + 1; n <= 12; n++) {
      expect(`bg ${n}: ${monoStopTone(n)}`).toBe(`bg ${n}: ${MONO_STOP_TONE.light}`);
    }
    /* Light on dark, dark on light — so the two must sit on opposite ends. */
    expect(MONO_STOP_TONE.dark).toBeGreaterThan(MONO_STOP_TONE.light);
  });

  it('picks the cascade from the hues, not from the scheme name', async () => {
    const { altStop2Palette } = await import('../utils/altDisplay');
    /* Secondary wins when it is near. */
    expect(altStop2Palette('#7b2d8e', '#5b2d9e', '#2e9e5b')).toBe('Secondary');
    /* Tertiary is the fallback when Secondary is far but Tertiary is near. */
    expect(altStop2Palette('#2e9e5b', '#e0559c', '#3f9e6e')).toBe('Tertiary');
    /* Neither near — the real green/pink/blue case — so a Primary tone. */
    expect(altStop2Palette('#2e9e5b', '#e0559c', '#3b5bd4')).toBe('mono');
    /* Unanswerable resolves to mono, which needs no second hue. */
    expect(altStop2Palette(undefined, '#5b2d9e', '#2e9e5b')).toBe('mono');
    expect(altStop2Palette('#2e9e5b')).toBe('mono');
  });

  it('keeps the two STOPS on different palettes, so the gradient cannot go flat', async () => {
    /* The solid and stop 1 are both Primary, deliberately: the gradient is the
       solid extended, not a third colour. What must never collapse is the pair
       of STOPS — equal stops render a flat fill that looks like a working
       gradient and is not one.

       Different PALETTES rather than derived shades is what guarantees it at
       background tones 5 and 6, where a ramp can run out and a derived colour
       lands back on the one it came from. */
    const s = (await build('analogous')).Default.Surfaces;
    expect(String(s['Alt-Display-Color'].value)).toBe(String(s['Alt-Color-Gradient-Stop-1'].value));
    expect(String(s['Alt-Color-Gradient-Stop-1'].value))
      .not.toBe(String(s['Alt-Color-Gradient-Stop-2'].value));
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

describe('the Alt Display variable trim', () => {
  it('offers only the weight to Figma, and keeps every token in the CSS', async () => {
    /* Invariant 2: the test is not "do the copies match" but "does anything
       SELECT between them". Alt's size, leading and tracking are identical to
       Display's on every device and in both faces, and the pairing REQUIRES
       them equal — so publishing them twice manufactures a choice that must
       never be exercised. Someone nudges Alt-Display-Large-Font-Size and
       "Omni" + "Design" stops lining up, with no error anywhere.

       The CSS keeps them because the two are different kinds of thing: a CSS
       token is a DEPENDENCY the lib reads by name, a Figma variable is an
       OFFER. Withdrawing an offer nobody should accept costs nothing;
       withdrawing the token breaks a consumer's build. */
    const { generateFigmaJSON } = await import('../utils/generateFigmaJSON');
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const { DEVICES_COLLECTION, DEVICE_TYPES } = await import('../utils/typographyPlatform');
    const css = buildTypographyTokensCSS([
      { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never);
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
      }, css);

    for (const device of DEVICE_TYPES) {
      const alt = Object.keys(out[DEVICES_COLLECTION][device]).filter((k) => k.includes('Alt-Display'));
      /* Three steps x two faces, weight only. */
      expect(`${device}: ${alt.length}`).toBe(`${device}: 6`);
      expect(`${device}: ${alt.every((k) => k.endsWith('-Font-Weight'))}`).toBe(`${device}: true`);
    }

    /* And the stylesheet still declares all four properties per step. */
    for (const step of ['Large', 'Medium', 'Small']) {
      for (const prop of ['Font-Size', 'Line-Height', 'Letter-Spacing', 'Font-Weight']) {
        expect(`--Alt-Display-${step}-${prop}: ${css.includes(`--Alt-Display-${step}-${prop}`)}`)
          .toBe(`--Alt-Display-${step}-${prop}: true`);
      }
    }
  });
});

describe('the Alt Display weight across devices', () => {
  const FIG = async (family: string, weight: string) => {
    const { generateFigmaJSON } = await import('../utils/generateFigmaJSON');
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const css = buildTypographyTokensCSS([
      { type: 'decorative', family, weight, displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never);
    return {
      css,
      figma: generateFigmaJSON({
        Typography: {
          'Set-Font-Family-Header': { value: 'Poppins' },
          'Set-Font-Family-Body': { value: 'Inter' },
          'Set-Font-Family-Decorative': { value: family },
        },
        _componentStyle: {
          buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
          bevelOpacity: 50, shadowResolution: 3,
          buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
        },
      }, css),
    };
  };

  it('is the SAME on every device for Omni, and varies for System', async () => {
    /* Omni is the brand's own face, so its weight is a property of the FAMILY:
       Playfair's lighter step does not change because the reader is on a
       phone. System is the PLATFORM's face, and Apple and Google answer for
       themselves — Desktop excepted, where System mirrors Omni.

       This failed before: the device blocks are static and cannot know which
       family was picked, so they shipped the literal 600 the asset held while
       the generated Desktop block carried the derived 500. One brand, two
       answers, and no error. */
    const { DEVICES_COLLECTION, DEVICE_TYPES } = await import('../utils/typographyPlatform');
    const { figma } = await FIG('Playfair Display', '800');
    const at = (device: string, face: string) =>
      figma[DEVICES_COLLECTION][device][`Typography/${face}/Displays/Alt-Display-Large-Font-Weight`]?.value;

    for (const device of DEVICE_TYPES) {
      expect(`${device} Omni: ${at(device, 'Omni')}`).toBe(`${device} Omni: 500`);
    }
    expect(at('Desktop', 'System')).toBe(500);          // Desktop's System mirrors Omni
    for (const device of DEVICE_TYPES) {
      if (device === 'Desktop') continue;
      expect(`${device} System: ${at(device, 'System')}`).toBe(`${device} System: 400`);
    }
  });

  it('says the same number in the stylesheet as in the payload', async () => {
    /* Fixed in the STYLESHEET, not patched in the payload. The payload is
       derived from this CSS, so correcting it downstream would have left the
       web rendering 600 and Figma showing 500 — invariant 5 introduced on
       purpose, with convenience as the excuse. */
    const { css } = await FIG('Playfair Display', '800');
    for (const platform of ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android']) {
      const block = css.match(
        new RegExp(`\\[data-platform="${platform}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      const w = block.match(/--Alt-Display-Large-Font-Weight:\s*([^;]+);/)?.[1]?.trim();
      expect(`${platform}: ${w}`).toBe(`${platform}: 500`);
    }
  });

  it('leaves a one-weight family tracking its face rather than pinning a number', async () => {
    /* Anton ships [400] alone, so there is no lighter step to drop to. The Alt
       must follow the face — pinning 400 would stop it moving with the user's
       slider — and colour carries the distinction instead. */
    const { css } = await FIG('Anton', '400');
    const desktop = css.match(/\[data-platform="Desktop"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(desktop).toMatch(/--Alt-Display-Large-Font-Weight:\s*var\(--Font-Weight-Display\)/);
  });
});

describe('the Display family weight in Devices-Type', () => {
  it('is a NUMBER, so the Alt keeps the weight it worked out', async () => {
    /* The bug this prevents: every Font-Weight became an alias to its face
       root, so Alt-Display-*-Font-Weight pointed at Display-Font-Weight and
       the two rendered identically — the distinction deleted by the very link
       meant to keep them in step.

       It was also decided by the wrong design. WEIGHT_FACES is built once from
       buildTypeScale(null), the DEFAULT scale, while whether the Alt follows
       its face depends on the user's own family — Raleway has a lighter weight
       to drop to, Anton does not. A table computed from Open Sans cannot
       answer that for either. */
    const { generateFigmaJSON } = await import('../utils/generateFigmaJSON');
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const { DEVICES_COLLECTION, DEVICE_TYPES } = await import('../utils/typographyPlatform');
    const out = generateFigmaJSON({
      Typography: {
        'Set-Font-Family-Header': { value: 'Poppins' },
        'Set-Font-Family-Body': { value: 'Inter' },
        'Set-Font-Family-Decorative': { value: 'Raleway' },
      },
      _componentStyle: {
        buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
        bevelOpacity: 50, shadowResolution: 3,
        buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
      },
    }, buildTypographyTokensCSS([
      { type: 'decorative', family: 'Raleway', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never));

    for (const device of DEVICE_TYPES) {
      for (const face of ['Omni', 'System'] as const) {
        for (const step of ['Large', 'Medium', 'Small']) {
          for (const token of [`Display-${step}`, `Alt-Display-${step}`]) {
            const v = out[DEVICES_COLLECTION][device][
              `Typography/${face}/Displays/${token}-Font-Weight`]?.value;
            expect(`${device}/${face}/${token}: ${typeof v}`)
              .toBe(`${device}/${face}/${token}: number`);
          }
        }
      }
    }

    /* And the two differ, which is the whole point of the Alt. Raleway ships
       a lighter weight, so the drop is real. */
    const d = out[DEVICES_COLLECTION].Desktop;
    const at = (t: string) => d[`Typography/Omni/Displays/${t}-Font-Weight`].value;
    expect(at('Display-Large')).toBe(800);
    expect(at('Alt-Display-Large')).toBe(500);
  });

  it('leaves Headers aliasing its root, which is the behaviour asked for', async () => {
    const { generateFigmaJSON } = await import('../utils/generateFigmaJSON');
    const { buildTypographyTokensCSS } = await import('../utils/typographyTokens');
    const { DEVICES_COLLECTION } = await import('../utils/typographyPlatform');
    const out = generateFigmaJSON({
      Typography: {
        'Set-Font-Family-Header': { value: 'Poppins' },
        'Set-Font-Family-Body': { value: 'Inter' },
        'Set-Font-Family-Decorative': { value: 'Raleway' },
      },
      _componentStyle: {
        buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
        bevelOpacity: 50, shadowResolution: 3,
        buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
      },
    }, buildTypographyTokensCSS([
      { type: 'decorative', family: 'Raleway', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never));
    const h1 = out[DEVICES_COLLECTION].Desktop['Typography/Omni/Headers/H1-Font-Weight'].value;
    expect(String(h1)).toContain('Headers-Font-Weight');
  });
});
