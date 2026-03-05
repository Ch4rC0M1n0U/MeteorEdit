import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user!.userId })
        .populate('fromUserId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId: req.user!.userId }),
      Notification.countDocuments({ userId: req.user!.userId, read: false }),
    ]);

    res.json({ notifications, total, unreadCount, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function markRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { read: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function markAllRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Notification.updateMany({ userId: req.user!.userId, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
