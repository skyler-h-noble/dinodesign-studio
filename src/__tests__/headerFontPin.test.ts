import { describe, it, expect } from 'vitest';
import { headerFontQueryParam, pinnedHeaderFontQueryParam, pinHeaderFontImport } from '../utils/moodAxes';

// A published system pins its axes, so it should request only those values —
// the full-range face is ~1 MB, the pinned one ~130 KB.
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
  it('pins each axis the CSS sets, keeps the full range for one it does not', () => {
    // opsz is not set above, so it keeps 6..144.
    expect(pinnedHeaderFontQueryParam(typography))
      .toBe('family=Google+Sans+Flex:GRAD,ROND,opsz,slnt,wdth,wght@50,0,6..144,0,72,600..900');
  });

  it('weights span only the header styles, not body', () => {
    expect(pinnedHeaderFontQueryParam(typography)).not.toMatch(/400\.\./);
  });

  it('with nothing pinned, it is the full-range request', () => {
    expect(pinnedHeaderFontQueryParam(':root{}')).toBe(headerFontQueryParam());
  });

  it('swaps the full-range import in a stylesheet', () => {
    const css = `@import url('https://fonts.googleapis.com/css2?${headerFontQueryParam()}&display=swap');\n:root{}`;
    const out = pinHeaderFontImport(css, typography);
    expect(out).toContain('wght@50,0,6..144,0,72,600..900');
    expect(out).not.toContain(headerFontQueryParam());
  });
});
