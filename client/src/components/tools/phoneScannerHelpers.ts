import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, getExampleNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import type { CountryCode } from 'libphonenumber-js';

export type WarnLevel = 'ok' | 'warn' | 'block';

export interface CombinationsPreview {
  count: number;
  warnLevel: WarnLevel;
  estimatedDurationMs: number;
}

export interface CountryEntry {
  code: string;       // ISO-2 (e.g. 'BE')
  name: string;
  dialCode: string;   // e.g. '+32'
}

const COUNTRY_NAMES_FR: Partial<Record<string, string>> = {
  BE: 'Belgique',
  FR: 'France',
  LU: 'Luxembourg',
  CH: 'Suisse',
  DE: 'Allemagne',
  NL: 'Pays-Bas',
  GB: 'Royaume-Uni',
  US: 'États-Unis',
  CA: 'Canada',
  ES: 'Espagne',
  IT: 'Italie',
  PT: 'Portugal',
  MA: 'Maroc',
  TN: 'Tunisie',
  DZ: 'Algérie',
  TR: 'Turquie',
  PL: 'Pologne',
  RO: 'Roumanie',
  RU: 'Russie',
  UA: 'Ukraine',
};

const PRIORITY_COUNTRIES = ['BE', 'FR', 'LU', 'CH', 'DE', 'NL', 'GB', 'US'];

export function getCountryList(): CountryEntry[] {
  const all = getCountries();
  const intl = new Intl.DisplayNames(['fr'], { type: 'region' });
  const entries: CountryEntry[] = all.map((code) => ({
    code,
    name: COUNTRY_NAMES_FR[code] || intl.of(code) || code,
    dialCode: '+' + getCountryCallingCode(code as CountryCode),
  }));

  // Sort: priority countries first (in order), then alphabetical
  const priorityIdx = (c: string) => {
    const i = PRIORITY_COUNTRIES.indexOf(c);
    return i === -1 ? 999 : i;
  };

  return entries.sort((a, b) => {
    const pa = priorityIdx(a.code);
    const pb = priorityIdx(b.code);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Normalize wildcards: accept both ? and * (treat * as ?).
 */
export function normalizeWildcards(pattern: string): string {
  return pattern.replace(/\*/g, '?');
}

/**
 * Count combinations the pattern would generate.
 */
export function countCombinations(pattern: string): number {
  const normalized = normalizeWildcards(pattern);
  const masks = (normalized.match(/\?/g) ?? []).length;
  return Math.pow(10, masks);
}

/**
 * Detect country from a pattern starting with +CC.
 * Returns the ISO-2 country code or null.
 */
export function detectCountryFromPattern(pattern: string): string | null {
  const cleaned = pattern.replace(/[\s\-.]/g, '');
  if (!cleaned.startsWith('+')) return null;

  // Try parsing — libphonenumber will identify the country from the dial code
  try {
    const parsed = parsePhoneNumberFromString(cleaned.replace(/[?*]/g, '0'));
    if (parsed?.country) return parsed.country;
  } catch {
    // ignore
  }

  // Fallback: match against known dial codes (longest first)
  const digits = cleaned.slice(1).replace(/[^0-9]/g, '');
  for (let len = 4; len >= 1; len--) {
    const prefix = digits.slice(0, len);
    if (!prefix) continue;
    const countries = getCountries();
    for (const c of countries) {
      try {
        if (getCountryCallingCode(c as CountryCode) === prefix) {
          return c;
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

/**
 * Get the expected national number length for a country.
 * Returns null if unable to determine.
 */
export function getExpectedLength(country: string): number | null {
  try {
    const example = getExampleNumber(country as CountryCode, examples);
    if (example) return example.nationalNumber.length;
  } catch { /* ignore */ }
  return null;
}

/**
 * Validate the pattern length against the expected country length.
 * Returns { valid, expected, actual } where actual is the count of digits + ?
 * after the dial code.
 */
export interface LengthValidation {
  valid: boolean;
  expected: number | null;
  actual: number;
}

export function validateLength(pattern: string, country: string): LengthValidation {
  const cleaned = normalizeWildcards(pattern).replace(/[\s\-.]/g, '');
  const expected = getExpectedLength(country);
  if (!expected) return { valid: true, expected: null, actual: 0 };

  // Strip dial code if present
  let national = cleaned;
  if (cleaned.startsWith('+')) {
    try {
      const dial = getCountryCallingCode(country as CountryCode);
      if (cleaned.startsWith('+' + dial)) {
        national = cleaned.slice(1 + dial.length);
      }
    } catch { /* ignore */ }
  }
  // Strip leading zeros (national prefix)
  national = national.replace(/^0+/, '');
  // Count digits and wildcards
  const actual = (national.match(/[0-9?]/g) ?? []).length;
  return { valid: actual === expected, expected, actual };
}

/**
 * Preview a pattern: returns combination count + warning level + duration.
 */
export function previewCombinations(
  pattern: string,
  thresholds: { warn: number; block: number },
  delays: { minMs: number; maxMs: number }
): CombinationsPreview {
  const cleaned = normalizeWildcards(pattern.replace(/\s+/g, ''));
  const count = countCombinations(cleaned);
  let warnLevel: WarnLevel = 'ok';
  if (count >= thresholds.block) warnLevel = 'block';
  else if (count >= thresholds.warn) warnLevel = 'warn';

  const avgDelay = (delays.minMs + delays.maxMs) / 2;
  // Phase A only (Phase B is unreliable since WA wa.me UI changes)
  const phaseA = count * 1500;
  const delaysTotal = Math.max(0, count - 1) * avgDelay;
  return {
    count,
    warnLevel,
    estimatedDurationMs: Math.round(phaseA + delaysTotal),
  };
}

/**
 * Format an E.164 number for display: "+32 490 22 38 13".
 */
export function formatPhone(phoneE164: string, country?: string): string {
  try {
    const parsed = parsePhoneNumberFromString(phoneE164, country as CountryCode | undefined);
    if (parsed) return parsed.formatInternational();
  } catch {
    // ignore
  }
  return phoneE164;
}

/**
 * Build a wa.me URL for an E.164 number.
 */
export function buildWaMeUrl(phoneE164: string): string {
  const id = phoneE164.replace(/\D/g, '');
  return `https://wa.me/${id}`;
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  if (min < 60) return s > 0 ? `${min}min ${s}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${h}h ${remMin}min` : `${h}h`;
}
