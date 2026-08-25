#!/usr/bin/env node
/**
 * Add `--Text-Quiet` to already-published CSS.
 *
 * The lib reads --Text-Quiet 364 times — it is what `<Body color="quiet">` and
 * every Caption resolve to — and the export emitted it zero times. Nine sibling
 * roles shipped (--Text-Primary, --Text-Error, …); quiet was simply missing, so
 * the colour declaration was invalid at computed-value time and the text
 * inherited whatever surrounded it.
 *
 * The generator now emits it. This does the same for systems already published,
 * so 31 design systems do not each need a manual regenerate through the UI.
 *
 * --Quiet is CANONICAL and holds the literal; --Text-Quiet reads it. The
 * direction matters: reversing it also "cannot drift" and looks identical in a
 * diff, but makes the back-compat name the source of truth.
 *
 * The alias is written beside every --Quiet declaration, so it inherits the
 * same surface scoping and can never resolve to a different surface's value.
 *
 * Idempotent — a file that already has the alias is skipped, so re-running is
 * safe. Handles gzipped objects (everything is gzipped as of today).
 *
 * Dry run by default.
 *
 *   node scripts/backfill-text-quiet.cjs                 # report
 *   node scripts/backfill-text-quiet.cjs --write         # apply
 *   node scripts/backfill-text-quiet.cjs --write --id X  # one system
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

/** Only the sheets that can carry --Quiet. */
const TARGET = /\/(Light-Mode|Dark-Mode|core|base|styles|foundation)\.css$/;

function addAlias(css) {
  return css.replace(
    /^(\s*)--Quiet:\s*([^;]+);/gm,
    (line, indent, value) => `${line}\n${indent}--Text-Quiet: var(--Quiet, ${value.trim()});`,
  );
}

async function main() {
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const bucket = admin.storage().bucket();

  const prefix = onlyId ? `${ROOT}/${onlyId}/` : `${ROOT}/`;
  const [files] = await bucket.getFiles({ prefix });

  let changed = 0, skipped = 0, aliases = 0;
  const failures = [];

  for (const file of files) {
    if (!TARGET.test(file.name)) { skipped++; continue; }

    const [meta] = await file.getMetadata();
    const wasGzip = meta.contentEncoding === 'gzip';

    let raw;
    try { [raw] = await file.download(); }
    catch (e) { failures.push(`${file.name}: ${e.message}`); continue; }

    // download() transparently decodes gzip, so `raw` is already plain text.
    const css = raw.toString('utf8');
    if (css.includes('--Text-Quiet:')) { skipped++; continue; }

    const next = addAlias(css);
    const added = (next.match(/^\s*--Text-Quiet:/gm) || []).length;
    if (!added) { skipped++; continue; }

    changed++;
    aliases += added;
    if (!write) continue;

    const body = wasGzip ? zlib.gzipSync(Buffer.from(next, 'utf8'), { level: 9 })
                         : Buffer.from(next, 'utf8');
    try {
      await file.save(body, {
        contentType: meta.contentType || 'text/css',
        metadata: {
          ...(wasGzip ? { contentEncoding: 'gzip' } : {}),
          cacheControl: meta.cacheControl || 'no-cache, max-age=0, must-revalidate',
        },
      });
    } catch (e) {
      failures.push(`${file.name}: upload failed — ${e.message}`);
    }
  }

  console.log(`${write ? 'BACKFILLED' : 'DRY RUN'} — ${changed} file(s) changed, ${skipped} skipped`);
  console.log(`  --Text-Quiet declarations added: ${aliases}`);
  if (failures.length) {
    console.log(`\n  ${failures.length} failure(s):`);
    for (const f of failures.slice(0, 10)) console.log(`    ${f}`);
  }
  if (!write) console.log('\nNothing was written. Re-run with --write.');
}

main().catch((e) => { console.error('Failed:', e?.message ?? e); process.exit(1); });
