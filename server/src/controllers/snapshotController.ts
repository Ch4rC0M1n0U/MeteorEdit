import { Response } from 'express';
import Snapshot from '../models/Snapshot';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
}

export async function getSnapshots(req: AuthRequest, res: Response): Promise<void> {
  try {
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }
    if (!(await checkDossierAccess(node.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const snapshots = await Snapshot.find({ nodeId: node._id })
      .select('_id label type createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function createSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }
    if (!(await checkDossierAccess(node.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const content = node.type === 'note' ? node.content : node.excalidrawData;
    if (!content) {
      res.status(400).json({ message: 'No content to snapshot' });
      return;
    }

    const snapshot = await Snapshot.create({
      nodeId: node._id,
      dossierId: node.dossierId,
      type: node.type as 'note' | 'mindmap',
      content,
      label: req.body.label || '',
    });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'snapshot.create', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), snapshotId: snapshot._id.toString(), label: snapshot.label }, ip);
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function restoreSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    const snapshot = await Snapshot.findById(req.params.snapshotId);
    if (!snapshot) {
      res.status(404).json({ message: 'Snapshot not found' });
      return;
    }
    if (!(await checkDossierAccess(snapshot.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const node = await DossierNode.findById(snapshot.nodeId);
    if (!node) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }

    if (snapshot.type === 'note') {
      node.content = snapshot.content;
    } else {
      node.excalidrawData = snapshot.content;
    }
    await node.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'snapshot.restore', 'dossier', snapshot.dossierId.toString(), { nodeId: node._id.toString(), snapshotId: snapshot._id.toString() }, ip);
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    const snapshot = await Snapshot.findById(req.params.snapshotId);
    if (!snapshot) {
      res.status(404).json({ message: 'Snapshot not found' });
      return;
    }
    if (!(await checkDossierAccess(snapshot.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const snapshotDossierId = snapshot.dossierId.toString();
    const snapshotNodeId = snapshot.nodeId.toString();
    const snapshotId = snapshot._id.toString();
    await snapshot.deleteOne();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'snapshot.delete', 'dossier', snapshotDossierId, { nodeId: snapshotNodeId, snapshotId }, ip);
    res.json({ message: 'Snapshot deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
