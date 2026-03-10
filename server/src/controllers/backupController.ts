import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import User from '../models/User';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import SiteSettings from '../models/SiteSettings';
import PluginSettings from '../models/PluginSettings';
import ActivityLog from '../models/ActivityLog';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');

const COLLECTION_KEYS = ['users', 'dossiers', 'dossiernodes', 'sitesettings', 'pluginsettings', 'activitylogs'] as const;

export async function exportBackup(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [users, dossiers, dossiernodes, sitesettings, pluginsettings, activitylogs] = await Promise.all([
      User.find().lean(),
      Dossier.find().lean(),
      DossierNode.find().lean(),
      SiteSettings.find().lean(),
      PluginSettings.find().lean(),
      ActivityLog.find().lean(),
    ]);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users,
      dossiers,
      dossiernodes,
      sitesettings,
      pluginsettings,
      activitylogs,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `meteoredit-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.backup_export', 'system', null, {
      collections: COLLECTION_KEYS.length,
      totalDocuments: users.length + dossiers.length + dossiernodes.length + sitesettings.length + pluginsettings.length + activitylogs.length,
    }, ip);
  } catch (error) {
    console.error('Export backup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function importBackup(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const raw = fs.readFileSync(req.file.path, 'utf-8');
    let backup: Record<string, any>;

    try {
      backup = JSON.parse(raw);
    } catch {
      res.status(400).json({ message: 'Invalid JSON file' });
      return;
    }

    // Validate structure
    const missingKeys = COLLECTION_KEYS.filter(key => !(key in backup));
    if (missingKeys.length > 0) {
      res.status(400).json({ message: `Invalid backup: missing keys: ${missingKeys.join(', ')}` });
      return;
    }

    for (const key of COLLECTION_KEYS) {
      if (!Array.isArray(backup[key])) {
        res.status(400).json({ message: `Invalid backup: "${key}" must be an array` });
        return;
      }
    }

    // Replace each collection
    const models = [
      { key: 'users', model: User },
      { key: 'dossiers', model: Dossier },
      { key: 'dossiernodes', model: DossierNode },
      { key: 'sitesettings', model: SiteSettings },
      { key: 'pluginsettings', model: PluginSettings },
      { key: 'activitylogs', model: ActivityLog },
    ] as const;

    const counts: Record<string, number> = {};

    for (const { key, model } of models) {
      await (model as any).deleteMany({});
      if (backup[key].length > 0) {
        await (model as any).insertMany(backup[key], { ordered: false });
      }
      counts[key] = backup[key].length;
    }

    // Clean up uploaded temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.backup_import', 'system', null, {
      counts,
      exportedAt: backup.exportedAt || null,
    }, ip);

    res.json({ message: 'Backup imported successfully', counts });
  } catch (error) {
    console.error('Import backup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

function getDirectoryStats(dirPath: string): { totalFiles: number; totalSize: number } {
  let totalFiles = 0;
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return { totalFiles, totalSize };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = getDirectoryStats(fullPath);
      totalFiles += sub.totalFiles;
      totalSize += sub.totalSize;
    } else if (entry.isFile()) {
      totalFiles += 1;
      totalSize += fs.statSync(fullPath).size;
    }
  }

  return { totalFiles, totalSize };
}

export async function getStorageInfo(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const { totalFiles, totalSize } = getDirectoryStats(UPLOAD_DIR);

    res.json({
      uploadsDirectory: UPLOAD_DIR,
      totalFiles,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
    });
  } catch (error) {
    console.error('Get storage info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
