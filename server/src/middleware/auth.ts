import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import ApiKey from '../models/ApiKey';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // 1. Try JWT Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.user = decoded;
        next();
        return;
      } catch {
        // JWT failed — don't return yet, might be an API key in another header
      }
    }
  }

  // 2. Try API key: X-API-Key header or Authorization: ApiKey <key>
  let apiKeyRaw: string | undefined;
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey) {
    apiKeyRaw = xApiKey;
  } else if (authHeader?.startsWith('ApiKey ')) {
    apiKeyRaw = authHeader.substring(7);
  }

  if (apiKeyRaw) {
    const keyHash = hashApiKey(apiKeyRaw);
    const apiKey = await ApiKey.findOne({ keyHash, isActive: true });
    if (!apiKey) {
      res.status(401).json({ message: 'Invalid API key' });
      return;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(401).json({ message: 'API key expired' });
      return;
    }

    // Get user
    const user = await User.findById(apiKey.userId).lean();
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'User account disabled' });
      return;
    }

    req.user = { userId: user._id.toString(), role: user.role };

    // Update lastUsedAt/lastUsedIp asynchronously (don't block the request)
    const ip = req.ip || req.socket.remoteAddress || '';
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date(), lastUsedIp: ip } }).exec();

    next();
    return;
  }

  res.status(401).json({ message: 'Token required' });
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
}
