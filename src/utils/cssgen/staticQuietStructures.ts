/**
 * Complete Quiet token structures for Light Mode and Dark Mode
 * Extracted from sample-output.json with all palettes
 */

/**
 * Derive the Containers half of a token family from its Surfaces half.
 *
 * Containers no longer vary with the background tone: in light mode every
 * container level is flat at Color-11, and in dark mode every level is drawn
 * from the Color-2..Color-4 ramp regardless of which background it sits on.
 * A per-tone container table is therefore meaningless — every index resolves
 * to the Surfaces entry for the anchor tone, which is the correct pairing for
 * the colour the container actually renders at.
 *
 * Dark anchors on Color-4. Anchors Color-1..5 all clear 4.5:1 on every container level
 * (worst 6.85-10.00); Color-4 is chosen for its tone, sitting between the
 * deeper Color-9 tint and the near-white Color-12. Color-6 is the cliff —
 * it flips to dark text and fails all 192 pairs.; light anchors on Color-11, the only
 * tone a light container ever takes.
 */
function containersFromSurfaces<T extends Record<string, Record<string, unknown>>>(
  surfaces: T,
  anchorFor: string | ((key: string) => string),
): T {
  const resolveAnchor = typeof anchorFor === 'function' ? anchorFor : () => anchorFor;
  const out: Record<string, Record<string, unknown>> = {};
  for (const palette of Object.keys(surfaces)) {
    out[palette] = {};
    for (const key of Object.keys(surfaces[palette])) {
      out[palette][key] = surfaces[palette][resolveAnchor(key)];
    }
  }
  return out as T;
}

/**
 * Light-mode container anchor. Index N is the BACKGROUND tone the theme sits
 * on; the container it produces is Color-11 on a light background (tones 6-12)
 * and Color-2 on a dark one (tones 1-5, e.g. the Black theme).
 */
const lightContainerAnchor = (key: string): string => {
  const n = parseInt(key.replace('Color-', ''), 10);
  return Number.isFinite(n) && n <= 5 ? 'Color-2' : 'Color-11';
};

export function getStaticQuietTokensForLightMode() {
  const createQuietPaletteMapping = (paletteName: string) => ({
    'Color-1': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-2': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-3': { value: `{Colors.${paletteName}.Color-7}`, type: 'color' },
    'Color-4': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-5': { value: `{Colors.${paletteName}.Color-9}`, type: 'color' },
    'Color-6': { value: `{Colors.${paletteName}.Color-2}`, type: 'color' },
    'Color-7': { value: `{Colors.${paletteName}.Color-3}`, type: 'color' },
    'Color-8': { value: `{Colors.${paletteName}.Color-4}`, type: 'color' },
    'Color-9': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-10': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-11': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-12': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-Vibrant': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' }
  });

  const surfaces = {
      Neutral: createQuietPaletteMapping('Neutral'),
      Primary: createQuietPaletteMapping('Primary'),
      Secondary: createQuietPaletteMapping('Secondary'),
      Tertiary: createQuietPaletteMapping('Tertiary'),
      Info: createQuietPaletteMapping('Info'),
      Success: createQuietPaletteMapping('Success'),
      Warning: createQuietPaletteMapping('Warning'),
      Error: createQuietPaletteMapping('Error'),
      'Hotlink-Visited': createQuietPaletteMapping('Hotlink-Visited'),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-6}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-6}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-7}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-9}', type: 'color' },
        'Color-6': { value: '{Colors.White}', type: 'color' },
        'Color-7': { value: '{Colors.White}', type: 'color' },
        'Color-8': { value: '{Colors.White}', type: 'color' },
        'Color-9': { value: '{Colors.White}', type: 'color' },
        'Color-10': { value: '{Colors.White}', type: 'color' },
        'Color-11': { value: '{Colors.White}', type: 'color' },
        'Color-12': { value: '{Colors.White}', type: 'color' },
        'Color-Vibrant': { value: '{Colors.White}', type: 'color' }
      }
    };

  return {
    Surfaces: surfaces,
    Containers: containersFromSurfaces(surfaces, lightContainerAnchor),
  };
}

export function getStaticQuietTokensForDarkMode() {
  const createDarkModeQuietMapping = (paletteName: string, usesPrimaryVariant: boolean = false) => ({
    'Color-1': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-2': { value: `{Colors.${paletteName}.Color-6}`, type: 'color' },
    'Color-3': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-4': { value: `{Colors.${paletteName}.Color-8}`, type: 'color' },
    'Color-5': { value: `{Colors.${paletteName}.Color-10}`, type: 'color' },
    'Color-6': { value: `{Colors.${paletteName}.Color-2}`, type: 'color' },
    'Color-7': { value: `{Colors.${paletteName}.Color-3}`, type: 'color' },
    'Color-8': { value: `{Colors.${paletteName}.Color-4}`, type: 'color' },
    'Color-9': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-10': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-11': { value: `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-12': { value: usesPrimaryVariant ? `{Colors.${paletteName}.Color-4}` : `{Colors.${paletteName}.Color-5}`, type: 'color' },
    'Color-Vibrant': { value: `{Modes.Light-Mode.Colors.${paletteName}.Color-9}`, type: 'color' }
  });

  const surfaces = {
      Neutral: createDarkModeQuietMapping('Neutral', false),
      Primary: createDarkModeQuietMapping('Primary', true),
      Secondary: createDarkModeQuietMapping('Secondary', false),
      Tertiary: createDarkModeQuietMapping('Tertiary', false),
      Info: createDarkModeQuietMapping('Info', false),
      Success: createDarkModeQuietMapping('Success', false),
      Warning: createDarkModeQuietMapping('Warning', false),
      Error: createDarkModeQuietMapping('Error', false),
      'Hotlink-Visited': createDarkModeQuietMapping('Hotlink-Visited', false),
      BW: {
        'Color-1': { value: '{Colors.Neutral.Color-6}', type: 'color' },
        'Color-2': { value: '{Colors.Neutral.Color-6}', type: 'color' },
        'Color-3': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-4': { value: '{Colors.Neutral.Color-8}', type: 'color' },
        'Color-5': { value: '{Colors.Neutral.Color-10}', type: 'color' },
        'Color-6': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-7': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-8': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-9': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-10': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-11': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-12': { value: '{Colors.Neutral.Color-1}', type: 'color' },
        'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Neutral.Color-9}', type: 'color' }
      }
    };

  return {
    Surfaces: surfaces,
    Containers: containersFromSurfaces(surfaces, 'Color-4'),
  };
}
