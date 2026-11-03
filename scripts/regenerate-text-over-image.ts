/**
 * Regenerate text-over-image.css for already-published design systems, with a
 * floor for each mode.
 *
 * The published file solved every scrim from Light-Mode colors only, so dark
 * mode painted the dark --Background at an opacity solved for the light pair,
 * and the Default theme had no scrim at all. generateTextOverImage.ts now solves
 * both modes; this rebuilds the one file for systems that are already out.
 *
 * It reads the system's OWN published Light-Mode.css and Dark-Mode.css — the
 * sheets its consumers actually load — so the floors are solved for exactly
 * the colors on their pages. Nothing else is read or regenerated, and nothing
 * but text-over-image.css is ever written.
 *
 * Light floors must come out the same as what is published. If one does not,
 * the mode sheets changed after the file was made; the system is skipped
 * unless --allow-light-change is given, so a run never moves a light value
 * nobody asked to move.
 *
 * Dry run by default. Nothing is written without --write.
 *
 *   node scripts/regenerate-text-over-image.ts <id> [<id> …]            # report
 *   node scripts/regenerate-text-over-image.ts <id> --out ./tmp          # also save the files locally
 *   node scripts/regenerate-text-over-image.ts <id> [<id> …] --write    # upload
 *
 * Dark floors take effect where the mode sheet sets --Mode-Dark (0 in
 * Light-Mode.css, 1 in Dark-Mode.css), or where the page marks
 * <html data-mode="dark">. Until then a page gets the light floor, which is
 * exactly what it gets today.
 *
 * Auth for --write: Application Default Credentials.
 *   gcloud auth application-default login
 *   gcloud config set project dino-design
 */

import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODE_SWITCH_VAR,
  buildTextOverImageCSSFromModeSheets,
  solveModeScrims,
} from '../src/utils/cssgen/generateTextOverImage.ts';

const PROJECT = process.env.GCLOUD_PROJECT || 'dino-design';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'dino-design.firebasestorage.app';
const ROOT = 'design-systems';
const FILENAME = 'text-over-image.css';
/** Matches uploadDesignSystemFile. */
const CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

const args = process.argv.slice(2);
const write = args.includes('--write');
const allowLightChange = args.includes('--allow-light-change');
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
const ids = args.filter((a, i) => !a.startsWith('--') && !(outIdx >= 0 && i === outIdx + 1));

function publicUrl(id: string, file: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`${ROOT}/${id}/${file}`)}?alt=media`;
}

/** fetch() undoes the stored gzip transparently. */
async function readPublished(id: string, file: string): Promise<string | null> {
  const res = await fetch(publicUrl(id, file), { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.text();
}

/** The font @import lines every published sheet starts with. @import must
 *  come before every other rule, so they go back at the very top. */
function importLines(css: string | null): string[] {
  return (css ?? '').split('\n').filter((l) => l.trim().startsWith('@import'));
}

/** theme -> published floor, from a single-mode text-over-image.css. */
function publishedFloors(css: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of (css ?? '').matchAll(/\[data-theme="([^"]+)"\] \{\n {2}--Overlay-Scrim: ([\d.]+);/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

async function main() {
  if (!ids.length) {
    console.error('Give one or more design system ids. Nothing was read or written.');
    process.exit(1);
  }
  console.log(`${write ? 'WRITE' : 'DRY RUN'} — ${ids.length} system(s)\n`);

  let bucket: any = null;
  if (write) {
    // firebase-admin is CJS and lives in functions/node_modules. Loaded only
    // for --write, so a dry run needs no credentials at all.
    const require = createRequire(import.meta.url);
    const admin = require('../functions/node_modules/firebase-admin');
    admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
    bucket = admin.storage().bucket();
  }

  let written = 0;
  for (const id of ids) {
    console.log(`── ${id}`);
    const [light, dark, current] = await Promise.all([
      readPublished(id, 'Light-Mode.css'),
      readPublished(id, 'Dark-Mode.css'),
      readPublished(id, FILENAME),
    ]);
    if (!light || !dark) {
      console.log(`   SKIP: ${!light ? 'Light-Mode.css' : 'Dark-Mode.css'} is not published.\n`);
      continue;
    }

    const scrims = solveModeScrims(light, dark);
    const before = publishedFloors(current);
    const lightChanges: string[] = [];
    for (const s of scrims) {
      const was = before[s.theme];
      const l = s.light?.alpha ?? null;
      const d = s.dark?.alpha ?? null;
      let note = '';
      if (was === undefined) note = 'NEW (was missing)';
      else if (was !== l) { note = `LIGHT CHANGED from ${was}`; lightChanges.push(s.theme); }
      if (s.light && !s.light.feasible) note += ' light infeasible';
      if (s.dark && !s.dark.feasible) note += ' dark infeasible';
      console.log(`   ${s.theme.padEnd(10)} light ${String(l).padEnd(5)} dark ${String(d).padEnd(5)} ${note}`);
    }
    const switchDefined = light.includes(`${MODE_SWITCH_VAR}:`) && dark.includes(`${MODE_SWITCH_VAR}:`);
    console.log(`   mode switch ${MODE_SWITCH_VAR} in the mode sheets: ${switchDefined ? 'yes' : 'NO — dark floors apply only with <html data-mode="dark"> until the mode sheets are republished'}`);

    const imports = importLines(current).length ? importLines(current) : importLines(light);
    const body = buildTextOverImageCSSFromModeSheets(light, dark);
    if (!body) {
      console.log('   SKIP: no theme could be read from the mode sheets.\n');
      continue;
    }
    const css = imports.length ? `${imports.join('\n')}\n\n${body}` : body;
    console.log(`   size : ${Buffer.byteLength(css)} bytes (was ${current ? Buffer.byteLength(current) : 0})`);

    if (outDir) {
      mkdirSync(join(outDir, id), { recursive: true });
      writeFileSync(join(outDir, id, FILENAME), css);
      console.log(`   saved: ${join(outDir, id, FILENAME)}`);
    }

    if (lightChanges.length && !allowLightChange) {
      console.log(`   SKIP WRITE: light floor would change for ${lightChanges.join(', ')}. Re-run with --allow-light-change if that is intended.\n`);
      continue;
    }

    if (write) {
      // Same storage shape as uploadDesignSystemFile: gzipped bytes with
      // content-encoding, so every client decompresses transparently.
      await bucket.file(`${ROOT}/${id}/${FILENAME}`).save(gzipSync(css), {
        contentType: 'text/css',
        metadata: { cacheControl: CACHE_CONTROL, contentEncoding: 'gzip' },
      });
      written++;
      console.log('   uploaded');
    }
    console.log(`   url  : ${publicUrl(id, FILENAME)}\n`);
  }

  console.log(write ? `Uploaded ${written} file(s).` : 'Nothing was written. Re-run with --write to upload.');
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exit(1);
});
