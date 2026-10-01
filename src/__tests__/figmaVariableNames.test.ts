/**
 * Every name the payload writes exists in the file — or is listed as not.
 *
 * `populateComponentSize` and its siblings are UPDATE-ONLY: they write by name,
 * and a name the file does not have is skipped **in silence**. So a typo, a
 * rename in Figma, or a value moved to a different group does not fail. It
 * stops updating, keeps whatever was last typed by hand, and reports success.
 *
 * This repo has that written down four times over — the `Accordian` misspelling
 * that had to be matched deliberately, `Dropdown-Frame-Radius` moving from
 * Other to Menu, `Card-Focus-Border-Radius` that "would have matched nothing",
 * and the whole `Components` collection that named nothing at all. Four
 * instances is a missing check.
 *
 * figmaCollectionNames.test.ts does this at COLLECTION level. This is the same
 * check one level down, at variable level, for the two collections whose names
 * the studio computes rather than copies.
 */
import { describe, it, expect } from 'vitest';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { typographyTokensCSS } from '../utils/typographyTokens';
import FILE from './__fixtures__/figmaVariableNames.json';

/* The same shape figmaTypographyEmission uses. _componentStyle is required or
   the whole Component-Size branch is skipped — which is how the Desktop button
   write went unverified the first time that suite was written. */
const DS = {
  Typography: {
    'Set-Font-Family-Header': { value: 'Fraunces' },
    'Set-Font-Family-Body': { value: 'IBM Plex Sans' },
    'Set-Font-Family-Decorative': { value: 'Fraunces' },
  },
  _componentStyle: {
    buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
    bevelOpacity: 50, shadowResolution: 3, bevel: 20,
    buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
  },
};

const out = generateFigmaJSON(DS as never, typographyTokensCSS) as Record<string, any>;

/** Every variable name the payload writes into one collection, across all modes. */
function written(collection: string, skip: RegExp): string[] {
  const bag = out[collection] ?? {};
  const names = new Set<string>();
  for (const mode of Object.keys(bag))
    for (const n of Object.keys(bag[mode])) if (!skip.test(n)) names.add(n);
  return [...names].sort();
}

/**
 * Names the payload writes that the file does not have.
 *
 * NOT a pass. Each of these is silently skipped on import, so the value the
 * studio computes never reaches Figma and the variable — where one exists under
 * another name — keeps whatever was typed. Listed rather than asserted away so
 * the set cannot grow without someone deciding it should.
 *
 * Both are variables to CREATE in Figma, decided 2026-09-29. `Modal-Padding`
 * came off the retired `Components` collection; `Nav-Bar Height` has been
 * emitted into nothing for as long as the diff reaches, beside an
 * `Other/App-Bar-Height` and `Other/Rail-Width` that both exist.
 *
 * Four others were on this list and were taken OUT of the payload instead,
 * which is the other way to resolve an entry and usually the better one:
 *
 *   Input-Swatch-Radius        web-only — nothing in Figma draws a swatch in
 *                              an input, though Select.js reads the token
 *   Button-Text                covered by Dynamic-Button-Font-Size; the file
 *                              has Button-Text-Padding with no Button-Text
 *   Modal-Inner-Radius         a modal does not take focus, so the ring these
 *   Modal-Focus-Radius         describe is never drawn
 *   Button-Icon-Inner-Radius   not wanted; the icon button has a radius and a
 *                              focus radius and needs no inner one
 *
 * Each still exists in computeRadii for the CSS. The rule that emerged: a
 * missing name is a gap only if Figma DRAWS the thing it measures.
 */
const MISSING_FROM_FILE: Record<string, string[]> = {
  /* Empty, and worth keeping as a list rather than deleting the mechanism.
     Every name the payload writes now exists in the file. The previous entries
     were all of one kind — the fixture lagging a rename or an addition someone
     had already made in Figma (`App-Bar Height` -> `App-Bar-Height`, the six
     `List-item/*` names, `Modal-Padding`, `Nav-Bar Height`) — and each carried a
     note saying to refresh the snapshot and drop the line. Refreshed 2026-10-01,
     so they are dropped.
     A name belongs here only when the payload deliberately writes something the
     file does not have yet. Anything else means the import is silently skipping
     it, which is the failure this whole suite exists to catch. */
  'Component-Size': [],
  'Devices-Type': [],
};

describe('the payload writes names the file actually has', () => {
  const SKIP: Record<string, RegExp> = {
    /* Covered by figmaTypographyEmission.test.ts, and large enough to drown the
       signal here: 36 Dynamic-Typography names and 379 Typography ones. */
    'Component-Size': /^Dynamic-Typography\//,
    'Devices-Type': /^Typography\//,
  };

  for (const collection of ['Component-Size', 'Devices-Type'] as const) {
    it(`${collection}: the sample is not empty`, () => {
      /* A payload that failed to build would make every assertion below pass on
         an empty set — the one way this suite could fail open. */
      expect(written(collection, SKIP[collection]).length).toBeGreaterThan(20);
    });

    it(`${collection}: writes nothing the file lacks, beyond the known list`, () => {
      const file = new Set<string>((FILE as unknown as Record<string, string[]>)[collection]);
      const stray = written(collection, SKIP[collection]).filter((n) => !file.has(n));
      expect(stray,
        'These are SILENTLY SKIPPED on import — update-only writers match by ' +
        'name. Create the variable in Figma, fix the name, or add it to ' +
        'MISSING_FROM_FILE with a reason.').toEqual(MISSING_FROM_FILE[collection]);
    });
  }

  it('Devices-Type matches the file exactly', () => {
    /* Stated on its own because it is the collection that came out clean, and
       clean is the state worth defending. Every name the studio computes for a
       device exists; nothing is being dropped. */
    expect(MISSING_FROM_FILE['Devices-Type']).toEqual([]);
  });

  it('no longer writes the retired 24-name bevel form', () => {
    /* Those variables are still in the file and are read by nothing — the
       sixteen Component-Size Highlight/Lowlight aliases point at the
       `*-Bevel` / `*-Bevel-Negative` pairs instead. Writing them kept a dead
       set looking maintained. */
    const dt = written('Devices-Type', /^Typography\//);
    expect(dt.filter((n) => /(High|Low)light/.test(n))).toEqual([]);
    expect(dt).toContain('Button-Bevel');
    expect(dt).toContain('Button-Bevel-Negative');
    expect(dt).toContain('FAB-Bevel');
  });
});
