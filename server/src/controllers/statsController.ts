import { Response } from 'express';
import User from '../models/User';
import Dossier from '../models/Dossier';
import LoginLog from '../models/LoginLog';
import { AuthRequest } from '../middleware/auth';
import { getOnlineCount } from '../socket';

export async function getStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const onlineCount = getOnlineCount();

    const totalDossiers = await Dossier.countDocuments();
    const weeklyDossiers = await Dossier.countDocuments({ createdAt: { $gte: oneWeekAgo } });

    const statusDistribution = await Dossier.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const dossiersPerUser = await Dossier.aggregate([
      { $group: { _id: '$owner', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: { $concat: ['$user.firstName', ' ', '$user.lastName'] }, count: 1 } },
    ]);

    const loginsPerDay = await LoginLog.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recentLogins = await LoginLog.find()
      .sort({ timestamp: -1 })
      .limit(15)
      .populate('userId', 'firstName lastName email')
      .lean();

    res.json({
      totalUsers, activeUsers, onlineCount,
      totalDossiers, weeklyDossiers,
      statusDistribution, dossiersPerUser, loginsPerDay, recentLogins,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
