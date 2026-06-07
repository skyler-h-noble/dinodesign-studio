/**
 * DinoDesign add-on entitlement cloud functions
 *
 * Three endpoints supporting the entitlement-gated add-on distribution layer:
 *
 *   1. publishAddOn       — admin → server (auth required, admin uid required)
 *        Admin Figma plugin uploads a JSON spec for a single add-on. Server
 *        writes the spec to add-ons/{addOnId}/v{N}.json in Storage,
 *        increments the catalog's currentVersion, creates a versions/{N}
 *        document with metadata. Bumps version every publish.
 *
 *   2. listEntitledAddOns — plugin → server (no auth; identifier-as-credential)
 *        Customer plugin asks "which add-ons can this Dino ID see?" Server
 *        reads designSystems/{dinoId}/entitlements where active = true and
 *        not expired, joins with addOns catalog metadata, returns the list.
 *
 *   3. getAddOn           — plugin → server (no auth; identifier-as-credential)
 *        Customer plugin asks for one add-on's spec. Server verifies an
 *        active entitlement exists for { dinoId, addOnId }, resolves the
 *        version (pinnedVersion if set, else catalog currentVersion), reads
 *        the spec from Storage via the admin SDK (bypassing the storage
 *        rules that deny direct public read), returns it inline.
 *
 * Admin model: mirrors the isAdmin() helper in storage.rules and
 * firestore.rules. Admin status is a Firestore flag at users/{uid}.isAdmin,
 * so adding/removing admins is a Firestore field flip, not a redeploy.
 *
 * Auth posture: listEntitledAddOns and getAddOn currently use the
 * identifier-as-credential posture — the Dino ID itself is the credential.
 * To upgrade to authenticated reads later, uncomment the verifyOwnerAuth
 * block at the top of each function and pass the customer's idToken from
 * the plugin. No schema or rules changes needed.
 */

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// admin.initializeApp() is called in index.js; this file shares that app.

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDON_ID_RE = /^[A-Za-z0-9_\-]+$/;

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

async function decodeBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { uid: null };
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    return { uid: decoded.uid };
  } catch (err) {
    return { uid: null };
  }
}

async function isAdminUid(uid) {
  try {
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    return snap.exists && snap.data() && snap.data().isAdmin === true;
  } catch (err) {
    console.error('isAdmin lookup failed for', uid, err.message);
    return false;
  }
}

/**
 * publishAddOn — POST, admin auth required
 * Headers: Authorization: Bearer <Firebase ID token of an admin>
 * Body:    { addOnId, name?, spec, notes? }
 * Returns: { ok: true, addOnId, version, storagePath }
 *
 * Increments addOns/{addOnId}.currentVersion and creates
 * addOns/{addOnId}/versions/{N} with metadata. Writes the spec to Storage
 * at add-ons/{addOnId}/v{N}.json.
 */
exports.publishAddOn = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { uid } = await decodeBearer(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdminUid(uid))) {
    return res.status(403).json({ error: 'Admin authorization required' });
  }

  const { addOnId, name, spec, notes } = req.body || {};
  if (!addOnId || !spec) {
    return res.status(400).json({ error: 'addOnId and spec required' });
  }
  if (!ADDON_ID_RE.test(addOnId)) {
    return res.status(400).json({ error: 'addOnId must be alphanumeric, hyphen, or underscore only' });
  }

  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const catalogRef = db.doc(`addOns/${addOnId}`);
  const catalogSnap = await catalogRef.get();
  const currentVersion = (catalogSnap.exists && catalogSnap.data().currentVersion) || 0;
  const nextVersion = currentVersion + 1;

  const specStr = JSON.stringify(spec);
  const storagePath = `add-ons/${addOnId}/v${nextVersion}.json`;

  try {
    await bucket.file(storagePath).save(specStr, {
      contentType: 'application/json',
      metadata: { cacheControl: 'no-cache, max-age=0' },
    });
  } catch (err) {
    console.error('publishAddOn storage write error:', err.message);
    return res.status(500).json({ error: 'Failed to write spec to storage' });
  }

  const batch = db.batch();
  const catalogUpdate = {
    addOnId,
    name: name || addOnId,
    currentVersion: nextVersion,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
  };
  if (currentVersion === 0) {
    catalogUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
    catalogUpdate.createdBy = uid;
  }
  batch.set(catalogRef, catalogUpdate, { merge: true });

  batch.set(db.doc(`addOns/${addOnId}/versions/${nextVersion}`), {
    version: nextVersion,
    storagePath,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedBy: uid,
    notes: notes || '',
    sizeBytes: Buffer.byteLength(specStr, 'utf8'),
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error('publishAddOn firestore commit error:', err.message);
    return res.status(500).json({ error: 'Failed to update catalog metadata' });
  }

  return res.status(200).json({ ok: true, addOnId, version: nextVersion, storagePath });
});

/**
 * listEntitledAddOns — POST, no auth (identifier-as-credential)
 * Body:    { dinoId }
 * Returns: { addons: [{ addOnId, name, currentVersion, pinnedVersion, expiresAt }] }
 */
exports.listEntitledAddOns = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { dinoId } = req.body || {};
  if (!dinoId || !UUID_V4_RE.test(dinoId)) {
    return res.status(400).json({ error: 'Valid UUID dinoId required' });
  }

  // To upgrade to authenticated reads (PATENT_DISCLOSURE_ADDITIONS.md §4.8.4.2),
  // uncomment:
  //   const { uid } = await decodeBearer(req.headers.authorization);
  //   if (!uid) return res.status(401).json({ error: 'Authentication required' });
  //   const ds = await admin.firestore().doc(`designSystems/${dinoId}`).get();
  //   if (!ds.exists || ds.data().userId !== uid) {
  //     return res.status(403).json({ error: 'Not your design system' });
  //   }

  const db = admin.firestore();
  const nowMs = Date.now();
  const snap = await db.collection(`designSystems/${dinoId}/entitlements`)
    .where('active', '==', true)
    .get();

  const addons = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const expiresAtMs = (data.expiresAt && typeof data.expiresAt.toMillis === 'function')
      ? data.expiresAt.toMillis()
      : null;
    if (expiresAtMs !== null && expiresAtMs < nowMs) continue;

    const catalog = await db.doc(`addOns/${doc.id}`).get();
    if (!catalog.exists) continue;
    const catalogData = catalog.data() || {};

    addons.push({
      addOnId: doc.id,
      name: catalogData.name || doc.id,
      currentVersion: catalogData.currentVersion || 0,
      pinnedVersion: data.pinnedVersion != null ? data.pinnedVersion : null,
      expiresAt: expiresAtMs,
    });
  }

  return res.status(200).json({ addons });
});

/**
 * getAddOn — POST, no auth (identifier-as-credential)
 * Body:    { dinoId, addOnId }
 * Returns: { addOnId, name, version, spec }
 *
 * Verifies the entitlement, resolves the version (honoring pinnedVersion),
 * reads the spec from Storage via the admin SDK.
 */
exports.getAddOn = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { dinoId, addOnId } = req.body || {};
  if (!dinoId || !UUID_V4_RE.test(dinoId)) {
    return res.status(400).json({ error: 'Valid UUID dinoId required' });
  }
  if (!addOnId) return res.status(400).json({ error: 'addOnId required' });

  // Same auth upgrade block as listEntitledAddOns — uncomment to require
  // authenticated reads.

  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const entSnap = await db.doc(`designSystems/${dinoId}/entitlements/${addOnId}`).get();
  if (!entSnap.exists) return res.status(403).json({ error: 'No entitlement for this add-on' });
  const ent = entSnap.data() || {};
  if (!ent.active) return res.status(403).json({ error: 'Entitlement inactive' });
  const expiresAtMs = (ent.expiresAt && typeof ent.expiresAt.toMillis === 'function')
    ? ent.expiresAt.toMillis()
    : null;
  if (expiresAtMs !== null && expiresAtMs < Date.now()) {
    return res.status(403).json({ error: 'Entitlement expired' });
  }

  const catalogSnap = await db.doc(`addOns/${addOnId}`).get();
  if (!catalogSnap.exists) return res.status(404).json({ error: 'Add-on not in catalog' });
  const catalogData = catalogSnap.data() || {};

  const version = ent.pinnedVersion || catalogData.currentVersion;
  if (!version) return res.status(404).json({ error: 'No version available' });

  const versionSnap = await db.doc(`addOns/${addOnId}/versions/${version}`).get();
  if (!versionSnap.exists) return res.status(404).json({ error: 'Version metadata missing' });
  const storagePath = versionSnap.data() && versionSnap.data().storagePath;
  if (!storagePath) return res.status(500).json({ error: 'Storage path missing on version doc' });

  let spec;
  try {
    const [contents] = await bucket.file(storagePath).download();
    spec = JSON.parse(contents.toString('utf8'));
  } catch (err) {
    console.error('getAddOn storage read error:', err.message);
    return res.status(500).json({ error: 'Failed to read spec from storage' });
  }

  return res.status(200).json({
    addOnId,
    name: catalogData.name || addOnId,
    version,
    spec,
  });
});
