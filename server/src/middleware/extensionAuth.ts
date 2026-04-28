import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import ApiToken from '../models/ApiToken';
import ApiKey from '../models/ApiKey';
import { hashApiKey } from './auth';

export interface ExtensionRequest extends Request {
  user?: { userId: string; tokenId: string };
}

/**
 * Bearer token auth for browser extension endpoints.
 * Accepts either:
 *  - mext_xxx — extension-specific tokens (ApiToken model)
 *  - mk_xxx   — generic MeteorEdit API keys (ApiKey model)
 * Header: Authorization: Bearer <token>
 */
export async function extensionAuth(
  req: ExtensionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ message: 'Bearer token required' });
    return;
  }
  const token = match[1].trim();
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');

  // 1. Extension-specific tokens (mext_)
  if (token.startsWith('mext_')) {
    const prefix = token.slice(0, 12);
    const candidates = await ApiToken.find({ prefix, revokedAt: null });
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        ApiToken.updateOne(
          { _id: candidate._id },
          { $set: { lastUsedAt: new Date(), lastUsedIp: ip } }
        ).catch(() => { /* best effort */ });
        req.user = { userId: String(candidate.userId), tokenId: String(candidate._id) };
        return next();
      }
    }
  }

  // 2. Generic API keys (mk_)
  if (token.startsWith('mk_')) {
    const apiKey = await ApiKey.findOne({ keyHash: hashApiKey(token), isActive: true });
    if (apiKey) {
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        res.status(401).json({ message: 'API key expired' });
        return;
      }
      ApiKey.updateOne(
        { _id: apiKey._id },
        { $set: { lastUsedAt: new Date(), lastUsedIp: ip } }
      ).exec().catch(() => { /* best effort */ });
      req.user = { userId: String(apiKey.userId), tokenId: String(apiKey._id) };
      return next();
    }
  }

  res.status(401).json({ message: 'Invalid or revoked token' });
}
