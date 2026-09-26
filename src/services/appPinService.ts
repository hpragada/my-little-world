/**
 * App-Wide Secret PIN Service (Hardened Security Layer)
 *
 * Dedicated security gate separate from Firebase Authentication.
 * - Uses PBKDF2-SHA-256 with 100,000 iterations via Web Crypto API.
 * - Stores 128-bit cryptographically secure random salt and 256-bit derived key verifier.
 * - Never stores plaintext PINs.
 * - Provides seamless, automatic migration from legacy v1 SHA-256 verifiers upon successful authentication.
 * - Implements persistent brute-force attempt limiting with exponential cooldown that survives page reloads.
 * - Strictly scoped by Firebase User UID.
 */

const PIN_V2_PREFIX = 'sanctuary_pin_v2_';
const PIN_RATELIMIT_PREFIX = 'sanctuary_pin_ratelimit_';
const PATTERN_V2_PREFIX = 'sanctuary_pattern_v2_';
const LOCK_METHOD_PREFIX = 'sanctuary_lock_method_';

// Legacy v1 prefixes for backward-compatible migration
const LEGACY_PIN_HASH_PREFIX = 'sanctuary_pin_hash_';
const LEGACY_PIN_SALT_PREFIX = 'sanctuary_pin_salt_';

export const PBKDF2_ITERATIONS = 100000;
export const SALT_BYTE_LENGTH = 16;
export const DERIVED_KEY_BITS = 256;

export type LockMethod = 'pin' | 'pattern' | 'biometric';

export interface PinRecordV2 {
  version: 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // hex
  hash: string; // hex
  updatedAt: string;
  pinLength?: number; // 3, 4, or 6 (for legacy migration)
}

export interface PatternRecordV2 {
  version: 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // hex
  hash: string; // hex
  updatedAt: string;
  dotCount: number;
}

export interface PinRateLimitState {
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms
}

export interface PinVerificationResult {
  success: boolean;
  locked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  error?: string;
  migratedFromV1?: boolean;
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.byteLength; i++) {
    hexString += byteArray[i].toString(16).padStart(2, '0');
  }
  return hexString;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time string equality check to mitigate timing side-channel attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generate a 16-byte cryptographically secure random salt hex string
 */
function generateSaltHex(): string {
  const bytes = new Uint8Array(SALT_BYTE_LENGTH);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bufferToHex(bytes.buffer);
}

/**
 * Derive verifier hash using PBKDF2-SHA-256 via Web Crypto
 */
async function derivePbkdf2Hash(pin: string, saltHex: string, iterations: number = PBKDF2_ITERATIONS): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltBytes = hexToBytes(saltHex);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      baseKey,
      DERIVED_KEY_BITS
    );

    return bufferToHex(derivedBits);
  }

  throw new Error('Web Crypto API with SubtleCrypto is required for PBKDF2 derivation');
}

/**
 * Legacy v1 hash computation (for migration only)
 */
async function computeLegacySha256(pin: string, saltHex: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}:${pin}`);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
  }
  throw new Error('Web Crypto API required');
}

/**
 * Retrieve rate limit state for a user from localStorage
 */
export function getPinRateLimit(userId: string): PinRateLimitState {
  if (!userId) return { failedAttempts: 0, lockedUntil: null };
  try {
    const raw = localStorage.getItem(`${PIN_RATELIMIT_PREFIX}${userId}`);
    if (!raw) return { failedAttempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const lockedUntil = parsed.lockedUntil && parsed.lockedUntil > now ? parsed.lockedUntil : null;
    return {
      failedAttempts: parsed.failedAttempts || 0,
      lockedUntil,
    };
  } catch {
    return { failedAttempts: 0, lockedUntil: null };
  }
}

/**
 * Save rate limit state for a user to localStorage
 */
function setPinRateLimit(userId: string, state: PinRateLimitState): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${PIN_RATELIMIT_PREFIX}${userId}`, JSON.stringify(state));
  } catch (e) {
    console.warn('[AppPin] Failed to save rate limit state:', e);
  }
}

/**
 * Reset rate limit state upon successful authentication
 */
export function resetPinRateLimit(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${PIN_RATELIMIT_PREFIX}${userId}`);
  } catch (e) {
    console.warn('[AppPin] Failed to reset rate limit state:', e);
  }
}

/**
 * Calculate lockout duration in seconds based on failed attempts count
 */
function calculateLockoutSeconds(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 30; // 30 seconds
  if (failedAttempts === 6) return 60; // 1 minute
  if (failedAttempts === 7) return 120; // 2 minutes
  return 300; // 5 minutes max cooldown
}

/**
 * Check if the user has an App PIN on this device (supports v2 and legacy v1)
 */
export function hasAppPin(userId: string): boolean {
  if (!userId) return false;
  try {
    // Check modern v2 PBKDF2 record
    const v2Raw = localStorage.getItem(`${PIN_V2_PREFIX}${userId}`);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      if (parsed && parsed.version === 2 && parsed.salt && parsed.hash) {
        return true;
      }
    }

    // Check legacy v1 record for migration
    const legacyHash = localStorage.getItem(`${LEGACY_PIN_HASH_PREFIX}${userId}`);
    const legacySalt = localStorage.getItem(`${LEGACY_PIN_SALT_PREFIX}${userId}`);
    return Boolean(legacyHash && legacySalt);
  } catch {
    return false;
  }
}

/**
 * Retrieve configured PIN length for a user (3, 4, or legacy 6 digits)
 */
export function getAppPinLength(userId: string): number {
  if (!userId) return 4;
  try {
    const v2Raw = localStorage.getItem(`${PIN_V2_PREFIX}${userId}`);
    if (v2Raw) {
      const parsed: PinRecordV2 = JSON.parse(v2Raw);
      if (parsed && parsed.pinLength) {
        return parsed.pinLength;
      }
      // If v2 record exists without pinLength, it is an existing legacy 6-digit PIN
      return 6;
    }
    // If legacy v1 hash exists, it is a 6-digit PIN
    const legacyHash = localStorage.getItem(`${LEGACY_PIN_HASH_PREFIX}${userId}`);
    if (legacyHash) return 6;
  } catch {
    // fallback
  }
  return 4;
}

/**
 * Set or change a Short (3 or 4-digit) or legacy 6-digit Secret PIN using PBKDF2-SHA-256
 */
export async function setAppPin(userId: string, pin: string): Promise<void> {
  const isValidLength = pin.length === 3 || pin.length === 4 || pin.length === 6;
  if (!userId || !pin || !isValidLength || !/^\d+$/.test(pin)) {
    throw new Error('Valid 3-digit or 4-digit numeric PIN is required');
  }

  const saltHex = generateSaltHex();
  const hashHex = await derivePbkdf2Hash(pin, saltHex, PBKDF2_ITERATIONS);

  const record: PinRecordV2 = {
    version: 2,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: saltHex,
    hash: hashHex,
    pinLength: pin.length,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(`${PIN_V2_PREFIX}${userId}`, JSON.stringify(record));

  // Clean up any old v1 keys
  localStorage.removeItem(`${LEGACY_PIN_HASH_PREFIX}${userId}`);
  localStorage.removeItem(`${LEGACY_PIN_SALT_PREFIX}${userId}`);

  // Reset rate limits on new PIN setup
  resetPinRateLimit(userId);
}

/**
 * Verify entered PIN with PBKDF2, legacy v1 migration, and persistent rate limiting
 */
export async function verifyAppPin(userId: string, pin: string): Promise<PinVerificationResult> {
  if (!userId || !pin) {
    return {
      success: false,
      locked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      error: 'Missing PIN or user ID',
    };
  }

  // 1. Check persistent lockout state (survives page reloads)
  const rateLimit = getPinRateLimit(userId);
  const now = Date.now();

  if (rateLimit.lockedUntil && rateLimit.lockedUntil > now) {
    const remainingSeconds = Math.ceil((rateLimit.lockedUntil - now) / 1000);
    return {
      success: false,
      locked: true,
      remainingSeconds,
      failedAttempts: rateLimit.failedAttempts,
      error: `Too many failed attempts. Locked for ${remainingSeconds}s.`,
    };
  }

  try {
    let isValid = false;
    let migratedFromV1 = false;

    // 2. Check for modern v2 PBKDF2 record
    const v2Raw = localStorage.getItem(`${PIN_V2_PREFIX}${userId}`);
    if (v2Raw) {
      const record: PinRecordV2 = JSON.parse(v2Raw);
      if (record.salt && record.hash) {
        const computedHash = await derivePbkdf2Hash(
          pin,
          record.salt,
          record.iterations || PBKDF2_ITERATIONS
        );
        isValid = constantTimeEqual(computedHash, record.hash);
      }
    } else {
      // 3. Fallback: Check for legacy v1 SHA-256 verifier for safe migration
      const legacyHash = localStorage.getItem(`${LEGACY_PIN_HASH_PREFIX}${userId}`);
      const legacySalt = localStorage.getItem(`${LEGACY_PIN_SALT_PREFIX}${userId}`);

      if (legacyHash && legacySalt) {
        const computedLegacy = await computeLegacySha256(pin, legacySalt);
        if (constantTimeEqual(computedLegacy, legacyHash)) {
          isValid = true;
          migratedFromV1 = true;

          // Seamless auto-migration to PBKDF2-SHA-256
          try {
            await setAppPin(userId, pin);
          } catch (migrateErr) {
            console.warn('[AppPin] Auto-migration error:', migrateErr);
          }
        }
      }
    }

    if (isValid) {
      // Success: clear failed attempts and unlock
      resetPinRateLimit(userId);
      return {
        success: true,
        locked: false,
        remainingSeconds: 0,
        failedAttempts: 0,
        migratedFromV1,
      };
    }

    // 4. Failure: increment attempt count and enforce persistent lockout if threshold reached
    const newFailedAttempts = rateLimit.failedAttempts + 1;
    const lockoutSeconds = calculateLockoutSeconds(newFailedAttempts);
    const newLockedUntil = lockoutSeconds > 0 ? now + lockoutSeconds * 1000 : null;

    setPinRateLimit(userId, {
      failedAttempts: newFailedAttempts,
      lockedUntil: newLockedUntil,
    });

    return {
      success: false,
      locked: Boolean(newLockedUntil),
      remainingSeconds: lockoutSeconds,
      failedAttempts: newFailedAttempts,
      error:
        lockoutSeconds > 0
          ? `Too many failed attempts. Locked for ${lockoutSeconds}s.`
          : 'Incorrect PIN. Please try again.',
    };
  } catch (err: any) {
    console.error('[AppPin] Verification execution error:', err);
    return {
      success: false,
      locked: false,
      remainingSeconds: 0,
      failedAttempts: rateLimit.failedAttempts,
      error: 'Security verification error. Please retry.',
    };
  }
}

/**
 * Remove/reset the App PIN for a specific user
 */
export function removeAppPin(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${PIN_V2_PREFIX}${userId}`);
    localStorage.removeItem(`${LEGACY_PIN_HASH_PREFIX}${userId}`);
    localStorage.removeItem(`${LEGACY_PIN_SALT_PREFIX}${userId}`);
    resetPinRateLimit(userId);
  } catch (e) {
    console.error('[AppPin] Removal error:', e);
  }
}

// ================= PATTERN LOCK METHODS =================

/**
 * Check if the user has a Pattern Lock on this device
 */
export function hasAppPattern(userId: string): boolean {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(`${PATTERN_V2_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.version === 2 && parsed.salt && parsed.hash);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Set or change a 3x3 Android-style dot pattern (e.g. [0, 1, 2, 4, 6])
 */
export async function setAppPattern(userId: string, pattern: number[]): Promise<void> {
  if (!userId || !Array.isArray(pattern) || pattern.length < 4) {
    throw new Error('Pattern must connect at least 4 dots');
  }

  // Validate dot indices are in range 0..8
  for (const dot of pattern) {
    if (typeof dot !== 'number' || dot < 0 || dot > 8) {
      throw new Error('Invalid pattern dots');
    }
  }

  const patternStr = pattern.join('-');
  const saltHex = generateSaltHex();
  const hashHex = await derivePbkdf2Hash(patternStr, saltHex, PBKDF2_ITERATIONS);

  const record: PatternRecordV2 = {
    version: 2,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: saltHex,
    hash: hashHex,
    dotCount: pattern.length,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(`${PATTERN_V2_PREFIX}${userId}`, JSON.stringify(record));
  resetPinRateLimit(userId);
}

/**
 * Verify entered pattern with PBKDF2 and persistent rate limiting
 */
export async function verifyAppPattern(userId: string, pattern: number[]): Promise<PinVerificationResult> {
  if (!userId || !Array.isArray(pattern) || pattern.length < 4) {
    return {
      success: false,
      locked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      error: 'Pattern must connect at least 4 dots',
    };
  }

  // Check persistent lockout state
  const rateLimit = getPinRateLimit(userId);
  const now = Date.now();

  if (rateLimit.lockedUntil && rateLimit.lockedUntil > now) {
    const remainingSeconds = Math.ceil((rateLimit.lockedUntil - now) / 1000);
    return {
      success: false,
      locked: true,
      remainingSeconds,
      failedAttempts: rateLimit.failedAttempts,
      error: `Too many failed attempts. Locked for ${remainingSeconds}s.`,
    };
  }

  try {
    const raw = localStorage.getItem(`${PATTERN_V2_PREFIX}${userId}`);
    if (!raw) {
      return {
        success: false,
        locked: false,
        remainingSeconds: 0,
        failedAttempts: 0,
        error: 'No pattern lock configured',
      };
    }

    const record: PatternRecordV2 = JSON.parse(raw);
    const patternStr = pattern.join('-');
    const computedHash = await derivePbkdf2Hash(
      patternStr,
      record.salt,
      record.iterations || PBKDF2_ITERATIONS
    );

    const isValid = constantTimeEqual(computedHash, record.hash);

    if (isValid) {
      resetPinRateLimit(userId);
      return {
        success: true,
        locked: false,
        remainingSeconds: 0,
        failedAttempts: 0,
      };
    }

    // Failure: rate limiting increment
    const newFailedAttempts = rateLimit.failedAttempts + 1;
    const lockoutSeconds = calculateLockoutSeconds(newFailedAttempts);
    const newLockedUntil = lockoutSeconds > 0 ? now + lockoutSeconds * 1000 : null;

    setPinRateLimit(userId, {
      failedAttempts: newFailedAttempts,
      lockedUntil: newLockedUntil,
    });

    return {
      success: false,
      locked: Boolean(newLockedUntil),
      remainingSeconds: lockoutSeconds,
      failedAttempts: newFailedAttempts,
      error:
        lockoutSeconds > 0
          ? `Too many failed attempts. Locked for ${lockoutSeconds}s.`
          : 'Incorrect pattern. Please try again.',
    };
  } catch (err: any) {
    console.error('[AppPattern] Verification error:', err);
    return {
      success: false,
      locked: false,
      remainingSeconds: 0,
      failedAttempts: rateLimit.failedAttempts,
      error: 'Security verification error. Please retry.',
    };
  }
}

/**
 * Remove pattern lock for a user
 */
export function removeAppPattern(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${PATTERN_V2_PREFIX}${userId}`);
    resetPinRateLimit(userId);
  } catch (e) {
    console.error('[AppPattern] Removal error:', e);
  }
}

// ================= LOCK METHOD PREFERENCES =================

/**
 * Get preferred lock method: 'pin' | 'pattern' | 'biometric'
 */
export function getPreferredLockMethod(userId: string): LockMethod {
  if (!userId) return 'pin';
  try {
    const saved = localStorage.getItem(`${LOCK_METHOD_PREFIX}${userId}`);
    if (saved === 'pattern' || saved === 'biometric' || saved === 'pin') {
      return saved as LockMethod;
    }
    // If not explicitly set, determine by available lock:
    if (hasAppPattern(userId) && !hasAppPin(userId)) {
      return 'pattern';
    }
    return 'pin';
  } catch {
    return 'pin';
  }
}

/**
 * Set preferred lock method: 'pin' | 'pattern' | 'biometric'
 */
export function setPreferredLockMethod(userId: string, method: LockMethod): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCK_METHOD_PREFIX}${userId}`, method);
  } catch (e) {
    console.warn('[AppPin] Failed to save lock method preference:', e);
  }
}

/**
 * Check if the user has any lock configured (PIN or Pattern)
 */
export function hasAnyLock(userId: string): boolean {
  if (!userId) return false;
  return hasAppPin(userId) || hasAppPattern(userId);
}
