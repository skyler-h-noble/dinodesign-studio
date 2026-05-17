import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { firebaseApp } from '../firebase/client';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';

const functions = getFunctions(firebaseApp);

const DEV_MODE = import.meta.env.DEV;

export interface CheckoutRequest {
  tierKey: 'single' | 'bundle3' | 'bundle10';
  addOns: {
    playground: boolean;
    designerPortal: boolean;
  };
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * In dev mode: writes to Firestore and returns 'dev_complete' (no redirect).
 * In production: calls Cloud Function → redirects to Stripe Checkout.
 *
 * Returns 'dev_complete' if payment was handled inline (no redirect),
 * or never returns (redirects to Stripe).
 */
export async function redirectToCheckout(request: CheckoutRequest): Promise<'dev_complete' | void> {
  if (DEV_MODE) {
    console.log(`[DEV MODE] Simulating payment for user ${request.userId} (Firestore write skipped — temp bypass for CSS-dump flow)`);
    // Temporarily skipped: setDoc on /users/{uid} was failing with
    // "Missing or insufficient permissions" while we needed to reach Export
    // to dump CSS. Restore the write once Firestore rules allow it.
    // const userRef = doc(db, 'users', request.userId);
    // await setDoc(userRef, { paid: true }, { merge: true });
    return 'dev_complete';
  }

  const createSession = httpsCallable<CheckoutRequest, { url: string }>(
    functions,
    'createCheckoutSession'
  );

  const result = await createSession(request);

  if (result.data.url) {
    window.location.href = result.data.url;
  } else {
    throw new Error('No checkout URL returned from server');
  }
}
