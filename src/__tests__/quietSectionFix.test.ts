/**
 * Dark-mode Quiet on themed sections: the per-section rescue.
 *
 * The shared per-tone Quiet alpha is solved against each palette's OWN Text on
 * its own ground. A themed section paints other Text on that ground — the
 * Neutral text table for Quiet, every palette's Text-* for Quiet-* — so a few
 * sections landed just under 4.5:1 (dark Error / Surface-Brightest Quiet at
 * 4.47-4.50, Quiet-Error on the Info and Success themes, ...).
 * sectionQuietOverrides gives exactly those sections the smallest opacity that
 * clears 4.5 and leaves every other section on the shared value.
 *
 * Asserted here:
 *   - every Quiet / Text-Quiet / Quiet-* on every themed surface in
 *     Dark-Mode.css clears 4.5:1, including the specific pairings reported;
 *   - the fix is SCOPED: with it switched off, the only lines that differ are
 *     Quiet tokens in the sections it names, and those sections' tokens only
 *     get stronger;
 *   - the Figma payload names the same sections, aliases them to their own
 *     Quiet float, and holds light mode's existing tone value in light mode;
 *   - the same holds in light mode, where the fix also runs.
 *
 * The studio preview emits no Quiet for status-themed sections and no Quiet-*
 * accents on themed sections at all, so there is no preview pairing to change.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale, getMatchingPeakChroma } from '../utils/colorScale';
import { QUIET_SECTION_FIX_MODES, contrastRatio } from '../utils/quietOpacity';

const T = { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false };

function exportFor(colors: [string, string, string], bg: string) {
  const light = (hex: string) => generateSemanticLightModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, false)), 70), hex);
  const dark = (hex: string) => generateSemanticDarkModeScale(hex, Math.min(Math.round(getMatchingPeakChroma(hex, true)), 42));
  const L = colors.map(light), D = colors.map(dark);
  const tones = { primary: chroma(colors[0]).lch()[0], secondary: chroma(colors[1]).lch()[0], tertiary: chroma(colors[2]).lch()[0] };
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(L[0], L[1], L[2]), generateFullDarkPalettes(D[0], D[1], D[2]),
    bg === 'primary' ? 'primary' : 'neutral', 'primary-fixed' as never, tones, 'modern',
    { header: T, decorative: T, body: T } as never, 'Q', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: bg, button: 'primary-fixed', cardColoring: 'tonal', textColoring: 'tonal' } as never,
  ) as unknown as Record<string, unknown>;
  json._userSelections = { background: bg, button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' };
  return json;
}
const cssOf = (json: unknown) => generateCSSFiles(json as never) as Record<string, string>;

/** Run `fn` with the section fix switched off. */
function withoutFix<R>(fn: () => R): R {
  const modes = QUIET_SECTION_FIX_MODES as string[];
  const saved = modes.splice(0, modes.length);
  try { return fn(); } finally { modes.push(...saved); }
}

type Block = { sel: string; decl: Record<string, string> };
function blocks(css: string): Block[] {
  const out: Block[] = [];
  for (const b of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
    const i = b.indexOf('{');
    if (i < 0) continue;
    const decl: Record<string, string> = {};
    for (const m of b.slice(i + 1).matchAll(/--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) decl[m[1]] = m[2].trim();
    out.push({ sel: b.slice(0, i).trim(), decl });
  }
  return out;
}
const THEMED = /\[data-theme="(Info|Success|Warning|Error|Neutral|Primary|Secondary|Tertiary)"\]\[data-surface="(Surface[A-Za-z-]*)"\]/;
const QUIET_TOKEN = /^(Quiet|Text-Quiet|Quiet-(Primary|Secondary|Tertiary|Neutral|Info|Success|Warning|Error))$/;

/** Every Quiet pairing on a themed surface: [where, fg, bg]. */
function quietPairs(css: string): Array<[string, string, string]> {
  const bl = blocks(css);
  const root: Record<string, string> = {};
  for (const b of bl) if (/^:root$/.test(b.sel)) Object.assign(root, b.decl);
  const out: Array<[string, string, string]> = [];
  for (const b of bl) {
    const m = b.sel.match(THEMED);
    if (!m) continue;
    const res = (v?: string): string | null => {
      for (let k = 0; k < 6 && v; k++) {
        const vm = v.match(/^var\(--([A-Za-z0-9-]+)\s*(?:,\s*(.+))?\)$/);
        if (!vm) break;
        v = b.decl[vm[1]] ?? root[vm[1]] ?? vm[2];
      }
      return v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
    };
    const bg = res(b.decl.Background);
    if (!bg) continue;
    for (const [tok, val] of Object.entries(b.decl)) {
      if (!QUIET_TOKEN.test(tok)) continue;
      const fg = res(val);
      if (fg) out.push([`${m[1]}/${m[2]} ${tok}`, fg, bg]);
    }
  }
  return out;
}

const BRANDS: [string, string, string][] = [
  ['#e0408a', '#f2b33d', '#3fa7a0'],
  ['#7b3f9d', '#2563eb', '#b8329b'],
  ['#d92b2b', '#1e3a8a', '#84cc16'],
];

describe('Quiet on themed surfaces clears 4.5:1 in both modes', () => {
  it.each(BRANDS.flatMap((b) => ['white', 'primary'].map((bg) => ({ b, bg }))))('$b.0 on a $bg page', ({ b, bg }) => {
    const css = cssOf(exportFor(b, bg));
    const pairs = [...quietPairs(css['Dark-Mode.css']), ...quietPairs(css['Light-Mode.css'])];
    expect(pairs.length).toBeGreaterThan(600);
    const failing = pairs.filter(([, fg, back]) => contrastRatio(fg, back) < 4.5)
      .map(([w, fg, back]) => `${w} ${fg} on ${back} ${contrastRatio(fg, back).toFixed(3)}`);
    expect(failing.join('\n')).toBe('');
  }, 60_000);

  it('the reported pairings: Error / Surface-Brightest Quiet, including pink on a primary page', () => {
    for (const [b, bg] of [[BRANDS[0], 'primary'], [BRANDS[0], 'white'], [BRANDS[2], 'primary']] as const) {
      const pairs = quietPairs(cssOf(exportFor(b, bg))['Dark-Mode.css'])
        .filter(([w]) => w === 'Error/Surface-Brightest Quiet' || w === 'Error/Surface-Brightest Text-Quiet');
      expect(pairs.length).toBe(2);
      for (const [w, fg, back] of pairs) expect(contrastRatio(fg, back), `${b[0]} ${bg} ${w}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the fix is scoped', () => {
  const json = exportFor(BRANDS[0], 'primary');
  const fixed = cssOf(json);
  const plain = withoutFix(() => cssOf(json));
  const figma = generateFigmaJSON(json as never);
  const figmaPlain = withoutFix(() => generateFigmaJSON(json as never));

  it.each(['Dark-Mode', 'Light-Mode'] as const)('%s: only Quiet tokens in the sections it names change, and only upward', (mode) => {
    const sheet = `${mode}.css`;
    const before = new Map(quietPairs(plain[sheet]).map(([w, fg, bg]) => [w, { fg, bg }]));
    const changedSections = new Set<string>();
    for (const [w, fg, bg] of quietPairs(fixed[sheet])) {
      const was = before.get(w)!;
      expect(was.bg).toBe(bg);
      if (was.fg !== fg) {
        changedSections.add(w.split(' ')[0]);
        expect(contrastRatio(fg, bg), w).toBeGreaterThan(contrastRatio(was.fg, bg));
      }
    }
    // Every changed line is a Quiet-family token.
    const a = plain[sheet].split('\n'), b = fixed[sheet].split('\n');
    expect(a.length).toBe(b.length);
    a.forEach((line, i) => {
      if (line !== b[i]) expect(b[i]).toMatch(/--(Quiet|Text-Quiet|Quiet-[A-Za-z]+|Outline-Quiet|Buttons-[A-Za-z]+-Outline-Quiet)\s*:/);
    });
    expect(changedSections.size).toBeGreaterThan(0);
    if (mode === 'Dark-Mode') expect(changedSections.has('Error/Surface-Brightest')).toBe(true);

    // Figma names the same sections: a float of its own whose value in this
    // mode is above that section's shared tone value.
    const quiet = figma.Modes[mode].Quiet;
    const own = Object.keys(quiet).filter((k) => !/^Color-\d+-Opacity$/.test(k));
    const overriddenHere = new Set<string>();
    for (const k of own) {
      const [theme, ...rest] = k.replace(/-Opacity$/, '').split('-');
      const section = rest.join('-');
      const shared = String(figmaPlain.Themes[theme][section]['Quiet-Opacity'].value).match(/Color-(\d+)-Opacity/)![1];
      const tone = quiet[`Color-${shared}-Opacity`].value;
      expect(quiet[k].value, k).toBeGreaterThanOrEqual(tone);
      if (quiet[k].value > tone) overriddenHere.add(`${theme}/${section}`);
    }
    expect([...overriddenHere].sort()).toEqual([...changedSections].sort());
    // Untouched sections still alias the shared tone value.
    expect(String(figma.Themes.Primary.Surface['Quiet-Opacity'].value)).toMatch(/^\{Quiet\.Color-\d+-Opacity\}$/);
  });

  it('Figma: existing per-tone floats are untouched; sections that need one alias their own', () => {
    expect(figma.Themes.Error['Surface-Brightest']['Quiet-Opacity'].value).toBe('{Quiet.Error-Surface-Brightest-Opacity}');
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      for (const [k, v] of Object.entries<{ value: number }>(figmaPlain.Modes[mode].Quiet)) {
        expect(figma.Modes[mode].Quiet[k].value, `${mode} ${k}`).toBe(v.value);
      }
    }
  });

  it('the studio preview carries none of these pairings', () => {
    const preview = buildPreviewCSS({
      colorScheme: { tonePalettes: {}, darkModeTonePalettes: {}, extractedTones: { primary: 50, secondary: 50, tertiary: 50 } },
      userSelections: { background: 'white', button: 'primary', cardColoring: 'tonal', textColoring: 'tonal' },
      componentStyle: 'modern', mode: 'dark', typographyStyles: [],
    } as never);
    // No status-theme block in the preview declares a Quiet colour.
    const statusQuiet = blocks(preview).filter((b) =>
      /\[data-theme="(Info|Success|Warning|Error)"\]/.test(b.sel)
      && Object.keys(b.decl).some((k) => QUIET_TOKEN.test(k)));
    expect(statusQuiet.map((b) => b.sel)).toEqual([]);
  });
});
