/**
 * Brotli copies of a design system's stylesheets.
 *
 * Every sheet is published twice:
 *
 *   design-systems/<id>/Light-Mode.css       the original — readable, stored
 *                                            gzip-encoded, unchanged by this
 *   design-systems/<id>/br/Light-Mode.css    whitespace-minified, stored
 *                                            brotli-encoded (quality 11)
 *
 * theme.json points its sheet slots at the br/ copies, which is what the lib's
 * provider and Vite plugin load, and lists the originals under `plain` for
 * anything that wants the readable file. Measured on a real system: Light-Mode
 * went from 40.7 KB gzip to 13.6 KB min+br, ~67 KB less per page and ~0.23 s
 * earlier first paint. Every original keeps its URL, so curl, scripts, the
 * Download All zip, the playground edge function and any hard-coded link
 * keep working exactly as before.
 *
 * Why a br/ FOLDER and not `Light-Mode.br.css`: the file keeps its own name.
 * Tools that take a sheet's name from the last URL segment (the lib's
 * build-time copy, the brotli test script) still see `Light-Mode.css`; nothing
 * that lists the system's folder sees new names beside the originals; and a
 * `.br.css` name reads like a file that is itself brotli bytes on disk, which
 * it is not once the browser has decoded it. storage.rules already covers it:
 * `design-systems/{uuid}/{file=**}` is recursive.
 *
 * Browsers cannot make brotli themselves — CompressionStream has gzip and
 * deflate only — and generation runs in the studio's browser tab, so the
 * encoder is brotli-wasm (Rust's brotli compiled to WebAssembly, ~1 MB wasm,
 * ~490 KB gzip). It is imported dynamically, so it is fetched only when a
 * system is generated, never on an ordinary page load. If it cannot load, the
 * copies are skipped and theme.json keeps pointing at the originals: a slower
 * system, never a broken one.
 */
import { minifyCssSafe } from './cssMinifySafe';

/** theme.json's sheet slots and the file each one names. */
export const SHEET_FILES = {
  foundation: 'foundation.css',
  core:       'core.css',
  typography: 'typography-tokens.css',
  lightMode:  'Light-Mode.css',
  darkMode:   'Dark-Mode.css',
  base:       'base.css',
  styles:     'styles.css',
} as const;
export type SheetKey = keyof typeof SHEET_FILES;

/** The folder under design-systems/<id>/ that holds the brotli copies. */
export const BROTLI_DIR = 'br';
/** Quality 11 is brotli's best; worth the seconds, as a sheet is encoded once
 *  and downloaded on every page view. */
export const BROTLI_QUALITY = 11;
/** The charset rides on the copy because the bytes are no longer readable
 *  text to anything that ignores Content-Encoding. */
export const BROTLI_CSS_CONTENT_TYPE = 'text/css; charset=utf-8';

export type BrotliEncode = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>;

/** The browser encoder, loaded on first use. */
export async function loadBrotliEncoder(): Promise<BrotliEncode> {
  const brotli = await (await import('brotli-wasm')).default;
  return (bytes) => brotli.compress(bytes, { quality: BROTLI_QUALITY });
}

export interface BrotliCopy {
  /** Path under design-systems/<id>/, e.g. `br/Light-Mode.css`. */
  name: string;
  /** Brotli bytes, uploaded as they are with Content-Encoding: br. */
  bytes: Uint8Array;
  contentType: string;
  contentEncoding: 'br';
  /** Sizes for the log: original text, minified text, brotli bytes. */
  sizes: { raw: number; minified: number; brotli: number };
}

type UploadFile = { name: string; content: string; type: string };

/**
 * Build the brotli copy of every sheet theme.json names, and point theme.json
 * at them. The originals are not touched; theme.json's content is rewritten
 * in place. Run it LAST, on the content that is about to be uploaded — after
 * the font imports are pinned and consolidated — so a copy is always the
 * minified form of exactly the original beside it.
 *
 * `urlFor(name)` is the public URL of a file in this system's folder.
 */
export async function addBrotliCopies(
  files: UploadFile[],
  encode: BrotliEncode,
  urlFor: (name: string) => string,
): Promise<BrotliCopy[]> {
  const theme = files.find((f) => f.name === 'theme.json');
  if (!theme) return [];
  const manifest = JSON.parse(theme.content) as Record<string, unknown>;
  const utf8 = new TextEncoder();
  const copies: BrotliCopy[] = [];
  const plain: Partial<Record<SheetKey, string>> = {};
  const br: Partial<Record<SheetKey, string>> = {};
  for (const [key, file] of Object.entries(SHEET_FILES) as [SheetKey, string][]) {
    const sheet = files.find((f) => f.name === file);
    if (!sheet || typeof manifest[key] !== 'string') continue;
    const minified = minifyCssSafe(sheet.content);
    const bytes = await encode(utf8.encode(minified));
    const name = `${BROTLI_DIR}/${file}`;
    copies.push({
      name, bytes, contentType: BROTLI_CSS_CONTENT_TYPE, contentEncoding: 'br',
      sizes: { raw: utf8.encode(sheet.content).length, minified: utf8.encode(minified).length, brotli: bytes.length },
    });
    plain[key] = manifest[key] as string;
    br[key] = urlFor(name);
  }
  if (!copies.length) return [];
  theme.content = JSON.stringify(withBrotliSheets(manifest, br, plain), null, 2);
  return copies;
}

/** The manifest with its sheet slots on the brotli copies and the originals
 *  listed under `plain`, placed right after the sheet slots. */
function withBrotliSheets(
  manifest: Record<string, unknown>,
  br: Partial<Record<SheetKey, string>>,
  plain: Partial<Record<SheetKey, string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lastSheet = (Object.keys(SHEET_FILES) as SheetKey[]).filter((k) => k in manifest).pop();
  for (const [k, v] of Object.entries(manifest)) {
    if (k === 'plain') continue;
    out[k] = br[k as SheetKey] ?? v;
    if (k === lastSheet) out.plain = plain;
  }
  if (!('plain' in out)) out.plain = plain;
  return out;
}
