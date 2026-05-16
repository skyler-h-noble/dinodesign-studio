/**
 * Component proposal submission endpoint.
 *
 * Consumers of @dynodesign/components use the `/ShareComponent` slash command
 * (or a curl) to POST a proposal here when they've built something inline that
 * should arguably belong in the library.
 *
 * The endpoint is open (no auth) so any consumer with the library installed
 * can submit. The trade-off is abuse surface, mitigated by:
 *   - Strict payload validation (required fields, length caps).
 *   - Per-IP rate limiting (default 10 submissions / 24h).
 *   - Hard cap on body size enforced by the v2 onRequest runtime.
 *
 * Proposals land in Firestore at componentProposals/{autoId} with status
 * "pending". The admin dashboard at /admin/proposals lists them.
 */

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Tunables. If we get spammed, lower SUBMISSIONS_PER_DAY before doing
// anything more drastic (like adding auth).
const SUBMISSIONS_PER_DAY = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_NAME_LENGTH = 80;
const MAX_USE_CASE_LENGTH = 2000;
const MAX_CODE_LENGTH = 20000; // applies to both proposedApi and implementation

function getClientIp(req) {
  // Cloud Run / Firebase Functions v2 puts the original client IP first in
  // x-forwarded-for; fall back to req.ip for local dev.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push('body must be a JSON object');
    return errors;
  }

  const requireString = (key, max) => {
    const v = body[key];
    if (typeof v !== 'string' || v.trim().length === 0) {
      errors.push(`${key} is required and must be a non-empty string`);
      return;
    }
    if (v.length > max) {
      errors.push(`${key} exceeds ${max} characters`);
    }
  };

  requireString('componentName', MAX_NAME_LENGTH);
  requireString('useCase', MAX_USE_CASE_LENGTH);
  requireString('proposedApi', MAX_CODE_LENGTH);
  requireString('implementation', MAX_CODE_LENGTH);

  // Optional fields, but type-check if present.
  for (const key of ['sourceFilePath', 'libVersion', 'submittedBy', 'notes']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') {
      errors.push(`${key}, if provided, must be a string`);
    }
  }
  if (body.notes && body.notes.length > MAX_USE_CASE_LENGTH) {
    errors.push(`notes exceeds ${MAX_USE_CASE_LENGTH} characters`);
  }

  // componentName: PascalCase / kebab-case identifier, no surprises.
  if (typeof body.componentName === 'string'
      && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(body.componentName.trim())) {
    errors.push('componentName must start with a letter and contain only letters, digits, underscore, or hyphen');
  }

  return errors;
}

async function checkAndRecordRateLimit(db, ip) {
  // One doc per IP, sliding 24h window. Atomic-ish: if two requests race they
  // could both see the same count, but at worst we let one extra through —
  // acceptable for an unauthenticated abuse-prevention layer.
  const ref = db.collection('rateLimits').doc('componentProposals_' + ip.replace(/[^a-zA-Z0-9.:_-]/g, '_'));
  const now = Date.now();
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: SUBMISSIONS_PER_DAY - 1 };
  }
  const data = snap.data();
  const windowStart = typeof data.windowStart === 'number' ? data.windowStart : now;
  const inWindow = now - windowStart < RATE_LIMIT_WINDOW_MS;
  if (!inWindow) {
    await ref.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: SUBMISSIONS_PER_DAY - 1 };
  }
  if (data.count >= SUBMISSIONS_PER_DAY) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - windowStart) };
  }
  await ref.update({ count: admin.firestore.FieldValue.increment(1) });
  return { allowed: true, remaining: SUBMISSIONS_PER_DAY - 1 - data.count };
}

exports.submitComponentProposal = onRequest(
  {
    cors: true,
    // 256 MiB is the default; leaving it conservative — payloads are small.
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const errors = validatePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'invalid_payload', details: errors });
    }

    const db = admin.firestore();
    const ip = getClientIp(req);

    try {
      const limit = await checkAndRecordRateLimit(db, ip);
      if (!limit.allowed) {
        return res.status(429).json({
          error: 'rate_limited',
          retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
        });
      }

      const docRef = await db.collection('componentProposals').add({
        componentName: req.body.componentName.trim(),
        useCase: req.body.useCase.trim(),
        proposedApi: req.body.proposedApi,
        implementation: req.body.implementation,
        sourceFilePath: req.body.sourceFilePath?.trim() || null,
        libVersion: req.body.libVersion?.trim() || null,
        submittedBy: req.body.submittedBy?.trim() || null,
        notes: req.body.notes?.trim() || null,
        submittedFromIp: ip,
        status: 'pending',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(201).json({
        ok: true,
        proposalId: docRef.id,
        remainingToday: limit.remaining,
      });
    } catch (err) {
      console.error('submitComponentProposal failed:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  },
);
