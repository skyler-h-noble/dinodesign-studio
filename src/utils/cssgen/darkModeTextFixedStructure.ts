/**
 * Fixed Text structure for Dark-Mode with Surfaces/Containers hierarchy
 * This structure is constant and does not change based on color extraction
 * Dark Mode has different mappings than Light Mode
 */
const darkModeTextSurfaces = {
    Neutral: {
      'Color-1': { value: '{Colors.Neutral.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Neutral.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Neutral.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Neutral.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Neutral.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Neutral.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Neutral.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Neutral.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Neutral.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Neutral.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Neutral.Color-5}', type: 'color' as const }
    },
    Primary: {
      'Color-1': { value: '{Colors.Primary.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Primary.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Primary.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Primary.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Primary.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Primary.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Primary.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Primary.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Primary.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Primary.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Primary.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Primary.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Primary.Color-5}', type: 'color' as const }
    },
    Secondary: {
      'Color-1': { value: '{Colors.Secondary.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Secondary.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Secondary.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Secondary.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Secondary.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Secondary.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Secondary.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Secondary.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Secondary.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Secondary.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Secondary.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Secondary.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Secondary.Color-5}', type: 'color' as const }
    },
    Tertiary: {
      'Color-1': { value: '{Colors.Tertiary.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Tertiary.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Tertiary.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Tertiary.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Tertiary.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Tertiary.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Tertiary.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Tertiary.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Tertiary.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Tertiary.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Tertiary.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Tertiary.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Tertiary.Color-5}', type: 'color' as const }
    },
    Info: {
      'Color-1': { value: '{Colors.Info.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Info.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Info.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Info.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Info.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Info.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Info.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Info.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Info.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Info.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Info.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Info.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Info.Color-5}', type: 'color' as const }
    },
    Success: {
      'Color-1': { value: '{Colors.Success.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Success.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Success.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Success.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Success.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Success.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Success.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Success.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Success.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Success.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Success.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Success.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Success.Color-5}', type: 'color' as const }
    },
    Warning: {
      'Color-1': { value: '{Colors.Warning.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Warning.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Warning.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Warning.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Warning.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Warning.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Warning.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Warning.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Warning.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Warning.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Warning.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Warning.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Warning.Color-5}', type: 'color' as const }
    },
    Error: {
      'Color-1': { value: '{Colors.Error.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Error.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Error.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Error.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Error.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Error.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Error.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Error.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Error.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Error.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Error.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Error.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Error.Color-5}', type: 'color' as const }
    },
    'Hotlink-Visited': {
      'Color-1': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' as const },
      'Color-2': { value: '{Colors.Hotlink-Visited.Color-9}', type: 'color' as const },
      'Color-3': { value: '{Colors.Hotlink-Visited.Color-10}', type: 'color' as const },
      'Color-4': { value: '{Colors.Error.Color-10}', type: 'color' as const },
      'Color-5': { value: '{Colors.Hotlink-Visited.Color-12}', type: 'color' as const },
      'Color-6': { value: '{Colors.Hotlink-Visited.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Hotlink-Visited.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Hotlink-Visited.Color-2}', type: 'color' as const },
      'Color-9': { value: '{Colors.Hotlink-Visited.Color-2}', type: 'color' as const },
      'Color-10': { value: '{Colors.Hotlink-Visited.Color-3}', type: 'color' as const },
      'Color-11': { value: '{Colors.Hotlink-Visited.Color-4}', type: 'color' as const },
      'Color-12': { value: '{Colors.Hotlink-Visited.Color-4}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Hotlink-Visited.Color-5}', type: 'color' as const }
    },
    // BW — greyscale text, used by themes whose defaultText is 'BW'.
    //
    // This palette was missing from Dark-Mode entirely (Light defined nine
    // palettes, Dark only eight). With no token to resolve, exportToCSS fell
    // back to its hardcoded index-keyed BW mapping, which handed #040404 to
    // near-black dark containers — every remaining --Text failure, at
    // 1.08-1.48:1.
    //
    // Same split as Light: tones 1-5 are dark backgrounds and take white text;
    // 6-12 are light backgrounds and take near-black. The Containers half is
    // derived from this via containersFromSurfaces(..., 'Color-4'), so dark
    // containers (which sit in the Color-2..4 ramp) correctly resolve to white.
    BW: {
      'Color-1': { value: '{Colors.White}', type: 'color' as const },
      'Color-2': { value: '{Colors.White}', type: 'color' as const },
      'Color-3': { value: '{Colors.White}', type: 'color' as const },
      'Color-4': { value: '{Colors.White}', type: 'color' as const },
      'Color-5': { value: '{Colors.White}', type: 'color' as const },
      'Color-6': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-7': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-8': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-9': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-10': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-11': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-12': { value: '{Colors.Neutral.Color-1}', type: 'color' as const },
      'Color-Vibrant': { value: '{Colors.Neutral.Color-1}', type: 'color' as const }
    }
};

/**
 * Container foreground tokens, derived from the Surfaces table.
 *
 * Containers no longer vary with the background tone, so a per-index table is
 * meaningless here — in dark mode every container level is drawn from the
 * Color-2..Color-4 ramp regardless of which background it sits on. Color-4 is
 * the lightest of those levels and therefore the hardest case for light text.
 * Every index therefore resolves to the Surfaces entry for Color-4, which is
 * the correct pairing for that container colour.
 *
 * Keeping Containers derived (rather than a second hand-maintained table) means
 * the two can't drift: fix a Surfaces tone and the container inherits it.
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

export const darkModeTextFixed = {
  Surfaces: darkModeTextSurfaces,
  Containers: containersFromSurfaces(darkModeTextSurfaces, 'Color-4'),
};

