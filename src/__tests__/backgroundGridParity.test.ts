/**
 * The page background grid in LIGHT mode, the default icon color, and flat
 * black cards (owner, 2026-11-05).
 *
 * 1. Grid picks. The picker is Theme x level (docs/background-selection.md).
 *    The CSS export decoded only the four legacy strings, so the other
 *    sixteen picks published a Primary Color-11 page; the JSON's Default
 *    theme and Default-Settings (what Figma reads) decoded them as Primary at
 *    the core or the surface-style default; the preview painted the real level
 *    but solved its roles for a white page. Now every one of them paints
 *    toneFor(theme, level), with the roles that page carries.
 * 2. The default icon is the surface's Text, everywhere.
 * 3. Black cards in light mode are flat: the row Figma reads, in all three.
 *
 * Since 2026-11-05 part 1 holds every combination three ways with nothing
 * skipped: Black & White page text reads the BW tables in the CSS, Figma and
 * the preview, and white cards are flat like black ones
 * (pageCardTextParity.test.ts covers both modes and the cards' text roles).
 *
 * Invariant 7: the intended values are asserted on their own (the expected
 * page hex from the palette, Default-Settings, flat cards, icon == text), and
 * then the CSS, the preview and the Figma payload are held to each other
 * (invariants 5 and 6).
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, renderedFailures, describeFailure, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { toneFor, legacyName, formatBackground, BACKGROUND_THEMES, SURFACE_LEVELS, type BackgroundTheme } from '../utils/backgroundSelection';
import { toneToColorNumber } from '../utils/colorScale';
import { DARK_CARD_LEVELS } from '../utils/darkLadder';

const FIXTURE_BRANDS = ['Popsicle', 'Cocktails', 'Surf'] as const;
/** Every cell of the picker, plus two stored Secondary / Tertiary picks the
 *  parser still honors. */
const GRID: string[] = [
  ...BACKGROUND_THEMES.flatMap((theme) => SURFACE_LEVELS.map((surface) => formatBackground({ theme, surface }))),
  'Secondary/Surface-Bright', 'Tertiary/Surface-Dim',
];
const NON_LEGACY = GRID.filter((g) => {
  const [theme, surface] = g.split('/');
  return !legacyName({ theme: theme as BackgroundTheme, surface: surface as never });
});
const COMBOS: Array<Pick<Selection, 'cardColoring' | 'textColoring'>> = [
  { cardColoring: 'tonal', textColoring: 'tonal' },
  { cardColoring: 'white', textColoring: 'black-white' },
  { cardColoring: 'black', textColoring: 'tonal' },
];

const root: CascadeElement = { attrs: {}, root: true };
const hex = (v: unknown) => (typeof v === 'string' && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);
const page = (theme: string): CascadeElement => ({ attrs: { 'data-theme': theme }, parent: root });
const card = (theme: string, level: string): CascadeElement => ({ attrs: { 'data-surface': level }, parent: page(theme) });

const cache = new Map<string, ReturnType<typeof build>>();
function build(brand: string, s: Selection) {
  const { json, files } = quietly(() => buildSystem(BRANDS[brand], s));
  const css = { Light: new Cascade(orderSheets(files, 'Light')), Dark: new Cascade(orderSheets(files, 'Dark')) };
  const pv = (mode: 'light' | 'dark') => new Cascade([files['base.css'], quietly(() => buildPreviewCSS({
    colorScheme: makeScheme(BRANDS[brand]), userSelections: s, componentStyle: 'modern', mode,
  } as never))]);
  const preview = { Light: pv('light'), Dark: pv('dark') };
  const figma: any = quietly(() => generateFigmaJSON(json as never));
  return { json: json as any, files, css, preview, figma };
}
const built = (brand: string, s: Selection) => {
  const k = `${brand}|${s.background}|${s.cardColoring}|${s.textColoring}`;
  if (!cache.has(k)) cache.set(k, build(brand, s));
  return cache.get(k)!;
};
const sel = (background: string, c: Pick<Selection, 'cardColoring' | 'textColoring'>): Selection =>
  ({ background, button: 'primary', ...c });

/** Follow a Figma alias through one mode of the payload to its hex. */
function figmaHex(figma: any, mode: string, v: unknown): string | null {
  let cur = v;
  for (let h = 0; h < 12 && typeof cur === 'string' && cur.startsWith('{'); h++) {
    let n: any = figma.Modes[mode];
    for (const k of cur.slice(1, -1).split('.')) n = n?.[k];
    cur = n?.value;
  }
  return hex(cur);
}

const PAGE_ROLES = ['--Text', '--Header', '--Border', '--Icons-Default', '--Hover'] as const;
const FIGMA_KEY: Record<string, string> = { '--Background': 'Surface', '--Text': 'Text', '--Header': 'Header', '--Border': 'Border', '--Icons-Default': 'Icons-Default', '--Hover': 'Hover' };

describe('1. every grid pick: the light page the CSS paints is the one the preview and Figma paint', () => {
  for (const brand of FIXTURE_BRANDS) {
    const PC = toneToColorNumber(makeScheme(BRANDS[brand]).extractedTones!.primary);
    for (const bg of NON_LEGACY) {
      it(`${brand} · ${bg}`, () => {
        const [theme, surface] = bg.split('/') as [BackgroundTheme, never];
        const n = toneFor(theme, surface, PC);
        const wrong: string[] = [];
        for (const combo of COMBOS) {
          const s = sel(bg, combo);
          const { json, css, preview, figma } = built(brand, s);
          const L = json.Modes['Light-Mode'];
          const tag = `${combo.cardColoring}/${combo.textColoring}`;

          // The intended page, from the palette itself.
          const want = hex(L.Colors[theme][`Color-${n}`].value);
          const dt = json.Metadata['Default-Settings']['Default-Theme'];
          if (dt.Theme.value !== theme || dt.N.value !== n) wrong.push(`${tag}: Default-Settings ${dt.Theme.value}/${dt.N.value}, want ${theme}/${n}`);

          const c = css.Light.computed(page('Default'));
          const p = preview.Light.computed(page('Brand'));
          const fig = figma.Modes['Light-Mode']['Default-Background'];
          if (hex(c['--Background']) !== want) wrong.push(`${tag}: CSS page ${hex(c['--Background'])}, want ${want}`);
          if (hex(p['--Background']) !== want) wrong.push(`${tag}: preview page ${hex(p['--Background'])}, want ${want}`);
          if (hex(fig?.Surface?.value) !== want) wrong.push(`${tag}: Figma page ${hex(fig?.Surface?.value)}, want ${want}`);

          // The page's paired roles, CSS == preview == Figma under both Text
          // Colorings (Black & White reads the BW tables in all three since
          // 2026-11-05; the preview used to paint literal #1a1a1a / white).
          for (const r of PAGE_ROLES) {
            const cv = hex(c[r]), pvv = hex(p[r]), fv = hex(fig?.[FIGMA_KEY[r]]?.value);
            if (cv !== pvv) wrong.push(`${tag} ${r}: CSS ${cv}, preview ${pvv}`);
            if (cv !== fv) wrong.push(`${tag} ${r}: CSS ${cv}, Figma ${fv}`);
          }
          // The page's own button (what an unthemed Button paints).
          const cb = hex(c['--Buttons-Default-Button']), pb = hex(p['--Buttons-Default-Button']);
          if (cb !== pb) wrong.push(`${tag} Default button: CSS ${cb}, preview ${pb}`);

          // The page's five cards, every Card Coloring: white cards are flat
          // in light mode since 2026-11-05 (the Card-Coloring row Figma reads),
          // so all three hold the same five.
          for (const l of DARK_CARD_LEVELS) {
            const cc = hex(css.Light.computed(card('Default', l))['--Background']);
            const pc = hex(preview.Light.computed({ attrs: { 'data-surface': l }, parent: page('Brand') })['--Background']);
            const fc = hex(fig?.[l]?.value);
            if (cc !== fc) wrong.push(`${tag} ${l}: CSS ${cc}, Figma ${fc}`);
            if (cc !== pc) wrong.push(`${tag} ${l}: CSS ${cc}, preview ${pc}`);
          }
          // Figma's Theme collection leads with the picked theme (after Default).
          const order = Object.keys(figma.Themes);
          if (order[0] !== 'Default' || order[1] !== theme) wrong.push(`${tag}: Figma theme order ${order.slice(0, 2).join(',')}`);
        }
        expect(wrong.slice(0, 16)).toEqual([]);
      }, 240_000);
    }
  }

  it('rule B reaches the grid: on a neutral level, tonal text and tonal cards are the Primary tint, and visibly differ from black-white / white', () => {
    for (const brand of FIXTURE_BRANDS) {
      for (const bg of NON_LEGACY.filter((g) => g.startsWith('Neutral/'))) {
        const tonal = built(brand, sel(bg, { cardColoring: 'tonal', textColoring: 'tonal' }));
        const bw = built(brand, sel(bg, { cardColoring: 'white', textColoring: 'black-white' }));
        const L = tonal.json.Modes['Light-Mode'].Colors;
        const tones = (pal: string) => Array.from({ length: 12 }, (_, i) => hex(L[pal][`Color-${i + 1}`].value));
        const tText = hex(tonal.css.Light.computed(page('Default'))['--Text'])!;
        const bText = hex(bw.css.Light.computed(page('Default'))['--Text'])!;
        const tCard = hex(tonal.css.Light.computed(card('Default', 'Container'))['--Background'])!;
        const wCard = hex(bw.css.Light.computed(card('Default', 'Container'))['--Background'])!;
        // Tonal text is a Primary tone; black-white text black or white (the BW
        // table: Neutral Color-1 or white). On a mid-grey page the Primary text
        // tone is near-black, so chroma alone cannot tell them apart.
        expect(tones('Primary'), `${brand} ${bg} tonal text ${tText}`).toContain(tText);
        expect([tones('Neutral')[0], '#ffffff'], `${brand} ${bg} black-white text ${bText}`).toContain(bText);
        expect(chroma.deltaE(tCard, wCard), `${brand} ${bg} card`).toBeGreaterThan(3);
      }
    }
  }, 240_000);

  it('a grid value with a legacy name publishes exactly what the legacy name does', () => {
    const pairs: Array<[string, string]> = [
      ['Neutral/Surface-Brightest', 'white'], ['Neutral/Surface-Dimmest', 'black'],
      ['Primary/Surface', 'primary-base'], ['Primary/Surface-Brightest', 'primary-light'],
    ];
    for (const [grid, legacy] of pairs) {
      const a = built('Popsicle', sel(grid, COMBOS[0])).files;
      const b = built('Popsicle', sel(legacy, COMBOS[0])).files;
      for (const f of ['Light-Mode.css', 'Dark-Mode.css', 'base.css']) expect(a[f] === b[f], `${grid} vs ${legacy}: ${f}`).toBe(true);
    }
  }, 240_000);

  it('every role passes WCAG on every non-legacy grid page (rendered report, both modes)', () => {
    const fails: string[] = [];
    for (const brand of FIXTURE_BRANDS) for (const bg of NON_LEGACY) {
      const f = quietly(() => renderedFailures(BRANDS[brand], sel(bg, COMBOS[0])));
      fails.push(...f.slice(0, 2).map((x) => `${brand} ${bg}: ${describeFailure(x)}`));
    }
    expect(fails.slice(0, 12)).toEqual([]);
  }, 600_000);
});

describe('a card\'s Quiet reads on all five card levels', () => {
  /* Normalizing 'Primary/Surface' to 'primary-base' exposed a failure the
     legacy string always had: on a mid-tone Primary page the tonal cards'
     Container-Lowest drifts toward the page and the face's Quiet fell to
     4.47-4.49:1 there (3.84:1 for Grape on its darker page). */
  for (const brand of ['Popsicle', 'Chocolate', 'Grape']) {
    it(`${brand} · primary-base · tonal cards: no rendered failure`, () => {
      for (const textColoring of ['tonal', 'black-white'] as const) {
        const f = quietly(() => renderedFailures(BRANDS[brand], sel('primary-base', { cardColoring: 'tonal', textColoring })));
        expect(f.map(describeFailure).slice(0, 6), textColoring).toEqual([]);
      }
    }, 120_000);
  }
});

describe('2. the default icon is the surface\'s text color', () => {
  const THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'App-Bar', 'Nav-Bar', 'Status'];
  const LEVELS = ['Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest'];
  const CASES: Array<[string, string]> = [
    ['Popsicle', 'white'], ['Cocktails', 'white'], ['Popsicle', 'primary-light'], ['Surf', 'black'],
    ['Popsicle', 'Neutral/Surface-Bright'], ['Cocktails', 'Primary/Surface-Dim'],
  ];
  for (const [brand, bg] of CASES) {
    it(`${brand} · ${bg}: --Icons-Default == --Text on every theme, level and card, in the CSS, the preview and Figma`, () => {
      const wrong: string[] = [];
      for (const combo of COMBOS) {
        const { css, preview, figma } = built(brand, sel(bg, combo));
        const tag = `${combo.cardColoring}/${combo.textColoring}`;
        for (const mode of ['Light', 'Dark'] as const) {
          for (const th of THEMES) for (const lv of LEVELS) {
            const el: CascadeElement = { attrs: th === 'Default' ? { 'data-surface': lv } : { 'data-theme': th, 'data-surface': lv }, parent: root };
            const v = css[mode].computed(el);
            if (hex(v['--Icons-Default']) !== hex(v['--Text'])) wrong.push(`CSS ${tag} ${mode} ${th}/${lv}: icon ${hex(v['--Icons-Default'])}, text ${hex(v['--Text'])}`);
            for (const cd of DARK_CARD_LEVELS) {
              const k = css[mode].computed({ attrs: { 'data-surface': cd }, parent: el });
              if (hex(k['--Icons-Default']) !== hex(k['--Text'])) wrong.push(`CSS ${tag} ${mode} ${th}/${lv}/${cd}: icon ${hex(k['--Icons-Default'])}, text ${hex(k['--Text'])}`);
            }
            const pel: CascadeElement = { attrs: { 'data-surface': lv }, parent: page(th === 'Default' ? 'Brand' : th) };
            for (const e of [pel, { attrs: { 'data-surface': 'Container' }, parent: pel }]) {
              const pv = preview[mode].computed(e);
              if (pv['--Text'] && hex(pv['--Icons-Default']) !== hex(pv['--Text'])) wrong.push(`preview ${tag} ${mode} ${th}/${lv}${e === pel ? '' : '/Container'}: icon ${hex(pv['--Icons-Default'])}, text ${hex(pv['--Text'])}`);
            }
          }
          // Figma: the default icon ALIASES the same variable as Text (no
          // variable of its own to drift), on every theme group.
          for (const [th, groups] of Object.entries<any>(figma.Themes)) for (const [g, roles] of Object.entries<any>(groups)) {
            const ic = roles?.['Icons-Default']?.value, tx = roles?.Text?.value;
            if (ic === undefined || tx === undefined) continue;
            if (th === 'Default' && ic !== tx) wrong.push(`Figma ${tag} ${th}/${g}: icon aliases ${ic}, text ${tx}`);
            const fm = `${mode}-Mode`;
            if (figmaHex(figma, fm, ic) !== figmaHex(figma, fm, tx)) wrong.push(`Figma ${tag} ${mode} ${th}/${g}: icon ${figmaHex(figma, fm, ic)}, text ${figmaHex(figma, fm, tx)}`);
          }
        }
      }
      expect(wrong.slice(0, 16)).toEqual([]);
    }, 240_000);
  }

  it('the icon moves with Text Coloring: tonal text on a neutral page tints the default icon', () => {
    for (const brand of ['Popsicle', 'Cocktails']) {
      for (const mode of ['Light', 'Dark'] as const) {
        const t = built(brand, sel('white', { cardColoring: 'white', textColoring: 'tonal' }));
        const b = built(brand, sel('white', { cardColoring: 'white', textColoring: 'black-white' }));
        const ti = hex(t.css[mode].computed(page('Default'))['--Icons-Default'])!;
        const bi = hex(b.css[mode].computed(page('Default'))['--Icons-Default'])!;
        expect(chroma.deltaE(ti, bi), `${brand} ${mode}: tonal ${ti} vs black-white ${bi}`).toBeGreaterThan(5);
      }
    }
  }, 240_000);
});

describe('3. black cards are flat in light mode', () => {
  for (const brand of FIXTURE_BRANDS) {
    for (const bg of ['white', 'primary-light', 'primary-base', 'black', 'Neutral/Surface-Bright', 'Primary/Surface-Dim']) {
      it(`${brand} · ${bg}: the five levels are Figma's row in the CSS and the preview`, () => {
        const s = sel(bg, { cardColoring: 'black', textColoring: 'tonal' });
        const { json, css, preview, figma } = built(brand, s);
        const fig = figma.Modes['Light-Mode']['Default-Background'];
        const c = DARK_CARD_LEVELS.map((l) => hex(css.Light.computed(card('Default', l))['--Background']));
        const p = DARK_CARD_LEVELS.map((l) => hex(preview.Light.computed({ attrs: { 'data-surface': l }, parent: page('Brand') })['--Background']));
        const f = DARK_CARD_LEVELS.map((l) => hex(fig?.[l]?.value));
        expect(c).toEqual(f);
        expect(p).toEqual(f);
        const neutral1 = hex(json.Modes['Light-Mode'].Colors.Neutral['Color-1'].value)!;
        const pageIsNeutral = json.Metadata['Default-Settings']['Default-Theme'].Theme.value === 'Neutral';
        const pageIsBlack = pageIsNeutral && json.Metadata['Default-Settings']['Default-Theme'].N.value <= 2;
        // Flat: one value at all five levels on a neutral page (Neutral
        // Color-1 itself); on a tinted page within one unit of it.
        if (pageIsNeutral && !pageIsBlack) expect(new Set(c)).toEqual(new Set([neutral1]));
        if (!pageIsBlack) {
          for (const v of c) expect(chroma.distance(v!, neutral1, 'rgb'), `${v} vs ${neutral1}`).toBeLessThanOrEqual(2);
        }
        expect(c[4]).toBe(neutral1);
      }, 240_000);
    }
  }
});
