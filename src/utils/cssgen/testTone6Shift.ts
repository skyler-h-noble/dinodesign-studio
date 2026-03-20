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
function blendRgb(fr:number,fg:number,fb:number,br:number,bg:number,bb:number,op:number):[number,number,number]{return[Math.round(fr*op+br*(1-op)),Math.round(fg*op+bg*(1-op)),Math.round(fb*op+bb*(1-op))];}

const HUES = [0,30,60,90,120,150,180,210,240,270,300,330];
const DIM_BLEND = 0.10; // 10% black blend for Surface-Dim

console.log('Testing Color-6 at different L values with Surface-Dim (10% #050505 blend)');
console.log('Text target: Color-1 (L=1), need 4.5:1');
console.log('Header/Border target: Color-2 (L=10), need 3.1:1');
console.log('');
console.log('L     | Base Text CR | Dim Text CR  | Base Hdr CR | Dim Hdr CR  | Both Pass?');
console.log('------|-------------|-------------|------------|------------|----------');

for (let L = 58; L <= 72; L++) {
  let worstBaseText = Infinity, worstDimText = Infinity;
  let worstBaseHdr = Infinity, worstDimHdr = Infinity;

  for (const bgHue of HUES) {
    const baseRgb = lchToRgb(L, 70, bgHue);
    const dimRgb = blendRgb(5, 5, 5, baseRgb[0], baseRgb[1], baseRgb[2], DIM_BLEND);
    const baseLum = rgbLum(baseRgb[0], baseRgb[1], baseRgb[2]);
    const dimLum = rgbLum(dimRgb[0], dimRgb[1], dimRgb[2]);

    for (const fgHue of HUES) {
      // Text → Color-1 (L=1)
      const textRgb = lchToRgb(1, 70, fgHue);
      const textLum = rgbLum(textRgb[0], textRgb[1], textRgb[2]);
      const baseCR = cr(baseLum, textLum);
      const dimCR = cr(dimLum, textLum);
      if (baseCR < worstBaseText) worstBaseText = baseCR;
      if (dimCR < worstDimText) worstDimText = dimCR;

      // Header → Color-2 (L=10)
      const hdrRgb = lchToRgb(10, 70, fgHue);
      const hdrLum = rgbLum(hdrRgb[0], hdrRgb[1], hdrRgb[2]);
      const baseHCR = cr(baseLum, hdrLum);
      const dimHCR = cr(dimLum, hdrLum);
      if (baseHCR < worstBaseHdr) worstBaseHdr = baseHCR;
      if (dimHCR < worstDimHdr) worstDimHdr = dimHCR;
    }
  }

  const textPass = worstDimText >= 4.5;
  const hdrPass = worstDimHdr >= 3.1;
  const both = textPass && hdrPass;
  const marker = both ? '✅' : '❌';

  console.log(
    `L=${L.toString().padEnd(4)}| ${worstBaseText.toFixed(2).padEnd(12)}| ${worstDimText.toFixed(2).padEnd(12)}| ${worstBaseHdr.toFixed(2).padEnd(11)}| ${worstDimHdr.toFixed(2).padEnd(11)}| ${marker}`
  );
}
