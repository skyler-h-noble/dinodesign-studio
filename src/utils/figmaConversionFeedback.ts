// Firestore writer for the Figma-to-Code feedback loop. Mirrors the
// pattern used by `text-gate-feedback` — every conversion attempt writes a
// record, and a follow-up verdict (good/bad + correction text) updates the
// same record by id. Accumulated records form the training set for tuning
// the conversion prompt and identifying lib gaps.

import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/client';

export interface FigmaConversionRecord {
  figmaUrl: string;
  fileKey: string;
  nodeId: string;
  /** Design ID (dinoId / UUID) of the brand this conversion was tested
   *  against. Null when no brand context is loaded — output then targets
   *  default-theme tokens only. Stored so we can partition feedback by
   *  brand later (e.g. "does the AAID handle script-font headers well?"). */
  dinoId: string | null;
  generatedJsx: string;
  missingComponents: string[];
  rendered: 'success' | 'error' | 'pending';
  userId: string;
  /** Set later via logConversionVerdict. */
  userVerdict?: 'good' | 'bad' | null;
  userCorrection?: string | null;
  userEditedJsx?: string | null;
}

const COLLECTION = 'figma-conversion-feedback';

export async function logConversionAttempt(
  record: FigmaConversionRecord,
): Promise<string> {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    ...record,
    userVerdict: record.userVerdict ?? null,
    userCorrection: record.userCorrection ?? null,
    userEditedJsx: record.userEditedJsx ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function logConversionVerdict(
  id: string,
  patch: {
    userVerdict?: 'good' | 'bad';
    userCorrection?: string;
    userEditedJsx?: string;
  },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
