#!/usr/bin/env node
// Report-only scan of every saved design system's BODY font.
//
// Why this exists: the body pool is enforced server-side, in the
// analyzeMoodboard Cloud Function, at the moment a system is generated. So a
// font removed from the pool keeps living in every system that was generated
// before the removal shipped — the pool edit is not retroactive, and nothing
// in the app ever re-checks a saved family against the current pool.
//
// Timmana is the case that prompted it: single-weight, and its Latin is drawn
// slanted and heavy, so an upright normal-400 label renders as italic bold.
//
// This script WRITES NOTHING. It prints what it found and exits. Repointing a
// system's body font is a design decision — which replacement, per system —
// and that belongs to a separate, deliberate step.
//
// Usage:
//   node scripts/scan-body-fonts.cjs
//   node scripts/scan-body-fonts.cjs --family Timmana   # just one family
//   node scripts/scan-body-fonts.cjs --json             # machine-readable
//
// Auth: Application Default Credentials. If you haven't authenticated yet:
//   gcloud auth application-default login
//   gcloud config set project dino-design

const path = require('path');
const fs = require('fs');

// firebase-admin lives in functions/node_modules (the studio root has no
// top-level node_modules). Same trick the other scripts here use.
const admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const onlyFamily = (() => {
  const i = args.indexOf('--family');
  return i >= 0 ? args[i + 1] : null;
})();

// ─── The pool, read from the same file the function reads ────────────────────
// Not a second hand-maintained list: font_library.json is the source of truth
// for what a body font may be, and a copy here would drift from it silently —
// which is the shape of bug this whole scan is chasing.
const LIB = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'functions', 'data', 'font_library.json'), 'utf8'),
);
const BODY_POOL = new Set([
  ...(LIB.body_pool?.sans || []),
  ...(LIB.body_pool?.serif || []),
]);

/** Strip a stored family down to the bare name. Families are sometimes saved
 *  as a full CSS stack ("Timmana", sans-serif) rather than a plain name. */
function bareFamily(raw) {
  if (!raw) return null;
  return String(raw).split(',')[0].replace(/["']/g, '').trim() || null;
}

/** Every body family a document mentions, with where it came from.
 *
 *  Two things make this less obvious than it looks, and the first version of
 *  this script got both wrong and reported all 31 systems as clean:
 *
 *  1. The typography does NOT live at the top of the document. It is inside
 *     `snapshot` — the top level carries only colors, name, version and
 *     `headerFontFamily`. Reading the top level finds nothing and finding
 *     nothing looks exactly like finding no problem.
 *  2. A system carries the role list AND a 3-entry settings sidecar, and they
 *     can disagree — so report both rather than picking one and hoping.
 */
function bodyFamilies(data) {
  const out = [];
  // Check the snapshot AND the top level: the snapshot is where it actually
  // lives today, but a scan that only looks there would go quiet if the shape
  // ever moves back, which is the same silent failure all over again.
  const scopes = [
    ['snapshot', data.snapshot || {}],
    ['root', data],
  ];
  for (const [scope, obj] of scopes) {
    const styles = Array.isArray(obj.typographyStyles) ? obj.typographyStyles : [];
    for (const s of styles) {
      if (s && s.type === 'body') {
        const f = bareFamily(s.family);
        if (f) out.push({ where: `${scope}.typographyStyles`, family: f, weight: s.weight ?? null });
      }
    }
    const settings = Array.isArray(obj.typographySettings) ? obj.typographySettings : [];
    settings.forEach((s, i) => {
      if (s && (s.type === 'body' || s.role === 'body')) {
        const f = bareFamily(s.family);
        if (f) out.push({ where: `${scope}.typographySettings[${i}]`, family: f, weight: s.weight ?? null });
      }
    });
  }
  return out;
}

(async () => {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'dino-design' });
  const db = admin.firestore();

  const snap = await db.collection('designSystems').get();

  const rows = [];
  const byFamily = new Map();
  // Tracked apart from `rows`: a system with no body font recorded at all is a
  // different finding from one whose body font left the pool, and mixing them
  // into the same list makes the count mean two things at once.
  const noBodyFont = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const found = bodyFamilies(data);
    if (!found.length) {
      noBodyFont.push({ id: doc.id, name: data.name || '(unnamed)' });
      return;
    }
    for (const f of found) {
      const inPool = BODY_POOL.has(f.family);
      if (onlyFamily && f.family !== onlyFamily) continue;
      if (!onlyFamily && inPool) continue; // only report what the pool no longer allows
      rows.push({
        id: doc.id,
        name: data.name || '(unnamed)',
        owner: data.userId || data.ownerId || null,
        updated: data.dateUpdated || data.dateCreated || null,
        where: f.where,
        family: f.family,
        weight: f.weight,
        inPool,
      });
      byFamily.set(f.family, (byFamily.get(f.family) || 0) + 1);
    }
  });

  if (asJson) {
    console.log(JSON.stringify({ total: snap.size, poolSize: BODY_POOL.size, rows, noBodyFont }, null, 2));
    process.exit(0);
  }

  console.log(`Scanned ${snap.size} design systems.`);
  console.log(`Current body pool: ${BODY_POOL.size} families.`);
  console.log('');

  if (noBodyFont.length) {
    console.log(`${noBodyFont.length} system(s) record no body font at all:`);
    for (const r of noBodyFont) console.log(`  ${String(r.name).padEnd(28)} ${r.id}`);
    console.log('');
  }

  if (!rows.length) {
    console.log(onlyFamily
      ? `No system uses "${onlyFamily}" as its body font.`
      : 'Every saved system\'s body font is still in the pool.');
    process.exit(0);
  }

  const header = onlyFamily
    ? `Systems using "${onlyFamily}" as body:`
    : 'Systems whose body font is NO LONGER in the pool:';
  console.log(header);
  console.log('');
  for (const r of rows) {
    console.log(`  ${r.family.padEnd(24)} ${String(r.name).padEnd(28)} ${r.id}`);
    console.log(`  ${''.padEnd(24)} ${r.where}${r.weight ? ` · weight ${r.weight}` : ''}${r.updated ? ` · ${r.updated}` : ''}`);
  }
  console.log('');
  console.log('Counts by family:');
  for (const [fam, n] of [...byFamily.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${fam}`);
  }
  console.log('');
  console.log('Nothing was changed. Re-pick the body font in the typography stage,');
  console.log('or write a separate migration once you have chosen replacements.');
  process.exit(0);
})().catch((err) => {
  console.error('Scan failed:', err && err.message ? err.message : err);
  process.exit(1);
});
