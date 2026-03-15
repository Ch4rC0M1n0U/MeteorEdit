import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId).lean();
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.some((c: any) => c.toString() === userId);
}

/**
 * Find which dossier a file belongs to by checking DossierNode.fileUrl
 * and Dossier.logoPath / linkedDocuments[].filePath / entities[].photos[].
 * Returns the dossier ID or null if not found.
 */
async function findDossierForFile(filename: string): Promise<string | null> {
  // DossierNode.fileUrl stores paths like "uploads/xxx.ext" or "uploads/media/xxx.ext"
  const node = await DossierNode.findOne({
    fileUrl: { $regex: new RegExp(`${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
  }).select('dossierId').lean();
  if (node) return (node as any).dossierId?.toString() || null;

  // Check Dossier-level fields: logoPath, linkedDocuments[].filePath, entities[].photos[]
  const dossier = await Dossier.findOne({
    $or: [
      { logoPath: { $regex: new RegExp(`${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) } },
      { 'linkedDocuments.filePath': { $regex: new RegExp(`${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) } },
      { 'entities.photos': { $regex: new RegExp(`${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) } },
    ]
  }).select('_id').lean();
  if (dossier) return (dossier as any)._id.toString();

  return null;
}

/**
 * Serve files from /uploads/* path (replaces express.static with .enc fallback).
 * Sensitive files are E2E encrypted — the AES-256-GCM encryption is the security layer,
 * not the route authentication. UUIDs as filenames prevent enumeration.
 */
export async function serveUploadFile(req: Request, res: Response): Promise<void> {
  try {
    // Express 5 wildcard returns array of path segments
    const raw = req.params.filepath || req.params[0] || '';
    const rawPath = Array.isArray(raw) ? raw.join('/') : String(raw);

    // Security: block traversal
    if (!rawPath || rawPath.includes('..')) {
      res.status(400).json({ message: 'Invalid path' });
      return;
    }

    const requestedPath = path.join(UPLOAD_DIR, rawPath);
    let filePath = requestedPath;

    // If file not found, try .enc variant
    if (!fs.existsSync(filePath)) {
      const encPath = filePath + '.enc';
      if (fs.existsSync(encPath)) {
        filePath = encPath;
      } else {
        res.status(404).json({ message: 'File not found' });
        return;
      }
    }

    // Verify resolved path stays within UPLOAD_DIR
    const resolved = path.resolve(filePath);
    const normalizedUploadDir = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
    if (!resolved.startsWith(normalizedUploadDir)) {
      res.status(400).json({ message: 'Invalid path' });
      return;
    }

    // Determine Content-Type: encrypted files get octet-stream, others get MIME from extension
    const isEncrypted = resolved.endsWith('.enc');
    let contentType = 'application/octet-stream';
    if (!isEncrypted) {
      const ext = path.extname(resolved).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      };
      contentType = mimeMap[ext] || 'application/octet-stream';
    }

    // Stream the file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(resolved);
    stream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Stream error' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Serve upload file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function serveFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const filename = req.params.filename as string;

    // Security: block traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ message: 'Invalid filename' });
      return;
    }

    // Search in uploads/ and uploads/media/ and uploads/media/captures/
    // Also check for .enc variant (file may have been encrypted after original URL was saved)
    const dirs = [UPLOAD_DIR, path.join(UPLOAD_DIR, 'media'), path.join(UPLOAD_DIR, 'media', 'captures')];
    const variants = [filename];
    if (!filename.endsWith('.enc')) variants.push(filename + '.enc');

    let filePath: string | null = null;
    for (const dir of dirs) {
      for (const variant of variants) {
        const p = path.join(dir, variant);
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }
      if (filePath) break;
    }

    if (!filePath) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Verify resolved path stays within UPLOAD_DIR
    const resolved = path.resolve(filePath);
    const normalizedUploadDir = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
    if (!resolved.startsWith(normalizedUploadDir) && resolved !== UPLOAD_DIR) {
      res.status(400).json({ message: 'Invalid path' });
      return;
    }

    // ACL check: find which dossier references this file
    // Try both original filename and without .enc suffix for encrypted files
    const actualFilename = path.basename(filePath);
    const baseFilename = actualFilename.replace(/\.enc$/, '');
    let dossierId = await findDossierForFile(actualFilename);
    if (!dossierId && actualFilename !== baseFilename) {
      dossierId = await findDossierForFile(baseFilename);
    }
    if (!dossierId && actualFilename !== filename) {
      dossierId = await findDossierForFile(filename);
    }
    if (dossierId) {
      // File tracked in DB — enforce dossier-level ACL
      if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }
    }
    // If dossierId is null, the file exists on disk but isn't directly tracked
    // (e.g., TipTap inline images stored only in encrypted content JSON).
    // Since the route requires authentication, serve it to any authenticated user.

    // Stream the file (encrypted blob)
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(resolved);
    stream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Stream error' });
      }
    });
    stream.pipe(res);

    // Log activity
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'file.download', 'node', null, { filename }, ip);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
