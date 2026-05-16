import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/client';
import { uploadDesignSystemFile, getPublicFileUrl } from '../firebase/storage';

/**
 * Add-on entitlement plumbing.
 *
 * The hosted DinoDesign environment (Netlify) needs to know which add-ons
 * are unlocked for a given design system to decide what sections/CSS to load.
 *
 * Architecture:
 *   1. Source of truth: Firestore — `designSystems/{id}.addOns: string[]`
 *      (each entry is an add-on slug from the registry).
 *   2. Public manifest: Firebase Storage — `${id}/entitlements.json`
 *      (read by the hosted env on page load, no auth needed).
 *
 * The manifest is regenerated and re-uploaded whenever entitlements change
 * (e.g., after a purchase) so the hosted env reflects the change without
 * waiting for a full design system re-export.
 */

const ENTITLEMENTS_FILENAME = 'entitlements.json';

export interface EntitlementsManifest {
  designSystemId: string;
  addOns: string[];
  updatedAt: string; // ISO timestamp
  version: number;   // schema version, bump on breaking changes
}

/** Read the current addOns array from Firestore for a design system. */
export async function getEntitlements(designSystemId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'designSystems', designSystemId));
  if (!snap.exists()) return [];
  const data = snap.data() as { addOns?: string[] };
  return data.addOns || [];
}

/** Upload entitlements.json to Storage so the hosted env can read it. */
export async function publishEntitlementsManifest(designSystemId: string): Promise<string> {
  const addOns = await getEntitlements(designSystemId);
  const manifest: EntitlementsManifest = {
    designSystemId,
    addOns,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  await uploadDesignSystemFile(
    designSystemId,
    ENTITLEMENTS_FILENAME,
    JSON.stringify(manifest, null, 2),
    'application/json',
  );
  return getPublicFileUrl(designSystemId, ENTITLEMENTS_FILENAME);
}

/**
 * Add an add-on to a design system. Writes Firestore, then re-publishes
 * the manifest. Use after a successful purchase.
 */
export async function grantAddOn(designSystemId: string, addOnSlug: string): Promise<void> {
  await updateDoc(doc(db, 'designSystems', designSystemId), {
    addOns: arrayUnion(addOnSlug),
    addOnsUpdatedAt: serverTimestamp(),
  });
  await publishEntitlementsManifest(designSystemId);
}

/** Convenience: check whether a specific add-on is unlocked. */
export async function hasAddOn(designSystemId: string, addOnSlug: string): Promise<boolean> {
  const list = await getEntitlements(designSystemId);
  return list.includes(addOnSlug);
}

/**
 * Initiate a purchase for an add-on against a specific design system.
 *
 * DEV mode: skips Stripe, immediately grants the entitlement and publishes
 *           the manifest. Returns when the manifest is uploaded.
 * PROD mode: TODO — call a Cloud Function that creates a Stripe Checkout
 *           Session for the add-on price, redirects, then the Stripe
 *           webhook calls grantAddOn() server-side.
 */
export async function purchaseAddOn(
  designSystemId: string,
  addOnSlug: string,
): Promise<'granted_dev' | 'redirected'> {
  const DEV_MODE = import.meta.env.DEV;
  if (DEV_MODE) {
    console.log(`[DEV MODE] Granting add-on "${addOnSlug}" to design system ${designSystemId}`);
    await grantAddOn(designSystemId, addOnSlug);
    return 'granted_dev';
  }
  // PROD: redirect to Stripe Checkout.
  throw new Error('Production add-on checkout is not yet wired. Use DEV mode to test.');
}

export { ENTITLEMENTS_FILENAME };
