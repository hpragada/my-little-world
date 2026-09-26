/**
 * Biometric & Fingerprint Security Service
 *
 * Dedicated to native device biometric authentication via Capacitor.
 * Security Rules:
 * - NEVER stores fingerprint or biometric data.
 * - Always delegates authentication challenge directly to device OS / secure enclave.
 * - Leaves PIN/Pattern as the immutable fallback.
 * - Detects native Capacitor environment vs Web Preview environment.
 */

import { Capacitor } from '@capacitor/core';

export interface BiometricAvailability {
  isAvailable: boolean;
  isNative: boolean;
  biometryType: 'fingerprint' | 'face' | 'biometrics' | 'none';
  reason?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  isNative: boolean;
}

/**
 * Check whether device biometrics are supported in current environment
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Check for standard Capacitor Biometric plugins
    const plugins = (Capacitor as any).Plugins;
    if (plugins?.NativeBiometric && typeof plugins.NativeBiometric.isAvailable === 'function') {
      try {
        const res = await plugins.NativeBiometric.isAvailable();
        return {
          isAvailable: Boolean(res.isAvailable),
          isNative: true,
          biometryType: res.biometryType || 'fingerprint',
        };
      } catch (e: any) {
        return {
          isAvailable: false,
          isNative: true,
          biometryType: 'none',
          reason: e?.message || 'Biometric check failed on native device',
        };
      }
    }

    if (plugins?.BiometricAuth && typeof plugins.BiometricAuth.checkBiometry === 'function') {
      try {
        const res = await plugins.BiometricAuth.checkBiometry();
        return {
          isAvailable: Boolean(res.isAvailable),
          isNative: true,
          biometryType: 'biometrics',
        };
      } catch (e: any) {
        return {
          isAvailable: false,
          isNative: true,
          biometryType: 'none',
          reason: e?.message || 'Biometric check failed on native device',
        };
      }
    }

    // Native Capacitor platform without dedicated plugin compiled in
    return {
      isAvailable: false,
      isNative: true,
      biometryType: 'fingerprint',
      reason: 'Native biometric plugin not yet compiled in this APK/IPA build. Please use your PIN or Pattern.',
    };
  }

  // Web Browser / Web Preview Environment
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const isUvpaAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {
        isAvailable: isUvpaAvailable,
        isNative: false,
        biometryType: isUvpaAvailable ? 'biometrics' : 'none',
        reason: isUvpaAvailable
          ? undefined
          : 'Web preview: Physical biometric hardware requires a native device build (Capacitor on Android/iOS).',
      };
    } catch {
      return {
        isAvailable: false,
        isNative: false,
        biometryType: 'none',
        reason: 'Web preview: Native fingerprint sensor is only available on physical Android/iOS devices.',
      };
    }
  }

  return {
    isAvailable: false,
    isNative: false,
    biometryType: 'none',
    reason: 'Web preview environment: Native biometrics require a physical mobile device with Capacitor.',
  };
}

/**
 * Prompt user for native biometric authentication
 * (Never stores or handles biometric templates; only receives verification status from OS)
 */
export async function authenticateWithBiometrics(
  reason: string = 'Scan your fingerprint to unlock My Little World'
): Promise<BiometricAuthResult> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const plugins = (Capacitor as any).Plugins;

    // 1. Try NativeBiometric plugin
    if (plugins?.NativeBiometric && typeof plugins.NativeBiometric.verifyIdentity === 'function') {
      try {
        await plugins.NativeBiometric.verifyIdentity({
          reason,
          title: 'My Little World Sanctuary',
          subtitle: 'Fingerprint Authentication',
          description: reason,
        });
        return { success: true, isNative: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Fingerprint verification failed.',
          isNative: true,
        };
      }
    }

    // 2. Try BiometricAuth plugin
    if (plugins?.BiometricAuth && typeof plugins.BiometricAuth.authenticate === 'function') {
      try {
        await plugins.BiometricAuth.authenticate({
          reason,
          cancelTitle: 'Use PIN',
          allowDeviceCredential: true,
        });
        return { success: true, isNative: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Biometric authentication cancelled or failed.',
          isNative: true,
        };
      }
    }

    return {
      success: false,
      error: 'Native biometric plugin not detected in this build. Please use PIN or Pattern.',
      isNative: true,
    };
  }

  // Web Browser / Web Preview Handling
  // In the Web Preview, native sensor hardware is unavailable.
  return {
    success: false,
    error: 'Native fingerprint sensor requires a physical mobile device running the Capacitor build. Please enter your PIN or Pattern to unlock.',
    isNative: false,
  };
}
