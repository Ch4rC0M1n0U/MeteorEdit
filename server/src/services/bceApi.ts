/**
 * Thin wrapper around CBEAPI.be (https://cbeapi.be) for searching the Belgian
 * Crossroads Bank for Enterprises (BCE/KBO).
 *
 * Each user provides their own Bearer token via Profile > External API tokens.
 * Free tier: 2500 requests/day per token.
 */

const BASE_URL = 'https://cbeapi.be/api/v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class BceApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'BceApiError';
  }
}

async function callApi<T>(path: string, token: string, lang: string, params?: Record<string, string | number | undefined>, timeoutMs = 12000): Promise<T> {
  const url = new URL(BASE_URL + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': lang,
        'User-Agent': 'MeteorEdit/3.x (BCE Search module)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json() as any;
        detail = body?.message || body?.errors?.[0]?.message || detail;
      } catch { /* not JSON */ }

      if (res.status === 401) throw new BceApiError('Token CBEAPI invalide ou révoqué.', 401);
      if (res.status === 429) throw new BceApiError('Quota CBEAPI atteint (2500 req/jour). Réessayez plus tard.', 429);
      if (res.status === 404) throw new BceApiError('Entreprise introuvable.', 404);
      if (res.status === 504 || res.status === 502) {
        throw new BceApiError('CBEAPI a dépassé le délai d\'attente (registre belge surchargé). Essayez avec moins de critères ou réessayez dans quelques minutes.', 504);
      }
      throw new BceApiError(`CBEAPI ${path}: ${detail}`, res.status);
    }
    return await res.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof BceApiError) throw err;
    if ((err as any)?.name === 'AbortError') {
      throw new BceApiError(`Délai dépassé sur CBEAPI (>${Math.round(timeoutMs / 1000)}s). La recherche par adresse peut être lente — réessayez avec moins de critères.`, 504);
    }
    throw new BceApiError(`CBEAPI réseau : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 0);
  }
}

export interface BceCompany {
  cbe_number: string;
  cbe_number_formatted: string;
  denomination?: string;
  abbreviation?: string;
  commercial_name?: string;
  branch_name?: string;
  denomination_with_legal_form?: string;
  address?: {
    street?: string;
    street_number?: string;
    box?: string;
    post_code?: string;
    city?: string;
    country_code?: string;
    full_address?: string;
  };
  establishments?: Array<Record<string, any>>;
  juridical_form?: string;
  juridical_form_code?: string;
  juridical_form_short?: string;
  status?: string;
  juridical_situation?: string;
  juridical_situation_code?: string;
  type?: string;
  pretty_type?: string | null;
  start_date?: string;
  contact_infos?: { email?: string; phone?: string; web?: string };
  nace_activities?: Array<{ code: string; description: string; classification: string; nace_version: string }>;
}

export interface BceSearchResult {
  data: BceCompany[];
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

/**
 * Normalize any BCE/VAT input ("0123.456.789", "BE 0123 456 789", "BE0123456789",
 * "0123456789") to the canonical form used by the API: "0123456789" (10 digits).
 */
export function normalizeCbeNumber(input: string): string {
  return String(input ?? '').replace(/[^\d]/g, '').padStart(10, '0').slice(-10);
}

/** Build the canonical "BE0123456789" display form requested by the user. */
export function formatVatBE(input: string): string {
  return `BE${normalizeCbeNumber(input)}`;
}

export async function searchByName(token: string, name: string, postCode?: number, lang = 'fr'): Promise<BceSearchResult> {
  const cacheKey = `name:${lang}:${name}:${postCode ?? ''}`;
  const cached = cacheGet<BceSearchResult>(cacheKey);
  if (cached) return cached;
  const data = await callApi<BceSearchResult>('/company/search', token, lang, { name, post_code: postCode });
  cacheSet(cacheKey, data);
  return data;
}

/**
 * Normalize a house number for comparison: trim, lowercase, drop spaces and
 * dashes, so "12 A", "12-A" and "12a" all collapse to "12a".
 */
function normalizeHouseNumber(input: string | undefined | null): string {
  return String(input ?? '').toLowerCase().replace(/[\s-]/g, '');
}

export async function searchByAddress(
  token: string,
  q: { street?: string; house_number?: string; city?: string; post_code?: number },
  lang = 'fr'
): Promise<BceSearchResult> {
  const cacheKey = `addr:${lang}:${JSON.stringify(q)}`;
  const cached = cacheGet<BceSearchResult>(cacheKey);
  if (cached) return cached;

  // CBEAPI's address index is slow (typically 20-30s) and times out (504)
  // when house_number is combined with other fields. Strategy: query without
  // house_number, then filter server-side. This lets users keep typing a full
  // address (street + number + city) without ever hitting CBEAPI's timeout.
  const { house_number, ...remoteQuery } = q;
  const data = await callApi<BceSearchResult>('/company/search/address', token, lang, remoteQuery, 50000);

  if (house_number && data?.data) {
    const target = normalizeHouseNumber(house_number);
    const filtered = data.data.filter((c) => {
      const headOffice = normalizeHouseNumber(c.address?.street_number);
      if (headOffice === target) return true;
      const establishments = Array.isArray(c.establishments) ? c.establishments : [];
      return establishments.some((e) => normalizeHouseNumber((e as any)?.house_number) === target);
    });
    const result: BceSearchResult = {
      data: filtered,
      meta: data.meta ? { ...data.meta, total: filtered.length } : undefined,
    };
    cacheSet(cacheKey, result);
    return result;
  }

  cacheSet(cacheKey, data);
  return data;
}

export async function getByCbeNumber(token: string, cbeNumber: string, lang = 'fr'): Promise<BceCompany> {
  const normalized = normalizeCbeNumber(cbeNumber);
  const cacheKey = `vat:${lang}:${normalized}`;
  const cached = cacheGet<BceCompany>(cacheKey);
  if (cached) return cached;
  const wrapped = await callApi<{ data: BceCompany }>(`/company/${normalized}`, token, lang);
  cacheSet(cacheKey, wrapped.data);
  return wrapped.data;
}

export async function getJuridicalForms(token: string, lang = 'fr'): Promise<any> {
  const cacheKey = `forms:${lang}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;
  const data = await callApi<any>('/juridical-forms', token, lang);
  cacheSet(cacheKey, data);
  return data;
}

export async function getCompaniesByJuridicalForm(token: string, code: string, lang = 'fr', page = 1): Promise<BceSearchResult> {
  const cacheKey = `byForm:${lang}:${code}:${page}`;
  const cached = cacheGet<BceSearchResult>(cacheKey);
  if (cached) return cached;
  const data = await callApi<BceSearchResult>(`/juridical-forms/${encodeURIComponent(code)}/companies`, token, lang, { page });
  cacheSet(cacheKey, data);
  return data;
}
