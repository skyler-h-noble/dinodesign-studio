/**
 * Every brand x user selection, graded on the CSS a page renders.
 *
 * The rendered accessibility report (renderedAccessibilityReport.ts, with
 * cssCascade.ts) computes what each theme x surface level x mode actually
 * resolves to in the published sheets — verified value for value against
 * Chrome — and measures every role against that element's own background.
 * This runs it over generated systems and asserts zero failures. Thresholds
 * are the report's, WCAG 2.2 AA, and are not loosened here.
 *
 * Before this test (2026-11-03) all 1,800 systems of the full matrix failed;
 * the groups and their causes:
 *   - dark mode, black/white chosen by TONE NUMBER: a black button and black
 *     Text-BW on dark cards and on the Default theme's near-black page;
 *   - dark mode, the Default theme's light Surface-Brightest: button borders
 *     flushed to their pastel fill (~1.1:1);
 *   - light mode, status cards' Container-Lowest: Quiet and the resting
 *     outline label at 4.36:1;
 *   - light mode, black cards: every themed card keyed to a light tone, so
 *     dark text, borders and icons on a black card;
 *   - a black/white Default button chosen by brightness, white on a mid tone.
 *
 * The suite runs a spread of the matrix that touches every background,
 * button, card and text choice for every brand. The whole matrix (5 brands x
 * 10 backgrounds x 6 buttons x 3 cards x 2 texts = 1,800 systems, ~12 min)
 * runs with RENDERED_FULL=1.
 */
import chroma from 'chroma-js';
import { describe, it, expect } from 'vitest';
import {
  BRANDS, BACKGROUNDS, BUTTONS, CARDS, TEXTS, makeScheme,
  buildSystem, quietly, renderedFailures, describeFailure, type Selection,
} from './__fixtures__/renderedSystem';
import { REPORT_THEMES, REPORT_SURFACES } from '../utils/renderedAccessibilityReport';
import { Cascade, type CascadeElement, parseColor, contrast, composite, toHex } from '../utils/cssCascade';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { orderSheets } from '../utils/renderedAccessibilityReport';

const BUTTON_NAMES = Object.keys(BUTTONS);

/** The whole matrix, or a spread that still covers every value of every
 *  choice for every brand: a stride through the four lists, offset per brand
 *  so the brands do not all see the same combinations. */
function selections(brandIndex: number): Selection[] {
  const all: Selection[] = [];
  for (const background of BACKGROUNDS) for (const button of BUTTON_NAMES)
    for (const cardColoring of CARDS) for (const textColoring of TEXTS)
      all.push({ background, button, cardColoring, textColoring });
  if (process.env.RENDERED_FULL) return all;
  const out: Selection[] = [];
  for (let i = 0; i < 12; i++) {
    const k = i + brandIndex * 5;
    out.push({
      background: BACKGROUNDS[k % BACKGROUNDS.length],
      button: BUTTON_NAMES[k % BUTTON_NAMES.length],
      cardColoring: CARDS[k % CARDS.length],
      textColoring: TEXTS[k % TEXTS.length],
    });
  }
  return out;
}

describe('rendered contrast — every brand x selection', () => {
  // The exact system the four known failures were reported on, always run.
  it('Popsicle · Neutral page · primary buttons · tonal cards · tonal text', () => {
    const fails = renderedFailures(BRANDS.Popsicle, {
      background: 'Neutral/Surface-Brightest', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal',
    });
    expect(fails.map(describeFailure)).toEqual([]);
  }, 60_000);

  Object.entries(BRANDS).forEach(([brand, colors], brandIndex) => {
    it(`${brand}: zero failures`, () => {
      const out: string[] = [];
      for (const sel of selections(brandIndex)) {
        const fails = renderedFailures(colors, sel);
        if (fails.length) {
          out.push(`${sel.background} ${sel.button} ${sel.cardColoring} ${sel.textColoring}: ${fails.length} — ` +
            fails.slice(0, 3).map(describeFailure).join(' | '));
        }
      }
      expect(out).toEqual([]);
    }, 3_600_000);
  });
});

/* ─── Visited links stay in the visited hue ───────────────────────────────
 *
 * Dark mode's Text.Surfaces.Hotlink-Visited.Color-4 named Error's palette — a
 * cell copied from the Error table — and cards derive from Color-4, so every
 * dark card drew visited links in Error's peach. It passed contrast, so the
 * report could not see it. A visited link has to stay in the visited hue. */
describe('visited links', () => {
  for (const sel of [
    { background: 'Neutral/Surface-Brightest', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
    { background: 'Primary/Surface-Dimmest', button: 'black-white', cardColoring: 'black', textColoring: 'black-white' },
  ] as Selection[]) {
    it(`--Hotlink-Visited points into the Hotlink-Visited palette everywhere — ${sel.background} ${sel.cardColoring}`, () => {
      const { files } = quietly(() => buildSystem(BRANDS.Popsicle, sel));
      const foreign: string[] = [];
      for (const name of ['Light-Mode.css', 'Dark-Mode.css']) {
        for (const m of files[name].matchAll(/--(?:Hotlink|Link)-Visited:\s*([^;]+);/g)) {
          if (!/^var\(--Hotlink-Visited-Color-[\w-]+\)$/.test(m[1].trim())) foreign.push(`${name}: ${m[1]}`);
        }
      }
      expect(foreign).toEqual([]);
    }, 60_000);
  }
});

/* ─── Black or white is decided per mode ──────────────────────────────────
 *
 * Parity is not correctness (invariant 7): this asserts the intended shape
 * directly. A dark-mode card on the ladder is dark whatever tone it is keyed
 * to, so its black/white button and Text-BW must be the WHITE face; a band
 * theme's card (Primary / Secondary / Tertiary, utils/darkLadder.ts, Bands) is
 * as light as its band, so it carries the face that contrasts it — black on a
 * light card. The Default theme's dark page carries the white face. */
describe('black/white face follows what the section paints', () => {
  const sel: Selection = { background: 'Neutral/Surface-Brightest', button: 'black-white', cardColoring: 'tonal', textColoring: 'tonal' };
  const { files } = quietly(() => buildSystem(BRANDS.Popsicle, sel));
  const cascade = new Cascade(orderSheets(files, 'Dark'));
  const root: CascadeElement = { attrs: {}, root: true };
  const white = (v: string | undefined) => /^#ffffff/i.test(String(v));

  const lightCard = (v: string | undefined) => chroma.valid(v) && chroma(v as string).luminance() > 0.18;
  for (const theme of REPORT_THEMES) {
    it(`dark mode · ${theme} cards carry the face that contrasts them`, () => {
      const card: CascadeElement = { attrs: { 'data-surface': 'Container' }, parent: { attrs: { 'data-theme': theme }, parent: root } };
      const v = cascade.computed(card);
      const wantWhite = !lightCard(v['--Background']);
      if (!['Primary', 'Secondary', 'Tertiary'].includes(theme)) expect(wantWhite, `${theme} card ${v['--Background']} is dark`).toBe(true);
      expect(white(v['--Buttons-BlackWhite-Button']), `${theme} button ${v['--Buttons-BlackWhite-Button']} on ${v['--Background']}`).toBe(wantWhite);
      expect(white(v['--Text-BW']), `${theme} Text-BW ${v['--Text-BW']} on ${v['--Background']}`).toBe(wantWhite);
    });
  }

  /* Every level is dark since the dark ladder (utils/darkLadder.ts) —
     Brightest is tone 5, not the light tone it used to be — so every Default
     surface carries the white face. */
  it('dark mode · the Default theme\'s page surfaces all carry the white face', () => {
    for (const s of REPORT_SURFACES.filter((x) => x.startsWith('Surface'))) {
      const el: CascadeElement = { attrs: { 'data-surface': s }, parent: { attrs: { 'data-theme': 'Default' }, parent: root } };
      const v = cascade.computed(el);
      const shouldBeWhite = true;
      expect(white(v['--Buttons-BlackWhite-Button']), `${s} ${v['--Buttons-BlackWhite-Button']} on ${v['--Background']}`).toBe(shouldBeWhite);
    }
  });
});

/* ─── The preview picks the black/white face by contrast ──────────────────
 *
 * The preview (and the export's Cell-Button, which calls the same function)
 * chose the black/white Default button's face by a brightness cut at 0.5.
 * Popsicle's Secondary surface #00a8cc reads 0.48 "bright", so it got the
 * white face at 2.81:1, where black measures 7.5:1. The face must be the one
 * that contrasts more — on every theme's surfaces, in the preview too. */
describe('preview: black/white Default button', () => {
  /* Light mode only. In dark mode the preview's Tertiary theme paints every
     level one color (#462335 for Popsicle) while solving its buttons against
     another — a separate preview bug, found by running the rendered report
     on the preview's own CSS and reported rather than fixed here. */
  it('its fill clears 3:1 against every themed surface (light mode)', () => {
    const scheme = makeScheme(BRANDS.Popsicle);
    const sel = { background: 'Neutral/Surface-Brightest', button: 'black-white', cardColoring: 'tonal', textColoring: 'tonal' };
    const root: CascadeElement = { attrs: {}, root: true };
    const fails: string[] = [];
    let checked = 0;
    for (const mode of ['light'] as const) {
      const css = quietly(() => buildPreviewCSS({ colorScheme: scheme, userSelections: sel, componentStyle: 'modern', mode } as never));
      const cascade = new Cascade([css]);
      for (const theme of ['Primary', 'Secondary', 'Tertiary', 'Neutral']) {
        for (const s of ['Surface', 'Surface-Dim', 'Surface-Bright', 'Surface-Brightest', 'Surface-Dimmest']) {
          const v = cascade.computed({ attrs: { 'data-theme': theme, 'data-surface': s }, parent: root });
          const fill = parseColor(v['--Buttons-Default-Button'] ?? '');
          const bg = parseColor(v['--Background'] ?? '');
          if (!fill || !bg) continue;
          checked++;
          const ratio = contrast(fill.a < 1 ? composite(fill, bg) : fill, bg);
          if (ratio < 3) fails.push(`${mode} ${theme} ${s}: ${toHex(fill)} on ${toHex(bg)} = ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
    expect(fails).toEqual([]);
  }, 60_000);
});
