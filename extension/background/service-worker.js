// Minimal service worker — kept lightweight, mostly used for icon badge
// updates when a supported platform tab becomes active.
import { detectPlatform } from '../common/platforms.js';

async function updateBadgeForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const platform = detectPlatform(tab?.url ?? '');
    await chrome.action.setBadgeText({ tabId, text: platform ? '●' : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
  } catch { /* tab gone */ }
}

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') updateBadgeForTab(tabId);
});
