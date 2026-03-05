import { Response } from 'express';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';

export async function search(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string || '').trim();
    const status = req.query.status as string | undefined;
    const tags = req.query.tags as string | undefined;
    const owner = req.query.owner as string | undefined;
    const collaborator = req.query.collaborator as string | undefined;
    const nodeType = req.query.nodeType as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const sort = (req.query.sort as string) || 'relevance';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const userId = req.user!.userId;

    // --- Dossier search ---
    const dossierQuery: any = {
      $or: [{ owner: userId }, { collaborators: userId }],
    };

    if (q.length >= 2) {
      dossierQuery.$text = { $search: q };
    }
    if (status) {
      dossierQuery.status = status;
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (tagList.length) dossierQuery.tags = { $all: tagList };
    }
    if (owner) {
      dossierQuery.owner = owner;
    }
    if (collaborator) {
      dossierQuery.collaborators = collaborator;
    }
    if (dateFrom || dateTo) {
      dossierQuery.createdAt = {};
      if (dateFrom) dossierQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dossierQuery.createdAt.$lte = new Date(dateTo);
    }

    let dossierSort: any = { updatedAt: -1 };
    if (sort === 'title') dossierSort = { title: 1 };
    if (sort === 'date') dossierSort = { createdAt: -1 };

    const [dossiers, dossierTotal] = await Promise.all([
      Dossier.find(dossierQuery).select('title description status tags updatedAt owner').sort(dossierSort).skip(skip).limit(limit),
      Dossier.countDocuments(dossierQuery),
    ]);

    // --- Node search ---
    const accessibleDossierIds = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).distinct('_id');

    const nodeQuery: any = {
      dossierId: { $in: accessibleDossierIds },
      deletedAt: null,
    };

    if (q.length >= 2) {
      nodeQuery.$or = [
        { title: { $regex: q, $options: 'i' } },
        { contentText: { $regex: q, $options: 'i' } },
      ];
    }
    if (nodeType) {
      nodeQuery.type = nodeType;
    }

    const [nodes, nodeTotal] = await Promise.all([
      DossierNode.find(nodeQuery).select('dossierId title type contentText updatedAt').sort({ updatedAt: -1 }).skip(skip).limit(limit),
      DossierNode.countDocuments(nodeQuery),
    ]);

    res.json({
      dossiers,
      nodes,
      pagination: { page, limit, dossierTotal, nodeTotal },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
