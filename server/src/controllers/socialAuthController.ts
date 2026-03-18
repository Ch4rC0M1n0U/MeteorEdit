import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Response } from 'express';
import SocialCookie from '../models/SocialCookie';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { encryptCookies, decryptCookies } from '../utils/cookieCrypto';

// Persistent user data dir so the browser looks like a real Chrome
const LOGIN_PROFILE_DIR = path.resolve(__dirname, '..', '..', '.chromium-login-profile');

/**
 * Find system Chrome/Edge executable for login (more trusted by Google than bundled Chromium).
 */
function findSystemBrowser(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    // Windows Chrome
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    // Windows Edge (Chromium-based)
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    // Windows Brave
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { }
  }
  return undefined;
}

const PLATFORM_LOGIN_URLS: Record<string, string> = {
  youtube: 'https://accounts.google.com/signin',
  instagram: 'https://www.instagram.com/accounts/login/',
  tiktok: 'https://www.tiktok.com/login',
  snapchat: 'https://accounts.snapchat.com/accounts/v2/login',
  facebook: 'https://www.facebook.com/login',
  x: 'https://x.com/i/flow/login',
  threads: 'https://www.threads.net/login',
  linkedin: 'https://www.linkedin.com/login',
  strava: 'https://www.strava.com/login',
};

const POST_LOGIN_INDICATORS: Record<string, string[]> = {
  youtube: ['myaccount.google.com', 'youtube.com/feed', 'youtube.com/?'],
  instagram: ['instagram.com/direct', 'instagram.com/accounts/onetap'],
  tiktok: ['tiktok.com/foryou', 'tiktok.com/following'],
  snapchat: ['accounts.snapchat.com/accounts/welcome', 'web.snapchat.com'],
  facebook: ['facebook.com/home', 'facebook.com/?sk='],
  x: ['x.com/home', 'twitter.com/home'],
  threads: ['threads.net/@', 'threads.net/home'],
  linkedin: ['linkedin.com/feed', 'linkedin.com/mynetwork'],
  strava: ['strava.com/dashboard', 'strava.com/athlete/'],
};

// Session cookies that prove actual authentication (not just cookie consent)
const AUTH_COOKIE_NAMES: Record<string, string[]> = {
  youtube: ['SID', 'SSID', 'HSID'],
  instagram: ['sessionid', 'ds_user_id'],
  tiktok: ['sessionid', 'sid_tt'],
  snapchat: ['sc-a-session', 'sc-a-nonce'],
  facebook: ['c_user', 'xs'],
  x: ['auth_token', 'ct0'],
  threads: ['sessionid', 'ds_user_id'],
  linkedin: ['li_at', 'JSESSIONID'],
  strava: ['_strava4_session', 'strava_remember_id'],
};

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function socialLogin(req: AuthRequest, res: Response): Promise<void> {
  const platform = req.params.platform as string;
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';

  if (!PLATFORM_LOGIN_URLS[platform]) {
    res.status(400).json({ message: `Plateforme non supportée: ${platform}` });
    return;
  }

  // Check if platform is enabled in SiteSettings
  const settings = await SiteSettings.findOne();
  const enabledPlatforms = settings?.osint?.enabledPlatforms || [];
  if (!enabledPlatforms.includes(platform)) {
    res.status(403).json({ message: `La plateforme ${platform} n'est pas activée` });
    return;
  }

  let browser;
  try {
    // Use system Chrome/Edge if available (trusted by Google), fallback to bundled Chromium
    const systemBrowser = findSystemBrowser();
    console.log(`[SocialAuth] Using browser: ${systemBrowser || 'bundled Chromium'}`);

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-extensions-except=',
      '--disable-default-apps',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-agent=${CHROME_USER_AGENT}`,
    ];

    // Ensure persistent profile directory exists (Google trusts persistent profiles)
    if (!fs.existsSync(LOGIN_PROFILE_DIR)) {
      fs.mkdirSync(LOGIN_PROFILE_DIR, { recursive: true });
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: systemBrowser,
      userDataDir: LOGIN_PROFILE_DIR,
      args: launchArgs,
      defaultViewport: null, // Use natural window size (more realistic)
      ignoreDefaultArgs: ['--enable-automation'], // Remove "Chrome is being controlled" banner
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Clear auth cookies for the target platform BEFORE navigating
    // This prevents "already logged in" false positives while keeping the browser profile trusted
    const cdpInit = await page.createCDPSession();
    const { cookies: existingCookies } = await cdpInit.send('Network.getAllCookies');

    // Map each platform to ALL domains whose cookies should be cleared
    const PLATFORM_COOKIE_DOMAINS: Record<string, string[]> = {
      youtube: ['youtube.com', 'google.com', 'accounts.google.com', 'googleapis.com'],
      instagram: ['instagram.com'],
      tiktok: ['tiktok.com'],
      snapchat: ['snapchat.com'],
      facebook: ['facebook.com', 'fbcdn.net'],
      x: ['x.com', 'twitter.com'],
      threads: ['threads.net', 'instagram.com'],
      linkedin: ['linkedin.com'],
      strava: ['strava.com', 'google.com', 'accounts.google.com', 'facebook.com', 'appleid.apple.com'],
    };
    const domainsToClean = PLATFORM_COOKIE_DOMAINS[platform] || [];
    let clearedCount = 0;
    for (const cookie of existingCookies) {
      if (domainsToClean.some(d => cookie.domain.includes(d))) {
        await cdpInit.send('Network.deleteCookies', { name: cookie.name, domain: cookie.domain });
        clearedCount++;
      }
    }
    console.log(`[SocialAuth] Cleared ${clearedCount} cookies for ${platform} (domains: ${domainsToClean.join(', ')})`);
    await cdpInit.detach();

    // Anti-detection: mask webdriver and automation signals
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Fake plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });
      // Fake languages
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
      // Chrome runtime
      // @ts-ignore
      window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
      // Remove automation-related properties
      delete (navigator as any).__proto__.webdriver;
    });

    const loginUrl = PLATFORM_LOGIN_URLS[platform];
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for user to complete login — check both URL indicators AND auth cookies
    const indicators = POST_LOGIN_INDICATORS[platform];
    const authCookieNames = AUTH_COOKIE_NAMES[platform] || [];

    // Use CDP to get ALL cookies (page.cookies() only returns current domain)
    const cdpSession = await page.createCDPSession();

    const getAllCookies = async (): Promise<any[]> => {
      try {
        const { cookies: allCookies } = await cdpSession.send('Network.getAllCookies');
        return allCookies;
      } catch {
        // Fallback to page.cookies if CDP fails
        return await page.cookies().catch(() => []);
      }
    };

    // Wait for login, and capture cookies IMMEDIATELY when detected
    let capturedCookies: any[] = [];

    const loggedIn = await new Promise<boolean>((resolve) => {
      let resolved = false;
      const safeResolve = (value: boolean) => {
        if (!resolved) { resolved = true; resolve(value); }
      };

      const timeout = setTimeout(() => {
        console.log(`[SocialAuth] Login timeout for ${platform}`);
        safeResolve(false);
      }, LOGIN_TIMEOUT_MS);

      const checkLogin = async () => {
        try {
          const currentUrl = page.url();
          const urlMatched = indicators.some((indicator) => currentUrl.includes(indicator));

          // Use CDP to get ALL cookies across all domains
          const allCookies = await getAllCookies();
          const cookieNames = allCookies.map((c: any) => c.name);
          const hasAllAuthCookies = authCookieNames.length === 0 ||
            authCookieNames.every(name => cookieNames.includes(name));

          if (hasAllAuthCookies && authCookieNames.length > 0 && (urlMatched || true)) {
            // Capture cookies IMMEDIATELY before browser might close
            capturedCookies = allCookies;
            console.log(`[SocialAuth] ${platform} login confirmed. URL: ${currentUrl}`);
            console.log(`[SocialAuth] Auth cookies found: ${authCookieNames.filter(n => cookieNames.includes(n)).join(', ')}`);
            console.log(`[SocialAuth] Captured ${allCookies.length} cookies immediately`);
            clearTimeout(timeout);
            clearInterval(interval);
            safeResolve(true);
          }
        } catch (err) {
          // Page may have been closed — not fatal if we already have cookies
          if (capturedCookies.length > 0) {
            clearTimeout(timeout);
            clearInterval(interval);
            safeResolve(true);
          }
        }
      };

      const interval = setInterval(checkLogin, 2000);

      // If browser is closed by user after login was detected, that's OK
      browser!.on('disconnected', () => {
        console.log(`[SocialAuth] Browser disconnected for ${platform} (cookies captured: ${capturedCookies.length})`);
        clearTimeout(timeout);
        clearInterval(interval);
        // If we already captured cookies, consider it a success
        safeResolve(capturedCookies.length > 0);
      });
    });

    // Try to close browser gracefully (might already be closed)
    await cdpSession.detach().catch(() => {});
    await browser.close().catch(() => {});

    if (!loggedIn || capturedCookies.length === 0) {
      res.status(408).json({ message: 'Connexion expirée ou navigateur fermé' });
      return;
    }

    console.log(`[SocialAuth] Saving ${capturedCookies.length} cookies for ${platform}...`);

    // Encrypt and store cookies
    const encrypted = encryptCookies(capturedCookies);

    await SocialCookie.findOneAndUpdate(
      { userId: req.user!.userId, platform },
      { cookies: encrypted },
      { upsert: true, returnDocument: 'after' }
    );

    await logActivity(req.user!.userId, 'social.login', 'system', null, { platform, cookieCount: capturedCookies.length }, ip, ua);

    console.log(`[SocialAuth] ${platform} cookies saved successfully (${capturedCookies.length} cookies)`);
    res.json({ message: 'Connexion réussie', platform, cookieCount: capturedCookies.length });
  } catch (err: any) {
    console.error(`[SocialAuth] Error during ${platform} login:`, err);
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ message: 'Erreur lors de la connexion', error: err.message });
  }
}

export async function listCookies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const cookies = await SocialCookie.find(
      { userId: req.user!.userId },
      { platform: 1, updatedAt: 1, _id: 0 }
    ).lean();

    res.json(cookies);
  } catch (err: any) {
    console.error('[SocialAuth] Error listing cookies:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des cookies' });
  }
}

export async function deleteCookies(req: AuthRequest, res: Response): Promise<void> {
  const platform = req.params.platform as string;
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';

  try {
    const result = await SocialCookie.deleteOne({ userId: req.user!.userId, platform });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Aucun cookie trouvé pour cette plateforme' });
      return;
    }

    await logActivity(req.user!.userId, 'social.deleteCookies', 'system', null, { platform }, ip, ua);

    res.json({ message: 'Cookies supprimés', platform });
  } catch (err: any) {
    console.error('[SocialAuth] Error deleting cookies:', err);
    res.status(500).json({ message: 'Erreur lors de la suppression des cookies' });
  }
}

/**
 * Import cookies manually (from browser extension export like Cookie-Editor).
 * Accepts an array of cookie objects and stores them encrypted.
 */
export async function importCookies(req: AuthRequest, res: Response): Promise<void> {
  const platform = req.params.platform as string;
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';

  try {
    const { cookies } = req.body;

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      res.status(400).json({ message: 'Aucun cookie fourni' });
      return;
    }

    // Normalize cookies to Puppeteer format
    const normalized = cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: (c.sameSite || 'Lax'),
    })).filter((c: any) => c.name && c.value);

    if (normalized.length === 0) {
      res.status(400).json({ message: 'Aucun cookie valide trouvé' });
      return;
    }

    const encrypted = encryptCookies(normalized);

    await SocialCookie.findOneAndUpdate(
      { userId: req.user!.userId, platform },
      { cookies: encrypted },
      { upsert: true, returnDocument: 'after' }
    );

    await logActivity(req.user!.userId, 'social.importCookies', 'system', null, { platform, cookieCount: normalized.length }, ip, ua);

    console.log(`[SocialAuth] Imported ${normalized.length} cookies for ${platform}`);
    res.json({ message: 'Cookies importés avec succès', platform, cookieCount: normalized.length });
  } catch (err: any) {
    console.error(`[SocialAuth] Error importing cookies for ${platform}:`, err);
    res.status(500).json({ message: 'Erreur lors de l\'import des cookies' });
  }
}

/**
 * Export cookies to a Netscape-format temporary file for yt-dlp.
 * Returns the file path or null if no cookies found.
 */
export async function exportCookiesFile(userId: string, platform: string): Promise<string | null> {
  try {
    const record = await SocialCookie.findOne({ userId, platform });
    if (!record) return null;

    const cookies = decryptCookies(record.cookies) as Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
    }>;

    // Build Netscape cookie file format
    const lines = ['# Netscape HTTP Cookie File', '# Generated by MeteorEdit', ''];

    for (const c of cookies) {
      const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
      const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const httpOnly = c.httpOnly ? '#HttpOnly_' : '';
      const expires = c.expires ? Math.round(c.expires) : 0;

      lines.push(`${httpOnly}${domain}\t${includeSubdomains}\t${c.path || '/'}\t${secure}\t${expires}\t${c.name}\t${c.value}`);
    }

    const tmpDir = path.join(os.tmpdir(), 'meteoredit-cookies');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const filePath = path.join(tmpDir, `${userId}_${platform}_${Date.now()}.txt`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    return filePath;
  } catch (err) {
    console.error(`[SocialAuth] Error exporting cookies for ${platform}:`, err);
    return null;
  }
}
