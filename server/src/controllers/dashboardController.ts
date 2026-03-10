import { Response } from 'express';
import mongoose from 'mongoose';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

const USER_ACTIONS = [
  'login', 'dossier.create', 'dossier.update', 'dossier.delete',
  'node.create', 'node.delete', 'node.restore', 'node.purge', 'node.empty_trash',
  'collaborator.add', 'collaborator.remove',
  'comment.create', 'comment.delete',
  'snapshot.create', 'snapshot.restore', 'snapshot.delete',
  'profile.update', 'profile.avatar_upload', 'profile.password_change',
  '2fa.enable', '2fa.disable',
];

export async function getUserDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

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

    const recentActivity = await ActivityLog.find({
      userId, action: { $in: USER_ACTIONS }, timestamp: { $gte: sevenDaysAgo },
    }).sort({ timestamp: -1 }).limit(10).lean();

    const activityPerDay = await ActivityLog.aggregate([
      { $match: { userId: userObjectId, action: { $in: USER_ACTIONS }, timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const recentDossiers = await Dossier.find(userDossierFilter)
      .sort({ updatedAt: -1 }).limit(5).select('title status updatedAt').lean();

    // --- Last accessed nodes ---
    const nodeActions = await ActivityLog.find({
      userId, action: { $in: ['node.create', 'node.update'] }, timestamp: { $gte: sevenDaysAgo },
    }).sort({ timestamp: -1 }).limit(20).lean();

    const seenNodeIds = new Set<string>();
    const lastAccessedNodeIds: mongoose.Types.ObjectId[] = [];
    for (const act of nodeActions) {
      const nid = act.targetId?.toString();
      if (nid && !seenNodeIds.has(nid)) {
        seenNodeIds.add(nid);
        lastAccessedNodeIds.push(act.targetId!);
        if (lastAccessedNodeIds.length >= 5) break;
      }
    }

    const lastAccessedNodes = lastAccessedNodeIds.length
      ? await DossierNode.find({ _id: { $in: lastAccessedNodeIds }, deletedAt: null })
          .select('title type dossierId').populate('dossierId', 'title').lean()
      : [];

    const nodeOrder = new Map(lastAccessedNodeIds.map((id, i) => [id.toString(), i]));
    lastAccessedNodes.sort((a, b) => (nodeOrder.get(a._id.toString()) || 0) - (nodeOrder.get(b._id.toString()) || 0));

    // --- Streaks ---
    const dailyActivity = await ActivityLog.aggregate([
      { $match: { userId: userObjectId, action: { $in: USER_ACTIONS }, timestamp: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const activeDays = new Set(dailyActivity.map(d => d._id));
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < 180; i++) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      if (activeDays.has(dayStr)) {
        currentStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    for (let i = 0; i < 180; i++) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      if (activeDays.has(dayStr)) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // --- Weekly trend ---
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoWeekActivity = await ActivityLog.aggregate([
      { $match: { userId: userObjectId, action: { $in: USER_ACTIONS }, timestamp: { $gte: twoWeeksAgo } } },
      {
        $group: {
          _id: { $cond: [{ $gte: ['$timestamp', sevenDaysAgo] }, 'current', 'previous'] },
          count: { $sum: 1 },
        },
      },
    ]);

    const currentWeekCount = twoWeekActivity.find(w => w._id === 'current')?.count || 0;
    const previousWeekCount = twoWeekActivity.find(w => w._id === 'previous')?.count || 0;

    // --- Top active dossiers this week ---
    const topDossiersThisWeek = await ActivityLog.aggregate([
      {
        $match: {
          userId: userObjectId,
          action: { $in: USER_ACTIONS },
          timestamp: { $gte: sevenDaysAgo },
          targetType: { $in: ['dossier', 'node'] },
          targetId: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'dossiernodes',
          localField: 'targetId',
          foreignField: '_id',
          as: 'node',
          pipeline: [{ $project: { dossierId: 1 } }],
        },
      },
      {
        $addFields: {
          resolvedDossierId: {
            $cond: [{ $eq: ['$targetType', 'node'] }, { $arrayElemAt: ['$node.dossierId', 0] }, '$targetId'],
          },
        },
      },
      { $match: { resolvedDossierId: { $in: dossierIds } } },
      { $group: { _id: '$resolvedDossierId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: 'dossiers', localField: '_id', foreignField: '_id', as: 'dossier', pipeline: [{ $project: { title: 1 } }] },
      },
      { $unwind: '$dossier' },
      { $project: { _id: 1, count: 1, title: '$dossier.title' } },
    ]);

    // --- Heatmap (180 days) ---
    const heatmap = dailyActivity.map(d => ({ date: d._id, count: d.count }));

    res.json({
      totalDossiers, ownedDossiers, collabDossiers,
      statusCounts, totalNodes, nodeCountsByType,
      recentActivity, activityPerDay, recentDossiers,
      lastAccessedNodes,
      streaks: { current: currentStreak, best: bestStreak },
      weeklyTrend: { current: currentWeekCount, previous: previousWeekCount },
      topDossiersThisWeek,
      heatmap,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getTaskStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const taskActions = await ActivityLog.aggregate([
      {
        $match: {
          userId: userObjectId,
          action: { $in: ['task.create', 'task.complete'] },
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            action: '$action',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const days: Record<string, { created: number; completed: number }> = {};
    for (const entry of taskActions) {
      const date = entry._id.date;
      if (!days[date]) days[date] = { created: 0, completed: 0 };
      if (entry._id.action === 'task.create') days[date].created = entry.count;
      if (entry._id.action === 'task.complete') days[date].completed = entry.count;
    }

    const result = Object.entries(days).map(([date, counts]) => ({ date, ...counts }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
