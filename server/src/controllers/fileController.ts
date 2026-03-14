import { Response } from 'express';
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

export async function serveFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const filename = req.params.filename as string;

    // Security: block traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ message: 'Invalid filename' });
      return;
    }

    // Search in uploads/ and uploads/media/ and uploads/media/captures/
    const searchPaths = [
      path.join(UPLOAD_DIR, filename),
      path.join(UPLOAD_DIR, 'media', filename),
      path.join(UPLOAD_DIR, 'media', 'captures', filename),
    ];

    let filePath: string | null = null;
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
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
    const dossierId = await findDossierForFile(filename);
    if (!dossierId) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

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
