import { getConfig, setConfig, setBranding, getBranding } from '../common/storage.js';
import { api, ApiError } from '../common/api.js';

const $ = (id) => document.getElementById(id);

async function init() {
  const cfg = await getConfig();
  $('apiUrl').value = cfg.apiUrl || '';
  $('apiToken').value = cfg.apiToken || '';

  const branding = await getBranding();
  if (branding?.appName) $('brandName').textContent = branding.appName;
  if (branding?.logoUrl) $('brandLogo').src = branding.logoUrl;

  $('saveBtn').addEventListener('click', onSave);
  $('testBtn').addEventListener('click', onTest);
}

function showStatus(kind, text) {
  const el = $('status');
  el.className = `me-status me-status--${kind}`;
  el.textContent = text;
  el.style.display = 'inline-flex';
}

function hideStatus() {
  $('status').style.display = 'none';
}

async function onSave() {
  hideStatus();
  const apiUrl = $('apiUrl').value.trim().replace(/\/$/, '');
  const apiToken = $('apiToken').value.trim();
  if (!/^https?:\/\//i.test(apiUrl)) {
    showStatus('err', "URL invalide (doit commencer par https://)");
    return;
  }
  await setConfig({ apiUrl, apiToken });
  showStatus('ok', 'Enregistré');
  setTimeout(hideStatus, 2000);
}

async function onTest() {
  hideStatus();
  await onSave(); // ensure latest values are persisted
  hideStatus();
  showStatus('warn', 'Test en cours…');
  try {
    const res = await api.verify();
    if (res?.ok) {
      showStatus('ok', `Connecté en tant que ${res.user?.email ?? 'utilisateur'}`);
      try {
        const branding = await api.branding();
        await setBranding({ appName: branding?.appName, logoUrl: branding?.logoUrl });
        if (branding?.appName) $('brandName').textContent = branding.appName;
        if (branding?.logoUrl) $('brandLogo').src = branding.logoUrl;
      } catch { /* branding optional */ }
    } else {
      showStatus('err', 'Réponse inattendue du serveur');
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      showStatus('err', 'Token API invalide ou révoqué');
    } else {
      showStatus('err', err.message || 'Connexion impossible');
    }
  }
}

init();
