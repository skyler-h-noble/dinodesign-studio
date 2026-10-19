/** Share Images: the spec, the card, the meta tags and the round trip. */
import { describe, it, expect } from 'vitest';
import { normalizeShareSpec, heroAtSize, shareSafeSquare, SHARE_SIZES, SHARE_SPEC_VERSION } from '../utils/addOns/share/shareSpec';
import { shareCardHTML, shareMetaTags } from '../utils/addOns/share/shareCode';
import { extractShareSpec, encodeShareSpec } from '../utils/addOns/share/shareShare';
import { normalizeHeroSpec, HERO_SPEC_VERSION } from '../utils/addOns/hero/heroSpec';
import { heroHTML } from '../utils/addOns/hero/heroCode';

const size = (k: string) => SHARE_SIZES.find((s) => s.key === k)!;

describe('share spec', () => {
  it('has the three shapes the platforms read', () => {
    expect(SHARE_SIZES.map((s) => [s.key, s.w, s.h])).toEqual([['og', 1200, 630], ['square', 1200, 1200], ['pinterest', 1000, 1500]]);
  });

  it('a share image has no buttons — a picture cannot be pressed', () => {
    const s = normalizeShareSpec({ hero: { text: { primaryAction: 'Shop', secondaryAction: 'More' } } });
    expect(s.hero.text.primaryAction).toBe('');
    expect(s.hero.text.secondaryAction).toBe('');
  });

  it('a hero spec on its own becomes the share image\'s hero', () => {
    const hero = normalizeHeroSpec({ mode: 'gradient', text: { headline: 'Hello there' } });
    const s = normalizeShareSpec(hero);
    expect(s.version).toBe(SHARE_SPEC_VERSION);
    expect(s.hero.mode).toBe('gradient');
    expect(s.hero.text.headline).toBe('Hello there');
  });

  it('each size is the hero at that size, fixed', () => {
    const s = normalizeShareSpec({});
    const h = heroAtSize(s, size('pinterest'));
    expect([h.width, h.height, h.heightMode]).toEqual([1000, 1500, 'fixed']);
  });

  it('a new share image starts centered, so a square crop keeps its words', () => {
    expect([normalizeShareSpec({}).hero.text.v, normalizeShareSpec({}).hero.text.h]).toEqual(['center', 'center']);
    // A hero brought in keeps its own placement.
    expect(normalizeShareSpec(normalizeHeroSpec({ text: { v: 'bottom', h: 'left' } })).hero.text.h).toBe('left');
  });

  it('the safe square is the middle of the wide card', () => {
    expect(shareSafeSquare(size('og'))).toEqual({ x: 285, y: 0, w: 630, h: 630 });
  });
});

describe('share card', () => {
  const s = normalizeShareSpec({ siteName: 'omni.design' });
  const html = shareCardHTML(s, size('og'), 'photo.jpg');

  it('is the hero at desktop size, with the desktop margin', () => {
    expect(html).toContain('data-device="Desktop"');
    expect(html).toContain('width: 1200px; height: 630px; --Margin: 64px');
    expect(html).toContain('class="omni-hero"');
  });

  it('puts the site name in the text block, so the contrast solve covers it', () => {
    const content = html.slice(html.indexOf('omni-hero__content'), html.indexOf('</section>'));
    expect(content).toContain('<p class="omni-share__site">omni.design</p>');
  });

  it('draws no button', () => {
    expect(html).not.toContain('omni-hero__button');
  });
});

describe('meta tags', () => {
  const s = normalizeShareSpec({ siteName: 'Omni', page: { url: 'https://omni.design/x', imageBase: 'https://cdn.omni/img' },
    hero: { text: { eyebrow: 'New', headline: 'Ship it', body: 'Fast & "right".' } } });

  it('points Open Graph and X at the wide card, with its size and alt', () => {
    const tags = shareMetaTags(s);
    expect(tags).toContain('<meta property="og:image" content="https://cdn.omni/img/share-1200x630.png">');
    expect(tags).toContain('<meta property="og:image:width" content="1200">');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(tags).toContain('<meta property="og:image:alt" content="New — Ship it — Omni">');
    // Escaped, so a quote in the copy cannot break the tag.
    expect(tags).toContain('content="Fast &amp; &quot;right&quot;."');
  });

  it('with no wide card, the square leads and X shows a summary card', () => {
    const tags = shareMetaTags({ ...s, sizes: ['square'] });
    expect(tags).toContain('share-1200x1200.png');
    expect(tags).toContain('content="summary"');
  });

  it('Pinterest is an attribute on the page, not a meta tag', () => {
    expect(shareMetaTags(s)).toContain('data-pin-media="https://cdn.omni/img/share-1000x1500.png"');
  });
});

describe('import', () => {
  it('reads a share spec back from its link and its JSON', () => {
    const s = normalizeShareSpec({ siteName: 'Back again' });
    expect(normalizeShareSpec(extractShareSpec(`https://x/add-ons/share/id#spec=${encodeShareSpec(s)}`))).toEqual(s);
    expect(normalizeShareSpec(extractShareSpec(JSON.stringify(s)))).toEqual(s);
  });

  it('starts from a hero\'s HTML', () => {
    const hero = normalizeHeroSpec({ text: { headline: 'From a hero' } });
    const raw = extractShareSpec(heroHTML(hero));
    expect(raw.version).toBe(HERO_SPEC_VERSION);
    expect(normalizeShareSpec(raw).hero.text.headline).toBe('From a hero');
  });

  it('refuses anything else with a sentence', () => {
    expect(() => extractShareSpec('{"version":"chart1"}')).toThrow(/not a Share Images or Hero/);
  });
});

describe('logo on a share image', () => {
  const ink = { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><path fill="currentColor" d="M0 0h40v10H0z"/></svg>', aspect: 4 };

  it('goes first in the text block, in the headline\'s color', () => {
    const s = normalizeShareSpec({ brand: 'logo', hero: { mode: 'gradient' } });
    const html = shareCardHTML(s, size('og'), 'x.jpg', { logo: ink, name: 'Acme' });
    const content = html.slice(html.indexOf('omni-hero__content'));
    expect(content.indexOf('omni-share__brand')).toBeLessThan(content.indexOf('omni-hero__headline'));
    expect(html).toContain('role="img" aria-label="Acme"');
    // Over a gradient the headline is the surface's Header, and so is the logo.
    expect(html).toMatch(/omni-share__brand[^>]*background: var\(--Header\)/);
  });

  it('draws nothing when the system has no brand, or none is chosen', () => {
    expect(shareCardHTML(normalizeShareSpec({ brand: 'logo' }), size('og'), 'x.jpg', null)).not.toContain('omni-share__brand');
    expect(shareCardHTML(normalizeShareSpec({ brand: 'none' }), size('og'), 'x.jpg', { logo: ink })).not.toContain('omni-share__brand');
  });
});
