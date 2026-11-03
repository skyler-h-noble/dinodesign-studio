/**
 * The dark-mode surface ladder and its cards (utils/darkLadder.ts), asserted on
 * what the published CSS actually paints — not on the tables that feed it.
 *
 * The owner's model: in dark mode every theme, Default included, paints
 *   Surface-Dimmest black, Surface-Dim tone 1, Surface tone 2 (the page),
 *   Surface-Bright tone 3, Surface-Brightest tone 4
 * of its own palette, and a card is that palette's tone 5 at 45 / 60 / 75 /
 * 88 / 100% opacity laid over whatever surface it sits on. Light mode does not
 * change.
 *
 * Invariant 7 (parity is not correctness): the SHAPE is asserted directly —
 * the exact tone per level, the exact alpha per card, every card lighter than
 * its surface, every card role passing on every composite a card can make —
 * and then the preview and the Figma payload are held to the same values
 * (invariants 5 and 6, per theme).
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import {
  DARK_LADDER_LEVELS, DARK_LADDER_TONE, DARK_CARD_LEVELS, DARK_CARD_TONE, darkCardAlphaByte,
  cardRoleFailures, labL, over,
} from '../utils/darkLadder';
import { DARK_LADDER } from '../utils/cssgen/darkLadderPass';
import { parseBackground } from '../utils/backgroundSelection';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';

const THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'] as const;

const SELECTIONS: Selection[] = [
  { background: 'Neutral/Surface-Brightest', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
  { background: 'Primary/Surface', button: 'black-white', cardColoring: 'white', textColoring: 'black-white' },
  { background: 'Neutral/Surface-Dimmest', button: 'tonal', cardColoring: 'black', textColoring: 'tonal' },
  { background: 'Primary/Surface-Bright', button: 'secondary', cardColoring: 'tonal', textColoring: 'tonal' },
];

const root: CascadeElement = { attrs: {}, root: true };
/* Theme and level on one element — how <Section theme surface> renders. */
const surfaceEl = (theme: string, level: string): CascadeElement =>
  ({ attrs: { 'data-theme': theme, 'data-surface': level }, parent: root });
const hex = (v: string | undefined) => (v && chroma.valid(v) ? chroma(v).hex('rgb').toLowerCase() : null);
/** The value with its alpha: #rrggbb when opaque, #rrggbbaa otherwise. */
const hexA = (v: string | undefined) => (v && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);

function paletteOf(theme: string, sel: Selection): string {
  return theme === 'Default' ? parseBackground(sel.background).theme : theme;
}

/* Tallies reported once at the end: how often a card on Brightest (tone 4)
   rounds to the surface itself, and how many nested-card composites were
   measured. */
const tally = { cardOverSurface: 0, equalOnBrightest: 0, nestedComposites: 0, nestedFailures: 0 };
afterAll(() => {
  process.stdout.write(`[darkLadder] ${tally.cardOverSurface} card-over-surface composites; ` +
    `${tally.equalOnBrightest} round equal to tone 4 on Brightest; ` +
    `${tally.nestedComposites} nested-card composites, ${tally.nestedFailures} with a failing role\n`);
});

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
          const tone = (n: number) => (n === 0 ? '#000000' : hex(dark.Colors[pal][`Color-${n}`].value)!);
          const tone5 = tone(DARK_CARD_TONE);

          // The five surfaces: black, then tones 1-4, exactly.
          const surfaces: Record<string, string> = {};
          for (const level of DARK_LADDER_LEVELS) {
            const bg = hexA(cascade.computed(surfaceEl(theme, level))['--Background']);
            const want = tone(DARK_LADDER_TONE[level]);
            if (bg !== want) problems.push(`${theme}/${level}: ${bg}, expected ${pal} ${DARK_LADDER_TONE[level] === 0 ? 'black' : `tone ${DARK_LADDER_TONE[level]}`} ${want}`);
            surfaces[level] = want;
          }

          for (const level of DARK_LADDER_LEVELS) {
            const surface = surfaces[level];
            const el = surfaceEl(theme, level);
            const cardOn = (card: string, parent: CascadeElement): CascadeElement => ({ attrs: { 'data-surface': card }, parent });
            for (const card of DARK_CARD_LEVELS) {
              const cv = cascade.computed(cardOn(card, el));
              // The card's own background: tone 5 at the level's exact alpha.
              const raw = cv['--Background'];
              const c = raw && chroma.valid(raw) ? chroma(raw) : null;
              if (!c || c.hex('rgb').toLowerCase() !== tone5) {
                problems.push(`${theme}/${level}/${card}: ${raw}, expected ${pal} tone 5 ${tone5}`);
                continue;
              }
              const alphaByte = Math.round(c.alpha() * 255);
              if (alphaByte !== darkCardAlphaByte(card)) problems.push(`${theme}/${level}/${card}: alpha ${alphaByte}/255, expected ${darkCardAlphaByte(card)}`);

              // Laid over the surface it sits on: lighter than the surface.
              const composite = over(raw!, surface);
              tally.cardOverSurface++;
              const dL = labL(composite) - labL(surface);
              if (!(dL > 0)) {
                if (level === 'Surface-Brightest' && composite === surface) tally.equalOnBrightest++;
                else problems.push(`${theme}/${level}/${card}: ${composite} not lighter than the surface ${surface}`);
              }

              // Every role the card carries passes on this composite.
              const fails = cardRoleFailures(cv, composite);
              if (fails.length) problems.push(`${theme}/${level}/${card} on ${composite}: ${fails.slice(0, 3).join(', ')}`);

              // A card nested in this card composites twice. Measured on the
              // lightest and darkest inner card; the roles must still pass.
              for (const inner of ['Container-Lowest', 'Container-Highest'] as const) {
                const iv = cascade.computed(cardOn(inner, cardOn(card, el)));
                const twice = over(iv['--Background']!, composite);
                tally.nestedComposites++;
                const nf = cardRoleFailures(iv, twice);
                if (nf.length) { tally.nestedFailures++; problems.push(`${theme}/${level}/${card}>${inner} on ${twice}: ${nf.slice(0, 2).join(', ')}`); }
              }
            }
          }
        }

        // The page itself: no data-theme, no data-surface — tone 2.
        const pagePal = paletteOf('Default', sel);
        const page = hex(cascade.computed({ attrs: { 'data-theme': 'Default' }, parent: root })['--Background']);
        expect(page, 'the dark page').toBe(hex(dark.Colors[pagePal]['Color-2'].value));
        // And a card straight on the page, with no theme anywhere above it.
        const pageCard = cascade.computed({ attrs: { 'data-surface': 'Container' }, parent: root })['--Background'];
        expect(hexA(pageCard), 'a card on the bare page').toBe(
          hexA(chroma(dark.Colors[pagePal][`Color-${DARK_CARD_TONE}`].value).alpha(darkCardAlphaByte('Container') / 255).hex()));

        expect(problems.slice(0, 12)).toEqual([]);
      }, 120_000);
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
    for (const sel of [SELECTIONS[0], SELECTIONS[1], SELECTIONS[2]]) it(`${brand} · ${sel.background}: page, page cards and the three brand themes' Surface`, () => {
      const { files } = quietly(() => buildSystem(colors, sel));
      const cascade = new Cascade(orderSheets(files, 'Dark'));
      const preview = quietly(() => buildPreviewCSS({
        colorScheme: makeScheme(colors), userSelections: sel, componentStyle: 'modern', mode: 'dark',
      } as never));
      const previewCascade = new Cascade([preview]);
      const previewAt = (theme: string, token = '--Background') =>
        hexA(previewCascade.computed({ attrs: { 'data-theme': theme }, parent: root })[token]);
      const exportAt = (theme: string, surface?: string) => {
        const el: CascadeElement = { attrs: { 'data-theme': theme }, parent: root };
        return hexA(cascade.computed(surface ? { attrs: { 'data-surface': surface }, parent: el } : el)['--Background']);
      };
      expect(previewAt('Brand'), 'page').toBe(exportAt('Default'));
      for (const card of DARK_CARD_LEVELS) {
        expect(previewAt('Brand', `--${card}`), `page ${card}`).toBe(exportAt('Default', card));
      }
      for (const theme of ['Primary', 'Secondary', 'Tertiary']) {
        expect(previewAt(theme), theme).toBe(exportAt(theme));
      }
    }, 60_000);
  }
});

describe('dark ladder — Figma resolves the same backgrounds and cards (per theme)', () => {
  for (const [brand, colors] of Object.entries(BRANDS).slice(0, 2)) {
    for (const sel of [SELECTIONS[0], SELECTIONS[2]]) it(`${brand} · ${sel.background}: every theme level and card, in the payload's dark mode`, () => {
      const { json } = quietly(() => buildSystem(colors, sel));
      const figma: any = quietly(() => generateFigmaJSON(json as never));
      const M = figma.Modes['Dark-Mode'];
      const resolve = (v: unknown): string | null => {
        let cur = v;
        for (let hop = 0; hop < 8 && typeof cur === 'string' && cur.startsWith('{'); hop++) {
          let node: any = M;
          for (const k of cur.slice(1, -1).split('.')) node = node?.[k];
          cur = node?.value;
        }
        return typeof cur === 'string' ? hexA(cur) : null;
      };
      const D = (json as any).Modes['Dark-Mode'];
      const wrong: string[] = [];
      for (const theme of THEMES) {
        const pal = paletteOf(theme, sel);
        for (const level of DARK_LADDER_LEVELS) {
          const got = resolve(figma.Themes[theme]?.[level]?.Background?.value);
          const t = DARK_LADDER_TONE[level];
          const want = t === 0 ? '#000000' : hex(D.Colors[pal][`Color-${t}`].value);
          if (got !== want) wrong.push(`${theme}/${level}: ${got} vs ${want}`);
        }
        const tone5 = D.Colors[pal][`Color-${DARK_CARD_TONE}`].value;
        for (const card of DARK_CARD_LEVELS) {
          const got = resolve(figma.Themes[theme]?.Containers?.[card]?.value);
          const want = hexA(chroma(tone5).alpha(darkCardAlphaByte(card) / 255).hex());
          if (got !== want) wrong.push(`${theme}/${card}: ${got} vs ${want}`);
        }
      }
      expect(wrong).toEqual([]);
    }, 60_000);
  }
});
