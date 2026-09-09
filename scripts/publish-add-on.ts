/**
 * Publish a component definition as an add-on.
 *
 * Compiles a ComponentDefinition to an AddonSpec and pushes it through the
 * real publishAddOn endpoint — not straight into Storage. That matters: the
 * endpoint owns version bumping, the versions/{N} metadata document and the
 * catalog's currentVersion. Writing the file directly would duplicate that
 * logic and the two would drift, which is how the customer plugin ends up
 * fetching a version whose spec is not there.
 *
 * Dry run by default. Pass --write to publish.
 *   npx tsx scripts/publish-add-on.ts slot-bar
 *   npx tsx scripts/publish-add-on.ts slot-bar --write
 *
 * Auth: publishAddOn requires an admin's Firebase ID token, and a service
 * account does not have one. So this mints a custom token for an admin uid
 * with the Admin SDK and exchanges it for an ID token — the same exchange the
 * Figma plugin does when it signs in. Application Default Credentials:
 *   gcloud auth application-default login
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { slotBar } from '../src/utils/addOns/defineComponent';
import { toAddonSpec, tokensUsed } from '../src/utils/addOns/toAddonSpec';
import type { ComponentDefinition } from '../src/utils/addOns/defineComponent';

const require = createRequire(import.meta.url);
// firebase-admin lives in functions/node_modules, not at the root — same
// resolution the other scripts use rather than installing it twice.
const admin = require(path.resolve(process.cwd(), 'functions', 'node_modules', 'firebase-admin'));

const FN_BASE = 'https://us-central1-dino-design.cloudfunctions.net';
const API_KEY = 'AIzaSyAy-2SAGKOqCiIdsCG4G7UHZWhTUhH4kkw';   // public web key

/** Every definition that can be published, by id. */
const DEFINITIONS: Record<string, ComponentDefinition> = {
  [slotBar.id]: slotBar,
};

async function adminIdToken(): Promise<string> {
  /* The admin is looked up rather than hardcoded: admin status is a Firestore
     flag at users/{uid}.isAdmin, so adding or removing one is a field flip and
     a name baked in here would go stale silently. */
  const snap = await admin.firestore().collection('users').where('isAdmin', '==', true).limit(1).get();
  if (snap.empty) throw new Error('No user has isAdmin: true — cannot publish.');
  const uid = snap.docs[0].id;

  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { idToken: string };
  console.log(`  signing in as admin uid ${uid}`);
  return data.idToken;
}

async function main() {
  const id = process.argv[2];
  const write = process.argv.includes('--write');
  const def = id ? DEFINITIONS[id] : undefined;

  if (!def) {
    console.log('Usage: npx tsx scripts/publish-add-on.ts <id> [--write]');
    console.log('Known definitions: ' + Object.keys(DEFINITIONS).join(', '));
    process.exit(1);
  }

  const spec = toAddonSpec(def);
  const tokens = tokensUsed(def);

  console.log(`\n${def.label}  (${def.id})`);
  console.log(`  spec: ${JSON.stringify(spec).length} bytes`);
  console.log('  tokens it needs:');
  for (const t of tokens) console.log(`    ${t}`);

  /* A literal in the spec would ship the AUTHOR's brand to every customer who
     imports it, and stays invisible until someone opens it in a different
     palette. The definition type has nowhere to put one, so finding one here
     means the compiler invented it — worth stopping for either way. */
  const literals = JSON.stringify(spec).match(/#[0-9a-fA-F]{6}/g);
  if (literals) {
    console.error(`\n  REFUSING: ${literals.length} hardcoded colour(s): ${literals.join(', ')}`);
    process.exit(1);
  }

  if (!write) {
    console.log('\n  Dry run. Pass --write to publish.\n');
    return;
  }

  admin.initializeApp({ projectId: 'dino-design' });
  const idToken = await adminIdToken();

  const res = await fetch(`${FN_BASE}/publishAddOn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ addOnId: def.id, name: def.label, spec, notes: 'published from definition' }),
  });
  const body = await res.json().catch(() => ({})) as { version?: number; storagePath?: string; error?: string };
  if (!res.ok) {
    console.error(`\n  Publish failed: ${body.error || res.status}\n`);
    process.exit(1);
  }
  console.log(`\n  Published v${body.version} → ${body.storagePath}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
