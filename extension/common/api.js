// Minimal API client used by popup & options.
import { getConfig } from './storage.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request(path, { method = 'GET', body, requireAuth = true } = {}) {
  const { apiUrl, apiToken } = await getConfig();
  if (!apiUrl) throw new ApiError('Configurez l\'URL de votre instance MeteorEdit dans les options.', 0);
  if (requireAuth && !apiToken) throw new ApiError('Aucun token API configuré. Générez-en un depuis Profile > Tokens API.', 0);

  const headers = { 'Content-Type': 'application/json' };
  if (requireAuth) headers['Authorization'] = `Bearer ${apiToken}`;

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(`Réseau injoignable : ${err.message}`, 0);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.message ?? detail;
    } catch { /* ignore */ }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  verify:        () => request('/api/extension/auth/verify'),
  branding:      () => request('/api/branding', { requireAuth: false }),
  importCookies: (payload) => request('/api/extension/cookies/import', { method: 'POST', body: payload }),
};

export { ApiError };
