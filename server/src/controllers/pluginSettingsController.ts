import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import { logActivity } from '../utils/activityLogger';

async function getOrCreate() {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});
  return settings;
}

export async function getPluginSettings(req: AuthRequest, res: Response) {
  const settings = await getOrCreate();
  const obj: any = settings.toObject();
  // Mask Claude API key (show only last 8 chars)
  if (obj.claude?.apiKey) {
    const key = obj.claude.apiKey;
    obj.claude.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.claude.hasKey = true;
  } else {
    if (!obj.claude) obj.claude = {};
    obj.claude.hasKey = false;
  }
  // Mask OpenAI API key
  if (obj.openai?.apiKey) {
    const key = obj.openai.apiKey;
    obj.openai.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.openai.hasKey = true;
  } else {
    if (!obj.openai) obj.openai = {};
    obj.openai.hasKey = false;
  }
  // Mask Shodan API key
  if (obj.shodan?.apiKey) {
    const key = obj.shodan.apiKey;
    obj.shodan.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.shodan.hasKey = true;
  } else {
    if (!obj.shodan) obj.shodan = {};
    obj.shodan.hasKey = false;
  }
  // Mask Telegago (Google CSE) API key
  if (obj.telegago?.apiKey) {
    const key = obj.telegago.apiKey;
    obj.telegago.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.telegago.hasKey = true;
  } else {
    if (!obj.telegago) obj.telegago = {};
    obj.telegago.hasKey = false;
  }
  // Mask Censys API credentials
  if (obj.censys?.apiId) {
    const id = obj.censys.apiId;
    obj.censys.apiId = id.length > 8 ? '•'.repeat(id.length - 8) + id.slice(-8) : id;
    obj.censys.hasKey = true;
  } else {
    if (!obj.censys) obj.censys = {};
    obj.censys.hasKey = false;
  }
  if (obj.censys?.apiSecret) {
    const sec = obj.censys.apiSecret;
    obj.censys.apiSecret = sec.length > 8 ? '•'.repeat(sec.length - 8) + sec.slice(-8) : sec;
  }
  // Mask ZoomEye API key
  if (obj.zoomeye?.apiKey) {
    const key = obj.zoomeye.apiKey;
    obj.zoomeye.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.zoomeye.hasKey = true;
  } else {
    if (!obj.zoomeye) obj.zoomeye = {};
    obj.zoomeye.hasKey = false;
  }
  // Mask BinaryEdge API key
  if (obj.binaryedge?.apiKey) {
    const key = obj.binaryedge.apiKey;
    obj.binaryedge.apiKey = key.length > 8 ? '•'.repeat(key.length - 8) + key.slice(-8) : key;
    obj.binaryedge.hasKey = true;
  } else {
    if (!obj.binaryedge) obj.binaryedge = {};
    obj.binaryedge.hasKey = false;
  }
  res.json(obj);
}

export async function updatePluginSettings(req: AuthRequest, res: Response) {
  const settings = await getOrCreate();
  const { mapbox, shodan, telegago, censys, zoomeye, binaryedge } = req.body;
  const updatedPlugins: string[] = [];

  if (mapbox) {
    if (mapbox.apiKey !== undefined) settings.mapbox.apiKey = mapbox.apiKey;
    if (mapbox.defaultStyle !== undefined) settings.mapbox.defaultStyle = mapbox.defaultStyle;
    if (mapbox.defaultCenter !== undefined) settings.mapbox.defaultCenter = mapbox.defaultCenter;
    if (mapbox.defaultZoom !== undefined) settings.mapbox.defaultZoom = mapbox.defaultZoom;
    updatedPlugins.push('mapbox');
  }

  if (shodan) {
    if (shodan.apiKey !== undefined) settings.shodan.apiKey = shodan.apiKey;
    if (shodan.enabled !== undefined) settings.shodan.enabled = shodan.enabled;
    updatedPlugins.push('shodan');
  }

  if (telegago) {
    if (telegago.apiKey !== undefined) settings.telegago.apiKey = telegago.apiKey;
    if (telegago.enabled !== undefined) settings.telegago.enabled = telegago.enabled;
    updatedPlugins.push('telegago');
  }

  if (censys) {
    if (censys.apiId !== undefined) settings.censys.apiId = censys.apiId;
    if (censys.apiSecret !== undefined) settings.censys.apiSecret = censys.apiSecret;
    if (censys.enabled !== undefined) settings.censys.enabled = censys.enabled;
    updatedPlugins.push('censys');
  }

  if (zoomeye) {
    if (zoomeye.apiKey !== undefined) settings.zoomeye.apiKey = zoomeye.apiKey;
    if (zoomeye.enabled !== undefined) settings.zoomeye.enabled = zoomeye.enabled;
    updatedPlugins.push('zoomeye');
  }

  if (binaryedge) {
    if (binaryedge.apiKey !== undefined) settings.binaryedge.apiKey = binaryedge.apiKey;
    if (binaryedge.enabled !== undefined) settings.binaryedge.enabled = binaryedge.enabled;
    updatedPlugins.push('binaryedge');
  }

  await settings.save();
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  await logActivity(req.user!.userId, 'settings.plugin_update', 'system', null, { plugins: updatedPlugins }, ip);
  res.json(settings);
}

// Public route: returns only the mapbox token (no admin required)
export async function getMapboxToken(_req: AuthRequest, res: Response) {
  const settings = await getOrCreate();
  res.json({
    apiKey: settings.mapbox.apiKey,
    defaultStyle: settings.mapbox.defaultStyle,
    defaultCenter: settings.mapbox.defaultCenter,
    defaultZoom: settings.mapbox.defaultZoom,
  });
}
