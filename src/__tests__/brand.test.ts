/** Brand: the stored meta, the code, the favicon SVG and the .ico container. */
import { describe, it, expect } from 'vitest';
import {
  normalizeBrandMeta, svgViewBox, inkInColor, brandHTML, faviconSVG, packIco, webManifest, faviconHeadTags, ICON_SIZES, BRAND_CSS,
  SOCIAL_SIZES, BRAND_COLOR_TOKEN, BRAND_COLOR_VARIABLE, kitFileName, kitReadme,
} from '../utils/addOns/brand/brandSpec';

const ink = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 40 20"><path fill="currentColor" d="M10 20h40v20H10z"/></svg>';

describe('brand meta', () => {
  it('keeps what it knows and drops what it does not', () => {
    const m = normalizeBrandMeta({ name: 'Omni', color: 'neutral', logo: { aspect: 4 }, mark: { aspect: 0 }, junk: 1 });
    expect(m).toMatchObject({ name: 'Omni', color: 'neutral', logo: { aspect: 4 }, mark: null });
    expect(normalizeBrandMeta({}).color).toBe('brand');
  });
});

describe('svg helpers', () => {
  it('reads a viewBox, or width and height', () => {
    expect(svgViewBox(ink)).toEqual({ x: 10, y: 20, w: 40, h: 20 });
    expect(svgViewBox('<svg width="24" height="12"></svg>')).toEqual({ x: 0, y: 0, w: 24, h: 12 });
  });
  it('paints the ink one color for a PNG', () => {
    expect(inkInColor(ink, '#123456')).toContain('fill="#123456"');
  });
});

describe('brand code', () => {
  const meta = normalizeBrandMeta({ name: 'Omni & Co', logo: { aspect: 4 }, mark: { aspect: 1 } });

  it('is a mask over the surface\'s brand color, so it adapts', () => {
    expect(BRAND_CSS).toContain('background: var(--omni-brand-color, var(--Header-Primary, var(--Header)))');
    expect(BRAND_CSS).toMatch(/mask: var\(--omni-brand-src\) center \/ contain no-repeat/);
  });

  it('names the brand itself, not "logo", and escapes it', () => {
    const html = brandHTML(meta, { logo: '/brand/logo.svg', mark: '/brand/mark.svg' }, { show: 'logo' });
    expect(html).toContain('role="img" aria-label="Omni &amp; Co"');
    expect(html).toContain("--omni-brand-src: url('/brand/logo.svg'); --omni-brand-aspect: 4");
  });

  it('responsive: the logo, and the mark that replaces it on a phone', () => {
    const html = brandHTML(meta, { logo: '/l.svg', mark: '/m.svg' }, { show: 'responsive' });
    expect(html).toContain('omni-brand--logo omni-brand--responsive');
    expect(html).toContain('omni-brand--mark omni-brand--responsive');
  });

  it('neutral color uses the surface Header', () => {
    expect(brandHTML({ ...meta, color: 'neutral' }, { mark: '/m.svg' }, { show: 'mark' })).toContain('--omni-brand-color: var(--Header)');
  });
});

describe('favicons', () => {
  it('the SVG favicon is the mark centered on its tile, in the tile\'s ink', () => {
    const svg = faviconSVG(ink, '#112233', '#ffffff');
    expect(svg).toContain('<rect width="100" height="100" rx="22" fill="#112233"/>');
    expect(svg).toContain('fill="#ffffff" color="#ffffff"');
    // 40 × 20 at 10,20 → ×1.65 is 66 × 33, centered: x 50 − 33 − 16.5 = 0.5, y 50 − 16.5 − 33 = 0.5,
    // which puts the mark at 17..83 across and 33.5..66.5 down — the middle of the tile.
    expect(svg).toContain('translate(0.5 0.5) scale(1.65)');
  });

  it('packs PNGs into a valid .ico', () => {
    const a = new Uint8Array([1, 2, 3]); const b = new Uint8Array([4, 5]);
    const ico = packIco([{ size: 16, data: a }, { size: 32, data: b }]);
    const dv = new DataView(ico.buffer);
    expect([dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true)]).toEqual([0, 1, 2]);
    expect([ico[6], ico[22]]).toEqual([16, 32]);               // widths
    expect(dv.getUint32(6 + 8, true)).toBe(3);                 // first size
    expect(dv.getUint32(6 + 12, true)).toBe(6 + 32);           // first offset, after the entries
    expect([...ico.slice(38)]).toEqual([1, 2, 3, 4, 5]);
  });

  it('the maskable icon keeps the mark inside Android\'s safe circle', () => {
    const m = ICON_SIZES.find((i) => i.file === 'icon-maskable-512.png')!;
    // The mark's corners (a square at this inset) must sit inside the 80% circle.
    expect(Math.SQRT2 * m.inset).toBeLessThanOrEqual(0.8);
  });

  it('manifest and tags point at the files', () => {
    const man = JSON.parse(webManifest(normalizeBrandMeta({ name: 'A very long app name' }), '#111', '#fff'));
    expect(man.short_name.length).toBeLessThanOrEqual(12);
    expect(man.icons.map((i: { src: string }) => i.src)).toEqual(['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']);
    expect(faviconHeadTags('#111')).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  });
});

describe('the additions: stacked, black & white, social, kit', () => {
  it('keeps a stacked logo and a black & white color', () => {
    const m = normalizeBrandMeta({ color: 'bw', stacked: { aspect: 1.2 } });
    expect(m.color).toBe('bw');
    expect(m.stacked).toEqual({ aspect: 1.2 });
  });

  it('black & white is each surface\'s Text-BW, in code and in Figma', () => {
    expect(BRAND_COLOR_TOKEN.bw).toBe('var(--Text-BW, var(--Header))');
    expect(BRAND_COLOR_VARIABLE.bw).toBe('Text-BW');
    const html = brandHTML(normalizeBrandMeta({ color: 'bw', mark: { aspect: 1 } }), { mark: '/m.svg' }, { show: 'mark' });
    expect(html).toContain('--omni-brand-color: var(--Text-BW, var(--Header))');
  });

  it('a stacked logo can go in a footer on its own', () => {
    const html = brandHTML(normalizeBrandMeta({ stacked: { aspect: 1.2 } }), { stacked: '/brand/stacked.svg' }, { show: 'stacked', height: 64 });
    expect(html).toContain('omni-brand--stacked');
    expect(html).toContain('--omni-brand-height: 64px');
  });

  it('profile pictures are the sizes the platforms take, and the mark survives their circle', () => {
    expect(SOCIAL_SIZES.map((s) => s.size)).toEqual([320, 400, 800]);
    for (const s of SOCIAL_SIZES) expect(Math.SQRT2 * s.inset).toBeLessThan(0.8);
  });

  it('the kit names files by shape, color and size, and says what each is for', () => {
    expect(kitFileName('mark', 'white', 'png', 512)).toBe('mark/mark-white-512.png');
    expect(kitFileName('logo', 'brand', 'svg')).toBe('logo/logo-brand.svg');
    const readme = kitReadme(normalizeBrandMeta({ name: 'Acme', logo: { aspect: 4 }, mark: { aspect: 1 } }), '#7a2d8c');
    expect(readme).toContain('Acme — brand kit');
    expect(readme).toContain('logo/');
    expect(readme).not.toContain('stacked/');   // only the shapes it has
    expect(readme).toContain('#7a2d8c');
  });
});
