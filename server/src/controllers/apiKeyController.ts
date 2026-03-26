import { Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth';
import ApiKey from '../models/ApiKey';
import { logActivity } from '../utils/activityLogger';
import { hashApiKey } from '../middleware/auth';

function getIp(req: AuthRequest): string {
  const ip = req.ip;
  if (Array.isArray(ip)) return ip[0] || '';
  return ip || req.socket.remoteAddress || '';
}

function getUa(req: AuthRequest): string {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : '';
}

export async function listApiKeys(req: AuthRequest, res: Response): Promise<void> {
  const keys = await ApiKey.find({ userId: req.user!.userId } as any)
    .select('-keyHash')
    .sort({ createdAt: -1 })
    .lean();
  res.json(keys);
}

export async function createApiKey(req: AuthRequest, res: Response): Promise<void> {
  const { name, permissions, expiresAt } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'Name is required' });
    return;
  }

  // Count existing keys for user (limit to 20)
  const count = await ApiKey.countDocuments({ userId: req.user!.userId } as any);
  if (count >= 20) {
    res.status(400).json({ message: 'Maximum 20 API keys per user' });
    return;
  }

  const rawKey = 'mk_' + crypto.randomBytes(32).toString('hex');
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 7); // "mk_" + first 4 hex chars

  const validPermissions = ['read', 'write', 'admin'];
  const perms = Array.isArray(permissions)
    ? permissions.filter((p: string) => validPermissions.includes(p))
    : ['read'];

  const apiKey = await ApiKey.create({
    userId: req.user!.userId,
    name: name.trim(),
    keyHash,
    keyPrefix,
    permissions: perms,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  } as any);

  await logActivity(req.user!.userId, 'apikey.create', 'system', String(apiKey._id), { name: name.trim(), permissions: perms }, getIp(req), getUa(req));

  // Return plaintext key ONCE — it cannot be retrieved later
  res.status(201).json({
    _id: apiKey._id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
    key: rawKey,
  });
}

export async function revokeApiKey(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const apiKey = await ApiKey.findOneAndDelete({
    _id: id,
    userId: req.user!.userId,
  } as any);
  if (!apiKey) {
    res.status(404).json({ message: 'API key not found' });
    return;
  }

  await logActivity(req.user!.userId, 'apikey.revoke', 'system', id as string, { name: apiKey.name }, getIp(req), getUa(req));

  res.json({ message: 'API key revoked' });
}

export async function updateApiKey(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, permissions, isActive } = req.body;

  const update: Record<string, any> = {};
  if (name !== undefined) update.name = name.trim();
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  if (permissions !== undefined) {
    const validPermissions = ['read', 'write', 'admin'];
    update.permissions = Array.isArray(permissions)
      ? permissions.filter((p: string) => validPermissions.includes(p))
      : undefined;
  }

  if (Object.keys(update).length === 0) {
    res.status(400).json({ message: 'No valid fields to update' });
    return;
  }

  const apiKey = await ApiKey.findOneAndUpdate(
    {
      _id: id,
      userId: req.user!.userId,
    } as any,
    { $set: update },
    { returnDocument: 'after' },
  ).select('-keyHash').lean();

  if (!apiKey) {
    res.status(404).json({ message: 'API key not found' });
    return;
  }

  await logActivity(req.user!.userId, 'apikey.update', 'system', id as string, { changes: Object.keys(update) }, getIp(req), getUa(req));

  res.json(apiKey);
}
