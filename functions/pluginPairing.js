/**
 * Figma plugin device-pairing flow
 *
 * Three endpoints work together so a Figma plugin (which has no Firebase
 * Auth session of its own) can sign in as the user who approved it from
 * the studio:
 *
 *   1. createPluginPairingCode  — plugin → server (no auth)
 *        Plugin asks for a 6-character code. Server stores a pairingCodes
 *        doc with status "pending" and a 10-minute TTL.
 *
 *   2. claimPluginPairingCode   — studio → server (auth required, callable)
 *        Signed-in user enters the code in studio. Server verifies the
 *        code is still pending + unexpired, then writes the user's uid
 *        and marks the doc "claimed". No token is generated yet.
 *
 *   3. pollPluginPairingCode    — plugin → server (no auth)
 *        Plugin polls until status flips to "claimed". On the first
 *        successful poll the server mints a single-use Firebase custom
 *        token for the claimed uid, deletes the pairing doc, and returns
 *        the token. The plugin exchanges that token for a normal Firebase
 *        Auth session via signInWithCustomToken on the client side.
 *
 * Security properties:
 *   • Plugin never holds long-lived credentials; the custom token is
 *     short-lived and consumed exactly once.
 *   • Studio user must already be authed to claim — proves ownership.
 *   • Once the plugin has its session, every Firestore write is gated by
 *     the rules in firestore.rules (uid must match designSystems.userId).
 *   • If the pairing doc is intercepted, an attacker still can't claim it
 *     without a studio sign-in, and can't poll for a token without first
 *     someone else claiming.
 *
 * The pairing doc itself is locked off from clients in firestore.rules —
 * all reads/writes go through these functions, which use the Admin SDK
 * and bypass rules.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// admin.initializeApp() is called in index.js; functions imported here
// share that single app instance.

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_RE = /^[A-Z0-9]{6}$/;

// Avoid 0/O and 1/I/L for human-typability. 32 chars, 32^6 = ~1.07B codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generatePairingCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return out;
}

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * createPluginPairingCode — POST, no auth
 * Body: {} (none)
 * Returns: { code: "AB12CD", expiresAt: <ms epoch> }
 */
exports.createPluginPairingCode = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const db = admin.firestore();

  // Try a few times in case of collision; with 10-minute TTL collisions
  // are vanishingly rare but worth the cheap retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    const ref = db.collection('pairingCodes').doc(code);
    const expiresAtMs = Date.now() + PAIRING_TTL_MS;
    try {
      await ref.create({
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
      });
      return res.status(200).json({ code, expiresAt: expiresAtMs });
    } catch (err) {
      // .create() throws if the doc already exists; retry with a new code.
      if (attempt === 4) {
        console.error('createPluginPairingCode: exhausted retries', err);
        return res.status(500).json({ error: 'Could not allocate pairing code' });
      }
    }
  }
});

/**
 * claimPluginPairingCode — callable (onCall), auth required
 * Data: { code: "AB12CD" }
 * Returns: { ok: true }
 *
 * Studio calls this after the user types in the code from the plugin.
 * The Firebase Functions SDK populates request.auth automatically when
 * called via httpsCallable from a signed-in client.
 */
exports.claimPluginPairingCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to pair a plugin.');
  }
  const code = String((request.data && request.data.code) || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) {
    throw new HttpsError('invalid-argument', 'Pairing code must be 6 letters or digits.');
  }

  const ref = admin.firestore().collection('pairingCodes').doc(code);
  return await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Pairing code not found or already used.');
    }
    const data = snap.data();
    if (data.expiresAt.toMillis() < Date.now()) {
      tx.delete(ref);
      throw new HttpsError('deadline-exceeded', 'Pairing code expired. Generate a new one in the plugin.');
    }
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Pairing code has already been used.');
    }
    tx.update(ref, {
      status: 'claimed',
      userId: request.auth.uid,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
  });
});

/**
 * pollPluginPairingCode — POST, no auth
 * Body: { code: "AB12CD" }
 * Returns one of:
 *   { status: 'pending' }                          — still waiting for studio
 *   { status: 'expired' }                          — TTL hit before claim
 *   { status: 'claimed', customToken: '<jwt>' }    — first poll after claim;
 *                                                    pairing doc deleted
 *
 * The plugin polls every few seconds. The custom token is single-use and
 * the doc is deleted as part of returning it, so a stolen poll response
 * can't be replayed by an attacker who later guesses the same code.
 */
exports.pollPluginPairingCode = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const code = String((req.body && req.body.code) || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Bad pairing code format' });
  }

  const db = admin.firestore();
  const ref = db.collection('pairingCodes').doc(code);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 'expired' };

      const data = snap.data();
      if (data.expiresAt.toMillis() < Date.now()) {
        tx.delete(ref);
        return { status: 'expired' };
      }
      if (data.status !== 'claimed' || !data.userId) {
        return { status: 'pending' };
      }
      // Claimed: consume the doc and surface a uid for token-minting outside
      // the transaction (createCustomToken is async + not transactional).
      tx.delete(ref);
      return { status: 'consume', userId: data.userId };
    });

    if (result.status === 'consume') {
      const customToken = await admin.auth().createCustomToken(result.userId, {
        plugin: true,
      });
      return res.status(200).json({ status: 'claimed', customToken });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('pollPluginPairingCode error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
