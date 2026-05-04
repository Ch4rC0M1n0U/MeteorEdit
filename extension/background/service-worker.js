// Minimal service worker / event page — works as both a Chrome MV3 service
// worker (module) and a Firefox MV3 background script.
// We intentionally avoid `import` here so the file can also be loaded as a
// classic background script when needed.

const PLATFORM_HOSTS = [
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)threads\.(com|net)$/i,
  /(^|\.)(x|twitter)\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)(youtube\.com|youtu\.be)$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)(t\.me|telegram\.(me|org))$/i,
  /(^|\.)(whatsapp\.com|wa\.me|web\.whatsapp\.com)$/i,
  /(mastodon|mstdn|piaille\.fr|framapiaf\.org|mamot\.fr)/i,
  /(^|\.)linktr\.ee$/i,
  /(^|\.)(paypal\.com|paypal\.me)$/i,
  /(^|\.)strava\.com$/i,
];

function isSupportedHost(url) {
  if (!url) return false;
  let host;
  try { host = new URL(url).host; } catch { return false; }
  return PLATFORM_HOSTS.some((re) => re.test(host));
}

async function updateBadgeForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const supported = isSupportedHost(tab?.url ?? '');
    await chrome.action.setBadgeText({ tabId, text: supported ? '●' : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
  } catch { /* tab gone */ }
}

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') updateBadgeForTab(tabId);
});
