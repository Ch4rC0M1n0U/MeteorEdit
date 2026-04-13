import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

const ONYPHE_API = 'https://search.onyphe.io/api/v2';

async function getOnypheKey(): Promise<string | null> {
  const settings = await PluginSettings.findOne();
  return settings?.onyphe?.apiKey || null;
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function onypheFetch(url: string, apiKey: string, timeout = 10000): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `apikey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/onyphe/status — check if Onyphe is configured + account info */
export async function getOnypheStatus(req: AuthRequest, res: Response) {
  const key = await getOnypheKey();
  if (!key) return res.json({ available: false });

  try {
    const { ok, data } = await onypheFetch(`${ONYPHE_API}/user`, key, 5000);
    if (!ok) return res.json({ available: false });
    res.json({
      available: true,
      plan: data.results?.[0]?.plan || 'free',
      quota: {
        used: data.results?.[0]?.used || 0,
        remaining: data.results?.[0]?.remaining || 0,
        total: data.results?.[0]?.total || 0,
      },
    });
  } catch {
    res.json({ available: false });
  }
}

/** POST /api/onyphe/search — search by geographic location */
export async function onypheSearch(req: AuthRequest, res: Response) {
  const key = await getOnypheKey();
  if (!key) return res.status(400).json({ message: 'Onyphe API key not configured' });

  const { lat, lng, radius = 5, filters = '', page = 1 } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  // Onyphe uses geolocation search: /simple/geoloc/{lat},{lng},{radius}
  const geoQuery = `${lat},${lng},${radius}`;
  const baseUrl = filters
    ? `${ONYPHE_API}/search/category:inetnum+geoloc:${geoQuery}+${encodeURIComponent(filters)}?page=${page}`
    : `${ONYPHE_API}/simple/geoloc/${geoQuery}?page=${page}`;

  try {
    const { ok, status, data } = await onypheFetch(baseUrl, key, 15000);
    if (!ok) {
      return res.status(status).json({ message: data?.message || 'Onyphe search failed' });
    }

    await logActivity(req.user!.userId, 'onyphe.search', 'system', null, { query: geoQuery, total: data.total }, getClientIp(req));

    const matches = (data.results || []).map((r: any) => ({
      ip: r.ip || '',
      port: r.port ? Number(r.port) : 0,
      transport: r.transport || 'tcp',
      product: r.productname || r.product || null,
      version: r.productversion || null,
      os: r.osdistribution || r.os || null,
      organization: r.organization || null,
      asn: r.asn || '',
      location: {
        lat: r.latitude ? Number(r.latitude) : lat,
        lng: r.longitude ? Number(r.longitude) : lng,
        city: r.city || '',
        country: r.country || '',
        countryCode: r.country_code || '',
      },
      hostname: r.hostname || r.reverse || '',
      domain: r.domain || '',
      protocol: r.protocol || '',
      tag: r.tag || [],
      timestamp: r['@timestamp'] || '',
    }));

    res.json({
      total: data.total || 0,
      matches,
      page,
      maxPage: data.max_page || 1,
    });
  } catch (err: any) {
    console.error('[Onyphe] Search error:', err.message);
    res.status(502).json({ message: `Onyphe search failed: ${err.message}` });
  }
}

/** GET /api/onyphe/host/:ip — get host summary */
export async function onypheHostInfo(req: AuthRequest, res: Response) {
  const key = await getOnypheKey();
  if (!key) return res.status(400).json({ message: 'Onyphe API key not configured' });

  const { ip } = req.params;
  try {
    const { ok, status, data } = await onypheFetch(`${ONYPHE_API}/summary/ip/${ip}`, key, 10000);
    if (!ok) return res.status(status).json({ message: data?.message || 'Host not found' });

    const results = data.results || [];
    const services = results
      .filter((r: any) => r.port)
      .map((r: any) => ({
        port: Number(r.port),
        transport: r.transport || 'tcp',
        product: r.productname || r.product || '',
        version: r.productversion || '',
        protocol: r.protocol || '',
        banner: r.data || '',
      }));

    const first = results[0] || {};
    res.json({
      ip,
      services,
      location: {
        lat: first.latitude ? Number(first.latitude) : 0,
        lng: first.longitude ? Number(first.longitude) : 0,
        city: first.city || '',
        country: first.country || '',
      },
      organization: first.organization || '',
      asn: first.asn || '',
      os: first.osdistribution || first.os || null,
      domains: [...new Set(results.map((r: any) => r.domain).filter(Boolean))],
      hostnames: [...new Set(results.map((r: any) => r.hostname || r.reverse).filter(Boolean))],
    });
  } catch (err: any) {
    res.status(502).json({ message: `Onyphe host lookup failed: ${err.message}` });
  }
}
