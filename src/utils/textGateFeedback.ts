// src/utils/textGateFeedback.ts
//
// Writes typography-matcher region verdicts to Firestore so we can train a
// fine-tuned text-vs-non-text classifier (Step C) on real labeled data.
// Three signal sources feed the same collection so the training query is
// uniform — one collection, one schema, mixed verdicts:
//
//   verdict: 'gate-rejected'  — server-side CLIP gate rejected the crop.
//                               Auto-logged on every matcher result. Treated
//                               as a "presumed not-text" weak label until a
//                               human disagrees.
//   verdict: 'not-text'       — user pressed "Not text" on a region card.
//                               Strong negative label.
//   verdict: 'text'           — user accepted a region as their header /
//                               decorative pick. Strong positive label.
//
// Writes are fire-and-forget — a Firestore failure should never break the
// matcher UI. We log to console for debugging.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase/client';

export type GateVerdict = 'gate-rejected' | 'not-text' | 'text';

export interface TextGateFeedback {
  /** Public URL or data: URL of the cropped region the matcher considered. */
  cropUrl: string;
  /** Source moodboard the crop came from. Kept so we can revisit the original
   *  context during training-data review. */
  moodboardUrl: string;
  verdict: GateVerdict;
  /** Server-side gate's verdict when available — 'text' | 'icon' | 'photo' |
   *  'logo' | 'decoration'. Omitted for user-supplied verdicts. */
  topLabel?: string;
  /** Full gate softmax scores; useful when calibrating thresholds. */
  scores?: Record<string, number>;
  /** Optional role context — 'header' | 'decorative' | 'candidate' — so we
   *  can split training data by where the crop showed up. */
  role?: string;
}

const COLLECTION = 'text-gate-feedback';

/** Fire-and-forget Firestore write. Never throws; logs to console on failure
 *  so the matcher UI isn't blocked by a flaky network. */
export async function logGateFeedback(entry: TextGateFeedback): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTION), {
      ...entry,
      userId: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[textGateFeedback] write failed', err);
  }
}

/** Batch-log every server-side rejection in one matcher response. Used by
 *  TypographyTestPage after analyzeMoodboard returns. */
export async function logGateRejections(
  moodboardUrl: string,
  rejected: Array<{
    role: string;
    cropUrl: string;
    topLabel: string;
    scores: Record<string, number>;
    index?: number;
  }>,
): Promise<void> {
  if (!rejected || rejected.length === 0) return;
  // Parallel writes — Firestore handles concurrency, and these are tiny
  // documents that take <100ms each. No need to sequence.
  await Promise.all(
    rejected.map(r =>
      logGateFeedback({
        moodboardUrl,
        cropUrl: r.cropUrl,
        verdict: 'gate-rejected',
        topLabel: r.topLabel,
        scores: r.scores,
        role: r.role,
      }),
    ),
  );
}
