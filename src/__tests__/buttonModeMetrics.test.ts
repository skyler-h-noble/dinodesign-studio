/**
 * The mode-scoped button metrics must reach ALL THREE consumers with the same
 * numbers: the preview's inline vars, the exported CSS, and the Figma payload.
 *
 * Invariant 5 — the preview is a separate implementation from the export, and
 * they diverge silently. This group is the exact shape that goes wrong:
 * --Button-Padding is declared three separate times across these files today.
 * The new metrics are single-sourced in buttonSizing.ts, and this test is what
 * keeps a future "just inline the number here" from re-forking them.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { BUTTON_MODE_METRICS, buttonModeMetrics, derivedTextMetrics, ICON_RAMP } from '../utils/buttonSizing';
import { componentStyleVars } from '../utils/componentStyleVars';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';

const HEIGHTS = { buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56 };
const METRICS = buttonModeMetrics(HEIGHTS);
const NAMES = Object.keys(METRICS);

function buildSystem(heights: Record<string, number> = HEIGHTS) {
  const colors: [string, string, string] = ['#8f3767', '#784284', '#cc90d8'];
  const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const dark = (h: string) => generateSemanticDarkModeScale(h);
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(light(colors[0]) as never, light(colors[1]) as never, light(colors[2]) as never),
    generateFullDarkPalettes(dark(colors[0]) as never, dark(colors[1]) as never, dark(colors[2]) as never),
    'primary', 'primary-fixed' as never,
    { primary: chroma(colors[0]).lch()[0], secondary: chroma(colors[1]).lch()[0], tertiary: chroma(colors[2]).lch()[0] },
    'modern',
    { header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false } },
    'Metrics', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'primary' as never, button: 'primary-fixed' as never,
      cardColoring: 'tonal' as never, textColoring: 'tonal' as never },
  );
  (json as unknown as Record<string, unknown>)._userSelections = {
    background: 'primary', button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal',
  };
  // The radii / button-metric block in generateBaseCSS and the Figma
  // Components.Button payload are BOTH gated on _componentStyle. The real
  // pipeline attaches it from input.styleCustomizations before running any
  // generator (generateDesignSystem.ts); a fixture without it silently skips
  // the very section under test.
  (json as unknown as Record<string, unknown>)._componentStyle = {
    buttonRadius: 25, iconButtonRadius: 25, inputRadius: 25,
    cardPadding: 16, minButtonWidth: 60, bevel: 0, bevelOpacity: 50,
    ...heights,
  };
  return json;
}

/** Read `--Name: 16px;` out of a stylesheet. */
function pxOf(css: string, name: string): number | null {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(-?[\\d.]+)px`));
  return m ? Number(m[1]) : null;
}

describe('mode-scoped button metrics', () => {
  const json = buildSystem();
  const css = (generateCSSFiles(json as never) as Record<string, string>)['base.css'] ?? '';
  const figma = generateFigmaJSON(json) as unknown as
    { Components?: { Button?: Record<string, number> } };
  const preview = componentStyleVars('modern', HEIGHTS as never);
  const btn = figma.Components?.Button ?? {};

  it('every metric ships all three modes to the CSS export', () => {
    for (const name of NAMES) {
      const m = METRICS[name];
      expect(pxOf(css, name), `--${name}`).toBe(m.medium);
      expect(pxOf(css, `Sm-${name}`), `--Sm-${name}`).toBe(m.small);
      expect(pxOf(css, `Lg-${name}`), `--Lg-${name}`).toBe(m.large);
    }
  });

  it('the preview emits the same numbers as the export', () => {
    for (const name of NAMES) {
      const m = METRICS[name];
      expect(preview[`--${name}`], `--${name}`).toBe(`${m.medium}px`);
      expect(preview[`--Sm-${name}`], `--Sm-${name}`).toBe(`${m.small}px`);
      expect(preview[`--Lg-${name}`], `--Lg-${name}`).toBe(`${m.large}px`);
    }
  });

  it('the Figma payload carries the same numbers', () => {
    for (const name of NAMES) {
      const m = METRICS[name];
      expect(btn[name], name).toBe(m.medium);
      expect(btn[`Sm-${name}`], `Sm-${name}`).toBe(m.small);
      expect(btn[`Lg-${name}`], `Lg-${name}`).toBe(m.large);
    }
  });

  // The derivation is the point: it must reproduce the design's own table at
  // the DEFAULT heights, and it must actually move when a brand picks others.
  // A "derived" value that never changes is just a constant with extra steps.
  it('reproduces the design table at the default heights', () => {
    const d = derivedTextMetrics(HEIGHTS);
    expect(d['Button-Text']).toEqual({ medium: 16, small: 14, large: 20 });
    expect(d['Avatar-Text']).toEqual({ medium: 14, small: 12, large: 18 });
    expect(d['Button-Icon-Only']).toEqual({ medium: 24, small: 16, large: 40 });
    // The two values that deliberately differ from the design's table.
    // Button-Numbers medium: design 14, the shared text slope puts it at 12.
    // Button-Icon small:     design 20, the icon ramp puts it at 16.
    expect(d['Button-Numbers']).toEqual({ medium: 12, small: 10, large: 16 });
    expect(d['Button-Icon']).toEqual({ medium: 20, small: 16, large: 32 });
  });

  it('keeps the text roles 2px apart at every height', () => {
    for (const hs of [HEIGHTS, { buttonHeight: 48, smallButtonHeight: 20, largeButtonHeight: 80 }]) {
      const d = derivedTextMetrics(hs);
      for (const k of ['medium', 'small', 'large'] as const) {
        // Only meaningful above the 10px floor, which collapses the ladder.
        if (d['Button-Numbers'][k] <= 10) continue;
        expect(d['Avatar-Text'][k]).toBe(d['Button-Text'][k] - 2);
        expect(d['Button-Numbers'][k]).toBe(d['Button-Text'][k] - 4);
      }
    }
  });

  it('every icon size lands on a rung of the ramp', () => {
    for (const hs of [HEIGHTS, { buttonHeight: 40, smallButtonHeight: 28, largeButtonHeight: 64 },
                      { buttonHeight: 100, smallButtonHeight: 12, largeButtonHeight: 200 }]) {
      const d = derivedTextMetrics(hs);
      for (const name of ['Button-Icon', 'Button-Icon-Only']) {
        for (const k of ['medium', 'small', 'large'] as const) {
          expect(ICON_RAMP, `${name}.${k}`).toContain(d[name][k]);
        }
      }
    }
  });

  it('tracks the brand\'s chosen heights', () => {
    const tall = derivedTextMetrics({ buttonHeight: 48, smallButtonHeight: 36, largeButtonHeight: 72 });
    expect(tall['Button-Text'].medium).toBe(19);   // 3*48/16 + 9.5 = 18.5 -> 19
    expect(tall['Button-Text'].small).toBe(16);    // 3*36/16 + 9.5 = 16.25 -> 16
    expect(tall['Button-Text'].large).toBe(23);    // 3*72/16 + 9.5 = 23
    // Avatar-Text is Button-Text - 2 at every height, by construction.
    for (const k of ['medium', 'small', 'large'] as const) {
      expect(tall['Avatar-Text'][k]).toBe(tall['Button-Text'][k] - 2);
    }
  });

  it('floors at 10px so a tiny button never gets illegible type', () => {
    const tiny = derivedTextMetrics({ buttonHeight: 8, smallButtonHeight: 8, largeButtonHeight: 8 });
    expect(tiny['Avatar-Text'].medium).toBe(10);
  });

  // End to end: a brand's chosen height must actually reach the stylesheet.
  // The unit tests above prove the formula; this proves the wiring, which is
  // the half that silently breaks (the emitter had to be handed `cs`).
  it('a taller brand button produces larger label type in the real CSS', () => {
    const tallCss = (generateCSSFiles(
      buildSystem({ buttonHeight: 48, smallButtonHeight: 36, largeButtonHeight: 72 }) as never,
    ) as Record<string, string>)['base.css'] ?? '';
    expect(pxOf(css, 'Button-Text')).toBe(16);
    expect(pxOf(tallCss, 'Button-Text')).toBe(19);
    expect(pxOf(tallCss, 'Lg-Button-Text')).toBe(23);
    expect(pxOf(tallCss, 'Avatar-Text')).toBe(17);
  });

  // Parity is not correctness (invariant 7) — assert the intended SHAPE too.
  it('large is never smaller than medium, and medium never smaller than small', () => {
    for (const name of NAMES) {
      const m = METRICS[name];
      expect(m.large, `${name} large`).toBeGreaterThanOrEqual(m.medium);
      expect(m.medium, `${name} medium`).toBeGreaterThanOrEqual(m.small);
    }
  });
});
