// Wrapper around chrome.storage.local with typed helpers.
const KEYS = {
  apiUrl: 'meteoredit:apiUrl',
  apiToken: 'meteoredit:apiToken',
  branding: 'meteoredit:branding',
  lastDossierId: 'meteoredit:lastDossierId',
};

export async function getConfig() {
  const data = await chrome.storage.local.get([KEYS.apiUrl, KEYS.apiToken]);
  return {
    apiUrl: (data[KEYS.apiUrl] ?? '').trim(),
    apiToken: (data[KEYS.apiToken] ?? '').trim(),
  };
}

export async function setConfig({ apiUrl, apiToken }) {
  const updates = {};
  if (apiUrl !== undefined) updates[KEYS.apiUrl] = apiUrl.trim();
  if (apiToken !== undefined) updates[KEYS.apiToken] = apiToken.trim();
  await chrome.storage.local.set(updates);
}

export async function getBranding() {
  const data = await chrome.storage.local.get([KEYS.branding]);
  return data[KEYS.branding] ?? null;
}

export async function setBranding(branding) {
  await chrome.storage.local.set({ [KEYS.branding]: branding });
}

export async function getLastDossierId() {
  const data = await chrome.storage.local.get([KEYS.lastDossierId]);
  return data[KEYS.lastDossierId] ?? null;
}

export async function setLastDossierId(id) {
  await chrome.storage.local.set({ [KEYS.lastDossierId]: id });
}
