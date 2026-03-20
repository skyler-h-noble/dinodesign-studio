const DEG_TO_RAD = Math.PI / 180;
function lchToLab(L:number,C:number,H:number){const h=H*DEG_TO_RAD;return[L,C*Math.cos(h),C*Math.sin(h)];}
function labToXyz(L:number,a:number,b:number){const fy=(L+16)/116,fx=a/500+fy,fz=fy-b/200,d=6/29;const xr=fx>d?fx**3:(fx-16/116)*3*d*d;const yr=L>8?fy**3:L/(24389/27);const zr=fz>d?fz**3:(fz-16/116)*3*d*d;return[xr*0.95047,yr,zr*1.08883];}
function xyzToLrgb(X:number,Y:number,Z:number){return[3.2404542*X-1.5371385*Y-0.4985314*Z,-0.9692660*X+1.8760108*Y+0.0415560*Z,0.0556434*X-0.2040259*Y+1.0572252*Z];}
function lin2srgb(c:number){return c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055;}
function clamp(v:number){return Math.max(0,Math.min(1,v));}
function srgb2lum(s:number){return s<=0.03928?s/12.92:((s+0.055)/1.055)**2.4;}
function lch2lum(L:number,C:number,H:number){const[l,a,b]=lchToLab(L,C,H);const[X,Y,Z]=labToXyz(l,a,b);const[r,g,bl]=xyzToLrgb(X,Y,Z);const sr=clamp(lin2srgb(clamp(r))),sg=clamp(lin2srgb(clamp(g))),sb=clamp(lin2srgb(clamp(bl)));return 0.2126*srgb2lum(sr)+0.7152*srgb2lum(sg)+0.0722*srgb2lum(sb);}
function cr(l1:number,l2:number){return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);}

// Test Color-6 (L=57) header/border → Color-3 (L=19) at EVERY degree
let worstCR = Infinity, worstHue = 0;
for (let h = 0; h < 360; h++) {
  const bgLum = lch2lum(57, 62, h);
  const fgLum = lch2lum(19, 70, h);
  const ratio = cr(bgLum, fgLum);
  if (ratio < worstCR) { worstCR = ratio; worstHue = h; }
}
console.log(`Color-6 (L=57) → Color-3 (L=19) header/border:`);
console.log(`  Worst: ${worstCR.toFixed(3)}:1 at hue ${worstHue}°`);
console.log(`  Pass 3.1:1? ${worstCR >= 3.1 ? '✅ YES' : '❌ NO'}`);

// Test Color-6 (L=57) text → Color-1 (L=1) at EVERY degree
worstCR = Infinity; worstHue = 0;
for (let h = 0; h < 360; h++) {
  const bgLum = lch2lum(57, 62, h);
  const fgLum = lch2lum(1, 70, h);
  const ratio = cr(bgLum, fgLum);
  if (ratio < worstCR) { worstCR = ratio; worstHue = h; }
}
console.log(`\nColor-6 (L=57) → Color-1 (L=1) text:`);
console.log(`  Worst: ${worstCR.toFixed(3)}:1 at hue ${worstHue}°`);
console.log(`  Pass 4.5:1? ${worstCR >= 4.5 ? '✅ YES' : '❌ NO'}`);

// Cross-palette: bg and fg at DIFFERENT hues
console.log(`\n--- Cross-palette (different hues bg vs fg) ---`);
worstCR = Infinity; let worstBgH = 0, worstFgH = 0;
for (let bgH = 0; bgH < 360; bgH += 5) {
  for (let fgH = 0; fgH < 360; fgH += 5) {
    const bgLum = lch2lum(57, 62, bgH);
    const fgLum = lch2lum(19, 70, fgH);
    const ratio = cr(bgLum, fgLum);
    if (ratio < worstCR) { worstCR = ratio; worstBgH = bgH; worstFgH = fgH; }
  }
}
console.log(`Color-6 → Color-3 cross-palette:`);
console.log(`  Worst: ${worstCR.toFixed(3)}:1 at bgH=${worstBgH}° fgH=${worstFgH}°`);
console.log(`  Pass 3.1:1? ${worstCR >= 3.1 ? '✅ YES' : '❌ NO'}`);

worstCR = Infinity;
for (let bgH = 0; bgH < 360; bgH += 5) {
  for (let fgH = 0; fgH < 360; fgH += 5) {
    const bgLum = lch2lum(57, 62, bgH);
    const fgLum = lch2lum(1, 70, fgH);
    const ratio = cr(bgLum, fgLum);
    if (ratio < worstCR) { worstCR = ratio; worstBgH = bgH; worstFgH = fgH; }
  }
}
console.log(`\nColor-6 → Color-1 cross-palette:`);
console.log(`  Worst: ${worstCR.toFixed(3)}:1 at bgH=${worstBgH}° fgH=${worstFgH}°`);
console.log(`  Pass 4.5:1? ${worstCR >= 4.5 ? '✅ YES' : '❌ NO'}`);

// Test L=58 against ALL possible foreground tones cross-palette
console.log(`\n--- L=58 cross-palette: every fg tone ---`);
const fgTones = [[1,1,70],[2,10,70],[3,19,70],[4,28,70],[5,37,62]];
for (const [name, fgL, fgC] of fgTones) {
  worstCR = Infinity;
  for (let bgH = 0; bgH < 360; bgH += 5) {
    for (let fgH = 0; fgH < 360; fgH += 5) {
      const ratio = cr(lch2lum(58, 62, bgH), lch2lum(fgL, fgC, fgH));
      if (ratio < worstCR) { worstCR = ratio; worstBgH = bgH; worstFgH = fgH; }
    }
  }
  console.log(`L=58 → Color-${name} (L=${fgL}): worst ${worstCR.toFixed(3)}:1 | text 4.5? ${worstCR >= 4.5 ? '✅' : '❌'} | hdr 3.1? ${worstCR >= 3.1 ? '✅' : '❌'}`);
}

// Also test L=59, 60, 61, 62 for the same
for (const testL of [59, 60, 61, 62]) {
  console.log(`\n--- L=${testL} cross-palette ---`);
  for (const [name, fgL, fgC] of fgTones) {
    worstCR = Infinity;
    for (let bgH = 0; bgH < 360; bgH += 5) {
      for (let fgH = 0; fgH < 360; fgH += 5) {
        const ratio = cr(lch2lum(testL, 62, bgH), lch2lum(fgL, fgC, fgH));
        if (ratio < worstCR) { worstCR = ratio; }
      }
    }
    console.log(`L=${testL} → Color-${name} (L=${fgL}): worst ${worstCR.toFixed(3)}:1 | text 4.5? ${worstCR >= 4.5 ? '✅' : '❌'} | hdr 3.1? ${worstCR >= 3.1 ? '✅' : '❌'}`);
  }
}
