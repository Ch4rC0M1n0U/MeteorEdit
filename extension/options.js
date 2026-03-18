/**
 * MeteorEdit Cookie Bridge - Options Script
 * Manages extension configuration: server URL and bridge token.
 */

const serverUrlInput = document.getElementById('server-url');
const bridgeTokenInput = document.getElementById('bridge-token');
const btnSave = document.getElementById('btn-save');
const btnClear = document.getElementById('btn-clear');
const statusMsg = document.getElementById('status-msg');
const autoConfigBanner = document.getElementById('auto-config-banner');

// ── Helpers ──

function showStatus(message, type = 'info') {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg show ${type}`;
}

function hideStatus() {
  statusMsg.className = 'status-msg';
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}

// ── Test Connection ──

async function testConnection(serverUrl, bridgeToken) {
  const url = normalizeUrl(serverUrl);
  const resp = await fetch(`${url}/api/health`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bridgeToken}` },
    signal: AbortSignal.timeout(8000),
  });
  return resp.ok;
}

// ── Save Config ──

async function saveConfig() {
  const serverUrl = serverUrlInput.value.trim();
  const bridgeToken = bridgeTokenInput.value.trim();

  if (!serverUrl) {
    showStatus('Please enter a server URL.', 'error');
    serverUrlInput.focus();
    return;
  }

  if (!bridgeToken) {
    showStatus('Please enter a bridge token.', 'error');
    bridgeTokenInput.focus();
    return;
  }

  // Validate URL format
  try {
    new URL(serverUrl);
  } catch {
    showStatus('Invalid URL format. Include the protocol (https://).', 'error');
    serverUrlInput.focus();
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Testing...';
  hideStatus();

  try {
    // Save to storage first
    await chrome.storage.sync.set({
      serverUrl: normalizeUrl(serverUrl),
      bridgeToken,
    });

    // Test connection
    const online = await testConnection(serverUrl, bridgeToken);
    if (online) {
      showStatus('Configuration saved. Server connection successful!', 'success');
    } else {
      showStatus('Configuration saved, but server returned an error. Check your URL and token.', 'error');
    }
  } catch (err) {
    // Still saved, but connection failed
    showStatus(`Configuration saved, but connection test failed: ${err.message}`, 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Save & Test Connection';
  }
}

// ── Clear Config ──

async function clearConfig() {
  await chrome.storage.sync.remove(['serverUrl', 'bridgeToken']);
  serverUrlInput.value = '';
  bridgeTokenInput.value = '';
  showStatus('Configuration cleared.', 'info');
}

// ── Load Saved Config ──

async function loadConfig() {
  const stored = await chrome.storage.sync.get(['serverUrl', 'bridgeToken']);
  if (stored.serverUrl) serverUrlInput.value = stored.serverUrl;
  if (stored.bridgeToken) bridgeTokenInput.value = stored.bridgeToken;
}

// ── Auto-Config from URL Params ──

async function checkAutoConfig() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url');
  const token = params.get('token');

  if (url && token) {
    serverUrlInput.value = normalizeUrl(url);
    bridgeTokenInput.value = token;

    // Auto-save
    await chrome.storage.sync.set({
      serverUrl: normalizeUrl(url),
      bridgeToken: token,
    });

    autoConfigBanner.classList.remove('hidden');

    // Test connection
    try {
      const online = await testConnection(url, token);
      if (online) {
        showStatus('Auto-configured successfully! Server is reachable.', 'success');
      } else {
        showStatus('Auto-configured, but server returned an error. Verify your settings.', 'error');
      }
    } catch {
      showStatus('Auto-configured, but could not reach the server.', 'error');
    }
  }
}

// ── Event Listeners ──

btnSave.addEventListener('click', saveConfig);
btnClear.addEventListener('click', clearConfig);

// Save on Enter key in inputs
serverUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') bridgeTokenInput.focus();
});
bridgeTokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveConfig();
});

// ── Init ──

async function init() {
  await loadConfig();
  await checkAutoConfig();
}

document.addEventListener('DOMContentLoaded', init);
