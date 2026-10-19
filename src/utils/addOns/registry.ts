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
  // One-off generator: a chart in the brand, emitted as code AND as a Figma
  // build from the file's own chart components (see /add-ons/charts).
  // One-off generator: a hero over a photo or a gradient, contrast solved, in
  // the brand's own tokens (see /add-ons/hero). Grew from the text-over-image
  // and text-on-gradient experiments.
  { slug: 'hero-generator',    title: 'Hero Generator',               description: 'A hero over a photo or a gradient in your brand, with the overlay or the colors solved for contrast — as code, and built in Figma.', priceUsdCents: 500, available: false },
  // The brand's logo and mark, saved per design system as one-color SVGs that
  // adapt to every surface — for navs, footers, share images, favicons and
  // the Figma Brand component (see /add-ons/brand).
  { slug: 'brand',             title: 'Brand',                        description: 'Your logo and mark in one color that adapts to every surface — for nav bars, footers, share images, favicons and app icons, and in Figma.', priceUsdCents: 500, available: false },
  // One-off generator: the hero at the sizes a shared link's preview card is
  // read at, exported as PNGs and meta tags (see /add-ons/share).
  { slug: 'share-images',      title: 'Share Images',                 description: 'The picture a link shows when it is shared — in your brand, at the sizes Facebook, LinkedIn, X, Slack and Pinterest read — as PNGs, meta tags and Figma frames.', priceUsdCents: 500, available: false },
  { slug: 'bento-grid',        title: 'Bento Grid',                   description: 'Feature tiles on your layout grid, each on its own surface — reflowing from 12 columns to 8 to 4, as code and built in Figma.', priceUsdCents: 500, available: false },
  { slug: 'charts',            title: 'Charts',                       description: 'Bar, 3D bar and line charts in your brand — copy the code, or build the same chart in Figma from your components.', priceUsdCents: 500, available: false },
];

export const getAddOn = (slug: string): AddOn | undefined => ADD_ONS.find(a => a.slug === slug);

export const formatPrice = (cents: number): string => {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
};
