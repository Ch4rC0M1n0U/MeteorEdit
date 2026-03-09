import { Response } from 'express';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { AuthRequest } from '../middleware/auth';
import { extractTextFromTipTap } from '../utils/extractText';
import { logActivity } from '../utils/activityLogger';

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
}

export async function getNodes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const nodes = await DossierNode.find({ dossierId, deletedAt: null }).sort({ order: 1 });
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function createNode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const lastNode = await DossierNode.findOne({
      dossierId,
      parentId: req.body.parentId || null,
    }).sort({ order: -1 });
    const order = lastNode ? lastNode.order + 1 : 0;

    const node = await DossierNode.create({
      ...req.body,
      dossierId,
      order,
    });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'node.create', 'dossier', dossierId, { nodeId: node._id.toString(), type: node.type, title: node.title }, ip);
    res.status(201).json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateNode(req: AuthRequest, res: Response): Promise<void> {
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
    Object.assign(node, req.body);
    if (req.body.content && node.type === 'note') {
      node.contentText = extractTextFromTipTap(req.body.content);
    }
    await node.save();
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteNode(req: AuthRequest, res: Response): Promise<void> {
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
    // Soft-delete node and all descendants recursively
    const now = new Date();
    async function softDeleteRecursive(parentId: string) {
      const children = await DossierNode.find({ parentId, deletedAt: null });
      for (const child of children) {
        await softDeleteRecursive(child._id.toString());
        child.deletedAt = now;
        await child.save();
      }
    }
    await softDeleteRecursive(node._id.toString());
    node.deletedAt = now;
    await node.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'node.delete', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title }, ip);
    res.json({ message: 'Node moved to trash' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getTrash(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const nodes = await DossierNode.find({ dossierId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function restoreNode(req: AuthRequest, res: Response): Promise<void> {
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
    // Restore node and all descendants with the same deletedAt
    const deletedAt = node.deletedAt;
    async function restoreRecursive(parentId: string) {
      const children = await DossierNode.find({ parentId, deletedAt });
      for (const child of children) {
        await restoreRecursive(child._id.toString());
        child.deletedAt = null;
        await child.save();
      }
    }
    await restoreRecursive(node._id.toString());

    // If parent was also deleted, restore to root
    if (node.parentId) {
      const parent = await DossierNode.findById(node.parentId);
      if (!parent || parent.deletedAt) {
        node.parentId = null;
      }
    }
    node.deletedAt = null;
    await node.save();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'node.restore', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title }, ip);
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function purgeNode(req: AuthRequest, res: Response): Promise<void> {
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
    async function hardDeleteRecursive(parentId: string) {
      const children = await DossierNode.find({ parentId });
      for (const child of children) {
        await hardDeleteRecursive(child._id.toString());
        await child.deleteOne();
      }
    }
    const nodeTitle = node.title;
    const nodeDossierId = node.dossierId.toString();
    await hardDeleteRecursive(node._id.toString());
    await node.deleteOne();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'node.purge', 'dossier', nodeDossierId, { nodeId: req.params.nodeId, title: nodeTitle }, ip);
    res.json({ message: 'Node permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function emptyTrash(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    await DossierNode.deleteMany({ dossierId, deletedAt: { $ne: null } });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'node.empty_trash', 'dossier', dossierId, {}, ip);
    res.json({ message: 'Trash emptied' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function moveNode(req: AuthRequest, res: Response): Promise<void> {
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
    const { parentId, order } = req.body;
    node.parentId = parentId ?? node.parentId;
    node.order = order ?? node.order;
    await node.save();
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadFile(req: AuthRequest, res: Response): Promise<void> {
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
    if (!req.file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }
    node.fileUrl = `/uploads/${req.file.filename}`;
    node.fileName = req.file.originalname;
    node.fileSize = req.file.size;
    await node.save();
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
