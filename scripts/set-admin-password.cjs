#!/usr/bin/env node
// One-shot script to set a Firebase Auth password AND the users/{uid}.isAdmin
// flag for a given Firebase user. Useful for bootstrapping admin accounts
// that were originally created via Google sign-in (and so have no password
// yet) so the admin Figma plugin can sign them in via email + password.
//
// Usage:
//   node scripts/set-admin-password.cjs <uid>
//
// Prompts for the password on stdin (hidden — characters are not echoed).
//
// Auth: uses Application Default Credentials. If you haven't authenticated
// yet, run:
//   gcloud auth application-default login
//   gcloud config set project dino-design
// or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key path.

const path = require('path');
// firebase-admin lives in functions/node_modules (the studio root has no
// top-level node_modules). Same trick the upload-figma-template script uses.
const admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

// Control characters — use char codes so they survive any tool that might
// strip or interpret escape sequences in source files.
const CTRL_C    = String.fromCharCode(0x03);
const CTRL_D    = String.fromCharCode(0x04);
const BACKSPACE = String.fromCharCode(0x7f);

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let value = '';
    const handler = (raw) => {
      const char = raw.toString();
      if (char === '\n' || char === '\r' || char === CTRL_D) {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        resolve(value);
        return;
      }
      if (char === CTRL_C) {
        process.stdout.write('\n');
        process.exit(130);
      }
      if (char === BACKSPACE) {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      value += char;
      process.stdout.write('*');
    };
    process.stdin.on('data', handler);
  });
}

(async () => {
  const uid = process.argv[2];
  if (!uid) {
    console.error('Usage: node scripts/set-admin-password.cjs <uid>');
    process.exit(1);
  }

  admin.initializeApp({ projectId: 'dino-design' });

  let userRecord;
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch (err) {
    console.error(`Could not find user with uid ${uid}: ${err.message}`);
    process.exit(1);
  }

  console.log(`Account:   ${userRecord.email}`);
  console.log(`Display:   ${userRecord.displayName || '(none)'}`);
  console.log(`Providers: ${userRecord.providerData.map((p) => p.providerId).join(', ') || '(none)'}`);
  console.log('');

  const password = await promptHidden('New password (min 6 chars, hidden): ');
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }
  const confirm = await promptHidden('Confirm password (hidden):          ');
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }

  await admin.auth().updateUser(uid, { password });
  console.log('✓ Password set in Firebase Auth.');

  await admin.firestore().doc(`users/${uid}`).set({ isAdmin: true }, { merge: true });
  console.log(`✓ users/${uid}.isAdmin set to true in Firestore.`);

  console.log('\nDone. Sign in to the admin plugin with this email and your new password.');
  process.exit(0);
})();
