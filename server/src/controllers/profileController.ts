import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

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
    res.json({ message: 'Avatar deleted' });
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
    res.json({ message: 'Password changed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
