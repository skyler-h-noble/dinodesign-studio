/**
 * --Icons-On-<palette> must carry content at 4.5:1 on --Icons-<palette>.
 *
 * The pair exists so a badge, counter or dot painted in an icon color has a
 * label color that is legible ON it. --Icons-<pal> is picked to contrast with
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
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
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

/**
 * The PREVIEW must emit the Icons collection too.
 *
 * It emitted none of it — not --Icons-Primary, not the -Variant, not On-*. The
 * export gets all 27 free because processTokens walks the theme JSON; the
 * preview builds its tokens by hand, so a key nobody names is simply absent.
 * Nothing reported it: there is no unresolved var() to see, the export just
 * painted icons from the brand while the preview inherited --Text. Invariant 5,
 * in the form where both sides are self-consistent.
 *
 * Asserting EXISTENCE is not enough (invariant 7 — parity is not correctness),
 * so these also resolve the preview's own var() chains and hold them to the same
 * 4.5:1 the export is held to above.
 */
function previewCSSFor(colors: [string, string, string], mode: 'light' | 'dark'): string {
  const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const dark = (h: string) => generateSemanticDarkModeScale(h);
  return buildPreviewCSS({
    colorScheme: {
      colors,
      extractedTones: {
        primary: chroma(colors[0]).lch()[0],
        secondary: chroma(colors[1]).lch()[0],
        tertiary: chroma(colors[2]).lch()[0],
      },
      tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
      darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
    },
    userSelections: { background: 'primary', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
    componentStyle: 'modern',
    mode,
    typographyStyles: [
      { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    ],
  } as never);
}

describe('the preview emits the Icons collection', () => {
  for (const [name, colors] of SCHEMES) {
    for (const mode of ['light', 'dark'] as const) {
      const css = previewCSSFor(colors, mode);

      it(`${name} / ${mode}: every palette has Icon, Icon-Variant and On-Icon`, () => {
        for (const pal of PALETTES) {
          expect(css, `--Icons-${pal} missing`).toContain(`--Icons-${pal}:`);
          expect(css, `--Icons-${pal}-Variant missing`).toContain(`--Icons-${pal}-Variant:`);
          expect(css, `--Icons-On-${pal} missing`).toContain(`--Icons-On-${pal}:`);
        }
      });

      it(`${name} / ${mode}: On-Icon clears 4.5:1 on its Icon`, () => {
        const globals = flatDecls(css);
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
            if (r < 4.5) failures.push(`${selector} --Icons-On-${pal} ${on} on ${icon} = ${r.toFixed(2)}:1`);
          }
        }
        expect(checked, 'resolved too few pairs to be meaningful').toBeGreaterThan(8);
        expect(failures).toEqual([]);
      });

      it(`${name} / ${mode}: every accent Icon clears 3:1 on its surface`, () => {
        /* Icons carry meaning, so WCAG 1.4.11 applies — the same 3:1 a Border
           gets, which is why the icon tones mirror Border's exactly.
           The eight ACCENTS only. Icons-Default is excluded on purpose: it is
           defined as tracking --Text rather than as an independent color, so
           its ratio is --Text's ratio and testing it here would just restate
           whatever --Text does. The contract it actually owes is the next
           test. */
        const globals = flatDecls(css);
        const failures: string[] = [];
        let checked = 0;
        for (const { selector, decls } of scopes(css)) {
          const bgRaw = decls.get('--Background');
          if (!bgRaw) continue;
          const bg = resolve(bgRaw, decls, globals);
          if (!bg) continue;
          for (const pal of PALETTES) {
            if (pal === 'Default') continue;
            const iconRaw = decls.get(`--Icons-${pal}`);
            if (!iconRaw) continue;
            const icon = resolve(iconRaw, decls, globals);
            if (!icon) continue;
            checked++;
            const r = contrast(icon, bg);
            if (r < 3) failures.push(`${selector} --Icons-${pal} ${icon} on ${bg} = ${r.toFixed(2)}:1`);
          }
        }
        // Eight: the accents, in the one scope that defines both --Background
        // and the Icons tokens. A floor, so a change in var-chain shape cannot
        // turn this into a test that resolves nothing and passes.
        expect(checked, 'resolved too few icons to be meaningful').toBeGreaterThanOrEqual(8);
        expect(failures).toEqual([]);
      });

      it(`${name} / ${mode}: Icons-Default IS --Text, in every scope that sets both`, () => {
        /* Not an accent. Icons-Default tracks --Text — verified across all 20
           themes, and the reason the export routes it through
           Default-Background rather than the Icon table.
           This is asserted as EQUALITY rather than as a contrast ratio because
           equality is the contract; a ratio test here would pass or fail on
           --Text's own correctness. (It currently fails: with real extracted
           tones and background=primary the preview emits --Background, --Text
           and --Quiet all at Primary-Color-5. That is a --Text bug, upstream of
           the Icons collection, and this test deliberately does not hide it.) */
        const globals = flatDecls(css);
        const mismatches: string[] = [];
        let checked = 0;
        for (const { selector, decls } of scopes(css)) {
          const textRaw = decls.get('--Text');
          const defRaw = decls.get('--Icons-Default');
          if (!textRaw || !defRaw) continue;
          const text = resolve(textRaw, decls, globals) ?? textRaw;
          const def = resolve(defRaw, decls, globals) ?? defRaw;
          checked++;
          if (text !== def) mismatches.push(`${selector} --Icons-Default ${def} != --Text ${text}`);
        }
        expect(checked, 'no scope defined both').toBeGreaterThan(0);
        expect(mismatches).toEqual([]);
      });

    }
  }
});

/**
 * No palette scale may be REFERENCED without being DEFINED.
 *
 * This is the guard that should have existed first. The preview referenced five
 * ramps it never defined — Info, Success, Warning, Error and Hotlink-Visited —
 * so --Text-Info, --Header-Error, --Hotlink, --Link and --Hotlink-Visited all
 * resolved to nothing while the export and Figma had the colors. Nothing
 * reported it: an undefined custom property is not an error, the text just
 * inherits.
 *
 * The palette-name pattern is deliberately `[A-Za-z][A-Za-z-]*`, NOT
 * `[A-Za-z]+`. The strict version silently skipped every hyphenated palette,
 * which is exactly how Hotlink-Visited survived a pass that caught the other
 * four — the check excluded it from both sides of the comparison and reported
 * a clean result.
 */
describe('every palette scale the preview references is defined', () => {
  for (const [name, colors] of SCHEMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} / ${mode}: no referenced-but-undefined ramp`, () => {
        const css = previewCSSFor(colors, mode);
        const defined = new Set([...css.matchAll(/--([A-Za-z][A-Za-z-]*)-Color-\d+\s*:/g)].map((m) => m[1]));
        const referenced = new Set([...css.matchAll(/var\(\s*--([A-Za-z][A-Za-z-]*)-Color-\d+\s*\)/g)].map((m) => m[1]));
        expect(referenced.size, 'resolved no references at all').toBeGreaterThan(4);
        expect([...referenced].filter((r) => !defined.has(r)).sort()).toEqual([]);
      });

      it(`${name} / ${mode}: emits no --Link-Hover`, () => {
        /* Links do not change color on hover — the underline thickens instead.
           The preview used to emit a ±1 tone step off Info, which is an INVENTED
           value on text carrying a 4.5:1 requirement. The lib agrees it should
           not exist: Link documents --Link-Hover as intentionally absent, and
           Breadcrumbs was fixed specifically to stop reading "a variable nothing
           defines". Defining it in the preview only made the playground
           disagree with both. */
        expect(previewCSSFor(colors, mode)).not.toContain('--Link-Hover');
      });
    }
  }
});
