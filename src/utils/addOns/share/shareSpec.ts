/**
 * Share Images — the preview card a link shows when it is shared, in the
 * user's design system, at the sizes the platforms read.
 *
 * Built on the Hero: the same background (a photo with a solved overlay, or a
 * gradient of the system's own tones) and the same type styles, at fixed
 * sizes, with a site name and no buttons — a share image is a picture, and a
 * button in it cannot be pressed. The hero inside is a normal hero spec, so a
 * hero opens here as a starting point and the Figma plugin builds each size
 * with the hero builder.
 *
 * The platforms mostly read ONE image: Facebook, LinkedIn, Slack, Discord,
 * iMessage, WhatsApp, Teams and X all take the Open Graph image at 1.91:1
 * (X's large card is 2:1 at minimum and shows the same image). So the sizes
 * are shapes, not platforms — and each says who reads it.
 */
import { normalizeHeroSpec, HERO_SPEC_VERSION, type HeroSpec } from '../hero/heroSpec';

export const SHARE_SPEC_VERSION = 'share1';

export interface ShareSize {
  key: 'og' | 'square' | 'pinterest';
  label: string;
  w: number;
  h: number;
  /** Who reads this shape, for the UI and the export notes. */
  readBy: string;
  /** The file name the export downloads it as — and the meta tags point at. */
  file: string;
}

export const SHARE_SIZES: ShareSize[] = [
  { key: 'og', label: 'Link preview', w: 1200, h: 630, readBy: 'Facebook, LinkedIn, X, Slack, Discord, iMessage, WhatsApp, Teams', file: 'share-1200x630.png' },
  { key: 'square', label: 'Square', w: 1200, h: 1200, readBy: 'X summary card, and apps that show a small square thumbnail', file: 'share-1200x1200.png' },
  { key: 'pinterest', label: 'Pinterest', w: 1000, h: 1500, readBy: 'Pinterest pins (2:3)', file: 'share-1000x1500.png' },
];
export type ShareSizeKey = ShareSize['key'];

/** The space between a share image's edge and its text: a desktop margin.
 *  Share images are drawn once, at desktop size, so they take the desktop's
 *  margin and type ramp whatever device later shows them. */
export const SHARE_MARGIN = 64;

/** The middle square of the wide card, which apps that crop the link
 *  preview to a square thumbnail keep — the text should sit inside it. */
export const shareSafeSquare = (s: ShareSize) => ({ x: (s.w - s.h) / 2, y: 0, w: s.h, h: s.h });

export interface ShareSpec {
  version: string;
  name: string;
  designSystem: { id: string | null };
  /** The background, text and type — a hero, without its buttons. */
  hero: HeroSpec;
  /** The text block's last line: the site or brand the link belongs to. '' for none. */
  siteName: string;
  /** The design system's saved logo (with words) or mark above the text, or none.
   *  Its SVG is not in the spec — it is the system's (the Brand add-on). */
  brand: 'none' | 'logo' | 'stacked' | 'mark';
  sizes: ShareSizeKey[];
  /** For the meta tags only. */
  page: { url: string; imageBase: string; alt: string };
}

const str = (v: unknown, d: string, max = 300) => (typeof v === 'string' ? v.slice(0, max) : d);

/** A hero as a share image's hero: no buttons, and sized by the share size. */
export function shareHero(raw: unknown): HeroSpec {
  const h = normalizeHeroSpec(raw);
  return { ...h, heightMode: 'fixed', text: { ...h.text, primaryAction: '', secondaryAction: '' } };
}

/** The hero for one size: that size's width and height. */
export function heroAtSize(spec: ShareSpec, size: ShareSize): HeroSpec {
  return { ...spec.hero, name: `${spec.name} · ${size.label}`, width: size.w, height: size.h, heightMode: 'fixed' };
}

export function normalizeShareSpec(raw: unknown): ShareSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  // A hero spec on its own is a fine starting point: it becomes the share image's hero.
  const fromHero = r.version === HERO_SPEC_VERSION;
  /* A new share image starts centered: apps that crop the link preview to a
     square keep its middle, so centered text survives the thumbnail. A hero
     brought in keeps its own placement. */
  const hero = shareHero(fromHero ? r : r.hero || { text: { v: 'center', h: 'center' } });
  const keys = SHARE_SIZES.map((s) => s.key);
  const sizes = Array.isArray(r.sizes) ? keys.filter((k) => r.sizes.includes(k)) : keys;
  const page = (r.page && typeof r.page === 'object' ? r.page : {}) as Record<string, unknown>;
  return {
    version: SHARE_SPEC_VERSION,
    name: str(fromHero ? undefined : r.name, 'Share image', 60),
    designSystem: { id: r.designSystem && typeof r.designSystem.id === 'string' ? r.designSystem.id : null },
    hero,
    siteName: str(r.siteName, 'yoursite.com', 60),
    brand: r.brand === 'logo' || r.brand === 'stacked' || r.brand === 'mark' ? r.brand : 'none',
    sizes: sizes.length ? sizes : ['og'],
    page: {
      url: str(page.url, 'https://yoursite.com/page', 500),
      imageBase: str(page.imageBase, 'https://yoursite.com/images/', 500),
      alt: str(page.alt, '', 300),
    },
  };
}
