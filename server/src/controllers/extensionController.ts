import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import type { ExtensionRequest } from '../middleware/extensionAuth';
import User from '../models/User';
import SocialCookie, { SUPPORTED_PLATFORMS, SocialPlatform } from '../models/SocialCookie';
import { encryptCookieList, type StoredCookie } from '../utils/cookieEncryption';
import { logActivity } from '../utils/activityLogger';

function getRequestMeta(req: ExtensionRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

/**
 * GET /api/extension/auth/verify
 * Confirms the bearer token is valid and returns minimal user info.
 */
export async function verify(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('email firstName lastName').lean();
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({
      ok: true,
      user: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/extension/cookies/import
 * body: { platform, cookies: StoredCookie[] }
 *
 * Cookies are encrypted at-rest with the server master key (COOKIE_ENCRYPTION_KEY).
 * They replace any existing webCookies for that user/platform pair.
 */
export async function importCookies(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const tokenId = req.user!.tokenId;
    const { platform, cookies } = req.body ?? {};

    if (!SUPPORTED_PLATFORMS.includes(platform as SocialPlatform)) {
      res.status(400).json({ message: `Unsupported platform: ${platform}` });
      return;
    }
    if (!Array.isArray(cookies) || cookies.length === 0) {
      res.status(400).json({ message: 'Cookies array is required and non-empty' });
      return;
    }

    // Sanitize incoming cookies to known fields only
    const clean: StoredCookie[] = cookies.map((c: any) => ({
      name: String(c.name ?? '').slice(0, 256),
      value: String(c.value ?? '').slice(0, 8192),
      domain: String(c.domain ?? '').slice(0, 256),
      path: String(c.path ?? '/').slice(0, 256),
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      sameSite: typeof c.sameSite === 'string' ? c.sameSite : undefined,
      expirationDate: typeof c.expirationDate === 'number' ? c.expirationDate : null,
    })).filter((c) => c.name && c.value);

    if (clean.length === 0) {
      res.status(400).json({ message: 'No valid cookies in payload' });
      return;
    }

    const encrypted = encryptCookieList(clean);

    await SocialCookie.findOneAndUpdate(
      { userId, platform },
      {
        $set: {
          webCookiesEncrypted: encrypted,
          webCookiesCount: clean.length,
          webCookiesUpdatedAt: new Date(),
          webCookiesUpdatedVia: 'extension',
        },
        $setOnInsert: {
          userId,
          platform,
          sessionMode: 'cookies',
        },
      },
      { upsert: true, new: true }
    );

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'extension.cookies.import', 'system', String(tokenId), {
      platform,
      cookieCount: clean.length,
    }, ip, ua);

    res.status(201).json({
      success: true,
      platform,
      cookieCount: clean.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/extension/sessions
 * Lists all platforms with stored web cookies for the current user.
 * Used by the web UI (Profile > Sessions sociales) — session-auth.
 */
export async function listMySessions(req: any, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sessions = await SocialCookie.find({
      userId,
      webCookiesEncrypted: { $ne: null },
    })
      .sort({ webCookiesUpdatedAt: -1 })
      .select('platform webCookiesCount webCookiesUpdatedAt webCookiesUpdatedVia')
      .lean();

    res.json({
      sessions: sessions.map((s) => ({
        platform: s.platform,
        cookieCount: s.webCookiesCount ?? 0,
        updatedAt: s.webCookiesUpdatedAt,
        updatedVia: s.webCookiesUpdatedVia,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/extension/download
 * Public endpoint that streams the extension folder as a ZIP, ready to be
 * loaded as an unpacked extension (Chrome/Edge/Brave).
 */
export async function downloadExtension(_req: any, res: Response): Promise<void> {
  try {
    // From server/dist/controllers/extensionController.js → up to /app
    const extensionRoot = path.resolve(__dirname, '..', '..', 'extension');
    if (!fs.existsSync(extensionRoot)) {
      res.status(500).json({ message: 'Extension folder not found on server' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="meteoredit-extension.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('[extension.download] archive error:', err);
      try { res.end(); } catch { /* already closed */ }
    });
    archive.pipe(res);
    archive.directory(extensionRoot, false);
    await archive.finalize();
  } catch (err: unknown) {
    console.error('[extension.download] error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
    }
  }
}

/**
 * DELETE /api/extension/sessions/:platform
 * Clears stored web cookies for the given platform — session-auth.
 */
export async function clearMySession(req: any, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { platform } = req.params;
    if (!SUPPORTED_PLATFORMS.includes(platform as SocialPlatform)) {
      res.status(400).json({ message: 'Unsupported platform' });
      return;
    }
    await SocialCookie.updateOne(
      { userId, platform },
      {
        $set: {
          webCookiesEncrypted: null,
          webCookiesCount: 0,
          webCookiesUpdatedAt: null,
          webCookiesUpdatedVia: null,
        },
      }
    );

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'extension.cookies.clear', 'system', null, { platform }, ip, ua);

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
