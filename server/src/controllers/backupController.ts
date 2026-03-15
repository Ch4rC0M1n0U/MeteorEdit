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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `meteoredit-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream JSON manually
    res.write('{\n');
    res.write(`"version":1,\n`);
    res.write(`"exportedAt":"${new Date().toISOString()}",\n`);

    const collections = [
      { key: 'users', model: User },
      { key: 'dossiers', model: Dossier },
      { key: 'dossiernodes', model: DossierNode },
      { key: 'sitesettings', model: SiteSettings },
      { key: 'pluginsettings', model: PluginSettings },
      { key: 'activitylogs', model: ActivityLog },
    ] as const;

    let totalDocuments = 0;

    for (let i = 0; i < collections.length; i++) {
      const { key, model } = collections[i];
      res.write(`"${key}":[`);

      const cursor = (model as any).find().lean().cursor();
      let first = true;

      for await (const doc of cursor) {
        if (!first) res.write(',');
        res.write(JSON.stringify(doc));
        first = false;
        totalDocuments++;
      }

      res.write(']');
      if (i < collections.length - 1) res.write(',\n');
    }

    res.write('\n}');
    res.end();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.backup_export', 'system', null, {
      collections: collections.length,
      totalDocuments,
    }, ip);
  } catch (error) {
    console.error('Export backup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error' });
    }
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

/** Collect all file paths referenced in the database */
async function getReferencedFiles(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const addPath = (p: string | undefined | null) => {
    if (!p) return;
    // Normalize: strip leading slash, strip query params, resolve to absolute
    const clean = p.replace(/^\//, '').split('?')[0];
    if (clean.startsWith('uploads/')) {
      const resolved = path.resolve(UPLOAD_DIR, '..', clean);
      referenced.add(resolved);
      // Also mark the .enc variant as referenced (encrypted files)
      referenced.add(resolved + '.enc');
    }
  };

  // 1. DossierNode: fileUrl + content images + mediaData captures
  const nodes = await DossierNode.find({}, 'fileUrl content mediaData').lean();
  for (const node of nodes) {
    addPath(node.fileUrl);

    // Extract image URLs from TipTap JSON content (only if content is a string/object, not encrypted binary)
    if (node.content) {
      try {
        const contentStr = typeof node.content === 'string' ? node.content : JSON.stringify(node.content);
        const imgMatches = contentStr.match(/uploads\/[^"?\s]+/g);
        if (imgMatches) {
          for (const m of imgMatches) {
            addPath(m);
          }
        }
      } catch {
        // Content might be encrypted binary — skip image extraction
      }
    }

    // Extract screenshotUrl from mediaData annotations
    if (node.mediaData && (node.mediaData as any).annotations) {
      for (const ann of (node.mediaData as any).annotations) {
        if (ann.screenshotUrl) addPath(ann.screenshotUrl);
      }
    }
  }

  // 2. Dossier: logoPath, linkedDocuments, entity photos
  const dossiers = await Dossier.find({}, 'logoPath linkedDocuments entities').lean();
  for (const d of dossiers) {
    addPath(d.logoPath);
    if (d.linkedDocuments) {
      for (const doc of d.linkedDocuments) {
        addPath((doc as any).filePath);
      }
    }
    if (d.entities) {
      for (const entity of d.entities) {
        if ((entity as any).photos) {
          for (const photo of (entity as any).photos) {
            addPath(photo);
          }
        }
      }
    }
  }

  // 3. SiteSettings: logoPath, faviconPath, loginBackgroundPath
  const settings = await SiteSettings.find({}, 'logoPath faviconPath loginBackgroundPath').lean();
  for (const s of settings) {
    addPath(s.logoPath);
    addPath(s.faviconPath);
    addPath(s.loginBackgroundPath);
  }

  // 4. User: avatarPath, signatureImagePath
  const users = await User.find({}, 'avatarPath signatureImagePath').lean();
  for (const u of users) {
    addPath((u as any).avatarPath);
    addPath((u as any).signatureImagePath);
  }

  return referenced;
}

/** List all physical files in uploads directory */
function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dirPath)) return files;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function scanOrphans(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const referenced = await getReferencedFiles();
    const allFiles = getAllFiles(UPLOAD_DIR);

    const orphans: { path: string; relativePath: string; size: number }[] = [];
    let totalOrphanSize = 0;

    // Media files (uploads/media/) are referenced inside encrypted mediaData
    // that the server cannot read — never treat them as orphans.
    const mediaDir = path.resolve(UPLOAD_DIR, 'media');

    for (const filePath of allFiles) {
      const resolved = path.resolve(filePath);
      // Skip media directory — references are in encrypted content
      if (resolved.startsWith(mediaDir)) continue;
      if (!referenced.has(resolved)) {
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(path.resolve(UPLOAD_DIR, '..'), filePath).replace(/\\/g, '/');
        orphans.push({ path: resolved, relativePath, size: stat.size });
        totalOrphanSize += stat.size;
      }
    }

    res.json({
      totalFiles: allFiles.length,
      referencedFiles: referenced.size,
      orphanCount: orphans.length,
      orphanSizeBytes: totalOrphanSize,
      orphans: orphans.map(o => ({ relativePath: o.relativePath, size: o.size })),
    });
  } catch (error) {
    console.error('Scan orphans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function cleanOrphans(req: AuthRequest, res: Response): Promise<void> {
  try {
    const referenced = await getReferencedFiles();
    const allFiles = getAllFiles(UPLOAD_DIR);
    const mediaDir = path.resolve(UPLOAD_DIR, 'media');

    let deletedCount = 0;
    let freedBytes = 0;

    for (const filePath of allFiles) {
      const resolved = path.resolve(filePath);
      // Skip media directory — references are in encrypted content
      if (resolved.startsWith(mediaDir)) continue;
      if (!referenced.has(resolved)) {
        const stat = fs.statSync(filePath);
        freedBytes += stat.size;
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    // Recalculate storage after cleanup
    const { totalFiles, totalSize } = getDirectoryStats(UPLOAD_DIR);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'settings.storage_cleanup', 'system', null, {
      deletedFiles: deletedCount,
      freedBytes,
    }, ip);

    res.json({
      deletedFiles: deletedCount,
      freedBytes,
      totalFiles,
      totalSizeBytes: totalSize,
    });
  } catch (error) {
    console.error('Clean orphans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
