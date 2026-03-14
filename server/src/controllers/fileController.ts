import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

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
    if (!resolved.startsWith(UPLOAD_DIR)) {
      res.status(400).json({ message: 'Invalid path' });
      return;
    }

    // Stream the file (encrypted blob)
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
