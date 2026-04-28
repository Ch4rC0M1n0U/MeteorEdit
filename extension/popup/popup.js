import { getConfig, getBranding } from '../common/storage.js';
import { detectPlatform, getCookieDomains } from '../common/platforms.js';
import { filterAuthCookies } from '../common/cookieWhitelist.js';
import { api, ApiError } from '../common/api.js';

const $ = (id) => document.getElementById(id);
const state = { platform: null, tab: null };

function show(id) {
  ['state-loading', 'state-config', 'state-auth', 'state-unsupported', 'state-ready']
    .forEach((s) => $(s).hidden = s !== id);
}

function setStatus(kind, text) {
  const el = $('exportStatus');
  el.className = `me-status me-status--${kind}`;
  el.textContent = text;
  el.style.display = 'inline-flex';
}

async function applyBranding() {
  try {
    const cfg = await getConfig();
    if (cfg.apiUrl) $('brandHost').textContent = new URL(cfg.apiUrl).host;
    const branding = await getBranding();
    if (branding?.appName) $('brandName').textContent = branding.appName;
    if (branding?.logoUrl) $('brandLogo').src = branding.logoUrl;
  } catch { /* ignore */ }

  const manifest = chrome.runtime.getManifest();
  $('extVer').textContent = manifest.version;
}

async function init() {
  await applyBranding();

  $('optsBtn').addEventListener('click', openOptions);
  $('optsLink').addEventListener('click', (e) => { e.preventDefault(); openOptions(); });
  $('goOptsBtn')?.addEventListener('click', openOptions);
  $('goOptsBtn2')?.addEventListener('click', openOptions);

  const cfg = await getConfig();
  if (!cfg.apiUrl || !cfg.apiToken) { show('state-config'); return; }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  state.platform = detectPlatform(tab?.url ?? '');

  if (!state.platform) {
    $('currentHost').textContent = tab?.url ? new URL(tab.url).host : 'aucun onglet actif';
    show('state-unsupported');
    return;
  }

  $('platformIcon').textContent = state.platform.label.charAt(0);
  $('platformName').textContent = state.platform.label;

  // Pre-flight auth check
  try {
    await api.verify();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      show('state-auth');
      return;
    }
    setStatus('err', err.message);
  }

  // Cookie count (filtered to auth cookies only)
  try {
    const cookies = await collectAuthCookies(state.platform.id);
    $('platformMeta').textContent = `${cookies.length} cookies d'authentification détectés`;
    if (cookies.length === 0) {
      $('platformMeta').textContent = 'Aucune session active — connectez-vous d\'abord';
      $('exportBtn').disabled = true;
    }
  } catch (err) {
    $('platformMeta').textContent = 'Erreur lecture cookies';
    $('exportBtn').disabled = true;
  }

  $('exportBtn').addEventListener('click', onExport);
  show('state-ready');
}

function openOptions() { chrome.runtime.openOptionsPage(); }

async function collectAuthCookies(platformId) {
  const domains = getCookieDomains(platformId);
  const all = [];
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    all.push(...cookies);
  }
  // Dedupe by name+domain+path
  const seen = new Set();
  const uniq = all.filter((c) => {
    const key = `${c.name}|${c.domain}|${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return filterAuthCookies(platformId, uniq);
}

async function onExport() {
  $('exportBtn').disabled = true;
  setStatus('warn', 'Envoi en cours…');

  try {
    const cookies = await collectAuthCookies(state.platform.id);
    if (cookies.length === 0) throw new Error('Aucun cookie d\'authentification à exporter');

    await api.importCookies({
      platform: state.platform.id,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate ?? null,
      })),
    });

    setStatus('ok', `${cookies.length} cookies envoyés. La session est désormais utilisable côté MeteorEdit.`);
    setTimeout(() => window.close(), 1800);
  } catch (err) {
    setStatus('err', err.message ?? 'Erreur');
    $('exportBtn').disabled = false;
  }
}

init().catch((err) => {
  setStatus('err', err.message);
  show('state-ready');
});
