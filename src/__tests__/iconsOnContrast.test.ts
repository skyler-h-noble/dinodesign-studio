/**
 * --Icons-On-<palette> must carry content at 4.5:1 on --Icons-<palette>.
 *
 * The pair exists so a badge, counter or dot painted in an icon colour has a
 * label colour that is legible ON it. --Icons-<pal> is picked to contrast with
 * the SURFACE, so it can land on any tone of any palette — which means the
 * matching foreground cannot be a fixed token path and has to be resolved.
 * Three producers compute it (exportColorSystem for 17 themes,
 * generateCompleteThemes for Default, generateFigmaJSON for the payload), so
 * this is exactly the shape invariant 5 warns about: they can drift silently
 * and an unresolved var() paints nothing and reports nothing.
 *
 * The test resolves the real var() chains out of the generated stylesheets
 * rather than re-implementing the mapping, and asserts on what it resolves —
 * plus a floor on how many pairs it managed to resolve, so it cannot quietly
 * degrade into checking nothing.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';

const PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
                  'Info', 'Success', 'Warning', 'Error', 'Default'] as const;

function buildCSS(colors: [string, string, string]) {
  const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const dark = (h: string) => generateSemanticDarkModeScale(h);
  const tones = {
    primary: chroma(colors[0]).lch()[0],
    secondary: chroma(colors[1]).lch()[0],
    tertiary: chroma(colors[2]).lch()[0],
  };
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(light(colors[0]) as never, light(colors[1]) as never, light(colors[2]) as never),
    generateFullDarkPalettes(dark(colors[0]) as never, dark(colors[1]) as never, dark(colors[2]) as never),
    'primary', 'primary-fixed' as never, tones, 'modern',
    { header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false } },
    'IconsOn', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'primary' as never, button: 'primary-fixed' as never,
      cardColoring: 'tonal' as never, textColoring: 'tonal' as never },
  );
  (json as unknown as Record<string, unknown>)._userSelections = {
    background: 'primary', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal',
  };
  return generateCSSFiles(json as never) as Record<string, string>;
}

/** Every `--Var: value;` in a stylesheet, last write winning — the globals. */
function flatDecls(css: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, k, v] of css.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) m.set(k, v.trim());
  return m;
}

/** Each `selector { ... }` block with its own declarations. */
function scopes(css: string): { selector: string; decls: Map<string, string> }[] {
  const out: { selector: string; decls: Map<string, string> }[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = flatDecls(body);
    if (decls.size) out.push({ selector: selector.trim(), decls });
  }
  return out;
}

/** Follow var() references until a hex falls out. */
function resolve(value: string, local: Map<string, string>, globals: Map<string, string>, depth = 0): string | null {
  if (!value || depth > 12) return null;
  const v = value.trim();
  if (v.startsWith('#')) return v;
  const m = v.match(/^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!m) return null;
  const next = local.get(m[1]) ?? globals.get(m[1]) ?? m[2];
  return next ? resolve(next, local, globals, depth + 1) : null;
}

const relLum = (hex: string) => {
  const c = chroma(hex).rgb().map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const SCHEMES: [string, [string, string, string]][] = [
  ['brand', ['#8f3767', '#784284', '#cc90d8']],
  ['cool',  ['#1d4e89', '#2a9d8f', '#e9c46a']],
];

describe('--Icons-On-<palette>', () => {
  for (const [name, colors] of SCHEMES) {
    const files = buildCSS(colors);

    for (const mode of ['Light-Mode.css', 'Dark-Mode.css']) {
      it(`${name} / ${mode}: emits an On- token for every palette`, () => {
        const css = files[mode];
        for (const pal of PALETTES) {
          expect(css, `${pal} missing from ${mode}`).toContain(`--Icons-On-${pal}:`);
        }
      });

      it(`${name} / ${mode}: every resolvable pair clears 4.5:1`, () => {
        const css = files[mode];
        const globals = new Map([...flatDecls(files['base.css']), ...flatDecls(css)]);
        const failures: string[] = [];
        let checked = 0;

        for (const { selector, decls } of scopes(css)) {
          for (const pal of PALETTES) {
            const onRaw = decls.get(`--Icons-On-${pal}`);
            const iconRaw = decls.get(`--Icons-${pal}`);
            if (!onRaw || !iconRaw) continue;
            const on = resolve(onRaw, decls, globals);
            const icon = resolve(iconRaw, decls, globals);
            if (!on || !icon) continue;
            checked++;
            const r = contrast(on, icon);
            if (r < 4.5) {
              failures.push(`${selector} --Icons-On-${pal} ${on} on ${icon} = ${r.toFixed(2)}:1`);
            }
          }
        }

        // A floor, so a regression in var-chain shape cannot turn this into a
        // test that resolves nothing and passes.
        expect(checked, 'resolved too few pairs to be meaningful').toBeGreaterThan(20);
        expect(failures).toEqual([]);
      });
    }
  }
});
