/**
 * Publish each system's authored mesh gradient as a public CSS file.
 *
 * `setMeshGradient()` does two things — write `designSystems/{id}.meshGradient`
 * and upload `design-systems/{id}/mesh-gradient.css`. Whatever seeded the three
 * authored meshes did only the first, so the documents carry the mesh while the
 * public file 404s. The overlay tool is a public page with no Firebase auth and
 * can only read the file, so from its side the mesh does not exist.
 *
 * This backfills the second half from the first. It reads what is already in
 * Firestore — it does not invent or re-parse a mesh — and generates the CSS with
 * the SAME function the app uses (see meshGradientCSS.ts for why that module is
 * split out), so the published file cannot drift from what the studio previews.
 *
 * Dry run by default. Pass --write to upload.
 *
 *   node scripts/publish-mesh-gradients.ts            # show what would happen
 *   node scripts/publish-mesh-gradients.ts --write    # actually upload
 *
 * Auth: Application Default Credentials.
 *   gcloud auth application-default login
 *   gcloud config set project dino-design
 */

import { createRequire } from 'node:module';
import { generateMeshGradientCSS, type MeshGradient } from '../src/utils/meshGradientCSS.ts';

// firebase-admin is CJS and lives in functions/node_modules (the studio root
// has none). Same trick the other scripts in here use.
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const PROJECT = process.env.GCLOUD_PROJECT || 'dino-design';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'dino-design.firebasestorage.app';
const FILENAME = 'mesh-gradient.css';
const ROOT = 'design-systems';

/** Matches uploadDesignSystemFile — the playground and the overlay tool must
 *  never serve a stale mesh out of cache after a re-publish. */
const CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

const write = process.argv.includes('--write');

function publicUrl(id: string): string {
  const path = encodeURIComponent(`${ROOT}/${id}/${FILENAME}`);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${path}?alt=media`;
}

async function main() {
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection('designSystems').get();
  const targets: { id: string; name: string; mesh: MeshGradient }[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data() || {};
    const mesh = data.meshGradient;
    // A mesh with no background is not publishable — generating CSS from it
    // would emit `--Mesh-Gradient: undefined`, which paints nothing and reports
    // nothing. Skip loudly rather than shipping a dud file.
    if (!mesh || typeof mesh.background !== 'string' || !mesh.background.trim()) return;
    targets.push({ id: doc.id, name: data.name || '(unnamed)', mesh });
  });

  console.log(`${write ? 'PUBLISH' : 'DRY RUN'} — ${targets.length} system(s) with an authored mesh\n`);
  if (!targets.length) {
    console.log('Nothing to publish.');
    return;
  }

  for (const t of targets) {
    const css = generateMeshGradientCSS(t.mesh);
    const path = `${ROOT}/${t.id}/${FILENAME}`;
    console.log(`── ${t.name}  (${t.id})`);
    console.log(`   path : ${path}`);
    console.log(`   size : ${Buffer.byteLength(css)} bytes`);
    console.log(`   text : ${t.mesh.color ?? '(defaults to var(--Text))'}`);
    // The stacks are written in brand tokens, so the consumer must also load
    // the system's colour CSS or every var() resolves to nothing and the whole
    // background declaration is dropped silently.
    const tokens = [...new Set(css.match(/var\(--[\w-]+\)/g) || [])];
    console.log(`   tokens: ${tokens.length} referenced — consumer must load foundation.css + Light-Mode.css`);

    if (write) {
      await bucket.file(path).save(css, {
        contentType: 'text/css',
        metadata: { cacheControl: CACHE_CONTROL },
      });
      console.log(`   ✅ uploaded (cache-control: ${CACHE_CONTROL})`);
    }
    console.log(`   url  : ${publicUrl(t.id)}\n`);
  }

  if (!write) {
    console.log('Nothing was written. Re-run with --write to upload.');
  }
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exit(1);
});
