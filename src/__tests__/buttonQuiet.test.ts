/**
 * --Buttons-<Pal>-Quiet and --Buttons-<Pal>-Outline-Quiet.
 *
 * Two different ideas that are easy to conflate:
 *
 *   Quiet          muted text ON the button's fill. Per palette, because the
 *                  fill is per palette. Reads Quiet.Surfaces.<Pal>.Color-N at
 *                  the button's OWN tone — the same curated row the Text slot
 *                  reads one line up, so its 4.5:1 comes from the table rather
 *                  than from a second contrast solver.
 *
 *   Outline-Quiet  the muted tone of an outline or ghost button, which has no
 *                  fill and therefore sits on the SURFACE. One value per
 *                  section — the section's own Quiet — written onto every
 *                  palette entry so the name always resolves.
 *
 * The tests below assert three separate things, because any one of them can
 * pass while the others fail:
 *
 *   1. the token EXISTS and resolves (a name nothing defines fails silently)
 *   2. it is ACCESSIBLE against the thing it is drawn on (invariant 7 —
 *      parity is not correctness)
 *   3. it is actually QUIET, i.e. distinguishable from the Text beside it —
 *      a slot that copies Text passes 1 and 2 and is still useless
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';

const TYPO = {
  header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
};

type Sel = { background: string; button: string; cardColoring: string; textColoring: string };

function scheme(colors: [string, string, string]) {
  const l = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const d = (h: string) => generateSemanticDarkModeScale(h);
  return {
    colors,
    extractedTones: {
      primary: chroma(colors[0]).lch()[0],
      secondary: chroma(colors[1]).lch()[0],
      tertiary: chroma(colors[2]).lch()[0],
    },
    tonePalettes: { primary: l(colors[0]), secondary: l(colors[1]), tertiary: l(colors[2]) },
    darkModeTonePalettes: { primary: d(colors[0]), secondary: d(colors[1]), tertiary: d(colors[2]) },
  };
}

function build(sch: ReturnType<typeof scheme>, sel: Sel) {
  return exportColorSystemToJSON(
    generateFullLightPalettes(
      sch.tonePalettes.primary as never, sch.tonePalettes.secondary as never,
      sch.tonePalettes.tertiary as never),
    generateFullDarkPalettes(
      sch.darkModeTonePalettes.primary as never, sch.darkModeTonePalettes.secondary as never,
      sch.darkModeTonePalettes.tertiary as never),
    sel.background === 'primary' ? 'primary' : 'neutral',
    sel.button as never,
    sch.extractedTones, 'modern', TYPO as never,
    'ButtonQuiet', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: sel.background as never, button: sel.button as never,
      cardColoring: sel.cardColoring as never, textColoring: sel.textColoring as never },
  ) as never as Record<string, never>;
}

/** Follow a {A.B.C} reference to a literal, across the mode boundary. */
function makeResolver(json: any, mode: string) {
  const M = json.Modes[mode];
  const res = (v: unknown, depth = 0): string => {
    if (depth > 12) return 'LOOP';
    const val = typeof v === 'string' ? v : (v as { value?: string })?.value;
    if (typeof val !== 'string') return 'NONE';
    if (!val.startsWith('{')) return val;
    const path = val.slice(1, -1).split('.');
    let node: any = path[0] === 'Modes' ? json : M;
    for (const k of path) { node = node?.[k]; if (node === undefined) return 'UNRESOLVED ' + val; }
    return res(node, depth + 1);
  };
  // {White} has no node of its own; it is the literal the BW face is drawn in.
  return (v: unknown) => { const r = res(v); return r === 'UNRESOLVED {White}' ? '#ffffff' : r; };
}

const BRANDS: [string, [string, string, string]][] = [
  ['purple', ['#7b3f9d', '#2563eb', '#b8329b']],
  // Its Primary Color-6 carries a LIGHT label, so index-keyed and label-keyed
  // rules give different answers here and the same answer everywhere else.
  ['olive', ['#6b7a4f', '#c98b7e', '#e0c9a6']],
];

const SELECTIONS: [string, Sel][] = [
  ['primary buttons', { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'primary-fixed' }],
  ['black-white buttons', { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'black-white' }],
];

const MODES = ['Light-Mode', 'Dark-Mode'] as const;

describe('button Quiet — the exported token', () => {
  for (const [brandName, colors] of BRANDS) {
    for (const [selName, sel] of SELECTIONS) {
      const json: any = build(scheme(colors), sel);

      for (const mode of MODES) {
        const where = `${brandName} · ${selName} · ${mode}`;

        it(`every button entry carries Quiet, every section an Outline-Quiet — ${where}`, () => {
          const gaps: string[] = [];
          let seen = 0;
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              if (!section?.Buttons) continue;
              for (const [pal, e] of Object.entries<any>(section.Buttons)) {
                if (!e || typeof e !== 'object') continue;
                seen++;
                if (!e.Quiet) gaps.push(`${tn}/${sn}/${pal} Quiet`);
              }
              if (!section['Outline-Quiet']) gaps.push(`${tn}/${sn} Outline-Quiet`);
            }
          // Guard the guard: an empty walk would report zero gaps.
          expect(seen).toBeGreaterThan(100);
          expect(gaps).toEqual([]);
        });

        it(`Quiet clears 4.5:1 against its own fill — ${where}`, () => {
          const resolve = makeResolver(json, mode);
          const fails: string[] = [];
          let checked = 0;
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              if (!section?.Buttons) continue;
              for (const [pal, e] of Object.entries<any>(section.Buttons)) {
                if (!e?.Quiet) continue;
                const fill = resolve(e.Button), quiet = resolve(e.Quiet);
                if (!fill.startsWith('#') || !quiet.startsWith('#')) {
                  fails.push(`${tn}/${sn}/${pal} unresolved fill=${fill} quiet=${quiet}`);
                  continue;
                }
                checked++;
                const ratio = chroma.contrast(fill.slice(0, 7), quiet.slice(0, 7));
                if (ratio < 4.5) {
                  fails.push(`${tn}/${sn}/${pal} ${fill} vs ${quiet} = ${ratio.toFixed(2)}`);
                }
              }
            }
          expect(checked).toBeGreaterThan(100);
          expect(fails).toEqual([]);
        });

        // The property that makes it a QUIET rather than a second Text slot.
        it(`Quiet is distinguishable from the Text beside it — ${where}`, () => {
          const resolve = makeResolver(json, mode);
          const same: string[] = [];
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              if (!section?.Buttons) continue;
              for (const [pal, e] of Object.entries<any>(section.Buttons)) {
                if (!e?.Quiet || !e.Text) continue;
                const t = resolve(e.Text), q = resolve(e.Quiet);
                if (t.startsWith('#') && q.startsWith('#')
                    && t.slice(0, 7).toLowerCase() === q.slice(0, 7).toLowerCase()) {
                  same.push(`${tn}/${sn}/${pal} = ${t}`);
                }
              }
            }
          expect(same).toEqual([]);
        });

        it(`Outline-Quiet is the SECTION's quiet, not the palette's — ${where}`, () => {
          const resolve = makeResolver(json, mode);
          const wrong: string[] = [];
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              if (!section?.Buttons || !section.Quiet) continue;
              for (const [pal, e] of Object.entries<any>(section.Buttons)) {
                void pal; void e;
              }
              if (!section['Outline-Quiet']) { wrong.push(`${tn}/${sn} missing`); continue; }
              if (resolve(section['Outline-Quiet']) !== resolve(section.Quiet)) {
                wrong.push(`${tn}/${sn} != section Quiet`);
              }
            }
          expect(wrong).toEqual([]);
        });
      }
    }
  }
});

describe('button Quiet — the emitted CSS', () => {
  const json: any = build(scheme(BRANDS[0][1]), SELECTIONS[0][1]);
  const files: Record<string, string> = generateCSSFiles(json) as never;
  const bundle = Object.values(files).join('\n');

  const PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
                    'Info', 'Success', 'Warning', 'Error', 'Default', 'BlackWhite'];

  for (const pal of PALETTES) {
    it(`emits --Buttons-${pal}-Quiet`, () => {
      expect(bundle).toContain(`--Buttons-${pal}-Quiet:`);
    });
  }

  // Outline-Quiet is ONE name per scope, not one per palette. An outline or
  // ghost button has no fill, so there is nothing palette-specific about its
  // muted tone — it is the surface's own Quiet. Emitting eight identical
  // copies per scope would be the duplication invariant 2 warns about: the
  // test for redundancy is not "do the copies match" but "does anything
  // select between them", and here nothing does.
  it('emits --Outline-Quiet once per scope, never per palette', () => {
    expect(bundle).toContain('--Outline-Quiet:');
    for (const pal of PALETTES) {
      expect(`${pal}: ${bundle.includes(`--Buttons-${pal}-Outline-Quiet:`)}`).toBe(`${pal}: false`);
    }
  });

  // The base-layer BW faces. These used to point at --Quiet-Surfaces-BW-Color-N,
  // a name the export never emits — the Quiet table is consumed by reference
  // inside the JSON and is never flattened into variables.
  it('the base-layer BW faces resolve to a variable that exists', () => {
    const base = files['base.css'];
    for (const face of ['White', 'Black']) {
      const m = base.match(new RegExp(`--Buttons-${face}-Quiet:\\s*([^;]+);`));
      expect(`${face}: ${m?.[1] ?? 'MISSING'}`).toMatch(new RegExp(`^${face}: var\\(--`));
      const ref = m![1].match(/var\((--[A-Za-z0-9-]+)/)![1];
      expect(`${face} -> ${ref} defined=${bundle.includes(`${ref}:`)}`)
        .toBe(`${face} -> ${ref} defined=true`);
    }
  });
});

/**
 * Invariant 5 — the preview is a separate implementation of the same rule and
 * they drift silently. This does not compare values (the preview solves tones
 * live, the export reads the curated table); it asserts the preview emits the
 * same CONCEPTS, since a token the preview never writes shows up as "nothing
 * changed" rather than as an error.
 */
describe('button Quiet — preview parity', () => {
  for (const mode of ['light', 'dark'] as const) {
    const css = buildPreviewCSS({
      colorScheme: scheme(BRANDS[0][1]) as never,
      userSelections: SELECTIONS[0][1] as never,
      componentStyle: 'modern',
      mode,
      typographyStyles: [
        { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
        { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
        { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
      ],
    } as never);

    it(`emits per-palette button Quiet — ${mode}`, () => {
      for (const pal of ['Primary', 'Secondary', 'Tertiary', 'Default']) {
        expect(`${pal}: ${css.includes(`--Buttons-${pal}-Quiet:`)}`).toBe(`${pal}: true`);
      }
    });

    it(`gives every scope that defines --Quiet an --Outline-Quiet — ${mode}`, () => {
      const quiet = (css.match(/^[ \t]*--Quiet:/gm) || []).length;
      const outline = (css.match(/^[ \t]*--Outline-Quiet:/gm) || []).length;
      // Guard the guard — a regex that matched nothing would compare 0 to 0.
      expect(quiet).toBeGreaterThan(5);
      expect(`quiet=${quiet} outline=${outline}`).toBe(`quiet=${quiet} outline=${quiet}`);
    });
  }
});
