import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';

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
    const { appName, accentColor, loginMessage } = req.body;
    const update: Record<string, any> = {};
    if (typeof appName === 'string') update.appName = appName.trim() || 'MeteorEdit';
    if (typeof accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(accentColor)) update.accentColor = accentColor;
    if (typeof loginMessage === 'string') update.loginMessage = loginMessage;
    if (typeof req.body.require2FA === 'boolean') update.require2FA = req.body.require2FA;

    const settings = await SiteSettings.findOneAndUpdate({}, update, { new: true, upsert: true });
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
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteLogo(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings?.logoPath) {
      deleteFileIfExists(settings.logoPath);
    }
    const updated = await SiteSettings.findOneAndUpdate({}, { logoPath: null }, { new: true });
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
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteFavicon(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings?.faviconPath) {
      deleteFileIfExists(settings.faviconPath);
    }
    const updated = await SiteSettings.findOneAndUpdate({}, { faviconPath: null }, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
