import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  getRedirectResult,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '../utils/firebase/client';

// Credential collisions → fall back to a plain sign-in (the anonymous session
// is dropped). Popup failures → fall back to a full-page redirect so a blocked
// popup never dead-ends the sign-in.
const ALREADY_EXISTS = new Set([
  'auth/credential-already-in-use',
  'auth/email-already-in-use',
  'auth/account-exists-with-different-credential',
]);
// ONLY redirect when the popup genuinely never opened. Do NOT include
// popup-closed-by-user / cancelled-popup-request — those mean the popup DID
// open (and the user closed it or a second attempt superseded it); redirecting
// then produces a second, duplicate sign-in prompt.
const POPUP_FALLBACK = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Complete any pending redirect-based Google sign-in (the popup fallback).
    getRedirectResult(auth).catch((e) => {
      console.warn('[Auth] redirect result error:', e?.code || e);
    });
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Expose ONLY real accounts as `user` so the "sign in at export" gating
      // stays intact — an anonymous session must not count as signed-in in the
      // UI. But we still need SOME auth session so Storage writes (moodboard
      // upload, which the rules gate behind isSignedIn()) succeed during the
      // pre-account design phase. So: if there's no session at all, silently
      // establish an anonymous one; treat anonymous users as "not signed in".
      if (firebaseUser && !firebaseUser.isAnonymous) {
        setUser(firebaseUser);
        setLoading(false);
      } else if (!firebaseUser) {
        // No session — create an anonymous one (fires this callback again with
        // the anonymous user). Requires Anonymous auth enabled in Firebase.
        signInAnonymously(auth).catch((e) => {
          console.warn('[Auth] anonymous sign-in failed:', e?.code || e);
          setUser(null);
          setLoading(false);
        });
      } else {
        // Anonymous session active — app treats this as "not signed in".
        setUser(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Do NOT link the anonymous session to the Google account. Nothing durable is
  // written under the anonymous uid before sign-in — the moodboard lives at a
  // public design-UUID storage path, and the Firestore draft isn't written
  // until AFTER auth — so linking gains nothing. It also caused a double prompt:
  // when the Google credential already belonged to an existing account,
  // linkWithPopup threw credential-already-in-use, and the fallback second popup
  // fired outside the user gesture, got blocked, and escalated to a full-page
  // redirect. A single signInWithPopup signs in both new and returning users in
  // one prompt (it just replaces the anonymous session). Only a genuinely
  // blocked popup falls back to a redirect.
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (POPUP_FALLBACK.has(e?.code)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw e;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    // Sign-IN targets an existing account, so switch to it directly (an
    // anonymous session, if any, is abandoned).
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      try {
        await linkWithCredential(current, EmailAuthProvider.credential(email, password));
        return;
      } catch (e: any) {
        if (!ALREADY_EXISTS.has(e?.code)) throw e;
        // Email already registered → sign in with those credentials instead.
        await signInWithEmailAndPassword(auth, email, password);
        return;
      }
    }
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
