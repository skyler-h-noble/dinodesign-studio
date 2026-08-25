/**
 * Tonal containers follow the BACKGROUND's lightness — in both pipelines.
 *
 * The rule: with tonal cards, a light background gets Color-10 (a light card
 * that reads as a distinct surface) and a dark background gets Color-2 (a dark
 * card). It is keyed on the background, NOT on light/dark mode — a black
 * background in LIGHT mode is a dark background.
 *
 * The preview used to key this on `isDark`, so a black background in light
 * mode produced a near-white Primary Color-10 card while the export produced
 * Neutral Color-2. Both sides were internally consistent and nothing failed;
 * the phone preview simply showed a different card than the published CSS.
 * That is invariant 5, and the parity suite had no container coverage at all.
 *
 * It also used to hardcode the Primary palette for tonal cards, so a Neutral
 * background produced a Primary-tinted card the export never emits.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateSimplifiedLightModeBackgrounds } from '../utils/cssgen/generateSimplifiedBackgrounds';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import type { ColorScheme, UserSelections } from '../types';

const NEUTRAL_LIGHT = generateSemanticLightModeScale('#808080').map((t) => t.hex);

/** A neutral ramp in the shape generateSimplifiedLightModeBackgrounds wants. */
const NEUTRAL_RAMP = generateSemanticLightModeScale('#808080').map((t) => ({
  tone: t.tone, color: t.hex,
}));

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

const SCHEME = makeScheme(['#7b3f9d', '#2563eb', '#b8329b']);

const TYPOGRAPHY = [
  { type: 'header' as const, family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  { type: 'decorative' as const, family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  { type: 'body' as const, family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
];

function previewToken(css: string, scope: RegExp, token: string): string | null {
  let found: string | null = null;
  for (const block of css.split('}')) {
    const selector = block.slice(0, block.indexOf('{'));
    const body = block.slice(block.indexOf('{') + 1);
    if (!scope.test(selector)) continue;
    const m = body.match(new RegExp(`--${token}\\s*:\\s*([^;]+);`));
    if (m) found = m[1].trim();
  }
  return found;
}

/** The Brand scope emits `var(--Primary-Color-10)` rather than a literal, so a
 *  comparison against a hex has to resolve the reference first. */
function resolveVar(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/var\(--(\w+)-Color-(\d+)\)/i);
  if (!m) return value;
  const [, palette, n] = m;
  const idx = Number(n) - 1;
  if (/^neutral$/i.test(palette)) return NEUTRAL_LIGHT[idx] ?? value;
  const ramp = (SCHEME.tonePalettes as Record<string, { hex: string }[]>)[palette.toLowerCase()];
  return ramp?.[idx]?.hex ?? value;
}

const norm = (hex: string | null) => {
  if (!hex) return null;
  const h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) return h;
  try { return chroma(h).hex().toLowerCase(); } catch { return h; }
};

const tonal = (background: string) => ({
  background, cardColoring: 'tonal', textColoring: 'tonal', button: 'primary',
} as unknown as UserSelections);

describe('tonal container tone follows the background', () => {
  // ── The export ──
  it.each([
    { label: 'white background', tone: 100, expected: 10 },
    { label: 'black background', tone: 0, expected: 2 },
  ])('export: $label → Color-$expected', ({ tone, expected }) => {
    const base = tone === 100 ? NEUTRAL_RAMP[11].color : NEUTRAL_RAMP[0].color;
    const out = generateSimplifiedLightModeBackgrounds(
      base, tone, NEUTRAL_RAMP, false, 'Neutral', 'tonal',
    );
    // The top level is the pure tone and the only one with a token to point at.
    expect(out.Containers['Container-Highest'].value).toBe(`{Colors.Neutral.Color-${expected}}`);
    // The other four are blends toward the background, so they are hex.
    for (const lvl of ['Container-Lowest', 'Container-Low', 'Container', 'Container-High']) {
      expect(out.Containers[lvl as 'Container'].value).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Monotonic: each level sits further from the background than the last.
    const bg = out.Surfaces.Surface.value;
    const bgHex = NEUTRAL_RAMP[Number(bg.match(/Color-(\d+)/)![1]) - 1].color;
    const dist = (hex: string) => Math.abs(chroma(hex).lch()[0] - chroma(bgHex).lch()[0]);
    const ramp = ['Container-Lowest', 'Container-Low', 'Container', 'Container-High']
      .map((l) => dist(out.Containers[l as 'Container'].value));
    for (let i = 1; i < ramp.length; i++) {
      expect(`step${i}:${ramp[i] > ramp[i - 1]}`).toBe(`step${i}:true`);
    }
  });

  // Every Background-N, not just the four a user can pick. A themed zone can
  // put a container on any of them, and the two failure modes are silent: a
  // ramp that runs backwards (elevation reads inverted) or one that is flat
  // (the card is invisible against the page). The flat case was real — on
  // Background-10 and Background-2 the surface IS the container tone, so every
  // opacity blended a colour with itself. That was 16 of 103 combos.
  it('export: the ramp is monotonic and never flat, on every Background-N', () => {
    for (let n = 1; n <= 12; n++) {
      const out = generateSimplifiedLightModeBackgrounds(
        NEUTRAL_RAMP[n - 1].color, NEUTRAL_RAMP[n - 1].tone, NEUTRAL_RAMP, false, 'Neutral', 'tonal',
      );
      const hex = (v: string) => {
        if (v === '{White}') return '#ffffff';
        if (v === '{Black}') return '#000000';
        const m = v.match(/Color-(\d+)/);
        return m ? NEUTRAL_RAMP[Number(m[1]) - 1].color : v;
      };
      const surface = hex(out.Surfaces.Surface.value as string);
      const dist = (h: string) => Math.abs(chroma(h).lch()[0] - chroma(surface).lch()[0]);
      const steps = ['Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest']
        .map((l) => dist(hex(out.Containers[l as 'Container'].value as string)));
      // Never runs BACKWARDS. Not strictly increasing: on the collision
      // backgrounds the ramp spans two adjacent tones, where a 5% opacity step
      // rounds to the same hex — that is flat, not inverted, and the overall
      // check below is what catches a ramp with no range.
      for (let i = 1; i < steps.length; i++) {
        expect(`bg${n}/step${i}:${steps[i] >= steps[i - 1] - 0.01}`).toBe(`bg${n}/step${i}:true`);
      }
      // The ramp has to actually go somewhere, and the card has to be
      // distinguishable from the page it sits on.
      expect(`bg${n}/range:${steps[4] > steps[0]}`).toBe(`bg${n}/range:true`);
      expect(`bg${n}/visible:${steps[4] > 1}`).toBe(`bg${n}/visible:true`);
    }
  });

  // WHITE cards ramp too, at 92/94/97/98/100 — high enough that they still read
  // as white. They used to be five identical {White} values.
  it('export: white cards ramp toward white over a tinted page', () => {
    const primary = generateSemanticLightModeScale('#7b3f9d', undefined, '#7b3f9d')
      .map((t) => ({ tone: t.tone, color: t.hex }));
    const out = generateSimplifiedLightModeBackgrounds(
      primary[5].color, primary[5].tone, primary, false, 'Primary', 'professional',
    );
    expect(out.Containers['Container-Highest'].value).toBe('{Colors.Neutral.Color-12}');
    const steps = ['Container-Lowest', 'Container-Low', 'Container', 'Container-High']
      .map((l) => chroma(out.Containers[l as 'Container'].value as string).lch()[0]);
    for (let i = 1; i < steps.length; i++) {
      expect(`white/step${i}:${steps[i] > steps[i - 1]}`).toBe(`white/step${i}:true`);
    }
    // and the floor is visibly tinted by the page, not plain white
    expect(out.Containers['Container-Lowest'].value).not.toBe(NEUTRAL_LIGHT[11]);
  });

  // On an already-white page there is nothing to blend with: 92% white over
  // Color-12 rounds back to white. Elevation there comes from the drop shadow,
  // which is what light mode uses. Documented so it is not read as a bug.
  it('export: white cards on a white page collapse to Neutral Color-12', () => {
    const neutral = generateSemanticLightModeScale('#808080')
      .map((t) => ({ tone: t.tone, color: t.hex }));
    const out = generateSimplifiedLightModeBackgrounds(
      neutral[11].color, neutral[11].tone, neutral, false, 'Neutral', 'professional',
    );
    for (const l of ['Container-Lowest', 'Container-Low', 'Container', 'Container-High']) {
      expect(out.Containers[l as 'Container'].value).toBe(NEUTRAL_LIGHT[11]);
    }
    expect(out.Containers['Container-Highest'].value).toBe('{Colors.Neutral.Color-12}');
  });

  // BLACK cards ramp the other way — the floor is the pure tone and the higher
  // levels let the page through, so a raised card lightens against a light page.
  it('export: black cards ramp down from Neutral Color-1', () => {
    const primary = generateSemanticLightModeScale('#7b3f9d', undefined, '#7b3f9d')
      .map((t) => ({ tone: t.tone, color: t.hex }));
    const out = generateSimplifiedLightModeBackgrounds(
      primary[10].color, primary[10].tone, primary, false, 'Primary', 'black',
    );
    expect(out.Containers['Container-Lowest'].value).toBe('{Colors.Neutral.Color-1}');
    const steps = ['Container-Low', 'Container', 'Container-High', 'Container-Highest']
      .map((l) => chroma(out.Containers[l as 'Container'].value as string).lch()[0]);
    // Rising elevation lets more of the light page through, so each step lightens.
    for (let i = 1; i < steps.length; i++) {
      expect(`black/step${i}:${steps[i] > steps[i - 1]}`).toBe(`black/step${i}:true`);
    }
  });

  // ── The preview ──
  it('preview: a WHITE background gets the light tonal card (Neutral Color-10)', () => {
    const css = buildPreviewCSS({
      colorScheme: SCHEME, userSelections: tonal('white'),
      componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
    } as never);
    expect(norm(resolveVar(previewToken(css, /\[data-theme="Brand"\]/, 'Container-Highest'))))
      .toBe(norm(NEUTRAL_LIGHT[9]));
  });

  it('preview: a BLACK background in LIGHT mode gets a DARK card (Neutral Color-2)', () => {
    const css = buildPreviewCSS({
      colorScheme: SCHEME, userSelections: tonal('black'),
      componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
    } as never);
    const container = norm(resolveVar(previewToken(css, /\[data-theme="Brand"\]/, 'Container-Highest')));
    expect(container).toBe(norm(NEUTRAL_LIGHT[1]));
    // The regression this test exists for: a near-white card on a black page.
    expect(chroma(container!).luminance()).toBeLessThan(0.2);
  });

  // The preview must ramp exactly like the export (invariant 5). Container-Lowest
  // is the level the studio's own chrome reads (`.export-code-block`), so a
  // level that lags behind shows up as a flat box rather than as a wrong token.
  it('preview: the five levels ramp from the background up to the pure tone', () => {
    for (const background of ['white', 'black', 'primary-light']) {
      const css = buildPreviewCSS({
        colorScheme: SCHEME, userSelections: tonal(background),
        componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
      } as never);
      const level = (t: string) =>
        norm(resolveVar(previewToken(css, /\[data-theme="Brand"\]/, t)))!;
      const surface = level('Surface');
      const dist = (hex: string) =>
        Math.abs(chroma(hex).lch()[0] - chroma(surface).lch()[0]);
      const steps = ['Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest']
        .map((t) => dist(level(t)));
      for (let i = 1; i < steps.length; i++) {
        expect(`${background}/step${i}:${steps[i] > steps[i - 1]}`)
          .toBe(`${background}/step${i}:true`);
      }
    }
  });

  it('preview: a PRIMARY-LIGHT background keeps its Primary tint at Color-10', () => {
    const css = buildPreviewCSS({
      colorScheme: SCHEME, userSelections: tonal('primary-light'),
      componentStyle: 'modern', mode: 'light', typographyStyles: TYPOGRAPHY,
    } as never);
    expect(norm(resolveVar(previewToken(css, /\[data-theme="Brand"\]/, 'Container-Highest'))))
      .toBe(norm(SCHEME.tonePalettes!.primary[9].hex));
  });
});
