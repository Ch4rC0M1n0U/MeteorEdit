import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { encryptCookies, decryptCookies } from '../utils/cookieEncryption';
import { logActivity } from '../utils/activityLogger';

function getRequestMeta(req: AuthRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

/**
 * GET /api/auth/external-tokens
 * Returns whether each external token is configured (presence flags only — never the value).
 */
export async function listExternalTokens(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId).select('bceApiToken openCorporatesApiToken').lean();
    res.json({
      bce: { configured: !!user?.bceApiToken },
      openCorporates: { configured: !!user?.openCorporatesApiToken },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * PUT /api/auth/external-tokens
 * body: { bce?: string|null, openCorporates?: string|null }
 * Setting a value to null/empty string removes the stored token.
 */
export async function updateExternalTokens(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { bce, openCorporates } = req.body ?? {};
    const update: Record<string, string | null> = {};

    if (bce !== undefined) {
      const v = typeof bce === 'string' ? bce.trim() : '';
      update.bceApiToken = v ? encryptCookies(v) : null;
    }
    if (openCorporates !== undefined) {
      const v = typeof openCorporates === 'string' ? openCorporates.trim() : '';
      update.openCorporatesApiToken = v ? encryptCookies(v) : null;
    }
    if (Object.keys(update).length === 0) {
      res.status(400).json({ message: 'No token to update' });
      return;
    }

    await User.updateOne({ _id: userId }, { $set: update });

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'external-token.update', 'user', userId, {
      keys: Object.keys(update),
    }, ip, ua);

    const refreshed = await User.findById(userId).select('bceApiToken openCorporatesApiToken').lean();
    res.json({
      bce: { configured: !!refreshed?.bceApiToken },
      openCorporates: { configured: !!refreshed?.openCorporatesApiToken },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * Helper for other controllers — returns the decrypted token or throws.
 */
export async function getDecryptedToken(
  userId: string,
  which: 'bce' | 'openCorporates'
): Promise<string> {
  const field = which === 'bce' ? 'bceApiToken' : 'openCorporatesApiToken';
  const user = await User.findById(userId).select(field).lean();
  const stored = (user as any)?.[field];
  if (!stored) {
    throw new Error(`No ${which} API token configured. Set one in Profile > External tokens.`);
  }
  return decryptCookies(stored);
}
