import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import LoginLog from '../models/LoginLog';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import SiteSettings from '../models/SiteSettings';

export function generateTokens(userId: string, role: string) {
  const accessOpts: SignOptions = { expiresIn: (process.env.JWT_EXPIRATION || '15m') as any };
  const refreshOpts: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any };
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET!, accessOpts);
  const refreshToken = jwt.sign({ userId, role }, process.env.JWT_REFRESH_SECRET!, refreshOpts);
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (settings && !settings.registrationEnabled) {
      res.status(403).json({ message: 'Les inscriptions sont desactivees.' });
      return;
    }

    const { email, password, firstName, lastName } = req.body;

    // Password policy check
    if (settings) {
      const minLen = settings.passwordMinLength || 8;
      if (password.length < minLen) {
        res.status(400).json({ message: `Le mot de passe doit contenir au moins ${minLen} caracteres.` });
        return;
      }
      if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
        res.status(400).json({ message: 'Le mot de passe doit contenir au moins une majuscule.' });
        return;
      }
      if (settings.passwordRequireNumber && !/[0-9]/.test(password)) {
        res.status(400).json({ message: 'Le mot de passe doit contenir au moins un chiffre.' });
        return;
      }
      if (settings.passwordRequireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
        res.status(400).json({ message: 'Le mot de passe doit contenir au moins un caractere special.' });
        return;
      }
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }
    const user = await User.create({ email, password, firstName, lastName });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(user._id.toString(), 'register', 'user', user._id.toString(), { email: user.email }, ip);
    res.status(201).json({
      message: 'Account created. Waiting for admin activation.',
      user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: 'Account not activated. Contact admin.' });
      return;
    }
    const tokens = generateTokens(user._id.toString(), user.role);

    // Track login
    user.lastLoginAt = new Date();
    const rawIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || req.socket.remoteAddress || '';
    user.lastLoginIp = rawIp.replace('::ffff:', '');
    await user.save();
    await LoginLog.create({ userId: user._id, ip: user.lastLoginIp });
    await logActivity(user._id.toString(), 'login', 'system', null, {}, user.lastLoginIp || '');

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id.toString(), purpose: '2fa' },
        process.env.JWT_SECRET! + '_2fa',
        { expiresIn: '5m' }
      );
      res.json({ requires2FA: true, tempToken });
      return;
    }

    res.json({
      ...tokens,
      user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('-password -twoFactorSecret -twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const u = user.toObject();
    res.json({ id: u._id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, avatarPath: u.avatarPath, twoFactorEnabled: u.twoFactorEnabled, preferences: u.preferences, signature: u.signature, signatureImagePath: u.signatureImagePath });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('preferences');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user.preferences || {});
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    user.preferences = { ...(user.preferences || {}), ...req.body };
    await user.save();
    res.json(user.preferences);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token required' });
      return;
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    const tokens = generateTokens(decoded.userId, decoded.role);
    res.json(tokens);
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
}
