/**
 * Set one design system's authored mesh gradient, from a pasted CSS rule.
 *
 * The admin-side twin of `setMeshGradient()` in src/utils/meshGradient.ts: same
 * two writes, in the same order — Firestore first, then the public file — but
 * running under firebase-admin so it works from a terminal without the owner's
 * browser session.
 *
 * Parsing goes through the SAME `parseMeshGradient` the app uses, so a rule that
 * this script accepts is one the studio would accept. Re-implementing the
 * extraction here is how the stored value starts drifting from what the paste
 * box would have produced.
 *
 * Only `background` and `color` are kept. The pasted rule also carries the
 * card's 800x450 box, its text layout and two font families — none of which
 * belong to the mesh. The fonts in particular are the SYSTEM's type roles, and
 * baking them in would override whatever typography the design actually chose.
 *
 * Dry run by default. Pass --write to commit.
 *
 *   node scripts/set-mesh-gradient.ts <id> <file.css>
 *   node scripts/set-mesh-gradient.ts <id> <file.css> --write
 *
 * Auth: Application Default Credentials.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseMeshGradient, generateMeshGradientCSS } from '../src/utils/meshGradientCSS.ts';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const PROJECT = process.env.GCLOUD_PROJECT || 'dino-design';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'dino-design.firebasestorage.app';
const FILENAME = 'mesh-gradient.css';
const ROOT = 'design-systems';
const CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

const args = process.argv.slice(2).filter((a) => a !== '--write');
const write = process.argv.includes('--write');
const [id, file] = args;

if (!id || !file) {
  console.error('Usage: node scripts/set-mesh-gradient.ts <design-system-id> <file.css> [--write]');
  process.exit(1);
}

async function main() {
  const mesh = parseMeshGradient(readFileSync(file, 'utf8'));
  if (!mesh) throw new Error('No background value found in that CSS.');

  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const ref = db.doc(`designSystems/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No design system ${id}.`);
  const data = snap.data() || {};
  const previous = data.meshGradient;

  console.log(`${write ? 'WRITE' : 'DRY RUN'} — ${data.name || '(unnamed)'}  (${id})\n`);
  if (previous?.background) {
    console.log('  before:', previous.background.slice(0, 110) + (previous.background.length > 110 ? '…' : ''));
  } else {
    console.log('  before: (none)');
  }
  console.log('  after :', mesh.background.slice(0, 110) + (mesh.background.length > 110 ? '…' : ''));
  console.log('  text  :', mesh.color ?? '(defaults to var(--Text))');

  const dropped = ['width', 'height', 'position', 'font-family', 'font-size']
    .filter((prop) => new RegExp(`(?:^|[{;\\s])${prop}\\s*:`, 'i').test(readFileSync(file, 'utf8')));
  if (dropped.length) {
    console.log(`  ignored: ${dropped.join(', ')} — not part of the mesh`);
  }

  const css = generateMeshGradientCSS(mesh);
  const path = `${ROOT}/${id}/${FILENAME}`;
  console.log(`  file  : ${path} (${Buffer.byteLength(css)} bytes)`);

  if (!write) {
    console.log('\nNothing was written. Re-run with --write to commit.');
    return;
  }

  // Firestore first, then the file — a published file the document does not
  // know about is worse than a document with no file, because a later save
  // would not notice it needed to overwrite one.
  await ref.set(
    { meshGradient: mesh, meshGradientUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log('  ✅ Firestore updated');

  await bucket.file(path).save(css, {
    contentType: 'text/css',
    metadata: { cacheControl: CACHE_CONTROL },
  });
  console.log(`  ✅ published (cache-control: ${CACHE_CONTROL})`);
  console.log(`  url   : https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`);
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exit(1);
});
