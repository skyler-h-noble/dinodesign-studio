import { describe, it, expect } from 'vitest';
import { headerFontQueryParam, pinnedHeaderFontQueryParam, pinHeaderFontImport } from '../utils/moodAxes';

// A published system pins its axes, so it should request only those values —
// the full-range face is ~1 MB, the pinned one ~130 KB.
// Measured against the full font in Chrome (2026-11-03): header text with the
// system's settings draws within 0.2px either way.
const typography = `:root {
  --Font-Weight-Header: 640;
  --Header-Clamped-Weight: 640;
  --H1-Font-Weight: 900;
  --H4-Font-Weight: 600;
  --Body-Medium-Font-Weight: 400;
  --Font-Slant-Header: 0;
  --Font-Grade-Header: 50;
  --Font-Width-Header: 72;
  --Font-Roundness-Header: 0;
}`;

describe('pinned header font request', () => {
  it('spans each set axis back to its default, keeps the full range for one it does not', () => {
    // GRAD 50 -> 0..50, wdth 72 -> 72..100, ROND 0 is the default so stays 0;
    // opsz is not set above, so it keeps 6..144.
    expect(pinnedHeaderFontQueryParam(typography))
      .toBe('family=Google+Sans+Flex:GRAD,ROND,opsz,slnt,wdth,wght@0..50,0,6..144,0,72..100,400..900');
  });

  it('weights always cover 400..700, widened to the header styles', () => {
    const narrow = typography.replace('--H1-Font-Weight: 900;', '').replace('--H4-Font-Weight: 600;', '');
    expect(pinnedHeaderFontQueryParam(narrow)).toMatch(/,400\.\.700$/);
    const light = narrow.replace('--Font-Weight-Header: 640;', '--Font-Weight-Header: 261;');
    expect(pinnedHeaderFontQueryParam(light)).toMatch(/,261\.\.700$/);
  });

  // Pinned at -9, Google serves the face as `font-style: oblique 9deg`, which
  // upright text does not match. Spanning back to 0 keeps it a normal face.
  it('a non-zero slant spans back to 0; zero stays pinned', () => {
    const slanted = typography.replace('--Font-Slant-Header: 0;', '--Font-Slant-Header: -9;');
    expect(pinnedHeaderFontQueryParam(slanted)).toContain('@0..50,0,6..144,-9..0,72..100,');
    expect(pinnedHeaderFontQueryParam(typography)).toContain('@0..50,0,6..144,0,72..100,');
  });

  it('optical size stays pinned: it is the axis that costs bytes', () => {
    const withOpsz = typography + ':root{--Font-Optical-Size-Header: 96;}';
    expect(pinnedHeaderFontQueryParam(withOpsz)).toContain(',96,');
  });

  it('with nothing pinned, it is the full-range request', () => {
    expect(pinnedHeaderFontQueryParam(':root{}')).toBe(headerFontQueryParam());
  });

  it('swaps the full-range import in a stylesheet', () => {
    const css = `@import url('https://fonts.googleapis.com/css2?${headerFontQueryParam()}&display=swap');\n:root{}`;
    const out = pinHeaderFontImport(css, typography);
    expect(out).toContain('wght@0..50,0,6..144,0,72..100,400..900');
    expect(out).not.toContain(headerFontQueryParam());
  });
});
