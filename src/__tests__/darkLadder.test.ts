/**
 * The dark-mode surface ladder (utils/darkLadder.ts), asserted on what the
 * published CSS actually paints — not on the tables that feed it.
 *
 * The owner's decision, from the Figma mockups: in dark mode every theme,
 * Default included, paints Surface-Dimmest..Brightest on tones 1-5 of its own
 * palette, the page sits on tone 3, tone 1 is the palette's tinted tone 1
 * unless black was chosen, and cards lift above whatever surface they sit on.
 * Light mode does not change.
 *
 * Invariant 7 (parity is not correctness): the ladder's SHAPE is asserted
 * directly — strictly darkest to lightest, inside the dark band, cards above
 * their surface by a visible step — and then the preview and the Figma payload
 * are held to the same values (invariants 5 and 6, per theme).
 */
import { describe, it, expect, afterEach } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import {
  DARK_LADDER_LEVELS, DARK_LADDER_TONE, MIN_CARD_STEP_L, cardRolesFit, blackChosen, labL,
} from '../utils/darkLadder';
import { DARK_LADDER } from '../utils/cssgen/darkLadderPass';
import { parseBackground } from '../utils/backgroundSelection';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';

const THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'] as const;
const CARDS = ['Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest'] as const;

/**
 * Brightest's cards may only lift as far as every card role still passes
 * (darkLadderPass step 6 holds the roles to 0.5 L* a level there). Measured
 * after 8-bit rounding, a step on that surface can land a little under the
 * 0.5 target, so the floor asserted is 0.3 L*; the other four surfaces carry
 * the full MIN_CARD_STEP_L.
 */
const MIN_BRIGHTEST_STEP_ROUNDED = 0.3;

const SELECTIONS: Selection[] = [
  { background: 'Neutral/Surface-Brightest', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
  { background: 'Primary/Surface', button: 'black-white', cardColoring: 'white', textColoring: 'black-white' },
  { background: 'Neutral/Surface-Dimmest', button: 'tonal', cardColoring: 'black', textColoring: 'tonal' },
  { background: 'Primary/Surface-Bright', button: 'secondary', cardColoring: 'tonal', textColoring: 'tonal' },
];

const root: CascadeElement = { attrs: {}, root: true };
/* Theme and level on one element — how <Section theme surface> renders. (A
   bare data-surface="Surface" nested under a themed parent has no rule of its
   own and takes the page's: a separate, pre-existing quirk of the selectors.) */
const surfaceEl = (theme: string, level: string): CascadeElement =>
  ({ attrs: { 'data-theme': theme, 'data-surface': level }, parent: root });
const hex = (v: string | undefined) => (v && chroma.valid(v) ? chroma(v).hex('rgb').toLowerCase() : null);

function paletteOf(theme: string, sel: Selection): string {
  return theme === 'Default' ? parseBackground(sel.background).theme : theme;
}

describe('dark ladder — what the CSS paints', () => {
  for (const [brand, colors] of Object.entries(BRANDS)) {
    for (const sel of SELECTIONS) {
      const label = `${brand} · ${sel.background} · ${sel.cardColoring} cards`;
      it(label, () => {
        const { json, files } = quietly(() => buildSystem(colors, sel));
        const dark = (json as any).Modes['Dark-Mode'];
        const cascade = new Cascade(orderSheets(files, 'Dark'));
        const problems: string[] = [];

        for (const theme of THEMES) {
          const pal = paletteOf(theme, sel);
          const tone = (n: number) => hex(dark.Colors[pal][`Color-${n}`].value)!;
          const tone5L = labL(tone(5));
          let previousL = -Infinity;
          for (const level of DARK_LADDER_LEVELS) {
            const el = surfaceEl(theme, level);
            const v = cascade.computed(el);
            const bg = hex(v['--Background']);
            if (!bg) { problems.push(`${theme}/${level}: no background`); continue; }
            const L = labL(bg);
            const want = DARK_LADDER_TONE[level];

            // Each level paints its palette's own tone — black only on a
            // Neutral tone 1 the designer chose black for.
            const isBlack = bg === '#000000';
            if (isBlack) {
              if (!(want === 1 && pal === 'Neutral' && blackChosen(sel))) problems.push(`${theme}/${level}: pure black, black not chosen`);
            } else if (bg !== tone(want)) {
              problems.push(`${theme}/${level}: ${bg}, expected ${pal} tone ${want} ${tone(want)}`);
            }
            if (!(L > previousL)) problems.push(`${theme}/${level}: L* ${L.toFixed(1)} not above ${previousL.toFixed(1)}`);
            if (L > tone5L + 0.01) problems.push(`${theme}/${level}: L* ${L.toFixed(1)} past the dark band (${tone5L.toFixed(1)})`);
            previousL = L;

            // Cards on this surface: Lowest..Highest strictly rising, every
            // one above the surface by a visible step, every card role passing.
            const minStep = want === 5 ? MIN_BRIGHTEST_STEP_ROUNDED : MIN_CARD_STEP_L;
            let cardL = L;
            for (const card of CARDS) {
              const cv = cascade.computed({ attrs: { 'data-surface': card }, parent: el });
              const cbg = hex(cv['--Background']);
              if (!cbg) { problems.push(`${theme}/${level}/${card}: no background`); continue; }
              const cL = labL(cbg);
              if (cL - cardL < minStep - 1e-9) {
                problems.push(`${theme}/${level}/${card}: ${cbg} L* ${cL.toFixed(2)} only ${(cL - cardL).toFixed(2)} above the level below`);
              }
              cardL = cL;
              if (!cardRolesFit(cv)(cbg)) problems.push(`${theme}/${level}/${card}: a card role fails on ${cbg}`);
            }
          }
        }

        // The page itself: no data-theme, no data-surface beyond the Default.
        const page = hex(cascade.computed({ attrs: { 'data-theme': 'Default' }, parent: root })['--Background']);
        const pagePal = paletteOf('Default', sel);
        expect(page, 'the dark page').toBe(hex(dark.Colors[pagePal]['Color-3'].value));

        expect(problems.slice(0, 12)).toEqual([]);
      }, 60_000);
    }
  }
});

describe('dark ladder — light mode is unchanged', () => {
  afterEach(() => { DARK_LADDER.enabled = true; });
  for (const [brand, colors] of Object.entries(BRANDS).slice(0, 3)) {
    it(`${brand}: Light-Mode.css and base.css are byte-identical with and without the pass`, () => {
      const sel = SELECTIONS[0];
      DARK_LADDER.enabled = false;
      const without = quietly(() => buildSystem(colors, sel)).files;
      DARK_LADDER.enabled = true;
      const withIt = quietly(() => buildSystem(colors, sel)).files;
      expect(withIt['Light-Mode.css'] === without['Light-Mode.css'], 'Light-Mode.css changed').toBe(true);
      expect(withIt['base.css'] === without['base.css'], 'base.css changed').toBe(true);
      expect(withIt['Dark-Mode.css'] === without['Dark-Mode.css'], 'the pass changed nothing in dark mode').toBe(false);
    }, 60_000);
  }
});

describe('dark ladder — the preview paints the same ladder (invariant 5)', () => {
  for (const [brand, colors] of Object.entries(BRANDS)) {
    for (const sel of [SELECTIONS[0], SELECTIONS[1]]) it(`${brand} · ${sel.background}: page, page cards and the three brand themes' Surface`, () => {
      const { files } = quietly(() => buildSystem(colors, sel));
      const cascade = new Cascade(orderSheets(files, 'Dark'));
      const preview = quietly(() => buildPreviewCSS({
        colorScheme: makeScheme(colors), userSelections: sel, componentStyle: 'modern', mode: 'dark',
      } as never));
      const previewCascade = new Cascade([preview]);
      const previewAt = (theme: string, token = '--Background') =>
        hex(previewCascade.computed({ attrs: { 'data-theme': theme }, parent: root })[token]);
      const exportAt = (theme: string, surface?: string) => {
        const el: CascadeElement = { attrs: { 'data-theme': theme }, parent: root };
        return hex(cascade.computed(surface ? { attrs: { 'data-surface': surface }, parent: el } : el)['--Background']);
      };
      expect(previewAt('Brand'), 'page').toBe(exportAt('Default'));
      for (const card of CARDS) {
        expect(previewAt('Brand', `--${card}`), `page ${card}`).toBe(exportAt('Default', card));
      }
      for (const theme of ['Primary', 'Secondary', 'Tertiary']) {
        expect(previewAt(theme), theme).toBe(exportAt(theme));
      }
    }, 60_000);
  }
});

describe('dark ladder — Figma resolves the same backgrounds (per theme)', () => {
  it('every theme level, in the payload\'s dark mode, paints tones 1-5', () => {
    const sel = SELECTIONS[0];
    const { json } = quietly(() => buildSystem(BRANDS.Popsicle, sel));
    const figma: any = quietly(() => generateFigmaJSON(json as never));
    const M = figma.Modes['Dark-Mode'];
    const resolve = (v: unknown): string | null => {
      let cur = v;
      for (let hop = 0; hop < 8 && typeof cur === 'string' && cur.startsWith('{'); hop++) {
        let node: any = M;
        for (const k of cur.slice(1, -1).split('.')) node = node?.[k];
        cur = node?.value;
      }
      return typeof cur === 'string' ? hex(cur) : null;
    };
    const section: Record<string, string> = {
      'Surface-Dimmest': 'Surface-Dimmest', 'Surface-Dim': 'Surface-Dim', Surface: 'Surface',
      'Surface-Bright': 'Surface-Bright', 'Surface-Brightest': 'Surface-Brightest',
    };
    const wrong: string[] = [];
    for (const theme of THEMES) {
      const pal = paletteOf(theme, sel);
      for (const level of DARK_LADDER_LEVELS) {
        const got = resolve(figma.Themes[theme]?.[section[level]]?.Background?.value);
        const want = hex((json as any).Modes['Dark-Mode'].Colors[pal][`Color-${DARK_LADDER_TONE[level]}`].value);
        if (got !== want) wrong.push(`${theme}/${level}: ${got} vs ${want}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 60_000);
});
