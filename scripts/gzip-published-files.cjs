#!/usr/bin/env node
/**
 * Re-store every published TEXT file gzipped.
 *
 * Firebase Storage never compresses on the fly — it serves exactly the bytes it
 * was given, with no content-encoding, even when the client asks for gzip. A
 * design system's Light-Mode.css is 512KB of highly repetitive custom
 * properties and gzips to 21KB: four percent. Across the eight files a consumer
 * loads that is ~1.0MB becoming ~45KB, paid on every navigation because these
 * files also revalidate every time.
 *
 * The studio now gzips on upload, but that only helps systems generated from
 * here on. This backfills what is already published: same bytes, same paths,
 * same cache headers — only the stored encoding changes. Browsers decompress
 * transparently, so no consumer needs to know.
 *
 * Skips images (already compressed, would grow) and anything already gzipped,
 * so it is safe to re-run.
 *
 * Dry run by default. Pass --write to upload.
 *
 *   node scripts/gzip-published-files.cjs                 # report only
 *   node scripts/gzip-published-files.cjs --write         # compress all
 *   node scripts/gzip-published-files.cjs --write --id X  # one system
 *
 * Auth: Application Default Credentials.
 */

const path = require('path');
const zlib = require('zlib');
const admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT = process.env.GCLOUD_PROJECT || 'dino-design';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'dino-design.firebasestorage.app';
const ROOT = 'design-systems';

const args = process.argv.slice(2);
const write = args.includes('--write');
const onlyId = (() => { const i = args.indexOf('--id'); return i >= 0 ? args[i + 1] : null; })();

/** Worth compressing: text that repeats. Images are already compressed. */
const TEXT = /\.(css|json|md|js|txt|svg|html)$/i;
/** Below this, the gzip header costs more than it saves. */
const MIN_BYTES = 1024;

const fmt = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const bucket = admin.storage().bucket();

  const prefix = onlyId ? `${ROOT}/${onlyId}/` : `${ROOT}/`;
  const [files] = await bucket.getFiles({ prefix });

  let before = 0, after = 0, done = 0, skipped = 0;
  const failures = [];

  for (const file of files) {
    const name = file.name;
    if (!TEXT.test(name)) { skipped++; continue; }

    const [meta] = await file.getMetadata();
    if (meta.contentEncoding === 'gzip') { skipped++; continue; }

    const size = Number(meta.size || 0);
    if (size < MIN_BYTES) { skipped++; continue; }

    let raw;
    try { [raw] = await file.download(); }
    catch (e) { failures.push(`${name}: download failed — ${e.message}`); continue; }

    const gz = zlib.gzipSync(raw, { level: 9 });
    // A file that grows under compression stays as it is.
    if (gz.length >= raw.length) { skipped++; continue; }

    before += raw.length;
    after += gz.length;
    done++;

    if (!write) continue;

    try {
      await file.save(gz, {
        // Preserve everything about how it was served; change only the encoding.
        contentType: meta.contentType || 'application/octet-stream',
        metadata: {
          contentEncoding: 'gzip',
          cacheControl: meta.cacheControl || 'no-cache, max-age=0, must-revalidate',
        },
      });
    } catch (e) {
      failures.push(`${name}: upload failed — ${e.message}`);
    }
  }

  console.log(`${write ? 'COMPRESSED' : 'DRY RUN'} — ${done} file(s), ${skipped} skipped\n`);
  if (done) {
    console.log(`  before : ${fmt(before)}`);
    console.log(`  after  : ${fmt(after)}   (${Math.round((after / before) * 100)}% of original)`);
    console.log(`  saved  : ${fmt(before - after)}`);
  }
  if (failures.length) {
    console.log(`\n  ${failures.length} failure(s):`);
    for (const f of failures.slice(0, 10)) console.log(`    ${f}`);
  }
  if (!write) console.log('\nNothing was written. Re-run with --write.');
}

main().catch((e) => { console.error('Failed:', e?.message ?? e); process.exit(1); });
