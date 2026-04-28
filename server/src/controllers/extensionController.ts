import { Response } from 'express';
import { Types } from 'mongoose';
import type { ExtensionRequest } from '../middleware/extensionAuth';
import User from '../models/User';
import Dossier from '../models/Dossier';
import ExtensionImport from '../models/ExtensionImport';
import { logActivity } from '../utils/activityLogger';

const SUPPORTED_PLATFORMS = new Set([
  'instagram', 'facebook', 'threads', 'x', 'tiktok', 'linkedin', 'youtube',
  'reddit', 'snapchat', 'telegram', 'whatsapp', 'mastodon', 'linktree',
  'paypal', 'strava',
]);

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
 * GET /api/extension/dossiers
 * Lists dossiers the user can write to (owner or collaborator).
 */
export async function listDossiers(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    })
      .sort({ updatedAt: -1 })
      .select('_id title')
      .lean();
    res.json({
      dossiers: dossiers.map((d) => ({ _id: String(d._id), title: d.title })),
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/extension/me/pubkey
 * Returns the user's RSA public key for E2E encryption.
 */
export async function getMyPublicKey(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('encryptionPublicKey').lean();
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ publicKey: user.encryptionPublicKey || null });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/extension/cookies/import
 * body: { dossierId, platform, payload: { encryptedKey, iv, ciphertext, ... }, cookieCount }
 */
export async function importCookies(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const tokenId = req.user!.tokenId;
    const { dossierId, platform, payload, cookieCount } = req.body ?? {};

    if (!dossierId || !Types.ObjectId.isValid(dossierId)) {
      res.status(400).json({ message: 'Invalid dossierId' });
      return;
    }
    if (!SUPPORTED_PLATFORMS.has(platform)) {
      res.status(400).json({ message: `Unsupported platform: ${platform}` });
      return;
    }
    if (!payload?.encryptedKey || !payload.iv || !payload.ciphertext) {
      res.status(400).json({ message: 'Encrypted payload incomplete' });
      return;
    }

    const dossier = await Dossier.findOne({
      _id: dossierId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id').lean();
    if (!dossier) {
      res.status(403).json({ message: 'Access denied to this dossier' });
      return;
    }

    const imported = await ExtensionImport.create({
      userId,
      dossierId,
      tokenId,
      platform,
      cookieCount: Number.isFinite(cookieCount) ? Math.max(0, Math.floor(cookieCount)) : 0,
      encryptedPayload: {
        version: payload.version ?? 1,
        algorithm: payload.algorithm ?? 'RSA-OAEP-4096+AES-256-GCM',
        encryptedKey: payload.encryptedKey,
        iv: payload.iv,
        ciphertext: payload.ciphertext,
      },
    });

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'extension.cookies.import', 'dossier', String(dossierId), {
      platform,
      cookieCount: imported.cookieCount,
      tokenId: String(tokenId),
    }, ip, ua);

    res.status(201).json({ success: true, importId: String(imported._id) });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/extension/dossiers/:dossierId/imports
 * Lists encrypted imports for a dossier (used by the web app to show/decrypt them).
 * NOTE: This route uses the regular session auth, not extension bearer auth.
 */
export async function listDossierImports(req: any, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId } = req.params;
    if (!Types.ObjectId.isValid(dossierId)) {
      res.status(400).json({ message: 'Invalid dossierId' });
      return;
    }
    const dossier = await Dossier.findOne({
      _id: dossierId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id').lean();
    if (!dossier) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const imports = await ExtensionImport.find({ dossierId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      imports: imports.map((i) => ({
        _id: String(i._id),
        platform: i.platform,
        cookieCount: i.cookieCount,
        createdAt: i.createdAt,
        encryptedPayload: i.encryptedPayload,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
