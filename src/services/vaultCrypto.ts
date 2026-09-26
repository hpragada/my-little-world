import { VaultConfig, VaultDecryptedItem, VaultEncryptedRecord } from '../types';

const AUTH_VERIFICATION_TOKEN = 'VAULT_AUTH_VALID_v1';
const PBKDF2_ITERATIONS = 100000;

// Helper: Uint8Array <-> Base64
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate 16 random bytes for PBKDF2 salt
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return uint8ArrayToBase64(salt);
}

/**
 * Derive AES-GCM-256 key from a PIN/password and salt
 */
export async function deriveKey(pinOrPassword: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pinOrPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = base64ToUint8Array(saltBase64);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-GCM
 */
export async function encryptText(
  plainText: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(plainText);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt a ciphertext string using AES-GCM
 */
export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToUint8Array(ciphertextBase64);
  const iv = base64ToUint8Array(ivBase64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(plainBuffer);
}

/**
 * Initial setup for Vault: creates config with salt and auth verification ciphertext
 */
export async function setupVaultCredentials(
  pinOrPassword: string,
  autoLockMinutes = 5
): Promise<{ config: VaultConfig; key: CryptoKey }> {
  const salt = generateSalt();
  const key = await deriveKey(pinOrPassword, salt);
  const { ciphertext, iv } = await encryptText(AUTH_VERIFICATION_TOKEN, key);

  const config: VaultConfig = {
    isConfigured: true,
    salt,
    authCheckCiphertext: ciphertext,
    authCheckIV: iv,
    autoLockMinutes,
  };

  return { config, key };
}

/**
 * Attempt to verify and unlock the vault
 */
export async function verifyVaultPIN(
  pinOrPassword: string,
  config: VaultConfig
): Promise<CryptoKey | null> {
  try {
    const key = await deriveKey(pinOrPassword, config.salt);
    const decrypted = await decryptText(config.authCheckCiphertext, config.authCheckIV, key);
    if (decrypted === AUTH_VERIFICATION_TOKEN) {
      return key;
    }
    return null;
  } catch {
    // Decryption failure indicates wrong PIN or tampered ciphertext
    return null;
  }
}

/**
 * Encrypt a decrypted vault item into a persistent storage record
 */
export async function encryptVaultItem(
  item: VaultDecryptedItem,
  key: CryptoKey
): Promise<VaultEncryptedRecord> {
  const jsonStr = JSON.stringify(item);
  const { ciphertext, iv } = await encryptText(jsonStr, key);
  return {
    id: item.id,
    iv,
    ciphertext,
    createdAt: item.createdAt,
  };
}

/**
 * Decrypt an encrypted record into a vault item
 */
export async function decryptVaultRecord(
  record: VaultEncryptedRecord,
  key: CryptoKey
): Promise<VaultDecryptedItem | null> {
  try {
    const jsonStr = await decryptText(record.ciphertext, record.iv, key);
    return JSON.parse(jsonStr) as VaultDecryptedItem;
  } catch (err) {
    console.warn(`Failed to decrypt vault record ${record.id}:`, err);
    return null;
  }
}

/**
 * Change vault PIN: verifies old credentials, decrypts existing items, re-encrypts with new key
 */
export async function rekeyVault(
  oldPin: string,
  newPin: string,
  currentConfig: VaultConfig,
  decryptedItems: VaultDecryptedItem[]
): Promise<{
  newConfig: VaultConfig;
  newRecords: VaultEncryptedRecord[];
  newKey: CryptoKey;
}> {
  // First verify old PIN
  const oldKey = await verifyVaultPIN(oldPin, currentConfig);
  if (!oldKey) {
    throw new Error('Current PIN / Password is incorrect');
  }

  // Generate new credentials
  const { config: newConfig, key: newKey } = await setupVaultCredentials(
    newPin,
    currentConfig.autoLockMinutes
  );

  // Re-encrypt all items with new key
  const newRecords: VaultEncryptedRecord[] = [];
  for (const item of decryptedItems) {
    const record = await encryptVaultItem(item, newKey);
    newRecords.push(record);
  }

  return { newConfig, newRecords, newKey };
}
