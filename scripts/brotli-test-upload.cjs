#!/usr/bin/env node
// Brotli test: publish a MINIFIED + BROTLI copy of one design system's CSS
// next to the real one, so the two can be measured side by side.
//
// Usage:
//   node scripts/brotli-test-upload.cjs <designSystemId>            # prepare + upload
//   node scripts/brotli-test-upload.cjs <designSystemId> --dry-run  # prepare only, no upload
//
// What it does:
//   1. Downloads <id>/theme.json and every CSS file it lists (read-only).
//   2. Minifies each CSS file WHITESPACE-ONLY: comments and the spaces between
//      tokens go; every declaration value is kept byte-for-byte (no color,
//      number or quote is rewritten — a value-rewriting minifier failed the
//      token snapshot with 1.1M differences; this one passed with 0).
//   3. Brotli-compresses them (quality 11) and uploads to
//        brotli-test/<id>/<file>    with Content-Encoding: br
//      plus brotli-test/<id>/theme.json pointing at those copies.
//
// It NEVER writes under design-systems/ — the real system is untouched, and
// deleting the brotli-test/ folder removes everything this created.
//
// Auth: Application Default Credentials, as upload-figma-template.cjs:
//   gcloud auth application-default login

const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const BUCKET = 'dino-design.firebasestorage.app';
const BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/`;
const urlFor = (p, token) => BASE + encodeURIComponent(p) + '?alt=media' + (token ? '&token=' + token : '');

/* ── whitespace-only minifier (port of the safemin pass that passed the
      1,047-token snapshot with zero differences) ── */
function stripComments(t) {
  let out = ''; let q = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { out += c; if (c === '\\') { out += t[++i] ?? ''; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = (j < 0 ? t.length : j + 2) - 1; continue; }
    out += c;
  }
  return out;
}
function splitDecls(b) {
  const parts = []; let cur = ''; let depth = 0; let q = null;
  for (const c of b) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}
const normSel = (s) => s.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',');
function emit(t) {
  const out = []; let i = 0;
  while (i < t.length) {
    const m = /^\s*(@import[^;]*;)/.exec(t.slice(i));
    if (m) { out.push(m[1].trim()); i += m[0].length; continue; }
    const j = t.indexOf('{', i);
    if (j < 0) break;
    const head = t.slice(i, j);
    let d = 1; let k = j + 1;
    while (d && k < t.length) { if (t[k] === '{') d++; else if (t[k] === '}') d--; k++; }
    const body = t.slice(j + 1, k - 1);
    const h = head.trim();
    if (h.startsWith('@')) out.push(h.replace(/\s+/g, ' ') + '{' + emit(body) + '}');
    else {
      const decls = splitDecls(body).filter((p) => p.includes(':')).map((p) => {
        const c = p.indexOf(':'); return p.slice(0, c).trim() + ':' + p.slice(c + 1).trim();
      });
      out.push(normSel(h) + '{' + decls.join(';') + '}');
    }
    i = k;
  }
  return out.join('');
}
const minify = (css) => emit(stripComments(css));

async function main() {
  const [id, flag] = process.argv.slice(2);
  if (!id) { console.error('Usage: node scripts/brotli-test-upload.cjs <designSystemId> [--dry-run]'); process.exit(1); }
  const dry = flag === '--dry-run';
  const theme = await (await fetch(urlFor(`design-systems/${id}/theme.json`))).json();
  const keys = ['foundation', 'core', 'typography', 'lightMode', 'darkMode', 'base', 'styles'].filter((k) => theme[k]);
  const files = [];
  console.log(`${theme.name} (${id})`);
  console.log('file'.padEnd(26), 'raw'.padStart(9), 'gzip now'.padStart(9), 'min+br'.padStart(9));
  for (const k of keys) {
    const res = await fetch(theme[k]);
    const css = await res.text();
    const name = decodeURIComponent(new URL(theme[k]).pathname.split('/o/')[1]).split('/').pop();
    const min = minify(css);
    const br = zlib.brotliCompressSync(Buffer.from(min), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
    const gz = zlib.gzipSync(Buffer.from(css), { level: 9 });
    console.log(name.padEnd(26), String(css.length).padStart(9), String(gz.length).padStart(9), String(br.length).padStart(9));
    files.push({ key: k, name, br });
  }
  const total = files.reduce((n, f) => n + f.br.length, 0);
  console.log(`total min+br: ${(total / 1024).toFixed(1)} KB`);
  if (dry) { console.log('(dry run — nothing uploaded)'); return; }

  const admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  admin.initializeApp({ projectId: 'dino-design', storageBucket: BUCKET });
  const bucket = admin.storage().bucket();
  const testTheme = { ...theme, name: theme.name + ' (brotli test)' };
  /* brotli-test/ is not publicly readable under storage.rules (only
     design-systems/ is), so every link carries its file's download token —
     a token URL is served without a rules change. */
  for (const f of files) {
    const dest = `brotli-test/${id}/${f.name}`;
    const token = crypto.randomUUID();
    await bucket.file(dest).save(f.br, {
      resumable: false,
      metadata: {
        contentType: 'text/css; charset=utf-8',
        contentEncoding: 'br',
        cacheControl: 'no-cache, max-age=0, must-revalidate',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    testTheme[f.key] = urlFor(dest, token);
    console.log('✔', dest);
  }
  const tdest = `brotli-test/${id}/theme.json`;
  const ttoken = crypto.randomUUID();
  await bucket.file(tdest).save(JSON.stringify(testTheme, null, 2), {
    resumable: false,
    metadata: { contentType: 'application/json', cacheControl: 'no-cache, max-age=0, must-revalidate',
      metadata: { firebaseStorageDownloadTokens: ttoken } },
  });
  console.log('✔', tdest);
  console.log('\nTest themeURL:\n' + urlFor(tdest, ttoken));
  process.exit(0);
}

main().catch((e) => { console.error('Failed:', e); process.exit(1); });
