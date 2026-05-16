/**
 * Add-on registry.
 *
 * Each entry is identified by a stable `slug` that:
 *   - is stored in Firestore (designSystems/{id}.addOns: string[])
 *   - is written into entitlements.json on Storage
 *   - is read by the hosted DinoDesign environment to decide which add-on
 *     sections / CSS to load
 *
 * Display fields (title, description, price) only live in the studio.
 * Slugs never change once shipped.
 */

export interface AddOn {
  slug: string;
  title: string;
  description: string;
  /** Price per design system in USD cents. Flat per-DS pricing for v1. */
  priceUsdCents: number;
  /** When false, the catalog shows the add-on but the Buy button is disabled
   *  (still marketing-coming-soon). */
  available: boolean;
}

export const ADD_ONS: AddOn[] = [
  { slug: 'wave-sections',     title: 'Wave Sections',                description: 'SVG/CSS wave dividers between page sections, auto-tinted with your brand palette.',                                priceUsdCents: 500, available: false },
  { slug: 'hero-area',         title: 'Hero Area',                    description: 'Full-width hero layouts with image backgrounds, split content, and animated call-to-action patterns.',           priceUsdCents: 500, available: false },
  { slug: 'footer',            title: 'Footer',                       description: 'Multi-column footer templates with newsletter signup, social links, and sitemap layouts.',                       priceUsdCents: 500, available: false },
  { slug: 'carousel',          title: 'Carousel',                     description: 'Horizontal scrolling image/content carousels with auto-play, pagination, and keyboard controls.',                 priceUsdCents: 500, available: false },
  { slug: 'media-text-overlay', title: 'Image/Video with Text Overlay', description: 'Media containers with contrast-safe text overlay layouts that adapt to any background.',                       priceUsdCents: 500, available: false },
  // First fully-wired add-on for v1.
  { slug: 'gradients',         title: 'Gradients',                    description: 'Smooth gradient fills derived from your LCH tone scale — for backgrounds, cards, headers, and accents.',         priceUsdCents: 500, available: true  },
  { slug: 'micro-animations',  title: 'Micro Animations',             description: 'Hover, focus, and interaction animations applied via CSS variables — fade, scale, slide, bounce.',               priceUsdCents: 500, available: false },
  { slug: 'glass-effects',     title: 'Glass Effects',                description: 'Frosted-glass surfaces using backdrop-filter blur, tinted with your brand palette.',                              priceUsdCents: 500, available: false },
  { slug: 'curved-text',       title: 'Curved Text',                  description: 'SVG-path text that follows arcs, waves, and custom curves — for headers and editorial layouts.',                  priceUsdCents: 500, available: false },
  { slug: 'image-effects',     title: 'Image Effects',                description: 'Filters and tinting (duotone, monochrome, brand-color overlays) for product photography.',                        priceUsdCents: 500, available: false },
];

export const getAddOn = (slug: string): AddOn | undefined => ADD_ONS.find(a => a.slug === slug);

export const formatPrice = (cents: number): string => {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
};
