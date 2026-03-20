/**
 * Test Surface-Dim and Surface-Bright contrast against text/header/border tokens
 *
 * Surface-Dim = blend base surface with #050505
 * Surface-Bright = blend base surface with #FFFFFF
 *
 * We need to verify that the shifted lightness still maintains contrast
 * with the tokens mapped to the BASE surface tone.
 */

const DEG_TO_RAD = Math.PI / 180;

function lchToLab(L: number, C: number, H: number): [number, number, number] {
  const h = H * DEG_TO_RAD;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const d = 6 / 29;
  const xr = fx > d ? fx ** 3 : (fx - 16 / 116) * 3 * d * d;
  const yr = L > 8 ? fy ** 3 : L / (24389 / 27);
  const zr = fz > d ? fz ** 3 : (fz - 16 / 116) * 3 * d * d;
  return [xr * 0.95047, yr, zr * 1.08883];
}

function xyzToLinearRgb(X: number, Y: number, Z: number): [number, number, number] {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
  ];
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

function srgbToLumComponent(s: number): number {
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** LCH → sRGB [0-255] */
function lchToRgb(L: number, C: number, H: number): [number, number, number] {
  const [labL, labA, labB] = lchToLab(L, C, H);
  const [X, Y, Z] = labToXyz(labL, labA, labB);
  const [lr, lg, lb] = xyzToLinearRgb(X, Y, Z);
  return [
    Math.round(clamp01(linearToSrgb(clamp01(lr))) * 255),
    Math.round(clamp01(linearToSrgb(clamp01(lg))) * 255),
    Math.round(clamp01(linearToSrgb(clamp01(lb))) * 255)
  ];
}

/** Get relative luminance from RGB [0-255] */
function rgbToLuminance(r: number, g: number, b: number): number {
  const sr = r / 255, sg = g / 255, sb = b / 255;
  return 0.2126 * srgbToLumComponent(sr) + 0.7152 * srgbToLumComponent(sg) + 0.0722 * srgbToLumComponent(sb);
}

function lchToLuminance(L: number, C: number, H: number): number {
  const [r, g, b] = lchToRgb(L, C, H);
  return rgbToLuminance(r, g, b);
}

function contrastRatio(lum1: number, lum2: number): number {
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

/** Blend foreground RGB onto background RGB at given opacity */
function blendRgb(
  fgR: number, fgG: number, fgB: number,
  bgR: number, bgG: number, bgB: number,
  fgOpacity: number
): [number, number, number] {
  return [
    Math.round(fgR * fgOpacity + bgR * (1 - fgOpacity)),
    Math.round(fgG * fgOpacity + bgG * (1 - fgOpacity)),
    Math.round(fgB * fgOpacity + bgB * (1 - fgOpacity))
  ];
}

// ============================================================
// 12-Tone Scale
// ============================================================

const TONES: { color: number; L: number; maxC: number }[] = [
  { color: 1, L: 1, maxC: 70 },
  { color: 2, L: 10, maxC: 70 },
  { color: 3, L: 19, maxC: 70 },
  { color: 4, L: 28, maxC: 70 },
  { color: 5, L: 37, maxC: 62 },
  { color: 6, L: 58, maxC: 70 },
  { color: 7, L: 71, maxC: 70 },
  { color: 8, L: 81, maxC: 70 },
  { color: 9, L: 90, maxC: 70 },
  { color: 10, L: 95, maxC: 70 },
  { color: 11, L: 98, maxC: 70 },
  { color: 12, L: 99, maxC: 70 },
];

// Surface-Dim blend percentages (from exportColorSystem.ts)
// These are for dark mode backgrounds but we'll test all
const SURFACE_DIM_BLEND: Record<number, number> = {
  1: 0.60, 2: 0.50, 3: 0.60, 4: 0.40, 5: 0.24,
  6: 0.10, 7: 0.09, 8: 0.08, 9: 0.08, 10: 0.08, 11: 0.04, 12: 0.04
};

const SURFACE_BRIGHT_BLEND: Record<number, number> = {
  1: 0.10, 2: 0.10, 3: 0.10, 4: 0.10, 5: 0.12,
  6: 0.12, 7: 0.15, 8: 0.20, 9: 0.25, 10: 0.30, 11: 0.18, 12: 0.15
};

// Token mappings (from verified 12-tone)
const TEXT_MAP: Record<number, number> = {
  1: 9, 2: 9, 3: 9, 4: 9, 5: 11,
  6: 1, 7: 1, 8: 2, 9: 2, 10: 3, 11: 4, 12: 4
};

const HEADER_MAP: Record<number, number> = {
  1: 10, 2: 10, 3: 10, 4: 10, 5: 8,
  6: 2, 7: 3, 8: 4, 9: 5, 10: 5, 11: 5, 12: 5
};

const BORDER_MAP: Record<number, number> = {
  1: 6, 2: 6, 3: 7, 4: 9, 5: 10,
  6: 2, 7: 4, 8: 4, 9: 5, 10: 5, 11: 5, 12: 5
};

const TEST_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

interface Result {
  baseTone: number;
  variant: string;
  category: string;
  fgTone: number;
  worstCR: number;
  worstHue: number;
  required: number;
  pass: boolean;
  baseCR: number; // contrast with base surface for comparison
}

function testVariant(
  baseToneNum: number,
  variant: 'Surface-Dim' | 'Surface-Bright',
  category: string,
  fgToneNum: number,
  required: number
): Result {
  const baseTone = TONES.find(t => t.color === baseToneNum)!;
  const fgTone = TONES.find(t => t.color === fgToneNum)!;

  const blendPct = variant === 'Surface-Dim'
    ? SURFACE_DIM_BLEND[baseToneNum]
    : SURFACE_BRIGHT_BLEND[baseToneNum];

  const blendColor: [number, number, number] = variant === 'Surface-Dim'
    ? [5, 5, 5]   // #050505
    : [255, 255, 255]; // #FFFFFF

  let worstCR = Infinity;
  let worstHue = 0;
  let baseCR = Infinity;

  for (const hue of TEST_HUES) {
    // Base surface color at this hue
    const baseRgb = lchToRgb(baseTone.L, baseTone.maxC, hue);

    // Blend to get Surface-Dim or Surface-Bright
    const blendedRgb = blendRgb(
      blendColor[0], blendColor[1], blendColor[2],
      baseRgb[0], baseRgb[1], baseRgb[2],
      blendPct
    );
    const blendedLum = rgbToLuminance(blendedRgb[0], blendedRgb[1], blendedRgb[2]);

    // Foreground (text/header/border) — test same hue AND cross-palette worst case
    for (const fgHue of TEST_HUES) {
      const fgLum = lchToLuminance(fgTone.L, fgTone.maxC, fgHue);
      const cr = contrastRatio(blendedLum, fgLum);
      if (cr < worstCR) { worstCR = cr; worstHue = hue; }
    }

    // Also compute base (unblended) contrast for comparison
    const baseLum = rgbToLuminance(baseRgb[0], baseRgb[1], baseRgb[2]);
    for (const fgHue of TEST_HUES) {
      const fgLum = lchToLuminance(fgTone.L, fgTone.maxC, fgHue);
      const cr = contrastRatio(baseLum, fgLum);
      if (cr < baseCR) baseCR = cr;
    }
  }

  return {
    baseTone: baseToneNum,
    variant,
    category,
    fgTone: fgToneNum,
    worstCR,
    worstHue,
    required,
    pass: worstCR >= required,
    baseCR
  };
}

// ============================================================
// Main
// ============================================================

console.log('█'.repeat(90));
console.log('  Surface-Dim & Surface-Bright Contrast Verification');
console.log('  12-Tone Scale | Cross-palette | 12 hues');
console.log('█'.repeat(90));

const allResults: Result[] = [];

for (const tone of TONES) {
  const n = tone.color;
  const textFg = TEXT_MAP[n];
  const headerFg = HEADER_MAP[n];
  const borderFg = BORDER_MAP[n];

  // Surface-Dim
  allResults.push(testVariant(n, 'Surface-Dim', 'Text', textFg, 4.5));
  allResults.push(testVariant(n, 'Surface-Dim', 'Header', headerFg, 3.1));
  allResults.push(testVariant(n, 'Surface-Dim', 'Border', borderFg, 3.1));

  // Surface-Bright
  allResults.push(testVariant(n, 'Surface-Bright', 'Text', textFg, 4.5));
  allResults.push(testVariant(n, 'Surface-Bright', 'Header', headerFg, 3.1));
  allResults.push(testVariant(n, 'Surface-Bright', 'Border', borderFg, 3.1));
}

// Print results grouped by variant
for (const variant of ['Surface-Dim', 'Surface-Bright'] as const) {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  ${variant}`);
  console.log('='.repeat(90));
  console.log(
    '  Base'.padEnd(10) +
    'Category'.padEnd(10) +
    'FG Tone'.padEnd(10) +
    'Base CR'.padEnd(12) +
    `${variant} CR`.padEnd(14) +
    'Required'.padEnd(10) +
    'Δ'.padEnd(8) +
    'Status'
  );
  console.log('  ' + '-'.repeat(80));

  const variantResults = allResults.filter(r => r.variant === variant);
  for (const r of variantResults) {
    const delta = ((r.worstCR / r.baseCR - 1) * 100).toFixed(1);
    const status = !r.pass ? '❌ FAIL' : r.worstCR < r.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
    console.log(
      `  C-${r.baseTone}`.padEnd(10) +
      r.category.padEnd(10) +
      `C-${r.fgTone}`.padEnd(10) +
      `${r.baseCR.toFixed(2)}:1`.padEnd(12) +
      `${r.worstCR.toFixed(2)}:1`.padEnd(14) +
      `${r.required}:1`.padEnd(10) +
      `${delta}%`.padEnd(8) +
      status
    );
  }
}

// Summary
const failures = allResults.filter(r => !r.pass);
const warnings = allResults.filter(r => r.pass && r.worstCR < r.required * 1.15);

console.log(`\n${'█'.repeat(90)}`);
console.log(`  SUMMARY: ${failures.length} failures, ${warnings.length} warnings out of ${allResults.length} tests`);

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  for (const f of failures) {
    const blendPct = f.variant === 'Surface-Dim' ? SURFACE_DIM_BLEND[f.baseTone] : SURFACE_BRIGHT_BLEND[f.baseTone];
    console.log(`    Color-${f.baseTone} ${f.variant} (${(blendPct * 100).toFixed(0)}% blend) — ${f.category} → Color-${f.fgTone}: ${f.worstCR.toFixed(2)}:1 (need ${f.required}:1) [base was ${f.baseCR.toFixed(2)}:1]`);
  }
}

console.log('█'.repeat(90) + '\n');
