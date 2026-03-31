import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import nodemailer from 'nodemailer';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';
import { setMaintenanceState } from '../middleware/maintenance';
import { logActivity } from '../utils/activityLogger';

const execFileAsync = promisify(execFile);

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

export async function getSettings(_req: AuthRequest, res: Response): Promise<void> {
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
    const boolFields = ['require2FA', 'maintenanceMode', 'registrationEnabled', 'passwordRequireUppercase', 'passwordRequireNumber', 'passwordRequireSpecial', 'smtpSecure', 'announcementEnabled'];
    for (const field of boolFields) {
      if (typeof body[field] === 'boolean') update[field] = body[field];
    }

    // String fields
    const stringFields = ['maintenanceMessage', 'allowedFileTypes', 'smtpHost', 'smtpUser', 'smtpPass', 'smtpFrom', 'clipperUserAgent', 'clipperProxy', 'allowedOrigins', 'announcementMessage'];
    for (const field of stringFields) {
      if (typeof body[field] === 'string') update[field] = body[field];
    }

    // Announcement variant
    if (typeof body.announcementVariant === 'string' && ['info', 'warning', 'error'].includes(body.announcementVariant)) {
      update.announcementVariant = body.announcementVariant;
    }

    // Numeric fields with validation
    const numFields: Record<string, { min: number; max: number }> = {
      sessionTimeoutMinutes: { min: 5, max: 43200 },
      passwordMinLength: { min: 4, max: 128 },
      maxLoginAttempts: { min: 0, max: 100 },
      lockoutDurationMinutes: { min: 1, max: 1440 },
      maxFileSizeMB: { min: 1, max: 500 },
      smtpPort: { min: 1, max: 65535 },
      clipperTimeoutMs: { min: 5000, max: 120000 },
      clipperQuality: { min: 10, max: 100 },
      trashAutoDeleteDays: { min: 0, max: 365 },
    };
    for (const [field, range] of Object.entries(numFields)) {
      if (typeof body[field] === 'number') {
        update[field] = Math.max(range.min, Math.min(range.max, Math.round(body[field])));
      }
    }

    // Dossier duration alerts
    if (body.dossierAlerts) {
      const da = body.dossierAlerts;
      if (typeof da.routine === 'number') update['dossierAlerts.routine'] = da.routine;
      if (typeof da.priority === 'number') update['dossierAlerts.priority'] = da.priority;
      if (typeof da.urgent === 'number') update['dossierAlerts.urgent'] = da.urgent;
      if (typeof da.routineMessage === 'string') update['dossierAlerts.routineMessage'] = da.routineMessage;
      if (typeof da.priorityMessage === 'string') update['dossierAlerts.priorityMessage'] = da.priorityMessage;
      if (typeof da.urgentMessage === 'string') update['dossierAlerts.urgentMessage'] = da.urgentMessage;
    }

    // OSINT settings
    if (body.osint && typeof body.osint === 'object') {
      const o = body.osint;
      if (typeof o.maxVideoSize === 'number') update['osint.maxVideoSize'] = Math.max(50, Math.min(500, o.maxVideoSize));
      if (typeof o.maxConcurrentDownloads === 'number') update['osint.maxConcurrentDownloads'] = Math.max(1, Math.min(10, o.maxConcurrentDownloads));
      if (Array.isArray(o.enabledPlatforms)) update['osint.enabledPlatforms'] = o.enabledPlatforms.filter((p: any) => typeof p === 'string');
      if (typeof o.ytdlpPath === 'string') update['osint.ytdlpPath'] = o.ytdlpPath;
      if (typeof o.ffmpegPath === 'string') update['osint.ffmpegPath'] = o.ffmpegPath;
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
    if (changedKeys.some(k => ['maxFileSizeMB', 'allowedFileTypes'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.storage_update', 'system', null, { fields: changedKeys.filter(k => ['maxFileSizeMB', 'allowedFileTypes'].includes(k)) }, ip);
    }
    if (changedKeys.some(k => ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFrom', 'smtpSecure'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.email_update', 'system', null, { fields: changedKeys.filter(k => k.startsWith('smtp')).map(k => k === 'smtpPass' ? 'smtpPass (masked)' : k) }, ip);
    }
    if (changedKeys.some(k => ['clipperTimeoutMs', 'clipperQuality', 'clipperUserAgent', 'clipperProxy'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.clipper_update', 'system', null, { fields: changedKeys.filter(k => k.startsWith('clipper')) }, ip);
    }
    if (changedKeys.some(k => ['allowedOrigins'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.network_update', 'system', null, { allowedOrigins: update.allowedOrigins }, ip);
    }
    if (changedKeys.some(k => ['announcementEnabled', 'announcementMessage', 'announcementVariant'].includes(k))) {
      await logActivity(req.user!.userId, 'settings.announcement_update', 'system', null, { announcementEnabled: update.announcementEnabled }, ip);
    }
    if (changedKeys.some(k => k.startsWith('osint.'))) {
      await logActivity(req.user!.userId, 'settings.osint_update', 'system', null, { fields: changedKeys.filter(k => k.startsWith('osint.')) }, ip);
    }
    if (changedKeys.some(k => k.startsWith('dossierAlerts.'))) {
      await logActivity(req.user!.userId, 'settings.dossier_alerts_update', 'system', null, { fields: changedKeys.filter(k => k.startsWith('dossierAlerts.')) }, ip);
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
    const logoPath = `uploads/branding/${req.file.filename}`;
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
    const faviconPath = `uploads/branding/${req.file.filename}`;
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
    const loginBackgroundPath = `uploads/branding/${req.file.filename}`;
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

export async function testEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (!settings?.smtpHost || !settings?.smtpFrom) {
      res.status(400).json({ message: 'Configuration SMTP incomplete. Veuillez renseigner le serveur et l\'expediteur.' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      auth: settings.smtpUser ? {
        user: settings.smtpUser,
        pass: settings.smtpPass || '',
      } : undefined,
    });

    await transporter.verify();
    await transporter.sendMail({
      from: settings.smtpFrom,
      to: settings.smtpFrom,
      subject: `[${settings.appName || 'MeteorEdit'}] Test de connexion SMTP`,
      text: 'Ce message confirme que la configuration SMTP fonctionne correctement.',
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.email_test', 'system', null, { smtpHost: settings.smtpHost }, ip);

    res.json({ message: 'Email de test envoye avec succes' });
  } catch (error: any) {
    res.status(502).json({ message: `Erreur SMTP: ${error.message || 'Connexion impossible'}` });
  }
}

export async function detectOsintTools(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (!settings) { res.status(500).json({ message: 'No settings' }); return; }

    const ytdlpPath = settings.osint?.ytdlpPath || 'yt-dlp';
    const ffmpegPath = settings.osint?.ffmpegPath || 'ffmpeg';

    let ytdlpVersion = '';
    let ffmpegVersion = '';
    let pythonVersion = '';
    let telethonVersion = '';
    let exiftoolVersion = '';

    try {
      const { stdout } = await execFileAsync(ytdlpPath, ['--version']);
      ytdlpVersion = stdout.trim();
    } catch { /* not found */ }

    try {
      const { stdout } = await execFileAsync(ffmpegPath, ['-version']);
      const firstLine = stdout.split('\n')[0] || '';
      const match = firstLine.match(/ffmpeg version (\S+)/);
      ffmpegVersion = match ? match[1] : firstLine.trim();
    } catch { /* not found */ }

    try {
      const { stdout } = await execFileAsync('python3', ['--version']);
      pythonVersion = stdout.trim().replace('Python ', '');
    } catch { /* not found */ }

    try {
      const { stdout } = await execFileAsync('python3', ['-c', 'import telethon; print(telethon.__version__)']);
      telethonVersion = stdout.trim();
    } catch { /* not found */ }

    try {
      const { stdout } = await execFileAsync('exiftool', ['-ver']);
      exiftoolVersion = stdout.trim();
    } catch { /* not found */ }

    await SiteSettings.updateOne({}, {
      $set: {
        'osint.ytdlpVersion': ytdlpVersion,
        'osint.ffmpegVersion': ffmpegVersion,
        'osint.pythonVersion': pythonVersion,
        'osint.telethonVersion': telethonVersion,
        'osint.exiftoolVersion': exiftoolVersion,
      },
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.osint_detect', 'system', null, { ytdlpVersion, ffmpegVersion, pythonVersion, telethonVersion, exiftoolVersion }, ip);

    res.json({ ytdlpVersion, ffmpegVersion, pythonVersion, telethonVersion, exiftoolVersion });
  } catch {
    res.status(500).json({ message: 'Detection error' });
  }
}
