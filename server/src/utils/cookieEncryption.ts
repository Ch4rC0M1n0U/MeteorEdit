import crypto from 'crypto';

/**
 * AES-256-GCM at-rest encryption for sensitive auth cookies.
 *
 * Key source: env COOKIE_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Falls back to JWT_SECRET-derived key on dev — NOT recommended for production.
 *
 * Output format: base64(iv || authTag || ciphertext)
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.COOKIE_ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
    return cachedKey;
  }
  // Dev fallback: derive a stable key from JWT_SECRET
  const fallback = process.env.JWT_SECRET || 'meteoredit-dev-fallback';
  cachedKey = crypto.createHash('sha256').update(`cookie-enc:${fallback}`).digest();
  if (process.env.NODE_ENV === 'production') {
    console.warn('[cookieEncryption] COOKIE_ENCRYPTION_KEY missing in production — using JWT_SECRET-derived fallback. Set a 64-hex-char key for proper isolation.');
  }
  return cachedKey;
}

export function encryptCookies(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptCookies(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Cookie payload too short');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number | null;
}

export function encryptCookieList(cookies: StoredCookie[]): string {
  return encryptCookies(JSON.stringify(cookies));
}

export function decryptCookieList(payload: string): StoredCookie[] {
  return JSON.parse(decryptCookies(payload));
}
