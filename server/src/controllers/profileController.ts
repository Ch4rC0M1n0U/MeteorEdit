import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import ActivityLog from '../models/ActivityLog';
import LoginLog from '../models/LoginLog';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { getUserSockets } from '../socket';

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
    await logActivity(req.user!.userId, 'profile.update', 'user', req.user!.userId, { fields: Object.keys(update) }, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.avatar_upload', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.avatar_delete', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.signature_update', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.signature_image_upload', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.signature_image_draw', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    await logActivity(req.user!.userId, 'profile.signature_image_delete', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
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
    // Update encryption keys if re-encrypted with new password
    if (req.body.encryptedPrivateKey) {
      user.encryptionPrivateKey = req.body.encryptedPrivateKey;
    }
    if (req.body.encryptionSalt) {
      user.encryptionSalt = req.body.encryptionSalt;
    }
    await user.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'profile.password_change', 'user', req.user!.userId, {}, ip, req.headers['user-agent'] || '');
    res.json({ message: 'Password changed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 1. GET /auth/sessions ─────────────────────────────────────────────────────
export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestIp = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');

    // Get recent login entries (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const loginLogs = await LoginLog.find({
      userId,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 }).lean();

    // Check which user sockets are currently active
    const activeSockets = getUserSockets();
    const isOnline = activeSockets.has(userId);

    const sessions = loginLogs.map((log) => ({
      ip: log.ip || '',
      timestamp: log.timestamp,
      isCurrent: (log.ip || '') === requestIp,
      isOnline: (log.ip || '') === requestIp && isOnline,
    }));

    res.json({ sessions, isOnline });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 2. GET /auth/login-history ─────────────────────────────────────────────────
export async function getLoginHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const activities = await ActivityLog.find({
      userId,
      action: 'auth.login',
      timestamp: { $gte: sevenDaysAgo },
    }).sort({ timestamp: -1 }).limit(20).lean();

    const history = activities.map((a) => ({
      ip: a.ip || '',
      userAgent: a.userAgent || '',
      timestamp: a.timestamp,
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 3. GET /auth/storage ───────────────────────────────────────────────────────
export async function getStorageUsage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    let totalSize = 0;
    let fileCount = 0;

    // User avatar file size
    const user = await User.findById(userId).select('avatarPath signatureImagePath').lean();
    if (user) {
      if (user.avatarPath) {
        const avatarFullPath = path.resolve(__dirname, '..', '..', user.avatarPath);
        if (fs.existsSync(avatarFullPath)) {
          const stat = fs.statSync(avatarFullPath);
          totalSize += stat.size;
          fileCount++;
        }
      }
      // Signature image file size
      if (user.signatureImagePath) {
        const sigFullPath = path.resolve(__dirname, '..', '..', user.signatureImagePath);
        if (fs.existsSync(sigFullPath)) {
          const stat = fs.statSync(sigFullPath);
          totalSize += stat.size;
          fileCount++;
        }
      }
    }

    // All dossier nodes file sizes for user's dossiers (owned or collaborator)
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id').lean();

    const dossierIds = dossiers.map((d) => d._id);

    if (dossierIds.length > 0) {
      const nodes = await DossierNode.find({
        dossierId: { $in: dossierIds },
        fileSize: { $gt: 0 },
        deletedAt: null,
      }).select('fileSize').lean();

      for (const node of nodes) {
        if (node.fileSize) {
          totalSize += node.fileSize;
          fileCount++;
        }
      }
    }

    res.json({ used: totalSize, files: fileCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 4. POST /auth/export-data ──────────────────────────────────────────────────
export async function exportUserData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Profile data (exclude sensitive fields)
    const user = await User.findById(userId)
      .select('-password -twoFactorSecret -twoFactorBackupCodes -encryptionPrivateKey')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // User's dossiers
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).lean();

    const dossierIds = dossiers.map((d) => d._id);

    // All nodes from user's dossiers
    const nodes = await DossierNode.find({
      dossierId: { $in: dossierIds },
      deletedAt: null,
    }).lean();

    // Last 30 days of activity
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activity = await ActivityLog.find({
      userId,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 }).lean();

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: user,
      dossiers,
      nodes,
      activity,
    };

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'profile.data_export', 'user', userId, {}, ip, req.headers['user-agent'] || '');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="meteoredit-export-${userId}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 5. DELETE /auth/account ────────────────────────────────────────────────────
export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Verify password
    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid password' });
      return;
    }

    // Delete user's notifications
    await Notification.deleteMany({ userId });

    // Remove user from all dossier collaborator lists
    await Dossier.updateMany(
      { collaborators: userId },
      { $pull: { collaborators: userId } }
    );

    // Find dossiers where user is sole owner (no other collaborators could take over)
    const ownedDossiers = await Dossier.find({ owner: userId }).select('_id').lean();
    const ownedDossierIds = ownedDossiers.map((d) => d._id);

    if (ownedDossierIds.length > 0) {
      // Delete files for nodes in owned dossiers
      const nodesWithFiles = await DossierNode.find({
        dossierId: { $in: ownedDossierIds },
        fileUrl: { $ne: null },
      }).select('fileUrl').lean();

      for (const node of nodesWithFiles) {
        if (node.fileUrl) {
          const filePath = path.resolve(__dirname, '..', '..', node.fileUrl);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch { /* ignore */ }
          }
        }
      }

      // Delete nodes for owned dossiers
      await DossierNode.deleteMany({ dossierId: { $in: ownedDossierIds } });

      // Delete owned dossiers
      await Dossier.deleteMany({ _id: { $in: ownedDossierIds } });
    }

    // Delete user's activity logs
    await ActivityLog.deleteMany({ userId });

    // Delete user's login logs
    await LoginLog.deleteMany({ userId });

    // Clean up avatar file
    if (user.avatarPath) {
      const avatarFullPath = path.resolve(__dirname, '..', '..', user.avatarPath);
      if (fs.existsSync(avatarFullPath)) {
        try { fs.unlinkSync(avatarFullPath); } catch { /* ignore */ }
      }
    }

    // Clean up signature image file
    if (user.signatureImagePath) {
      const sigFullPath = path.resolve(__dirname, '..', '..', user.signatureImagePath);
      if (fs.existsSync(sigFullPath)) {
        try { fs.unlinkSync(sigFullPath); } catch { /* ignore */ }
      }
    }

    // Delete user document
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── 6. GET /auth/activity ──────────────────────────────────────────────────────
export async function getActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const actionFilter = req.query.action as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const format = (req.query.format as string) || 'json';

    const filter: Record<string, any> = {
      userId,
      timestamp: { $gte: sevenDaysAgo },
    };

    if (actionFilter) {
      const actions = actionFilter.split(',').map((a) => a.trim()).filter(Boolean);
      if (actions.length > 0) {
        filter.action = { $in: actions };
      }
    }

    const total = await ActivityLog.countDocuments(filter);
    const activities = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    if (format === 'csv') {
      const csvHeader = 'Date,Action,Target,Details';
      const csvRows = activities.map((a) => {
        const date = new Date(a.timestamp).toISOString();
        const action = a.action || '';
        const target = `${a.targetType || ''}:${a.targetId || ''}`;
        const details = JSON.stringify(a.metadata || {}).replace(/"/g, '""');
        return `"${date}","${action}","${target}","${details}"`;
      });
      const csv = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity-${userId}-${Date.now()}.csv"`);
      res.send(csv);
      return;
    }

    res.json({
      activities,
      total,
      page,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
