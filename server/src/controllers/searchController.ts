import { Response } from 'express';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';

export async function search(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = req.query.q as string;
    const dossierId = req.query.dossierId as string | undefined;

    if (!q || q.trim().length < 2) {
      res.json({ dossiers: [], nodes: [] });
      return;
    }

    const userId = req.user!.userId;

    // Search dossiers
    const dossierQuery: any = {
      $text: { $search: q },
      $or: [{ owner: userId }, { collaborators: userId }],
    };
    const dossiers = await Dossier.find(dossierQuery)
      .select('title description status updatedAt')
      .limit(10);

    // Search nodes by title (nodes don't have text index on content since it's JSON)
    const nodeQuery: any = {
      title: { $regex: q, $options: 'i' },
    };
    if (dossierId) {
      nodeQuery.dossierId = dossierId;
    }
    const nodes = await DossierNode.find(nodeQuery)
      .select('dossierId title type updatedAt')
      .limit(20);

    res.json({ dossiers, nodes });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
