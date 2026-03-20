/**
 * Verify contrast for dark mode container levels against text/header/border/quiet tokens
 * Container levels: Lowest=Color-2, Low=blend(2,3), Container=Color-3, High=blend(3,4), Highest=Color-4
 * Text tokens are mapped to the Container's Color-N in the fixed structures
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
function blendRgb(r1:number,g1:number,b1:number,r2:number,g2:number,b2:number,t:number):[number,number,number]{
  return[Math.round(r1*t+r2*(1-t)),Math.round(g1*t+g2*(1-t)),Math.round(b1*t+b2*(1-t))];
}

const HUES = [0,30,60,90,120,150,180,210,240,270,300,330];

// 12-tone scale
const TONES: Record<number, {L:number, C:number}> = {
  1: {L:1, C:70}, 2: {L:10, C:70}, 3: {L:19, C:70}, 4: {L:28, C:70}, 5: {L:37, C:62},
  6: {L:58, C:70}, 7: {L:71, C:70}, 8: {L:81, C:70}, 9: {L:90, C:70},
  10: {L:95, C:70}, 11: {L:98, C:70}, 12: {L:99, C:70},
};

// Dark mode token mappings (from verified 12-tone)
// For containers, we use the Container mappings
const DARK_TEXT: Record<number, number> = { 1:9, 2:9, 3:10, 4:10, 5:11, 6:1, 7:1, 8:2, 9:2, 10:3, 11:4, 12:4 };
const DARK_HEADER: Record<number, number> = { 1:9, 2:9, 3:10, 4:9, 5:11, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };
const DARK_BORDER: Record<number, number> = { 1:6, 2:6, 3:7, 4:8, 5:8, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };
const DARK_QUIET: Record<number, number> = { 1:6, 2:6, 3:8, 4:8, 5:10, 6:2, 7:3, 8:4, 9:5, 10:5, 11:5, 12:5 };

interface ContainerLevel {
  name: string;
  colorN: number; // which Color-N the tokens are mapped to
  getActualBg: (hue: number) => [number, number, number]; // actual RGB of this container level
}

function worstContrast(
  getBg: (hue: number) => [number, number, number],
  fgN: number,
): { worst: number; worstHue: number } {
  const fg = TONES[fgN];
  let worst = Infinity, worstHue = 0;
  for (const bgH of HUES) {
    const bgRgb = getBg(bgH);
    const bgLum = rgbLum(bgRgb[0], bgRgb[1], bgRgb[2]);
    for (const fgH of HUES) {
      const fgRgb = lchToRgb(fg.L, fg.C, fgH);
      const fgLum = rgbLum(fgRgb[0], fgRgb[1], fgRgb[2]);
      const ratio = cr(bgLum, fgLum);
      if (ratio < worst) { worst = ratio; worstHue = bgH; }
    }
  }
  return { worst, worstHue };
}

console.log('█'.repeat(90));
console.log('  Dark Mode Container Contrast Verification');
console.log('  Lowest=C2, Low=blend(C2,C3), Container=C3, High=blend(C3,C4), Highest=C4');
console.log('█'.repeat(90));

// Define container levels
const levels: ContainerLevel[] = [
  {
    name: 'Lowest (Color-2)',
    colorN: 2,
    getActualBg: (hue) => lchToRgb(TONES[2].L, TONES[2].C, hue),
  },
  {
    name: 'Low (blend C2+C3)',
    colorN: 2, // tokens mapped to Color-2 (closer to lowest)
    getActualBg: (hue) => {
      const c2 = lchToRgb(TONES[2].L, TONES[2].C, hue);
      const c3 = lchToRgb(TONES[3].L, TONES[3].C, hue);
      return blendRgb(c3[0],c3[1],c3[2], c2[0],c2[1],c2[2], 0.5);
    },
  },
  {
    name: 'Container (Color-3)',
    colorN: 3,
    getActualBg: (hue) => lchToRgb(TONES[3].L, TONES[3].C, hue),
  },
  {
    name: 'High (blend C3+C4)',
    colorN: 3, // tokens mapped to Color-3 (closer to container)
    getActualBg: (hue) => {
      const c3 = lchToRgb(TONES[3].L, TONES[3].C, hue);
      const c4 = lchToRgb(TONES[4].L, TONES[4].C, hue);
      return blendRgb(c4[0],c4[1],c4[2], c3[0],c3[1],c3[2], 0.5);
    },
  },
  {
    name: 'Highest (Color-4)',
    colorN: 4,
    getActualBg: (hue) => lchToRgb(TONES[4].L, TONES[4].C, hue),
  },
];

let totalFail = 0;

for (const level of levels) {
  console.log(`\n  ${level.name} — tokens mapped to Color-${level.colorN}`);
  console.log('  ' + '-'.repeat(80));

  const checks = [
    { name: 'Text', fgN: DARK_TEXT[level.colorN], required: 4.5 },
    { name: 'Header', fgN: DARK_HEADER[level.colorN], required: 3.1 },
    { name: 'Border', fgN: DARK_BORDER[level.colorN], required: 3.1 },
    { name: 'Quiet', fgN: DARK_QUIET[level.colorN], required: 2.5 },
  ];

  for (const check of checks) {
    const { worst, worstHue } = worstContrast(level.getActualBg, check.fgN);
    const pass = worst >= check.required;
    if (!pass) totalFail++;
    const status = !pass ? '❌ FAIL' : worst < check.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
    console.log(
      `    ${check.name.padEnd(8)} → Color-${check.fgN.toString().padEnd(3)} ` +
      `worst=${worst.toFixed(2)}:1 (need ${check.required}:1) ${status}`
    );
  }

  // Also test with Color-3 tokens on blended backgrounds (Low uses C2 tokens, High uses C3)
  // But let's also check what happens if we use the ACTUAL container colorN tokens
}

// Also test blended levels with BOTH adjacent token mappings
console.log('\n' + '='.repeat(90));
console.log('  Blended levels: testing with BOTH adjacent token mappings');
console.log('='.repeat(90));

const blendedTests = [
  { name: 'Low (blend C2+C3)', getActualBg: levels[1].getActualBg, tokenOptions: [2, 3] },
  { name: 'High (blend C3+C4)', getActualBg: levels[3].getActualBg, tokenOptions: [3, 4] },
];

for (const bt of blendedTests) {
  for (const tokenN of bt.tokenOptions) {
    console.log(`\n  ${bt.name} with Color-${tokenN} tokens:`);
    const checks = [
      { name: 'Text', fgN: DARK_TEXT[tokenN], required: 4.5 },
      { name: 'Header', fgN: DARK_HEADER[tokenN], required: 3.1 },
      { name: 'Border', fgN: DARK_BORDER[tokenN], required: 3.1 },
      { name: 'Quiet', fgN: DARK_QUIET[tokenN], required: 2.5 },
    ];
    for (const check of checks) {
      const { worst } = worstContrast(bt.getActualBg, check.fgN);
      const pass = worst >= check.required;
      if (!pass) totalFail++;
      const status = !pass ? '❌ FAIL' : worst < check.required * 1.15 ? '⚠️  CLOSE' : '✅ PASS';
      console.log(
        `    ${check.name.padEnd(8)} → Color-${check.fgN.toString().padEnd(3)} ` +
        `worst=${worst.toFixed(2)}:1 (need ${check.required}:1) ${status}`
      );
    }
  }
}

console.log('\n' + '█'.repeat(90));
console.log(totalFail === 0 ? '  ✅ ALL CONTAINER CONTRASTS PASS' : `  ⚠️  ${totalFail} FAILURES`);
console.log('█'.repeat(90) + '\n');
