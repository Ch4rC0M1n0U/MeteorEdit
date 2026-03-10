import { Response } from 'express';
import ActivityLog from '../models/ActivityLog';
import Dossier from '../models/Dossier';
import { AuthRequest } from '../middleware/auth';

export async function getActivityLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from as string);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to as string);
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

export async function getDossierActivityLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId } = req.params;
    const userId = req.user!.userId;

    const dossier = await Dossier.findById(dossierId);
    if (!dossier) { res.status(404).json({ error: 'Dossier introuvable' }); return; }
    const hasAccess = dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
    if (!hasAccess) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter: any = { targetType: 'dossier', targetId: dossierId };
    if (req.query.action) filter.action = req.query.action;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('userId', 'firstName lastName email avatarPath')
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
