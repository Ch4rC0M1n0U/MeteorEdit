import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { computeFileHash } from '../utils/hashFile';
import EvidenceRecord from '../models/EvidenceRecord';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

interface MediaMetadata {
  title: string | null;
  channelName: string | null;
  channelUrl: string | null;
  platform: string | null;
  thumbnailUrl: string | null;
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
    };

    // Try noembed.com first
    try {
      const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const response = await fetch(noembedUrl);
      if (response.ok) {
        const data = await response.json() as Record<string, any>;
        if (data && !data.error) {
          metadata = {
            title: data.title || null,
            channelName: data.author_name || null,
            channelUrl: data.author_url || null,
            platform: data.provider_name || null,
            thumbnailUrl: data.thumbnail_url || null,
          };
        }
      }
    } catch {
      // noembed failed, will try fallback
    }

    // Fallback: fetch HTML and parse OG meta tags
    if (!metadata.title && !metadata.thumbnailUrl) {
      try {
        const htmlResponse = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeteorEdit/1.0)' },
          signal: AbortSignal.timeout(10000),
        });
        if (htmlResponse.ok) {
          const html = await htmlResponse.text();

          const getMetaContent = (property: string): string | null => {
            const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
            const match = html.match(regex) || html.match(altRegex);
            return match ? match[1] : null;
          };

          metadata.title = metadata.title || getMetaContent('og:title') || getMetaContent('twitter:title');
          metadata.thumbnailUrl = metadata.thumbnailUrl || getMetaContent('og:image') || getMetaContent('twitter:image');
          metadata.channelName = metadata.channelName || getMetaContent('og:site_name');
        }
      } catch {
        // Fallback also failed, return whatever we have
      }
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

    const mimeType = req.file.mimetype;
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

    // Compute SHA-256 hash
    const fileHash = await computeFileHash(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Create evidence record
    const evidence = await EvidenceRecord.create({
      nodeId,
      dossierId,
      capturedBy: userId,
      capturedAt: new Date(),
      fileHash,
      filePath,
      fileSize,
      sourceUrl: null,
      evidenceType: 'media-capture',
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture', 'node', nodeId, {
      dossierId,
      timestamp,
      evidenceId: evidence._id.toString(),
    }, ip, ua);

    res.json({
      screenshotUrl: `uploads/media/captures/${filename}`,
      evidenceId: evidence._id,
    });
  } catch (error) {
    console.error('captureFrame error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Capture a screenshot of an embedded media page via Puppeteer.
 * POST /api/media/capture-embed
 */
export async function captureEmbed(req: AuthRequest, res: Response): Promise<void> {
  let browser: any = null;
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

    const filename = `cap-${Date.now()}.png`;
    const filePath = path.join(captureDir, filename);

    // Launch Puppeteer (same pattern as clipperController)
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Dismiss cookie banners - simplified version
    try {
      const acceptSelectors = [
        '#onetrust-accept-btn-handler',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '#CybotCookiebotDialogBodyButtonAccept',
        '#didomi-notice-agree-button',
        'button[id*="accept"]',
        'button[id*="consent"]',
        'button[class*="accept"]',
        'button[class*="consent"]',
        '[aria-label*="accept" i]',
        '[aria-label*="accepter" i]',
      ];
      for (const selector of acceptSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            await new Promise(r => setTimeout(r, 300));
            break;
          }
        } catch { /* continue */ }
      }
    } catch { /* non-critical */ }

    // Wait for page to settle
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: filePath, fullPage: true });
    await browser.close();
    browser = null;

    // Compute hash and file size
    const fileHash = await computeFileHash(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Create evidence record
    const evidence = await EvidenceRecord.create({
      nodeId,
      dossierId,
      capturedBy: userId,
      capturedAt: new Date(),
      fileHash,
      filePath,
      fileSize,
      sourceUrl: url,
      evidenceType: 'media-capture',
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture_embed', 'node', nodeId, {
      dossierId,
      url,
      timestamp,
      evidenceId: evidence._id.toString(),
    }, ip, ua);

    res.json({
      screenshotUrl: `uploads/media/captures/${filename}`,
      evidenceId: evidence._id,
    });
  } catch (error) {
    console.error('captureEmbed error:', error);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
