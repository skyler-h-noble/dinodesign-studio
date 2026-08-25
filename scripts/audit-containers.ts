/**
 * Grade every container level for contrast.
 *
 * The five levels all alias into ONE nominal tone index (config.contN), and
 * Text/Quiet/Border are looked up as {Text.Containers.<Palette>.Color-<contN>}.
 * So one foreground is computed for one tone and applied to all five levels —
 * which is exactly why an earlier per-level blend was reverted.
 *
 *   npx tsx scripts/audit-containers.ts
 */
import chroma from 'chroma-js';
import { exportColorSystemToJSON } from '../src/utils/cssgen/exportColorSystem';
import { generateFullLightPalettes, generateFullDarkPalettes } from '../src/utils/generateFullPalettes';
import { generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../src/utils/colorScale';
import { buildAccessibilityReport } from '../src/utils/accessibilityReport';
import {
  BACKGROUND_THEMES, SURFACE_LEVELS, formatBackground, legacyName, toneFor,
} from '../src/utils/backgroundSelection';

const light = (h: string) => generateSemanticLightModeScale(h, undefined, h);
const dark = (h: string) => generateSemanticDarkModeScale(h);

const BRANDS: Record<string, [string, string, string]> = {
  purple: ['#7b3f9d', '#2563eb', '#b8329b'],
  olive:  ['#6b7a4f', '#c98b7e', '#e0c9a6'],
  choc:   ['#3b2314', '#8c6239', '#d9b382'],
  teal:   ['#0f766e', '#f59e0b', '#7c3aed'],
};
/** Every theme x surface the picker can now produce — 20, not the old 4. */
const BGS = BACKGROUND_THEMES.flatMap((theme) =>
  SURFACE_LEVELS.map((surface) => ({ theme, surface })));
const CARDS = ['tonal', 'white', 'black'];
const CORE = 6;

function build(
  colors: [string, string, string],
  background: { theme: typeof BACKGROUND_THEMES[number]; surface: typeof SURFACE_LEVELS[number] },
  cardColoring: string,
) {
  const backgroundName = legacyName(background) ?? formatBackground(background);
  const backgroundN = toneFor(background.theme, background.surface, CORE);
  const tp = { primary: light(colors[0]), secondary: light(colors[1]), tertiary: light(colors[2]) };
  const dp = { primary: dark(colors[0]), secondary: dark(colors[1]), tertiary: dark(colors[2]) };
  return exportColorSystemToJSON(
    generateFullLightPalettes(tp.primary as never, tp.secondary as never, tp.tertiary as never),
    generateFullDarkPalettes(dp.primary as never, dp.secondary as never, dp.tertiary as never),
    background.theme === 'Neutral' ? 'neutral' : 'primary',
    'primary-fixed' as never,
    { primary: chroma(colors[0]).lch()[0], secondary: chroma(colors[1]).lch()[0], tertiary: chroma(colors[2]).lch()[0] },
    'modern',
    { header:{family:'Inter',weight:'600',letterSpacing:'0em',allCaps:false},
      decorative:{family:'Caveat',weight:'400',letterSpacing:'0em',allCaps:false},
      body:{family:'Inter',weight:'400',letterSpacing:'0em',allCaps:false} },
    'Audit', undefined, undefined, undefined, 'light-tonal', undefined,
    { background: backgroundName as never, button: 'primary-fixed' as never,
      cardColoring: cardColoring as never, textColoring: 'tonal' as never,
      backgroundTheme: background.theme as never, backgroundN: backgroundN as never },
  );
}

const orig = console.log; console.log = () => {};   // generators are chatty
const tally: Record<string, { fail: number; total: number }> = {};
const worst: { d: string; ratio: number; req: number }[] = [];

for (const [bname, colors] of Object.entries(BRANDS)) {
  for (const bg of BGS) {
   for (const card of CARDS) {
    let report;
    try { report = buildAccessibilityReport(build(colors, bg, card) as never); }
    catch (e) { continue; }
    for (const section of report) {
      // Surfaces AND containers. 16 of the 20 backgrounds are new as a PAGE
      // background, so text on the surface itself needs grading too — a
      // container passing says nothing about the page behind it.
      if (!section.surfaceLevel) continue;
      const group = section.surfaceLevel.startsWith('Container') ? 'containers' : 'surfaces ';
      const key = `${group} ${card} cards ${section.mode}/${section.surfaceLevel}`;
      tally[key] ??= { fail: 0, total: 0 };
      for (const c of section.checks) {
        tally[key].total++;
        if (!c.passes) {
          tally[key].fail++;
          worst.push({ d: `${bname}/${bg.theme}-${bg.surface}/${card}-cards/${section.mode}/${section.surfaceLevel}/${c.label}`, ratio: c.ratio, req: c.required });
        }
      }
    }
   }
  }
}
console.log = orig;

const rows = Object.entries(tally).sort();
if (!rows.length) { console.log('NO CONTAINER SECTIONS FOUND'); process.exit(0); }
for (const [k, t] of rows) {
  const flag = t.fail ? ' ❌' : ' ✅';
  console.log(`${k.padEnd(34)} ${String(t.fail).padStart(4)} fail / ${String(t.total).padStart(4)}${flag}`);
}
console.log(`\nTOTAL failures: ${worst.length}`);
worst.sort((a, b) => a.ratio / a.req - b.ratio / b.req);
for (const w of worst.slice(0, 15)) {
  console.log(`  ${w.ratio.toFixed(2)}:1 (need ${w.req}) — ${w.d}`);
}
