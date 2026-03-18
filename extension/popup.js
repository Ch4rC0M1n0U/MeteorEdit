/**
 * MeteorEdit Cookie Bridge - Popup Script
 * Queries browser cookies for social media platforms and sends them to MeteorEdit server.
 */

const PLATFORMS = {
  youtube: {
    label: 'YouTube',
    icon: '\uD83C\uDFAC',
    domains: ['youtube.com', 'google.com', '.google.com'],
    authCookies: ['SID', 'SSID', 'HSID'],
  },
  instagram: {
    label: 'Instagram',
    icon: '\uD83D\uDCF7',
    domains: ['instagram.com', '.instagram.com'],
    authCookies: ['sessionid', 'ds_user_id'],
  },
  tiktok: {
    label: 'TikTok',
    icon: '\uD83C\uDFB5',
    domains: ['tiktok.com', '.tiktok.com'],
    authCookies: ['sessionid', 'sid_tt'],
  },
  snapchat: {
    label: 'Snapchat',
    icon: '\uD83D\uDC7B',
    domains: ['snapchat.com', '.snapchat.com'],
    authCookies: ['sc-a-session'],
  },
  facebook: {
    label: 'Facebook',
    icon: '\uD83D\uDCD8',
    domains: ['facebook.com', '.facebook.com'],
    authCookies: ['c_user', 'xs'],
  },
  x: {
    label: 'X / Twitter',
    icon: '\uD83D\uDC26',
    domains: ['x.com', '.x.com', 'twitter.com', '.twitter.com'],
    authCookies: ['auth_token', 'ct0'],
  },
  threads: {
    label: 'Threads',
    icon: '\uD83E\uDDF5',
    domains: ['threads.net', '.threads.net'],
    authCookies: ['sessionid'],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '\uD83D\uDCBC',
    domains: ['linkedin.com', '.linkedin.com'],
    authCookies: ['li_at'],
  },
  strava: {
    label: 'Strava',
    icon: '\uD83C\uDFC3',
    domains: ['strava.com', '.strava.com'],
    authCookies: ['_strava4_session'],
  },
};

let config = { serverUrl: '', bridgeToken: '' };
let platformData = {};

// ── Helpers ──

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => {
    toast.className = 'toast';
  }, 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Cookie Querying ──

async function getCookiesForDomain(domain) {
  return new Promise((resolve) => {
    const url = domain.startsWith('.') ? `https://${domain.slice(1)}` : `https://${domain}`;
    chrome.cookies.getAll({ url }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

async function queryPlatformCookies(platformKey) {
  const platform = PLATFORMS[platformKey];
  const allCookies = [];
  const seen = new Set();

  for (const domain of platform.domains) {
    const cookies = await getCookiesForDomain(domain);
    for (const cookie of cookies) {
      const key = `${cookie.domain}|${cookie.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        allCookies.push(cookie);
      }
    }
  }

  const hasAuth = platform.authCookies.some((name) =>
    allCookies.some((c) => c.name === name)
  );

  return { cookies: allCookies, hasAuth, count: allCookies.length };
}

// ── Server Communication ──

async function checkServerHealth() {
  try {
    const url = config.serverUrl.replace(/\/+$/, '');
    const resp = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.bridgeToken}` },
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function sendCookies(platformKey) {
  const data = platformData[platformKey];
  if (!data || !data.hasAuth) return;

  const url = config.serverUrl.replace(/\/+$/, '');
  const cookies = data.cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
  }));

  const resp = await fetch(`${url}/api/social/cookies/${platformKey}/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.bridgeToken}`,
    },
    body: JSON.stringify({ cookies }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Server returned ${resp.status}`);
  }

  return await resp.json();
}

// ── UI Rendering ──

function renderSetupMessage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <div class="header-left">
        <svg class="header-logo" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" stroke="#38bdf8" stroke-width="2" fill="#16213e"/>
          <path d="M8 14l3 3 9-9" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <span class="header-title">MeteorEdit Cookie Bridge</span>
      </div>
      <div class="status-dot offline" title="Not configured"></div>
    </div>
    <div class="setup-message">
      <div class="icon">\u2699\uFE0F</div>
      <h2>Configuration Required</h2>
      <p>Enter your MeteorEdit server URL and bridge token to get started.</p>
      <a href="#" id="open-options">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/></svg>
        Open Settings
      </a>
    </div>
    <div class="footer">
      <span class="footer-version">v1.0.0</span>
    </div>
  `;

  document.getElementById('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function renderPlatformList(serverOnline) {
  const app = document.getElementById('app');

  const platformsWithAuth = Object.keys(PLATFORMS).filter(
    (k) => platformData[k] && platformData[k].hasAuth
  );

  let platformsHtml = '';
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    const data = platformData[key] || { hasAuth: false, count: 0 };
    const statusClass = data.hasAuth ? 'found' : 'not-found';
    const statusText = data.hasAuth
      ? `Cookies found (${data.count})`
      : 'Not logged in';

    let btnHtml;
    if (data.hasAuth && serverOnline) {
      btnHtml = `<button class="btn-send active" data-platform="${key}">Send</button>`;
    } else if (data.hasAuth && !serverOnline) {
      btnHtml = `<button class="btn-send disabled" title="Server offline">Send</button>`;
    } else {
      btnHtml = `<button class="btn-send disabled">\u2014</button>`;
    }

    platformsHtml += `
      <div class="platform-item">
        <div class="platform-info">
          <span class="platform-icon">${platform.icon}</span>
          <div class="platform-details">
            <div class="platform-name">${escapeHtml(platform.label)}</div>
            <div class="platform-status ${statusClass}">
              <span class="dot"></span>
              ${escapeHtml(statusText)}
            </div>
          </div>
        </div>
        <div class="platform-actions">
          ${btnHtml}
        </div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="header">
      <div class="header-left">
        <svg class="header-logo" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" stroke="#38bdf8" stroke-width="2" fill="#16213e"/>
          <path d="M8 14l3 3 9-9" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <span class="header-title">MeteorEdit Cookie Bridge</span>
      </div>
      <div class="status-dot ${serverOnline ? 'online' : 'offline'}" title="${serverOnline ? 'Server connected' : 'Server unreachable'}"></div>
    </div>
    ${
      platformsWithAuth.length > 0
        ? `<div class="send-all-bar">
            <span class="count">${platformsWithAuth.length} platform${platformsWithAuth.length > 1 ? 's' : ''} with active sessions</span>
            <button class="btn-send-all" id="btn-send-all" ${!serverOnline ? 'disabled' : ''}>Send All</button>
          </div>`
        : ''
    }
    <div class="platform-list">
      ${platformsHtml}
    </div>
    <div class="footer">
      <a href="#" class="footer-link" id="open-options-footer">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z"/></svg>
        Options
      </a>
      <span class="footer-version">v1.0.0</span>
    </div>
  `;

  // Bind send buttons
  document.querySelectorAll('.btn-send.active').forEach((btn) => {
    btn.addEventListener('click', () => handleSend(btn));
  });

  // Bind send all
  const sendAllBtn = document.getElementById('btn-send-all');
  if (sendAllBtn) {
    sendAllBtn.addEventListener('click', handleSendAll);
  }

  // Bind options link
  document.getElementById('open-options-footer').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// ── Send Handlers ──

async function handleSend(btn) {
  const platformKey = btn.dataset.platform;
  if (!platformKey || btn.classList.contains('sending')) return;

  const originalText = btn.textContent;
  btn.textContent = '...';
  btn.className = 'btn-send sending';

  try {
    await sendCookies(platformKey);
    btn.textContent = '\u2713';
    btn.className = 'btn-send success';
    showToast(`${PLATFORMS[platformKey].label} cookies sent!`, 'success');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.className = 'btn-send active';
      btn.dataset.platform = platformKey;
    }, 2000);
  } catch (err) {
    btn.textContent = '\u2717';
    btn.className = 'btn-send error';
    showToast(`Error: ${err.message}`, 'error');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.className = 'btn-send active';
      btn.dataset.platform = platformKey;
    }, 2000);
  }
}

async function handleSendAll() {
  const btn = document.getElementById('btn-send-all');
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';

  const platformsWithAuth = Object.keys(PLATFORMS).filter(
    (k) => platformData[k] && platformData[k].hasAuth
  );

  let success = 0;
  let failed = 0;

  for (const key of platformsWithAuth) {
    try {
      await sendCookies(key);
      success++;
      // Update individual button
      const indBtn = document.querySelector(`.btn-send[data-platform="${key}"]`);
      if (indBtn) {
        indBtn.textContent = '\u2713';
        indBtn.className = 'btn-send success';
      }
    } catch {
      failed++;
      const indBtn = document.querySelector(`.btn-send[data-platform="${key}"]`);
      if (indBtn) {
        indBtn.textContent = '\u2717';
        indBtn.className = 'btn-send error';
      }
    }
  }

  if (failed === 0) {
    btn.textContent = `All sent! (${success})`;
    showToast(`${success} platform(s) sent successfully`, 'success');
  } else {
    btn.textContent = `${success} OK, ${failed} failed`;
    showToast(`${success} sent, ${failed} failed`, 'error');
  }

  setTimeout(() => {
    btn.textContent = 'Send All';
    btn.disabled = false;
    // Reset individual buttons
    document.querySelectorAll('.btn-send.success, .btn-send.error').forEach((b) => {
      if (b.dataset.platform) {
        b.textContent = 'Send';
        b.className = 'btn-send active';
      }
    });
  }, 3000);
}

// ── Init ──

async function init() {
  // Load config
  const stored = await chrome.storage.sync.get(['serverUrl', 'bridgeToken']);
  config.serverUrl = stored.serverUrl || '';
  config.bridgeToken = stored.bridgeToken || '';

  if (!config.serverUrl || !config.bridgeToken) {
    renderSetupMessage();
    return;
  }

  // Query all platform cookies in parallel
  const queries = Object.keys(PLATFORMS).map(async (key) => {
    platformData[key] = await queryPlatformCookies(key);
  });
  await Promise.all(queries);

  // Check server health
  const serverOnline = await checkServerHealth();

  // Render
  renderPlatformList(serverOnline);
}

document.addEventListener('DOMContentLoaded', init);
