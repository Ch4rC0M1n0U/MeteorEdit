import { Response } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import ActivityLog from '../models/ActivityLog';
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
    const ua = req.headers['user-agent'] || '';
    if (typeof isActive === 'boolean') {
      await logActivity(req.user!.userId, isActive ? 'user.activate' : 'user.deactivate', 'user', id as string, { email: user!.email }, ip, ua);
    }
    if (role) {
      await logActivity(req.user!.userId, 'user.role_change', 'user', id as string, { email: user!.email, newRole: role }, ip, ua);
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
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'admin.reset_password', 'user', id as string, { email: user.email }, ip, ua);
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
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'admin.reset_2fa', 'user', id as string, { email: user.email }, ip, ua);
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
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'user.delete', 'user', id as string, { email: user!.email }, ip, ua);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

/* ─── Audit Trail Endpoints ──────────────────────────────────────── */

export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetType) filter.targetType = req.query.targetType;
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }
    if (req.query.search) {
      const s = req.query.search as string;
      filter.$or = [
        { action: { $regex: s, $options: 'i' } },
        { ip: { $regex: s, $options: 'i' } },
        { 'metadata.title': { $regex: s, $options: 'i' } },
        { 'metadata.email': { $regex: s, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getAuditStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [todayCount, weekCount, topUsersRaw, topActionsRaw] = await Promise.all([
      ActivityLog.countDocuments({ timestamp: { $gte: todayStart } }),
      ActivityLog.countDocuments({ timestamp: { $gte: weekStart } }),
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: weekStart } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: weekStart } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Populate user info for top users
    const userIds = topUsersRaw.map((u: any) => u._id);
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email');
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const topUsers = topUsersRaw.map((u: any) => {
      const user = userMap.get(u._id?.toString());
      return {
        userId: u._id,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        count: u.count,
      };
    });

    const topActions = topActionsRaw.map((a: any) => ({
      action: a._id,
      count: a.count,
    }));

    res.json({
      today: todayCount,
      week: weekCount,
      topUsers,
      topActions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
