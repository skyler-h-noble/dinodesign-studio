import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const storage: FirebaseStorage = getStorage(firebaseApp);
export const auth: Auth = getAuth(firebaseApp);
// Use long-polling instead of WebChannel/QUIC. Chrome's QUIC stack
// intermittently throws ERR_QUIC_PROTOCOL_ERROR / QUIC_TOO_MANY_RTOS against
// firestore.googleapis.com — when that happens the Listen channel hangs,
// every getDoc/getDocs await stalls forever, and the rehydration on /create
// silently fails. Auto-detect chooses long-polling when WebChannel is broken.
export const db: Firestore = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
});

/** Storage bucket name (without gs:// prefix) */
export const STORAGE_BUCKET = firebaseConfig.storageBucket;
