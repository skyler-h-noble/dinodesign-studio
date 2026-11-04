/**
 * The dark-mode surface ladder and its cards (utils/darkLadder.ts), asserted on
 * what the published CSS actually paints — not on the tables that feed it.
 *
 * The owner's model: in dark mode every theme, Default included, paints
 *   Surface-Dimmest tone 1, Surface-Dim tone 2, Surface tone 3 (the page),
 *   Surface-Bright tone 4, Surface-Brightest tone 5
 * of its own palette (pure black only where the Neutral palette paints tone 1
 * and the designer chose black: blackChosen), and a card is a SOLID color:
 * that palette's tone 4 mixed with its page (tone 3), 50 / 65 / 75 / 90 / 100%
 * tone 4 (blendColors). ONE
 * set per theme, the same on every surface level — no per-surface mixes, no
 * opacity. Light mode does not change.
 *
 * Invariant 7 (parity is not correctness): the SHAPE is asserted directly —
 * the exact tone per level, the exact solid mix per card, the same five on
 * every surface, every card role passing on every card color, and the accepted
 * consequence on Bright / Brightest (cards level with or darker than the
 * surface) — and then the preview and the Figma payload are held to the same
 * values (invariants 5 and 6, per theme).
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import {
  DARK_LADDER_LEVELS, DARK_LADDER_TONE, DARK_CARD_LEVELS, DARK_CARD_TONE, DARK_CARD_ALPHA, darkCardHex, darkCardHexesForRamp,
  cardRoleFailures, labL, blackChosen,
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
  cards: 0, levelOnBright: 0, darkerOnBright: 0, darkerOnBrightest: 0,
  nestedHigher: 0, nestedHigherFailures: 0,
  nestedLower: 0, nestedLowerDarker: 0, nestedLowerFailures: 0,
};
afterAll(() => {
  process.stdout.write(`[darkLadder] ${tally.cards} solid card colors checked (card x surface x theme x system); ` +
    `on Surface-Bright ${tally.levelOnBright} level with it and ${tally.darkerOnBright} darker, ` +
    `on Surface-Brightest ${tally.darkerOnBrightest} darker (the accepted consequence); ` +
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
          const tone = (n: number) => hex(dark.Colors[pal][`Color-${n}`].value)!;
          /* What a level paints: its tone, or black on Neutral's tone 1 when
             the designer chose black — exactly then, never otherwise. */
          const black = blackChosen(sel) && pal === 'Neutral';
          const paints = (level: typeof DARK_LADDER_LEVELS[number]) =>
            (DARK_LADDER_TONE[level] === 1 && black ? '#000000' : tone(DARK_LADDER_TONE[level]));
          const face = tone(DARK_CARD_TONE);
          const page = tone(DARK_LADDER_TONE.Surface);
          /* The theme's ONE set: tone 4 over the page (tone 3), exactly. */
          const want: Record<string, string> = {};
          for (const card of DARK_CARD_LEVELS) {
            want[card] = DARK_CARD_ALPHA[card] >= 1 ? face : blendColors(face, page, DARK_CARD_ALPHA[card]).toLowerCase();
            expect(darkCardHex(face, page, card), `${theme} ${card} helper`).toBe(want[card]);
          }

          // The five surfaces: tones 1-5, exactly (black where chosen).
          const surfaces: Record<string, string> = {};
          for (const level of DARK_LADDER_LEVELS) {
            const bg = hexA(cascade.computed(surfaceEl(theme, level))['--Background']);
            const w = paints(level);
            if (bg !== w) problems.push(`${theme}/${level}: ${bg}, expected ${pal} ${w === '#000000' ? 'black' : `tone ${DARK_LADDER_TONE[level]}`} ${w}`);
            surfaces[level] = w;
          }

          for (const level of DARK_LADDER_LEVELS) {
            const surface = surfaces[level];
            const el = surfaceEl(theme, level);
            const painted: Record<string, string> = {};
            for (const card of DARK_CARD_LEVELS) {
              const cv = cascade.computed(cardOn(card, el));
              // The same five on every surface level.
              const got = hexA(cv['--Background']);
              if (got !== want[card]) {
                problems.push(`${theme}/${level}/${card}: ${cv['--Background']} -> ${got}, expected the theme's ${want[card]}`);
                continue;
              }
              painted[card] = got;
              tally.cards++;

              /* Lighter than the page and the Dim levels. On Bright (tone 4)
                 and Brightest (tone 5) the cards sit level with or darker than
                 the surface — the owner accepted that; asserted so it cannot
                 change unnoticed. */
              const dL = labL(got) - labL(surface);
              if (level === 'Surface-Bright') {
                if (got === surface) tally.levelOnBright++;
                else if (dL < 0) tally.darkerOnBright++;
                else problems.push(`${theme}/${level}/${card}: ${got} lighter than the tone-4 surface ${surface}`);
              } else if (level === 'Surface-Brightest') {
                if (dL < 0) tally.darkerOnBrightest++;
                else problems.push(`${theme}/${level}/${card}: ${got} not darker than the tone-5 surface ${surface}`);
              } else if (!(dL > 0)) {
                problems.push(`${theme}/${level}/${card}: ${got} not lighter than the surface ${surface}`);
              }

              // Every role the card carries passes on its color.
              const fails = cardRoleFailures(cv, got);
              if (fails.length) problems.push(`${theme}/${level}/${card} on ${got}: ${fails.slice(0, 3).join(', ')}`);
            }

            /* A card inside a card. The pattern is a HIGHER level inside (High
               or Highest in a Container card): the levels rise toward tone 4,
               so it is lighter than its parent, and it is the same color as
               that level anywhere. Its roles must pass. A LOWER level inside
               is not the pattern; it is measured and reported (it comes out
               darker than its parent), not failed. */
            for (const outer of DARK_CARD_LEVELS) {
              if (!painted[outer]) continue;
              for (const inner of DARK_CARD_LEVELS) {
                const iv = cascade.computed(cardOn(inner, cardOn(outer, el)));
                const bg = hexA(iv['--Background'])!;
                const nf = cardRoleFailures(iv, bg);
                if (HIGHER[outer].includes(inner)) {
                  tally.nestedHigher++;
                  if (bg !== want[inner]) problems.push(`${theme}/${level}/${outer}>${inner}: ${bg}, expected ${want[inner]}`);
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

        // The page itself: no data-theme, no data-surface — tone 3.
        const pagePal = paletteOf('Default', sel);
        const pageHex = hex(dark.Colors[pagePal][`Color-${DARK_LADDER_TONE.Surface}`].value)!;
        const page = hex(cascade.computed({ attrs: { 'data-theme': 'Default' }, parent: root })['--Background']);
        expect(page, 'the dark page').toBe(pageHex);
        // And cards straight on the page, with no theme anywhere above them.
        const pageFace = hex(dark.Colors[pagePal][`Color-${DARK_CARD_TONE}`].value)!;
        for (const card of DARK_CARD_LEVELS) {
          const got = hexA(cascade.computed({ attrs: { 'data-surface': card }, parent: root })['--Background']);
          expect(got, `${card} on the bare page`).toBe(darkCardHex(pageFace, pageHex, card));
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
      // The page's own levels the preview paints (Dimmest tone 1, Dim tone 2, Bright tone 4), and their cards.
      for (const level of [undefined, 'Surface-Dimmest', 'Surface-Dim', 'Surface-Bright']) {
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

describe('dark ladder — Figma holds exactly the CSS cards and backgrounds (per theme)', () => {
  for (const [brand, colors] of Object.entries(BRANDS).slice(0, 2)) {
    for (const sel of [SELECTIONS[0], SELECTIONS[1], SELECTIONS[2]]) it(`${brand} · ${sel.background} · ${sel.cardColoring} cards: every theme level and card, in the payload's dark mode`, () => {
      const { json, files } = quietly(() => buildSystem(colors, sel));
      const figma: any = quietly(() => generateFigmaJSON(json as never));
      const cascade = new Cascade(orderSheets(files, 'Dark'));
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
          const want = t === 1 && pal === 'Neutral' && blackChosen(sel) ? '#000000' : hex(D.Colors[pal][`Color-${t}`].value);
          if (got !== want) wrong.push(`${theme}/${level}: ${got} vs ${want}`);
        }
        /* The theme's one set — tone 4 over the page, solid — and exactly
           what the CSS paints for that theme's cards (on its page surface;
           every surface paints the same five). */
        const face = hex(D.Colors[pal][`Color-${DARK_CARD_TONE}`].value)!;
        const page = hex(D.Colors[pal][`Color-${DARK_LADDER_TONE.Surface}`].value)!;
        for (const card of DARK_CARD_LEVELS) {
          const raw = figma.Themes[theme]?.Containers?.[card]?.value;
          const got = resolve(raw);
          const want = darkCardHex(face, page, card);
          if (got !== want) wrong.push(`${theme}/${card}: Figma ${got} vs ${want}`);
          const css = hexA(cascade.computed(cardOn(card, surfaceEl(theme, 'Surface')))['--Background']);
          if (got !== css) wrong.push(`${theme}/${card}: Figma ${got} vs CSS ${css}`);
        }
        if (figma.Themes[theme]?.Containers?.['Container-Highest']?.value !== undefined
          && resolve(figma.Themes[theme].Containers['Container-Highest'].value) !== face) {
          wrong.push(`${theme} Highest is not tone 4`);
        }
      }
      /* Every row's cards: the palette's one set, solid, in the payload; in the
         exported JSON (which the CSS reads) Highest is an alias to tone 4. */
      for (const [pal, rows] of Object.entries<any>(M.Backgrounds ?? {})) {
        const ramp = Array.from({ length: 12 }, (_, i) => hex(D.Colors?.[pal]?.[`Color-${i + 1}`]?.value) ?? '');
        if (ramp.some((h) => !h)) continue;
        const set = darkCardHexesForRamp(ramp);
        for (const [row, r] of Object.entries<any>(rows)) {
          for (const card of DARK_CARD_LEVELS) {
            const c = r?.Containers?.[card]?.value;
            if (c === undefined) continue;
            if (resolve(c) !== set[card]) wrong.push(`${pal}/${row}/${card}: ${c}, expected ${set[card]}`);
          }
          const j = D.Backgrounds?.[pal]?.[row]?.Containers?.['Container-Highest']?.value;
          if (j !== undefined && j !== `{Colors.${pal}.Color-${DARK_CARD_TONE}}`) wrong.push(`JSON ${pal}/${row} Highest: ${j}, expected the tone-4 alias`);
        }
      }
      expect(wrong.slice(0, 12)).toEqual([]);
    }, 60_000);
  }
});
