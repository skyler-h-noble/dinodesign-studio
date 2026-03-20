/**
 * Verify contrast for ALL dark mode surfaces against text/header/border/quiet tokens
 * Surface = Color-2, Surface-Dim = Color-1, Surface-Bright = Color-3
 * Plus test Surface-Dim and Surface-Bright with their adjacent tone tokens
 */

const DEG_TO_RAD = Math.PI / 180;
function lchToLab(L:number,C:number,H:number){const h=H*DEG_TO_RAD;return[L,C*Math.cos(h),C*Math.sin(h)];}
function labToXyz(L:number,a:number,b:number){const fy=(L+16)/116,fx=a/500+fy,fz=fy-b/200,d=6/29;const xr=fx>d?fx**3:(fx-16/116)*3*d*d;const yr=L>8?fy**3:L/(24389/27);const zr=fz>d?fz**3:(fz-16/116)*3*d*d;return[xr*0.95047,yr,zr*1.08883];}
function xyzToLrgb(X:number,Y:number,Z:number){return[3.2404542*X-1.5371385*Y-0.4985314*Z,-0.9692660*X+1.8760108*Y+0.0415560*Z,0.0556434*X-0.2040259*Y+1.0572252*Z];}
function lin2srgb(c:number){return c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055;}
function clamp(v:number){return Math.max(0,Math.min(1,v));}
function srgb2lum(s:number){return s<=0.03928?s/12.92:((s+0.055)/1.055)**2.4;}
function lchToRgb(L:number,C:number,H:number):[number,number,number]{const[l,a,b]=lchToLab(L,C,H);const[X,Y,Z]=labToXyz(l,a,b);const[lr,lg,lb]=xyzToLrgb(X,Y,Z);return[Math.round(clamp(lin2srgb(clamp(lr)))*255),Math.round(clamp(lin2srgb(clamp(lg)))*255),Math.round(clamp(lin2srgb(clamp(lb)))*255)];}
function rgbLum(r:number,g:number,b:number){return 0.2126*srgb2lum(r/255)+0.7152*srgb2lum(g/255)+0.0722*srgb2lum(b/255);}
function cr(l1:number,l2:number){return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);}

const HUES = [0,30,60,90,120,150,180,210,240,270,300,330];

const TONES: Record<number, {L:number, C:number}> = {
  1: {L:1, C:70}, 2: {L:10, C:70}, 3: {L:19, C:70}, 4: {L:28, C:70}, 5: {L:37, C:62},
  6: {L:58, C:70}, 7: {L:71, C:70}, 8: {L:81, C:70}, 9: {L:90, C:70},
  10: {L:95, C:70}, 11: {L:98, C:70}, 12: {L:99, C:70},
};

// Updated dark mode token mappings
const DARK_TEXT: Record<number, number> = { 1:9, 2:9, 3:10, 4:10, 5:12, 6:1, 7:1, 8:2, 9:2, 10:3, 11:4, 12:4 };
const DARK_HEADER: Record<number, number> = { 1:9, 2:9, 3:10, 4:9, 5:11, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };
const DARK_BORDER: Record<number, number> = { 1:6, 2:6, 3:7, 4:8, 5:9, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };
const DARK_QUIET: Record<number, number> = { 1:6, 2:6, 3:8, 4:8, 5:10, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };

function worstContrast(bgN: number, fgN: number): { worst: number; worstHue: string } {
  const bg = TONES[bgN], fg = TONES[fgN];
  let worst = Infinity, worstBgH = 0, worstFgH = 0;
  for (const bgH of HUES) {
    const bgRgb = lchToRgb(bg.L, bg.C, bgH);
    const bgLum = rgbLum(bgRgb[0], bgRgb[1], bgRgb[2]);
    for (const fgH of HUES) {
      const fgRgb = lchToRgb(fg.L, fg.C, fgH);
      const fgLum = rgbLum(fgRgb[0], fgRgb[1], fgRgb[2]);
      const ratio = cr(bgLum, fgLum);
      if (ratio < worst) { worst = ratio; worstBgH = bgH; worstFgH = fgH; }
    }
  }
  return { worst, worstHue: `bg=${worstBgH}° fg=${worstFgH}°` };
}

console.log('█'.repeat(90));
console.log('  Dark Mode Surfaces Contrast Verification');
console.log('  Surface=Color-2, Surface-Dim=Color-1, Surface-Bright=Color-3');
console.log('█'.repeat(90));

let totalFail = 0;

// Dark mode surface levels
const surfaces = [
  { name: 'Surface-Dim (Color-1, L=1)', colorN: 1 },
  { name: 'Surface (Color-2, L=10)', colorN: 2 },
  { name: 'Surface-Bright (Color-3, L=19)', colorN: 3 },
];

for (const surface of surfaces) {
  const n = surface.colorN;
  console.log(`\n  ${surface.name}`);
  console.log('  ' + '-'.repeat(80));

  const checks = [
    { name: 'Text', fgN: DARK_TEXT[n], required: 4.5 },
    { name: 'Header', fgN: DARK_HEADER[n], required: 3.1 },
    { name: 'Border', fgN: DARK_BORDER[n], required: 3.1 },
    { name: 'Quiet', fgN: DARK_QUIET[n], required: 2.5 },
  ];

  for (const check of checks) {
    const { worst, worstHue } = worstContrast(n, check.fgN);
    const pass = worst >= check.required;
    if (!pass) totalFail++;
    const status = !pass ? '❌ FAIL' : worst < check.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
    console.log(
      `    ${check.name.padEnd(8)} → Color-${check.fgN.toString().padEnd(3)} (L=${TONES[check.fgN].L.toString().padEnd(3)}) ` +
      `worst=${worst.toFixed(2)}:1 (need ${check.required}:1) [${worstHue}] ${status}`
    );
  }
}

// Also test with Nav bar options
console.log('\n' + '='.repeat(90));
console.log('  Dark Mode Nav Surfaces');
console.log('  App-Bar/Status = Surface-Bright (Color-3), Nav-Bar = Surface-Dim (Color-1)');
console.log('='.repeat(90));

const navSurfaces = [
  { name: 'Status/App-Bar = Surface-Bright (Color-3)', colorN: 3 },
  { name: 'Nav-Bar = Surface-Dim (Color-1)', colorN: 1 },
  { name: 'Black Nav', colorN: 1 }, // Color-1 is essentially black
  { name: 'White Nav (Color-12, L=99)', colorN: 12 },
];

for (const nav of navSurfaces) {
  const n = nav.colorN;
  console.log(`\n  ${nav.name}`);
  console.log('  ' + '-'.repeat(80));

  const checks = [
    { name: 'Text', fgN: DARK_TEXT[n], required: 4.5 },
    { name: 'Header', fgN: DARK_HEADER[n], required: 3.1 },
    { name: 'Border', fgN: DARK_BORDER[n], required: 3.1 },
  ];

  for (const check of checks) {
    const { worst, worstHue } = worstContrast(n, check.fgN);
    const pass = worst >= check.required;
    if (!pass) totalFail++;
    const status = !pass ? '❌ FAIL' : worst < check.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
    console.log(
      `    ${check.name.padEnd(8)} → Color-${check.fgN.toString().padEnd(3)} (L=${TONES[check.fgN].L.toString().padEnd(3)}) ` +
      `worst=${worst.toFixed(2)}:1 (need ${check.required}:1) [${worstHue}] ${status}`
    );
  }
}

// Full dark mode surface test — all 12 tones as potential surfaces
console.log('\n' + '='.repeat(90));
console.log('  Full Dark Mode — All 12 tones as surfaces');
console.log('='.repeat(90));

for (let n = 1; n <= 12; n++) {
  const t = TONES[n];
  const textFg = DARK_TEXT[n];
  const hdrFg = DARK_HEADER[n];
  const borderFg = DARK_BORDER[n];
  const quietFg = DARK_QUIET[n];

  const textCR = worstContrast(n, textFg);
  const hdrCR = worstContrast(n, hdrFg);
  const borderCR = worstContrast(n, borderFg);
  const quietCR = worstContrast(n, quietFg);

  const textPass = textCR.worst >= 4.5;
  const hdrPass = hdrCR.worst >= 3.1;
  const borderPass = borderCR.worst >= 3.1;
  const quietPass = quietCR.worst >= 2.5;

  if (!textPass) totalFail++;
  if (!hdrPass) totalFail++;
  if (!borderPass) totalFail++;
  if (!quietPass) totalFail++;

  const allPass = textPass && hdrPass && borderPass && quietPass;
  const marker = allPass ? '✅' : '❌';

  console.log(
    `  C-${n.toString().padEnd(3)} L=${t.L.toString().padEnd(3)} | ` +
    `Text→C${textFg}:${textCR.worst.toFixed(2)} ${textPass?'✅':'❌'} | ` +
    `Hdr→C${hdrFg}:${hdrCR.worst.toFixed(2)} ${hdrPass?'✅':'❌'} | ` +
    `Bdr→C${borderFg}:${borderCR.worst.toFixed(2)} ${borderPass?'✅':'❌'} | ` +
    `Quiet→C${quietFg}:${quietCR.worst.toFixed(2)} ${quietPass?'✅':'❌'} ${marker}`
  );
}

console.log('\n' + '█'.repeat(90));
console.log(totalFail === 0 ? '  ✅ ALL DARK MODE SURFACE CONTRASTS PASS' : `  ⚠️  ${totalFail} FAILURES`);
console.log('█'.repeat(90) + '\n');
