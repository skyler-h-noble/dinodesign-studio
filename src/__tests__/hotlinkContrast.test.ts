/**
 * Hotlink and Hotlink-Visited clear 4.5:1 on the background they are drawn on,
 * in the EXPORT — every theme section, both modes, including a locked dark
 * brand color on a Primary page.
 *
 * The 2.44:1 link that prompted this (#0f1c2f on #3c6054) was the PREVIEW, which
 * read an older static map instead of the export's text table; that divergence
 * is covered in tokenParity ("Hotlink and Text-Info agree"). This file guards
 * the published side, so a table edit that breaks a link fails here.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';

const TYPO = {
  header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  decorative: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
  body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
};

function build(colors: [string, string, string], background: string) {
  const l = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const d = (h: string) => generateSemanticDarkModeScale(h);
  return exportColorSystemToJSON(
    generateFullLightPalettes(l(colors[0]) as never, l(colors[1]) as never, l(colors[2]) as never),
    generateFullDarkPalettes(d(colors[0]) as never, d(colors[1]) as never, d(colors[2]) as never),
    background.startsWith('primary') ? 'primary' : 'neutral',
    'primary-fixed' as never,
    { primary: chroma(colors[0]).lch()[0], secondary: chroma(colors[1]).lch()[0], tertiary: chroma(colors[2]).lch()[0] },
    'modern', TYPO as never, 'Hotlink', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: background as never, button: 'primary-fixed' as never, cardColoring: 'tonal' as never, textColoring: 'tonal' as never },
  ) as any;
}

function resolver(json: any, mode: string) {
  const M = json.Modes[mode];
  const res = (v: unknown, depth = 0): string | null => {
    if (depth > 12) return null;
    const val = typeof v === 'string' ? v : (v as { value?: string })?.value;
    if (typeof val !== 'string') return null;
    if (!val.startsWith('{')) return val.startsWith('#') ? val.slice(0, 7) : null;
    let node: any = M;
    for (const k of val.slice(1, -1).split('.')) { node = node?.[k]; if (node === undefined) return null; }
    return res(node, depth + 1);
  };
  return res;
}

const CASES: [string, [string, string, string], string][] = [
  // The design system this was found on: a dark locked green on a Primary page.
  ['locked dark green, primary page', ['#3c6054', '#9b3328', '#d4a24c'], 'primary'],
  ['purple, white page', ['#7b3f9d', '#2563eb', '#b8329b'], 'white'],
  ['olive, primary page', ['#6b7a4f', '#c98b7e', '#e0c9a6'], 'primary'],
];

describe('Hotlink clears 4.5:1 on its own background', () => {
  for (const [name, colors, background] of CASES) {
    const json = build(colors, background);
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      it(`${name} — ${mode}`, () => {
        const res = resolver(json, mode);
        const fails: string[] = [];
        let checked = 0;
        for (const [tn, theme] of Object.entries<any>(json.Modes[mode].Themes))
          for (const [sn, section] of Object.entries<any>(theme)) {
            const bg = res(section?.Background);
            if (!bg) continue;
            for (const role of ['Hotlink', 'Hotlink-Visited']) {
              const fg = res(section[role]);
              if (!fg) continue;
              checked++;
              const r = chroma.contrast(bg, fg);
              if (r < 4.5) fails.push(`${tn}/${sn} ${role} ${fg} on ${bg} = ${r.toFixed(2)}`);
            }
          }
        expect(checked).toBeGreaterThan(50);
        expect(fails).toEqual([]);
      });
    }
  }
});
