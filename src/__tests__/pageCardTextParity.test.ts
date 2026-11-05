/**
 * The page's and its cards' text roles: the CSS export, the preview and the
 * Figma payload paint the same color, in BOTH modes, under every Card and
 * Text Coloring (owner, 2026-11-05).
 *
 * Four gaps closed here, each of which a parity test used to skip:
 *
 * 1. Black & White text. The option is "Black & white only": the page's Text
 *    reads the curated BW tables (black or white per tone and mode), as every
 *    themed section always has. The CSS and Figma read the page palette's
 *    table on the page (#593462 on a Popsicle primary-light page) and the
 *    preview painted a literal #1a1a1a. Headers keep the palette, as every
 *    themed section's do.
 * 2. White cards are flat in light mode: the Card-Coloring row Figma reads
 *    (Neutral Color-12 over row 12), not white letting the page through.
 * 3. Card Quiet is ONE model: the card's Text at the smallest opacity that
 *    clears 4.5:1 on all five card levels. Figma binds that opacity; the CSS
 *    and the preview paint the solid it gives over the card face.
 * 4. Dark-mode Text in the preview reads the dark table's answer from the dark
 *    ramp (it drew a light-ramp tone: #f7d9fb where the export has #e8beef).
 *
 * Invariant 7: the intended shape is asserted on its own too — Black & White
 * text is black or white, card Quiet clears every level at the smallest
 * opacity, white cards are flat, dark text comes from the dark ramp.
 *
 * Not covered: the PAGE's Quiet. The preview still solves it with its own
 * tone search, not the export's shared per-tone opacity table (a separate
 * divergence, pre-dating this change).
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { BRANDS, buildSystem, quietly, makeScheme, type Selection } from './__fixtures__/renderedSystem';
import { Cascade, type CascadeElement } from '../utils/cssCascade';
import { orderSheets } from '../utils/renderedAccessibilityReport';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { DARK_CARD_LEVELS } from '../utils/darkLadder';
import { compositeOver, contrastRatio } from '../utils/quietOpacity';

const BGS = ['white', 'black', 'primary-light', 'primary-base', 'Neutral/Surface-Bright', 'Primary/Surface-Dim', 'Secondary/Surface-Bright'];
const COMBOS: Array<[Selection['cardColoring'], Selection['textColoring']]> = [
  ['tonal', 'tonal'], ['white', 'black-white'], ['black', 'tonal'],
  ['tonal', 'black-white'], ['white', 'tonal'], ['black', 'black-white'],
];
const root: CascadeElement = { attrs: {}, root: true };
const hex = (v: unknown) => (typeof v === 'string' && chroma.valid(v) ? chroma(v).hex('auto').toLowerCase() : null);
const themeEl = (t: string): CascadeElement => ({ attrs: { 'data-theme': t }, parent: root });
const cardEl = (t: string, l: string): CascadeElement => ({ attrs: { 'data-surface': l }, parent: themeEl(t) });
/** A color with an optional alpha byte, composited the way Figma paints an alias at an opacity. */
const atOpacity = (text: string, bg: string, percent: number) => {
  const a = text.length === 9 ? parseInt(text.slice(7, 9), 16) / 255 : 1;
  return compositeOver(text.slice(0, 7), bg.slice(0, 7), (percent / 100) * a);
};

for (const brand of ['Popsicle', 'Cocktails', 'Surf', 'Grape']) {
  describe(`${brand}: page and card text roles, CSS == preview == Figma`, () => {
    for (const bg of BGS) {
      it(`${bg}`, () => {
        const wrong: string[] = [];
        for (const [card, text] of COMBOS) {
          const s: Selection = { background: bg, button: 'primary', cardColoring: card, textColoring: text };
          const { json, files } = quietly(() => buildSystem(BRANDS[brand], s));
          const figma: any = quietly(() => generateFigmaJSON(json as never));
          for (const mode of ['Light', 'Dark'] as const) {
            const tag = `${card}/${text} ${mode}`;
            const css = new Cascade(orderSheets(files, mode));
            const pv = new Cascade([files['base.css'], quietly(() => buildPreviewCSS({
              colorScheme: makeScheme(BRANDS[brand]), userSelections: s, componentStyle: 'modern', mode: mode.toLowerCase(),
            } as never))]);
            const db = figma.Modes[`${mode}-Mode`]['Default-Background'];
            const colors = (json as any).Modes[`${mode}-Mode`].Colors;

            // The page.
            const c = css.computed(themeEl('Default')), p = pv.computed(themeEl('Brand'));
            for (const [r, fk] of [['--Text', 'Text'], ['--Header', 'Header'], ['--Border', 'Border'], ['--Icons-Default', 'Icons-Default']] as const) {
              const cv = hex(c[r]), pvv = hex(p[r]), fv = hex(db?.[fk]?.value);
              if (cv !== pvv) wrong.push(`${tag} page ${r}: CSS ${cv}, preview ${pvv}`);
              if (cv !== fv) wrong.push(`${tag} page ${r}: CSS ${cv}, Figma ${fv}`);
            }
            const pageText = hex(c['--Text'])!;
            if (text === 'black-white') {
              const bw = [hex(colors.Neutral['Color-1'].value), mode === 'Light' ? '#ffffff' : '#ffffffb3'];
              if (!bw.includes(pageText)) wrong.push(`${tag} page Text ${pageText} is not black or white (${bw.join(' / ')})`);
            } else if (mode === 'Dark' && !/^Neutral\//.test(bg) && bg !== 'white' && bg !== 'black') {
              // Dark tonal text on a chromatic page is a DARK-ramp tone of the text palette.
              const pal = bg.startsWith('Secondary') ? 'Secondary' : 'Primary';
              const tones = Array.from({ length: 12 }, (_, i) => hex(colors[pal][`Color-${i + 1}`].value));
              if (!tones.includes(pageText)) wrong.push(`${tag} page Text ${pageText} is not a dark ${pal} tone`);
            }

            // The cards.
            const levels: string[] = [];
            let cardText = '', cardQuiet = '';
            for (const l of DARK_CARD_LEVELS) {
              const cc = css.computed(cardEl('Default', l)), pc = pv.computed(cardEl('Brand', l));
              const figQuiet = typeof db?.['Container-Text']?.value === 'string' && typeof db?.['Container-Quiet-Opacity']?.value === 'number'
                ? atOpacity(db['Container-Text'].value, db.Container.value, db['Container-Quiet-Opacity'].value) : null;
              for (const [r, fv] of [['--Background', hex(db?.[l]?.value)], ['--Text', hex(db?.['Container-Text']?.value)],
                ['--Header', hex(db?.['Container-Header']?.value)], ['--Quiet', figQuiet]] as const) {
                const cv = hex(cc[r]), pvv = hex(pc[r]);
                if (cv !== pvv) wrong.push(`${tag} ${l} ${r}: CSS ${cv}, preview ${pvv}`);
                if (cv !== fv) wrong.push(`${tag} ${l} ${r}: CSS ${cv}, Figma ${fv}`);
              }
              levels.push(hex(cc['--Background'])!);
              cardText = hex(cc['--Text'])!;
              cardQuiet = hex(cc['--Quiet'])!;
            }

            // Card Quiet: clears every level, in the CSS solid and in Figma's
            // alias + opacity on each level — at the SMALLEST opacity that does.
            const pct = db?.['Container-Quiet-Opacity']?.value as number;
            for (const l of levels) {
              if (contrastRatio(cardQuiet, l) < 4.5) wrong.push(`${tag} CSS card Quiet ${cardQuiet} on ${l} = ${contrastRatio(cardQuiet, l).toFixed(2)}`);
              const f = atOpacity(cardText, l, pct);
              if (contrastRatio(f, l) < 4.5) wrong.push(`${tag} Figma card Quiet ${f} on ${l} = ${contrastRatio(f, l).toFixed(2)}`);
            }
            if (pct < 100) {
              const k = Math.round((pct / 100) * 255);
              const prev = (Math.round(((k - 1) / 255) * 1000) / 1000) * 100;
              const face = levels[2];
              const solidPrev = atOpacity(cardText, face, prev);
              const stillClears = levels.every((l) => contrastRatio(atOpacity(cardText, l, prev), l) >= 4.5 && contrastRatio(solidPrev, l) >= 4.5);
              if (stillClears) wrong.push(`${tag} card Quiet opacity ${pct}% is not the smallest that clears (${prev.toFixed(1)}% does)`);
            }

            // White cards are flat in light mode.
            if (card === 'white' && mode === 'Light') {
              const n12 = hex(colors.Neutral['Color-12'].value)!;
              if (levels[0] !== n12) wrong.push(`${tag} white Container-Lowest ${levels[0]}, want ${n12}`);
              for (const l of levels) if (chroma.distance(l, n12, 'rgb') > 2) wrong.push(`${tag} white card ${l} is not flat (${n12})`);
            }
          }
        }
        expect(wrong.slice(0, 16)).toEqual([]);
      }, 300_000);
    }
  });
}
