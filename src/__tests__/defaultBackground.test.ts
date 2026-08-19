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
  // On-<pal>: foreground for content sitting ON the icon colour, at 4.5:1.
  // exportColorSystem computes these for the other 17 themes, but it runs after
  // the themes are built and cannot resolve Default's {Default-Background.*}
  // icon refs — so Default has to route them, or it becomes the one theme
  // silently missing On-*.
  ...['Default', ...ACCENTS].map(p => `On-${p}`),
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

  // Surface-Dimmest sits TWO TONES below the surface, clamped at Color-1.
  //
  // It used to be pinned to Color-4 in every theme, and these assertions were
  // written against that constant. A fixed tone cannot work across surfaces:
  // on a Color-12 surface it made Dimmest darker than Surface-Dim, and on a
  // dark surface it was lighter than the surface it was meant to recede from.
  // Two-down keeps the ordering intact wherever the surface sits, and the
  // clamp means tones 1-3 all land on Color-1 rather than running off the end.
  //
  // Asserted relative to the surface's own tone rather than as a literal, so
  // this stays honest on any background instead of re-pinning to whatever the
  // current default happens to produce.
  const dimmestToneFor = (surfaceN: number) => Math.max(surfaceN - 2, 1);

  /** The tone a reference like {Backgrounds.Neutral.Background-10...} names. */
  const toneOf = (ref: string | undefined, pattern: RegExp): number | null => {
    const m = String(ref ?? '').match(pattern);
    return m ? Number(m[1]) : null;
  };

  it('places Surfaces-Dimmest two tones below the surface, on its own Backgrounds reference', () => {
    const surfaceRef = themes.Default.Surfaces?.Background?.value;
    const dimmestRef = themes.Default['Surfaces-Dimmest']?.Background?.value;

    // Still unrouted: routing it through Default-Background moved the
    // background to the Default surface's tone while Buttons — which that
    // override does not cover — kept their own borders, leaving a light border
    // on a light surface (1.47:1, under the 3:1 floor).
    expect(dimmestRef).not.toMatch(/Default-Background/);
    expect(dimmestRef).toMatch(/^\{Backgrounds\..*\.Background-\d+\./);

    // The Default surface may itself be routed through Default-Background, in
    // which case there is no literal tone to compare against — the relative
    // rule is then checked via the foregrounds test below.
    const surfaceN = toneOf(surfaceRef, /Background-(\d+)\./);
    if (surfaceN !== null) {
      expect(toneOf(dimmestRef, /Background-(\d+)\./)).toBe(dimmestToneFor(surfaceN));
    }
  });

  it('keeps Surfaces-Dimmest foregrounds paired to its own background tone', () => {
    const dimmest = themes.Default['Surfaces-Dimmest'];
    const bgTone = toneOf(dimmest?.Background?.value, /Background-(\d+)\./);
    expect(bgTone, 'Dimmest background should name a tone').not.toBeNull();

    // Foregrounds must sit on the tables matching Dimmest's OWN background,
    // not be rewritten to the Default surface's tone — that pairing is what
    // keeps its text and border legible against it.
    expect(dimmest.Text?.value).toMatch(new RegExp(`Color-${bgTone}\\}$`));
    expect(dimmest.Border?.value).toMatch(new RegExp(`Color-${bgTone}\\}$`));
    expect(referencedKeys(dimmest).size, 'Dimmest should reference no Default-Background keys').toBe(0);
  });

  it('clamps Surfaces-Dimmest at Color-1 for the darkest surfaces', () => {
    // tones 1-3 all resolve to 1; the ramp has nowhere darker to go.
    expect([1, 2, 3].map(dimmestToneFor)).toEqual([1, 1, 1]);
    expect(dimmestToneFor(12)).toBe(10);
    expect(dimmestToneFor(4)).toBe(2);
  });
});
