import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

const BINARYEDGE_API = 'https://api.binaryedge.io/v2';

async function getBinaryEdgeKey(): Promise<string | null> {
  const settings = await PluginSettings.findOne();
  return settings?.binaryedge?.apiKey || null;
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function beFetch(url: string, apiKey: string, timeout = 10000): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { 'X-Key': apiKey },
      signal: controller.signal,
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/binaryedge/status — check if BinaryEdge is configured + subscription info */
export async function getBinaryEdgeStatus(req: AuthRequest, res: Response) {
  const key = await getBinaryEdgeKey();
  if (!key) return res.json({ available: false });

  try {
    const { ok, data } = await beFetch(`${BINARYEDGE_API}/user/subscription`, key, 5000);
    if (!ok) return res.json({ available: false });
    res.json({
      available: true,
      plan: data.subscription?.name || 'free',
      quota: {
        used: data.requests_left != null ? (data.requests_plan || 0) - data.requests_left : 0,
        remaining: data.requests_left || 0,
        total: data.requests_plan || 0,
      },
    });
  } catch {
    res.json({ available: false });
  }
}

/** POST /api/binaryedge/search — search hosts by query */
export async function binaryedgeSearch(req: AuthRequest, res: Response) {
  const key = await getBinaryEdgeKey();
  if (!key) return res.status(400).json({ message: 'BinaryEdge API key not configured' });

  const { lat, lng, radius = 5, filters = '', page = 1 } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  // BinaryEdge uses ip.location.gps queries
  // Geo filter: "geo_distance_range:lat,lng,radius"
  const geoQuery = `geo_distance_range:"${radius}km","${lat},${lng}"`;
  const query = filters ? `${filters} ${geoQuery}` : geoQuery;
  const params = new URLSearchParams({ query, page: String(page), pagesize: '20' });

  try {
    const { ok, status, data } = await beFetch(`${BINARYEDGE_API}/query/search?${params}`, key, 15000);
    if (!ok) {
      return res.status(status).json({ message: data?.message || 'BinaryEdge search failed' });
    }

    await logActivity(req.user!.userId, 'binaryedge.search', 'system', null, { query, total: data.total }, getClientIp(req));

    const matches = (data.events || []).map((e: any) => {
      const target = e.target || {};
      const result = (e.result?.data || [])[0] || {};
      const location = result.state?.location || target.location || {};
      return {
        ip: target.ip || '',
        port: target.port || 0,
        transport: target.protocol || 'tcp',
        product: result.service?.product || null,
        version: result.service?.version || null,
        banner: result.service?.banner || '',
        cpe: result.service?.cpe || [],
        location: {
          lat: location.latitude || lat,
          lng: location.longitude || lng,
          city: location.city || '',
          country: location.country || '',
          countryCode: location.country_code || '',
        },
        hostname: result.hostnames?.[0] || '',
        os: result.state?.os || null,
        timestamp: e.origin?.ts || '',
      };
    });

    res.json({
      total: data.total || 0,
      matches,
      page,
      pagesize: data.pagesize || 20,
    });
  } catch (err: any) {
    console.error('[BinaryEdge] Search error:', err.message);
    res.status(502).json({ message: `BinaryEdge search failed: ${err.message}` });
  }
}

/** GET /api/binaryedge/host/:ip — get host details */
export async function binaryedgeHostInfo(req: AuthRequest, res: Response) {
  const key = await getBinaryEdgeKey();
  if (!key) return res.status(400).json({ message: 'BinaryEdge API key not configured' });

  const { ip } = req.params;
  try {
    const { ok, status, data } = await beFetch(`${BINARYEDGE_API}/query/ip/${ip}`, key, 10000);
    if (!ok) return res.status(status).json({ message: data?.message || 'Host not found' });

    const events = data.events || [];
    const services = events.map((e: any) => {
      const result = (e.results || [])[0] || {};
      return {
        port: e.port || 0,
        transport: e.protocol || 'tcp',
        product: result.service?.product || '',
        version: result.service?.version || '',
        banner: result.service?.banner || '',
        module: result.origin?.module || '',
      };
    });

    res.json({
      ip: data.query || ip,
      total: data.total || 0,
      services,
    });
  } catch (err: any) {
    res.status(502).json({ message: `BinaryEdge host lookup failed: ${err.message}` });
  }
}
