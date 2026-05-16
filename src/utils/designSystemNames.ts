import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase/client';

/**
 * Returns true if the given user already owns a design system with this name.
 * Case-insensitive on the trimmed name. Pass `excludeId` to ignore the design
 * being renamed (so saving the same name back to the same doc isn't blocked).
 *
 * Firestore can't do case-insensitive equality, so we filter client-side after
 * narrowing by userId. The userId filter is enforced by the security rules,
 * keeping the read scoped to the user's own docs.
 */
export async function isDesignNameTaken(
  userId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const target = name.trim().toLowerCase();
  if (!target) return false;
  const snap = await getDocs(query(
    collection(db, 'designSystems'),
    where('userId', '==', userId),
    limit(200),
  ));
  for (const d of snap.docs) {
    if (excludeId && d.id === excludeId) continue;
    const other = String((d.data() as { name?: unknown }).name ?? '').trim().toLowerCase();
    if (other === target) return true;
  }
  return false;
}
