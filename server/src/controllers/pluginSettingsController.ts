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
  res.json(settings);
}

export async function updatePluginSettings(req: AuthRequest, res: Response) {
  const settings = await getOrCreate();
  const { mapbox } = req.body;
  if (mapbox) {
    if (mapbox.apiKey !== undefined) settings.mapbox.apiKey = mapbox.apiKey;
    if (mapbox.defaultStyle !== undefined) settings.mapbox.defaultStyle = mapbox.defaultStyle;
    if (mapbox.defaultCenter !== undefined) settings.mapbox.defaultCenter = mapbox.defaultCenter;
    if (mapbox.defaultZoom !== undefined) settings.mapbox.defaultZoom = mapbox.defaultZoom;
  }
  await settings.save();
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  await logActivity(req.user!.userId, 'settings.plugin_update', 'system', null, { plugin: 'mapbox' }, ip);
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
