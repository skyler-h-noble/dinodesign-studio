/**
 * The Default button is a COLOR plus a TONE (utils/buttonChoice.ts).
 *
 * Tonal keeps the chosen color and moves the fill to the tone that clears 3:1
 * against the surface the button sits on. Before this, every preview scope had
 * its own switch on the button mode: "tonal" meant the primary border tone on
 * the page, the SURFACE's palette in the theme blocks, the brand tone on the
 * surface levels, and the page's button on the bars — so a tonal button on a
 * blue Tertiary bar was whatever the page had.
 *
 * Asserted against the real preview CSS: every rule that paints a background
 * and sets a Default button.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { resolveButtonChoice, buttonPaletteFor, buttonForSurface } from '../utils/buttonChoice';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

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

const SEL: UserSelections = {
  background: 'primary-light',
  appBar: 'Tertiary/Surface-Bright',
  navBar: 'Tertiary/Surface',
  status: 'Neutral/Surface-Brightest',
  button: 'primary',
  buttonTone: 'tonal',
  cardColoring: 'tonal',
  textColoring: 'tonal',
  decorativeMode: 'surface-components',
} as UserSelections;

const css = (scheme: ColorScheme, sel: UserSelections, mode: 'light' | 'dark') =>
  buildPreviewCSS({ colorScheme: scheme, userSelections: sel, componentStyle: 'modern', mode, typographyStyles: TYPOGRAPHY } as never);

/** Rules that paint a hex background AND set a hex Default button. */
function paintedRules(text: string): Array<{ selector: string; bg: string; btn: string; border: string }> {
  const out: Array<{ selector: string; bg: string; btn: string; border: string }> = [];
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    const bg = body.match(/--Background:\s*(#[0-9a-fA-F]{6})\b/)?.[1];
    const btn = body.match(/--Buttons-Default-Button:\s*(#[0-9a-fA-F]{6})\b/)?.[1];
    const border = body.match(/--Buttons-Default-Border:\s*(#[0-9a-fA-F]{6,8})\b/)?.[1];
    if (bg && btn && border) out.push({ selector: m[1].trim().split('\n')[0], bg, btn, border });
  }
  return out;
}

const SCHEMES: Array<[string, [string, string, string]]> = [
  ['purple/orange/blue', ['#6b3fa0', '#e07a2e', '#2f6fd6']],
  ['olive/rose/teal', ['#6b7a2a', '#c04a6a', '#1f8a8a']],
];

describe('resolveButtonChoice', () => {
  it('reads the legacy tonal value as primary + tonal', () => {
    expect(resolveButtonChoice('tonal')).toEqual({ color: 'primary', tone: 'tonal' });
  });
  it('defaults to fixed and ignores tone for black-white', () => {
    expect(resolveButtonChoice('secondary')).toEqual({ color: 'secondary', tone: 'fixed' });
    expect(resolveButtonChoice('black-white', 'tonal')).toEqual({ color: 'black-white', tone: 'fixed' });
  });
  it('matches the surface, and Neutral→P', () => {
    expect(['Primary', 'Secondary', 'Tertiary', 'Neutral'].map(s => buttonPaletteFor('match', s as never)))
      .toEqual(['Primary', 'Secondary', 'Tertiary', 'Primary']);
  });
  it('ladders P→S→T→P and Neutral→P', () => {
    expect(['Primary', 'Secondary', 'Tertiary', 'Neutral'].map(s => buttonPaletteFor('laddered', s as never)))
      .toEqual(['Secondary', 'Tertiary', 'Primary', 'Primary']);
  });
});

describe('a Tonal default button clears 3:1 against the surface it sits on', () => {
  for (const [label, colors] of SCHEMES) {
    for (const mode of ['light', 'dark'] as const) {
      for (const button of ['primary', 'secondary', 'match', 'laddered'] as const) {
        it(`${label}, ${mode}, ${button}`, () => {
          const rules = paintedRules(css(makeScheme(colors), { ...SEL, button }, mode));
          expect(rules.length).toBeGreaterThan(0);
          for (const r of rules) {
            const ratio = chroma.contrast(r.btn, r.bg);
            expect(ratio, `${r.selector}: ${r.btn} on ${r.bg}`).toBeGreaterThanOrEqual(3);
            // Tonal: the fill is its own border.
            expect(r.border.toLowerCase(), r.selector).toBe(r.btn.toLowerCase());
          }
        });
      }
    }
  }
});

describe('Fixed keeps one fill and lets the border carry the 3:1', () => {
  it('the same fill on the page and on the bars', () => {
    const rules = paintedRules(css(makeScheme(SCHEMES[0][1]), { ...SEL, buttonTone: 'fixed' }, 'light'));
    expect(new Set(rules.map(r => r.btn.toLowerCase())).size).toBe(1);
  });
});

describe('Match on a Tertiary bar is Tertiary', () => {
  it('in both tones', () => {
    const scheme = makeScheme(SCHEMES[0][1]);
    const tertiary = new Set((scheme.tonePalettes!.tertiary as Array<{ hex: string }>).map(t => t.hex.toLowerCase()));
    for (const buttonTone of ['fixed', 'tonal'] as const) {
      const bar = paintedRules(css(scheme, { ...SEL, button: 'match', buttonTone }, 'light')).find(r => r.selector.includes('App Bar'));
      expect(tertiary.has(bar!.btn.toLowerCase()), buttonTone).toBe(true);
    }
  });
});

describe('Tonal never changes the color', () => {
  it('Primary + Tonal on a Tertiary bar is a Primary tone, not a Tertiary one', () => {
    const scheme = makeScheme(SCHEMES[0][1]);
    const primaryHexes = new Set((scheme.tonePalettes!.primary as Array<{ hex: string }>).map(t => t.hex.toLowerCase()));
    const text = css(scheme, SEL, 'light');
    const bar = paintedRules(text).find(r => r.selector.includes('App Bar'));
    expect(bar).toBeDefined();
    expect(primaryHexes.has(bar!.btn.toLowerCase())).toBe(true);
  });
});

describe('button labels follow Text Coloring', () => {
  const BW = new Set(['#ffffff', '#ffffffb3', '#1a1a1a']);
  for (const mode of ['light', 'dark'] as const) {
    it(`Black & White text → black or white labels, at rest too (${mode})`, () => {
      const text = css(makeScheme(SCHEMES[0][1]), { ...SEL, textColoring: 'black-white', buttonTone: 'fixed' }, mode);
      const labels = [...text.matchAll(/--Buttons-(?:Default|Primary|Secondary|Tertiary)-(?:Text|Quiet):\s*(#[0-9a-fA-F]{6,8})/g)].map(m => m[1].toLowerCase());
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels) expect(BW.has(l), l).toBe(true);
    });
  }
  it('a white Black/White button in dark mode is opaque white with a black label', () => {
    const text = css(makeScheme(SCHEMES[0][1]), { ...SEL, button: 'black-white', textColoring: 'black-white' }, 'dark');
    expect(text).toMatch(/--Buttons-Default-Button: #ffffff;\n\s*--Buttons-Default-Text: #1a1a1a;\n\s*--Buttons-Default-Quiet: #1a1a1a;/);
    expect(text).not.toMatch(/--Buttons-Default-Button: #ffffffb3/);
  });
  it('every scope that sets the surface text also sets an outline label', () => {
    const text = css(makeScheme(SCHEMES[0][1]), SEL, 'dark');
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/^\s*--Text:/m.test(m[2])) continue;
      expect(m[2], m[1].trim().split('\n').pop()).toMatch(/--Buttons-Default-Outline-Text:/);
    }
  });
});

describe('Advanced: the tone per background and level', () => {
  it('a cell tone wins on that cell and leaves the color alone', () => {
    const scheme = makeScheme(SCHEMES[0][1]);
    const primary = new Set((scheme.tonePalettes!.primary as Array<{ hex: string }>).map(t => t.hex.toLowerCase()));
    let cells: Array<{ theme: string; level: string; tone: string; custom: boolean; vars: Record<string, string>; fillContrast: number }> = [];
    buildPreviewCSS({
      colorScheme: scheme, componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
      userSelections: { ...SEL, buttonTone: 'fixed', buttonCellTones: { 'Tertiary/Surface-Bright': 'tonal' } },
      onButtonGrid: (c: typeof cells) => { cells = c; },
    } as never);
    expect(cells).toHaveLength(20);
    const cell = cells.find(c => c.theme === 'Tertiary' && c.level === 'Surface-Bright')!;
    expect([cell.tone, cell.custom]).toEqual(['tonal', true]);
    expect(cell.fillContrast).toBeGreaterThanOrEqual(3);
    expect(cell.vars['--Buttons-Default-Border']).toBe(cell.vars['--Buttons-Default-Button']);
    expect(primary.has(cell.vars['--Buttons-Default-Button'].toLowerCase())).toBe(true);
    const other = cells.find(c => c.theme === 'Tertiary' && c.level === 'Surface')!;
    expect([other.tone, other.custom]).toEqual(['fixed', false]);
  });
  it('buttonForSurface takes the cell tone and the rule color', () => {
    expect(buttonForSurface({ color: 'laddered', tone: 'fixed' }, 'Secondary', 'tonal')).toEqual({ color: 'Tertiary', tone: 'tonal' });
    expect(buttonForSurface({ color: 'black-white', tone: 'fixed' }, 'Primary', 'tonal')).toEqual({ color: 'black-white', tone: 'fixed' });
  });
});

describe('outline labels take the button palette under Tonal text', () => {
  it('a Secondary outline on a Primary page reads a Secondary tone, 4.5:1 on the page', () => {
    const scheme = makeScheme(SCHEMES[0][1]);
    const secondary = new Set((scheme.darkModeTonePalettes!.secondary as Array<{ hex: string }>)
      .concat(scheme.tonePalettes!.secondary as Array<{ hex: string }>).map(t => t.hex.toLowerCase()));
    const text = css(scheme, { ...SEL, button: 'secondary', buttonTone: 'fixed' }, 'light');
    const bars = paintedRules(text);
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const bg = m[2].match(/--Background:\s*(#[0-9a-fA-F]{6})\b/)?.[1];
      const ot = m[2].match(/--Buttons-Default-Outline-Text:\s*(#[0-9a-fA-F]{6})\b/)?.[1];
      const oq = m[2].match(/--Buttons-Default-Outline-Quiet:\s*(#[0-9a-fA-F]{6})\b/)?.[1];
      if (!bg || !ot || !oq) continue;
      expect(secondary.has(ot.toLowerCase()), m[1]).toBe(true);
      expect(secondary.has(oq.toLowerCase()), m[1]).toBe(true);
      expect(chroma.contrast(ot, bg)).toBeGreaterThanOrEqual(4.5);
      expect(chroma.contrast(oq, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(bars.length).toBeGreaterThan(0);
  });
  it('Black & White text keeps the surface Text / Quiet', () => {
    const text = css(makeScheme(SCHEMES[0][1]), { ...SEL, textColoring: 'black-white' }, 'light');
    expect(text).not.toMatch(/--Buttons-Default-Outline-Text: #/);
  });
});

describe('a tone picked outright', () => {
  const gridFor = (cellTones: Record<string, number | 'fixed' | 'tonal'>) => {
    let cells: Array<{ theme: string; level: string; tone: unknown; vars: Record<string, string>; fillContrast: number; options: Array<{ tone: number; hex: string; contrast: number }> }> = [];
    buildPreviewCSS({
      colorScheme: makeScheme(SCHEMES[0][1]), componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
      userSelections: { ...SEL, buttonTone: 'fixed', buttonCellTones: cellTones },
      onButtonGrid: (c: typeof cells) => { cells = c; },
    } as never);
    return cells;
  };
  it('paints that tone; the fill is its own border when it clears 3:1, else the border keeps 3:1', () => {
    const probe = gridFor({}).find(c => c.theme === 'Primary' && c.level === 'Surface')!;
    const pass = probe.options.find(o => o.contrast >= 3)!;
    const fail = probe.options.find(o => o.contrast < 3)!;
    for (const [opt, own] of [[pass, true], [fail, false]] as const) {
      const cell = gridFor({ 'Primary/Surface': opt.tone }).find(c => c.theme === 'Primary' && c.level === 'Surface')!;
      expect(cell.tone).toBe(opt.tone);
      expect(cell.vars['--Buttons-Default-Button']).toBe(opt.hex);
      expect(cell.vars['--Buttons-Default-Border'] === opt.hex).toBe(own);
      expect(chroma.contrast(cell.vars['--Buttons-Default-Border'], cell.vars['--Background'])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('base on base', () => {
  it('a Fixed button that would match its background moves one tone lighter', () => {
    let cells: Array<{ theme: string; level: string; vars: Record<string, string>; fillContrast: number }> = [];
    buildPreviewCSS({
      colorScheme: makeScheme(SCHEMES[0][1]), componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
      userSelections: { ...SEL, button: 'match', buttonTone: 'fixed' },
      onButtonGrid: (c: typeof cells) => { cells = c; },
    } as never);
    for (const theme of ['Primary', 'Secondary', 'Tertiary']) {
      const c = cells.find(x => x.theme === theme && x.level === 'Surface')!;
      expect(c.vars['--Buttons-Default-Button'].toLowerCase(), theme).not.toBe(c.vars['--Background'].toLowerCase());
      expect(chroma(c.vars['--Buttons-Default-Button']).luminance(), theme).toBeGreaterThan(chroma(c.vars['--Background']).luminance());
    }
  });
});
