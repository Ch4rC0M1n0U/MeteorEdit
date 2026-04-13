import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

const SHODAN_API = 'https://api.shodan.io';

async function getShodanKey(): Promise<string | null> {
  const settings = await PluginSettings.findOne();
  return settings?.shodan?.apiKey || null;
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function shodanFetch(url: string, timeout = 10000): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/shodan/status — check if Shodan is configured + account info */
export async function getShodanStatus(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.json({ available: false });

  try {
    const { ok, data } = await shodanFetch(`${SHODAN_API}/api-info?key=${key}`, 5000);
    if (!ok) return res.json({ available: false });
    res.json({
      available: true,
      plan: data.plan,
      queryCredits: data.query_credits,
      scanCredits: data.scan_credits,
    });
  } catch {
    res.json({ available: false });
  }
}

/** POST /api/shodan/search — geographic device search */
export async function shodanSearch(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.status(400).json({ message: 'Shodan API key not configured' });

  const { lat, lng, radius = 5, filters = '', page = 1 } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  const geoFilter = `geo:${lat},${lng},${radius}`;
  const query = filters ? `${filters} ${geoFilter}` : geoFilter;
  const params = new URLSearchParams({ key, query, page: String(page) });

  try {
    const { ok, status, data } = await shodanFetch(`${SHODAN_API}/shodan/host/search?${params}`, 15000);
    if (!ok) {
      return res.status(status).json({ message: data?.error || 'Shodan search failed' });
    }

    await logActivity(req.user!.userId, 'shodan.search', 'system', null, { query, total: data.total }, getClientIp(req));

    res.json({
      total: data.total,
      matches: (data.matches || []).map((m: any) => ({
        ip: m.ip_str,
        port: m.port,
        transport: m.transport,
        product: m.product || null,
        version: m.version || null,
        os: m.os || null,
        org: m.org || null,
        isp: m.isp || null,
        hostnames: m.hostnames || [],
        domains: m.domains || [],
        location: {
          lat: m.location?.latitude,
          lng: m.location?.longitude,
          city: m.location?.city,
          country: m.location?.country_name,
          countryCode: m.location?.country_code,
        },
        banner: (m.data || '').substring(0, 500),
        timestamp: m.timestamp,
        hasScreenshot: !!m.opts?.screenshot,
        screenshotUrl: m.opts?.screenshot ? `https://www.shodan.io/host/${m.ip_str}` : null,
        vulns: m.vulns ? Object.keys(m.vulns) : [],
        tags: m.tags || [],
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Shodan search failed' });
  }
}

/** GET /api/shodan/host/:ip — detailed host info */
export async function shodanHostInfo(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.status(400).json({ message: 'Shodan API key not configured' });

  const { ip } = req.params;
  const params = new URLSearchParams({ key });

  try {
    const { ok, status, data } = await shodanFetch(`${SHODAN_API}/shodan/host/${ip}?${params}`);
    if (!ok) {
      return res.status(status).json({ message: data?.error || 'Shodan host lookup failed' });
    }

    await logActivity(req.user!.userId, 'shodan.host_lookup', 'system', null, { targetIp: ip }, getClientIp(req));

    res.json({
      ip: data.ip_str,
      hostnames: data.hostnames || [],
      org: data.org,
      os: data.os,
      isp: data.isp,
      ports: data.ports || [],
      vulns: data.vulns || [],
      location: {
        lat: data.latitude,
        lng: data.longitude,
        city: data.city,
        country: data.country_name,
      },
      lastUpdate: data.last_update,
      services: (data.data || []).map((s: any) => ({
        port: s.port,
        transport: s.transport,
        product: s.product,
        version: s.version,
        banner: (s.data || '').substring(0, 1000),
        module: s._shodan?.module,
        hasScreenshot: !!s.opts?.screenshot,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Shodan host lookup failed' });
  }
}

/** GET /api/shodan/dns/resolve?hostnames=example.com,test.com — resolve hostnames to IPs */
export async function shodanDnsResolve(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.status(400).json({ message: 'Shodan API key not configured' });

  const { hostnames } = req.query;
  if (!hostnames || typeof hostnames !== 'string') {
    return res.status(400).json({ message: 'hostnames query parameter required' });
  }

  const params = new URLSearchParams({ key, hostnames });

  try {
    const { ok, status, data } = await shodanFetch(`${SHODAN_API}/dns/resolve?${params}`);
    if (!ok) return res.status(status).json({ message: data?.error || 'DNS resolve failed' });

    await logActivity(req.user!.userId, 'shodan.dns_resolve', 'system', null, { hostnames }, getClientIp(req));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'DNS resolve failed' });
  }
}

/** GET /api/shodan/dns/reverse?ips=8.8.8.8,1.1.1.1 — reverse DNS lookup */
export async function shodanDnsReverse(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.status(400).json({ message: 'Shodan API key not configured' });

  const { ips } = req.query;
  if (!ips || typeof ips !== 'string') {
    return res.status(400).json({ message: 'ips query parameter required' });
  }

  const params = new URLSearchParams({ key, ips });

  try {
    const { ok, status, data } = await shodanFetch(`${SHODAN_API}/dns/reverse?${params}`);
    if (!ok) return res.status(status).json({ message: data?.error || 'Reverse DNS failed' });

    await logActivity(req.user!.userId, 'shodan.dns_reverse', 'system', null, { ips }, getClientIp(req));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Reverse DNS failed' });
  }
}

/** GET /api/shodan/exploits?query=apache — search for known exploits/CVEs */
export async function shodanExploits(req: AuthRequest, res: Response) {
  const key = await getShodanKey();
  if (!key) return res.status(400).json({ message: 'Shodan API key not configured' });

  const { query, page = '1' } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'query parameter required' });
  }

  const params = new URLSearchParams({ key, query, page: String(page) });

  try {
    const { ok, status, data } = await shodanFetch(`https://exploits.shodan.io/api/search?${params}`);
    if (!ok) return res.status(status).json({ message: data?.error || 'Exploit search failed' });

    await logActivity(req.user!.userId, 'shodan.exploits_search', 'system', null, { query }, getClientIp(req));

    res.json({
      total: data.total || 0,
      matches: (data.matches || []).map((e: any) => ({
        id: e._id,
        description: e.description,
        source: e.source,
        code: e.code || null,
        date: e.date,
        cve: e.cve || [],
        platform: e.platform,
        type: e.type,
        port: e.port,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Exploit search failed' });
  }
}

/** GET /api/shodan/filters — return predefined filter presets */
export async function shodanFilters(_req: AuthRequest, res: Response) {
  res.json([
    { key: 'webcam', label: 'Webcams / IP Cameras', query: 'webcam has_screenshot:true', icon: 'mdi-cctv', color: '#ef4444' },
    { key: 'rtsp', label: 'RTSP Streams', query: 'port:554', icon: 'mdi-video', color: '#f97316' },
    { key: 'telnet', label: 'Telnet (IoT)', query: 'port:23', icon: 'mdi-console', color: '#eab308' },
    { key: 'scada', label: 'SCADA / ICS', query: 'port:502,47808', icon: 'mdi-factory', color: '#22c55e' },
    { key: 'rdp', label: 'RDP Open', query: 'port:3389 has_screenshot:true', icon: 'mdi-monitor', color: '#3b82f6' },
    { key: 'vnc', label: 'VNC Open', query: 'port:5900 has_screenshot:true', icon: 'mdi-remote-desktop', color: '#8b5cf6' },
    { key: 'printer', label: 'Printers', query: 'port:9100,515', icon: 'mdi-printer', color: '#ec4899' },
    { key: 'ftp', label: 'FTP Anonymous', query: 'port:21 "Anonymous user logged in"', icon: 'mdi-folder-network', color: '#14b8a6' },
    { key: 'mqtt', label: 'MQTT (IoT)', query: 'port:1883', icon: 'mdi-chip', color: '#6b7280' },
    { key: 'all', label: 'All Devices', query: '', icon: 'mdi-devices', color: '#9ca3af' },
  ]);
}
