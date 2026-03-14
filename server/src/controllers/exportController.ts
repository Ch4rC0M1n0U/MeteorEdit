import { Response } from 'express';
import mongoose from 'mongoose';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

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

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'export.json', 'dossier', dossier._id.toString(), { title: dossier.title, nodeCount: nodes.length }, ip, ua);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dossier.title.replace(/[^a-zA-Z0-9]/g, '_')}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function importJSON(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossier: dossierData, nodes: nodesData } = req.body;
    if (!dossierData || !dossierData.title) {
      res.status(400).json({ message: 'Invalid import data: missing dossier or title' });
      return;
    }

    const userId = req.user!.userId;

    // Create new dossier from imported data (new owner, new IDs)
    const newDossier = await Dossier.create({
      title: dossierData.title + ' (import)',
      description: dossierData.description || '',
      status: dossierData.status || 'open',
      icon: dossierData.icon || null,
      objectives: dossierData.objectives || '',
      entities: dossierData.entities || [],
      judicialFacts: dossierData.judicialFacts || '',
      tags: dossierData.tags || [],
      investigator: dossierData.investigator || {},
      owner: userId,
      collaborators: [],
    });

    // Map old node IDs to new IDs
    const idMap = new Map<string, string>();
    if (Array.isArray(nodesData)) {
      // First pass: generate new IDs for all nodes
      for (const node of nodesData) {
        if (node._id) {
          idMap.set(node._id, new mongoose.Types.ObjectId().toString());
        }
      }

      // Second pass: create nodes with remapped IDs and parentIds
      for (const node of nodesData) {
        const newId = idMap.get(node._id);
        if (!newId) continue;

        const newParentId = node.parentId ? idMap.get(node.parentId) || null : null;

        await DossierNode.create({
          _id: newId,
          dossierId: newDossier._id,
          parentId: newParentId,
          type: node.type || 'note',
          title: node.title || 'Sans titre',
          order: node.order ?? 0,
          content: node.content || null,
          contentText: node.contentText || null,
          excalidrawData: node.excalidrawData || null,
          mapData: node.mapData || null,
          // Don't import file references (fileUrl, fileHash, etc.) as files aren't transferred
        });
      }
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'import.json', 'dossier', newDossier._id.toString(), {
      title: newDossier.title,
      nodeCount: idMap.size,
      originalTitle: dossierData.title,
    }, ip, ua);

    res.status(201).json(newDossier);
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ message: 'Import failed' });
  }
}
