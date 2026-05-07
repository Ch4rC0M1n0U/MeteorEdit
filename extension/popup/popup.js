import { getConfig, setConfig, getBranding, getLastDossierId, setLastDossierId } from '../common/storage.js';
import { detectPlatform, getCookieDomains } from '../common/platforms.js';
import { filterAuthCookies } from '../common/cookieWhitelist.js';
import { api, ApiError } from '../common/api.js';
import { captureFullPage } from '../common/clipper.js';

const $ = (id) => document.getElementById(id);
const state = { platform: null, tab: null, dossiers: [] };

/* ============== Tab router ============== */
function activateTab(name) {
  document.querySelectorAll('.pop-tab').forEach((b) => {
    const active = b.dataset.tab === name;
    b.classList.toggle('pop-tab--active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.pop-pane').forEach((p) => {
    const active = p.dataset.pane === name;
    p.classList.toggle('pop-pane--active', active);
    p.hidden = !active;
  });
  if (name === 'clipper') initClipperTab();
  if (name === 'settings') initSettingsTab();
}

function showSession(id) {
  ['state-loading', 'state-config', 'state-auth', 'state-unsupported', 'state-ready']
    .forEach((s) => $(s).hidden = s !== id);
}

function setExportStatus(kind, text) {
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
    if (branding?.appName) $('brandName').textContent = `${branding.appName} Companion`;
    if (branding?.logoUrl) $('brandLogo').src = branding.logoUrl;
  } catch { /* ignore */ }
  $('extVer').textContent = chrome.runtime.getManifest().version;
}

/* ============== TAB SESSIONS ============== */
async function initSessionsTab() {
  const cfg = await getConfig();
  if (!cfg.apiUrl || !cfg.apiToken) { showSession('state-config'); return; }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  state.platform = detectPlatform(tab?.url ?? '');

  if (!state.platform) {
    $('currentHost').textContent = tab?.url ? new URL(tab.url).host : 'aucun onglet actif';
    showSession('state-unsupported');
    return;
  }

  $('platformIcon').textContent = state.platform.label.charAt(0);
  $('platformName').textContent = state.platform.label;

  try {
    await api.verify();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) { showSession('state-auth'); return; }
    setExportStatus('err', err.message);
  }

  try {
    const cookies = await collectAuthCookies(state.platform.id);
    $('platformMeta').textContent = `${cookies.length} cookies d'authentification détectés`;
    if (cookies.length === 0) {
      $('platformMeta').textContent = 'Aucune session active — connectez-vous d\'abord';
      $('exportBtn').disabled = true;
    }
  } catch {
    $('platformMeta').textContent = 'Erreur lecture cookies';
    $('exportBtn').disabled = true;
  }

  $('exportBtn').addEventListener('click', onExportSession);
  showSession('state-ready');
}

async function collectAuthCookies(platformId) {
  const domains = getCookieDomains(platformId);
  const all = [];
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    all.push(...cookies);
  }
  const seen = new Set();
  const uniq = all.filter((c) => {
    const key = `${c.name}|${c.domain}|${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return filterAuthCookies(platformId, uniq);
}

async function onExportSession() {
  $('exportBtn').disabled = true;
  setExportStatus('warn', 'Envoi en cours…');
  try {
    const cookies = await collectAuthCookies(state.platform.id);
    if (cookies.length === 0) throw new Error('Aucun cookie d\'authentification à exporter');
    await api.importCookies({
      platform: state.platform.id,
      cookies: cookies.map((c) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        expirationDate: c.expirationDate ?? null,
      })),
    });
    setExportStatus('ok', `${cookies.length} cookies envoyés. Session disponible côté MeteorEdit.`);
    setTimeout(() => window.close(), 1800);
  } catch (err) {
    setExportStatus('err', err.message ?? 'Erreur');
    $('exportBtn').disabled = false;
  }
}

/* ============== TAB CLIPPER ============== */
let clipperInitialized = false;

async function initClipperTab() {
  if (clipperInitialized) return;
  clipperInitialized = true;

  const cfg = await getConfig();
  if (!cfg.apiUrl || !cfg.apiToken) {
    $('clip-state-config').hidden = false;
    return;
  }
  $('clip-state-ready').hidden = false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    $('clipPageTitle').textContent = tab.title || '(sans titre)';
    $('clipPageUrl').textContent = tab.url || '';
  }

  try {
    const data = await api.listDossiers();
    state.dossiers = Array.isArray(data) ? data : (data?.dossiers ?? []);
    const sel = $('clipDossier');
    sel.innerHTML = '';
    if (state.dossiers.length === 0) {
      sel.innerHTML = '<option value="">— Aucun dossier compatible —</option>';
      // Hint to user: closed/encrypted dossiers are excluded server-side
      setClipStatus('warn', 'Aucun dossier ouvert et non-chiffré disponible. L\'extension ne peut pas déposer de notes dans les dossiers clôturés ou chiffrés E2E.');
    } else {
      sel.innerHTML = state.dossiers.map((d) =>
        `<option value="${d._id}">${escapeHtml(d.title)}</option>`
      ).join('');
      const last = await getLastDossierId();
      if (last && state.dossiers.find((d) => d._id === last)) sel.value = last;
    }
  } catch (err) {
    setClipStatus('err', `Impossible de charger les dossiers : ${err.message}`);
  }

  $('clipFullBtn').addEventListener('click', () => onClipFull());
  $('clipAreaBtn').addEventListener('click', () => onClipArea());
}

function setClipStatus(kind, text) {
  const el = $('clipStatus');
  el.className = `me-status me-status--${kind}`;
  el.textContent = text;
  el.style.display = 'inline-flex';
}

function setClipProgress(visible, pct = 0, text = 'Capture…') {
  $('clipProgress').hidden = !visible;
  $('clipProgressFill').style.width = `${Math.round(pct * 100)}%`;
  $('clipProgressText').textContent = text;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function onClipFull() {
  const dossierId = $('clipDossier').value;
  if (!dossierId) { setClipStatus('err', 'Sélectionnez un dossier'); return; }

  $('clipFullBtn').disabled = true;
  $('clipAreaBtn').disabled = true;
  setClipStatus('warn', 'Capture en cours…');
  setClipProgress(true, 0, 'Préparation…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Onglet introuvable');

    const png = await captureFullPage(tab.id, (pct, text) => setClipProgress(true, pct, text));
    setClipProgress(true, 1, 'Envoi à MeteorEdit…');

    const includeHtml = $('clipIncludeHtml').checked;
    let html = null;
    if (includeHtml) {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.documentElement.outerHTML,
        });
        html = result;
      } catch { /* ignore */ }
    }

    const result = await api.clip({
      dossierId,
      url: tab.url,
      title: tab.title || '',
      capturedAt: new Date().toISOString(),
      mode: 'full',
      screenshotBase64: png,
      html,
    });
    await setLastDossierId(dossierId);
    setClipProgress(false);
    setClipStatus('ok', `Note créée : ${result?.title ?? 'OK'}`);
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    setClipProgress(false);
    setClipStatus('err', err.message ?? 'Erreur de capture');
  } finally {
    $('clipFullBtn').disabled = false;
    $('clipAreaBtn').disabled = false;
  }
}

async function onClipArea() {
  const dossierId = $('clipDossier').value;
  if (!dossierId) { setClipStatus('err', 'Sélectionnez un dossier'); return; }

  setClipStatus('warn', 'Sélectionnez la zone dans la page (cliquez-glissez)…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Onglet introuvable');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['common/area-selector.js'],
    });
    const [{ result: rect }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__meteoreditAreaSelect(),
    });

    if (!rect || rect.cancelled) { setClipStatus('warn', 'Capture annulée'); setTimeout(() => window.close(), 800); return; }

    setClipStatus('warn', 'Capture de la zone…');
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
    const cropped = await cropDataUrl(dataUrl, rect);

    setClipStatus('warn', 'Envoi à MeteorEdit…');
    const result = await api.clip({
      dossierId,
      url: tab.url,
      title: tab.title || '',
      capturedAt: new Date().toISOString(),
      mode: 'area',
      screenshotBase64: cropped,
    });
    await setLastDossierId(dossierId);
    setClipStatus('ok', `Note créée : ${result?.title ?? 'OK'}`);
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    setClipStatus('err', err.message ?? 'Erreur de capture');
  }
}

async function cropDataUrl(dataUrl, rect) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const dpr = rect.dpr ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.w * dpr);
  canvas.height = Math.round(rect.h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    img,
    Math.round(rect.x * dpr), Math.round(rect.y * dpr),
    Math.round(rect.w * dpr), Math.round(rect.h * dpr),
    0, 0,
    canvas.width, canvas.height
  );
  return canvas.toDataURL('image/png');
}

/* ============== TAB SETTINGS ============== */
let settingsInitialized = false;

async function initSettingsTab() {
  if (settingsInitialized) return;
  settingsInitialized = true;

  const cfg = await getConfig();
  $('setApiUrl').value = cfg.apiUrl || '';
  $('setApiToken').value = cfg.apiToken || '';

  $('setSaveBtn').addEventListener('click', async () => {
    const apiUrl = $('setApiUrl').value.trim();
    const apiToken = $('setApiToken').value.trim();
    if (!apiUrl) { setSetStatus('err', 'URL requise'); return; }
    await setConfig({ apiUrl, apiToken });
    setSetStatus('ok', 'Réglages enregistrés');
    applyBranding();
  });

  $('setTestBtn').addEventListener('click', async () => {
    setSetStatus('warn', 'Test…');
    const apiUrl = $('setApiUrl').value.trim();
    const apiToken = $('setApiToken').value.trim();
    await setConfig({ apiUrl, apiToken });
    try {
      await api.verify();
      setSetStatus('ok', 'Connexion OK');
    } catch (err) {
      setSetStatus('err', `Échec : ${err.message}`);
    }
  });

  $('setOpenFullBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

function setSetStatus(kind, text) {
  const el = $('setStatus');
  el.className = `me-status me-status--${kind}`;
  el.textContent = text;
  el.style.display = 'inline-flex';
}

/* ============== Init ============== */
async function init() {
  await applyBranding();

  document.querySelectorAll('.pop-tab').forEach((b) =>
    b.addEventListener('click', () => activateTab(b.dataset.tab))
  );

  $('goSettingsBtn')?.addEventListener('click', () => activateTab('settings'));
  $('goSettingsBtn2')?.addEventListener('click', () => activateTab('settings'));
  $('optsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  await initSessionsTab();
}

init().catch((err) => {
  setExportStatus('err', err.message);
  showSession('state-ready');
});
