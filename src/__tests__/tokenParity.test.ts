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
import { buildAccessibilityReport } from '../utils/accessibilityReport';
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

  // generateDesignSystem attaches this before calling the Figma generator.
  // Omitting it makes every palette lookup fall back to Primary, so the
  // harness reports divergences the real pipeline does not have.
  (json as unknown as Record<string, unknown>)._userSelections = {
    background: sel.background, button: sel.button,
    cardColoring: sel.cardColoring, textColoring: sel.textColoring,
  };
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

/** A brand whose Primary Color-6 carries a LIGHT label.
 *
 *  Every other fixture is deep purple, where keying the hover/pressed
 *  direction on the tone index and on the label give the same answer — which
 *  is exactly why a real divergence survived a green suite. This olive is the
 *  case that tells them apart: its Color-6 lands at L=49 rather than 58, so
 *  its text table flips at 7, and an index-keyed rule steps INTO the label. */
const OLIVE_SCHEME = makeScheme(['#6b7a4f', '#c98b7e', '#e0c9a6']);

const BRANDS: { label: string; scheme: ColorScheme }[] = [
  { label: 'purple', scheme: SCHEME },
  { label: 'olive', scheme: OLIVE_SCHEME },
];

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
    const picked = norm(SCHEME.colors[1])!;
    console.log(`  secondary button=${btn}  picked=${picked}`);
    expect(btn).toBeTruthy();

    // Not byte-identical to the pick. A locked colour whose slot cannot carry
    // 4.5:1 is moved in LIGHTNESS ONLY — hue and chroma are preserved, and the
    // UI tells the user it was adjusted. #2563eb is exactly that case: it sits
    // at L=46 but lands in the Color-5 slot, and at its picked lightness the
    // Quiet pairing measures 4.48.
    //
    // So the thing worth asserting is that the button is still the SECONDARY
    // colour — same hue, and not the primary — rather than the same bytes.
    const hueOf = (hex: string) => chroma(hex).lch()[2];
    const dHue = Math.abs(((hueOf(btn!) - hueOf(picked) + 540) % 360) - 180);
    expect(dHue, `button ${btn} is a different hue from the pick ${picked}`).toBeLessThan(8);
    expect(btn, 'secondary button fell back to the primary colour')
      .not.toBe(norm(SCHEME.colors[0]));
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
const BUTTON_SLOTS = ['Button', 'Text', 'Border', 'Hover', 'Pressed'];

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
        // Every slot, not only the fill. Comparing Button alone let a
        // dark-mode Border divergence sit unnoticed: the two implementations
        // agreed on the fill and disagreed on the edge.
        for (const slot of BUTTON_SLOTS) {
          const token = `Buttons-Default-${slot}`;
          const preview = norm(themeToken(previewCss, theme, token));
          const exported = norm(themeToken(exportCss, theme, token));
          if (preview === null && exported === null) continue;
          expect(preview, `${buttonMode}/${theme}/${slot} missing from preview`).toBeTruthy();
          expect(exported, `${buttonMode}/${theme}/${slot} missing from export`).toBeTruthy();
          expect(exported, `${buttonMode} diverges on ${theme}/${slot}`).toBe(preview);
        }
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

// Run the whole per-theme comparison against the olive brand too. It differs
// from purple in exactly one way that matters — where its text table flips —
// and that difference is invisible to every other fixture.
describe('per-theme button parity — olive primary', () => {
  it.each(['primary', 'secondary', 'tonal', 'laddered', 'black-white'])(
    '%s agrees between preview and export on every themed surface',
    (buttonMode) => {
      const sel = {
        background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: buttonMode,
      } as UserSelections;
      for (const mode of ['light', 'dark'] as const) {
        const { previewCss, json } = buildAll(OLIVE_SCHEME, sel, mode);
        const file = mode === 'light' ? 'Light-Mode.css' : 'Dark-Mode.css';
        const exportCss = (generateCSSFiles(json as never) as Record<string, string>)[file] ?? '';
        for (const theme of THEMED) {
          for (const slot of BUTTON_SLOTS) {
            const token = `Buttons-Default-${slot}`;
            const preview = norm(themeToken(previewCss, theme, token));
            const exported = norm(themeToken(exportCss, theme, token));
            if (preview === null && exported === null) continue;
            expect(exported, `${buttonMode}/${mode}/${theme}/${slot} diverges`).toBe(preview);
          }
        }
      }
    },
  );
});

// ─── Rules, not fixtures ─────────────────────────────────────────────────────
//
// The tests above compare two implementations to each other, so they only fail
// when the two disagree. These state what the output must be true of, so they
// still fail when both sides are wrong in the same way.

const contrast = (a: string, b: string): number => {
  const l1 = chroma(a).luminance();
  const l2 = chroma(b).luminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const MODES = ['light', 'dark'] as const;
const ALL_BUTTON_MODES = ['primary', 'secondary', 'tonal', 'laddered', 'black-white'];

/** Every button slot for one theme, read out of the exported CSS. */
function buttonSlots(css: string, theme: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const slot of BUTTON_SLOTS) out[slot] = norm(themeToken(css, theme, `Buttons-Default-${slot}`));
  out.Background = norm(themeToken(css, theme, 'Background'));
  return out;
}

function exportCssFor(scheme: ColorScheme, sel: UserSelections, mode: 'light' | 'dark') {
  const { json } = buildAll(scheme, sel, mode);
  const file = mode === 'light' ? 'Light-Mode.css' : 'Dark-Mode.css';
  return { css: (generateCSSFiles(json as never) as Record<string, string>)[file] ?? '', json };
}

describe('black-white is a rule, not a palette', () => {
  // "black buttons on light tones and white buttons on dark tones — the fill
  // and the border should be the same and the text the inverse."
  //
  // Stated as a property so it holds for a brand nobody wrote a fixture for.
  // The preview used to swap this style out for Laddered in dark mode, which
  // no fixture comparison could catch, because both sides were read from the
  // same swapped-out style.
  it.each(BRANDS.map((b) => b.label))('%s honours the black-white contract', (label) => {
    const scheme = BRANDS.find((b) => b.label === label)!.scheme;
    const sel = {
      background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'black-white',
    } as UserSelections;

    for (const mode of MODES) {
      const { css } = exportCssFor(scheme, sel, mode);
      for (const theme of THEMED) {
        const s = buttonSlots(css, theme);
        const where = `${label}/${mode}/${theme}`;
        expect(s.Button, `${where}: no fill`).toBeTruthy();

        // The fill is black or white — nothing in between.
        const fillLum = chroma(s.Button!).luminance();
        expect(
          fillLum < 0.02 || fillLum > 0.7,
          `${where}: fill ${s.Button} is neither black nor white (luminance ${fillLum.toFixed(3)})`,
        ).toBe(true);

        // The border IS the fill.
        expect(s.Border, `${where}: border should equal the fill`).toBe(s.Button);

        // The text is the inverse — a black button carries a light label.
        const textIsLight = chroma(s.Text!).luminance() > fillLum;
        expect(textIsLight, `${where}: text ${s.Text} is not the inverse of fill ${s.Button}`)
          .toBe(fillLum < 0.5);
        expect(contrast(s.Button!, s.Text!), `${where}: label contrast`).toBeGreaterThanOrEqual(4.5);

        // The face follows the SURFACE: black lands on a light tone.
        if (s.Background) {
          const bgIsLight = chroma(s.Background).luminance() > 0.18;
          expect(fillLum < 0.5, `${where}: ${bgIsLight ? 'light' : 'dark'} surface ${s.Background} got fill ${s.Button}`)
            .toBe(bgIsLight);
          expect(contrast(s.Button!, s.Background), `${where}: fill vs surface`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('hover and pressed never read worse than the resting button', () => {
  // "So if it passes at the default button it should pass at hover and
  // pressed." Both states move ALONG the ramp away from the label, so the
  // label's contrast is preserved or grows — but the direction is computed,
  // and computing it from the tone index instead of the label silently
  // reversed it on brands whose text table flips somewhere other than 6.
  it.each(ALL_BUTTON_MODES)('%s keeps its label legible in both states', (buttonMode) => {
    const sel = {
      background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: buttonMode,
    } as UserSelections;

    for (const brand of BRANDS) {
      for (const mode of MODES) {
        const { css } = exportCssFor(brand.scheme, sel, mode);
        for (const theme of THEMED) {
          const s = buttonSlots(css, theme);
          if (!s.Button || !s.Text) continue;
          const resting = contrast(s.Button, s.Text);
          for (const state of ['Hover', 'Pressed']) {
            const hex = s[state];
            if (!hex) continue;
            const where = `${buttonMode}/${brand.label}/${mode}/${theme}/${state}`;
            const ratio = contrast(hex, s.Text);
            // The state must not be a no-op either: a clamp that returned the
            // fill itself made the button look dead on press and still passed
            // every contrast check.
            expect(hex, `${where}: state is identical to the resting fill`).not.toBe(s.Button);
            if (resting >= 4.5) {
              expect(ratio, `${where}: ${ratio.toFixed(2)} vs resting ${resting.toFixed(2)}`)
                .toBeGreaterThanOrEqual(4.5);
            } else {
              // Resting already fails; the state must at least not be worse.
              expect(ratio, `${where}: ${ratio.toFixed(2)} below resting ${resting.toFixed(2)}`)
                .toBeGreaterThanOrEqual(resting - 0.01);
            }
          }
        }
      }
    }
  });
});

describe('the accessibility floor holds across brands', () => {
  // The value proposition is "no failing WCAG allowed", so this asserts the
  // floor over a spread of hues rather than the one brand a fixture happens to
  // use. A single-brand check reported 4.83 while the real floor was 4.54.
  const SWEEP: [string, string, string][] = [
    ['#7b3f9d', '#2563eb', '#b8329b'],
    ['#6b7a4f', '#c98b7e', '#e0c9a6'],
    ['#2563eb', '#0f766e', '#eab308'],
    ['#d92b2b', '#1e3a8a', '#84cc16'],
    ['#0891b2', '#7c2d12', '#f97316'],
    ['#22c55e', '#a855f7', '#0ea5e9'],
  ];

  it('every text check clears 4.5:1 on every brand', () => {
    let worst = Infinity;
    let worstAt = '';
    let checked = 0;
    const failures: string[] = [];

    for (const colors of SWEEP) {
      const scheme = makeScheme(colors);
      for (const entry of SELECTION_MATRIX) {
        const { json } = buildAll(scheme, entry.sel, 'light');
        for (const section of buildAccessibilityReport(json)) {
          for (const check of section.checks) {
            checked++;
            if (check.ratio < worst) {
              worst = check.ratio;
              worstAt = `${colors[0]} · ${entry.label} · ${section.mode}/${section.surfaceLevel} · ${check.token}`;
            }
            if (!check.passes) {
              failures.push(
                `${colors[0]} · ${entry.label} · ${section.surfaceLevel} · ${check.token}: `
                + `${check.ratio.toFixed(2)} < ${check.required} (${check.fgColor} on ${check.bgColor})`,
              );
            }
          }
        }
      }
    }

    console.log(`  accessibility sweep: ${checked} checks, floor ${worst.toFixed(2)} at ${worstAt}`);
    expect(checked, 'the sweep produced no checks at all').toBeGreaterThan(1000);
    expect(failures.slice(0, 10).join('\n'), `${failures.length} checks below their threshold`).toBe('');
  });
});

describe('Text.Surfaces stays a reference table', () => {
  // Every cell must be a {…} reference into Colors. A baked hex here is how the
  // Figma payload and the CSS drift apart: Figma binds the variable it is
  // pointed at, so a literal silently becomes a detached value that no longer
  // follows its palette.
  it.each(BRANDS.map((b) => b.label))('%s emits no raw hex in Text.Surfaces', (label) => {
    const scheme = BRANDS.find((b) => b.label === label)!.scheme;
    const sel = {
      background: 'white', cardColoring: 'tonal', textColoring: 'tonal', button: 'primary',
    } as UserSelections;
    const { json } = buildAll(scheme, sel, 'light');

    const raw: string[] = [];
    for (const modeName of ['Light-Mode', 'Dark-Mode']) {
      const surfaces = at(json, `Modes.${modeName}.Text.Surfaces`);
      if (!surfaces) continue;
      for (const [palette, tones] of Object.entries<any>(surfaces)) {
        for (const [tone, cell] of Object.entries<any>(tones ?? {})) {
          const value = typeof cell === 'string' ? cell : cell?.value;
          if (typeof value !== 'string') continue;
          // BW is the documented exception: it is defined as black-or-white,
          // so it has no palette to reference.
          if (palette === 'BW' || palette === 'BW-Button') continue;
          if (!value.startsWith('{')) {
            raw.push(`${modeName}.Text.Surfaces.${palette}.${tone} = ${value}`);
          }
        }
      }
    }
    expect(raw.slice(0, 10).join('\n'), `${raw.length} raw values in Text.Surfaces`).toBe('');
  });
});
