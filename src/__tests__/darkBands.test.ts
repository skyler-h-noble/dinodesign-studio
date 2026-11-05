/**
 * Dark-mode bands (utils/darkLadder.ts, Bands; cssgen/darkBandPass.ts).
 *
 * Owner decision, 2026-11-04: in dark mode the Primary, Secondary and Tertiary
 * THEMES keep some color. Each one's dark Surface is S = min(L, 8), L being the
 * tone its Surface paints in LIGHT mode; Dimmest S-2, Dim S-1, Bright S+1,
 * Brightest S+2; cards tone S+1 mixed over S at 50 / 65 / 75 / 90 / 100%
 * (blendColors), one set per theme on every level. Everything else keeps the
 * tones 1-5 ladder (darkLadder.test.ts).
 *
 * Asserted per fixture, not read back from the pass:
 *   - L is worked out from the light-mode JSON, and S, the five levels and the
 *     five cards follow from it — exact hexes;
 *   - the CSS, the preview and the Figma payload paint those values per theme
 *     (invariants 5-7);
 *   - every role a band section or card carries clears WCAG on it (the
 *     rendered report, which grades the published CSS);
 *   - light mode is byte-identical with and without the bands (Light-Mode.css,
 *     base.css) and every Figma Theme leaf resolves to the same light literal.
 */
import { describe, it, expect, afterEach } from 'vitest';
import chroma from 'chroma-js';
import { buildSystem, quietly, makeScheme, renderedFailures, describeFailure, type Selection, type ExtractedTones } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import {
  DARK_LADDER_LEVELS, DARK_CARD_LEVELS, DARK_CARD_ALPHA, bandSurfaceTone, bandTones, bandCardTone, BAND_THEMES,
} from '../utils/darkLadder';
import { blendColors } from '../utils/colorScale';
import { BANDS } from '../utils/cssgen/darkBandPass';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';

/** Surf as published (a2d6e6cf…): its Primary and Secondary sit on light tone
 *  9, its Tertiary on 7 — pinned, since the published system's tones are not
 *  its colors' own lightness. Popsicle and Cocktails as the studio builds them. */
const FIXTURES: Array<{ name: string; colors: [string, string, string]; tones?: ExtractedTones; L: Record<string, number> }> = [
  { name: 'Surf', colors: ['#9d8a5c', '#009f87', '#e26801'], tones: { primary: 90, secondary: 90, tertiary: 71 }, L: { Primary: 9, Secondary: 9, Tertiary: 7 } },
  { name: 'Popsicle', colors: ['#b771c6', '#00a8cc', '#d565a0'], L: { Primary: 6, Secondary: 6, Tertiary: 6 } },
  { name: 'Cocktails', colors: ['#849054', '#d06f71', '#be7d44'], L: { Primary: 6, Secondary: 6, Tertiary: 6 } },
];
const SELECTIONS: Selection[] = [
  { background: 'Neutral/Surface-Brightest', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
  { background: 'Primary/Surface', button: 'black-white', cardColoring: 'white', textColoring: 'black-white' },
  { background: 'Neutral/Surface-Dimmest', button: 'tonal', cardColoring: 'black', textColoring: 'tonal' },
];

const root: CascadeElement = { attrs: {}, root: true };
const hex = (v: unknown) => (typeof v === 'string' && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);
const at = (c: Cascade, theme: string, level?: string, card?: string) => {
  let el: CascadeElement = { attrs: { 'data-theme': theme, ...(level ? { 'data-surface': level } : {}) }, parent: root };
  if (card) el = { attrs: { 'data-surface': card }, parent: el };
  return hex(c.computed(el)['--Background']);
};

/** The light tone a theme's Surface paints, followed through the light JSON. */
function lightTone(json: any, theme: string): number {
  const L = json.Modes['Light-Mode'];
  let v: unknown = L.Themes[theme].Surfaces.Background.value;
  for (let hop = 0; hop < 12 && typeof v === 'string'; hop++) {
    const m = v.match(/^\{(.+)\}$/);
    if (!m) break;
    const t = m[1].match(/^Colors\.[\w-]+\.Color-(\d+)$/);
    if (t) return Number(t[1]);
    let node: any = L;
    for (const k of m[1].split('.')) node = node?.[k];
    v = node?.value;
  }
  return NaN;
}

const report: string[] = [];
afterEach(() => { BANDS.enabled = true; });

describe('dark bands — the exact tones and cards', () => {
  for (const fx of FIXTURES) {
    it(`${fx.name}: S = min(L, 8), the ladder S-2 .. S+2, cards S+1 over S — in the CSS, the preview and Figma`, () => {
      const sel = SELECTIONS[0];
      const { json, files } = quietly(() => buildSystem(fx.colors, sel, fx.tones));
      const D = (json as any).Modes['Dark-Mode'];
      const cascade = new Cascade(orderSheets(files, 'Dark'));
      const figma: any = quietly(() => generateFigmaJSON(json as never));
      const preview = quietly(() => buildPreviewCSS({
        colorScheme: makeScheme(fx.colors, fx.tones), userSelections: sel, componentStyle: 'modern', mode: 'dark',
      } as never));
      const previewCascade = new Cascade([files['base.css'], preview]);
      const M = figma.Modes['Dark-Mode'];
      const figmaHex = (v: unknown): string | null => {
        let cur = v;
        for (let hop = 0; hop < 10 && typeof cur === 'string' && cur.startsWith('{'); hop++) {
          let node: any = M;
          for (const k of cur.slice(1, -1).split('.')) node = node?.[k];
          cur = node?.value;
        }
        return hex(cur);
      };
      const wrong: string[] = [];
      for (const theme of BAND_THEMES) {
        const L = lightTone(json, theme);
        expect(L, `${theme} light tone`).toBe(fx.L[theme]);
        const S = Math.min(L, 8);
        expect(bandSurfaceTone(L)).toBe(S);
        const tones = bandTones(S);
        expect(tones).toEqual({
          'Surface-Dimmest': Math.max(1, S - 2), 'Surface-Dim': S - 1, 'Surface': S,
          'Surface-Bright': S + 1, 'Surface-Brightest': Math.min(12, S + 2),
        });
        const ramp = (n: number) => hex(D.Colors[theme][`Color-${n}`].value)!;
        // Levels: CSS and Figma, every one; the preview paints the theme's Surface.
        for (const level of DARK_LADDER_LEVELS) {
          const want = ramp(tones[level]);
          const css = at(cascade, theme, level);
          const fig = figmaHex(figma.Themes[theme]?.[level]?.Background?.value);
          if (css !== want) wrong.push(`${theme}/${level}: CSS ${css}, want tone ${tones[level]} ${want}`);
          if (fig !== want) wrong.push(`${theme}/${level}: Figma ${fig}, want ${want}`);
        }
        if (at(previewCascade, theme) !== ramp(S)) wrong.push(`${theme}: preview ${at(previewCascade, theme)}, want ${ramp(S)}`);
        // Cards: one set, the same on every level, in all three.
        const cardTone = bandCardTone(S);
        expect(cardTone).toBe(S + 1);   // no fixture here needs a clamp
        const face = ramp(cardTone);
        const cards: Record<string, string> = {};
        for (const card of DARK_CARD_LEVELS) {
          cards[card] = DARK_CARD_ALPHA[card] >= 1 ? face : blendColors(face, ramp(S), DARK_CARD_ALPHA[card]).toLowerCase();
          for (const level of DARK_LADDER_LEVELS) {
            const css = at(cascade, theme, level, card);
            if (css !== cards[card]) wrong.push(`${theme}/${level}/${card}: CSS ${css}, want ${cards[card]}`);
          }
          const fig = figmaHex(figma.Themes[theme]?.Containers?.[card]?.value);
          if (fig !== cards[card]) wrong.push(`${theme}/${card}: Figma ${fig}, want ${cards[card]}`);
          const pv = at(previewCascade, theme, undefined, card);
          if (pv !== cards[card]) wrong.push(`${theme}/${card}: preview ${pv}, want ${cards[card]}`);
        }
        report.push(`${fx.name} ${theme}: L ${L} -> S ${S}; levels ${DARK_LADDER_LEVELS.map((l) => tones[l]).join('/')}; ` +
          `surface ${ramp(S)}; cards ${DARK_CARD_LEVELS.map((c) => cards[c]).join(' ')}`);
      }
      // The page and its cards stay on the ladder (tone 3, tone 4 over 3).
      // A neutral page's TONAL cards are Primary's (owner, 2026-11-05: "Tonal
      // uses the Primary tint"), so its Highest is Primary's tone 4.
      const neutral = (n: number) => hex(D.Colors.Neutral[`Color-${n}`].value)!;
      expect(at(cascade, 'Default')).toBe(neutral(3));
      expect(at(cascade, 'Default', undefined, 'Container-Highest')).toBe(hex(D.Colors.Primary['Color-4'].value));
      expect(wrong).toEqual([]);
    }, 120_000);
  }
  it('reports', () => { process.stdout.write(`[darkBands]\n${report.join('\n')}\n`); });

  it('the card tone: one above the Surface, below it only past the ramp or across the dark ramp\'s split', () => {
    for (let S = 1; S <= 12; S++) {
      const want = S === 12 ? 11 : S === 5 ? 4 : S + 1;
      expect(bandCardTone(S), `S ${S}`).toBe(want);
    }
    // L 1-7 stays true, 8-12 caps at 8.
    expect(Array.from({ length: 12 }, (_, i) => bandSurfaceTone(i + 1))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8]);
  });
});

describe('dark bands — Figma draws every band role the CSS paints', () => {
  for (const fx of FIXTURES) {
    it(`${fx.name}: each Theme-collection role on each band level resolves to the CSS's color in dark mode`, () => {
      const { json, files } = quietly(() => buildSystem(fx.colors, SELECTIONS[0], fx.tones));
      const figma: any = quietly(() => generateFigmaJSON(json as never));
      const M = figma.Modes['Dark-Mode'];
      const res = (v: unknown) => {
        let cur = v;
        for (let h = 0; h < 12 && typeof cur === 'string' && cur.startsWith('{'); h++) {
          let n: any = M;
          for (const k of cur.slice(1, -1).split('.')) n = n?.[k];
          cur = n?.value;
        }
        return hex(cur);
      };
      const cascade = new Cascade(orderSheets(files, 'Dark'));
      const wrong: string[] = [];
      let compared = 0;
      for (const theme of BAND_THEMES) {
        for (const level of DARK_LADDER_LEVELS) {
          const v = cascade.computed({ attrs: { 'data-theme': theme, 'data-surface': level }, parent: root });
          const walk = (n: any, path: string[]) => {
            if (!n || typeof n !== 'object') return;
            if ('value' in n) {
              const css = hex(v[`--${path.join('-')}`]);
              const fig = res(n.value);
              if (!css || !fig) return;
              compared++;
              /* Color-Vibrant is drawn as itself by Figma and as Color-8 by
                 the CSS (exportToCSS pre-resolves it) — the one split the two
                 carry on every theme, ladder or band. */
              const vibrant = /^(Hotlink|Eyebrow)$/.test(path.join('.'));
              if (css !== fig && !vibrant) wrong.push(`${theme}/${level}/${path.join('.')}: Figma ${fig}, CSS ${css}`);
            } else for (const [k, x] of Object.entries(n)) walk(x, [...path, k]);
          };
          walk(figma.Themes[theme][level], []);
        }
      }
      expect(compared).toBeGreaterThan(1500);
      expect(wrong.slice(0, 10)).toEqual([]);
    }, 120_000);
  }
});

describe('dark bands — every role on a band section and its cards clears WCAG (rendered report)', () => {
  for (const fx of FIXTURES) {
    for (const sel of SELECTIONS) {
      it(`${fx.name} · ${sel.background} · ${sel.button} buttons`, () => {
        const fails = quietly(() => renderedFailures(fx.colors, sel, fx.tones));
        expect(fails.map(describeFailure).slice(0, 10)).toEqual([]);
      }, 120_000);
    }
  }
});

describe('dark bands — light mode is unchanged', () => {
  for (const fx of FIXTURES) {
    for (const sel of SELECTIONS) {
      it(`${fx.name} · ${sel.background}: Light-Mode.css, base.css and Figma's light literals are identical with and without the bands`, () => {
        BANDS.enabled = false;
        const without = quietly(() => buildSystem(fx.colors, sel, fx.tones));
        BANDS.enabled = true;
        const withIt = quietly(() => buildSystem(fx.colors, sel, fx.tones));
        expect(withIt.files['Light-Mode.css'] === without.files['Light-Mode.css'], 'Light-Mode.css changed').toBe(true);
        expect(withIt.files['base.css'] === without.files['base.css'], 'base.css changed').toBe(true);
        expect(withIt.files['Dark-Mode.css'] === without.files['Dark-Mode.css'], 'the bands changed nothing in dark mode').toBe(false);
        /* Figma: every Theme-collection leaf resolves to the same literal in
           Light-Mode. (Its alias can differ: a band role may name its palette
           tone or a Band entry instead of a table entry.) */
        const literals = (json: unknown) => {
          const f: any = quietly(() => generateFigmaJSON(json as never));
          const M = f.Modes['Light-Mode'];
          const res = (v: unknown): string => {
            let cur = v;
            for (let hop = 0; hop < 12 && typeof cur === 'string' && cur.startsWith('{'); hop++) {
              let node: any = M;
              for (const k of cur.slice(1, -1).split('.')) node = node?.[k];
              cur = node?.value;
            }
            return String(cur).toLowerCase();
          };
          const out = new Map<string, string>();
          const walk = (n: any, path: string) => {
            if (!n || typeof n !== 'object') return;
            if ('value' in n) { out.set(path, res(n.value)); return; }
            for (const [k, v] of Object.entries(n)) walk(v, path ? `${path}.${k}` : k);
          };
          walk(f.Themes, '');
          return out;
        };
        const a = literals(without.json), b = literals(withIt.json);
        const diff = [...a].filter(([k, v]) => b.get(k) !== v).map(([k, v]) => `${k}: ${v} -> ${b.get(k)}`);
        expect(diff.slice(0, 10)).toEqual([]);
        expect(b.size).toBe(a.size);
      }, 120_000);
    }
  }
});
