import {
  ref, uploadBytes, getDownloadURL, getBytes, listAll, deleteObject,
  type StorageReference,
} from 'firebase/storage';
import { storage, STORAGE_BUCKET } from './client';

/**
 * Storage layout: design-systems/{uuid}/{filename}
 * (Top-level "folder" lets us add other top-level paths later — e.g., user-uploads/)
 */
const ROOT = 'design-systems';

/**
 * Public URL pattern for Firebase Storage (requires public read rules).
 * Set rules in firebase.rules:
 *   match /design-systems/{uuid}/{file} { allow read: if true; allow write: if request.auth != null; }
 */
function publicStorageUrl(path: string): string {
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encoded}?alt=media`;
}

/**
 * Build the public URL for a file in a design system. Predictable, no token required
 * (assuming storage rules allow public read).
 */
export function getPublicFileUrl(uuid: string, filename: string): string {
  return publicStorageUrl(`${ROOT}/${uuid}/${filename}`);
}

/**
 * Build the public URL base for a design system's folder. Append the filename
 * (which may need encoding) when constructing per-file URLs.
 */
export function getPublicBaseUrl(uuid: string): string {
  // Note: this returns the prefix without the trailing filename, with encoded slash.
  // Consumers should append `encodeURIComponent(filename)` then `?alt=media`.
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(`${ROOT}/${uuid}/`)}`;
}

/**
 * Upload a file (string or Blob) to design-systems/{uuid}/{filename}.
 *
 * Sets `Cache-Control: no-cache` on every upload so that the moment the
 * studio rewrites a design system's CSS / theme.json / Figma files
 * (regenerate, re-export, restore), the hosted playground picks up the
 * new content on the next request instead of serving Firebase Storage's
 * default 1-hour cached copy. With `no-cache` the browser still uses HTTP
 * validators (ETag / Last-Modified) so unchanged files come back as 304
 * — no extra bandwidth, just guaranteed freshness on rewrite.
 *
 * Mood board images and other one-shot binaries are uploaded through
 * this same path, which means they also revalidate every load. That's
 * the same trade-off (small revalidation request) and worth it for the
 * version-correctness guarantee.
 */
export async function uploadDesignSystemFile(
  uuid: string,
  filename: string,
  content: string | Blob | Uint8Array,
  contentType?: string,
): Promise<void> {
  const fileRef = ref(storage, `${ROOT}/${uuid}/${filename}`);
  let data: Blob | Uint8Array;
  if (typeof content === 'string') {
    data = new Blob([content], { type: contentType || 'text/plain' });
  } else {
    data = content;
  }
  const metadata = {
    cacheControl: 'no-cache, max-age=0, must-revalidate',
    ...(contentType ? { contentType } : {}),
  };
  await uploadBytes(fileRef, data, metadata);
  // Per-file confirmation so the console shows which uploads landed on
  // which paths with which cache headers. Helps diagnose stale-CSS
  // problems where the playground keeps showing old content after a
  // regenerate.
  console.log(`📤 [Storage] uploaded ${ROOT}/${uuid}/${filename} (cache-control: ${metadata.cacheControl})`);
}

/**
 * Get a public download URL for a file at design-systems/{uuid}/{filename}.
 * Throws if the file doesn't exist.
 */
export async function getDesignSystemFileUrl(uuid: string, filename: string): Promise<string> {
  const fileRef = ref(storage, `${ROOT}/${uuid}/${filename}`);
  return await getDownloadURL(fileRef);
}

/**
 * Fetch a file's text contents directly.
 */
export async function fetchDesignSystemFileText(uuid: string, filename: string): Promise<string> {
  const fileRef = ref(storage, `${ROOT}/${uuid}/${filename}`);
  const bytes = await getBytes(fileRef);
  return new TextDecoder().decode(bytes);
}

/**
 * Recursively delete every file under design-systems/{uuid}/. Storage has
 * no native "delete folder" — we list, fan out deletes, and recurse into
 * any nested prefixes (e.g. per-mode subfolders if the export ever adds
 * them). Failures on individual files are swallowed so a single permission
 * blip doesn't leave the caller half-done; the orphaned files would just
 * be unreachable from the studio UI.
 */
async function deleteFolderRecursive(folderRef: StorageReference): Promise<void> {
  const result = await listAll(folderRef);
  await Promise.all([
    ...result.items.map(item => deleteObject(item).catch(err => {
      console.warn('deleteObject failed:', item.fullPath, err);
    })),
    ...result.prefixes.map(prefix => deleteFolderRecursive(prefix)),
  ]);
}

/** Delete every file under design-systems/{uuid}/. Safe to call when empty. */
export async function deleteDesignSystemFiles(uuid: string): Promise<void> {
  const folderRef = ref(storage, `${ROOT}/${uuid}`);
  await deleteFolderRecursive(folderRef);
}

// ─────────────────────────────────────────────────────────────────────────────
// figma-templates/ — global Figma .fig templates the studio serves to every
// user (renamed client-side at download time). Separate top-level prefix
// because the file is global, not per-design-system. Write is admin-gated by
// the storage.rules `isAdmin()` check; read is public so the download path
// doesn't need auth on the user side.
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATES_ROOT = 'figma-templates';
export const FIGMA_TEMPLATE_FILENAME = 'dinodesign-template.fig';

export async function uploadFigmaTemplate(file: Blob): Promise<void> {
  const fileRef = ref(storage, `${TEMPLATES_ROOT}/${FIGMA_TEMPLATE_FILENAME}`);
  await uploadBytes(fileRef, file, {
    cacheControl: 'no-cache, max-age=0, must-revalidate',
    contentType: 'application/octet-stream',
  });
  console.log(`📤 [Storage] uploaded ${TEMPLATES_ROOT}/${FIGMA_TEMPLATE_FILENAME}`);
}

/** Public URL for the master Figma template. */
export function getFigmaTemplateUrl(): string {
  return publicStorageUrl(`${TEMPLATES_ROOT}/${FIGMA_TEMPLATE_FILENAME}`);
}

/**
 * Check if a design system exists by attempting to read its base CSS file.
 */
export async function designSystemExists(uuid: string): Promise<boolean> {
  try {
    await getDesignSystemFileUrl(uuid, 'tokens-base.css');
    return true;
  } catch {
    return false;
  }
}
