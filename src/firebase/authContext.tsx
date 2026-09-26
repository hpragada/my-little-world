import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './config';

export type AuthModalMode = 'login' | 'register' | 'reset';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isGuest: boolean;
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  authError: string | null;
  authSuccessMessage: string | null;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  reauthenticateWithGoogle: () => Promise<User | null>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('[Firebase Auth] State change error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthError(null);
    setAuthSuccessMessage(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
  };

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in window was closed. Please try again.';
      case 'auth/popup-blocked':
        return 'Pop-up blocked by browser. Please allow pop-ups for this site.';
      case 'auth/cancelled-popup-request':
        return 'Previous sign-in window was closed. Please try again.';
      case 'auth/user-token-expired':
        return 'Your sign-in session expired. Please sign in again with your Google account.';
      case 'auth/network-request-failed':
        return 'Network connection issue. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Access temporarily paused due to many attempts. Please try again later.';
      case 'auth/unauthorized-domain':
        return `Domain not authorized. Please add "${typeof window !== 'undefined' ? window.location.hostname : 'this domain'}" to Firebase Authentication -> Settings -> Authorized domains in your Firebase Console.`;
      default:
        return code
          ? `[${code}] ${err?.message || 'Authentication error. Please try again.'}`
          : err?.message || 'Authentication error. Please try again.';
    }
  };

  // Google Sign-In with popup
  const signInWithGoogle = async () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      closeAuthModal();
    } catch (err: any) {
      console.warn('[Firebase Auth] Google sign in error:', err);
      setAuthError(mapAuthError(err));
      throw err;
    }
  };

  // Re-authenticate with Google (Safe pre-signout to invalidate stale token, opens popup, refetches ID token)
  const reauthenticateWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      // 1. Sign out of Firebase Auth if an existing stale session is present
      // Note: signOut ONLY clears Firebase Auth token in memory/IndexedDB auth store.
      // It DOES NOT touch local application state, IndexedDB memories/files, or Private Vault.
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn('[Firebase Auth] Pre-signout cleanup notice:', e);
        }
      }

      // 2. Open Google Sign-In popup with fresh account selection
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);

      // 3. Immediately refresh and obtain a valid ID token
      if (credential.user) {
        await credential.user.getIdToken(true);
      }
      closeAuthModal();
      return credential.user;
    } catch (err: any) {
      console.warn('[Firebase Auth] Re-authentication failed:', err);
      const friendly = mapAuthError(err);
      setAuthError(friendly);
      throw err;
    }
  };

  // Email / Password sign in
  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      closeAuthModal();
    } catch (err: any) {
      console.warn('[Firebase Auth] Email sign in error:', err);
      setAuthError(mapAuthError(err));
      throw err;
    }
  };

  // Email / Password registration
  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: displayName.trim() });
      }
      closeAuthModal();
    } catch (err: any) {
      console.warn('[Firebase Auth] Sign up error:', err);
      setAuthError(mapAuthError(err));
      throw err;
    }
  };

  // Password reset email
  const resetPassword = async (email: string) => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAuthSuccessMessage('A gentle reset email has been sent. Please check your inbox.');
    } catch (err: any) {
      console.warn('[Firebase Auth] Reset password error:', err);
      setAuthError(mapAuthError(err));
      throw err;
    }
  };

  // Sign out (Preserves local data!)
  const signOutUser = async () => {
    try {
      await signOut(auth);
      // NOTE: We explicitly DO NOT clear localStorage or IndexedDB.
      // All existing local memories, files, journals, and tasks are strictly preserved.
    } catch (err: any) {
      console.error('[Firebase Auth] Sign out error:', err);
      throw err;
    }
  };

  // Get current user ID token for backend API authentication
  const getIdToken = async (forceRefresh: boolean = false): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isGuest: !currentUser,
        authModalOpen,
        authModalMode,
        authError,
        authSuccessMessage,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        clearAuthError,
        signInWithGoogle,
        reauthenticateWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOutUser,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
