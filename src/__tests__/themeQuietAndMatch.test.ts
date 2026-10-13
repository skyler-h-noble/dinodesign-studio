/**
 * Quiet-Opacity has to reach the Figma payload — the twelve FLOATs the file's
 * Modes/Quiet group holds, one per tone, shared across palettes and across
 * Surfaces and Containers.
 *
 * This suite exists because the section shipped EMPTY and said nothing. Two
 * separate assumptions about the real data were wrong:
 *
 *   1. the Text table and Container-Highest are ALIASES (`{Colors.Primary.
 *      Color-9}`), not hexes, and the emitter tested the raw value against a
 *      hex pattern, so every pair was rejected;
 *   2. Text.Surfaces carries three keys that are not grounds — `BW` (the
 *      black-or-white picker), `BW-Button` and `Hotlink-Visited` — and reading
 *      BW measured white on white, failed the verification pass and dropped
 *      all twelve tones from Light-Mode.
 *
 * Both failures were silent and the import reported success. So the tests
 * below assert the VALUES, not just that something was emitted — invariant 7,
 * parity is not correctness.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../utils/cssgen/exportColorSystem';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../utils/colorScale';
import { compositeOver, contrastRatio } from '../utils/quietOpacity';
import { generateCSSFiles } from '../utils/cssgen/exportToCSS';

/** the eight palettes that are actually painted as a surface */
const PALETTES = ['Neutral', 'Primary', 'Secondary', 'Tertiary',
                  'Info', 'Success', 'Warning', 'Error'];
const TARGET = 4.5;

/** A system built the way the app builds one, so the token SHAPE is real. */
function buildSystem() {
  const seeds: [string, string, string] = ['#8f3767', '#784284', '#cc90d8'];
  const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
  const dark = (h: string) => generateSemanticDarkModeScale(h);
  const json = exportColorSystemToJSON(
    generateFullLightPalettes(light(seeds[0]) as never, light(seeds[1]) as never, light(seeds[2]) as never),
    generateFullDarkPalettes(dark(seeds[0]) as never, dark(seeds[1]) as never, dark(seeds[2]) as never),
    'primary', 'primary-fixed' as never,
    { primary: chroma(seeds[0]).lch()[0], secondary: chroma(seeds[1]).lch()[0], tertiary: chroma(seeds[2]).lch()[0] },
    'modern',
    { header: { family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
      decorative: { family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
      body: { family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false } },
    'Metrics', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: 'primary' as never, button: 'primary-fixed' as never,
      cardColoring: 'tonal' as never, textColoring: 'tonal' as never },
  ) as any;
  json._userSelections = { background: 'primary', button: 'primary-fixed',
                           cardColoring: 'tonal', textColoring: 'tonal' };
  json._componentStyle = { buttonRadius: 25, iconButtonRadius: 25, inputRadius: 25,
    cardPadding: 16, minButtonWidth: 60, bevel: 0, bevelOpacity: 50,
    buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56 };
  return json;
}

const SYSTEM = buildSystem();
const OUT = generateFigmaJSON(SYSTEM) as any;

/** follow one alias hop the way the emitter does, for the assertions below */
function hexOf(mode: string, raw: any): string | null {
  const v = typeof raw === 'string' ? raw : raw?.value;
  if (typeof v !== 'string') return null;
  if (v.startsWith('#')) return v.slice(0, 7);
  const m = v.replace(/[{}]/g, '').match(/^(?:Colors\.)?([\w-]+)\.(Color-[\w-]+)$/);
  const hit = m && SYSTEM.Modes[mode]?.Colors?.[m[1]]?.[m[2]]?.value;
  return typeof hit === 'string' && hit.startsWith('#') ? hit.slice(0, 7) : null;
}

describe('Quiet-Opacity reaches the Figma payload', () => {
  it('writes all twelve tones in both modes', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const quiet = OUT.Modes?.[mode]?.Quiet;
      expect(quiet, `${mode} has no Quiet group`).toBeDefined();
      for (let n = 1; n <= 12; n++)
        expect(quiet[`Color-${n}-Opacity`], `${mode}/Color-${n}`).toBeDefined();
    }
  });

  it('emits PERCENT floats, not 0..1 fractions', () => {
    /* A number bound to a colour's opacity in Figma renders by appending "%",
       so a 0.537 would paint half a percent of the text and look like nothing
       was written at all — the same symptom as the bug above. */
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      for (const token of Object.values<any>(OUT.Modes[mode].Quiet)) {
        expect(token.type).toBe('number');
        expect(token.value).toBeGreaterThan(1);
        expect(token.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('every emitted alpha clears 4.5:1 on all eight palettes, both branches', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const M = SYSTEM.Modes[mode];
      for (let n = 1; n <= 12; n++) {
        const alpha = OUT.Modes[mode].Quiet[`Color-${n}-Opacity`].value / 100;
        for (const branch of ['Surfaces', 'Containers']) {
          for (const pal of PALETTES) {
            const fg = hexOf(mode, M.Text?.[branch]?.[pal]?.[`Color-${n}`]);
            const bg = branch === 'Surfaces'
              ? hexOf(mode, M.Colors?.[pal]?.[`Color-${n}`])
              : hexOf(mode, M.Backgrounds?.[pal]?.[`Background-${n}`]?.Containers?.['Container-Highest']);
            if (!fg || !bg) continue;
            const ratio = contrastRatio(compositeOver(fg, bg, alpha), bg);
            expect(ratio, `${mode} ${branch}/${pal}/Color-${n}`).toBeGreaterThanOrEqual(TARGET);
          }
        }
      }
    }
  });

  it('lands close to 4.5, which is the whole point of using an alpha', () => {
    /* Solid Text overshoots to 5-7:1 because the ramp has no tone between.
       If a tone's worst case drifts far above the line the alpha has stopped
       doing its job — most likely because a palette dropped out of the set. */
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const M = SYSTEM.Modes[mode];
      for (let n = 1; n <= 12; n++) {
        const alpha = OUT.Modes[mode].Quiet[`Color-${n}-Opacity`].value / 100;
        let worst = Infinity;
        for (const branch of ['Surfaces', 'Containers']) {
          for (const pal of PALETTES) {
            const fg = hexOf(mode, M.Text?.[branch]?.[pal]?.[`Color-${n}`]);
            const bg = branch === 'Surfaces'
              ? hexOf(mode, M.Colors?.[pal]?.[`Color-${n}`])
              : hexOf(mode, M.Backgrounds?.[pal]?.[`Background-${n}`]?.Containers?.['Container-Highest']);
            if (!fg || !bg) continue;
            worst = Math.min(worst, contrastRatio(compositeOver(fg, bg, alpha), bg));
          }
        }
        if (worst === Infinity) continue;
        expect(worst, `${mode}/Color-${n} tightest`).toBeLessThan(TARGET + 0.5);
      }
    }
  });

  it('the Text table really is alias-valued, so resolving is load-bearing', () => {
    /* The teeth of the first bug. If this ever becomes a hex the emitter's
       resolver stops being exercised and the regression can return unseen. */
    const v = SYSTEM.Modes['Light-Mode'].Text.Surfaces.Primary['Color-1'].value;
    expect(v.startsWith('{'), `expected an alias, got ${v}`).toBe(true);
  });

  it('ignores BW, BW-Button and Hotlink-Visited, which are not grounds', () => {
    /* BW is the black-or-white picker: Colors.BW.Color-1 is #ffffff and so is
       Text.Surfaces.BW.Color-1, i.e. white on white. Reading it as a ground
       reports a contrast failure that does not exist. */
    const M = SYSTEM.Modes['Light-Mode'];
    expect(Object.keys(M.Text.Surfaces)).toContain('BW');
    expect(M.Colors.BW['Color-1'].value).toBe('#ffffff');
    expect(M.Text.Surfaces.BW['Color-1'].value).toBe('{Colors.White}');
    // and the payload is written anyway
    expect(Object.keys(OUT.Modes['Light-Mode'].Quiet)).toHaveLength(12);
  });

  it('the Theme collection gets Quiet-Opacity and NO Quiet colours', () => {
    /* The ask this shape exists for: nine colour variables per section became
       one number. They are stripped at the Figma boundary rather than never
       built, because CSS still needs them — see the strip pass in
       generateFigmaJSON. */
    let sections = 0;
    for (const theme of Object.values<any>(OUT.Themes ?? {})) {
      for (const [name, section] of Object.entries<any>(theme ?? {})) {
        if (!section || typeof section !== 'object') continue;
        if (section['Quiet-Opacity'] === undefined) continue;
        sections++;
        expect(section['Quiet-Opacity'].type, name).toBe('number');
        for (const k of ['Quiet', 'Quiet-Primary', 'Quiet-Neutral', 'Quiet-Error'])
          expect(section[k], `${name} still carries ${k}`).toBeUndefined();
      }
    }
    expect(sections, 'no Theme section carried Quiet-Opacity').toBeGreaterThan(0);
  });

  it('keeps Buttons.<Palette>.Quiet, which is a different role', () => {
    /* Muted text on a button's FILL, not on the surface. The strip pass walks
       section level only so this survives; a recursive one would eat it. */
    let found = 0;
    for (const theme of Object.values<any>(OUT.Themes ?? {}))
      for (const section of Object.values<any>(theme ?? {}))
        for (const entry of Object.values<any>(section?.Buttons ?? {}))
          if (entry && typeof entry === 'object' && entry.Quiet) found++;
    expect(found, 'button Quiet was stripped too').toBeGreaterThan(0);
  });

  it('Default routes its alpha through Default-Background, per mode', () => {
    /* Default's tone differs between modes (light Neutral-12, dark Neutral-2)
       and the Theme collection is mode-independent, so it cannot alias a fixed
       {Quiet.Color-N-Opacity} the way the other themes do. */
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const defBg = OUT.Modes[mode]['Default-Background'];
      expect(defBg?.['Quiet-Opacity']?.type, mode).toBe('number');
      expect(defBg?.['Container-Quiet-Opacity']?.type, mode).toBe('number');
      for (const prefix of ['Surface-Dim-', 'Surface-Bright-', 'Surface-Brightest-'])
        expect(defBg?.[`${prefix}Quiet-Opacity`]?.type, `${mode} ${prefix}`).toBe('number');
    }
    /* and the two modes disagree, which is the whole reason for the route */
    expect(OUT.Modes['Light-Mode']['Default-Background']['Quiet-Opacity'].value)
      .not.toBe(OUT.Modes['Dark-Mode']['Default-Background']['Quiet-Opacity'].value);
  });

  it('every theme carries Text-Match / Header-Match in its own hue', () => {
    /* The point of Match: one token name whose value rotates with the theme,
       so an Alert is one component that switches theme rather than four
       variants that differ only in which Text-{Palette} they read. */
    const themed = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
                    'Info', 'Success', 'Warning', 'Error'];
    for (const name of themed) {
      const section = OUT.Themes?.[name]?.Surface;
      if (!section) continue;
      expect(section['Text-Match'], `${name}/Surface Text-Match`).toBeDefined();
      expect(section['Header-Match'], `${name}/Surface Header-Match`).toBeDefined();
      /* and it really is THIS theme's palette, not a fixed one */
      expect(String(section['Text-Match'].value), `${name} Text-Match palette`)
        .toContain(name);
    }
    /* Containers too — a card in an Error theme takes Error text at the
       card's tone, not the surface's. */
    for (const name of themed) {
      const cont = OUT.Themes?.[name]?.Containers;
      if (!cont) continue;
      expect(cont['Text-Match'], `${name}/Containers Text-Match`).toBeDefined();
      expect(cont['Header-Match'], `${name}/Containers Header-Match`).toBeDefined();
    }
  });

  it('Default routes Match through Default-Background, like every other role', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const defBg = OUT.Modes[mode]['Default-Background'];
      for (const k of ['Text-Match', 'Header-Match',
                       'Container-Text-Match', 'Container-Header-Match'])
        expect(defBg?.[k]?.value, `${mode} ${k}`).toMatch(/^#/);
    }
  });

  it('ships no Icons-{Role}-Variant to the Theme collection', () => {
    /* Same rule as Quiet: a variant is its Icons/{Role} sibling at 50%, and
       Figma expresses that as an alias plus an opacity in the Surface
       collection. Shipping the colours too meant every regenerate overwrote
       that binding, because populateSurfaceCollection recreates a variable for
       every key the Theme template carries. */
    const offenders: string[] = [];
    for (const [tn, theme] of Object.entries<any>(OUT.Themes ?? {}))
      for (const [sn, section] of Object.entries<any>(theme ?? {}))
        for (const k of Object.keys(section?.Icons ?? {}))
          if (k.endsWith('-Variant')) offenders.push(`${tn}/${sn}/Icons/${k}`);
    expect(offenders).toEqual([]);
  });

  it('keeps Border-Variant, which is a colour with no alias form', () => {
    /* The strip matches the -Variant suffix INSIDE the Icons group only. A
       blanket suffix match would also take this, which is an ordinary colour. */
    let found = 0;
    for (const theme of Object.values<any>(OUT.Themes ?? {}))
      for (const section of Object.values<any>(theme ?? {}))
        if (section?.['Border-Variant']) found++;
    expect(found, 'Border-Variant was stripped too').toBeGreaterThan(0);
  });

  it('every section with Icons/Match also has Icons/On-Match', () => {
    /* On-{Role} is the foreground for content sitting ON that icon colour. A
       Match icon without one is the failure mode the On-Default fallback was
       added for: the role silently never gets written and a label lands on it
       at whatever contrast happens to fall out. */
    let checked = 0;
    for (const [tn, theme] of Object.entries<any>(OUT.Themes ?? {}))
      for (const [sn, section] of Object.entries<any>(theme ?? {})) {
        if (!section?.Icons?.Match) continue;
        expect(section.Icons['On-Match'], `${tn}/${sn}`).toBeDefined();
        checked++;
      }
    expect(checked, 'no section carried Icons/Match').toBeGreaterThan(20);
  });

  it('Default routes On-Match through Default-Background at every surface', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const defBg = OUT.Modes[mode]['Default-Background'];
      for (const prefix of ['', 'Surface-Dim-', 'Surface-Bright-', 'Surface-Brightest-'])
        expect(defBg?.[`${prefix}On-Match`]?.value, `${mode} ${prefix}`).toMatch(/^#/);
    }
  });

  it('the old 240-colour Quiet section is gone', () => {
    for (const mode of ['Light-Mode', 'Dark-Mode']) {
      const keys = Object.keys(OUT.Modes[mode].Quiet);
      expect(keys.every(k => k.endsWith('-Opacity')), `${mode}: ${keys.slice(0, 4)}`).toBe(true);
    }
  });

  /* ── CSS and Figma must paint the SAME Quiet ──────────────────────────
   *
   * Figma binds the alpha to an alias; CSS bakes it into a solid. Different
   * shapes, one colour — and the only way to know that is to compute the
   * composite from the Figma side and find it in the stylesheet. Invariant 5:
   * the preview and the export are separate implementations and diverge in
   * silence.
   */
  describe('CSS paints the composite Figma binds', () => {
    const CSS = (generateCSSFiles(SYSTEM as never) as Record<string, string>);
    const SHEETS: Record<string, string> = {
      'Light-Mode': CSS['light-mode.css'] ?? CSS['Light-Mode.css'] ?? '',
      'Dark-Mode': CSS['dark-mode.css'] ?? CSS['Dark-Mode.css'] ?? '',
    };

    it('emits a stylesheet for each mode', () => {
      for (const [mode, sheet] of Object.entries(SHEETS))
        expect(sheet.length, `${mode} sheet is empty — filenames changed?`)
          .toBeGreaterThan(1000);
    });

    it('every section-scoped Quiet is a hex, never a reference', () => {
      /* The flat `--Quiet: var(--Surfaces-Quiet)` mapping is legitimately a
         var — it is the per-scope alias. The SECTION-scoped ones carry the
         value, so a var() there means the composite did not happen. */
      for (const [mode, sheet] of Object.entries(SHEETS)) {
        const bad = [...sheet.matchAll(
          /--(Surfaces(?:-Dim|-Dimmest|-Bright|-Brightest)?|Containers)-(Quiet[A-Za-z-]*)\s*:\s*([^;]+);/g,
        )].filter((m) => !m[3].trim().startsWith('#'));
        expect(bad.map((m) => `${m[1]}-${m[2]}: ${m[3].trim()}`), mode).toEqual([]);
      }
    });

    /** Follow a {A.B.C} chain through the mode tree to a literal. */
    const deref = (mode: string, v: any, depth = 0): string | null => {
      const raw = typeof v === 'string' ? v : v?.value;
      if (typeof raw !== 'string' || depth > 10) return null;
      if (raw.startsWith('#')) return raw.slice(0, 7);
      if (!raw.startsWith('{')) return null;
      let node: any = SYSTEM.Modes[mode];
      for (const k of raw.slice(1, -1).split('.')) { node = node?.[k]; if (node === undefined) return null; }
      return deref(mode, node, depth + 1);
    };

    it('the hex it emits is the composite, computed from the Figma alpha', () => {
      let checked = 0;
      for (const [mode, sheet] of Object.entries(SHEETS)) {
        const M = SYSTEM.Modes[mode];
        for (const [themeName, theme] of Object.entries<any>(M.Themes ?? {})) {
          /* Default routes its alpha through Default-Background, which this
             test's one-hop resolver cannot follow; the themed ones carry the
             tone in the reference. */
          if (themeName === 'Default') continue;
          for (const [sectionName, section] of Object.entries<any>(theme ?? {})) {
            const ref = section?.['Quiet-Opacity']?.value;
            const tone = typeof ref === 'string' && ref.match(/Quiet\.Color-(\d+)-Opacity/);
            if (!tone) continue;
            const alpha = OUT.Modes[mode].Quiet[`Color-${tone[1]}-Opacity`]?.value / 100;
            const bg = deref(mode, section.Background);
            const fg = deref(mode, section.Text);
            if (alpha === undefined || !bg || !fg) continue;
            const want = compositeOver(fg, bg, alpha);
            expect(sheet.toLowerCase(), `${mode} ${themeName}/${sectionName}`)
              .toContain(want.toLowerCase());
            checked++;
          }
        }
      }
      expect(checked, 'no section was actually compared').toBeGreaterThan(20);
    });
  });
});
