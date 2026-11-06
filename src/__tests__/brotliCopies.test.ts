/**
 * Brotli copies of a published system's sheets (src/utils/brotliCopies.ts).
 *
 * What has to hold, each asserted on a system generated end to end by
 * generateAndUploadDesignSystem with only Storage and the encoder swapped out:
 *
 * 1. Everything published today is published byte-for-byte as before — the
 *    originals, figma.json, tokens.json, DINO-TOKENS.md. The only file that
 *    changes is theme.json, and only in its sheet slots and the new `plain`.
 * 2. Each sheet gets a br/ copy, uploaded pre-encoded with Content-Encoding br,
 *    whose decoded text is the original, whitespace-minified — and whose
 *    declarations, parsed by an independent parser (postcss), are the
 *    original's, in order, under the same selectors and at-rules.
 * 3. theme.json's sheet slots name the copies, `plain` names the originals,
 *    and the copies upload before theme.json does.
 * 4. If the encoder cannot load, theme.json is exactly what it was before
 *    brotli copies existed.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import postcss, { type ChildNode } from 'postcss';
import { makeScheme } from './__fixtures__/renderedSystem';
import { minifyCss } from '../utils/cssMinifySafe';
import type { UserSelections, TypographyStyle } from '../types';

type Upload = { name: string; content: string | Uint8Array | Blob; type?: string; preEncoded?: string };

const h = vi.hoisted(() => ({
  uploads: [] as Upload[],
  encoderFails: false,
}));

vi.mock('../utils/firebase/storage', () => ({
  uploadDesignSystemFile: vi.fn(async (_uuid: string, name: string, content: Upload['content'], type?: string, preEncoded?: string) => {
    h.uploads.push({ name, content, type, preEncoded });
  }),
  getDesignSystemFileUrl: vi.fn(async () => { throw new Error('not in tests'); }),
  getPublicFileUrl: (uuid: string, f: string) =>
    `https://firebasestorage.googleapis.com/v0/b/test-bucket/o/${encodeURIComponent(`design-systems/${uuid}/${f}`)}?alt=media`,
}));

/* The browser build of brotli-wasm fetches its .wasm by URL, which Node
   cannot; the generator's encoder is swapped for Node's own brotli at the
   same quality. The real encoder is checked separately below. */
vi.mock('../utils/brotliCopies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/brotliCopies')>();
  return {
    ...actual,
    loadBrotliEncoder: async () => {
      if (h.encoderFails) throw new Error('wasm unavailable');
      return (b: Uint8Array) => new Uint8Array(zlib.brotliCompressSync(b, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: actual.BROTLI_QUALITY },
      }));
    },
  };
});

const { generateAndUploadDesignSystem } = await import('../utils/generateDesignSystem');
const { SHEET_FILES, BROTLI_DIR, BROTLI_QUALITY } = await import('../utils/brotliCopies');
const { getPublicFileUrl } = await import('../utils/firebase/storage');

const UUID = 'brotli-test-0001';
const FACES: TypographyStyle[] = [
  { type: 'header', family: 'Inter', weight: '600', letterSpacing: '0em', allCaps: false },
  { type: 'decorative', family: 'Caveat', weight: '400', letterSpacing: '0em', allCaps: false },
  { type: 'body', family: 'Inter', weight: '400', letterSpacing: '0em', allCaps: false },
];
const SELECTIONS = {
  defaultTheme: 'light', background: 'Primary/Surface', backgroundTheme: 'Primary', backgroundN: 11,
  appBar: 'Primary/Surface', navBar: 'Neutral/Surface', status: 'Primary/Surface',
  button: 'primary', cardColoring: 'tonal', textColoring: 'tonal',
} as unknown as UserSelections;

async function generate(): Promise<Upload[]> {
  h.uploads.length = 0;
  const saved = { log: console.log, warn: console.warn, info: console.info, debug: console.debug, error: console.error };
  console.log = console.warn = console.info = console.debug = console.error = () => {};
  try {
    await generateAndUploadDesignSystem({
      designSystemName: 'Brotli Test',
      colorScheme: makeScheme(['#849054', '#d06f71', '#be7d44']),
      userSelections: SELECTIONS,
      typographyStyles: FACES,
      componentStyle: 'modern' as never,
      uuid: UUID,
      version: 3,
    });
  } finally {
    Object.assign(console, saved);
  }
  return [...h.uploads];
}

const text = (u: Upload | undefined) => {
  if (!u || typeof u.content !== 'string') throw new Error(`no text upload: ${u?.name}`);
  return u.content;
};
const byName = (list: Upload[], name: string) => list.find((u) => u.name === name);

/** Every rule, at-rule and declaration, in order, with its enclosing path —
 *  read by postcss, not by the minifier under test. */
function declarationList(css: string): string[] {
  const out: string[] = [];
  const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
  const walk = (nodes: ChildNode[], path: string) => {
    for (const n of nodes) {
      if (n.type === 'decl') out.push(`${path} | ${n.prop}: ${n.value}${n.important ? ' !important' : ''}`);
      else if (n.type === 'rule') {
        // Whitespace around a comma means nothing in a selector, at any depth
        // (`:where(a, b)` is `:where(a,b)`); the minifier drops it.
        const sel = n.selectors.map((x) => ws(x).replace(/\s*,\s*/g, ',')).join(',');
        out.push(`${path} > ${sel}`);
        walk(n.nodes, `${path} > ${sel}`);
      } else if (n.type === 'atrule') {
        const at = `@${n.name} ${ws(n.params)}`;
        out.push(`${path} > ${at}`);
        if (n.nodes) walk(n.nodes, `${path} > ${at}`);
      }
    }
  };
  walk(postcss.parse(css).nodes, '');
  return out;
}

let withBrotli: Upload[];
let withoutBrotli: Upload[];

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
  h.encoderFails = false;
  /* Warm-up. The FIRST generation in a fresh module graph publishes a
     different tokens.json / figma.json from every later one (a later run adds
     Text › Color-Variant entries — state left behind by the first run). That
     is older than the brotli copies and outside this test; comparing two
     warm runs keeps it from masquerading as a brotli difference. */
  await generate();
  withBrotli = await generate();
  h.encoderFails = true;
  withoutBrotli = await generate();
  h.encoderFails = false;
}, 120_000);

afterAll(() => { vi.useRealTimers(); });

describe('the originals are published exactly as before', () => {
  it('every file but theme.json is byte-identical with and without the copies', () => {
    const originals = withBrotli.filter((u) => !u.name.startsWith(`${BROTLI_DIR}/`));
    expect(originals.map((u) => u.name).sort()).toEqual(withoutBrotli.map((u) => u.name).sort());
    for (const u of originals) {
      if (u.name === 'theme.json') continue;
      const before = byName(withoutBrotli, u.name)!;
      expect(`${u.name}: ${u.type} ${u.preEncoded ?? '-'}`).toBe(`${u.name}: ${before.type} ${before.preEncoded ?? '-'}`);
      expect(text(u) === text(before), `${u.name} changed`).toBe(true);
    }
  });

  it('the originals still go up as text/css for the existing gzip path', () => {
    for (const file of Object.values(SHEET_FILES)) {
      const u = byName(withBrotli, file);
      expect(`${file}: ${u?.type} ${u?.preEncoded ?? '-'}`).toBe(`${file}: text/css -`);
    }
  });
});

describe('each sheet has a brotli copy under br/', () => {
  it('one copy per sheet, pre-encoded br, text/css with a charset', () => {
    const copies = withBrotli.filter((u) => u.name.startsWith(`${BROTLI_DIR}/`));
    expect(copies.map((u) => u.name).sort())
      .toEqual(Object.values(SHEET_FILES).map((f) => `${BROTLI_DIR}/${f}`).sort());
    for (const c of copies) {
      expect(`${c.name}: ${c.type} ${c.preEncoded}`).toBe(`${c.name}: text/css; charset=utf-8 br`);
      expect(c.content).toBeInstanceOf(Uint8Array);
    }
  });

  for (const file of Object.values(SHEET_FILES)) {
    it(`${file}: decodes to the original, minified, with every declaration intact`, () => {
      const original = text(byName(withBrotli, file));
      const copy = byName(withBrotli, `${BROTLI_DIR}/${file}`)!;
      const decoded = zlib.brotliDecompressSync(copy.content as Uint8Array).toString('utf8');
      // The strict minifier: it throws where the generator's would fall back
      // to the unminified sheet, so a pass here means the copy IS minified.
      expect(decoded).toBe(minifyCss(original));
      const a = declarationList(original);
      const b = declarationList(decoded);
      expect(b.length).toBe(a.length);
      expect(b).toEqual(a);
      if (original.length > 2000) expect(decoded.length).toBeLessThan(original.length);
    });
  }

  it('the big sheets carry real token counts, so the comparison is not vacuous', () => {
    for (const file of ['Light-Mode.css', 'Dark-Mode.css', 'foundation.css', 'core.css']) {
      const n = declarationList(text(byName(withBrotli, file))).filter((l) => l.includes(' | --')).length;
      expect(n, file).toBeGreaterThan(100);
    }
  });
});

describe('theme.json', () => {
  const manifest = () => JSON.parse(text(byName(withBrotli, 'theme.json')));
  const fallback = () => JSON.parse(text(byName(withoutBrotli, 'theme.json')));

  it('sheet slots name the br/ copies; plain names the originals', () => {
    const m = manifest();
    for (const [key, file] of Object.entries(SHEET_FILES)) {
      expect(m[key]).toBe(getPublicFileUrl(UUID, `${BROTLI_DIR}/${file}`));
      expect(m.plain[key]).toBe(getPublicFileUrl(UUID, file));
    }
  });

  it('nothing else changes — fonts, defaults and name are the same as without the copies', () => {
    const m = manifest();
    const f = fallback();
    const strip = (o: Record<string, unknown>) => Object.fromEntries(
      Object.entries(o).filter(([k]) => k !== 'plain' && !(k in SHEET_FILES)));
    expect(strip(m)).toEqual(strip(f));
    expect(Array.isArray(m.fonts) && m.fonts.length > 0).toBe(true);
    // The sheet slots keep their order, plain right after them.
    const keys = Object.keys(m);
    expect(keys.slice(keys.indexOf('foundation'), keys.indexOf('plain') + 1))
      .toEqual([...Object.keys(SHEET_FILES), 'plain']);
  });

  it('without an encoder, theme.json is what it was before copies existed', () => {
    const f = fallback();
    expect(f.plain).toBeUndefined();
    for (const [key, file] of Object.entries(SHEET_FILES)) expect(f[key]).toBe(getPublicFileUrl(UUID, file));
    expect(withoutBrotli.some((u) => u.name.startsWith(`${BROTLI_DIR}/`))).toBe(false);
  });

  it('every copy is uploaded before theme.json names it', () => {
    const names = withBrotli.map((u) => u.name);
    const themeAt = names.indexOf('theme.json');
    const lastCopy = Math.max(...names.map((n, i) => (n.startsWith(`${BROTLI_DIR}/`) ? i : -1)));
    expect(lastCopy).toBeGreaterThanOrEqual(0);
    expect(lastCopy).toBeLessThan(themeAt);
  });
});

describe('the browser encoder (brotli-wasm)', () => {
  it('produces standard brotli that zlib decodes, at quality 11', () => {
    // Node build of the same Rust encoder the studio loads as wasm.
    const brotli = createRequire(import.meta.url)('brotli-wasm') as { compress: (b: Uint8Array, o: { quality: number }) => Uint8Array };
    const css = text(byName(withBrotli, 'Light-Mode.css'));
    const min = new TextEncoder().encode(minifyCss(css));
    const out = brotli.compress(min, { quality: BROTLI_QUALITY });
    expect(zlib.brotliDecompressSync(out).toString('utf8')).toBe(minifyCss(css));
    // Brotli at 11 on the minified sheet beats gzip on the original.
    expect(out.length).toBeLessThan(zlib.gzipSync(css, { level: 9 }).length);
  });
});
