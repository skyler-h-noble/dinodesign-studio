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
  const metadata = contentType ? { contentType } : undefined;
  await uploadBytes(fileRef, data, metadata);
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
