/**
 * Upload metadata for design-system files (src/utils/firebase/storage.ts).
 *
 * The brotli copies go up already encoded: the bytes must reach Storage as
 * they are, with Content-Encoding br, and must not be gzipped a second time —
 * a br-in-gzip object would decode to brotli bytes and render as nothing.
 * Text files keep the gzip path they had.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as { path: string; data: unknown; metadata: Record<string, unknown> }[],
}));

vi.mock('../utils/firebase/client', () => ({ storage: {}, STORAGE_BUCKET: 'test-bucket' }));
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: vi.fn(async (r: { path: string }, data: unknown, metadata: Record<string, unknown>) => {
    h.calls.push({ path: r.path, data, metadata });
  }),
  getDownloadURL: vi.fn(), getBytes: vi.fn(), listAll: vi.fn(), deleteObject: vi.fn(),
}));

const { uploadDesignSystemFile } = await import('../utils/firebase/storage');

beforeEach(() => {
  h.calls.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('uploadDesignSystemFile', () => {
  it('a pre-encoded brotli copy goes up as-is with Content-Encoding br', async () => {
    const bytes = new Uint8Array([0x1b, 0x2a, 0x00, 0xf8, 0x01, 0x02, 0x03]);
    await uploadDesignSystemFile('abc', 'br/Light-Mode.css', bytes, 'text/css; charset=utf-8', 'br');
    expect(h.calls).toHaveLength(1);
    const [call] = h.calls;
    expect(call.path).toBe('design-systems/abc/br/Light-Mode.css');
    expect(call.data).toBe(bytes);
    expect(call.metadata).toEqual({
      cacheControl: 'no-cache, max-age=0, must-revalidate',
      contentType: 'text/css; charset=utf-8',
      contentEncoding: 'br',
    });
  });

  it('a large text sheet still goes up gzip-encoded, as before', async () => {
    const css = ':root{' + '--A-Token: #123456;'.repeat(500) + '}';
    await uploadDesignSystemFile('abc', 'Light-Mode.css', css, 'text/css');
    const [call] = h.calls;
    expect(call.path).toBe('design-systems/abc/Light-Mode.css');
    expect(call.metadata.contentType).toBe('text/css');
    expect(call.metadata.contentEncoding).toBe(typeof CompressionStream !== 'undefined' ? 'gzip' : undefined);
  });
});
