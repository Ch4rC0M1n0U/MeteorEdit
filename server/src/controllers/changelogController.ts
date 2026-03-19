import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Changelog from '../models/Changelog';
import User from '../models/User';
import { logActivity } from '../utils/activityLogger';

export async function getChangelog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const changelogs = await Changelog.find().sort({ date: -1 });

    const user = await User.findById(req.user!.userId).select('preferences');
    const lastRead = user?.preferences?.lastChangelogRead
      ? new Date(user.preferences.lastChangelogRead)
      : new Date(0);

    const unreadCount = changelogs.filter(c => c.date > lastRead).length;

    res.json({ changelogs, unreadCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await User.findByIdAndUpdate(req.user!.userId, {
      $set: { 'preferences.lastChangelogRead': new Date() },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function createChangelog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { version, entries } = req.body;

    if (!version || !entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ message: 'version and entries are required' });
      return;
    }

    const existing = await Changelog.findOne({ version });
    if (existing) {
      res.status(409).json({ message: 'Changelog for this version already exists' });
      return;
    }

    const changelog = await Changelog.create({ version, entries });

    await logActivity(
      req.user!.userId,
      'changelog.create',
      'system',
      String(changelog._id),
      { version, entryCount: entries.length },
      req.ip || '',
      req.headers['user-agent'] || ''
    );

    res.status(201).json(changelog);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
