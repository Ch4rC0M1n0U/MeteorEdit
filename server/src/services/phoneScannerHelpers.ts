import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

export class TooManyCombinationsError extends Error {
  constructor(public count: number, public max: number) {
    super(`Pattern would generate ${count} combinations (max allowed: ${max})`);
    this.name = 'TooManyCombinationsError';
  }
}

export class InvalidPatternError extends Error {
  constructor(public pattern: string, reason: string) {
    super(`Invalid pattern "${pattern}": ${reason}`);
    this.name = 'InvalidPatternError';
  }
}

/**
 * Count the number of combinations a pattern would expand to.
 * Each "?" represents one unknown digit (0-9).
 */
export function countCombinations(pattern: string): number {
  const masks = (pattern.match(/\?/g) ?? []).length;
  return Math.pow(10, masks);
}

/**
 * Expand a phone number pattern with "?" wildcards into all possible numbers.
 * Throws TooManyCombinationsError if count would exceed maxCombinations.
 *
 * Example:
 *   expandPattern('+3249?22381?', 200) → ['+32490223810', '+32490223811', ...]
 */
export function expandPattern(pattern: string, maxCombinations: number): string[] {
  const cleaned = pattern.replace(/\s+/g, '');
  if (!cleaned) {
    throw new InvalidPatternError(pattern, 'pattern is empty');
  }

  const total = countCombinations(cleaned);
  if (total > maxCombinations) {
    throw new TooManyCombinationsError(total, maxCombinations);
  }

  const results: string[] = [];
  const positions: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '?') positions.push(i);
  }

  if (positions.length === 0) {
    return [cleaned];
  }

  const chars = cleaned.split('');
  const max = Math.pow(10, positions.length);
  for (let n = 0; n < max; n++) {
    let value = n;
    for (let p = positions.length - 1; p >= 0; p--) {
      chars[positions[p]] = String(value % 10);
      value = Math.floor(value / 10);
    }
    results.push(chars.join(''));
  }

  return results;
}

export interface E164ValidationResult {
  isValid: boolean;
  e164?: string;
  country?: string;
  type?: string;
  error?: string;
}

/**
 * Validate and normalize a phone number to E.164 format.
 * Accepts an optional default country (ISO-2) for parsing local numbers.
 */
export function validateE164(phone: string, defaultCountry?: string): E164ValidationResult {
  try {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry as CountryCode | undefined);
    if (!parsed || !parsed.isValid()) {
      return { isValid: false, error: 'Invalid phone number' };
    }
    return {
      isValid: true,
      e164: parsed.format('E.164'),
      country: parsed.country,
      type: parsed.getType(),
    };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : 'Parse error' };
  }
}

/**
 * Convert an E.164 number to WhatsApp-compatible format (digits only, no +).
 * Used to build wa.me/<digits> URLs and whatsapp-web.js IDs.
 */
export function toWhatsappId(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

/**
 * Format a pattern for preview, removing whitespace.
 */
export function normalizePattern(pattern: string): string {
  return pattern.replace(/\s+/g, '');
}

/**
 * Estimate scan duration in milliseconds.
 */
export function estimateDurationMs(combinations: number, minDelayMs: number, maxDelayMs: number): number {
  const avgDelay = (minDelayMs + maxDelayMs) / 2;
  // Rough: 5s for Phase B + avgDelay for Phase A on hits (assume 10% hit rate)
  const phaseB = combinations * 5000;
  const phaseA = combinations * 0.1 * avgDelay;
  return Math.round(phaseB + phaseA);
}

/**
 * Get today's date in YYYY-MM-DD format (for daily counter resets).
 */
export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pick a random delay between min and max using a gaussian-ish distribution
 * (sum of 3 uniforms → bell curve approximation, less robotic than uniform).
 */
export function randomDelayMs(minDelayMs: number, maxDelayMs: number): number {
  const span = maxDelayMs - minDelayMs;
  const r = (Math.random() + Math.random() + Math.random()) / 3;
  return Math.round(minDelayMs + r * span);
}
