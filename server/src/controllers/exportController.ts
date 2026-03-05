import { Response } from 'express';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';

export async function exportJSON(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.map(c => c.toString()).includes(userId)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const nodes = await DossierNode.find({ dossierId: dossier._id }).sort({ order: 1 });

    const exportData = {
      dossier: dossier.toObject(),
      nodes: nodes.map(n => n.toObject()),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dossier.title.replace(/[^a-zA-Z0-9]/g, '_')}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
