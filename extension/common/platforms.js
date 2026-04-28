// Platform detection — synchronized with server scrapeController.PLATFORM_PATTERNS
// Exposed as window.MeteorEditPlatforms / global PLATFORMS
export const PLATFORMS = [
  { id: 'instagram',  label: 'Instagram',  icon: 'mdi-instagram',         host: /(^|\.)instagram\.com$/i },
  { id: 'facebook',   label: 'Facebook',   icon: 'mdi-facebook',          host: /(^|\.)facebook\.com$/i },
  { id: 'threads',    label: 'Threads',    icon: 'mdi-at',                host: /(^|\.)threads\.(com|net)$/i },
  { id: 'x',          label: 'X / Twitter',icon: 'mdi-twitter',           host: /(^|\.)(x|twitter)\.com$/i },
  { id: 'tiktok',     label: 'TikTok',     icon: 'mdi-music-note',        host: /(^|\.)tiktok\.com$/i },
  { id: 'linkedin',   label: 'LinkedIn',   icon: 'mdi-linkedin',          host: /(^|\.)linkedin\.com$/i },
  { id: 'youtube',    label: 'YouTube',    icon: 'mdi-youtube',           host: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { id: 'reddit',     label: 'Reddit',     icon: 'mdi-reddit',            host: /(^|\.)reddit\.com$/i },
  { id: 'snapchat',   label: 'Snapchat',   icon: 'mdi-snapchat',          host: /(^|\.)snapchat\.com$/i },
  { id: 'telegram',   label: 'Telegram',   icon: 'mdi-send',              host: /(^|\.)(t\.me|telegram\.(me|org))$/i },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: 'mdi-whatsapp',          host: /(^|\.)(whatsapp\.com|wa\.me|web\.whatsapp\.com)$/i },
  { id: 'mastodon',   label: 'Mastodon',   icon: 'mdi-mastodon',          host: /(mastodon|mstdn|piaille\.fr|framapiaf\.org|mamot\.fr|toot\.|pouet\.)/i },
  { id: 'linktree',   label: 'Linktree',   icon: 'mdi-tree',              host: /(^|\.)linktr\.ee$/i },
  { id: 'paypal',     label: 'PayPal',     icon: 'mdi-credit-card',       host: /(^|\.)(paypal\.com|paypal\.me)$/i },
  { id: 'strava',     label: 'Strava',     icon: 'mdi-run',               host: /(^|\.)strava\.com$/i },
];

export function detectPlatform(url) {
  if (!url) return null;
  let host;
  try { host = new URL(url).host; } catch { return null; }
  return PLATFORMS.find((p) => p.host.test(host)) ?? null;
}

export function getCookieDomains(platformId) {
  // Cookie domains to extract per platform — broader than host detection
  // because auth cookies sometimes live on parent domains.
  const map = {
    instagram: ['.instagram.com', 'instagram.com'],
    facebook:  ['.facebook.com', 'facebook.com'],
    threads:   ['.threads.com', '.threads.net'],
    x:         ['.x.com', '.twitter.com'],
    tiktok:    ['.tiktok.com'],
    linkedin:  ['.linkedin.com', '.www.linkedin.com'],
    youtube:   ['.youtube.com', '.google.com', 'accounts.google.com'],
    reddit:    ['.reddit.com'],
    snapchat:  ['.snapchat.com', '.accounts.snapchat.com'],
    telegram:  ['.t.me', '.telegram.org', 'web.telegram.org'],
    whatsapp:  ['.whatsapp.com', '.web.whatsapp.com'],
    mastodon:  [], // varies per instance — caller must inject host
    linktree:  ['.linktr.ee'],
    paypal:    ['.paypal.com'],
    strava:    ['.strava.com'],
  };
  return map[platformId] ?? [];
}
