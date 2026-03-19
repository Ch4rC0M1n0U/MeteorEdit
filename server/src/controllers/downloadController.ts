import { Response } from 'express';
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

const execFileAsync = promisify(execFile);

/**
 * Fetch Snapchat __NEXT_DATA__ from page source to extract rich metadata.
 * yt-dlp uses the generic html5 extractor for Snapchat and misses most fields.
 */
async function fetchSnapchatNextData(pageUrl: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]+?)<\/script>/);
    if (!match) return null;
    return JSON.parse(match[1].trim());
  } catch (err: any) {
    console.warn('[Snapchat] Failed to fetch __NEXT_DATA__:', err?.message);
    return null;
  }
}

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

// Rate limiting: active downloads per user
const activeDownloads = new Map<string, number>();

// Platform detection from URL
const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /(?:youtube\.com|youtu\.be)/i, platform: 'youtube' },
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /snapchat\.com/i, platform: 'snapchat' },
  { pattern: /(?:facebook\.com|fb\.watch)/i, platform: 'facebook' },
  { pattern: /(?:x\.com|twitter\.com)/i, platform: 'x' },
];

function detectPlatform(url: string): string | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

/** Parse compact numbers like "172,6 K", "1.5K", "3,200", "42" */
function parseCompactNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  const kMatch = s.match(/^([\d.,]+)\s*K$/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }
  const mMatch = s.match(/^([\d.,]+)\s*M$/i);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1].replace(',', '.')) * 1_000_000);
  }
  return parseInt(s.replace(/[.,]/g, ''), 10) || 0;
}

/** Parse localized dates: absolute ("10 déc. 2025"), relative ("vendredi", "hier", "il y a 3 jours") */
function parseLocalizedDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const now = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  // "aujourd'hui" / "today" / "vandaag"
  if (/^(?:aujourd'?hui|today|vandaag)$/i.test(s)) return toISO(now);

  // "hier" / "yesterday" / "gisteren"
  if (/^(?:hier|yesterday|gisteren)$/i.test(s)) {
    now.setDate(now.getDate() - 1);
    return toISO(now);
  }

  // "il y a X jours" / "X days ago" / "X dagen geleden"
  const agoMatch = s.match(/(?:il y a|ago|geleden)\D*(\d+)\s*(?:jours?|days?|dagen)/i)
    || s.match(/(\d+)\s*(?:jours?|days?|dagen)\s*(?:il y a|ago|geleden)/i);
  if (agoMatch) {
    now.setDate(now.getDate() - parseInt(agoMatch[1], 10));
    return toISO(now);
  }

  // Relative day names: "lundi", "mardi", "vendredi", "monday", "friday", etc.
  const DAY_NAMES: Record<string, number> = {
    // French (0=Sunday)
    'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4, 'vendredi': 5, 'samedi': 6,
    // English
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
    // Dutch
    'zondag': 0, 'maandag': 1, 'dinsdag': 2, 'woensdag': 3, 'donderdag': 4, 'vrijdag': 5, 'zaterdag': 6,
  };
  const dayNum = DAY_NAMES[s];
  if (dayNum !== undefined) {
    // Find the most recent past occurrence of this day
    const today = now.getDay();
    let diff = today - dayNum;
    if (diff <= 0) diff += 7; // e.g. today=Sunday(0), target=Friday(5) → diff=-5+7=2 days ago
    now.setDate(now.getDate() - diff);
    return toISO(now);
  }

  // Absolute dates
  const MONTHS: Record<string, string> = {
    'janv': '01', 'jan': '01', 'janvier': '01',
    'fév': '02', 'févr': '02', 'février': '02', 'fev': '02', 'fevr': '02',
    'mars': '03', 'mar': '03',
    'avr': '04', 'avril': '04', 'apr': '04',
    'mai': '05', 'may': '05',
    'juin': '06', 'jun': '06',
    'juil': '07', 'juillet': '07', 'jul': '07',
    'août': '08', 'aout': '08', 'aug': '08',
    'sept': '09', 'sep': '09', 'septembre': '09',
    'oct': '10', 'octobre': '10',
    'nov': '11', 'novembre': '11',
    'déc': '12', 'dec': '12', 'décembre': '12', 'decembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'june': '06', 'july': '07', 'august': '08', 'september': '09',
    'october': '10', 'november': '11', 'december': '12',
    'mrt': '03', 'mei': '05', 'okt': '10',
  };

  // "10 déc. 2025" or "10 décembre 2025"
  const frMatch = raw.match(/(\d{1,2})\s+([a-zéûô]+)\.?\s+(\d{4})/i);
  if (frMatch) {
    const month = MONTHS[frMatch[2].toLowerCase()];
    if (month) return `${frMatch[3]}-${month}-${frMatch[1].padStart(2, '0')}`;
  }

  // "10 déc." or "10 décembre" (without year — assume current year)
  const frNoYearMatch = raw.match(/(\d{1,2})\s+([a-zéûô]+)\.?\s*$/i);
  if (frNoYearMatch) {
    const month = MONTHS[frNoYearMatch[2].toLowerCase()];
    if (month) return `${now.getFullYear()}-${month}-${frNoYearMatch[1].padStart(2, '0')}`;
  }

  // "Dec 10, 2025" or "December 10 2025"
  const enMatch = raw.match(/([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (enMatch) {
    const month = MONTHS[enMatch[1].toLowerCase()];
    if (month) return `${enMatch[3]}-${month}-${enMatch[2].padStart(2, '0')}`;
  }

  return null;
}

/** Strip tracking/sharing params that can cause yt-dlp issues */
const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igsh', 'ig_web_copy_link', 'fbclid', 'ref', 'ref_src', 'ref_url', 'si'];
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\?$/, '');
  } catch { return raw; }
}

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.map((c: any) => c.toString()).includes(userId);
}

/**
 * Send an SSE event to the client.
 */
function sendSSE(res: Response, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Try to load cookies file for a platform via socialAuthController if available.
 * Returns the temp cookie file path, or null if not available.
 */
async function getCookiesFile(userId: string, platform: string): Promise<string | null> {
  try {
    // Dynamic import to avoid hard dependency on socialAuthController
    const mod = await import('./socialAuthController');
    if (typeof mod.exportCookiesFile === 'function') {
      return await mod.exportCookiesFile(userId, platform);
    }
  } catch {
    // socialAuthController not available yet, skip cookies
  }
  return null;
}

/**
 * Download a video via yt-dlp with SSE progress tracking.
 * POST /api/media/download
 * Body: { url, dossierId, parentId? }
 */
export async function downloadVideo(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { url: rawUrl, dossierId, parentId, nodeId } = req.body;
  const url = cleanUrl(rawUrl || '');
  let cookiesFile: string | null = null;
  let outputFilePattern: string | null = null;

  try {
    // ── Validate input ──
    if (!url || !dossierId) {
      res.status(400).json({ error: 'url et dossierId requis' });
      return;
    }

    // ── Check dossier access ──
    if (!(await checkDossierAccess(dossierId, userId))) {
      res.status(403).json({ error: 'Accès refusé au dossier' });
      return;
    }

    // ── Detect platform ──
    const platform = detectPlatform(url);
    if (!platform) {
      res.status(400).json({ error: 'Plateforme non supportée. URL non reconnue.' });
      return;
    }

    // ── Check enabled platforms ──
    const settings = await SiteSettings.findOne();
    const enabledPlatforms = settings?.osint?.enabledPlatforms || [];
    const maxSizeMB = settings?.osint?.maxVideoSize || 200; // Already in MB
    const maxConcurrentDownloads = settings?.osint?.maxConcurrentDownloads || 5;
    const ytdlpPath = settings?.osint?.ytdlpPath || 'yt-dlp';

    if (!enabledPlatforms.includes(platform)) {
      res.status(403).json({ error: `La plateforme "${platform}" n'est pas activée.` });
      return;
    }

    // ── Rate limiting ──
    const currentDownloads = activeDownloads.get(userId) || 0;
    if (currentDownloads >= maxConcurrentDownloads) {
      res.status(429).json({ error: `Limite de téléchargements simultanés atteinte (${maxConcurrentDownloads}).` });
      return;
    }
    activeDownloads.set(userId, currentDownloads + 1);

    // ── Ensure media directory exists ──
    const mediaDir = path.join(UPLOAD_DIR, 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    // ── Get cookies file ──
    cookiesFile = await getCookiesFile(userId, platform);

    // ── Set up SSE response ──
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    sendSSE(res, 'status', { status: 'downloading' });

    // ── Single yt-dlp call: download + write metadata JSON ──
    // Using ONE call instead of two (metadata + download) to avoid bot detection
    let metadata = {
      title: 'Vidéo téléchargée',
      duration: null as number | null,
      thumbnail: null as string | null,
      uploader: null as string | null,
      uploaderUrl: null as string | null,
      channelHandle: null as string | null,
      uploaderId: null as string | null,
      description: null as string | null,
      uploadDate: null as string | null,
      tags: [] as string[],
      viewCount: null as number | null,
      likeCount: null as number | null,
      commentCount: null as number | null,
      webpageUrl: url,
    };

    const fileId = uuid();
    const outputTemplate = path.join(mediaDir, `${fileId}.%(ext)s`);
    outputFilePattern = path.join(mediaDir, `${fileId}.*`);
    const infoJsonPath = path.join(mediaDir, `${fileId}.info.json`);

    // ── Helper: download via yt-dlp ──
    async function downloadWithYtdlp(): Promise<string> {
      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
      const dlArgs: string[] = [
        '--js-runtimes', 'node',
        '-f', `bestvideo[filesize<${maxSizeMB}M]+bestaudio/best[filesize<${maxSizeMB}M]/best`,
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--max-filesize', `${maxSizeMB}M`,
        '--newline',
        '--write-info-json',
        '-o', outputTemplate,
      ];
      // Use mweb client for YouTube to bypass bot detection
      if (isYoutube) dlArgs.push('--extractor-args', 'youtube:player_client=mweb');
      if (cookiesFile) {
        dlArgs.push('--cookies', cookiesFile);
      }
      dlArgs.push(url);

      return new Promise<string>((resolve, reject) => {
        const proc = spawn(ytdlpPath, dlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderrData = '';

        proc.stdout.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S*\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/);
            if (progressMatch) {
              sendSSE(res, 'progress', {
                progress: parseFloat(progressMatch[1]),
                speed: progressMatch[2],
                eta: progressMatch[3],
              });
            }
            const destMatch = line.match(/\[(?:Merger|download)\]\s+Destination:\s+(.+)/);
            if (destMatch) {
              outputFilePattern = destMatch[1].trim();
            }
            const alreadyMatch = line.match(/\[download\]\s+(.+)\s+has already been downloaded/);
            if (alreadyMatch) {
              outputFilePattern = alreadyMatch[1].trim();
            }
          }
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          stderrData += chunk.toString();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            const files = fs.readdirSync(mediaDir).filter(f => f.startsWith(fileId));
            if (files.length > 0) {
              files.sort((a, b) => {
                const sizeA = fs.statSync(path.join(mediaDir, a)).size;
                const sizeB = fs.statSync(path.join(mediaDir, b)).size;
                return sizeB - sizeA;
              });
              resolve(path.join(mediaDir, files[0]));
            } else {
              reject(new Error('Fichier téléchargé introuvable'));
            }
          } else {
            reject(new Error(stderrData || `yt-dlp a échoué avec le code ${code}`));
          }
        });

        proc.on('error', (err) => {
          reject(new Error(`Impossible de lancer yt-dlp: ${err.message}`));
        });

        req.on('close', () => {
          if (!proc.killed) {
            proc.kill('SIGTERM');
            reject(new Error('Client déconnecté'));
          }
        });
      });
    }

    // ── Helper: direct HTTP download (fallback for Snapchat Spotlight etc.) ──
    async function downloadDirect(videoUrl: string): Promise<string> {
      const outputPath = path.join(mediaDir, `${fileId}.mp4`);
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://www.snapchat.com/',
        },
        signal: AbortSignal.timeout(120000),
      });
      if (!videoResponse.ok || !videoResponse.body) {
        throw new Error(`Téléchargement direct échoué: HTTP ${videoResponse.status}`);
      }
      const contentLength = parseInt(videoResponse.headers.get('content-length') || '0', 10);
      const writer = fs.createWriteStream(outputPath);
      const reader = videoResponse.body.getReader();
      let downloaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(Buffer.from(value));
        downloaded += value.length;
        if (contentLength > 0) {
          sendSSE(res, 'progress', { progress: Math.round((downloaded / contentLength) * 100) });
        }
      }
      writer.end();
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return outputPath;
    }

    // ── Helper: extract direct video URL from Snapchat page ──
    async function extractSnapchatVideoUrl(): Promise<string | null> {
      try {
        const pageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!pageResponse.ok) {
          console.warn('[Snapchat fallback] Page fetch failed:', pageResponse.status);
          return null;
        }
        const html = await pageResponse.text();
        console.log(`[Snapchat fallback] Page fetched, ${html.length} chars`);

        // Try og:video meta tag first (accept any URL, not just .mp4)
        const ogVideoMatch = html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
        if (ogVideoMatch && ogVideoMatch[1].startsWith('http')) {
          console.log('[Snapchat fallback] Found video via og:video:', ogVideoMatch[1].slice(0, 150));
          return ogVideoMatch[1];
        }

        // Try __NEXT_DATA__ for media URL
        // Use greedy match between script tags to handle nested braces
        const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]+?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1].trim());
            const pageProps = nextData?.props?.pageProps;
            if (pageProps) {
              // Priority 1: videoMetadata.contentUrl (Spotlight pages)
              if (pageProps.videoMetadata?.contentUrl) {
                console.log('[Snapchat fallback] Found video via videoMetadata.contentUrl');
                return pageProps.videoMetadata.contentUrl;
              }

              // Priority 2: story/highlight/snap structures
              const story = pageProps.story || pageProps.highlight || pageProps.spotlight;
              const snap = story?.snapList?.[0] || story?.snaps?.[0];
              const mediaUrl = snap?.snapUrls?.mediaUrl || snap?.mediaUrl || snap?.videoUrl
                || snap?.media?.mediaUrl || snap?.snapUrls?.mediaPreviewUrl?.value
                || pageProps?.videoUrl || pageProps?.mediaUrl;
              if (mediaUrl) {
                console.log('[Snapchat fallback] Found video via story/snap:', mediaUrl.slice(0, 150));
                return mediaUrl;
              }

              // Priority 3: deep search for CDN URLs
              const jsonStr = JSON.stringify(pageProps);
              const cdnMatch = jsonStr.match(/(https?:\\\/\\\/(?:cf-st\.sc-cdn\.net|bolt-gcdn\.sc-cdn\.net)[^"]*)/);
              if (cdnMatch) {
                const decoded = cdnMatch[1].replace(/\\\//g, '/');
                // Skip thumbnail URLs (contain .256. or Thumbnail in path)
                if (!decoded.includes('.256.') && !decoded.toLowerCase().includes('thumbnail')) {
                  console.log('[Snapchat fallback] Found CDN URL in __NEXT_DATA__:', decoded.slice(0, 150));
                  return decoded;
                }
              }

              console.log('[Snapchat fallback] __NEXT_DATA__ pageProps keys:', Object.keys(pageProps));
            }
          } catch (parseErr: any) {
            console.warn('[Snapchat fallback] Failed to parse __NEXT_DATA__ JSON:', parseErr?.message);
          }
        } else {
          console.log('[Snapchat fallback] No __NEXT_DATA__ found in page');
        }

        // Try any video source URL in HTML (with or without .mp4 extension)
        const videoSrcMatch = html.match(/<(?:video|source)[^>]+src=["']([^"']+)["']/i);
        if (videoSrcMatch && videoSrcMatch[1].startsWith('http')) {
          console.log('[Snapchat fallback] Found video via <video> tag:', videoSrcMatch[1].slice(0, 150));
          return videoSrcMatch[1];
        }

        console.log('[Snapchat fallback] No video URL found in page');
        return null;
      } catch (err: any) {
        console.warn('[Snapchat fallback] Failed to extract video URL:', err?.message);
        return null;
      }
    }

    // ── Execute download: yt-dlp first, then fallbacks for Snapchat ──
    let downloadedFile = '';
    try {
      downloadedFile = await downloadWithYtdlp();
    } catch (ytdlpError: any) {
      if (platform === 'snapchat') {
        console.log('[Snapchat] yt-dlp standard failed:', (ytdlpError.message || '').slice(0, 200));

        // Fallback 1: try yt-dlp with --force-generic-extractor + custom user-agent
        let fallbackSuccess = false;
        try {
          console.log('[Snapchat] Trying yt-dlp with --force-generic-extractor...');
          sendSSE(res, 'status', { status: 'downloading', fallback: true });
          const fallbackArgs: string[] = [
            '--js-runtimes', 'node',
            '--force-generic-extractor',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            '-f', 'best',
            '--no-playlist',
            '--max-filesize', `${maxSizeMB}M`,
            '--newline',
            '-o', outputTemplate,
          ];
          if (cookiesFile) fallbackArgs.push('--cookies', cookiesFile);
          fallbackArgs.push(url);

          downloadedFile = await new Promise<string>((resolve, reject) => {
            const proc = spawn(ytdlpPath, fallbackArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stdout.on('data', (chunk: Buffer) => {
              for (const line of chunk.toString().split('\n')) {
                const m = line.match(/\[download\]\s+([\d.]+)%/);
                if (m) sendSSE(res, 'progress', { progress: parseFloat(m[1]) });
              }
            });
            proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
            proc.on('close', (code) => {
              if (code === 0) {
                const files = fs.readdirSync(mediaDir).filter(f => f.startsWith(fileId) && !f.endsWith('.json'));
                if (files.length > 0) {
                  files.sort((a, b) => fs.statSync(path.join(mediaDir, b)).size - fs.statSync(path.join(mediaDir, a)).size);
                  resolve(path.join(mediaDir, files[0]));
                } else reject(new Error('Fichier introuvable'));
              } else reject(new Error(stderr || `code ${code}`));
            });
            proc.on('error', reject);
          });
          fallbackSuccess = true;
        } catch (e: any) {
          console.log('[Snapchat] yt-dlp force-generic also failed:', (e.message || '').slice(0, 200));
        }

        // Fallback 2: direct HTTP download from page source
        if (!fallbackSuccess) {
          console.log('[Snapchat] Trying direct HTTP download...');
          const directUrl = await extractSnapchatVideoUrl();
          if (directUrl) {
            downloadedFile = await downloadDirect(directUrl);
          } else {
            throw new Error('Impossible de télécharger cette vidéo Snapchat. Ni yt-dlp ni l\'extraction directe n\'ont fonctionné.');
          }
        }
      } else {
        // Fallback: try Cobalt API for YouTube and other platforms
        const cobaltUrl = process.env.COBALT_URL || 'http://cobalt-api:9000';
        try {
          console.log(`[Download] yt-dlp failed, trying Cobalt for ${platform}...`);
          sendSSE(res, 'status', { status: 'downloading', fallback: true });
          const cobaltResp = await fetch(cobaltUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ url, videoQuality: '720', filenameStyle: 'basic' }),
          });
          const cobaltData = await cobaltResp.json() as any;
          if (cobaltData.url) {
            // Download the file from Cobalt URL
            const cobaltFileResp = await fetch(cobaltData.url);
            if (!cobaltFileResp.ok) throw new Error(`Cobalt download failed: ${cobaltFileResp.status}`);
            const outputFile = path.join(mediaDir, `${fileId}.mp4`);
            const buffer = Buffer.from(await cobaltFileResp.arrayBuffer());
            fs.writeFileSync(outputFile, buffer);
            downloadedFile = outputFile;
            console.log(`[Download] Cobalt download success: ${outputFile}`);
          } else {
            throw new Error(cobaltData.error?.code || 'Cobalt returned no URL');
          }
        } catch (cobaltErr: any) {
          console.error('[Download] Cobalt fallback failed:', cobaltErr?.message);
          // Fallback 3: Real Chrome extraction for YouTube
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
              console.log('[Download] Trying Chrome extraction...');
              sendSSE(res, 'status', { status: 'downloading', fallback: true, method: 'chrome' });
              const { downloadVideoWithChrome } = await import('./mediaController');
              const outputFile = path.join(mediaDir, `${fileId}.mp4`);
              const success = await downloadVideoWithChrome(url, outputFile);
              if (success) {
                downloadedFile = outputFile;
                console.log('[Download] Chrome download success');
              } else {
                throw new Error('Chrome download failed');
              }
            } catch (chromeErr: any) {
              console.error('[Download] Chrome fallback failed:', chromeErr?.message);
              throw ytdlpError;
            }
          } else {
            throw ytdlpError;
          }
        }
      }
    }

    // ── Read metadata from .info.json written by yt-dlp ──
    try {
      if (fs.existsSync(infoJsonPath)) {
        const json = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
        // Debug: log ALL keys that have non-null values to discover platform-specific fields
        const skipKeys = ['formats', 'thumbnails', 'subtitles', 'automatic_captions', 'requested_formats', 'requested_subtitles', 'requested_entries', '_format_sort_fields', 'http_headers', 'fragments', 'heatmap', 'requested_downloads'];
        const metaKeys = Object.keys(json).filter(k => json[k] != null && json[k] !== '' && !skipKeys.includes(k));
        const metaDebug = JSON.stringify(Object.fromEntries(metaKeys.map(k => [k, json[k]])), null, 0);
        console.log(`[yt-dlp meta] platform=${platform} (${metaDebug.length} chars):`);
        // Split long output into chunks for readability
        for (let i = 0; i < metaDebug.length; i += 500) {
          console.log(metaDebug.slice(i, i + 500));
        }
        metadata.title = json.title || json.fulltitle || metadata.title;
        metadata.duration = json.duration ?? null;
        metadata.thumbnail = json.thumbnail
          || (json.thumbnails?.length ? json.thumbnails[json.thumbnails.length - 1]?.url : null)
          || null;
        metadata.uploader = json.uploader || json.channel || json.creator || json.artist || null;
        metadata.channelHandle = json.channel || json.uploader_id || null;
        metadata.uploaderId = json.uploader_id || json.channel_id || null;

        // Extract username from URL for platforms that embed it (Snapchat: /@username/...)
        if (!metadata.uploader && !metadata.channelHandle) {
          const snapMatch = url.match(/snapchat\.com\/@([^/]+)/);
          if (snapMatch) {
            metadata.channelHandle = snapMatch[1];
            metadata.uploader = snapMatch[1];
          }
        }

        // For Instagram, prefer channel (username) over uploader_id (numeric)
        if (platform === 'instagram') {
          metadata.channelHandle = json.channel || json.uploader || null;
        }

        metadata.uploaderUrl = json.uploader_url || json.channel_url || null;
        if (!metadata.uploaderUrl) {
          const username = json.channel || metadata.channelHandle || metadata.uploader;
          if (username) {
            if (platform === 'instagram') metadata.uploaderUrl = `https://www.instagram.com/${username}/`;
            else if (platform === 'tiktok') metadata.uploaderUrl = `https://www.tiktok.com/@${username}`;
            else if (platform === 'x') metadata.uploaderUrl = `https://x.com/${username}`;
            else if (platform === 'youtube') metadata.uploaderUrl = `https://www.youtube.com/@${username}`;
            else if (platform === 'facebook') metadata.uploaderUrl = `https://www.facebook.com/${username}`;
            else if (platform === 'snapchat') metadata.uploaderUrl = `https://www.snapchat.com/add/${username}`;
          }
        }
        metadata.description = json.description || null;
        metadata.viewCount = json.view_count ?? null;
        metadata.likeCount = json.like_count ?? null;
        metadata.commentCount = json.comment_count ?? null;
        metadata.tags = Array.isArray(json.tags) && json.tags.length > 0 ? json.tags : [];
        if (metadata.tags.length === 0 && json.description) {
          const hashtags = json.description.match(/#[\w\u00C0-\u024F]+/g);
          if (hashtags) metadata.tags = hashtags.map((h: string) => h.slice(1));
        }
        // Upload date: try upload_date (YYYYMMDD), then timestamp/release_timestamp (Unix)
        if (json.upload_date && json.upload_date.length === 8) {
          metadata.uploadDate = `${json.upload_date.slice(0, 4)}-${json.upload_date.slice(4, 6)}-${json.upload_date.slice(6, 8)}`;
        } else if (json.timestamp || json.release_timestamp) {
          const ts = json.timestamp || json.release_timestamp;
          const d = new Date(ts * 1000);
          metadata.uploadDate = d.toISOString().slice(0, 10);
        }
        metadata.webpageUrl = json.webpage_url || url;

        // Send metadata to client now that we have it
        sendSSE(res, 'metadata', metadata);

        // Cleanup info.json
        fs.unlinkSync(infoJsonPath);
      }
    } catch (metaErr: any) {
      console.warn('Failed to read info.json:', metaErr?.message);
    }

    // ── Snapchat: enrich from __NEXT_DATA__ (runs even without info.json for direct fallback) ──
    if (platform === 'snapchat') {
      const nextData = await fetchSnapchatNextData(url);
      if (nextData) {
        try {
          const pageProps = nextData.props?.pageProps;

          // ── videoMetadata (Spotlight pages) ──
          const vm = pageProps?.videoMetadata;
          if (vm) {
            if (vm.name && vm.name !== 'Spotlight Snap' && metadata.title === 'Vidéo téléchargée') {
              metadata.title = vm.name;
            }
            if (vm.uploadDateMs && !metadata.uploadDate) {
              const d = new Date(parseInt(vm.uploadDateMs, 10));
              if (!isNaN(d.getTime())) metadata.uploadDate = d.toISOString().slice(0, 10);
            }
            if (vm.durationMs && !metadata.duration) {
              metadata.duration = Math.round(parseInt(vm.durationMs, 10) / 1000);
            }
            if (vm.viewCount) metadata.viewCount = parseInt(vm.viewCount, 10) || null;
            if (vm.shareCount) metadata.likeCount = parseInt(vm.shareCount, 10) || metadata.likeCount;
            if (vm.thumbnailUrl) metadata.thumbnail = metadata.thumbnail || vm.thumbnailUrl;
            if (vm.description && !metadata.description) metadata.description = vm.description;
            if (vm.keywords?.length) metadata.tags = vm.keywords;
            // Creator info
            const creator = vm.creator?.personCreator;
            if (creator) {
              metadata.channelHandle = creator.username;
              metadata.uploader = creator.name || creator.username;
              metadata.uploaderUrl = creator.url || `https://www.snapchat.com/add/${creator.username}`;
            }
          }

          // ── linkPreview (Spotlight title) ──
          const lp = pageProps?.linkPreview;
          if (lp?.title && metadata.title === 'Vidéo téléchargée') {
            metadata.title = lp.title;
          }

          // ── story/highlight/snap structures ──
          const story = pageProps?.story || pageProps?.snap || pageProps?.spotlight || pageProps?.highlight;

          let snapMeta: any = null;
          if (story?.snapList?.[0]) snapMeta = story.snapList[0];
          else if (story?.snaps?.[0]) snapMeta = story.snaps[0];
          else if (pageProps?.encodedStorySnap) {
            try { snapMeta = JSON.parse(pageProps.encodedStorySnap); } catch {}
          }

          // creationTimestampMs → publication date
          const creationTs = snapMeta?.creationTimestampMs || story?.creationTimestampMs || pageProps?.creationTimestampMs;
          if (creationTs && !metadata.uploadDate) {
            const d = new Date(typeof creationTs === 'string' ? parseInt(creationTs, 10) : creationTs);
            if (!isNaN(d.getTime())) metadata.uploadDate = d.toISOString().slice(0, 10);
          }

          // Username from page data (if not already from videoMetadata)
          if (!metadata.channelHandle || metadata.channelHandle === 'snapchat') {
            const pageUsername = pageProps?.userProfile?.username || pageProps?.publicUserProfile?.username
              || pageProps?.username || story?.username || snapMeta?.username;
            if (pageUsername) {
              metadata.channelHandle = pageUsername;
              if (!metadata.uploader || metadata.uploader === 'snapchat' || metadata.uploader === 'Vidéo téléchargée') {
                metadata.uploader = pageProps?.userProfile?.displayName || pageProps?.publicUserProfile?.displayName
                  || pageProps?.userProfile?.title || pageUsername;
              }
              metadata.uploaderUrl = `https://www.snapchat.com/add/${pageUsername}`;
            }
          }

          // Title from snap data or page metadata
          if (metadata.title === 'Vidéo téléchargée') {
            const snapTitle = snapMeta?.title || story?.title || pageProps?.pageMetadata?.pageTitle;
            if (snapTitle && snapTitle.length < 200) {
              metadata.title = snapTitle;
            }
          }
        } catch (parseErr: any) {
          console.warn('[Snapchat] Failed to parse __NEXT_DATA__:', parseErr?.message);
        }
      }

      // Fallback: parse metadata from yt-dlp title if available
      const rawTitle = metadata.title || '';
      if (rawTitle.includes(' | ')) {
        // Parse engagement from title: "172,6 K likes et 1,5 K partages"
        if (!metadata.likeCount) {
          const engMatch = rawTitle.match(/([\d.,]+\s*K?)\s*likes?\s*(?:et|and)\s*([\d.,]+\s*K?)\s*(?:partages?|shares?)/i);
          if (engMatch) {
            metadata.likeCount = parseCompactNumber(engMatch[1]);
            metadata.viewCount = parseCompactNumber(engMatch[2]);
          }
        }

        // Parse username from title: "DisplayName (@username)"
        if (!metadata.channelHandle || metadata.channelHandle === 'snapchat') {
          const userMatch = rawTitle.match(/([^|]+?)\s*\(@(\w+)\)/);
          if (userMatch) {
            metadata.uploader = userMatch[1].trim();
            metadata.channelHandle = userMatch[2];
            metadata.uploaderUrl = `https://www.snapchat.com/add/${userMatch[2]}`;
          }
        }

        // Parse date from title: "Date de publication : 10 déc. 2025"
        if (!metadata.uploadDate) {
          const dateMatch = rawTitle.match(/(?:Date de publication|Published(?: date)?)\s*:\s*([^|]+)/i);
          if (dateMatch) {
            metadata.uploadDate = parseLocalizedDate(dateMatch[1].trim());
          }
        }

        // Clean title: remove engagement stats and metadata parts
        const parts = rawTitle.split(' | ').map((p: string) => p.trim());
        if (parts.length >= 3) {
          const titleParts = parts.filter((p: string) =>
            !p.match(/^\d[\d.,]*\s*K?\s*likes?/i) &&
            !p.match(/\(@\w+\)/) &&
            !p.match(/^(?:Date de publication|Published)/i) &&
            !p.match(/^Spotlight\s*\(/i)
          );
          if (titleParts.length > 0 && titleParts[0].length < 200) {
            metadata.title = titleParts[0];
          }
        }
      }
      // Remove trailing " (1)" from title
      if (metadata.title) {
        metadata.title = metadata.title.replace(/\s*\(\d+\)\s*$/, '').trim();
      }

      // Extract username from URL as last resort
      if (!metadata.channelHandle) {
        const snapMatch = url.match(/snapchat\.com\/@([^/]+)/);
        if (snapMatch) {
          metadata.channelHandle = snapMatch[1];
          if (!metadata.uploader || metadata.uploader === 'Vidéo téléchargée') {
            metadata.uploader = snapMatch[1];
          }
          metadata.uploaderUrl = `https://www.snapchat.com/add/${snapMatch[1]}`;
        }
      }

      // Re-send enriched metadata
      sendSSE(res, 'metadata', metadata);
    }

    // ── Fallback: extract duration via ffprobe if yt-dlp didn't provide it ──
    if (!metadata.duration) {
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'quiet', '-print_format', 'json', '-show_format', downloadedFile,
        ]);
        const ffData = JSON.parse(stdout);
        if (ffData.format?.duration) {
          metadata.duration = Math.round(parseFloat(ffData.format.duration));
          // Re-send updated metadata with duration
          sendSSE(res, 'metadata', metadata);
        }
      } catch { /* ffprobe not available or failed */ }
    }

    // ── Step 3: Create node ──
    const filename = path.basename(downloadedFile);
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const fileSize = fs.statSync(downloadedFile).size;

    // Determine mime type
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      flv: 'video/x-flv',
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      wav: 'audio/wav',
    };
    const mimeType = mimeMap[ext] || 'video/mp4';
    const mediaType = mimeType.startsWith('audio/') ? 'audio' : 'video';

    const mediaData = {
      source: {
        type: 'upload',
        fileUrl: `uploads/media/${filename}`,
        mimeType,
        mediaType,
      },
      metadata: {
        title: metadata.title,
        platform,
        channelName: metadata.channelHandle && metadata.uploader && metadata.channelHandle !== metadata.uploader
          ? `${metadata.uploader} (@${metadata.channelHandle})`
          : metadata.uploader || metadata.channelHandle || null,
        channelUrl: metadata.uploaderUrl,
        sourceUrl: metadata.webpageUrl,
        publishedAt: metadata.uploadDate,
        duration: metadata.duration,
        description: metadata.description,
        tags: metadata.tags,
        thumbnailUrl: metadata.thumbnail,
        viewCount: metadata.viewCount,
        likeCount: metadata.likeCount,
        commentCount: metadata.commentCount,
      },
      annotations: [] as any[],
    };

    let node: any;
    if (nodeId) {
      // Update existing node instead of creating a new one
      const existing = await DossierNode.findById(nodeId);
      if (existing && existing.dossierId?.toString() === dossierId) {
        // Preserve existing annotations if mediaData is an object (not encrypted string)
        if (existing.mediaData && typeof existing.mediaData === 'object' && existing.mediaData.annotations) {
          mediaData.annotations = existing.mediaData.annotations;
        }
        node = await DossierNode.findByIdAndUpdate(nodeId, {
          $set: { type: 'media', title: metadata.title, mediaData, fileSize },
        }, { returnDocument: 'after' });
      } else {
        node = await DossierNode.create({ dossierId, parentId: parentId || null, type: 'media', title: metadata.title, mediaData, fileSize });
      }
    } else {
      node = await DossierNode.create({ dossierId, parentId: parentId || null, type: 'media', title: metadata.title, mediaData, fileSize });
    }

    sendSSE(res, 'complete', {
      node: {
        _id: node._id,
        dossierId: node.dossierId,
        parentId: node.parentId,
        type: node.type,
        title: node.title,
        mediaData: node.mediaData,
        fileSize,
      },
    });

    // ── Log activity ──
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'media.download', 'node', node._id.toString(), {
      dossierId,
      platform,
      url,
      title: metadata.title,
      fileSize,
    }, ip, ua);

    res.end();
  } catch (error: any) {
    console.error('downloadVideo error:', error?.message || error);

    // If headers already sent (SSE mode), send error event
    if (res.headersSent) {
      sendSSE(res, 'error', { error: error?.message || 'Erreur lors du téléchargement' });
      res.end();
    } else {
      res.status(500).json({ error: error?.message || 'Erreur lors du téléchargement' });
    }

    // Cleanup partial downloads
    if (outputFilePattern) {
      const mediaDir = path.join(UPLOAD_DIR, 'media');
      try {
        const fileId = path.basename(outputFilePattern).split('.')[0];
        if (fileId && fs.existsSync(mediaDir)) {
          const partialFiles = fs.readdirSync(mediaDir).filter(f => f.startsWith(fileId));
          for (const f of partialFiles) {
            try {
              fs.unlinkSync(path.join(mediaDir, f));
            } catch { /* ignore cleanup errors */ }
          }
        }
      } catch { /* ignore cleanup errors */ }
    }
  } finally {
    // Decrement active downloads counter
    const current = activeDownloads.get(userId) || 0;
    if (current <= 1) {
      activeDownloads.delete(userId);
    } else {
      activeDownloads.set(userId, current - 1);
    }

    // Cleanup temp cookies file
    if (cookiesFile) {
      try {
        if (fs.existsSync(cookiesFile)) {
          fs.unlinkSync(cookiesFile);
        }
      } catch { /* ignore cleanup errors */ }
    }
  }
}
