/**
 * A design system's brand in Storage: design-systems/{uuid}/brand/ —
 * brand.json (name, color, each slot's aspect) and the ink SVGs. Public read,
 * like the rest of the system, so the Nav Designer, Share Images and the Figma
 * plugin can all fetch it; writing needs a signed-in (or anonymous) session.
 */
import { uploadDesignSystemFile, fetchDesignSystemFileText, getPublicFileUrl } from '../../firebase/storage';
import { BRAND_FILES, normalizeBrandMeta, type BrandMeta } from './brandSpec';

export interface Brand { meta: BrandMeta; logo: string | null; stacked: string | null; mark: string | null }

export async function saveBrand(uuid: string, brand: Brand): Promise<void> {
  const meta = { ...brand.meta, updated: new Date().toISOString() };
  // The SVGs first: a brand.json naming a slot whose file is not there yet would load half a brand.
  for (const slot of ['logo', 'stacked', 'mark'] as const) {
    const svg = brand[slot];
    if (svg) await uploadDesignSystemFile(uuid, BRAND_FILES[slot], svg, 'image/svg+xml');
  }
  await uploadDesignSystemFile(uuid, BRAND_FILES.meta, JSON.stringify(meta, null, 2), 'application/json');
}

/** The saved brand, or null when the system has none yet. */
export async function loadBrand(uuid: string): Promise<Brand | null> {
  let meta: BrandMeta;
  try { meta = normalizeBrandMeta(JSON.parse(await fetchDesignSystemFileText(uuid, BRAND_FILES.meta))); }
  catch { return null; }
  const read = async (has: unknown, file: string) => { if (!has) return null; try { return await fetchDesignSystemFileText(uuid, file); } catch { return null; } };
  const [logo, stacked, mark] = await Promise.all([read(meta.logo, BRAND_FILES.logo), read(meta.stacked, BRAND_FILES.stacked), read(meta.mark, BRAND_FILES.mark)]);
  return { meta: { ...meta, logo: logo ? meta.logo : null, stacked: stacked ? meta.stacked : null, mark: mark ? meta.mark : null }, logo, stacked, mark };
}

/** Public URLs of the saved files (the Figma plugin reads these). */
export const brandFileUrl = (uuid: string, slot: keyof typeof BRAND_FILES) => getPublicFileUrl(uuid, BRAND_FILES[slot]);
