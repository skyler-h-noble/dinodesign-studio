/**
 * The CSS mode sheets and the Figma payload must paint the same chart colors
 * (invariant 5) — the Charts add-on emits code that reads --Chart-N and a
 * Figma build that reads the Chart collection, and a user compares the two.
 *
 * Both now come from solveChartPalette(). This asserts the RESULT, per ground
 * and per mode, rather than trusting the shared function: parity is a claim
 * about what each side emits.
 */
import { describe, it, expect } from 'vitest';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { chartGroundCSS } from '../utils/cssgen/exportToCSS';
import { fromLch } from '../utils/chartPalette';

function ramp(hue: number, chroma: number) {
  const out: any = {};
  for (let n = 1; n <= 12; n++) {
    const L = 8 + (n - 1) * (92 - 8) / 11;
    const C = chroma * Math.sin((Math.PI * (n - 1)) / 11);
    out[`Color-${n}`] = { value: fromLch(L, C, hue), type: 'color' };
  }
  return out;
}
const PALETTES: Record<string, [number, number]> = {
  Primary: [115, 40], Secondary: [23, 45], Tertiary: [64, 48], Neutral: [0, 0],
  Error: [30, 65], Warning: [77, 60], Success: [150, 55], Info: [289, 70],
};
const colors = () => Object.fromEntries(Object.entries(PALETTES).map(([n, [h, c]]) => [n, ramp(h, c)]));
const backgrounds = (bgKey: string, bright: string, dim: string) => Object.fromEntries(
  Object.keys(PALETTES).map((p) => [p, { [bgKey]: { Surfaces: { 'Surface-Brightest': bright, 'Surface-Dimmest': dim } } }]),
);
const SYSTEM = {
  Metadata: { 'Default-Settings': { 'Default-Theme': { Theme: { value: 'Primary' }, N: { value: 12 } } } },
  Modes: {
    'Light-Mode': { Colors: colors(), Backgrounds: backgrounds('Background-12', '#ffffff', '#1a1a1a') },
    'Dark-Mode': { Colors: colors(), Backgrounds: backgrounds('Background-2', '#f2f2f2', '#121212') },
  },
};

/** The declarations inside one [data-surface="…"] rule. */
function rule(css: string, level: string): Record<string, string> {
  const m = css.match(new RegExp(`\\[data-surface="${level}"\\] \\{([^}]*)\\}`));
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const d of m[1].split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return out;
}

describe('chart colors: CSS mode sheets == Figma payload', () => {
  const figma = generateFigmaJSON(SYSTEM as any);

  for (const mode of ['Light-Mode', 'Dark-Mode']) {
    const css = chartGroundCSS(SYSTEM, mode);
    for (const level of ['Surface-Brightest', 'Surface-Dimmest']) {
      it(`${mode} / ${level}: Chart-5..10 are the payload's hexes`, () => {
        const decl = rule(css, level);
        const payload = figma.Modes[mode].Chart[level];
        for (let n = 5; n <= 10; n++) {
          expect(decl[`--Chart-${n}`], `${mode}/${level}/Chart-${n}`).toBe(payload[`Color-${n}`].value);
        }
      });

      /* The brand four are the SOLVED tones too, as the Figma Chart collection
         now links them (.Modes/Chart/{ground}/Color-1..4). They were the
         surface's Icons — the solver's rejected first approach — while 5..10
         were solved around different brand picks, so the drawn set was one
         nobody had solved for (Surf's Up: closest pair 2.9 drawn vs 3.8 solved). */
      it(`${mode} / ${level}: the brand four are the payload's solved hexes`, () => {
        const decl = rule(css, level);
        const payload = figma.Modes[mode].Chart[level];
        for (const n of [1, 2, 3, 4]) {
          expect(decl[`--Chart-${n}`], `${mode}/${level}/Chart-${n}`).toBe(payload[`Color-${n}`].value);
        }
        expect(decl['--Chart-Lines']).toBeDefined();
        // The state four follow it too — Chart/Colors/{State} aliases Icons/{State}.
        expect(['Info', 'Success', 'Warning', 'Error'].map((st) => decl[`--Chart-${st}`])).toEqual([
          'var(--Icons-Info)', 'var(--Icons-Success)', 'var(--Icons-Warning)', 'var(--Icons-Error)',
        ]);
      });
    }
  }

  it('scopes to the two chart grounds only', () => {
    const css = chartGroundCSS(SYSTEM, 'Light-Mode');
    const selectors = css.match(/\[data-surface="[^"]+"\]/g) || [];
    expect([...new Set(selectors)].sort()).toEqual(['[data-surface="Surface-Brightest"]', '[data-surface="Surface-Dimmest"]']);
  });
});
