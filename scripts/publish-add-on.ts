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
 * Auth: publishAddOn wants an admin's Firebase ID token, so this signs in as
 * the admin with email and password — the same way the Figma plugin does, and
 * the reason scripts/set-admin-password.cjs exists ("so the admin Figma plugin
 * can sign them in via email + password").
 *
 * It does NOT mint a custom token. createCustomToken has to SIGN a JWT, which
 * user-level Application Default Credentials cannot do; the Admin SDK then
 * looks for a service account, falls through to the GCE metadata server and
 * fails with ENOTFOUND on a laptop. Signing in as the user needs no service
 * account, no signBlob permission and no ADC at all.
 *
 * Set ADDON_ADMIN_EMAIL to skip the email prompt. The password is always
 * prompted and never echoed.
 */
import { slotBar } from '../src/utils/addOns/defineComponent';
import { toAddonSpec, tokensUsed } from '../src/utils/addOns/toAddonSpec';
import type { ComponentDefinition } from '../src/utils/addOns/defineComponent';

const FN_BASE = 'https://us-central1-dino-design.cloudfunctions.net';
const API_KEY = 'AIzaSyAy-2SAGKOqCiIdsCG4G7UHZWhTUhH4kkw';   // public web key

/** Every definition that can be published, by id. */
const DEFINITIONS: Record<string, ComponentDefinition> = {
  [slotBar.id]: slotBar,
};

const CTRL_C = String.fromCharCode(0x03);
const CTRL_D = String.fromCharCode(0x04);
const BACKSPACE = String.fromCharCode(0x7f);

/** Reads a line without echoing it. Same handling as set-admin-password.cjs,
 *  including Ctrl-C, so a mistyped password can be abandoned cleanly. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let value = '';
    const handler = (raw: Buffer | string) => {
      const char = raw.toString();
      if (char === '\n' || char === '\r' || char === CTRL_D) {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        resolve(value);
        return;
      }
      if (char === CTRL_C) { process.stdout.write('\n'); process.exit(130); }
      if (char === BACKSPACE) {
        if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
        return;
      }
      value += char;
      process.stdout.write('*');
    };
    process.stdin.on('data', handler);
  });
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const handler = (raw: Buffer | string) => {
      process.stdin.pause();
      process.stdin.removeListener('data', handler);
      resolve(raw.toString().trim());
    };
    process.stdin.on('data', handler);
  });
}

async function adminIdToken(): Promise<string> {
  const email = process.env.ADDON_ADMIN_EMAIL || await promptLine('  admin email: ');
  const password = await promptHidden('  password: ');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json() as { idToken?: string; error?: { message?: string } };
  if (!res.ok || !data.idToken) {
    /* publishAddOn checks users/{uid}.isAdmin separately, so signing in is
       only half of it — a valid non-admin account gets a clear 403 from the
       endpoint rather than failing here. */
    throw new Error(`Sign-in failed: ${(data.error && data.error.message) || res.status}`);
  }
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
