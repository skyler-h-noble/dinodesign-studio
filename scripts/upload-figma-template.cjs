#!/usr/bin/env node
// One-shot uploader for the master Figma template.
//
// Usage:
//   node scripts/upload-figma-template.js <path-to-fig-file>
//
// Why this exists: the Firebase Console's drag-and-drop upload sometimes
// fails to register files in the firebasestorage.googleapis.com metadata
// service for the new firebasestorage.app buckets, so the studio's fetch
// 404s even when the file is visible in the console. Uploading via the
// Admin SDK writes the file with the proper Firebase Storage metadata
// (including a download token) so the REST API can find it.
//
// Auth: uses Application Default Credentials. If you haven't authenticated
// yet, run:
//   gcloud auth application-default login
// or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key path.

const path = require('path');
const fs = require('fs');
// firebase-admin lives in functions/node_modules (not at the project root),
// so we resolve it from there explicitly. Avoids installing it twice.
const admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const BUCKET = 'dino-design.firebasestorage.app';
const DEST = 'figma-templates/dinodesign-template.fig';

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: node scripts/upload-figma-template.js <path-to-fig-file>');
    process.exit(1);
  }
  const absSrc = path.resolve(src);
  if (!fs.existsSync(absSrc)) {
    console.error(`File not found: ${absSrc}`);
    process.exit(1);
  }

  admin.initializeApp({
    projectId: 'dino-design',
    storageBucket: BUCKET,
  });

  const bucket = admin.storage().bucket();
  console.log(`Uploading ${absSrc} → gs://${BUCKET}/${DEST}`);
  await bucket.upload(absSrc, {
    destination: DEST,
    metadata: {
      contentType: 'application/octet-stream',
      cacheControl: 'no-cache, max-age=0, must-revalidate',
      metadata: {
        // Adds a Firebase Storage download token so the file is reachable
        // via firebasestorage.googleapis.com/v0/.../?alt=media.
        firebaseStorageDownloadTokens: require('crypto').randomUUID(),
      },
    },
  });
  console.log('✔ Upload complete.');
  console.log(`URL: https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(DEST)}?alt=media`);
  process.exit(0);
}

main().catch(err => {
  console.error('Upload failed:', err);
  process.exit(1);
});
