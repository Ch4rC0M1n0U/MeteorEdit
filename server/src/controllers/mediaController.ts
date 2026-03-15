import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

const execFileAsync = promisify(execFile);

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

/** Parse ISO 8601 duration (PT1H2M30S) to seconds */
function parseISO8601Duration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

interface MediaMetadata {
  title: string | null;
  channelName: string | null;
  channelUrl: string | null;
  platform: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  description: string | null;
  publishedAt: string | null;
  tags: string[];
}

/**
 * Fetch oEmbed metadata for a given URL via noembed.com,
 * with fallback to Open Graph meta tags.
 * POST /api/media/oembed
 */
export async function fetchOembed(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'url requis' });
      return;
    }

    let metadata: MediaMetadata = {
      title: null,
      channelName: null,
      channelUrl: null,
      platform: null,
      thumbnailUrl: null,
      duration: null,
      description: null,
      publishedAt: null,
      tags: [],
    };

    // Try noembed.com first
    try {
      const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const response = await fetch(noembedUrl);
      if (response.ok) {
        const data = await response.json() as Record<string, any>;
        if (data && !data.error) {
          metadata.title = data.title || null;
          metadata.channelName = data.author_name || null;
          metadata.channelUrl = data.author_url || null;
          metadata.platform = data.provider_name || null;
          metadata.thumbnailUrl = data.thumbnail_url || null;
        }
      }
    } catch {
      // noembed failed, will try fallback
    }

    // Always fetch HTML to enrich metadata (duration, description, publishedAt, tags)
    try {
      const htmlResponse = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();

        const getMetaContent = (property: string): string | null => {
          const regex = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
          const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${property}["']`, 'i');
          const match = html.match(regex) || html.match(altRegex);
          return match ? match[1] : null;
        };

        // Fill in missing basic metadata
        metadata.title = metadata.title || getMetaContent('og:title') || getMetaContent('twitter:title');
        metadata.thumbnailUrl = metadata.thumbnailUrl || getMetaContent('og:image') || getMetaContent('twitter:image');
        metadata.channelName = metadata.channelName || getMetaContent('og:site_name');

        // Description
        metadata.description = getMetaContent('og:description') || getMetaContent('description') || null;

        // Published date
        const datePublished = getMetaContent('datePublished') || getMetaContent('uploadDate') || getMetaContent('article:published_time') || getMetaContent('og:video:release_date');
        if (datePublished) {
          // Normalize to YYYY-MM-DD
          const parsed = new Date(datePublished);
          metadata.publishedAt = isNaN(parsed.getTime()) ? datePublished : parsed.toISOString().slice(0, 10);
        }

        // Duration (ISO 8601 format like PT1M47S)
        const isoDuration = getMetaContent('duration');
        if (isoDuration) {
          metadata.duration = parseISO8601Duration(isoDuration);
        }

        // Tags/keywords
        const keywords = getMetaContent('keywords');
        if (keywords) {
          metadata.tags = keywords.split(',').map(k => k.trim()).filter(Boolean);
        }
      }
    } catch {
      // HTML fetch failed, return whatever we have
    }

    res.json({ metadata });
  } catch (error) {
    console.error('fetchOembed error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Upload a media file (video or audio).
 * POST /api/media/upload
 */
export async function uploadMedia(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }

    const mediaDir = path.join(UPLOAD_DIR, 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    // Move file from default uploads/ to uploads/media/
    const srcPath = req.file.path;
    const destPath = path.join(mediaDir, req.file.filename);
    fs.renameSync(srcPath, destPath);

    // Use original content type if provided (encrypted upload), otherwise use detected mimetype
    const originalContentType = req.body.originalContentType;
    const mimeType = originalContentType || req.file.mimetype;
    let mediaType: 'video' | 'audio' = 'video';
    if (mimeType.startsWith('audio/')) {
      mediaType = 'audio';
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_upload', 'node', null, {
      fileName: req.file.originalname,
      mimeType,
      mediaType,
    }, ip, ua);

    res.json({
      fileUrl: `uploads/media/${req.file.filename}`,
      mimeType,
      mediaType,
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.error('uploadMedia error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Capture a video frame (base64 PNG from client-side canvas).
 * POST /api/media/capture
 */
export async function captureFrame(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { nodeId, dossierId, imageData, timestamp } = req.body;

    if (!nodeId || !dossierId || !imageData) {
      res.status(400).json({ error: 'nodeId, dossierId et imageData requis' });
      return;
    }

    const captureDir = path.join(UPLOAD_DIR, 'media', 'captures');
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
    }

    // Decode base64 data URL
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `cap-${Date.now()}.png`;
    const filePath = path.join(captureDir, filename);
    fs.writeFileSync(filePath, buffer);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture', 'node', nodeId, {
      dossierId,
      timestamp,
    }, ip, ua);

    res.json({
      screenshotUrl: `uploads/media/captures/${filename}`,
    });
  } catch (error) {
    console.error('captureFrame error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Extract a video frame at a given timestamp using yt-dlp + ffmpeg.
 * POST /api/media/capture-embed
 */
export async function captureEmbed(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { nodeId, dossierId, url, timestamp } = req.body;

    if (!nodeId || !dossierId || !url) {
      res.status(400).json({ error: 'nodeId, dossierId et url requis' });
      return;
    }

    const captureDir = path.join(UPLOAD_DIR, 'media', 'captures');
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
    }

    const filename = `cap-${Date.now()}.jpg`;
    const filePath = path.join(captureDir, filename);
    const ts = Math.max(0, Math.floor(timestamp || 0));

    // Step 1: Get direct video stream URL via yt-dlp
    const { stdout: streamUrl } = await execFileAsync('yt-dlp', [
      '-f', 'best[ext=mp4]/best',
      '-g',
      '--no-warnings',
      '--no-playlist',
      url,
    ], { timeout: 20000 });

    const videoUrl = streamUrl.trim().split('\n')[0];
    if (!videoUrl) {
      res.status(400).json({ error: 'Impossible de récupérer le flux vidéo' });
      return;
    }

    // Step 2: Extract frame at timestamp via ffmpeg
    await execFileAsync('ffmpeg', [
      '-ss', String(ts),
      '-i', videoUrl,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      filePath,
    ], { timeout: 15000 });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture_embed', 'node', nodeId, {
      dossierId,
      url,
      timestamp,
    }, ip, ua);

    res.json({
      screenshotUrl: `uploads/media/captures/${filename}`,
    });
  } catch (error: any) {
    console.error('captureEmbed error:', error?.message || error);
    res.status(500).json({ error: 'Échec de la capture. Vérifiez que yt-dlp et ffmpeg sont installés.' });
  }
}

// POST /api/media/replace-capture
export async function replaceCapture(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { screenshotUrl, imageData } = req.body;
    if (!screenshotUrl || !imageData) {
      return res.status(400).json({ error: 'Missing screenshotUrl or imageData' });
    }

    // Resolve the file path on disk (strip any query params like ?t=xxx)
    const relativePath = screenshotUrl.replace(/^\//, '').split('?')[0];
    const absPath = path.resolve(UPLOAD_DIR, '..', relativePath);

    // Ensure parent directory exists (create if needed)
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Decode base64 image data and write (overwrite or create) the file
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(absPath, buffer);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture.replaced', 'node', userId, { screenshotUrl }, ip, ua);

    res.json({ screenshotUrl: relativePath });
  } catch (error: any) {
    console.error('replaceCapture error:', error?.message || error);
    res.status(500).json({ error: 'Failed to replace capture' });
  }
}

// POST /api/media/replace-capture-encrypted (multipart: file + screenshotUrl)
export async function replaceCaptureEncrypted(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { screenshotUrl } = req.body;
    if (!screenshotUrl || !req.file) {
      return res.status(400).json({ error: 'Missing screenshotUrl or file' });
    }

    const relativePath = screenshotUrl.replace(/^\//, '').split('?')[0];
    const absPath = path.resolve(UPLOAD_DIR, '..', relativePath);

    // Determine target path: if original is not .enc, rename to .enc
    const needsRename = !absPath.endsWith('.enc');
    const targetPath = needsRename ? absPath + '.enc' : absPath;
    const targetRelative = needsRename ? relativePath + '.enc' : relativePath;

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the encrypted file blob directly (already encrypted by client)
    fs.writeFileSync(targetPath, fs.readFileSync(req.file.path));
    // Clean up multer temp file
    if (req.file.path !== targetPath && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Delete original plaintext file if we renamed
    if (needsRename && fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture.replaced_encrypted', 'node', userId, { screenshotUrl }, ip, ua);

    res.json({ screenshotUrl: targetRelative });
  } catch (error: any) {
    console.error('replaceCaptureEncrypted error:', error?.message || error);
    res.status(500).json({ error: 'Failed to replace capture' });
  }
}

// DELETE /api/media/capture
export async function deleteCapture(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { screenshotUrl } = req.body;
    if (!screenshotUrl) {
      return res.status(400).json({ error: 'Missing screenshotUrl' });
    }

    const relativePath = screenshotUrl.replace(/^\//, '');
    const absPath = path.resolve(UPLOAD_DIR, '..', relativePath);

    // Delete file from disk
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    try {
      await logActivity(userId, 'media_capture.deleted', 'node', userId, { screenshotUrl }, ip, ua);
    } catch { /* ignore log errors */ }

    res.json({ deleted: true });
  } catch (error: any) {
    console.error('deleteCapture error:', error?.message || error);
    res.status(500).json({ error: 'Failed to delete capture' });
  }
}
