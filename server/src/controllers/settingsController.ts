import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';
import { setMaintenanceState } from '../middleware/maintenance';
import { logActivity } from '../utils/activityLogger';

export async function getBranding(_req: Request, res: Response): Promise<void> {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const update: Record<string, any> = {};
    const { body } = req;

    // Branding
    if (typeof body.appName === 'string') update.appName = body.appName.trim() || 'MeteorEdit';
    if (typeof body.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)) update.accentColor = body.accentColor;
    if (typeof body.loginMessage === 'string') update.loginMessage = body.loginMessage;

    // Security toggles
    const boolFields = ['require2FA', 'maintenanceMode', 'registrationEnabled', 'passwordRequireUppercase', 'passwordRequireNumber', 'passwordRequireSpecial'];
    for (const field of boolFields) {
      if (typeof body[field] === 'boolean') update[field] = body[field];
    }

    // String fields
    if (typeof body.maintenanceMessage === 'string') update.maintenanceMessage = body.maintenanceMessage;

    // Numeric fields with validation
    const numFields: Record<string, { min: number; max: number }> = {
      sessionTimeoutMinutes: { min: 5, max: 43200 },
      passwordMinLength: { min: 4, max: 128 },
      maxLoginAttempts: { min: 0, max: 100 },
      lockoutDurationMinutes: { min: 1, max: 1440 },
    };
    for (const [field, range] of Object.entries(numFields)) {
      if (typeof body[field] === 'number') {
        update[field] = Math.max(range.min, Math.min(range.max, Math.round(body[field])));
      }
    }

    const settings = await SiteSettings.findOneAndUpdate({}, update, { new: true, upsert: true });

    // Sync in-memory maintenance state
    if ('maintenanceMode' in update || 'maintenanceMessage' in update) {
      setMaintenanceState(!!settings?.maintenanceMode, settings?.maintenanceMessage);
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const changedKeys = Object.keys(update);
    if (changedKeys.some(k => ['maintenanceMode', 'maintenanceMessage'].includes(k))) {
      await logActivity(req.user!.userId, update.maintenanceMode ? 'settings.maintenance_on' : 'settings.maintenance_off', 'system', null, { maintenanceMode: update.maintenanceMode }, ip);
    }
    if (changedKeys.some(k => ['require2FA', 'registrationEnabled', 'sessionTimeoutMinutes', 'passwordMinLength', 'passwordRequireUppercase', 'passwordRequireNumber', 'passwordRequireSpecial', 'maxLoginAttempts', 'lockoutDurationMinutes'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.security_update', 'system', null, { fields: changedKeys.filter(k => !['appName', 'accentColor', 'loginMessage'].includes(k)) }, ip);
    }
    if (changedKeys.some(k => ['appName', 'accentColor', 'loginMessage'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.branding_update', 'system', null, { fields: changedKeys.filter(k => ['appName', 'accentColor', 'loginMessage'].includes(k)) }, ip);
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

function deleteFileIfExists(filePath: string | null) {
  if (!filePath) return;
  const full = path.join(__dirname, '..', '..', filePath);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
}

export async function uploadLogo(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const settings = await SiteSettings.findOne();
    if (settings?.logoPath) {
      deleteFileIfExists(settings.logoPath);
    }
    const logoPath = `uploads/${req.file.filename}`;
    const updated = await SiteSettings.findOneAndUpdate({}, { logoPath }, { new: true, upsert: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.logo_upload', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteLogo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings?.logoPath) {
      deleteFileIfExists(settings.logoPath);
    }
    const updated = await SiteSettings.findOneAndUpdate({}, { logoPath: null }, { new: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.logo_delete', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadFavicon(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const settings = await SiteSettings.findOne();
    if (settings?.faviconPath) {
      deleteFileIfExists(settings.faviconPath);
    }
    const faviconPath = `uploads/${req.file.filename}`;
    const updated = await SiteSettings.findOneAndUpdate({}, { faviconPath }, { new: true, upsert: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.favicon_upload', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteFavicon(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings?.faviconPath) {
      deleteFileIfExists(settings.faviconPath);
    }
    const updated = await SiteSettings.findOneAndUpdate({}, { faviconPath: null }, { new: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.favicon_delete', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadLoginBackground(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const settings = await SiteSettings.findOne();
    if (settings?.loginBackgroundPath) {
      deleteFileIfExists(settings.loginBackgroundPath);
    }
    const loginBackgroundPath = `uploads/${req.file.filename}`;
    const updated = await SiteSettings.findOneAndUpdate({}, { loginBackgroundPath }, { new: true, upsert: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.login_background_upload', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteLoginBackground(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings?.loginBackgroundPath) {
      deleteFileIfExists(settings.loginBackgroundPath);
    }
    const updated = await SiteSettings.findOneAndUpdate({}, { loginBackgroundPath: null }, { new: true });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.login_background_delete', 'system', null, {}, ip);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
