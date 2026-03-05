import { Response } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

export async function listUsers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find().select('-password -twoFactorSecret -twoFactorBackupCodes').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive, role, firstName, lastName, email } = req.body;
    const update: any = {};
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (role && ['admin', 'user'].includes(role)) update.role = role;
    if (typeof firstName === 'string' && firstName.trim()) update.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim()) update.lastName = lastName.trim();
    if (typeof email === 'string' && email.trim()) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id as string } });
      if (existing) {
        res.status(400).json({ message: 'Email already in use' });
        return;
      }
      update.email = email.toLowerCase().trim();
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password -twoFactorSecret -twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    if (typeof isActive === 'boolean') {
      await logActivity(req.user!.userId, isActive ? 'user.activate' : 'user.deactivate', 'user', id as string, { email: user!.email }, ip);
    }
    if (role) {
      await logActivity(req.user!.userId, 'user.role_change', 'user', id as string, { email: user!.email, newRole: role }, ip);
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function resetUserPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    user.password = tempPassword;
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'admin.reset_password', 'user', id as string, { email: user.email }, ip);
    res.json({ tempPassword });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function resetUser2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'admin.reset_2fa', 'user', id as string, { email: user.email }, ip);
    res.json({ message: '2FA reset' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (id === req.user!.userId) {
      res.status(400).json({ message: 'Cannot delete yourself' });
      return;
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'user.delete', 'user', id as string, { email: user!.email }, ip);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
