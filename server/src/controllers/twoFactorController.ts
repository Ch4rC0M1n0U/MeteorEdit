import { Request, Response } from 'express';
import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import SiteSettings from '../models/SiteSettings';

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(code => bcrypt.hash(code, 10)));
}

export async function setup2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    if (user.twoFactorEnabled) { res.status(400).json({ message: '2FA is already enabled' }); return; }

    const settings = await SiteSettings.findOne();
    const appName = settings?.appName || 'MeteorEdit';

    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: appName,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(uri);
    const backupCodes = generateBackupCodes();

    user.twoFactorSecret = secret.base32;
    user.twoFactorBackupCodes = await hashBackupCodes(backupCodes);
    await user.save();

    res.json({ qrCode: qrCodeDataUrl, secret: secret.base32, backupCodes });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function verify2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ message: 'Code required' }); return; }
    const user = await User.findById(req.user!.userId);
    if (!user || !user.twoFactorSecret) { res.status(400).json({ message: '2FA setup not initiated' }); return; }

    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) { res.status(400).json({ message: 'Invalid code' }); return; }

    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: '2FA enabled' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function disable2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { password } = req.body;
    if (!password) { res.status(400).json({ message: 'Password required' }); return; }
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const settings = await SiteSettings.findOne();
    if (settings?.require2FA) { res.status(403).json({ message: '2FA is mandatory per admin policy' }); return; }

    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) { res.status(401).json({ message: 'Invalid password' }); return; }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save();
    res.json({ message: '2FA disabled' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function validate2FA(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) { res.status(400).json({ message: 'Token and code required' }); return; }

    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET! + '_2fa');
    } catch {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.twoFactorSecret) { res.status(400).json({ message: 'Invalid state' }); return; }

    // Try TOTP code first
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta !== null) {
      const { generateTokens } = require('./authController');
      const tokens = generateTokens(user._id.toString(), user.role);
      res.json({
        ...tokens,
        user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      });
      return;
    }

    // Try backup code
    const upperCode = code.toUpperCase();
    let backupUsed = false;
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const match = await bcrypt.compare(upperCode, user.twoFactorBackupCodes[i]);
      if (match) {
        user.twoFactorBackupCodes.splice(i, 1);
        await user.save();
        backupUsed = true;
        break;
      }
    }

    if (backupUsed) {
      const { generateTokens } = require('./authController');
      const tokens = generateTokens(user._id.toString(), user.role);
      res.json({
        ...tokens,
        user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        backupCodeUsed: true,
      });
      return;
    }

    res.status(400).json({ message: 'Invalid code' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
