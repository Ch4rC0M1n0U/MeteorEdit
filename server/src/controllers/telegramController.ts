import { Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import SiteSettings from '../models/SiteSettings';
import { logActivity } from '../utils/activityLogger';

const execFileAsync = promisify(execFile);
// In production, __dirname is /app/dist/controllers/ — script is in /app/src/scripts/
const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'src', 'scripts', 'telegram_client.py');

/** Get Telegram API credentials from admin settings */
async function getTelegramConfig(): Promise<{ apiId: string; apiHash: string }> {
  const settings = await SiteSettings.findOne() as any;
  const tg = settings?.osint?.telegramConfig;
  return {
    apiId: tg?.apiId?.toString() || process.env.TELEGRAM_API_ID || '',
    apiHash: tg?.apiHash || process.env.TELEGRAM_API_HASH || '',
  };
}

/** Get user's Telegram session from preferences */
async function getUserSession(userId: string): Promise<string> {
  const user = await User.findById(userId).select('preferences');
  return user?.preferences?.telegramSession || '';
}

/** Save user's Telegram session to preferences */
async function saveUserSession(userId: string, session: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    $set: { 'preferences.telegramSession': session },
  });
}

/** Call the Python Telethon script */
async function callTelethon(action: string, params: Record<string, any>): Promise<any> {
  try {
    const { stdout, stderr } = await execFileAsync('python3', [
      SCRIPT_PATH, action, JSON.stringify(params),
    ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });

    if (stderr) console.warn('[Telegram] stderr:', stderr.substring(0, 200));

    const result = JSON.parse(stdout.trim());
    if (result.error) throw new Error(result.error);
    return result;
  } catch (err: any) {
    // Try to parse JSON error from stdout
    if (err.stdout) {
      try {
        const result = JSON.parse(err.stdout.trim());
        if (result.error) throw new Error(result.error);
      } catch { /* not JSON */ }
    }
    throw new Error(err.message || 'Telegram client error');
  }
}

// ─── Auth: Send OTP code ───

export async function telegramSendCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'Phone number required' }); return; }

    const config = await getTelegramConfig();
    if (!config.apiId || !config.apiHash) {
      res.status(400).json({ error: 'Telegram API not configured. Ask admin to set API ID/Hash in OSINT settings.' });
      return;
    }

    const result = await callTelethon('auth_send_code', {
      ...config, phone, session: '',
    });

    // Save temporary session (contains phone code hash)
    await saveUserSession(userId, result.session);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'telegram.auth.sendCode', 'system', null, { phone: phone.replace(/\d(?=\d{4})/g, '*') }, ip, req.headers['user-agent'] || '');

    res.json({ success: true, phoneCodeHash: result.phoneCodeHash });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Auth: Verify code + optional 2FA ───

export async function telegramSignIn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { phone, code, phoneCodeHash, password } = req.body;

    const config = await getTelegramConfig();
    const session = await getUserSession(userId);

    const result = await callTelethon('auth_sign_in', {
      ...config, session, phone, code, phoneCodeHash, password,
    });

    if (result.needs2FA) {
      await saveUserSession(userId, result.session);
      res.json({ needs2FA: true });
      return;
    }

    // Save authenticated session
    await saveUserSession(userId, result.session);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'telegram.auth.signIn', 'system', null, { telegramUser: result.user?.username }, ip, req.headers['user-agent'] || '');

    res.json({ success: true, user: result.user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Auth: Check status ───

export async function telegramAuthStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const config = await getTelegramConfig();
    const session = await getUserSession(userId);

    if (!session) {
      res.json({ authorized: false });
      return;
    }

    const result = await callTelethon('auth_status', { ...config, session });
    res.json(result);
  } catch {
    res.json({ authorized: false });
  }
}

// ─── Auth: Logout ───

export async function telegramLogout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const config = await getTelegramConfig();
    const session = await getUserSession(userId);

    if (session) {
      await callTelethon('logout', { ...config, session });
    }
    await saveUserSession(userId, '');

    res.json({ success: true });
  } catch {
    // Clear session even on error
    await saveUserSession(req.user!.userId, '');
    res.json({ success: true });
  }
}

// ─── Search: channels + users ───

export async function telegramSearch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { query, limit } = req.body;
    if (!query) { res.status(400).json({ error: 'Query required' }); return; }

    const config = await getTelegramConfig();
    const session = await getUserSession(userId);
    if (!session) { res.status(401).json({ error: 'Telegram not connected' }); return; }

    const result = await callTelethon('search', { ...config, session, query, limit: limit || 20 });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'telegram.search', 'system', null, { query, channels: result.totalChannels, users: result.totalUsers }, ip, req.headers['user-agent'] || '');

    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
}

// ─── Search messages in a channel ───

export async function telegramSearchMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { query, peer, limit } = req.body;
    if (!peer) { res.status(400).json({ error: 'Channel username (peer) required' }); return; }

    const config = await getTelegramConfig();
    const session = await getUserSession(userId);
    if (!session) { res.status(401).json({ error: 'Telegram not connected' }); return; }

    const result = await callTelethon('search_messages', { ...config, session, query, peer, limit: limit || 50 });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
}

// ─── Resolve username ───

export async function telegramResolveUsername(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { username } = req.body;
    if (!username) { res.status(400).json({ error: 'Username required' }); return; }

    const config = await getTelegramConfig();
    const session = await getUserSession(userId);
    if (!session) { res.status(401).json({ error: 'Telegram not connected' }); return; }

    const result = await callTelethon('resolve_username', { ...config, session, username });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
}

// ─── Phone lookup ───

export async function telegramPhoneLookup(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'Phone number required' }); return; }

    const config = await getTelegramConfig();
    const session = await getUserSession(userId);
    if (!session) { res.status(401).json({ error: 'Telegram not connected' }); return; }

    const result = await callTelethon('phone_lookup', { ...config, session, phone });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'telegram.phoneLookup', 'system', null, { phone: phone.replace(/\d(?=\d{4})/g, '*'), found: result.found }, ip, req.headers['user-agent'] || '');

    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
}
