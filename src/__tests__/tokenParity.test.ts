/**
 * Token parity — the preview, the exported CSS and the Figma payload must agree.
 *
 * This drives the REAL pipeline. The older parity.test.ts reimplements each
 * mapping inside the test and compares the two copies to each other, so it
 * passes whatever buildPreviewCSS actually does; these tests call
 * buildPreviewCSS / exportColorSystemToJSON / generateFigmaJSON and compare
 * their outputs.
 *
 * Why it matters: every colour bug found this week was preview-side while the
 * export was correct, because the preview carries its own private contrast
 * implementation (getAccessibleTones lives in buildPreviewCSS.ts and is used
 * nowhere else). Nothing failed when they diverged — a person had to notice a
 * periwinkle button. This is the detector.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

// ─── Fixture ─────────────────────────────────────────────────────────────────

/** A scheme built the way ColorStage builds one, so the palettes pass through
 *  the picked colours (see the lockedHex fix in ColorStage). */
function makeScheme(colors: [string, string, string]): ColorScheme {
  const light = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
  const dark = (hex: string) => generateSemanticDarkModeScale(hex);
  return {
    name: 'Test',
    colors,
    extractedTones: {
      primary: chroma(colors[0]).lch()[0],
      secondary: chroma(colors[1]).lch()[0],
      tertiary: chroma(colors[2]).lch()[0],
    },
    tonePalettes: { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) },
    darkModeTonePalettes: { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) },
  } as unknown as ColorScheme;
}

const TYPOGRAPHY = [
  { type: 'header' as const, family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  { type: 'decorative' as const, family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  { type: 'body' as const, family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
];

const BUTTON_MAP: Record<string, string> = {
  primary: 'primary-fixed',
  secondary: 'secondary-fixed',
  tonal: 'tonal-fixed',
  laddered: 'laddered-fixed',
  'black-white': 'black-white',
};

/** Everything downstream of one set of user choices. */
function buildAll(scheme: ColorScheme, sel: UserSelections, mode: 'light' | 'dark') {
  const previewCss = buildPreviewCSS({
    colorScheme: scheme,
    userSelections: sel,
    componentStyle: 'modern',
    mode,
    typographyStyles: TYPOGRAPHY,
  } as never);

  const json = exportColorSystemToJSON(
    generateFullLightPalettes(
      scheme.tonePalettes!.primary as never,
      scheme.tonePalettes!.secondary as never,
      scheme.tonePalettes!.tertiary as never,
    ),
    generateFullDarkPalettes(
      scheme.darkModeTonePalettes!.primary as never,
      scheme.darkModeTonePalettes!.secondary as never,
      scheme.darkModeTonePalettes!.tertiary as never,
    ),
    sel.background === 'primary' || sel.background === 'primary-light' ? 'primary' : 'neutral',
    (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
    scheme.extractedTones,
    'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'Parity', undefined, undefined, undefined, 'light-tonal', undefined,
    {
      background: sel.background as never,
      button: (BUTTON_MAP[sel.button as string] ?? 'primary-fixed') as never,
      cardColoring: sel.cardColoring as never,
      textColoring: sel.textColoring as never,
    },
  );

  return { previewCss, json, figma: generateFigmaJSON(json) };
}

// ─── Readers ─────────────────────────────────────────────────────────────────

/** Last declaration of a token inside a selector block that matches `scope`. */
function previewToken(css: string, scope: RegExp, token: string): string | null {
  let found: string | null = null;
  const blocks = css.split('}');
  for (const block of blocks) {
    const [selector, body] = [block.slice(0, block.indexOf('{')), block.slice(block.indexOf('{') + 1)];
    if (!scope.test(selector)) continue;
    const m = body.match(new RegExp(`--${token}\\s*:\\s*([^;]+);`));
    if (m) found = m[1].trim();
  }
  return found;
}

/** Resolve a {Colors.Palette.Color-N} reference against the exported JSON. */
function resolveRef(value: string, json: Record<string, never>): string {
  let v = value;
  for (let hops = 0; hops < 8 && v.startsWith('{'); hops++) {
    const path = v.slice(1, -1).split('.');
    let node: unknown = json;
    for (const key of path) {
      node = (node as Record<string, unknown>)?.[key];
      if (node === undefined) return v;
    }
    v = typeof node === 'string' ? node : (node as { value?: string })?.value ?? v;
  }
  return v;
}

/** Walk a dotted path through the exported JSON. The export is a deep bag of
 *  token nodes with no shared type, so this is deliberately untyped. */
function at(root: unknown, path: string): any {
  let node: any = root;
  for (const key of path.split('.')) node = node?.[key];
  return node;
}

const norm = (hex: string | null) => {
  if (!hex) return null;
  const h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) return h;
  // Compare colour, not alpha notation: #rrggbbaa and rgb() forms normalise.
  try { return chroma(h).hex().toLowerCase(); } catch { return h; }
};

// ─── The matrix ──────────────────────────────────────────────────────────────

const SCHEME = makeScheme(['#7b3f9d', '#2563eb', '#b8329b']);

const SELECTION_MATRIX: { label: string; sel: UserSelections }[] = [
  { label: 'white bg · tonal cards · primary buttons', sel: { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'primary' } as UserSelections },
  { label: 'white bg · tonal cards · secondary buttons', sel: { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'secondary' } as UserSelections },
  { label: 'white bg · white cards · tonal buttons', sel: { background: 'white', cardColoring: 'white', textColoring: 'black-white', button: 'tonal' } as UserSelections },
  { label: 'black bg · black cards · secondary buttons', sel: { background: 'black', cardColoring: 'black', textColoring: 'black-white', button: 'secondary' } as UserSelections },
  { label: 'primary bg · tonal cards · laddered buttons', sel: { background: 'primary', cardColoring: 'tonal', textColoring: 'black-white', button: 'laddered' } as UserSelections },
];

describe('preview ↔ export ↔ figma parity', () => {
  it.each(SELECTION_MATRIX)('$label — all three pipelines produce output', ({ sel }) => {
    const { previewCss, json, figma } = buildAll(SCHEME, sel, 'light');
    expect(previewCss.length).toBeGreaterThan(1000);
    expect(json).toBeTruthy();
    expect(figma?.Modes).toBeTruthy();
  });

  // The token every colour bug this week landed on.
  //
  // The export nests it under Modes.<mode>.Default-Button.Default.<size>.Button
  // as a {Buttons.<Palette>.<size>.Button} reference, so it has to be resolved
  // against the same JSON before it can be compared to a preview hex.
  it.each(SELECTION_MATRIX)('$label — Default button fill agrees between preview and export', ({ sel }) => {
    const { previewCss, json } = buildAll(SCHEME, sel, 'light');
    const preview = norm(previewToken(previewCss, /\[data-theme="Brand"\]/, 'Buttons-Default-Button'));
    const raw = at(json, 'Modes.Light-Mode.Default-Button.Default.Medium.Button');
    const exported = norm(resolveRef(
      typeof raw === 'string' ? raw : raw?.value ?? '',
      at(json, 'Modes.Light-Mode'),
    ));
    console.log(`  Default-Button  preview=${preview ?? '—'}  export=${exported ?? '—'}`);
    expect(preview).toBeTruthy();
    expect(exported).toBeTruthy();
    expect(exported).toBe(preview);
  });

  // Dark mode pins every button to one tone (Color-10). It has its own set of
  // divergences: the preview used to compute most button tokens from the raw
  // light-mode PC/SC/TC while only a couple of sites honoured the dark tone, so
  // the *last* declaration won and dark buttons landed on the light tone.
  it.each(SELECTION_MATRIX)('$label — dark Default button agrees between preview and export', ({ sel }) => {
    const { previewCss, json } = buildAll(SCHEME, sel, 'dark');
    const raw = at(json, 'Modes.Dark-Mode.Default-Button.Default.Medium.Button');
    const exported = norm(resolveRef(
      typeof raw === 'string' ? raw : raw?.value ?? '',
      at(json, 'Modes.Dark-Mode'),
    ));
    const preview = norm(previewToken(previewCss, /\[data-theme="Brand"\]/, 'Buttons-Default-Button'));
    console.log(`  dark Default-Button  preview=${preview ?? '—'}  export=${exported ?? '—'}`);
    expect(preview).toBeTruthy();
    expect(exported).toBeTruthy();
    expect(preview).toBe(exported);
  });

  // Dark-mode buttons are pinned to Light-Mode Color-8 and baked to a literal
  // hex. Two things can silently break: the bake can run before Hover/Pressed
  // exist (leaving an unresolved "{Modes.Light-Mode.…}" string that ships as a
  // colourless token), and the value can drift from the light ramp.
  it('dark-mode buttons are baked to Light-Mode Color-8 with a dark label', () => {
    const sel = { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'secondary' } as UserSelections;
    const { json } = buildAll(SCHEME, sel, 'dark');
    for (const pal of ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error']) {
      const node = at(json, `Modes.Dark-Mode.Buttons.${pal}.Medium`);
      const slot = (k: string) => String(typeof node?.[k] === 'string' ? node[k] : node?.[k]?.value ?? '');
      const [fill, text, hover, pressed] = ['Button', 'Text', 'Hover', 'Pressed'].map(slot);
      const light8 = String(at(json, `Modes.Light-Mode.Colors.${pal}.Color-8`)?.value ?? '');

      // Every slot is a literal colour — no reference survived the bake.
      for (const [name, v] of [['Button', fill], ['Text', text], ['Hover', hover], ['Pressed', pressed]]) {
        expect(v, `${pal}.${name} should be baked hex, got ${v}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      expect(norm(fill), `${pal} fill should equal Light-Mode Color-8`).toBe(norm(light8));

      // The label is dark, and legible on it.
      expect(chroma(text).luminance()).toBeLessThan(chroma(fill).luminance());
      expect(chroma.contrast(fill, text)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('secondary buttons use the picked secondary colour', () => {
    const sel = { background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'secondary' } as UserSelections;
    const { previewCss } = buildAll(SCHEME, sel, 'light');
    const btn = norm(previewToken(previewCss, /\[data-theme="Brand"\]/, 'Buttons-Default-Button'));
    const picked = norm(SCHEME.colors[1]);
    console.log(`  secondary button=${btn}  picked=${picked}`);
    expect(btn).toBe(picked);
  });
});

// ─── Per-theme parity ────────────────────────────────────────────────────────
//
// The checks above compare at Brand scope only, and that is exactly how a real
// divergence survived: tonal and primary produce the SAME button at Brand scope
// and different buttons everywhere else. The export had tonal collapsed onto
// Primary for every surface (a single global `defaultButtonPalette`) while the
// preview resolved it per surface — invisible to a Brand-scope comparison.
//
// Surface-scoped modes are the whole point of this block, so it walks the
// themed blocks in both stylesheets and compares them directly.

/** Resolve a token inside one [data-theme][data-surface] block. */
function themeToken(css: string, theme: string, token: string): string | null {
  const vars: Record<string, string> = {};
  for (const m of css.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!vars[m[1]]) vars[m[1]] = m[2].trim();
  }
  const deref = (value: string): string => {
    let v = value;
    for (let hop = 0; hop < 10 && v.startsWith('var('); hop++) {
      const name = v.slice(4, v.indexOf(')')).split(',')[0].trim();
      const next = vars[name];
      if (!next || next === v) break;
      v = next;
    }
    return v;
  };
  const block = css.match(
    new RegExp(`\\[data-theme="${theme}"\\]\\[data-surface="Surface"\\][^{]*\\{([^}]*)\\}`),
  );
  if (!block) return null;
  const decl = block[1].match(new RegExp(`--${token}\\s*:\\s*([^;]+);`));
  return decl ? deref(decl[1].trim()) : null;
}

const THEMED = ['Primary', 'Secondary', 'Tertiary'];

describe('per-theme button parity', () => {
  it.each(['primary', 'secondary', 'tonal', 'laddered'])(
    '%s buttons agree between preview and export on every themed surface',
    (buttonMode) => {
      const sel = {
        background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: buttonMode,
      } as UserSelections;
      const { previewCss, json } = buildAll(SCHEME, sel, 'light');
      const exportCss = (generateCSSFiles(json as never) as Record<string, string>)['Light-Mode.css'] ?? '';

      for (const theme of THEMED) {
        const preview = norm(themeToken(previewCss, theme, 'Buttons-Default-Button'));
        const exported = norm(themeToken(exportCss, theme, 'Buttons-Default-Button'));
        console.log(`  ${buttonMode}/${theme}: preview=${preview ?? '—'} export=${exported ?? '—'}`);
        expect(preview, `${buttonMode}/${theme} missing from preview`).toBeTruthy();
        expect(exported, `${buttonMode}/${theme} missing from export`).toBeTruthy();
        expect(exported, `${buttonMode} diverges on the ${theme} surface`).toBe(preview);
      }
    },
  );

  // Guards the specific collapse that hid the bug: a surface-scoped mode must
  // actually differ across surfaces, or it has silently become a fixed mode.
  it.each(['tonal', 'laddered'])('%s resolves to a different button per surface', (buttonMode) => {
    const sel = {
      background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: buttonMode,
    } as UserSelections;
    const { json } = buildAll(SCHEME, sel, 'light');
    const exportCss = (generateCSSFiles(json as never) as Record<string, string>)['Light-Mode.css'] ?? '';
    const fills = THEMED.map((t) => norm(themeToken(exportCss, t, 'Buttons-Default-Button')));
    console.log(`  ${buttonMode} per surface: ${fills.join(' ')}`);
    expect(new Set(fills).size, `${buttonMode} gave the same fill on every surface`).toBe(THEMED.length);
  });

  it.each(['primary', 'secondary'])('%s resolves to one button on every surface', (buttonMode) => {
    const sel = {
      background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: buttonMode,
    } as UserSelections;
    const { json } = buildAll(SCHEME, sel, 'light');
    const exportCss = (generateCSSFiles(json as never) as Record<string, string>)['Light-Mode.css'] ?? '';
    const fills = THEMED.map((t) => norm(themeToken(exportCss, t, 'Buttons-Default-Button')));
    expect(new Set(fills).size, `${buttonMode} should not vary by surface`).toBe(1);
  });
});
