/**
 * Default-Background coverage tests.
 *
 * The Default theme is the only theme whose background differs per mode (light
 * Neutral-12, dark Neutral-2) while the Theme layer itself is mode-independent.
 * It therefore cannot use the plain {Backgrounds.<pal>.Background-N} +
 * {Text.Surfaces.<pal>.Color-N} pairing every other theme uses, and routes every
 * role through the per-mode Default-Background group instead.
 *
 * That indirection is only correct if it covers EVERY role. A role left behind
 * keeps a hardcoded light-mode tone and pairs a dark foreground with a dark
 * background in dark mode — #232f27 on #111111 = 1.36:1, well under the 4.5:1
 * floor. This is exactly the regression that produced 81 audit failures.
 *
 * The role list is duplicated across three files that must stay in step:
 *   - generateCompleteThemes.ts  emits the {Default-Background.X} references
 *   - generateFigmaJSON.ts       defines the keys for figma.json
 *   - exportToCSS.ts             defines the keys for the CSS
 * Nothing in the type system couples them, and a mismatch fails silently:
 * references go unresolved rather than erroring. These tests are that coupling.
 */
import { describe, it, expect } from 'vitest';
import { generateAllThemesWithSurfacesAndContainers } from '../utils/cssgen/generateCompleteThemes';

const ACCENTS = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
  'Info', 'Success', 'Warning', 'Error'];

/** The 44 roles Default-Background must define, per surface scope. */
const EXPECTED_ROLES = [
  'Text', 'Header', 'Quiet', 'Border', 'Border-Variant',
  'Hover', 'Pressed', 'Focus-Visible', 'Hotlink', 'Hotlink-Visited',
  ...ACCENTS.map(p => `Text-${p}`),
  ...ACCENTS.map(p => `Header-${p}`),
  ...['Default', ...ACCENTS].flatMap(p => [`Icons-${p}`, `Icons-${p}-Variant`]),
];

// Surfaces-Dimmest is intentionally excluded — it is pinned to Color-4 in every
// theme and mode, so it resolves correctly without the indirection. See the
// dedicated test at the bottom.
const SURFACE_SCOPES = ['Surfaces', 'Surfaces-Dim', 'Surfaces-Bright'];

function buildThemes() {
  return generateAllThemesWithSurfacesAndContainers(
    'Light-Mode',
    { primary: 5, secondary: 5, tertiary: 5 },
    'light-tonal',
    'complementary',
    { background: 'white', textColoring: 'tonal', button: 'primary' }
  );
}

/** Every {Default-Background.KEY} referenced anywhere under a theme section. */
function referencedKeys(section: any): Set<string> {
  const found = new Set<string>();
  (function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.value === 'string') {
      const m = node.value.match(/^\{Default-Background\.([^}]+)\}$/);
      if (m) found.add(m[1]);
      return;
    }
    for (const v of Object.values(node)) walk(v);
  })(section);
  return found;
}

describe('Default theme routes every surface role through Default-Background', () => {
  const themes = buildThemes();

  it('generates a Default theme with all four surface scopes', () => {
    expect(themes.Default).toBeDefined();
    for (const scope of [...SURFACE_SCOPES, 'Surfaces-Dimmest']) {
      expect(themes.Default[scope], `missing scope ${scope}`).toBeDefined();
    }
  });

  for (const scope of SURFACE_SCOPES) {
    const prefix = scope === 'Surfaces' ? '' : `${scope.replace('Surfaces-', 'Surface-')}-`;

    it(`${scope}: background routes through Default-Background`, () => {
      const bg = themes.Default[scope]?.Background?.value;
      expect(bg).toMatch(/^\{Default-Background\.Surface/);
    });

    it(`${scope}: every role routes through Default-Background`, () => {
      const refs = referencedKeys(themes.Default[scope]);
      const missing = EXPECTED_ROLES.filter(r => !refs.has(`${prefix}${r}`));
      expect(missing, `roles keeping a hardcoded light-mode tone: ${missing.join(', ')}`).toEqual([]);
    });
  }

  // Icons live in a nested `Icons` object keyed 'Primary' / 'Primary-Variant',
  // flattened to --Icons-Primary only at CSS-emit time. Assigning
  // section['Icons-Primary'] creates a key nothing reads while leaving the real
  // one on its light-mode tone — a silent no-op this test exists to catch.
  it('overrides the nested Icons object, not a flat Icons-* key', () => {
    const surfaces = themes.Default.Surfaces;
    expect(surfaces.Icons, 'Icons should still be a nested object').toBeTypeOf('object');
    expect(surfaces.Icons.Primary?.value).toBe('{Default-Background.Icons-Primary}');
    expect(surfaces.Icons['Primary-Variant']?.value).toBe('{Default-Background.Icons-Primary-Variant}');
    expect(surfaces.Icons.Default?.value).toBe('{Default-Background.Icons-Default}');
    // A flat key here means the override wrote to the wrong shape.
    expect(surfaces['Icons-Primary']).toBeUndefined();
  });

  // Surface-Dimmest is pinned to Color-4 in every theme and every mode, so
  // {Backgrounds.<pal>.Background-4...} already resolves per mode and the
  // indirection buys nothing. Routing it anyway moved the background to the
  // Default surface's tone while Buttons — which this override does not cover —
  // kept their tone-4 borders, putting a light Color-9 border on a light
  // Color-10 surface (1.47:1, under the 3:1 floor). It must stay unrouted.
  it('leaves Surfaces-Dimmest on its own Backgrounds reference', () => {
    const bg = themes.Default['Surfaces-Dimmest']?.Background?.value;
    expect(bg).not.toMatch(/Default-Background/);
    expect(bg).toMatch(/^\{Backgrounds\..*\.Background-4\./);
  });

  it('keeps Surfaces-Dimmest foregrounds paired to its tone-4 background', () => {
    const dimmest = themes.Default['Surfaces-Dimmest'];
    // Foregrounds must stay on the tone-4 tables that match the tone-4
    // background, not be rewritten to the Default surface's tone.
    expect(dimmest.Text?.value).toMatch(/Color-4\}$/);
    expect(dimmest.Border?.value).toMatch(/Color-4\}$/);
    expect(referencedKeys(dimmest).size, 'Dimmest should reference no Default-Background keys').toBe(0);
  });
});
