/**
 * The dark-mode surface ladder and its cards (utils/darkLadder.ts), asserted on
 * what the published CSS actually paints — not on the tables that feed it.
 *
 * The owner's model: in dark mode every theme, Default included, paints
 *   Surface-Dimmest black, Surface-Dim tone 1, Surface tone 2 (the page),
 *   Surface-Bright tone 3, Surface-Brightest tone 4
 * of its own palette, and a card is a SOLID color: that palette's tone 5 mixed
 * with the surface it sits on, 45 / 60 / 75 / 88 / 100% tone 5 (blendColors,
 * the light-mode card mix). No opacity on containers. Light mode does not
 * change.
 *
 * Invariant 7 (parity is not correctness): the SHAPE is asserted directly —
 * the exact tone per level, the exact solid mix per card and surface, every
 * card lighter than its surface, every card role passing on every card color —
 * and then the preview and the Figma payload are held to the same values
 * (invariants 5 and 6, per theme).
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import {
  DARK_LADDER_LEVELS, DARK_LADDER_TONE, DARK_CARD_LEVELS, DARK_CARD_TONE, DARK_CARD_ALPHA, darkCardHex,
  cardRoleFailures, labL,
} from '../utils/darkLadder';
import { blendColors } from '../utils/colorScale';
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
const cardOn = (card: string, parent: CascadeElement): CascadeElement => ({ attrs: { 'data-surface': card }, parent });
const hex = (v: string | undefined) => (v && chroma.valid(v) ? chroma(v).hex('rgb').toLowerCase() : null);
/** The value with its alpha: #rrggbb when opaque, #rrggbbaa otherwise. */
const hexA = (v: string | undefined) => (v && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);
/** The level a card INSIDE `outer` should use: a higher one (High or Highest). */
const HIGHER: Record<string, string[]> = {
  'Container-Lowest': ['Container-High', 'Container-Highest'],
  'Container-Low': ['Container-High', 'Container-Highest'],
  'Container': ['Container-High', 'Container-Highest'],
  'Container-High': ['Container-Highest'],
  'Container-Highest': ['Container-Highest'],
};

function paletteOf(theme: string, sel: Selection): string {
  return theme === 'Default' ? parseBackground(sel.background).theme : theme;
}

/* Tallies reported once at the end. */
const tally = {
  cards: 0, equalOnBrightest: 0,
  nestedHigher: 0, nestedHigherFailures: 0,
  nestedLower: 0, nestedLowerDarker: 0, nestedLowerFailures: 0,
};
afterAll(() => {
  process.stdout.write(`[darkLadder] ${tally.cards} solid card colors checked (card x surface x theme x system); ` +
    `${tally.equalOnBrightest} round equal to tone 4 on Brightest; ` +
    `nested, a HIGHER level inside: ${tally.nestedHigher} measured, ${tally.nestedHigherFailures} with a failing role; ` +
    `nested, a LOWER level inside (not the pattern): ${tally.nestedLower} measured, ${tally.nestedLowerDarker} darker than the parent, ` +
    `${tally.nestedLowerFailures} with a failing role\n`);
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

        // No translucent card anywhere in the dark sheet.
        const alphaCards = files['Dark-Mode.css'].match(/--Container(-Lowest|-Low|-High|-Highest)?:\s*#[0-9a-f]{8}\b/gi) ?? [];
        expect(alphaCards, 'a card color with an alpha byte').toEqual([]);

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
            const painted: Record<string, string> = {};
            for (const card of DARK_CARD_LEVELS) {
              const cv = cascade.computed(cardOn(card, el));
              // The card's own background: SOLID, exactly blendColors(tone 5, surface, alpha).
              const got = hexA(cv['--Background']);
              const want = DARK_CARD_ALPHA[card] >= 1 ? tone5 : blendColors(tone5, surface, DARK_CARD_ALPHA[card]).toLowerCase();
              if (got !== want || got !== darkCardHex(tone5, surface, card)) {
                problems.push(`${theme}/${level}/${card}: ${cv['--Background']} -> ${got}, expected solid ${want}`);
                continue;
              }
              painted[card] = got;
              tally.cards++;

              // Lighter than the surface it sits on.
              if (!(labL(got) - labL(surface) > 0)) {
                if (level === 'Surface-Brightest' && got === surface) tally.equalOnBrightest++;
                else problems.push(`${theme}/${level}/${card}: ${got} not lighter than the surface ${surface}`);
              }

              // Every role the card carries passes on its color.
              const fails = cardRoleFailures(cv, got);
              if (fails.length) problems.push(`${theme}/${level}/${card} on ${got}: ${fails.slice(0, 3).join(', ')}`);
            }

            /* A card inside a card. The pattern is a HIGHER level inside (High
               or Highest in a Container card): it inherits the surface's card
               colors, so it is the same color as that level on the surface and
               lighter than its parent. Its roles must pass. A LOWER level
               inside is not the pattern; it is measured and reported (it comes
               out darker than its parent), not failed. */
            for (const outer of DARK_CARD_LEVELS) {
              if (!painted[outer]) continue;
              for (const inner of DARK_CARD_LEVELS) {
                const iv = cascade.computed(cardOn(inner, cardOn(outer, el)));
                const bg = hexA(iv['--Background'])!;
                const nf = cardRoleFailures(iv, bg);
                if (HIGHER[outer].includes(inner)) {
                  tally.nestedHigher++;
                  if (bg !== painted[inner]) problems.push(`${theme}/${level}/${outer}>${inner}: ${bg}, expected the surface's ${inner} ${painted[inner]}`);
                  if (inner !== outer && !(labL(bg) > labL(painted[outer]))) problems.push(`${theme}/${level}/${outer}>${inner}: ${bg} not lighter than its parent ${painted[outer]}`);
                  if (nf.length) { tally.nestedHigherFailures++; problems.push(`${theme}/${level}/${outer}>${inner} on ${bg}: ${nf.slice(0, 2).join(', ')}`); }
                } else if (DARK_CARD_LEVELS.indexOf(inner) < DARK_CARD_LEVELS.indexOf(outer)) {
                  tally.nestedLower++;
                  if (labL(bg) < labL(painted[outer])) tally.nestedLowerDarker++;
                  if (nf.length) tally.nestedLowerFailures++;
                }
              }
            }
          }
        }

        // The page itself: no data-theme, no data-surface — tone 2.
        const pagePal = paletteOf('Default', sel);
        const pageHex = hex(dark.Colors[pagePal]['Color-2'].value)!;
        const page = hex(cascade.computed({ attrs: { 'data-theme': 'Default' }, parent: root })['--Background']);
        expect(page, 'the dark page').toBe(pageHex);
        // And cards straight on the page, with no theme anywhere above them.
        const pageTone5 = hex(dark.Colors[pagePal][`Color-${DARK_CARD_TONE}`].value)!;
        for (const card of DARK_CARD_LEVELS) {
          const got = hexA(cascade.computed({ attrs: { 'data-surface': card }, parent: root })['--Background']);
          expect(got, `${card} on the bare page`).toBe(darkCardHex(pageTone5, pageHex, card));
        }

        expect(problems.slice(0, 12)).toEqual([]);
      }, 180_000);
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

describe('dark ladder — the preview paints the same surfaces and cards (invariants 5 and 6)', () => {
  for (const [brand, colors] of Object.entries(BRANDS)) {
    for (const sel of [SELECTIONS[0], SELECTIONS[1], SELECTIONS[2]]) it(`${brand} · ${sel.background}: page, page levels and the three brand themes, with their cards`, () => {
      const { files } = quietly(() => buildSystem(colors, sel));
      const cascade = new Cascade(orderSheets(files, 'Dark'));
      const preview = quietly(() => buildPreviewCSS({
        colorScheme: makeScheme(colors), userSelections: sel, componentStyle: 'modern', mode: 'dark',
      } as never));
      /* With base.css, as the studio loads it: base.css maps each card level
         to its own --Background ([data-surface="Container-Low"] { --Background:
         var(--Container-Low) }); the preview states only the five values. */
      const previewCascade = new Cascade([files['base.css'], preview]);
      const at = (c: Cascade, theme: string, level?: string, card?: string) => {
        let el: CascadeElement = { attrs: { 'data-theme': theme }, parent: root };
        if (level) el = { attrs: { 'data-surface': level }, parent: el };
        if (card) el = cardOn(card, el);
        return hexA(c.computed(el)['--Background']);
      };
      const wrong: string[] = [];
      const same = (what: string, a: string | null, b: string | null) => { if (a !== b) wrong.push(`${what}: preview ${a}, export ${b}`); };
      same('page', at(previewCascade, 'Brand'), at(cascade, 'Default'));
      // The page's own levels the preview paints (Dim tone 1, Bright tone 3), and their cards.
      for (const level of [undefined, 'Surface-Dim', 'Surface-Bright']) {
        if (level) same(`page ${level}`, at(previewCascade, 'Brand', level), at(cascade, 'Default', level));
        for (const card of DARK_CARD_LEVELS) {
          same(`page ${level ?? 'Surface'} ${card}`, at(previewCascade, 'Brand', level, card), at(cascade, 'Default', level, card));
        }
      }
      // Per theme: its Surface and every card on it.
      for (const theme of ['Primary', 'Secondary', 'Tertiary']) {
        same(theme, at(previewCascade, theme), at(cascade, theme));
        for (const card of DARK_CARD_LEVELS) same(`${theme} ${card}`, at(previewCascade, theme, undefined, card), at(cascade, theme, undefined, card));
      }
      // And none of it translucent.
      expect(preview.match(/--Container(-Lowest|-Low|-High|-Highest)?:\s*#[0-9a-f]{8}\b/gi) ?? [], 'a preview card with an alpha byte').toEqual([]);
      expect(wrong).toEqual([]);
    }, 60_000);
  }
});

describe('dark ladder — Figma resolves the same backgrounds, and the page mix for cards (per theme)', () => {
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
        /* One value per theme and level in Figma, so the cards are the mix on
           the PAGE surface (tone 2), solid. Highest stays an alias to tone 5. */
        const tone5 = hex(D.Colors[pal][`Color-${DARK_CARD_TONE}`].value)!;
        const page = hex(D.Colors[pal][`Color-${DARK_LADDER_TONE.Surface}`].value)!;
        for (const card of DARK_CARD_LEVELS) {
          const raw = figma.Themes[theme]?.Containers?.[card]?.value;
          const got = resolve(raw);
          const want = darkCardHex(tone5, page, card);
          if (got !== want) wrong.push(`${theme}/${card}: ${got} vs ${want}`);
        }
      }
      // Every row's cards: solid, and Highest is the palette's tone 5.
      for (const [pal, rows] of Object.entries<any>(M.Backgrounds ?? {})) {
        const tone5 = D.Colors?.[pal]?.[`Color-${DARK_CARD_TONE}`]?.value;
        for (const [row, r] of Object.entries<any>(rows)) {
          const v = r?.Containers?.['Container-Highest']?.value;
          if (v !== undefined && tone5 && resolve(v) !== hex(tone5)) wrong.push(`${pal}/${row} Highest: ${v}, expected tone 5 ${tone5}`);
          for (const card of DARK_CARD_LEVELS) {
            const c = r?.Containers?.[card]?.value;
            if (typeof c === 'string' && /^#[0-9a-f]{8}$/i.test(c)) wrong.push(`${pal}/${row}/${card}: translucent ${c}`);
          }
        }
      }
      expect(wrong).toEqual([]);
    }, 60_000);
  }
});
