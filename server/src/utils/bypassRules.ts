/**
 * Bypass Paywalls rules per domain.
 * Inspired by Bypass Paywalls Clean (magnolia1234).
 * Applied in Puppeteer before screenshot capture.
 */

export interface BypassRule {
  /** Domains this rule applies to (matched against hostname) */
  domains: string[];
  /** Override User-Agent: 'googlebot' | 'bingbot' | string */
  useragent?: 'googlebot' | 'bingbot';
  /** Override Referer: 'google' | 'facebook' | 'twitter' */
  referer?: 'google' | 'facebook' | 'twitter';
  /** Add random X-Forwarded-For header */
  randomIp?: boolean;
  /** Allow cookies (don't clear them before navigation) */
  allowCookies?: boolean;
  /** URL patterns to block (paywall scripts) */
  blockPatterns?: RegExp[];
  /** CSS selectors to remove from DOM after load */
  removeSelectors?: string[];
  /** CSS selectors to unhide (remove blur/lock classes) */
  unhideSelectors?: string[];
  /** CSS classes to strip from elements */
  stripClasses?: string[];
}

// --- User-Agent strings ---
export const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
export const UA_BINGBOT = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
export const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// --- Referer URLs ---
const REFERERS: Record<string, string> = {
  google: 'https://www.google.com/',
  facebook: 'https://www.facebook.com/',
  twitter: 'https://t.co/',
};

// --- Common paywall script patterns to block ---
const PAYWALL_SCRIPT_PATTERNS: RegExp[] = [
  /piano\.io/i,
  /cdn\.tinypass\.com/i,
  /blueconic\.net/i,
  /poool\.fr/i,
  /cxense\.com/i,
  /evolok\.net/i,
  /zephr\.com\/zephr-browser/i,
  /js\.pelcro\.com/i,
  /js\.matheranalytics\.com/i,
  /qiota\.com/i,
  /weborama\.fr/i,
  /cdn\.ampproject\.org\/v\d+\/amp-(access|subscriptions)/i,
];

// --- Per-domain rules ---
const rules: BypassRule[] = [
  // === Belgian DPG Media ===
  {
    domains: ['7sur7.be', 'demorgen.be', 'humo.be', 'hln.be', 'vtm.be'],
    removeSelectors: [
      '[data-temptation-position]',
      '#paywall-modal',
      '.paywall',
      '[class*="paywall"]',
      '.piano-offer-overlay',
    ],
    unhideSelectors: ['.blurred', '.locked-article', '.text-blurred'],
    stripClasses: ['blurred', 'locked-article', 'text-blurred', 'detail-page--paywall'],
  },
  // === Belgian Mediahuis ===
  {
    domains: ['gva.be', 'hbvl.be', 'nieuwsblad.be', 'standaard.be', 'gentenaar.be'],
    allowCookies: true,
    removeSelectors: [
      'div[data-cj-root="subscription-wall"]',
      '[class*="paywall"]',
    ],
    unhideSelectors: ['.blurred', '.locked-article'],
    stripClasses: ['blurred', 'locked-article'],
  },
  // === Belgian Rossel ===
  {
    domains: ['lesoir.be', 'sudinfo.be', 'lavenir.net', 'nordeclair.be'],
    removeSelectors: ['[class*="paywall"]', '.r-pw', '#rossel-paywall'],
    unhideSelectors: ['.blurred', '.locked-article'],
    stripClasses: ['blurred', 'locked-article'],
    blockPatterns: [/piano\.io/i],
  },
  // === Belgian IPM ===
  {
    domains: ['lalibre.be', 'dhnet.be', 'lameuse.be'],
    useragent: 'googlebot',
    allowCookies: true,
    removeSelectors: ['[class*="paywall"]'],
  },
  // === Belgian L'Echo / De Tijd ===
  {
    domains: ['lecho.be', 'tijd.be'],
    referer: 'google',
    removeSelectors: ['[class*="paywall"]'],
  },
  // === Belgian Knack / Le Vif ===
  {
    domains: ['knack.be', 'levif.be'],
    allowCookies: true,
    blockPatterns: [/blueconic\.net/i, /piano\.io/i],
    removeSelectors: ['[class*="paywall"]', '.piano-offer-overlay'],
  },
  // === French Press ===
  {
    domains: ['lemonde.fr', 'lefigaro.fr', 'liberation.fr', 'lobs.com', 'lepoint.fr', 'lexpress.fr'],
    referer: 'google',
    blockPatterns: [/piano\.io/i, /cdn\.tinypass\.com/i, /poool\.fr/i],
    removeSelectors: ['[class*="paywall"]', '.article__content--restricted', '#piano-offer'],
    unhideSelectors: ['.blurred', '.locked-article'],
    stripClasses: ['blurred', 'locked-article'],
  },
  // === International (generic) ===
  {
    domains: ['medium.com'],
    removeSelectors: ['[class*="paywall"]', '[class*="meteredContent"]'],
  },
  {
    domains: ['nytimes.com', 'washingtonpost.com'],
    blockPatterns: [/piano\.io/i, /cdn\.tinypass\.com/i, /js\.matheranalytics\.com/i],
    removeSelectors: ['[class*="paywall"]', '#gateway-content'],
  },
];

/**
 * Find bypass rules matching a given URL's hostname.
 * Multiple rules can match (returns merged result).
 */
export function getBypassRules(url: string): BypassRule | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  const matching = rules.filter(r =>
    r.domains.some(d => hostname === d || hostname.endsWith('.' + d))
  );

  if (matching.length === 0) return null;

  // Merge all matching rules
  const merged: BypassRule = {
    domains: [],
    removeSelectors: [],
    unhideSelectors: [],
    stripClasses: [],
    blockPatterns: [...PAYWALL_SCRIPT_PATTERNS],
  };

  for (const r of matching) {
    if (r.useragent) merged.useragent = r.useragent;
    if (r.referer) merged.referer = r.referer;
    if (r.randomIp) merged.randomIp = true;
    if (r.allowCookies) merged.allowCookies = true;
    if (r.removeSelectors) merged.removeSelectors!.push(...r.removeSelectors);
    if (r.unhideSelectors) merged.unhideSelectors!.push(...r.unhideSelectors);
    if (r.stripClasses) merged.stripClasses!.push(...r.stripClasses);
    if (r.blockPatterns) merged.blockPatterns!.push(...r.blockPatterns);
  }

  return merged;
}

/**
 * Get the User-Agent string for a rule.
 */
export function getUA(rule: BypassRule | null): string {
  if (!rule?.useragent) return UA_CHROME;
  return rule.useragent === 'googlebot' ? UA_GOOGLEBOT : UA_BINGBOT;
}

/**
 * Get extra HTTP headers for a rule.
 */
export function getExtraHeaders(rule: BypassRule | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (rule?.referer) {
    headers['Referer'] = REFERERS[rule.referer] || '';
  }
  if (rule?.randomIp) {
    headers['X-Forwarded-For'] = `185.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  }
  return headers;
}
