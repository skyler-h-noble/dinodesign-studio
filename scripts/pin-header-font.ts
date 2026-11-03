#!/usr/bin/env node
/**
 * Pin the Header font request in already-published CSS.
 *
 * Systems published before pinHeaderFontImport (generateDesignSystem.ts) ask
 * Google for Google Sans Flex with the full range of every axis — about 1 MB of
 * font — even though each system sets one value per axis. Publishing now pins
 * the request to those values; this does the same for systems already in
 * Storage, rewriting ONLY the @import line, so nothing else about the system
 * changes (a full republish would also regenerate its colors).
 *
 * Uses the studio's own pinHeaderFontImport, reading each system's
 * typography-tokens.css, so the pinned request matches a fresh publish exactly.
 *
 * Idempotent — a file without the full-range request is skipped.
 *
 * Dry run by default.
 *
 *   npx tsx scripts/pin-header-font.ts --id X [--id Y …]          # report
 *   npx tsx scripts/pin-header-font.ts --id X [--id Y …] --write  # apply
 *   … --write --backup DIR   # also save each original file under DIR first
 *   … --restore DIR --write  # put the files saved by --backup back
 *
 * Auth: Application Default Credentials.
 */

import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { headerFontQueryParam, pinHeaderFontImport } from '../src/utils/moodAxes.ts';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const admin = require(path.resolve(here, '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT = process.env.GCLOUD_PROJECT || 'dino-design';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'dino-design.firebasestorage.app';
const ROOT = 'design-systems';

const args = process.argv.slice(2);
const write = args.includes('--write');
const backup = (() => { const i = args.indexOf('--backup'); return i >= 0 ? args[i + 1] : null; })();
const restore = (() => { const i = args.indexOf('--restore'); return i >= 0 ? args[i + 1] : null; })();
const ids = args.flatMap((a, i) => (a === '--id' ? [args[i + 1]] : []));
if (!ids.length) { console.error('Pass at least one --id.'); process.exit(1); }

async function main() {
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const bucket = admin.storage().bucket();
  const full = headerFontQueryParam();
  let changed = 0;

  if (restore) {
    for (const id of ids) {
      const dir = path.join(restore, ROOT, id);
      for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.css'))) {
        const file = bucket.file(`${ROOT}/${id}/${name}`);
        const [meta] = await file.getMetadata();
        const wasGzip = meta.contentEncoding === 'gzip';
        const css = fs.readFileSync(path.join(dir, name), 'utf8');
        console.log(`restore ${file.name}`);
        changed++;
        if (!write) continue;
        const body = wasGzip ? zlib.gzipSync(Buffer.from(css, 'utf8'), { level: 9 }) : Buffer.from(css, 'utf8');
        await file.save(body, {
          contentType: meta.contentType || 'text/css',
          metadata: {
            ...(wasGzip ? { contentEncoding: 'gzip' } : {}),
            cacheControl: meta.cacheControl || 'no-cache, max-age=0, must-revalidate',
          },
        });
      }
    }
    console.log(`\n${write ? 'RESTORED' : 'DRY RUN'} — ${changed} file(s)`);
    return;
  }

  for (const id of ids) {
    const [typo] = await bucket.file(`${ROOT}/${id}/typography-tokens.css`).download();
    const typographyCSS = typo.toString('utf8');
    const [files] = await bucket.getFiles({ prefix: `${ROOT}/${id}/` });

    for (const file of files.filter((f: any) => f.name.endsWith('.css'))) {
      const [meta] = await file.getMetadata();
      const wasGzip = meta.contentEncoding === 'gzip';
      const [raw] = await file.download(); // gzip is decoded transparently
      const css = raw.toString('utf8');
      if (!css.includes(full)) continue;

      const next = pinHeaderFontImport(css, typographyCSS);
      const pinned = next.match(/family=Google\+Sans\+Flex:[^&']*/)?.[0];
      console.log(`${file.name}\n    -> ${pinned}`);
      changed++;
      if (!write) continue;
      if (backup) {
        const out = path.join(backup, file.name);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, css);
      }

      const body = wasGzip ? zlib.gzipSync(Buffer.from(next, 'utf8'), { level: 9 }) : Buffer.from(next, 'utf8');
      await file.save(body, {
        contentType: meta.contentType || 'text/css',
        metadata: {
          ...(wasGzip ? { contentEncoding: 'gzip' } : {}),
          cacheControl: meta.cacheControl || 'no-cache, max-age=0, must-revalidate',
        },
      });
    }
  }

  console.log(`\n${write ? 'PINNED' : 'DRY RUN'} — ${changed} file(s) ${write ? 'rewritten' : 'would change'}`);
  if (!write) console.log('Nothing was written. Re-run with --write.');
}

main().catch((e) => { console.error('Failed:', e?.message ?? e); process.exit(1); });
