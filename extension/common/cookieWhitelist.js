// Per-platform whitelist of *authentication* cookie names.
// Only cookies whose name matches the list (or regex) are exported — analytics
// and A/B testing cookies are filtered out to keep payload size and risk minimal.

const META_COMMON = [
  'c_user', 'xs', 'fr', 'datr', 'sb', 'wd', 'spin', 'presence', 'm_pixel_ratio',
];

export const AUTH_COOKIE_NAMES = {
  instagram: [
    'sessionid', 'csrftoken', 'ds_user_id', 'mid', 'rur', 'ig_did', 'ig_nrcb', ...META_COMMON,
  ],
  facebook: [
    'sessionid', 'csrftoken', ...META_COMMON,
  ],
  threads: [
    'sessionid', 'csrftoken', 'ds_user_id', 'mid', 'rur', 'ig_did', ...META_COMMON,
  ],
  x: [
    'auth_token', 'ct0', 'twid', 'guest_id', 'guest_id_marketing', 'guest_id_ads',
    'kdt', 'lang', 'personalization_id',
  ],
  tiktok: [
    'sessionid', 'sessionid_ss', 'sid_tt', 'tt_webid', 'tt_webid_v2',
    'msToken', 's_v_web_id', 'ttwid', 'tt_csrf_token', 'passport_csrf_token',
  ],
  linkedin: [
    'li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'lidc', 'liap', 'li_rm',
    'li_mc', 'lang',
  ],
  youtube: [
    'SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID',
    '__Secure-1PSIDTS', '__Secure-3PSIDTS', 'LOGIN_INFO', 'PREF', 'YSC',
    'VISITOR_INFO1_LIVE', 'CONSENT', 'SOCS',
  ],
  reddit: [
    'reddit_session', 'token_v2', 'edgebucket', 'session_tracker', 'csv', 'loid',
  ],
  snapchat: [
    'sc-a-session', 'sc-a-csrf', 'sc-a-nonce', 'sc-a-session-token', 'xsrf_token',
  ],
  telegram: [
    'stel_token', 'stel_ssid', 'stel_dt', 'stel_ln',
  ],
  whatsapp: [
    'wa_lang_pref', 'wa_build', 'wa_ul', 'wa_ul2', 'wa_lang',
  ],
  mastodon: [
    '_mastodon_session', 'remember_user_token', 'session_id',
  ],
  linktree: [
    '_linktree_session',
  ],
  paypal: [
    'login_email', 'cookie_check', 'X-PP-SILOVER', 'l7_az', 'tsrce',
  ],
  strava: [
    '_strava4_session', '_strava_idcf', 'strava_remember_id', 'strava_remember_token',
  ],
};

export function filterAuthCookies(platformId, allCookies) {
  const allowed = AUTH_COOKIE_NAMES[platformId];
  if (!allowed) return allCookies; // unknown platform: keep everything (caller should handle)
  const set = new Set(allowed);
  return allCookies.filter((c) => set.has(c.name) || c.name.startsWith('__Secure-') || c.name.startsWith('__Host-'));
}
