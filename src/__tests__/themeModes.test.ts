import { describe, it, expect } from 'vitest';
import {
  THEME_MODES, THEME_PALETTES, CSS_ONLY_THEMES, CSS_THEME_NAMES,
  STATE_THEME_TONE, REMOVED_THEME_SHADES,
} from '../utils/themes';
import { themeOrder } from '../utils/generateFigmaJSON';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* The two sides had drifted and neither could see it, because each was
   self-consistent: Figma named nine modes and the generator produced five of
   them, while CSS emitted thirty-three of which twenty-four named shades that
   no longer existed. data-theme="Info" painted nothing; data-theme="Info-Medium"
   named a theme Figma did not have. Invariant 5, exactly.

   These pin the list in one place and assert that everything reads it. */

describe('the shades are gone', () => {
  it('names no -Light, -Medium or -Dark theme', () => {
    for (const name of [...THEME_MODES, ...CSS_THEME_NAMES]) {
      for (const shade of REMOVED_THEME_SHADES) {
        expect(name.endsWith(shade), `${name} still carries ${shade}`).toBe(false);
      }
    }
  });

  it('is nine modes, which is what fits', () => {
    /* Not a round number for its own sake: Figma caps a collection at ten
       modes, and four shades per palette is thirty-three. The cap is the
       reason the shades went, so the count is worth asserting. */
    expect(THEME_MODES).toHaveLength(9);
    expect(THEME_MODES.length).toBeLessThanOrEqual(10);
  });

  it('leads with Default, because the plugin makes the first one the default', () => {
    expect(THEME_MODES[0]).toBe('Default');
  });
});

describe('Figma and CSS read the same list', () => {
  it('every palette Figma has, the CSS emits a selector for', () => {
    for (const palette of THEME_PALETTES) {
      expect(CSS_THEME_NAMES, palette).toContain(palette);
    }
  });

  it('the only extras in CSS are the bars, and that is on purpose', () => {
    /* A bar is a COMPOSITION of a user pick, not a palette. Figma pins a mode
       on the bar's frame and needs no extra mode; CSS has no frame to pin, so
       it needs a name for data-theme. A blunt "the lists must match" test
       would call this a bug, which is why the asymmetry is declared. */
    const extra = CSS_THEME_NAMES.filter((n) => !THEME_PALETTES.includes(n as never));
    expect(extra).toEqual([...CSS_ONLY_THEMES]);
  });

  it('themeOrder keeps every mode and only reorders', () => {
    const ordered = themeOrder('Secondary');
    expect([...ordered].sort()).toEqual([...THEME_MODES].sort());
    expect(ordered[0]).toBe('Default');
    // The user's pick sits second so Figma shows it beside the Default it
    // resolves to.
    expect(ordered[1]).toBe('Secondary');
  });

  it('ignores a pick that is not a theme rather than inventing a mode', () => {
    expect(themeOrder('Nonsense')[1]).toBe('Primary');
    expect(themeOrder(undefined)).toHaveLength(THEME_MODES.length);
  });
});

describe('no generator still names a removed shade', () => {
  /* A SOURCE scan, and that is the point: the drift lived in hand-written
     lists — a map of 31 theme structures, an array of 33 selectors — and
     every one of those entries looked reasonable on its own line. Nothing
     the generators produce at runtime would have caught it, because each
     side produced exactly what its own list said.

     The failure this replaces: Info, Success, Warning and Error were named
     in Figma's mode list and built by nobody, so the collection imported
     four modes short. generateFigmaJSON's own deadNames warning was firing
     into a console no one reads. */
  const FILES = [
    'src/utils/cssgen/exportColorSystem.ts',
    'src/utils/cssgen/exportToCSS.ts',
    'src/utils/generateFigmaJSON.ts',
    'src/utils/buildPreviewCSS.ts',
  ];

  for (const file of FILES) {
    it(`${file} names no shaded theme`, () => {
      /* Comments stripped first. A file is allowed — encouraged — to explain
         what was removed and why; what it may not do is still NAME one in
         code. Scanning raw text made the explanation itself a failure, which
         is a good way to get the explanation deleted. */
      const src = readFileSync(resolve(process.cwd(), file), 'utf8')
        .split('\n')
        .filter((line) => {
          const t = line.trim();
          return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
        })
        .join('\n');
      for (const palette of THEME_PALETTES) {
        for (const shade of REMOVED_THEME_SHADES) {
          /* Quoted, so this matches a theme NAME and not the Buttons
             namespace or a comment describing what was removed. Those are
             different things: --Buttons-Info-Light-Button is a button
             variant token, and a sentence explaining the removal has to be
             allowed to say the word. */
          const name = `${palette}${shade}`;
          for (const quoted of [`'${name}'`, `"${name}"`, `data-theme="${name}"`]) {
            expect(src.includes(quoted), `${file} still names ${quoted}`).toBe(false);
          }
        }
      }
    });
  }
});

describe('the state palettes resolve at full strength', () => {
  it('uses the tone the removed -Medium held', () => {
    /* A brand palette's bare theme uses the tone the USER picked. A state
       palette has no pick, so full strength is the bare reading — and
       Surface-Brightest reaches the tint -Light used to name. */
    expect(STATE_THEME_TONE).toBe(6);
  });
});
