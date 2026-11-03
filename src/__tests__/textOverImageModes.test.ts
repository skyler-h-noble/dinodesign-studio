/**
 * text-over-image.css: one floor per theme PER MODE.
 *
 * The published file solved every floor from Light-Mode colors only. Its paint
 * follows var(--Background), which flips with the mode sheet, but the opacity
 * did not — so in dark mode the scrim protected colors that were not on the
 * page. Measured on a published portfolio system: its Tertiary theme's
 * light-mode floor of 0.86 leaves the dark-mode --Eyebrow at 3.80:1 over a
 * white backdrop, against the 4.5 it owes; dark mode needs 0.95.
 *
 * The Default theme was missing too: its colors are assembled inside the CSS
 * export and never appear resolved in tokens.json, so the token-based path
 * skipped it without a word and an element with no data-theme had no scrim.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import {
  MODE_SWITCH_VAR,
  TEXT_OVER_IMAGE_ROLES,
  buildTextOverImageCSSFromModeSheets,
  readModeSheetThemes,
  solveModeScrims,
  solveThemeScrims,
  solveWorstCaseScrim,
} from '../utils/cssgen/generateTextOverImage';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme } from '../types';

// ── Contrast, written out again here so the test does not trust the solver ──
const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lumOf = (ch: number[]) => {
  const c = ch.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const lum = (hex: string) => lumOf(channels(hex));
/** Worst contrast of `fg` over a `bg` scrim at `alpha`, over black or white. */
function worstRatio(bg: string, fg: string, alpha: number): number {
  const fgL = lum(fg);
  return Math.min(...[0, 255].map((base) => {
    const L = lumOf(channels(bg).map((v) => v * alpha + base * (1 - alpha)));
    return (Math.max(L, fgL) + 0.05) / (Math.min(L, fgL) + 0.05);
  }));
}

// ── A small pair of mode sheets in the generator's own shape ───────────────
// Default in light: dark text on near-white, the eyebrow the weakest role.
// Default in dark: light text on near-black, the text the weakest role.
const LIGHT = `
@import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');
body { margin: 0; }
:root {
  --Neutral-Color-1: #111111;
  --Neutral-Color-12: #fafafa;
  --Primary-Color-3: #3a2a55;
  --Primary-Color-6: #7b3f9d;
}
/* Theme: Default - Surfaces */
:root,
[data-surface="Surface"],
[data-theme="Default"],
[data-theme="Default"][data-surface="Surface"] {
  --Background: var(--Neutral-Color-12);
  --Text: var(--Neutral-Color-1);
  --Header: #444444;
  --Eyebrow: #6a5a85;
}
[data-theme="Default"] [data-surface="Surface-Dim"],
[data-theme="Default"][data-surface="Surface-Dim"] {
  --Background: #dddddd;
  --Text: var(--Neutral-Color-1);
}
[data-theme="Primary"],
[data-theme="Primary"][data-surface="Surface"] {
  --Background: var(--Primary-Color-6);
  --Text: #ffffff;
  --Header: #f0e0ff;
  --Eyebrow: #e8d8f8;
}
[data-theme="Info"],
[data-theme="Info"][data-surface="Surface"] {
  --Background: #0056af;
  --Text: #ffffff;
}
`;
const DARK = `
:root {
  --Neutral-Color-1: #0b0b0b;
  --Neutral-Color-9: #b0b0b0;
  --Primary-Color-6: #5a3070;
}
:root,
[data-surface="Surface"],
[data-theme="Default"],
[data-theme="Default"][data-surface="Surface"] {
  --Background: var(--Neutral-Color-1);
  --Text: var(--Neutral-Color-9);
  --Header: #e0e0e0;
  --Eyebrow: #d8c8f0;
}
[data-theme="Primary"],
[data-theme="Primary"][data-surface="Surface"] {
  --Background: var(--Primary-Color-6);
  --Text: #ffffff;
  --Header: #ffffff;
  --Eyebrow: var(--Missing, #f4ecff);
}
[data-theme="Info"],
[data-theme="Info"][data-surface="Surface"] {
  --Background: #8a8a8a;
  --Text: #ffffff;
}
`;

const byTheme = (css: [string, string]) =>
  Object.fromEntries(solveModeScrims(...css).map((s) => [s.theme, s]));

describe('reading a mode sheet', () => {
  it('resolves each theme\'s base block through :root, including var() fallbacks', () => {
    const light = readModeSheetThemes(LIGHT);
    const dark = readModeSheetThemes(DARK);
    expect(light.Default.background).toBe('#fafafa');
    expect(light.Default.foregrounds.map((f) => `${f.role} ${f.hex}`))
      .toEqual(['--Text #111111', '--Eyebrow #6a5a85', '--Header #444444']);
    expect(dark.Default.background).toBe('#0b0b0b');
    expect(dark.Default.foregrounds.find((f) => f.role === '--Text')!.hex).toBe('#b0b0b0');
    // A var() whose name is undefined takes its fallback, as CSS does.
    expect(dark.Primary.foregrounds.find((f) => f.role === '--Eyebrow')!.hex).toBe('#f4ecff');
  });

  it('takes the base surface, not a later surface block of the same theme', () => {
    expect(readModeSheetThemes(LIGHT).Default.background).toBe('#fafafa');
  });

  it('puts Default on :root, so an element with no data-theme still gets a floor', () => {
    expect(readModeSheetThemes(LIGHT).Default.selectors).toEqual([':root', '[data-theme="Default"]']);
    expect(readModeSheetThemes(LIGHT).Primary.selectors).toEqual(['[data-theme="Primary"]']);
  });
});

describe('each mode is solved from its own colors', () => {
  it('dark floors come from the dark sheet, light floors from the light sheet', () => {
    const s = byTheme([LIGHT, DARK]);
    const lightOnly = Object.fromEntries(solveThemeScrims(readModeSheetThemes(LIGHT)).map((x) => [x.theme, x.alpha]));
    const darkOnly = Object.fromEntries(solveThemeScrims(readModeSheetThemes(DARK)).map((x) => [x.theme, x.alpha]));
    for (const theme of ['Default', 'Primary']) {
      expect(s[theme].light!.alpha, `${theme} light`).toBe(lightOnly[theme]);
      expect(s[theme].dark!.alpha, `${theme} dark`).toBe(darkOnly[theme]);
    }
  });

  it('the two modes really differ (the case the light-only file got wrong)', () => {
    const s = byTheme([LIGHT, DARK]);
    expect(s.Default.light!.alpha).not.toBe(s.Default.dark!.alpha);
    expect(s.Primary.light!.alpha).not.toBe(s.Primary.dark!.alpha);
  });

  it('every floor is a real floor in its own mode: passes at the value, fails one step below', () => {
    // Independent of the solver: recompute the contrast here.
    for (const [mode, css] of [['light', LIGHT], ['dark', DARK]] as const) {
      const themes = readModeSheetThemes(css);
      for (const s of solveModeScrims(LIGHT, DARK)) {
        const solved = s[mode]!;
        if (!solved.feasible) continue;   // covered by the infeasible test below
        const t = themes[s.theme];
        for (const fg of t.foregrounds) {
          expect(worstRatio(t.background, fg.hex, solved.alpha!), `${mode} ${s.theme} ${fg.role}`)
            .toBeGreaterThanOrEqual(fg.target);
        }
        const driver = t.foregrounds.find((f) => f.role === solved.driver)!;
        expect(worstRatio(t.background, driver.hex, solved.alpha! - 0.01), `${mode} ${s.theme} driver`)
          .toBeLessThan(driver.target);
      }
    }
  });
});

describe('the strictest role wins, in both modes', () => {
  it('each floor is the largest of the per-role floors, and names the role that set it', () => {
    for (const [mode, css] of [['light', LIGHT], ['dark', DARK]] as const) {
      const themes = readModeSheetThemes(css);
      for (const s of solveModeScrims(LIGHT, DARK)) {
        if (!s[mode]!.feasible) continue;
        const t = themes[s.theme];
        const per = t.foregrounds.map((f) => ({ role: f.role, a: solveWorstCaseScrim(t.background, f.hex, f.target).alpha! }));
        const max = Math.max(...per.map((p) => p.a));
        expect(s[mode]!.alpha, `${mode} ${s.theme}`).toBe(max);
        expect(per.find((p) => p.role === s[mode]!.driver)!.a).toBe(max);
      }
    }
  });

  it('a different role can win in each mode', () => {
    const s = byTheme([LIGHT, DARK]);
    expect(s.Default.light!.driver).toBe('--Eyebrow');
    expect(s.Default.dark!.driver).toBe('--Text');
  });

  it('covers Text, Eyebrow and Header, and not Quiet', () => {
    expect(TEXT_OVER_IMAGE_ROLES.map((r) => `${r.role} ${r.target}`))
      .toEqual(['--Text 4.5', '--Eyebrow 4.5', '--Header 3']);
  });
});

describe('the emitted CSS', () => {
  const css = buildTextOverImageCSSFromModeSheets(LIGHT, DARK);
  const s = byTheme([LIGHT, DARK]);

  it('states both floors and picks between them with the mode switch', () => {
    const block = css.slice(css.indexOf('[data-theme="Primary"] {'));
    const l = s.Primary.light!.alpha!;
    const d = s.Primary.dark!.alpha!;
    expect(block).toContain(`--Overlay-Scrim-Light: ${l};`);
    expect(block).toContain(`--Overlay-Scrim-Dark: ${d};`);
    expect(block).toContain(`--Overlay-Scrim: calc(${l} * (1 - var(${MODE_SWITCH_VAR}, 0)) + ${d} * var(${MODE_SWITCH_VAR}, 0));`);
    expect(block).toContain('color-mix(in srgb, var(--Background) calc(var(--Overlay-Scrim) * 100%), transparent)');
  });

  it('the switch expression gives the light floor at 0 (and when unset) and the dark floor at 1', () => {
    const m = /--Overlay-Scrim: calc\(([\d.]+) \* \(1 - var\(--Mode-Dark, 0\)\) \+ ([\d.]+) \* var\(--Mode-Dark, 0\)\);/
      .exec(css.slice(css.indexOf('[data-theme="Primary"] {')))!;
    const at = (k: number) => Number(m[1]) * (1 - k) + Number(m[2]) * k;
    expect(at(0)).toBe(s.Primary.light!.alpha);
    expect(at(1)).toBe(s.Primary.dark!.alpha);
  });

  it('emits Default on :root', () => {
    expect(css).toMatch(/:root,\n\[data-theme="Default"\] \{\n {2}--Overlay-Scrim-Light:/);
  });

  it('never defines the switch itself on :root — that belongs to the mode sheet', () => {
    expect(css).not.toMatch(new RegExp(`:root\\s*\\{[^}]*${MODE_SWITCH_VAR}:`));
    expect(css).toContain(`[data-mode="dark"] { ${MODE_SWITCH_VAR}: 1; }`);
  });

  it('a mode no opacity can satisfy gets a full scrim and says so, not no scrim', () => {
    // White on #8a8a8a is 3.4:1 even with the photo fully covered.
    expect(s.Info.light!.feasible).toBe(true);
    expect(s.Info.dark!.feasible).toBe(false);
    const block = css.slice(css.indexOf('/* Info:'));
    expect(block).toMatch(/^\/\* Info: light set by --Text; dark: no opacity satisfies --Text/);
    expect(block).toContain('--Overlay-Scrim-Dark: 1;');
  });

  it('keeps the component rules', () => {
    expect(css).toContain('.overlay-figure > .overlay-scrim {');
    expect(css).toContain('background: var(--Overlay-Scrim-Paint, transparent);');
  });
});

// ── The real pipeline ──────────────────────────────────────────────────────
// Same fixture darkModeBW.test.ts uses.
const COLORS: [string, string, string] = ['#7b3f9d', '#2563eb', '#b8329b'];
const lightScale = (hex: string) => generateSemanticLightModeScale(hex, undefined, hex);
const darkScale = (hex: string) => generateSemanticDarkModeScale(hex);
const SCHEME = {
  extractedTones: {
    primary: chroma(COLORS[0]).lch()[0],
    secondary: chroma(COLORS[1]).lch()[0],
    tertiary: chroma(COLORS[2]).lch()[0],
  },
  tonePalettes: { primary: lightScale(COLORS[0]), secondary: lightScale(COLORS[1]), tertiary: lightScale(COLORS[2]) },
  darkModeTonePalettes: { primary: darkScale(COLORS[0]), secondary: darkScale(COLORS[1]), tertiary: darkScale(COLORS[2]) },
} as unknown as ColorScheme;

let cached: Record<string, string> | null = null;
const files = () => {
  if (cached) return cached;
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(
      SCHEME.tonePalettes!.primary as never,
      SCHEME.tonePalettes!.secondary as never,
      SCHEME.tonePalettes!.tertiary as never,
    ),
    generateFullDarkPalettes(
      SCHEME.darkModeTonePalettes!.primary as never,
      SCHEME.darkModeTonePalettes!.secondary as never,
      SCHEME.darkModeTonePalettes!.tertiary as never,
    ),
    'neutral',
    'primary-fixed' as never,
    SCHEME.extractedTones,
    'modern',
    {
      header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
    },
    'Text over image', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'default', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' } as never,
  );
  cached = generateCSSFiles(json);
  return cached;
};

describe('on a generated design system', () => {
  it('the export publishes each theme\'s light and dark floor, solved from its own mode sheets', () => {
    const f = files();
    const css = f['text-over-image.css'];
    const s = byTheme([f['Light-Mode.css'], f['Dark-Mode.css']]);
    let checked = 0;
    for (const [theme, solved] of Object.entries<any>(s)) {
      const light = solved.light?.alpha, dark = solved.dark?.alpha;
      if (light == null || dark == null) continue;
      checked++;
      expect(css, `${theme} light`).toContain(`--Overlay-Scrim-Light: ${light};`);
      expect(css, `${theme} dark`).toContain(`--Overlay-Scrim-Dark: ${dark};`);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('the mode sheets carry the switch the floors select on', () => {
    const f = files();
    expect(f['Light-Mode.css']).toMatch(/--Mode-Dark: 0;/);
    expect(f['Dark-Mode.css']).toMatch(/--Mode-Dark: 1;/);
    expect(f['text-over-image.css']).toContain('var(--Mode-Dark, 0)');
  });

  it('publishes Default, which the old export skipped', () => {
    const f = files();
    expect(f['text-over-image.css']).toContain('[data-theme="Default"]');
    const s = byTheme([f['Light-Mode.css'], f['Dark-Mode.css']]);
    expect(s.Default.light?.feasible).toBe(true);
    expect(s.Default.dark?.feasible).toBe(true);
  });

  it('Default\'s dark floor is solved for light text on a dark background', () => {
    const f = files();
    const dark = readModeSheetThemes(f['Dark-Mode.css']).Default;
    const text = dark.foregrounds.find((x) => x.role === '--Text')!;
    expect(lum(dark.background)).toBeLessThan(lum(text.hex));
    const light = readModeSheetThemes(f['Light-Mode.css']).Default;
    const lightText = light.foregrounds.find((x) => x.role === '--Text')!;
    expect(lum(light.background)).toBeGreaterThan(lum(lightText.hex));
  });

  it('at least one theme needs a different floor in dark mode', () => {
    const f = files();
    const diffs = solveModeScrims(f['Light-Mode.css'], f['Dark-Mode.css'])
      .filter((s) => s.light && s.dark && s.light.alpha !== s.dark.alpha);
    expect(diffs.length).toBeGreaterThan(0);
  });
});
