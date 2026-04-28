import { Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { AuthRequest } from '../middleware/auth';
import ApiToken from '../models/ApiToken';
import { logActivity } from '../utils/activityLogger';

const TOKEN_PREFIX = 'mext_';

function generateToken(): { full: string; prefix: string } {
  const random = crypto.randomBytes(32).toString('base64url');
  const full = `${TOKEN_PREFIX}${random}`;
  const prefix = full.slice(0, 12); // mext_ + 7 chars visible
  return { full, prefix };
}

function getRequestMeta(req: AuthRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

/**
 * POST /api/auth/api-tokens
 * body: { name }
 * Returns the full token ONCE — user must copy it before closing.
 */
export async function createApiToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const name = (req.body?.name as string | undefined)?.trim();
    if (!name || name.length < 2) {
      res.status(400).json({ message: 'Token name must be at least 2 characters' });
      return;
    }

    const existingCount = await ApiToken.countDocuments({ userId, revokedAt: null });
    if (existingCount >= 10) {
      res.status(400).json({ message: 'Maximum 10 active tokens per user. Revoke an existing one first.' });
      return;
    }

    const { full, prefix } = generateToken();
    const tokenHash = await bcrypt.hash(full, 10);

    const token = await ApiToken.create({
      userId,
      name,
      prefix,
      tokenHash,
      scope: 'extension',
    });

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'api-token.create', 'system', String(token._id), { name, prefix }, ip, ua);

    res.status(201).json({
      _id: String(token._id),
      name: token.name,
      prefix: token.prefix,
      scope: token.scope,
      createdAt: token.createdAt,
      token: full, // shown once only
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/auth/api-tokens
 * Lists all non-revoked tokens for the authenticated user.
 */
export async function listApiTokens(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const tokens = await ApiToken.find({ userId, revokedAt: null })
      .sort({ createdAt: -1 })
      .select('name prefix scope lastUsedAt lastUsedIp createdAt')
      .lean();
    res.json({ tokens });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * DELETE /api/auth/api-tokens/:id
 * Revokes (soft-deletes) a token.
 */
export async function revokeApiToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const token = await ApiToken.findOne({ _id: req.params.id, userId });
    if (!token) {
      res.status(404).json({ message: 'Token not found' });
      return;
    }
    if (token.revokedAt) {
      res.status(400).json({ message: 'Token already revoked' });
      return;
    }
    token.revokedAt = new Date();
    await token.save();

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'api-token.revoke', 'system', String(token._id), { prefix: token.prefix }, ip, ua);

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
