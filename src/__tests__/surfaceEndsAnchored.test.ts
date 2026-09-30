import { describe, it, expect } from 'vitest';
import {
  generateSimplifiedLightModeBackgrounds,
  generateSimplifiedDarkModeBackgrounds,
} from '../utils/cssgen/generateSimplifiedBackgrounds';
import { surfaceWindow } from '../utils/surfaceWindow';

/* The two ends are ANCHORED — the same colour on every background — and that
   property is the whole licence for hoisting them to the theme in Figma. A
   level that changes per background cannot live above the background.

   Nothing asserted this before, which is how the shipped generator (n-2) and
   surfaceWindow's documented rule (locked at 3) disagreed silently for as long
   as they did. */

// Tones 1..12 so toneIndexFor maps tone N straight onto Background-N.
const PALETTE = Array.from({ length: 12 }, (_, i) => ({
  tone: i + 1, color: '#' + String(i + 1).padStart(2, '0').repeat(3),
}));

const ends = (n: number, mode: 'light' | 'dark' = 'light') => {
  const r = mode === 'light'
    ? generateSimplifiedLightModeBackgrounds('#808080', n, PALETTE, true, 'Primary')
    : generateSimplifiedDarkModeBackgrounds('#808080', n, PALETTE, 'Primary');
  return {
    dimmest: r.Surfaces['Surface-Dimmest'].value,
    brightest: r.Surfaces['Surface-Brightest'].value,
  };
};

/** The backgrounds a user can actually land on — backgroundSelection clamps the
 *  core tone to [3, 9], and surfaceWindow's header notes real extracted tones
 *  sit between 5 and 9. */
const SELECTABLE = [5, 6, 7, 8, 9];

describe('the ends do not move with the background', () => {
  it('Surface-Dimmest is one colour across every selectable background', () => {
    const seen = new Set(SELECTABLE.map((n) => ends(n).dimmest));
    expect([...seen]).toEqual(['{Colors.Primary.Color-3}']);
  });

  it('Surface-Brightest is one colour across every selectable background', () => {
    const seen = new Set(SELECTABLE.map((n) => ends(n).brightest));
    expect([...seen]).toEqual(['{Colors.Primary.Color-11}']);
  });

  it('holds in dark mode too', () => {
    /* The theme layer is MODE-INDEPENDENT — one tone index shared by light and
       dark — so an end that differed by mode would unpair every foreground
       table from the backdrop it was solved against. */
    expect(new Set(SELECTABLE.map((n) => ends(n, 'dark').dimmest)).size).toBe(1);
    expect(new Set(SELECTABLE.map((n) => ends(n, 'dark').brightest)).size).toBe(1);
  });

  it('specifically is NOT the old relative rule', () => {
    // n-2 gave Background-9 a Color-7 "dimmest", which is a mid tone. If this
    // ever passes again, the ends have gone back to tracking the row.
    expect(ends(9).dimmest).not.toBe('{Colors.Primary.Color-7}');
    expect(ends(6).dimmest).not.toBe('{Colors.Primary.Color-4}');
  });
});

describe('the squeeze, which is what makes locking safe', () => {
  /* A fixed Color-3 would COLLIDE with Surface-Dim once the surface sits low
     enough that Dim reaches 3 — the exact problem the old relative rule was
     written to avoid. Dimmest steps under Dim instead, then to black. */
  it('steps under Dim rather than colliding with it', () => {
    expect(ends(4).dimmest).toBe('{Colors.Primary.Color-2}');  // Dim is 3
    expect(ends(3).dimmest).toBe('{Colors.Primary.Color-1}');  // Dim is 2
  });

  it('falls to black when there is no tone left below', () => {
    expect(ends(2).dimmest).toBe('#000000');
  });

  it('never equals Surface-Dim at any tone', () => {
    for (let n = 2; n <= 11; n++) {
      const w = surfaceWindow(n);
      const dim = w.find((s) => s.level === 'Surface-Dim')!;
      const dimmest = w.find((s) => s.level === 'Surface-Dimmest')!;
      expect([n, JSON.stringify(dimmest.paint)])
        .not.toEqual([n, JSON.stringify(dim.paint)]);
    }
  });

  it('mirrors at the light end', () => {
    expect(ends(10).brightest).toBe('{Colors.Primary.Color-12}'); // Bright took 11
    expect(ends(11).brightest).toBe('#ffffff');                   // 12 taken too
  });
});

describe('one definition, not two', () => {
  it('the generator agrees with surfaceWindow at every tone', () => {
    /* The generator must READ surfaceWindow rather than restate it. A second
       copy is how the last two drifted, and the drift was invisible because
       both sides were self-consistent. */
    for (let n = 2; n <= 11; n++) {
      const w = surfaceWindow(n);
      const paint = (level: string) => {
        const p = w.find((s) => s.level === level)!.paint;
        return p.kind === 'tone' ? `{Colors.Primary.Color-${p.tone}}`
          : p.kind === 'black' ? '#000000' : '#ffffff';
      };
      expect([n, ends(n).dimmest]).toEqual([n, paint('Surface-Dimmest')]);
      expect([n, ends(n).brightest]).toEqual([n, paint('Surface-Brightest')]);
    }
  });
});
