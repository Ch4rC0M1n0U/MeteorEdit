import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

const CENSYS_API = 'https://search.censys.io/api';

async function getCensysKey(): Promise<string | null> {
  const settings = await PluginSettings.findOne();
  return settings?.censys?.apiKey || null;
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function censysFetch(url: string, apiKey: string, options: { method?: string; body?: any; timeout?: number } = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 10000);
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/censys/status — check if Censys is configured + account info */
export async function getCensysStatus(req: AuthRequest, res: Response) {
  const key = await getCensysKey();
  if (!key) return res.json({ available: false });

  try {
    const { ok, data } = await censysFetch(`${CENSYS_API}/v1/account`, key, { timeout: 5000 });
    if (!ok) return res.json({ available: false });
    res.json({
      available: true,
      email: data.email || '',
      quota: {
        used: data.quota?.used || 0,
        allowance: data.quota?.allowance || 0,
        remaining: (data.quota?.allowance || 0) - (data.quota?.used || 0),
        resets_at: data.quota?.resets_at || '',
      },
    });
  } catch {
    res.json({ available: false });
  }
}

/** POST /api/censys/search — search hosts by location */
export async function censysSearch(req: AuthRequest, res: Response) {
  const key = await getCensysKey();
  if (!key) return res.status(400).json({ message: 'Censys API key not configured' });

  const { lat, lng, radius = 5, filters = '', cursor } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  // Censys uses distance queries: services.location.coordinates within <radius>km of <lat>,<lng>
  const geoQuery = `services.location.coordinates: {"lat": ${lat}, "lon": ${lng}, "radius": "${radius}km"}`;
  const query = filters ? `(${filters}) AND ${geoQuery}` : geoQuery;

  try {
    const body: any = { q: query, per_page: 25 };
    if (cursor) body.cursor = cursor;

    const { ok, status, data } = await censysFetch(`${CENSYS_API}/v2/hosts/search`, key, {
      method: 'POST',
      body,
      timeout: 15000,
    });

    if (!ok) {
      return res.status(status).json({ message: data?.error || 'Censys search failed' });
    }

    await logActivity(req.user!.userId, 'censys.search', 'system', null, { query, total: data.result?.total }, getClientIp(req));

    const hits = (data.result?.hits || []).map((h: any) => {
      const loc = h.location?.coordinates || {};
      return {
        ip: h.ip,
        services: (h.services || []).map((s: any) => ({
          port: s.port,
          serviceName: s.service_name || '',
          transport: s.transport_protocol || 'tcp',
          certificate: s.tls?.certificates?.leaf?.subject?.common_name?.[0] || null,
        })),
        location: {
          lat: loc.latitude || lat,
          lng: loc.longitude || lng,
          city: h.location?.city || '',
          province: h.location?.province || '',
          country: h.location?.country || '',
          countryCode: h.location?.country_code || '',
        },
        autonomousSystem: {
          asn: h.autonomous_system?.asn || 0,
          name: h.autonomous_system?.name || '',
          bgpPrefix: h.autonomous_system?.bgp_prefix || '',
        },
        operatingSystem: h.operating_system?.product || null,
        lastUpdated: h.last_updated_at || '',
      };
    });

    res.json({
      total: data.result?.total || 0,
      matches: hits,
      cursor: data.result?.links?.next || null,
    });
  } catch (err: any) {
    console.error('[Censys] Search error:', err.message);
    res.status(502).json({ message: `Censys search failed: ${err.message}` });
  }
}

/** GET /api/censys/host/:ip — get host details */
export async function censysHostInfo(req: AuthRequest, res: Response) {
  const key = await getCensysKey();
  if (!key) return res.status(400).json({ message: 'Censys API key not configured' });

  const { ip } = req.params;
  try {
    const { ok, status, data } = await censysFetch(`${CENSYS_API}/v2/hosts/${ip}`, key, { timeout: 10000 });
    if (!ok) return res.status(status).json({ message: data?.error || 'Host not found' });

    const h = data.result || {};
    res.json({
      ip: h.ip,
      services: (h.services || []).map((s: any) => ({
        port: s.port,
        serviceName: s.service_name || '',
        transport: s.transport_protocol || 'tcp',
        banner: s.banner || '',
        certificate: s.tls?.certificates?.leaf?.subject?.common_name?.[0] || null,
        software: s.software?.map((sw: any) => `${sw.product || ''} ${sw.version || ''}`.trim()) || [],
      })),
      location: {
        lat: h.location?.coordinates?.latitude || 0,
        lng: h.location?.coordinates?.longitude || 0,
        city: h.location?.city || '',
        province: h.location?.province || '',
        country: h.location?.country || '',
        countryCode: h.location?.country_code || '',
      },
      autonomousSystem: {
        asn: h.autonomous_system?.asn || 0,
        name: h.autonomous_system?.name || '',
        bgpPrefix: h.autonomous_system?.bgp_prefix || '',
      },
      operatingSystem: h.operating_system?.product || null,
      lastUpdated: h.last_updated_at || '',
    });
  } catch (err: any) {
    res.status(502).json({ message: `Censys host lookup failed: ${err.message}` });
  }
}
