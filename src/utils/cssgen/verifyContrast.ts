/**
 * WCAG Contrast Verification for DinoDesign Fixed Structures
 *
 * Converts LCH colors (max chroma 70) → sRGB → relative luminance → WCAG contrast ratio
 * Tests all fixed structure mappings (Text, Header, Quiet, Border, Hover, Active)
 * across multiple hues to find worst-case contrast.
 *
 * Run: npx tsx src/utils/cssgen/verifyContrast.ts
 */

// ============================================================
// Color Conversion: LCH → Lab → XYZ → sRGB → Relative Luminance
// ============================================================

const DEG_TO_RAD = Math.PI / 180;

/** CIE LCH → CIE Lab */
function lchToLab(L: number, C: number, H: number): [number, number, number] {
  const hRad = H * DEG_TO_RAD;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return [L, a, b];
}

/** CIE Lab → CIE XYZ (D65 illuminant) */
function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  const delta3 = delta * delta * delta;

  const xr = fx > delta ? fx * fx * fx : (fx - 16 / 116) * 3 * delta * delta;
  const yr = L > 8 ? fy * fy * fy : L / (24389 / 27);
  const zr = fz > delta ? fz * fz * fz : (fz - 16 / 116) * 3 * delta * delta;

  // D65 reference white
  return [xr * 0.95047, yr * 1.0, zr * 1.08883];
}

/** CIE XYZ → linear sRGB */
function xyzToLinearRgb(X: number, Y: number, Z: number): [number, number, number] {
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return [r, g, b];
}

/** Linear sRGB → sRGB (gamma companding) */
function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Clamp to [0, 1] — gamut mapping by clipping */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** sRGB channel → relative luminance component */
function srgbToLuminanceComponent(srgb: number): number {
  return srgb <= 0.03928
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/** Full pipeline: LCH → relative luminance (WCAG) */
function lchToRelativeLuminance(L: number, C: number, H: number): number {
  const [labL, labA, labB] = lchToLab(L, C, H);
  const [X, Y, Z] = labToXyz(labL, labA, labB);
  const [lr, lg, lb] = xyzToLinearRgb(X, Y, Z);

  // Clamp to gamut (simple clip)
  const sr = clamp01(linearToSrgb(clamp01(lr)));
  const sg = clamp01(linearToSrgb(clamp01(lg)));
  const sb = clamp01(linearToSrgb(clamp01(lb)));

  const R = srgbToLuminanceComponent(sr);
  const G = srgbToLuminanceComponent(sg);
  const B = srgbToLuminanceComponent(sb);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio */
function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Tone Scale
// ============================================================

// 12-TONE SCALE: Removed L=46.6 and L=53 (mid-range dead zone)
// Testing limits: how high can Color-5 go? How low can Color-6 go?
const TONE_LIGHTNESS: Record<number, number> = {
  1: 1, 2: 10, 3: 19, 4: 28, 5: 37,
  6: 58, 7: 71, 8: 81, 9: 90,
  10: 95, 11: 98, 12: 99
};

// === EDGE FINDER: Test Color-5 and Color-6 limits ===
function findLimits() {
  console.log('\n' + '='.repeat(90));
  console.log('  EDGE FINDER: How far can Color-5 and Color-6 push toward the dead zone?');
  console.log('='.repeat(90));

  // Test Color-5 going UP (currently 37)
  // Color-5 bg needs text at Color-11 (L=98) to hit 4.5:1
  console.log('\n  Color-5 (dark bg, light text at Color-11=L98) — pushing L upward:');
  for (let L = 37; L <= 50; L++) {
    const C = 62; // max chroma for this zone
    let worstCR = Infinity;
    let worstHue = 0;
    for (const hue of [0, 60, 120, 180, 240, 300]) {
      const bgLum = lchToRelativeLuminance(L, C, hue);
      const fgLum = lchToRelativeLuminance(98, 70, hue); // Color-11 at L=98
      const cr = contrastRatio(bgLum, fgLum);
      if (cr < worstCR) { worstCR = cr; worstHue = hue; }
    }
    const status = worstCR >= 4.5 ? '✅' : '❌';
    console.log(`    L=${L.toString().padEnd(4)} worst=${worstCR.toFixed(2)}:1 at H=${worstHue}°  ${status}`);
    if (worstCR < 4.5) { console.log(`    ↑ MAX for Color-5 = L=${L - 1}`); break; }
  }

  // Test Color-6 going DOWN (currently 62)
  // Color-6 bg needs text at Color-1 (L=1) to hit 4.5:1
  console.log('\n  Color-6 (light bg, dark text at Color-1=L1) — pushing L downward:');
  for (let L = 62; L >= 50; L--) {
    const C = 70; // max chroma for this tone
    let worstCR = Infinity;
    let worstHue = 0;
    for (const hue of [0, 60, 120, 180, 240, 300]) {
      const bgLum = lchToRelativeLuminance(L, C, hue);
      const fgLum = lchToRelativeLuminance(1, 70, hue); // Color-1 at L=1
      const cr = contrastRatio(bgLum, fgLum);
      if (cr < worstCR) { worstCR = cr; worstHue = hue; }
    }
    const status = worstCR >= 4.5 ? '✅' : '❌';
    console.log(`    L=${L.toString().padEnd(4)} worst=${worstCR.toFixed(2)}:1 at H=${worstHue}°  ${status}`);
    if (worstCR < 4.5) { console.log(`    ↑ MIN for Color-6 = L=${L + 1}`); break; }
  }
}

// Max chroma varies by tone — Color-5 caps at 62
const TONE_MAX_CHROMA: Record<number, number> = {
  1: 70, 2: 70, 3: 70, 4: 70, 5: 62,
  6: 70, 7: 70, 8: 70, 9: 70,
  10: 70, 11: 70, 12: 70
};

// Test across representative hues (red, yellow, green, blue, purple)
const TEST_HUES = [0, 60, 120, 180, 240, 300];

/** Get worst-case (minimum) contrast ratio across all hues */
function worstCaseContrast(bgTone: number, fgTone: number): { min: number; maxHue: number; minHue: number; avg: number } {
  const bgL = TONE_LIGHTNESS[bgTone];
  const fgL = TONE_LIGHTNESS[fgTone];
  const bgC = TONE_MAX_CHROMA[bgTone];
  const fgC = TONE_MAX_CHROMA[fgTone];

  let min = Infinity;
  let max = 0;
  let minHue = 0;
  let maxHue = 0;
  let sum = 0;

  for (const hue of TEST_HUES) {
    // Use same hue for bg and fg (same palette), but each tone's own max chroma
    const bgLum = lchToRelativeLuminance(bgL, bgC, hue);
    const fgLum = lchToRelativeLuminance(fgL, fgC, hue);
    const cr = contrastRatio(bgLum, fgLum);
    sum += cr;
    if (cr < min) { min = cr; minHue = hue; }
    if (cr > max) { max = cr; maxHue = hue; }
  }

  return { min, maxHue, minHue, avg: sum / TEST_HUES.length };
}

/** Also test with chroma 0 (neutral/gray) for comparison */
function neutralContrast(bgTone: number, fgTone: number): number {
  const bgL = TONE_LIGHTNESS[bgTone];
  const fgL = TONE_LIGHTNESS[fgTone];
  const bgLum = lchToRelativeLuminance(bgL, 0, 0);
  const fgLum = lchToRelativeLuminance(fgL, 0, 0);
  return contrastRatio(bgLum, fgLum);
}

// ============================================================
// Fixed Structure Mappings
// ============================================================

interface Mapping {
  [bgTone: number]: number; // bg tone → fg tone
}

// === 12-TONE MAPPINGS ===
// Scale: 1=1, 2=10, 3=19, 4=28, 5=37, 6=62, 7=71, 8=81, 9=90, 10=95, 11=98, 12=99
// Flip point: between Color-5 (L=37) and Color-6 (L=62)
// Dark backgrounds (1-5) → light text (9+)
// Light backgrounds (6-12) → dark text (1-4)

// LIGHT MODE TEXT (Surfaces) — 4.5:1 required
const LIGHT_TEXT_SURFACES: Mapping = {
  1: 9, 2: 9, 3: 9, 4: 9, 5: 11,
  6: 1, 7: 1,
  8: 2, 9: 2, 10: 3, 11: 4, 12: 4
};

// LIGHT MODE TEXT (Containers) — 4.5:1 required
const LIGHT_TEXT_CONTAINERS: Mapping = {
  1: 9, 2: 9, 3: 9, 4: 9, 5: 10,
  6: 1, 7: 1,
  8: 2, 9: 2, 10: 3, 11: 4, 12: 4
};

// DARK MODE TEXT (Surfaces) — 4.5:1 required
const DARK_TEXT_SURFACES: Mapping = {
  1: 9, 2: 9, 3: 10, 4: 10, 5: 12,
  6: 1, 7: 1,
  8: 2, 9: 2, 10: 3, 11: 4, 12: 4
};

// LIGHT MODE HEADER (Surfaces) — 3.1:1 required (large text)
const LIGHT_HEADER_SURFACES: Mapping = {
  1: 10, 2: 10, 3: 10, 4: 10, 5: 8,
  6: 2, 7: 3,
  8: 4, 9: 5, 10: 5, 11: 5, 12: 5
};

// DARK MODE HEADER (Surfaces) — 3.1:1 required
const DARK_HEADER_SURFACES: Mapping = {
  1: 9, 2: 9, 3: 10, 4: 9, 5: 11,
  6: 2, 7: 3,
  8: 4, 9: 5, 10: 5, 11: 5, 12: 5
};

// LIGHT MODE QUIET (Surfaces) — 2.5:1 decorative
const LIGHT_QUIET_SURFACES: Mapping = {
  1: 6, 2: 6, 3: 7, 4: 8, 5: 9,
  6: 2, 7: 3, 8: 4, 9: 5,
  10: 5, 11: 5, 12: 5
};

// DARK MODE QUIET (Surfaces) — 2.5:1 decorative
const DARK_QUIET_SURFACES: Mapping = {
  1: 6, 2: 6, 3: 8, 4: 8, 5: 10,
  6: 2, 7: 3, 8: 4,
  9: 5, 10: 5, 11: 5, 12: 5
};

// LIGHT MODE BORDER (Surfaces) — 3.1:1 required
const LIGHT_BORDER_SURFACES: Mapping = {
  1: 6, 2: 6, 3: 7, 4: 9, 5: 10,
  6: 2, 7: 4, 8: 4,
  9: 5, 10: 5, 11: 5, 12: 5
};

// DARK MODE BORDER (Surfaces) — 3.1:1 required
const DARK_BORDER_SURFACES: Mapping = {
  1: 6, 2: 6, 3: 7, 4: 8, 5: 9,
  6: 2, 7: 3,
  8: 4, 9: 5, 10: 5, 11: 5, 12: 5
};

// HOVER — visual distinction (wider jumps at light end)
const HOVER: Mapping = {
  1: 3, 2: 4, 3: 4, 4: 3, 5: 4,
  6: 7, 7: 8, 8: 7,
  9: 8, 10: 8, 11: 8, 12: 8
};

// ACTIVE — visual distinction (larger shift, wider at light end)
const ACTIVE: Mapping = {
  1: 4, 2: 4, 3: 5, 4: 3, 5: 6,
  6: 8, 7: 9, 8: 6,
  9: 7, 10: 7, 11: 7, 12: 7
};

// ============================================================
// WCAG Requirements
// ============================================================

interface WcagRequirement {
  name: string;
  ratio: number; // minimum contrast ratio
  level: string;
}

const WCAG_TEXT_AA: WcagRequirement = { name: 'Text AA', ratio: 4.5, level: 'AA (normal text)' };
const WCAG_TEXT_AAA: WcagRequirement = { name: 'Text AAA', ratio: 7.0, level: 'AAA (normal text)' };
const WCAG_LARGE_AA: WcagRequirement = { name: 'Large Text AA', ratio: 3.1, level: 'AA (large text / headers)' };
const WCAG_UI_AA: WcagRequirement = { name: 'UI Component AA', ratio: 3.1, level: 'AA (UI components / borders)' };
// Quiet text is intentionally lower contrast — 2.5:1 is a reasonable minimum
const WCAG_QUIET: WcagRequirement = { name: 'Quiet (decorative)', ratio: 2.5, level: 'Decorative minimum' };
// Hover/Active need visual distinction, not contrast against text
const WCAG_DISTINCTION: WcagRequirement = { name: 'Visual Distinction', ratio: 1.1, level: 'Visible shift' };

// ============================================================
// Test Runner
// ============================================================

interface TestResult {
  bgTone: number;
  fgTone: number;
  bgL: number;
  fgL: number;
  worstContrast: number;
  worstHue: number;
  neutralContrast: number;
  avgContrast: number;
  required: number;
  pass: boolean;
  margin: string; // how much above/below requirement
}

function testMapping(
  name: string,
  mapping: Mapping,
  requirement: WcagRequirement
): { name: string; results: TestResult[]; failures: TestResult[]; warnings: TestResult[] } {
  const results: TestResult[] = [];

  for (const [bgStr, fgTone] of Object.entries(mapping)) {
    const bgTone = parseInt(bgStr);
    const worst = worstCaseContrast(bgTone, fgTone);
    const neutral = neutralContrast(bgTone, fgTone);

    const pass = worst.min >= requirement.ratio;
    const margin = ((worst.min / requirement.ratio - 1) * 100).toFixed(1);

    results.push({
      bgTone,
      fgTone,
      bgL: TONE_LIGHTNESS[bgTone],
      fgL: TONE_LIGHTNESS[fgTone],
      worstContrast: worst.min,
      worstHue: worst.minHue,
      neutralContrast: neutral,
      avgContrast: worst.avg,
      required: requirement.ratio,
      pass,
      margin: pass ? `+${margin}%` : `${margin}%`
    });
  }

  const failures = results.filter(r => !r.pass);
  const warnings = results.filter(r => r.pass && r.worstContrast < requirement.ratio * 1.15); // within 15% of limit

  return { name, results, failures, warnings };
}

// ============================================================
// Output
// ============================================================

function printReport(testSuite: ReturnType<typeof testMapping>, requirement: WcagRequirement) {
  const { name, results, failures, warnings } = testSuite;

  console.log(`\n${'='.repeat(90)}`);
  console.log(`  ${name} — Required: ${requirement.ratio}:1 (${requirement.level})`);
  console.log('='.repeat(90));

  // Table header
  console.log(
    '  BG Tone'.padEnd(12) +
    'FG Tone'.padEnd(10) +
    'BG L'.padEnd(8) +
    'FG L'.padEnd(8) +
    'Neutral'.padEnd(10) +
    'Worst'.padEnd(10) +
    'Worst Hue'.padEnd(12) +
    'Avg'.padEnd(10) +
    'Margin'.padEnd(10) +
    'Status'
  );
  console.log('  ' + '-'.repeat(88));

  for (const r of results) {
    const status = !r.pass ? '❌ FAIL' : r.worstContrast < r.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
    console.log(
      `  Color-${r.bgTone}`.padEnd(12) +
      `Color-${r.fgTone}`.padEnd(10) +
      `${r.bgL}`.padEnd(8) +
      `${r.fgL}`.padEnd(8) +
      `${r.neutralContrast.toFixed(2)}:1`.padEnd(10) +
      `${r.worstContrast.toFixed(2)}:1`.padEnd(10) +
      `H=${r.worstHue}°`.padEnd(12) +
      `${r.avgContrast.toFixed(2)}:1`.padEnd(10) +
      `${r.margin}`.padEnd(10) +
      status
    );
  }

  if (failures.length > 0) {
    console.log(`\n  ❌ ${failures.length} FAILURE(S):`);
    for (const f of failures) {
      console.log(`     Color-${f.bgTone} (L=${f.bgL}) → Color-${f.fgTone} (L=${f.fgL}): ${f.worstContrast.toFixed(2)}:1 at hue ${f.worstHue}° (need ${f.required}:1)`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  ⚠️  ${warnings.length} WARNING(S) (within 15% of limit):`);
    for (const w of warnings) {
      console.log(`     Color-${w.bgTone} (L=${w.bgL}) → Color-${w.fgTone} (L=${w.fgL}): ${w.worstContrast.toFixed(2)}:1 at hue ${w.worstHue}°`);
    }
  }

  if (failures.length === 0 && warnings.length === 0) {
    console.log(`\n  ✅ All ${results.length} pairings pass with comfortable margin`);
  }

  return { failures: failures.length, warnings: warnings.length };
}

// ============================================================
// Suggestion Engine
// ============================================================

function suggestFix(bgTone: number, currentFgTone: number, required: number): string {
  // Try each possible fg tone and find the closest one that passes
  const candidates: { tone: number; worst: number }[] = [];

  for (let t = 1; t <= 14; t++) {
    if (t === bgTone) continue;
    const worst = worstCaseContrast(bgTone, t);
    if (worst.min >= required) {
      candidates.push({ tone: t, worst: worst.min });
    }
  }

  if (candidates.length === 0) return 'No single tone meets requirement at max chroma — consider reducing chroma';

  // Sort by closest to current tone (minimal visual disruption)
  candidates.sort((a, b) => Math.abs(a.tone - currentFgTone) - Math.abs(b.tone - currentFgTone));

  const best = candidates[0];
  const direction = best.tone > bgTone ? 'lighter' : 'darker';
  return `→ Color-${best.tone} (L=${TONE_LIGHTNESS[best.tone]}, ${direction}, contrast ${best.worst.toFixed(2)}:1)`;
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log('\n' + '█'.repeat(90));
  console.log('  DinoDesign Accessibility Contrast Verification');
  console.log('  LCH Max Chroma: 70 (62 for tones 5-7) | Tone Scale: 14 tones | Testing 6 hues');
  console.log('█'.repeat(90));

  let totalFailures = 0;
  let totalWarnings = 0;

  // 1. TEXT
  const lightText = testMapping('LIGHT MODE — Text to Background (Surfaces)', LIGHT_TEXT_SURFACES, WCAG_TEXT_AA);
  const r1 = printReport(lightText, WCAG_TEXT_AA);
  totalFailures += r1.failures; totalWarnings += r1.warnings;

  const lightTextCont = testMapping('LIGHT MODE — Text to Background (Containers)', LIGHT_TEXT_CONTAINERS, WCAG_TEXT_AA);
  const r1c = printReport(lightTextCont, WCAG_TEXT_AA);
  totalFailures += r1c.failures; totalWarnings += r1c.warnings;

  const darkText = testMapping('DARK MODE — Text to Background (Surfaces)', DARK_TEXT_SURFACES, WCAG_TEXT_AA);
  const r2 = printReport(darkText, WCAG_TEXT_AA);
  totalFailures += r2.failures; totalWarnings += r2.warnings;

  // 2. HEADERS
  const lightHeader = testMapping('LIGHT MODE — Header to Background (Surfaces)', LIGHT_HEADER_SURFACES, WCAG_LARGE_AA);
  const r3 = printReport(lightHeader, WCAG_LARGE_AA);
  totalFailures += r3.failures; totalWarnings += r3.warnings;

  const darkHeader = testMapping('DARK MODE — Header to Background (Surfaces)', DARK_HEADER_SURFACES, WCAG_LARGE_AA);
  const r4 = printReport(darkHeader, WCAG_LARGE_AA);
  totalFailures += r4.failures; totalWarnings += r4.warnings;

  // 3. QUIET
  const lightQuiet = testMapping('LIGHT MODE — Quiet to Background (Surfaces)', LIGHT_QUIET_SURFACES, WCAG_QUIET);
  const r5 = printReport(lightQuiet, WCAG_QUIET);
  totalFailures += r5.failures; totalWarnings += r5.warnings;

  const darkQuiet = testMapping('DARK MODE — Quiet to Background (Surfaces)', DARK_QUIET_SURFACES, WCAG_QUIET);
  const r6 = printReport(darkQuiet, WCAG_QUIET);
  totalFailures += r6.failures; totalWarnings += r6.warnings;

  // 4. BORDERS
  const lightBorder = testMapping('LIGHT MODE — Border to Background (Surfaces)', LIGHT_BORDER_SURFACES, WCAG_UI_AA);
  const r7 = printReport(lightBorder, WCAG_UI_AA);
  totalFailures += r7.failures; totalWarnings += r7.warnings;

  const darkBorder = testMapping('DARK MODE — Border to Background (Surfaces)', DARK_BORDER_SURFACES, WCAG_UI_AA);
  const r8 = printReport(darkBorder, WCAG_UI_AA);
  totalFailures += r8.failures; totalWarnings += r8.warnings;

  // 5. HOVER (visual distinction from base, not text contrast)
  const hover = testMapping('HOVER — Visual Distinction from Base', HOVER, WCAG_DISTINCTION);
  const r9 = printReport(hover, WCAG_DISTINCTION);
  totalFailures += r9.failures; totalWarnings += r9.warnings;

  // 6. ACTIVE (visual distinction from base)
  const active = testMapping('ACTIVE — Visual Distinction from Base', ACTIVE, WCAG_DISTINCTION);
  const r10 = printReport(active, WCAG_DISTINCTION);
  totalFailures += r10.failures; totalWarnings += r10.warnings;

  // ============================================================
  // SUMMARY + SUGGESTIONS
  // ============================================================
  console.log('\n' + '█'.repeat(90));
  console.log('  SUMMARY');
  console.log('█'.repeat(90));
  console.log(`  Total Failures: ${totalFailures}`);
  console.log(`  Total Warnings: ${totalWarnings}`);

  if (totalFailures > 0) {
    console.log('\n  SUGGESTED FIXES:');
    console.log('  ' + '-'.repeat(88));

    const allTests = [
      { test: lightText, req: WCAG_TEXT_AA, label: 'Light Text Surfaces' },
      { test: lightTextCont, req: WCAG_TEXT_AA, label: 'Light Text Containers' },
      { test: darkText, req: WCAG_TEXT_AA, label: 'Dark Text Surfaces' },
      { test: lightHeader, req: WCAG_LARGE_AA, label: 'Light Header Surfaces' },
      { test: darkHeader, req: WCAG_LARGE_AA, label: 'Dark Header Surfaces' },
      { test: lightQuiet, req: WCAG_QUIET, label: 'Light Quiet Surfaces' },
      { test: darkQuiet, req: WCAG_QUIET, label: 'Dark Quiet Surfaces' },
      { test: lightBorder, req: WCAG_UI_AA, label: 'Light Border Surfaces' },
      { test: darkBorder, req: WCAG_UI_AA, label: 'Dark Border Surfaces' },
    ];

    for (const { test, req, label } of allTests) {
      if (test.failures.length > 0) {
        console.log(`\n  ${label}:`);
        for (const f of test.failures) {
          const suggestion = suggestFix(f.bgTone, f.fgTone, req.ratio);
          console.log(`    BG Color-${f.bgTone} currently → Color-${f.fgTone} (${f.worstContrast.toFixed(2)}:1)`);
          console.log(`      Fix: ${suggestion}`);
        }
      }
    }
  }

  console.log('\n' + '█'.repeat(90));
  console.log(totalFailures === 0
    ? '  ✅ ALL CONTRAST CHECKS PASSED'
    : `  ⚠️  ${totalFailures} PAIRINGS NEED ADJUSTMENT`
  );
  console.log('█'.repeat(90) + '\n');
}

main();
findLimits();
