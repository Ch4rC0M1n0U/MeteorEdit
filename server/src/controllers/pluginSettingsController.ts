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
  res.json(obj);
}

export async function updatePluginSettings(req: AuthRequest, res: Response) {
  const settings = await getOrCreate();
  const { mapbox, shodan } = req.body;
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
