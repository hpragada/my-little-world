import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../firebase/authContext';
import {
  hasAppPin,
  getAppPinLength,
  setAppPin,
  verifyAppPin,
  removeAppPin,
  hasAppPattern,
  setAppPattern,
  verifyAppPattern,
  removeAppPattern,
  getPreferredLockMethod,
  setPreferredLockMethod,
  hasAnyLock,
  getPinRateLimit,
  PinVerificationResult,
  LockMethod,
} from '../services/appPinService';
import { authenticateWithBiometrics, BiometricAuthResult } from '../services/biometricService';

interface AppPinContextType {
  isPinUnlocked: boolean;
  hasPin: boolean;
  pinLength: number;
  hasPattern: boolean;
  hasAnyLock: boolean;
  preferredLockMethod: LockMethod;
  unlockWithPin: (pin: string) => Promise<PinVerificationResult>;
  unlockWithPattern: (pattern: number[]) => Promise<PinVerificationResult>;
  unlockWithBiometric: () => Promise<BiometricAuthResult>;
  setupPin: (pin: string) => Promise<void>;
  setupPattern: (pattern: number[]) => Promise<void>;
  changeLockMethod: (method: LockMethod) => void;
  verifyCurrentLock: (
    credential: { type: 'pin'; pin: string } | { type: 'pattern'; pattern: number[] }
  ) => Promise<PinVerificationResult>;
  lockApp: () => void;
  resetPin: () => void;
  resetPattern: () => void;
  getLockoutStatus: () => { isLocked: boolean; remainingSeconds: number; failedAttempts: number };
}

const AppPinContext = createContext<AppPinContextType | undefined>(undefined);

export const AppPinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(false);
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [pinLength, setPinLength] = useState<number>(4);
  const [hasPattern, setHasPattern] = useState<boolean>(false);
  const [preferredLockMethod, setPreferredLockMethodState] = useState<LockMethod>('pin');

  const refreshLockState = useCallback((uid: string) => {
    const pinExists = hasAppPin(uid);
    const patternExists = hasAppPattern(uid);
    const pLength = getAppPinLength(uid);
    const pref = getPreferredLockMethod(uid);

    setHasPin(pinExists);
    setPinLength(pLength);
    setHasPattern(patternExists);
    setPreferredLockMethodState(pref);
  }, []);

  // Sync hasPin and reset unlock state whenever the authenticated Firebase user changes
  useEffect(() => {
    if (currentUser?.uid) {
      refreshLockState(currentUser.uid);
      setIsPinUnlocked(false);
    } else {
      setHasPin(false);
      setHasPattern(false);
      setPinLength(4);
      setPreferredLockMethodState('pin');
      setIsPinUnlocked(false);
    }
  }, [currentUser?.uid, refreshLockState]);

  // Lock the app whenever it is closed, reloaded, or returns from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsPinUnlocked(false);
      }
    };

    const handlePageHide = () => {
      setIsPinUnlocked(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const getLockoutStatus = useCallback(() => {
    if (!currentUser?.uid) {
      return { isLocked: false, remainingSeconds: 0, failedAttempts: 0 };
    }
    const state = getPinRateLimit(currentUser.uid);
    const now = Date.now();
    if (state.lockedUntil && state.lockedUntil > now) {
      return {
        isLocked: true,
        remainingSeconds: Math.ceil((state.lockedUntil - now) / 1000),
        failedAttempts: state.failedAttempts,
      };
    }
    return {
      isLocked: false,
      remainingSeconds: 0,
      failedAttempts: state.failedAttempts,
    };
  }, [currentUser?.uid]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<PinVerificationResult> => {
      if (!currentUser?.uid) {
        return {
          success: false,
          locked: false,
          remainingSeconds: 0,
          failedAttempts: 0,
          error: 'No active user session',
        };
      }

      const result = await verifyAppPin(currentUser.uid, pin);
      if (result.success) {
        setIsPinUnlocked(true);
      }
      return result;
    },
    [currentUser?.uid]
  );

  const unlockWithPattern = useCallback(
    async (pattern: number[]): Promise<PinVerificationResult> => {
      if (!currentUser?.uid) {
        return {
          success: false,
          locked: false,
          remainingSeconds: 0,
          failedAttempts: 0,
          error: 'No active user session',
        };
      }

      const result = await verifyAppPattern(currentUser.uid, pattern);
      if (result.success) {
        setIsPinUnlocked(true);
      }
      return result;
    },
    [currentUser?.uid]
  );

  const unlockWithBiometric = useCallback(async (): Promise<BiometricAuthResult> => {
    const result = await authenticateWithBiometrics();
    if (result.success) {
      setIsPinUnlocked(true);
    }
    return result;
  }, []);

  const setupPin = useCallback(
    async (pin: string): Promise<void> => {
      if (!currentUser?.uid) {
        throw new Error('User must be authenticated with Firebase to set up PIN');
      }
      await setAppPin(currentUser.uid, pin);
      refreshLockState(currentUser.uid);
      setIsPinUnlocked(true);
    },
    [currentUser?.uid, refreshLockState]
  );

  const setupPattern = useCallback(
    async (pattern: number[]): Promise<void> => {
      if (!currentUser?.uid) {
        throw new Error('User must be authenticated with Firebase to set up Pattern');
      }
      await setAppPattern(currentUser.uid, pattern);
      refreshLockState(currentUser.uid);
      setIsPinUnlocked(true);
    },
    [currentUser?.uid, refreshLockState]
  );

  const changeLockMethod = useCallback(
    (method: LockMethod) => {
      if (!currentUser?.uid) return;
      setPreferredLockMethod(currentUser.uid, method);
      setPreferredLockMethodState(method);
    },
    [currentUser?.uid]
  );

  const verifyCurrentLock = useCallback(
    async (
      credential: { type: 'pin'; pin: string } | { type: 'pattern'; pattern: number[] }
    ): Promise<PinVerificationResult> => {
      if (!currentUser?.uid) {
        return {
          success: false,
          locked: false,
          remainingSeconds: 0,
          failedAttempts: 0,
          error: 'No active user session',
        };
      }

      if (credential.type === 'pin') {
        return verifyAppPin(currentUser.uid, credential.pin);
      } else {
        return verifyAppPattern(currentUser.uid, credential.pattern);
      }
    },
    [currentUser?.uid]
  );

  const lockApp = useCallback(() => {
    setIsPinUnlocked(false);
  }, []);

  const resetPin = useCallback(() => {
    if (currentUser?.uid) {
      removeAppPin(currentUser.uid);
      refreshLockState(currentUser.uid);
      setIsPinUnlocked(false);
    }
  }, [currentUser?.uid, refreshLockState]);

  const resetPattern = useCallback(() => {
    if (currentUser?.uid) {
      removeAppPattern(currentUser.uid);
      refreshLockState(currentUser.uid);
      setIsPinUnlocked(false);
    }
  }, [currentUser?.uid, refreshLockState]);

  const hasAny = hasPin || hasPattern;

  return (
    <AppPinContext.Provider
      value={{
        isPinUnlocked,
        hasPin,
        pinLength,
        hasPattern,
        hasAnyLock: hasAny,
        preferredLockMethod,
        unlockWithPin,
        unlockWithPattern,
        unlockWithBiometric,
        setupPin,
        setupPattern,
        changeLockMethod,
        verifyCurrentLock,
        lockApp,
        resetPin,
        resetPattern,
        getLockoutStatus,
      }}
    >
      {children}
    </AppPinContext.Provider>
  );
};

export const useAppPin = (): AppPinContextType => {
  const context = useContext(AppPinContext);
  if (!context) {
    throw new Error('useAppPin must be used within an AppPinProvider');
  }
  return context;
};

