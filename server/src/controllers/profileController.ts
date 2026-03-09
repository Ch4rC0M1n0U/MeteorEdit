import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { firstName, lastName, email } = req.body;
    const update: Record<string, any> = {};
    if (typeof firstName === 'string' && firstName.trim()) update.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim()) update.lastName = lastName.trim();
    if (typeof email === 'string' && email.trim()) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user!.userId } });
      if (existing) {
        res.status(400).json({ message: 'Email already in use' });
        return;
      }
      update.email = email.toLowerCase().trim();
    }
    const user = await User.findByIdAndUpdate(req.user!.userId, update, { returnDocument: 'after' }).select('-password -twoFactorSecret -twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.update', 'user', req.user!.userId, { fields: Object.keys(update) }, ip);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.avatarPath) {
      const oldPath = path.join(__dirname, '..', '..', user.avatarPath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    user.avatarPath = `uploads/${req.file.filename}`;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.avatar_upload', 'user', req.user!.userId, {}, ip);
    res.json({ avatarPath: user.avatarPath });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteAvatar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.avatarPath) {
      const fullPath = path.join(__dirname, '..', '..', user.avatarPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    user.avatarPath = null;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.avatar_delete', 'user', req.user!.userId, {}, ip);
    res.json({ message: 'Avatar deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { title, name, service, unit, email } = req.body;
    const signature: Record<string, string> = {};
    if (typeof title === 'string') signature['signature.title'] = title.trim();
    if (typeof name === 'string') signature['signature.name'] = name.trim();
    if (typeof service === 'string') signature['signature.service'] = service.trim();
    if (typeof unit === 'string') signature['signature.unit'] = unit.trim();
    if (typeof email === 'string') signature['signature.email'] = email.trim();

    const user = await User.findByIdAndUpdate(req.user!.userId, { $set: signature }, { returnDocument: 'after' })
      .select('-password -twoFactorSecret -twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.signature_update', 'user', req.user!.userId, {}, ip);
    res.json(user.signature);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadSignatureImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    // Remove old signature image
    if (user.signatureImagePath) {
      const oldPath = path.join(__dirname, '..', '..', user.signatureImagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    user.signatureImagePath = `uploads/${req.file.filename}`;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.signature_image_upload', 'user', req.user!.userId, {}, ip);
    res.json({ signatureImagePath: user.signatureImagePath });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function saveDrawnSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      res.status(400).json({ message: 'Invalid signature data' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    // Remove old signature image
    if (user.signatureImagePath) {
      const oldPath = path.join(__dirname, '..', '..', user.signatureImagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    // Save base64 as file
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filename = `sig-${req.user!.userId}-${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, base64Data, 'base64');

    user.signatureImagePath = `uploads/${filename}`;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.signature_image_draw', 'user', req.user!.userId, {}, ip);
    res.json({ signatureImagePath: user.signatureImagePath });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteSignatureImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.signatureImagePath) {
      const fullPath = path.join(__dirname, '..', '..', user.signatureImagePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    user.signatureImagePath = null;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.signature_image_delete', 'user', req.user!.userId, {}, ip);
    res.json({ message: 'Signature image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      res.status(400).json({ message: 'Invalid password (min 8 characters)' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const isMatch = await (user as any).comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }
    user.password = newPassword;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.password_change', 'user', req.user!.userId, {}, ip);
    res.json({ message: 'Password changed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
