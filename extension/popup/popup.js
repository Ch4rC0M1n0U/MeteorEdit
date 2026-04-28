import { getConfig, getBranding, setBranding, getLastDossierId, setLastDossierId } from '../common/storage.js';
import { detectPlatform, getCookieDomains } from '../common/platforms.js';
import { api, ApiError } from '../common/api.js';
import { encryptForDossier } from '../common/crypto.js';

const $ = (id) => document.getElementById(id);

const state = { platform: null, tab: null, dossiers: [] };

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
  if (!cfg.apiUrl || !cfg.apiToken) {
    show('state-config');
    return;
  }

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

  // Verify auth + load dossiers
  try {
    const dossiers = await api.dossiers();
    state.dossiers = dossiers?.dossiers ?? dossiers ?? [];
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      show('state-auth');
      return;
    }
    setStatus('err', err.message);
    show('state-ready');
    return;
  }

  const sel = $('dossierSel');
  sel.innerHTML = '';
  if (state.dossiers.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— Aucun dossier —';
    opt.disabled = true;
    sel.appendChild(opt);
    $('exportBtn').disabled = true;
  } else {
    state.dossiers.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d._id;
      opt.textContent = d.title || d.name || d._id;
      sel.appendChild(opt);
    });
    const last = await getLastDossierId();
    if (last && state.dossiers.find((d) => d._id === last)) sel.value = last;
  }

  // Cookie count
  try {
    const cookies = await collectCookies(state.platform.id);
    $('platformMeta').textContent = `${cookies.length} cookies disponibles`;
    if (cookies.length === 0) $('exportBtn').disabled = true;
  } catch (err) {
    $('platformMeta').textContent = 'Erreur lecture cookies';
  }

  $('exportBtn').addEventListener('click', onExport);
  show('state-ready');
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function collectCookies(platformId) {
  const domains = getCookieDomains(platformId);
  const all = [];
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    all.push(...cookies);
  }
  // Dedupe by name+domain+path
  const seen = new Set();
  return all.filter((c) => {
    const key = `${c.name}|${c.domain}|${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function onExport() {
  const dossierId = $('dossierSel').value;
  if (!dossierId) return;
  $('exportBtn').disabled = true;
  setStatus('warn', 'Chiffrement et envoi…');

  try {
    const cookies = await collectCookies(state.platform.id);
    if (cookies.length === 0) throw new Error('Aucun cookie à exporter');

    const { publicKey } = await api.myPubKey();
    if (!publicKey) throw new Error('Aucune clé publique E2E sur votre compte. Activez le chiffrement dans Profile > Chiffrement.');

    const encrypted = await encryptForDossier(publicKey, {
      platform: state.platform.id,
      capturedAt: new Date().toISOString(),
      tabUrl: state.tab?.url ?? null,
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

    await api.importCookies({
      dossierId,
      platform: state.platform.id,
      payload: encrypted,
      cookieCount: cookies.length,
    });

    await setLastDossierId(dossierId);
    setStatus('ok', `${cookies.length} cookies exportés`);
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    setStatus('err', err.message ?? 'Erreur');
    $('exportBtn').disabled = false;
  }
}

init().catch((err) => {
  setStatus('err', err.message);
  show('state-ready');
});
