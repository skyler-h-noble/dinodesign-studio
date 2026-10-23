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
                /* A black or white label is exempt: on a Black/White face, and
                   under Black & White text, the resting label is the same black
                   or white as the active one by design — a grey rest label was
                   the dark-mode white button's illegible grey text. */
                const bw = (h: string) => ['#ffffff', '#1a1a1a', '#000000'].includes(h.slice(0, 7).toLowerCase());
                if (t.startsWith('#') && q.startsWith('#') && !bw(t)
                    && t.slice(0, 7).toLowerCase() === q.slice(0, 7).toLowerCase()) {
                  same.push(`${tn}/${sn}/${pal} = ${t}`);
                }
              }
            }
          expect(same).toEqual([]);
        });

        /* The lib reads --Buttons-Default-Outline-Quiet first, so the Default
           entry needs one IN EVERY SECTION. Containers had none and inherited
           the page's — on a dark page with a light card, a light quiet on a
           light card. */
        it(`every button carries an Outline-Quiet that reads on its section — ${where}`, () => {
          const resolve = makeResolver(json, mode);
          const fails: string[] = [];
          let checked = 0;
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              if (!section?.Buttons || !section.Background) continue;
              const bg = resolve(section.Background);
              for (const [pal, e] of Object.entries<any>(section.Buttons)) {
                if (!e || typeof e !== 'object') continue;
                if (!e['Outline-Quiet']) { fails.push(`${tn}/${sn}/${pal} missing`); continue; }
                const q = resolve(e['Outline-Quiet']);
                if (!bg.startsWith('#') || !q.startsWith('#')) continue;
                checked++;
                const ratio = chroma.contrast(bg.slice(0, 7), q.slice(0, 7));
                if (ratio < 4.5) fails.push(`${tn}/${sn}/${pal} ${q} on ${bg} = ${ratio.toFixed(2)}`);
              }
            }
          expect(checked).toBeGreaterThan(100);
          expect(fails).toEqual([]);
        });

        /* The palette rule: a Secondary outline rests on Quiet-Secondary under
           Tonal text; Neutral and BlackWhite on the surface's own Quiet. */
        it(`Outline-Quiet follows the button's palette — ${where}`, () => {
          const wrong: string[] = [];
          for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
            for (const [sn, section] of Object.entries<any>(theme)) {
              // State surfaces redirect every palette to the state's own
              // button (see "State backgrounds only offer their own button").
              if (!section?.Buttons || ['Info', 'Success', 'Warning', 'Error'].includes(tn)) continue;
              for (const pal of ['Primary', 'Secondary', 'Tertiary']) {
                const e = section.Buttons[pal];
                if (!e?.['Outline-Quiet'] || !section[`Quiet-${pal}`]) continue;
                if (e['Outline-Quiet'].value !== section[`Quiet-${pal}`].value) wrong.push(`${tn}/${sn}/${pal}`);
              }
              for (const pal of ['Neutral', 'BlackWhite']) {
                const e = section.Buttons[pal];
                if (e?.['Outline-Quiet'] && e['Outline-Quiet'].value !== section.Quiet?.value) wrong.push(`${tn}/${sn}/${pal}`);
              }
            }
          expect(wrong).toEqual([]);
        });

        it(`the section-level Outline-Quiet is the section's Quiet — ${where}`, () => {
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

describe('Outline-Quiet under Black & White text', () => {
  const json: any = build(scheme(BRANDS[0][1]),
    { background: 'white', cardColoring: 'tonal', textColoring: 'black-white', button: 'primary-fixed' });
  it('every non-Default palette rests on the section\'s own Quiet', () => {
    const wrong: string[] = [];
    let seen = 0;
    for (const mode of MODES)
      for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
        for (const [sn, section] of Object.entries<any>(theme)) {
          if (!section?.Buttons || !section.Quiet) continue;
          for (const [pal, e] of Object.entries<any>(section.Buttons)) {
            if (pal === 'Default' || !e?.['Outline-Quiet']) continue;
            seen++;
            if (e['Outline-Quiet'].value !== section.Quiet.value) wrong.push(`${mode}/${tn}/${sn}/${pal}`);
          }
        }
    expect(seen).toBeGreaterThan(100);
    expect(wrong).toEqual([]);
  });
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

  // Outline-Quiet follows the button's PALETTE (Quiet-<Pal> under Tonal
  // text), as the Figma plugin writes it, so each palette has its own name in
  // every scope — a palette left undefined in a scope inherits an ancestor's.
  it('emits --Outline-Quiet per scope and --Buttons-<Pal>-Outline-Quiet per palette', () => {
    expect(bundle).toContain('--Outline-Quiet:');
    for (const pal of PALETTES) {
      expect(`${pal}: ${bundle.includes(`--Buttons-${pal}-Outline-Quiet:`)}`).toBe(`${pal}: true`);
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
