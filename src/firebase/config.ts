/**
 * Firebase App, Auth, and Firestore Configuration
 * Supports both bundled applet configuration and environment variable overrides.
 * Configured with multi-tab offline persistence.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

const databaseId =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID ||
  appletConfig.firestoreDatabaseId ||
  '(default)';

// Initialize or reuse Firebase App
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication with browser local persistence
export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Failed to enable local persistence:', err);
});

// Initialize Firestore with multi-tab offline persistence enabled
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    databaseId
  );
} catch (err: unknown) {
  // If already initialized, get instance
  try {
    dbInstance = getFirestore(app, databaseId);
  } catch {
    dbInstance = getFirestore(app);
  }
}

export const db: Firestore = dbInstance;
export const googleOAuthClientId: string =
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || appletConfig.oAuthClientId || '';
