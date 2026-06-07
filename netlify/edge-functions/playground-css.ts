// Pre-injects the user's brand CSS into the /playground HTML so the
// browser fetches it in parallel with the JS bundle and paints branded on
// first frame. Without this, the SPA's JS has to download, mount the React
// tree, and then issue 5 CSS fetches — leaving a visible flash of the
// lib's default tokens. With this, the <link> tags are already in <head>
// before any JS runs, so the brand sheets are applied by the time the
// React tree first paints.
//
// Runs only on /playground; static assets and other routes pass through.
//
// Storage layout (kept in sync with src/utils/firebase/storage.ts):
//   design-systems/<uuid>/foundation.css
//   design-systems/<uuid>/core.css
//   design-systems/<uuid>/Light-Mode.css
//   design-systems/<uuid>/base.css
//   design-systems/<uuid>/styles.css
//
// Each <link> carries the same `id` the DynoDesignProvider uses internally
// (`dyno-foundation`, `dyno-core`, `dyno-mode`, `dyno-base`, `dyno-styles`).
// When the Provider later calls `loadCSSSource`, it finds the existing tag
// by id and resolves immediately — no duplicate fetch, no FOUC.

import type { Context } from 'https://edge.netlify.com';

// Edge function reads the bucket name from the same Firebase env var the
// studio uses (FIREBASE_STORAGE_BUCKET). Configure in Netlify dashboard:
// Site settings → Environment variables.
const STORAGE_BUCKET = Netlify.env.get('FIREBASE_STORAGE_BUCKET') ?? '';

// File names + Provider tag-ids. Keep in sync with:
//   - src/utils/generateDesignSystem.ts (upload manifest)
//   - DinoDesign/src/DynoDesignProvider.js (TAG constants)
const SHEETS: Array<{ id: string; file: string }> = [
  { id: 'dyno-foundation', file: 'foundation.css' },
  { id: 'dyno-core',       file: 'core.css' },
  { id: 'dyno-mode',       file: 'Light-Mode.css' },
  { id: 'dyno-base',       file: 'base.css' },
  { id: 'dyno-styles',     file: 'styles.css' },
];

// Conservative validator — UUIDs / Firestore ids only. Rejects anything
// that could be a path-traversal attempt or that wouldn't be a valid
// Firebase document id.
const UUID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function buildHref(uuid: string, file: string): string {
  const path = encodeURIComponent(`design-systems/${uuid}/${file}`);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${path}?alt=media`;
}

export default async (request: Request, context: Context): Promise<Response | undefined> => {
  if (!STORAGE_BUCKET) return;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('user');
  if (!uuid || !UUID_RE.test(uuid)) return;

  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (!html.includes('</head>')) return new Response(html, response);

  // preconnect saves the TLS round-trip on the first <link> fetch.
  const preconnect =
    `<link rel="preconnect" href="https://firebasestorage.googleapis.com" crossorigin>`;
  const links = SHEETS.map(s =>
    `<link rel="stylesheet" id="${s.id}" data-dyno="true" data-dyno-edge="true" href="${buildHref(uuid, s.file)}">`
  ).join('');
  const injected = html.replace('</head>', `${preconnect}${links}</head>`);

  // Cache: HTML body differs per ?user=, so vary on query. Short edge cache
  // gives most users the templated HTML without a round-trip while still
  // picking up freshly-published designs within a few minutes.
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'public, max-age=0, s-maxage=60, must-revalidate');

  return new Response(injected, {
    status: response.status,
    headers,
  });
};

export const config = {
  path: '/playground',
};
