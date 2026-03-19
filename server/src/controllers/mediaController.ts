import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import DossierNode from '../models/DossierNode';

const execFileAsync = promisify(execFile);

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

/**
 * Extract video stream URL using real Chrome (Puppeteer) with anti-detection.
 * Works when yt-dlp/Cobalt are blocked by bot detection.
 */
export async function extractVideoUrlWithChrome(videoUrl: string): Promise<string | null> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en'] });
      (window as any).chrome = { runtime: {} };
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    let streamUrl: string | null = null;
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', (params: any) => {
      if (params.request.url.includes('googlevideo.com/videoplayback') && !streamUrl) {
        streamUrl = params.request.url;
      }
    });

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    // Accept consent dialog
    try {
      const btn = await page.waitForSelector('button[aria-label*="Accept"], button[aria-label*="Accepter"], form[action*="consent"] button', { timeout: 3000 });
      if (btn) await btn.click();
      await new Promise(r => setTimeout(r, 2000));
    } catch {}
    // Click play
    for (let i = 0; i < 15; i++) {
      if (streamUrl) break;
      await new Promise(r => setTimeout(r, 1000));
      try { await page.click('.ytp-play-button'); } catch {}
      try { await page.click('.ytp-large-play-button'); } catch {}
    }

    await browser.close();
    browser = null;
    if (streamUrl) console.log('[Chrome] Video URL extracted successfully');
    return streamUrl;
  } catch (err: any) {
    console.error('[Chrome] Video extraction failed:', err?.message);
    if (browser) try { await browser.close(); } catch {}
    return null;
  }
}

/**
 * Download a video file using Chrome via CDP request interception.
 * The browser downloads the stream itself (same session = no 403).
 */
export async function downloadVideoWithChrome(videoUrl: string, outputPath: string): Promise<boolean> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      (window as any).chrome = { runtime: {} };
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    let streamUrl: string | null = null;
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', (params: any) => {
      if (params.request.url.includes('googlevideo.com/videoplayback') && !streamUrl) {
        streamUrl = params.request.url;
      }
    });

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    try {
      const btn = await page.waitForSelector('button[aria-label*="Accept"], button[aria-label*="Accepter"], form[action*="consent"] button', { timeout: 3000 });
      if (btn) await btn.click();
      await new Promise(r => setTimeout(r, 2000));
    } catch {}
    for (let i = 0; i < 15; i++) {
      if (streamUrl) break;
      await new Promise(r => setTimeout(r, 1000));
      try { await page.click('.ytp-play-button'); } catch {}
      try { await page.click('.ytp-large-play-button'); } catch {}
    }

    if (!streamUrl) {
      await browser.close();
      return false;
    }

    // Download the video using the browser's own fetch (same session, same cookies)
    const buffer = await page.evaluate(async (url: string) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ab = await resp.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    }, streamUrl);

    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`[Chrome] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB to ${outputPath}`);
    await browser.close();
    return true;
  } catch (err: any) {
    console.error('[Chrome] Download failed:', err?.message);
    if (browser) try { await browser.close(); } catch {}
    return false;
  }
}

/**
 * Capture a frame from a YouTube video by screenshotting the player at a given timestamp.
 * Works when yt-dlp/ffmpeg fail due to bot detection.
 */
export async function captureYoutubeFrame(videoUrl: string, timestamp: number, outputPath: string): Promise<boolean> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      (window as any).chrome = { runtime: {} };
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to embed with autoplay and start time
    const ts = Math.floor(timestamp);
    const embedUrl = videoUrl.replace('watch?v=', 'embed/').split('&')[0] + `?autoplay=1&start=${ts}&controls=0&modestbranding=1`;
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for video to load and seek
    await new Promise(r => setTimeout(r, 5000));

    // Try to click play if needed
    try { await page.click('.ytp-large-play-button'); } catch {}
    await new Promise(r => setTimeout(r, 3000));

    // Seek to exact timestamp via JS
    await page.evaluate((t: number) => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = t;
        video.pause();
      }
    }, timestamp);
    await new Promise(r => setTimeout(r, 1000));

    // Screenshot the video element
    const videoElement = await page.$('video');
    if (videoElement) {
      await videoElement.screenshot({ path: outputPath, type: 'jpeg', quality: 90 });
      console.log(`[Chrome] YouTube frame captured at ${ts}s`);
    } else {
      // Fallback: screenshot the whole page
      await page.screenshot({ path: outputPath, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      console.log('[Chrome] Full page screenshot (no video element found)');
    }

    await browser.close();
    return true;
  } catch (err: any) {
    console.error('[Chrome] YouTube frame capture failed:', err?.message);
    if (browser) try { await browser.close(); } catch {}
    return false;
  }
}

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

    // Instagram-specific: try Instagram's oEmbed endpoint (works without token for public content)
    if (!metadata.thumbnailUrl && url.includes('instagram.com')) {
      try {
        const igOembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
        const igResp = await fetch(igOembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000),
        });
        if (igResp.ok) {
          const igData = await igResp.json() as Record<string, any>;
          metadata.thumbnailUrl = igData.thumbnail_url || null;
          metadata.title = metadata.title || igData.title || null;
          metadata.channelName = metadata.channelName || igData.author_name || null;
          metadata.platform = metadata.platform || 'Instagram';
        }
      } catch {
        // Instagram oEmbed failed
      }
    }

    // Always fetch HTML to enrich metadata (duration, description, publishedAt, tags)
    try {
      const htmlResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
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

        // ── Snapchat-specific: parse __NEXT_DATA__ for rich metadata ──
        const isSnapchat = /snapchat\.com/i.test(url);
        if (isSnapchat) {
          metadata.platform = metadata.platform || 'Snapchat';
          const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*(\{[\s\S]*?\})\s*<\/script>/);
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1]);
              const pageProps = nextData?.props?.pageProps;
              if (pageProps) {
                // Username & display name
                const profile = pageProps.publicUserProfile || pageProps.userProfile;
                const username = profile?.username || pageProps.username;
                const displayName = profile?.displayName || profile?.title;
                if (username) {
                  metadata.channelName = displayName ? `${displayName} (@${username})` : username;
                  metadata.channelUrl = `https://www.snapchat.com/add/${username}`;
                }

                // Title from various sources
                const pageTitle = pageProps.pageMetadata?.title || pageProps.title;
                if (pageTitle && !metadata.title) {
                  metadata.title = pageTitle;
                }

                // Thumbnail
                const snapThumbnail = pageProps.pageMetadata?.previewImageUrl
                  || pageProps.story?.snapList?.[0]?.thumbnailUrl;
                if (snapThumbnail && !metadata.thumbnailUrl) {
                  metadata.thumbnailUrl = snapThumbnail;
                }

                // Creation timestamp
                const story = pageProps.story || pageProps.highlight;
                const snapMeta = story?.snapList?.[0] || story?.snaps?.[0];
                const creationTs = snapMeta?.creationTimestampMs || story?.creationTimestampMs;
                if (creationTs && !metadata.publishedAt) {
                  const d = new Date(typeof creationTs === 'string' ? parseInt(creationTs, 10) : creationTs);
                  if (!isNaN(d.getTime())) metadata.publishedAt = d.toISOString().slice(0, 10);
                }
              }
            } catch {
              // __NEXT_DATA__ parse failed, continue with what we have
            }
          }

          // Clean Snapchat title: remove trailing " (1)" and "| Spotlight" etc.
          if (metadata.title) {
            metadata.title = metadata.title.replace(/\s*\(\d+\)\s*$/, '').trim();
            // If title contains pipe-separated metadata, extract the actual title part
            const parts = metadata.title.split(' | ').map((p: string) => p.trim());
            if (parts.length >= 3) {
              const titleParts = parts.filter((p: string) =>
                !p.match(/^\d[\d.,]*\s*K?\s*likes?/i) &&
                !p.match(/\(@\w+\)/) &&
                !p.match(/^(?:Date de publication|Published)/i) &&
                !p.match(/^Spotlight\s*\(/i)
              );
              if (titleParts.length > 0) {
                metadata.title = titleParts[0];
              }
            }
          }
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
  let cookiesFile: string | null = null;
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

    // Step 1: Get direct video stream URL
    let videoUrl = '';

    // Try yt-dlp first
    try {
      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
      const ytdlpArgs = ['--js-runtimes', 'node', '--impersonate', 'chrome', '-f', 'b', '-g', '--no-warnings', '--no-playlist'];
      // Try with stored cookies
      try {
        let platform = '';
        if (isYoutube) platform = 'youtube';
        else if (url.includes('instagram.com')) platform = 'instagram';
        else if (url.includes('tiktok.com')) platform = 'tiktok';
        if (platform) {
          const { exportCookiesFile } = await import('./socialAuthController');
          cookiesFile = await exportCookiesFile(userId, platform);
          if (cookiesFile) ytdlpArgs.push('--cookies', cookiesFile);
        }
      } catch {}
      ytdlpArgs.push(url);
      const { stdout } = await execFileAsync('yt-dlp', ytdlpArgs, { timeout: 30000 });
      videoUrl = stdout.trim().split('\n')[0] || '';
    } catch (ytErr: any) {
      console.log('yt-dlp failed, trying Cobalt fallback:', ytErr?.message?.substring(0, 100));
    }

    // Fallback: Cobalt API
    if (!videoUrl) {
      const cobaltUrl = process.env.COBALT_URL || 'http://cobalt-api:9000';
      try {
        const cobaltResp = await fetch(cobaltUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ url, videoQuality: '720', filenameStyle: 'basic' }),
        });
        const cobaltData = await cobaltResp.json() as any;
        if (cobaltData.url) {
          videoUrl = cobaltData.url;
          console.log('Cobalt provided video URL');
        } else if (cobaltData.status === 'tunnel' || cobaltData.status === 'redirect') {
          videoUrl = cobaltData.url || '';
        }
      } catch (cobaltErr: any) {
        console.error('Cobalt fallback failed:', cobaltErr?.message);
      }
    }

    if (!videoUrl) {
      if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
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
    ], { timeout: 30000 });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media_capture_embed', 'node', nodeId, {
      dossierId,
      url,
      timestamp,
    }, ip, ua);

    // Clean up temp cookies file
    if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}

    res.json({
      screenshotUrl: `uploads/media/captures/${filename}`,
    });
  } catch (error: any) {
    console.error('captureEmbed error:', error?.message || error);
    if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
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

/**
 * Replace a downloaded media file with its encrypted version.
 * POST /api/media/encrypt-file
 * Body (multipart): file (encrypted blob) + fileUrl (original relative path)
 */
export async function encryptMediaFile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { fileUrl } = req.body;
    if (!fileUrl || !req.file) {
      return res.status(400).json({ error: 'Missing fileUrl or file' });
    }

    // Resolve the original file path
    const relativePath = fileUrl.replace(/^\//, '');
    const absPath = path.resolve(UPLOAD_DIR, '..', relativePath);
    const encPath = absPath + '.enc';

    const dir = path.dirname(encPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write encrypted blob
    fs.writeFileSync(encPath, fs.readFileSync(req.file.path));
    // Clean up multer temp
    if (req.file.path !== encPath && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    // Delete plaintext original
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    // Update DossierNode fileUrl to .enc
    const newFileUrl = relativePath + '.enc';
    const filename = path.basename(relativePath);
    await DossierNode.updateMany(
      { 'mediaData.source.fileUrl': { $regex: new RegExp(`${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) } },
      { $set: { 'mediaData.source.fileUrl': newFileUrl } }
    );

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media.encrypt_file', 'node', null, { fileUrl, newFileUrl }, ip, ua);

    res.json({ fileUrl: newFileUrl });
  } catch (error: any) {
    console.error('encryptMediaFile error:', error?.message || error);
    res.status(500).json({ error: 'Failed to encrypt file' });
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
