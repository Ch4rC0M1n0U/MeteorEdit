/**
 * E2E Encryption utilities using Web Crypto API.
 * All crypto operations happen client-side only.
 */

// --- Helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- RSA Key Pair ---

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

// --- PBKDF2 Password Derivation ---

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(salt.buffer);
}

export async function deriveKeyFromPassword(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const salt = base64ToArrayBuffer(saltBase64);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Encrypt/Decrypt Private Key with Password ---

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<{ encryptedPrivateKey: string; salt: string }> {
  const salt = generateSalt();
  const derivedKey = await deriveKeyFromPassword(password, salt);
  const privateKeyJwk = await exportPrivateKey(privateKey);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encoder.encode(privateKeyJwk)
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return {
    encryptedPrivateKey: arrayBufferToBase64(combined.buffer),
    salt,
  };
}

export async function decryptPrivateKey(
  encryptedPrivateKeyBase64: string,
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const derivedKey = await deriveKeyFromPassword(password, saltBase64);
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedPrivateKeyBase64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    ciphertext
  );
  const decoder = new TextDecoder();
  const jwkString = decoder.decode(decrypted);
  return importPrivateKey(jwkString);
}

// --- AES-256-GCM Dossier Key ---

export async function generateDossierKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportDossierKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importDossierKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- RSA encrypt/decrypt dossier key ---

export async function encryptDossierKey(
  dossierKey: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const rawKey = await exportDossierKey(dossierKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawKey
  );
  return arrayBufferToBase64(encrypted);
}

export async function decryptDossierKey(
  encryptedKeyBase64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const encrypted = base64ToArrayBuffer(encryptedKeyBase64);
  const rawKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encrypted
  );
  return importDossierKey(rawKey);
}

// --- AES-GCM Content Encryption ---

export async function encryptContent(
  data: any,
  dossierKey: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dossierKey,
    plaintext
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return arrayBufferToBase64(combined.buffer);
}

export async function decryptContent(
  encryptedBase64: string,
  dossierKey: CryptoKey
): Promise<any> {
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    dossierKey,
    ciphertext
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// --- File Encryption ---

/**
 * Encrypt a binary file (ArrayBuffer) with AES-256-GCM.
 * Returns: IV (12 bytes) + ciphertext + auth tag
 */
export async function encryptFile(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  const result = new Uint8Array(iv.byteLength + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.byteLength);
  return result.buffer;
}

/**
 * Decrypt a binary file (ArrayBuffer) encrypted with AES-256-GCM.
 * Expects: IV (12 bytes) + ciphertext + auth tag
 */
export async function decryptFile(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const dataArray = new Uint8Array(data);
  const iv = dataArray.slice(0, 12);
  const ciphertext = dataArray.slice(12);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
}

/**
 * Compute SHA-256 hash of an ArrayBuffer, return hex string.
 */
export async function hashFile(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
