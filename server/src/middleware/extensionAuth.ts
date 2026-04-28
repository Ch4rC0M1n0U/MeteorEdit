import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import ApiToken from '../models/ApiToken';

export interface ExtensionRequest extends Request {
  user?: { userId: string; tokenId: string };
}

/**
 * Bearer token auth for browser extension endpoints.
 * Header: Authorization: Bearer mext_xxx
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
  if (!token.startsWith('mext_')) {
    res.status(401).json({ message: 'Invalid token format' });
    return;
  }

  const prefix = token.slice(0, 12);
  const candidates = await ApiToken.find({ prefix, revokedAt: null });
  let matched: typeof candidates[number] | null = null;
  for (const candidate of candidates) {
    if (await bcrypt.compare(token, candidate.tokenHash)) {
      matched = candidate;
      break;
    }
  }
  if (!matched) {
    res.status(401).json({ message: 'Invalid or revoked token' });
    return;
  }

  // Update last-used asynchronously (do not block the request)
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  ApiToken.updateOne(
    { _id: matched._id },
    { $set: { lastUsedAt: new Date(), lastUsedIp: ip } }
  ).catch(() => { /* best effort */ });

  req.user = { userId: String(matched.userId), tokenId: String(matched._id) };
  next();
}
