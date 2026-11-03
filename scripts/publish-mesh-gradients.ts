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
 *   node scripts/publish-mesh-gradients.ts --only <id>[,<id>...]   # just these systems
 *
 * Republishing is also how a system gets the DARK variant (see darkMeshCSS in
 * meshGradientCSS.ts) — the light part of the file is unchanged. For each
 * system the dry run fetches the currently published mesh-gradient.css and the
 * two mode sheets (public, read-only) and prints:
 *   - whether the light part of the new file matches what is live, rules for
 *     rule (comments ignored), so a republish cannot quietly move the light mesh;
 *   - the text's worst contrast over the mesh in each mode, against that
 *     system's real palette, so a dark variant that fails 4.5:1 is seen BEFORE
 *     it is uploaded.
 *
 * Auth: Application Default Credentials.
 *   gcloud auth application-default login
 *   gcloud config set project dino-design
 */

import { createRequire } from 'node:module';
import {
  generateMeshGradientCSS, darkMeshBackground, DARK_MESH_TEXT, type MeshGradient,
} from '../src/utils/meshGradientCSS.ts';
import { readPalette, meshContrast, resolveTextColor } from '../src/utils/meshGradientContrast.ts';

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
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > -1
  ? new Set((process.argv[onlyAt + 1] || '').split(',').map((s) => s.trim()).filter(Boolean))
  : null;
if (only && !only.size) {
  console.error('--only needs a comma-separated list of design system ids.');
  process.exit(1);
}

function publicUrl(id: string, file = FILENAME): string {
  const path = encodeURIComponent(`${ROOT}/${id}/${file}`);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${path}?alt=media`;
}

/** A published file's text, or null when it is not there. Read-only. */
async function fetchPublished(id: string, file: string): Promise<string | null> {
  try {
    const res = await fetch(publicUrl(id, file));
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Worst text contrast over the mesh in one mode, as a printable line. */
function contrastLine(background: string, text: string, sheet: string | null): string {
  if (!sheet) return 'mode sheet not published — not checked';
  const palette = readPalette(sheet);
  const hex = resolveTextColor(text, palette);
  if (!hex) return `text ${text} does not resolve — not checked`;
  const r = meshContrast(background, hex, palette);
  if (r.missing.length) return `UNDEFINED in this sheet: ${r.missing.join(', ')}`;
  const worst = Math.min(r.worstStop, r.worstMesh);
  return `${worst.toFixed(2)}:1 worst (text ${hex}) ${worst >= 4.5 ? 'ok' : 'FAILS 4.5:1'}`;
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
    if (only && !only.has(doc.id)) return;
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

    const [live, lightSheet, darkSheet] = await Promise.all([
      fetchPublished(t.id, FILENAME),
      fetchPublished(t.id, 'Light-Mode.css'),
      fetchPublished(t.id, 'Dark-Mode.css'),
    ]);
    if (live === null) {
      console.log('   live : (not published yet)');
    } else {
      const liveRules = stripComments(live.split('/* Dark mode.')[0]);
      const same = stripComments(css).startsWith(liveRules);
      console.log(`   live : light rules ${same ? 'unchanged' : 'DIFFER from what is published'}${live.includes('@container style(') ? ' (already has the dark variant)' : ''}`);
    }
    const dark = darkMeshBackground(t.mesh.background);
    console.log(`   light: ${contrastLine(t.mesh.background, t.mesh.color || 'var(--Text)', lightSheet)}`);
    console.log(`   dark : ${dark
      ? contrastLine(dark, DARK_MESH_TEXT, darkSheet)
      : 'NO dark variant — the stack has a color that is not a palette tone (see darkMeshBackground)'}`);

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
