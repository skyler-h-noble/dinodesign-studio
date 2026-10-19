/**
 * Favicons and app icons from the mark: drawn on a canvas, the mark centered
 * on a tile in the brand's button fill, in that button's label color — the
 * pair the system already tuned to pass. Browser only.
 */
import JSZip from 'jszip';
import {
  ICON_SIZES, SOCIAL_SIZES, KIT_COLORS, KIT_PNG_HEIGHTS, BRAND_SLOTS, faviconSVG, faviconHeadTags, inkInColor, kitFileName, kitReadme,
  packIco, svgDataUrl, svgViewBox, webManifest, type BrandMeta, type BrandSlot, type IconSize, type KitColor,
} from './brandSpec';

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image();
  img.onload = () => res(img); img.onerror = () => rej(new Error('The mark could not be drawn.'));
  img.src = src;
});

/** One icon as a PNG. */
export async function renderIcon(markInk: string, icon: IconSize, tile: string, ink: string): Promise<Blob> {
  const s = icon.size;
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = tile;
  if (icon.rounded) {
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, s * 0.22);
    ctx.fill();
  } else ctx.fillRect(0, 0, s, s);
  const vb = svgViewBox(markInk) || { x: 0, y: 0, w: 1, h: 1 };
  const box = s * icon.inset;
  const k = box / Math.max(vb.w, vb.h);
  const w = vb.w * k; const h = vb.h * k;
  // Rendered at its drawn size, so a 16px favicon is rasterized at 16px, not scaled down from big.
  const sized = inkInColor(markInk, ink).replace(/<svg\b/, `<svg width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"`);
  ctx.drawImage(await loadImage(svgDataUrl(sized)), (s - w) / 2, (s - h) / 2, w, h);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'));
}

export interface IconSet {
  files: { name: string; blob: Blob }[];
  /** Every size as its own PNG, including the three inside favicon.ico — for the preview. */
  previews: Record<string, Blob>;
  headTags: string;
  manifest: string;
}

/** Everything a site's root needs: the PNGs, favicon.ico, favicon.svg, the manifest and the tags. */
export async function buildIconSet(meta: BrandMeta, markInk: string, tile: string, ink: string, background: string): Promise<IconSet> {
  const files: { name: string; blob: Blob }[] = [];
  const icoParts: { size: number; data: Uint8Array }[] = [];
  const previews: Record<string, Blob> = {};
  for (const icon of ICON_SIZES) {
    const blob = await renderIcon(markInk, icon, tile, ink);
    previews[icon.file] = blob;
    if (icon.size <= 48) icoParts.push({ size: icon.size, data: new Uint8Array(await blob.arrayBuffer()) });
    else files.push({ name: icon.file, blob });
  }
  files.unshift({ name: 'favicon.ico', blob: new Blob([packIco(icoParts) as Uint8Array<ArrayBuffer>], { type: "image/x-icon" }) });
  files.splice(1, 0, { name: 'favicon.svg', blob: new Blob([faviconSVG(markInk, tile, ink)], { type: 'image/svg+xml' }) });
  // Social profile pictures, in their own folder: not for the site's root.
  for (const icon of SOCIAL_SIZES) {
    const blob = await renderIcon(markInk, icon, tile, ink);
    previews[icon.file] = blob;
    files.push({ name: 'social/' + icon.file, blob });
  }
  const manifest = webManifest(meta, tile, background);
  files.push({ name: 'site.webmanifest', blob: new Blob([manifest], { type: 'application/manifest+json' }) });
  return { files, previews, headTags: faviconHeadTags(tile), manifest };
}

export async function zipIconSet(set: IconSet): Promise<Blob> {
  const zip = new JSZip();
  for (const f of set.files) zip.file(f.name, f.blob);
  zip.file('head-tags.html', set.headTags + '\n');
  return await zip.generateAsync({ type: 'blob' });
}

/** Save a blob as a file — on the user's click only. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** One shape in one color as a PNG on transparency, at a height. */
async function renderInkPng(svg: string, aspect: number, height: number, color: string): Promise<Blob> {
  const w = Math.max(1, Math.round(height * aspect));
  const c = document.createElement('canvas'); c.width = w; c.height = height;
  const sized = inkInColor(svg, color).replace(/<svg\b/, `<svg width="${w}" height="${height}" preserveAspectRatio="xMidYMid meet"`);
  c.getContext('2d')!.drawImage(await loadImage(svgDataUrl(sized)), 0, 0, w, height);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'));
}

/**
 * The brand kit: every shape the brand has, in black, white and the brand
 * color, as SVG and PNG, with a one-page note on which to use where — for the
 * places the adaptive version cannot reach.
 */
export async function buildBrandKit(meta: BrandMeta, inks: Partial<Record<BrandSlot, string | null>>, brandHex: string): Promise<Blob> {
  const zip = new JSZip();
  const hex: Record<KitColor, string> = { black: '#000000', white: '#FFFFFF', brand: brandHex };
  for (const slot of BRAND_SLOTS) {
    const svg = inks[slot]; const m = meta[slot];
    if (!svg || !m) continue;
    for (const color of KIT_COLORS) {
      zip.file(kitFileName(slot, color, 'svg'), inkInColor(svg, hex[color]));
      for (const h of KIT_PNG_HEIGHTS) zip.file(kitFileName(slot, color, 'png', h), await renderInkPng(svg, m.aspect, h, hex[color]));
    }
  }
  zip.file('README.txt', kitReadme(meta, brandHex) + '\n');
  return await zip.generateAsync({ type: 'blob' });
}
