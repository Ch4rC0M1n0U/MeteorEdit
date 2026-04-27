import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from 'libphonenumber-js';
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
 * Count combinations the pattern would generate.
 */
export function countCombinations(pattern: string): number {
  const masks = (pattern.match(/\?/g) ?? []).length;
  return Math.pow(10, masks);
}

/**
 * Preview a pattern: returns combination count + warning level + duration.
 */
export function previewCombinations(
  pattern: string,
  thresholds: { warn: number; block: number },
  delays: { minMs: number; maxMs: number }
): CombinationsPreview {
  const cleaned = pattern.replace(/\s+/g, '');
  const count = countCombinations(cleaned);
  let warnLevel: WarnLevel = 'ok';
  if (count >= thresholds.block) warnLevel = 'block';
  else if (count >= thresholds.warn) warnLevel = 'warn';

  const avgDelay = (delays.minMs + delays.maxMs) / 2;
  const phaseB = count * 5000;
  const phaseA = count * 0.1 * avgDelay;
  return {
    count,
    warnLevel,
    estimatedDurationMs: Math.round(phaseB + phaseA),
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
