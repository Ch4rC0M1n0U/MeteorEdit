import { Response } from 'express';
import mongoose from 'mongoose';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

export async function getUserDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userDossierFilter = { $or: [{ owner: userId }, { collaborators: userId }] };

    const dossiers = await Dossier.find(userDossierFilter).lean();
    const dossierIds = dossiers.map(d => d._id);

    const totalDossiers = dossiers.length;
    const ownedDossiers = dossiers.filter(d => d.owner.toString() === userId).length;
    const collabDossiers = totalDossiers - ownedDossiers;

    const statusCounts = { open: 0, in_progress: 0, closed: 0 };
    for (const d of dossiers) {
      const s = d.status as keyof typeof statusCounts;
      if (s in statusCounts) statusCounts[s]++;
    }

    const nodeCountsByType = await DossierNode.aggregate([
      { $match: { dossierId: { $in: dossierIds }, deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const totalNodes = nodeCountsByType.reduce((sum, n) => sum + n.count, 0);

    const userActions = [
      'login', 'dossier.create', 'dossier.update', 'dossier.delete',
      'node.create', 'node.delete', 'node.restore', 'node.purge', 'node.empty_trash',
      'collaborator.add', 'collaborator.remove',
      'comment.create', 'comment.delete',
      'snapshot.create', 'snapshot.restore', 'snapshot.delete',
      'profile.update', 'profile.avatar_upload', 'profile.password_change',
      '2fa.enable', '2fa.disable',
    ];

    const recentActivity = await ActivityLog.find({
      userId,
      action: { $in: userActions },
      timestamp: { $gte: sevenDaysAgo },
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const activityPerDay = await ActivityLog.aggregate([
      { $match: { userId: userObjectId, action: { $in: userActions }, timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recentDossiers = await Dossier.find(userDossierFilter)
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status updatedAt')
      .lean();

    res.json({
      totalDossiers,
      ownedDossiers,
      collabDossiers,
      statusCounts,
      totalNodes,
      nodeCountsByType,
      recentActivity,
      activityPerDay,
      recentDossiers,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
