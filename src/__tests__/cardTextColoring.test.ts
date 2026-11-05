/**
 * Card Coloring and Text Coloring (owner, 2026-11-05; utils/darkLadder.ts,
 * "Card Coloring and Text Coloring").
 *
 * A. Dark mode — "Black cards stay black only." Tonal and white cards keep the
 *    one fixed dark set (tone 4 over the page; a band's S+1 over S). Black
 *    cards are near-black: Neutral Color-1 over the theme's dark page at
 *    90 / 92 / 94 / 96 / 100%, on every theme including the bands.
 * B. Neutral page — "Tonal uses the Primary tint." On a neutral page tonal
 *    cards come from the Primary row and tonal text from the Primary tables;
 *    white stays white and black-white stays black / white.
 *
 * Asserted on what the published CSS paints, with the preview and the Figma
 * payload held to it per theme (invariants 5-7): exact hexes for Popsicle and
 * Cocktails, the visible difference between the choices (CIEDE2000), and the
 * rendered WCAG report for every combination (all roles, both modes).
 */
import { describe, it, expect, afterAll } from 'vitest';
import chroma from 'chroma-js';
import { buildSystem, quietly, makeScheme, renderedFailures, describeFailure, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { DARK_CARD_LEVELS, BAND_THEMES, BLACK_CARD_MIN_DL, blackCardHexesForPage, labL } from '../utils/darkLadder';

const FIXTURES: Record<string, [string, string, string]> = {
  Popsicle: ['#b771c6', '#00a8cc', '#d565a0'],
  Cocktails: ['#849054', '#d06f71', '#be7d44'],
};
const CARDS = ['tonal', 'white', 'black'] as const;
const TEXTS = ['tonal', 'black-white'] as const;
const sel = (background: string, cardColoring: Selection['cardColoring'], textColoring: Selection['textColoring']): Selection =>
  ({ background, button: 'primary', cardColoring, textColoring });

const root: CascadeElement = { attrs: {}, root: true };
const hex = (v: unknown) => (typeof v === 'string' && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);
const themeEl = (theme: string): CascadeElement => ({ attrs: { 'data-theme': theme }, parent: root });
const cardEl = (theme: string, card: string): CascadeElement => ({ attrs: { 'data-surface': card }, parent: themeEl(theme) });

const cache = new Map<string, ReturnType<typeof buildSystem>>();
const built = (brand: string, s: Selection) => {
  const k = `${brand}|${s.background}|${s.cardColoring}|${s.textColoring}`;
  if (!cache.has(k)) cache.set(k, quietly(() => buildSystem(FIXTURES[brand], s)));
  return cache.get(k)!;
};
const cssCards = (brand: string, s: Selection, mode: 'Light' | 'Dark', theme = 'Default') => {
  const c = new Cascade(orderSheets(built(brand, s).files, mode));
  return DARK_CARD_LEVELS.map((l) => hex(c.computed(cardEl(theme, l))['--Background'])!);
};
const cssPage = (brand: string, s: Selection, mode: 'Light' | 'Dark') => {
  const c = new Cascade(orderSheets(built(brand, s).files, mode));
  const p = c.computed(themeEl('Default'));
  const k = c.computed(cardEl('Default', 'Container'));
  return {
    bg: hex(p['--Background'])!,
    text: hex(p['--Text'])!, header: hex(p['--Header'])!, quiet: hex(p['--Quiet'])!,
    cardText: hex(k['--Text'])!, cardHeader: hex(k['--Header'])!, cardQuiet: hex(k['--Quiet'])!,
  };
};

const report: string[] = [];
afterAll(() => { process.stdout.write(`[cardTextColoring]\n${report.join('\n')}\n`); });

describe('B. a neutral page: tonal cards and tonal text use the Primary tint', () => {
  /* Exact values on a white page (legacy 'white' = Neutral/Surface-Brightest). */
  const LIGHT_TONAL: Record<string, string[]> = {
    Popsicle: ['#fef0ff', '#feefff', '#feedff', '#feedff', '#feebff'],
    Cocktails: ['#f4f6e9', '#f3f5e7', '#f2f4e5', '#f1f3e4', '#f0f2e2'],
  };
  const DARK_TONAL: Record<string, string[]> = {
    Popsicle: ['#321f36', '#342138', '#36223a', '#38233d', '#3a243f'],
    Cocktails: ['#242818', '#262919', '#272b19', '#292d1a', '#2a2e1b'],
  };
  const WHITE_LIGHT = ['#fcfcfc', '#fcfcfc', '#fcfcfc', '#fcfcfc', '#fcfcfc'];
  const WHITE_DARK = ['#262626', '#272727', '#292929', '#2b2b2b', '#2c2c2c'];
  const TEXT: Record<string, Record<string, { light: string[]; dark: string[] }>> = {
    // [page Text, page Header, card Text, card Header]
    Popsicle: {
      tonal: { light: ['#593462', '#784284', '#593462', '#784284'], dark: ['#e8beef', '#e8beef', '#e8beef', '#d9ade0'] },
      'black-white': { light: ['#424242', '#575757', '#424242', '#575757'], dark: ['#cccccc', '#cccccc', '#cccccc', '#bbbbbb'] },
    },
    Cocktails: {
      tonal: { light: ['#3f4525', '#525b2d', '#3f4525', '#525b2d'], dark: ['#cacfac', '#cacfac', '#cacfac', '#b9bf9a'] },
      'black-white': { light: ['#424242', '#575757', '#424242', '#575757'], dark: ['#cccccc', '#cccccc', '#cccccc', '#bbbbbb'] },
    },
  };

  for (const brand of Object.keys(FIXTURES)) {
    it(`${brand}: tonal cards are Primary's row, white cards stay white — and they differ visibly`, () => {
      const tonalL = cssCards(brand, sel('white', 'tonal', 'tonal'), 'Light');
      const whiteL = cssCards(brand, sel('white', 'white', 'tonal'), 'Light');
      const tonalD = cssCards(brand, sel('white', 'tonal', 'tonal'), 'Dark');
      const whiteD = cssCards(brand, sel('white', 'white', 'tonal'), 'Dark');
      expect(tonalL).toEqual(LIGHT_TONAL[brand]);
      expect(whiteL).toEqual(WHITE_LIGHT);
      expect(tonalD).toEqual(DARK_TONAL[brand]);
      expect(whiteD).toEqual(WHITE_DARK);
      const dE = (a: string, b: string) => chroma.deltaE(a, b);
      const light = dE(tonalL[2], whiteL[2]);
      const dark = dE(tonalD[2], whiteD[2]);
      report.push(`${brand} neutral page Container: tonal vs white ΔE2000 light ${light.toFixed(2)} (${tonalL[2]} vs ${whiteL[2]}), dark ${dark.toFixed(2)} (${tonalD[2]} vs ${whiteD[2]})`);
      expect(light).toBeGreaterThan(5);
      expect(dark).toBeGreaterThan(5);
    }, 120_000);

    it(`${brand}: tonal text is Primary-tinted, black-white stays neutral — and they differ visibly`, () => {
      for (const text of TEXTS) {
        for (const [mode, key] of [['Light', 'light'], ['Dark', 'dark']] as const) {
          const p = cssPage(brand, sel('white', 'white', text), mode);
          expect([p.text, p.header, p.cardText, p.cardHeader], `${text} ${mode}`).toEqual(TEXT[brand][text][key]);
        }
      }
      for (const [mode, key] of [['Light', 'light'], ['Dark', 'dark']] as const) {
        const t = TEXT[brand].tonal[key][0], b = TEXT[brand]['black-white'][key][0];
        const d = chroma.deltaE(t, b);
        report.push(`${brand} neutral page Text ${mode}: tonal ${t} vs black-white ${b}, ΔE2000 ${d.toFixed(2)}`);
        expect(d).toBeGreaterThan(5);
      }
    }, 120_000);
  }

  it('only the page changes: a Primary page is unaffected by rule B in both modes', () => {
    for (const brand of Object.keys(FIXTURES)) {
      for (const bg of ['primary-light', 'primary-base']) {
        const a = cssPage(brand, sel(bg, 'tonal', 'tonal'), 'Light');
        const b = cssPage(brand, sel(bg, 'tonal', 'black-white'), 'Light');
        // On a Primary page the page palette IS Primary: tonal and BW read the same tables as before.
        expect(a.text).toBe(b.text);
      }
    }
  }, 120_000);
});

describe('A. dark mode: black cards are near-black, on every theme', () => {
  const PAGE_BLACK = ['#0d0d0d', '#0d0d0d', '#0c0c0c', '#0c0c0c', '#0b0b0b'];
  const BAND_BLACK: Record<string, Record<string, string[]>> = {
    Popsicle: {
      Primary: ['#1b161c', '#181418', '#141215', '#111012', '#0b0b0b'],
      Secondary: ['#12191b', '#111618', '#0f1315', '#0e1011', '#0b0b0b'],
      Tertiary: ['#1d1619', '#191416', '#161114', '#120f11', '#0b0b0b'],
    },
    Cocktails: {
      Primary: ['#181814', '#151613', '#131311', '#10100f', '#0b0b0b'],
      Secondary: ['#1c1616', '#191414', '#161212', '#120f0f', '#0b0b0b'],
      Tertiary: ['#1b1713', '#181512', '#151210', '#12100e', '#0b0b0b'],
    },
  };
  for (const brand of Object.keys(FIXTURES)) {
    for (const bg of ['white', 'black', 'primary-light']) {
      it(`${brand} · ${bg} page: exact near-black cards, separated from their page, CSS == preview == Figma per theme`, () => {
        const s = sel(bg, 'black', 'tonal');
        const { json, files } = built(brand, s);
        const D = (json as any).Modes['Dark-Mode'];
        const neutral = Array.from({ length: 12 }, (_, i) => hex(D.Colors.Neutral[`Color-${i + 1}`].value)!);
        const css = new Cascade(orderSheets(files, 'Dark'));
        const preview = quietly(() => buildPreviewCSS({ colorScheme: makeScheme(FIXTURES[brand]), userSelections: s, componentStyle: 'modern', mode: 'dark' } as never));
        const pv = new Cascade([files['base.css'], preview]);
        const figma: any = quietly(() => generateFigmaJSON(json as never));
        const M = figma.Modes['Dark-Mode'];
        const fig = (v: unknown) => {
          let cur = v;
          for (let h = 0; h < 12 && typeof cur === 'string' && cur.startsWith('{'); h++) {
            let n: any = M;
            for (const k of cur.slice(1, -1).split('.')) n = n?.[k];
            cur = n?.value;
          }
          return hex(cur);
        };
        const wrong: string[] = [];
        for (const theme of ['Default', ...BAND_THEMES]) {
          const page = hex(css.computed(themeEl(theme))['--Background'])!;
          const want = blackCardHexesForPage(neutral, page).cards;
          const got = DARK_CARD_LEVELS.map((l) => hex(css.computed(cardEl(theme, l))['--Background'])!);
          const exact = theme === 'Default' ? PAGE_BLACK : BAND_BLACK[brand][theme];
          if (bg !== 'primary-light' || theme !== 'Default') {
            if (got.join() !== exact.join()) wrong.push(`${theme}: CSS ${got.join(' ')}, exact ${exact.join(' ')}`);
          }
          DARK_CARD_LEVELS.forEach((l, i) => {
            if (got[i] !== want[l]) wrong.push(`${theme}/${l}: CSS ${got[i]}, rule ${want[l]}`);
            if (!(labL(page) - labL(got[i]) >= BLACK_CARD_MIN_DL)) wrong.push(`${theme}/${l}: ${got[i]} not separated from the page ${page}`);
            const p = hex(pv.computed({ attrs: { 'data-surface': l }, parent: { attrs: { 'data-theme': theme === 'Default' ? 'Brand' : theme }, parent: root } })['--Background']);
            if (p !== got[i]) wrong.push(`${theme}/${l}: preview ${p}, CSS ${got[i]}`);
            const f = fig(figma.Themes[theme]?.Containers?.[l]?.value);
            if (f !== got[i]) wrong.push(`${theme}/${l}: Figma ${f}, CSS ${got[i]}`);
          });
          if (!(labL(got[4]) < 10)) wrong.push(`${theme}: Highest ${got[4]} not near-black`);
          report.push(`${brand} · ${bg} · dark black cards ${theme}: page ${page} (L* ${labL(page).toFixed(1)}); cards ${got.join(' ')} (L* ${labL(got[0]).toFixed(1)}..${labL(got[4]).toFixed(1)})`);
        }
        expect(wrong.slice(0, 12)).toEqual([]);
      }, 120_000);
    }
  }

  it('tonal and white cards keep the fixed dark set (black is the only one that moved)', () => {
    for (const brand of Object.keys(FIXTURES)) {
      const tonal = cssCards(brand, sel('primary-light', 'tonal', 'tonal'), 'Dark');
      const white = cssCards(brand, sel('primary-light', 'white', 'tonal'), 'Dark');
      expect(white).toEqual(tonal);
      const black = cssCards(brand, sel('primary-light', 'black', 'tonal'), 'Dark');
      expect(black).not.toEqual(tonal);
    }
  }, 120_000);
});

describe('neutral page, light mode: the page roles agree between the CSS and Figma', () => {
  for (const brand of Object.keys(FIXTURES)) {
    for (const card of CARDS) for (const text of TEXTS) {
      it(`${brand} · white page · ${card} cards · ${text} text`, () => {
        const s = sel('white', card, text);
        const { json, files } = built(brand, s);
        const figma: any = quietly(() => generateFigmaJSON(json as never));
        for (const mode of ['Light', 'Dark'] as const) {
          const M = figma.Modes[`${mode}-Mode`];
          const bgv = (k: string) => hex(M['Default-Background']?.[k]?.value);
          const p = cssPage(brand, s, mode);
          expect([bgv('Text'), bgv('Header')], `${mode} page Text / Header`).toEqual([p.text, p.header]);
          // The Default theme's cards: Figma's Default-Background holds the CSS's five (tonal and white; light black
          // cards keep a pre-existing difference, reported separately).
          if (!(mode === 'Light' && card === 'black')) {
            const fc = DARK_CARD_LEVELS.map((l) => bgv(l));
            expect(fc, `${mode} cards`).toEqual(cssCards(brand, s, mode));
          }
        }
      }, 120_000);
    }
  }
});

describe('every role passes WCAG on every card and text coloring (rendered report, both modes)', () => {
  for (const brand of Object.keys(FIXTURES)) {
    for (const bg of ['white', 'black', 'primary-light']) {
      for (const card of CARDS) for (const text of TEXTS) {
        it(`${brand} · ${bg} · ${card} cards · ${text} text`, () => {
          const fails = quietly(() => renderedFailures(FIXTURES[brand], sel(bg, card, text)));
          expect(fails.map(describeFailure).slice(0, 8)).toEqual([]);
        }, 120_000);
      }
    }
  }
});
