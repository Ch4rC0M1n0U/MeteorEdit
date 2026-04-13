import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

const ZOOMEYE_API = 'https://api.zoomeye.ai';

async function getZoomEyeKey(): Promise<string | null> {
  const settings = await PluginSettings.findOne();
  return settings?.zoomeye?.apiKey || null;
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function zoomeyeFetch(url: string, apiKey: string, timeout = 10000): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { 'API-KEY': apiKey },
      signal: controller.signal,
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/zoomeye/status — check if ZoomEye is configured + account info */
export async function getZoomEyeStatus(req: AuthRequest, res: Response) {
  const key = await getZoomEyeKey();
  if (!key) return res.json({ available: false });

  try {
    const { ok, data } = await zoomeyeFetch(`${ZOOMEYE_API}/resources-info`, key, 5000);
    if (!ok) return res.json({ available: false });
    res.json({
      available: true,
      plan: data.plan || 'free',
      quota: {
        search: data.resources?.search || 0,
        stats: data.resources?.stats || 0,
        interval: data.resources?.interval || '',
      },
    });
  } catch {
    res.json({ available: false });
  }
}

/** POST /api/zoomeye/search — search hosts by location */
export async function zoomeyeSearch(req: AuthRequest, res: Response) {
  const key = await getZoomEyeKey();
  if (!key) return res.status(400).json({ message: 'ZoomEye API key not configured' });

  const { lat, lng, radius = 5, filters = '', page = 1 } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  // ZoomEye uses city/country or +after:date filters. Geo radius via "geo:lat,lng,radiuskm"
  // The geo filter is available in ZoomEye for host search
  const geoQuery = `geo:"${lat},${lng},${radius}km"`;
  const query = filters ? `${filters} +${geoQuery}` : geoQuery;
  const params = new URLSearchParams({ query, page: String(page) });

  try {
    const { ok, status, data } = await zoomeyeFetch(`${ZOOMEYE_API}/host/search?${params}`, key, 15000);
    if (!ok) {
      return res.status(status).json({ message: data?.message || 'ZoomEye search failed' });
    }

    await logActivity(req.user!.userId, 'zoomeye.search', 'system', null, { query, total: data.total }, getClientIp(req));

    const matches = (data.matches || []).map((m: any) => ({
      ip: m.ip,
      port: m.portinfo?.port || 0,
      transport: m.portinfo?.transport || 'tcp',
      product: m.portinfo?.product || null,
      version: m.portinfo?.version || null,
      os: m.portinfo?.os || null,
      banner: m.portinfo?.banner || '',
      location: {
        lat: m.geoinfo?.latitude || lat,
        lng: m.geoinfo?.longitude || lng,
        city: m.geoinfo?.city?.names?.en || '',
        country: m.geoinfo?.country?.names?.en || '',
        countryCode: m.geoinfo?.country?.code || '',
      },
      hostname: m.portinfo?.hostname || '',
      app: m.portinfo?.app || '',
      device: m.portinfo?.device || '',
      rdns: m.rdns || '',
      timestamp: m.timestamp || '',
    }));

    res.json({
      total: data.total || 0,
      matches,
      page,
    });
  } catch (err: any) {
    console.error('[ZoomEye] Search error:', err.message);
    res.status(502).json({ message: `ZoomEye search failed: ${err.message}` });
  }
}

/** GET /api/zoomeye/host/:ip — get host details */
export async function zoomeyeHostInfo(req: AuthRequest, res: Response) {
  const key = await getZoomEyeKey();
  if (!key) return res.status(400).json({ message: 'ZoomEye API key not configured' });

  const { ip } = req.params;
  try {
    const params = new URLSearchParams({ query: `ip:"${ip}"` });
    const { ok, status, data } = await zoomeyeFetch(`${ZOOMEYE_API}/host/search?${params}`, key, 10000);
    if (!ok) return res.status(status).json({ message: data?.message || 'Host not found' });

    const matches = data.matches || [];
    if (!matches.length) return res.status(404).json({ message: 'Host not found' });

    // Aggregate all services from matches
    const services = matches.map((m: any) => ({
      port: m.portinfo?.port || 0,
      transport: m.portinfo?.transport || 'tcp',
      product: m.portinfo?.product || '',
      version: m.portinfo?.version || '',
      banner: m.portinfo?.banner || '',
      app: m.portinfo?.app || '',
      device: m.portinfo?.device || '',
    }));

    const first = matches[0];
    res.json({
      ip,
      services,
      location: {
        lat: first.geoinfo?.latitude || 0,
        lng: first.geoinfo?.longitude || 0,
        city: first.geoinfo?.city?.names?.en || '',
        country: first.geoinfo?.country?.names?.en || '',
      },
      os: first.portinfo?.os || null,
      hostname: first.portinfo?.hostname || '',
    });
  } catch (err: any) {
    res.status(502).json({ message: `ZoomEye host lookup failed: ${err.message}` });
  }
}
