/**
 * Fixed Header structure for Dark-Mode
 * Header uses references to Colors for all palettes
 * Dark Mode has different mappings than Light Mode
 */

const darkModeHeaderSurfaces = {
    Neutral: {
      'Color-1': { value: '{Colors.Neutral.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Neutral.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Neutral.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Neutral.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Neutral.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Neutral.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Neutral.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Neutral.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Neutral.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Neutral.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Neutral.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Neutral.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Neutral.Color-9}', type: 'color' }
    },
    Primary: {
      'Color-1': { value: '{Colors.Primary.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Primary.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Primary.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Primary.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Primary.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Primary.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Primary.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Primary.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Primary.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Primary.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Primary.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Primary.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Primary.Color-9}', type: 'color' }
    },
    Secondary: {
      'Color-1': { value: '{Colors.Secondary.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Secondary.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Secondary.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Secondary.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Secondary.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Secondary.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Secondary.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Secondary.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Secondary.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Secondary.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Secondary.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Secondary.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Secondary.Color-9}', type: 'color' }
    },
    Tertiary: {
      'Color-1': { value: '{Colors.Tertiary.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Tertiary.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Tertiary.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Tertiary.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Tertiary.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Tertiary.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Tertiary.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Tertiary.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Tertiary.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Tertiary.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Tertiary.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Tertiary.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Tertiary.Color-9}', type: 'color' }
    },
    BW: {
      'Color-1': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Hotlink-Visited.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Hotlink-Visited.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Hotlink-Visited.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Hotlink-Visited.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Hotlink-Visited.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Colors.Neutral.Color-1}', type: 'color' }
    },
    Info: {
      'Color-1': { value: '{Colors.Info.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Info.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Info.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Info.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Info.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Info.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Info.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Info.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Info.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Info.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Info.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Info.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Info.Color-9}', type: 'color' }
    },
    Success: {
      'Color-1': { value: '{Colors.Success.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Success.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Success.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Success.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Success.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Success.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Success.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Success.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Success.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Success.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Success.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Success.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Success.Color-9}', type: 'color' }
    },
    Warning: {
      'Color-1': { value: '{Colors.Warning.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Warning.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Warning.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Warning.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Warning.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Warning.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Warning.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Warning.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Warning.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Warning.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Warning.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Warning.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Warning.Color-9}', type: 'color' }
    },
    Error: {
      'Color-1': { value: '{Colors.Error.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Error.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Error.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Error.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Error.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Error.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Error.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Error.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Error.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Error.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Error.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Error.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Error.Color-9}', type: 'color' }
    },
    'Hotlink-Visited': {
      'Color-1': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-2': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-3': { value: '{Colors.Hotlink-Visited.Color-10}', type: 'color' },
      'Color-4': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' },
      'Color-5': { value: '{Colors.Hotlink-Visited.Color-11}', type: 'color' },
      'Color-6': { value: '{Colors.Hotlink-Visited.Color-2}', type: 'color' },
      'Color-7': { value: '{Colors.Hotlink-Visited.Color-3}', type: 'color' },
      'Color-8': { value: '{Colors.Hotlink-Visited.Color-4}', type: 'color' },
      'Color-9': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-10': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-11': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-12': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' },
      'Color-Vibrant': { value: '{Modes.Light-Mode.Colors.Hotlink-Visited.Color-9}', type: 'color' }
    }
};

/**
 * Container tokens, derived from the Surfaces table.
 *
 * Containers no longer vary with the background tone — in dark mode every container level is drawn from the
 * Color-2..Color-4 ramp regardless of background. Color-4 is the lightest
 * level and therefore the hardest case for light text.
 * Every index therefore resolves to the Surfaces entry for Color-4, the
 * correct pairing for that container colour. Deriving rather than hand-
 * maintaining a second table means the two cannot drift apart.
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

export const darkModeHeaderFixed = {
  Surfaces: darkModeHeaderSurfaces,
  Containers: containersFromSurfaces(darkModeHeaderSurfaces, 'Color-4'),
};

