import { Response } from 'express';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { extractTextFromTipTap } from '../utils/extractText';
import { logActivity } from '../utils/activityLogger';
import { createNotification } from '../utils/notifier';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

/**
 * Delete physical files associated with a node.
 */
async function cleanupNodeFiles(node: any): Promise<void> {
  if (node.fileUrl) {
    const filePath = path.resolve(UPLOAD_DIR, '..', node.fileUrl);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`Failed to delete file ${filePath}:`, err);
    }
  }
}

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  // Embargo dossiers: only owner/collaborators, no admin bypass
  return dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
}

async function isDossierEmbargo(dossierId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId).select('isEmbargo').lean();
  return !!dossier?.isEmbargo;
}

export async function getNodes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkDossierAccess(dossierId, req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const nodes = await DossierNode.find({ dossierId, deletedAt: null })
      .select('_id dossierId parentId type title order fileUrl fileName fileSize deletedAt createdAt updatedAt')
      .sort({ order: 1 })
      .lean();
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getNode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const node = await DossierNode.findById(req.params.nodeId).lean();
    if (!node) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }
    if (!(await checkDossierAccess(node.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    res.json(node);
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
    if (!(await isDossierEmbargo(dossierId))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.create', 'dossier', dossierId, { nodeId: node._id.toString(), type: node.type, title: node.title }, ip, ua);
    }
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
    if (!(await isDossierEmbargo(node.dossierId.toString()))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.update', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title }, ip, ua);
    }
    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function viewNode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const node = await DossierNode.findById(req.params.nodeId).select('dossierId title type').lean();
    if (!node) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }
    if (!(await checkDossierAccess(node.dossierId.toString(), req.user!.userId))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'node.view', 'node', node._id.toString(), { dossierId: node.dossierId.toString(), type: node.type, title: node.title }, ip, ua);
    res.json({ ok: true });
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

    // Collect all descendant IDs iteratively
    const now = new Date();
    const allIds = [node._id];
    let currentParentIds = [node._id.toString()];

    while (currentParentIds.length > 0) {
      const children = await DossierNode.find(
        { parentId: { $in: currentParentIds }, deletedAt: null },
        '_id'
      ).lean();
      const childIds = children.map(c => c._id);
      allIds.push(...childIds);
      currentParentIds = childIds.map(id => id.toString());
    }

    // Bulk soft-delete all at once
    await DossierNode.updateMany({ _id: { $in: allIds } }, { deletedAt: now });

    if (!(await isDossierEmbargo(node.dossierId.toString()))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.delete', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title }, ip, ua);
    }
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
    const nodes = await DossierNode.find({ dossierId, deletedAt: { $ne: null } })
      .select('_id dossierId parentId type title order fileUrl fileName fileSize deletedAt createdAt updatedAt')
      .sort({ deletedAt: -1 })
      .lean();
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

    // Collect all descendant IDs with the same deletedAt timestamp
    const deletedAt = node.deletedAt;
    const allIds = [node._id];
    let currentParentIds = [node._id.toString()];

    while (currentParentIds.length > 0) {
      const children = await DossierNode.find(
        { parentId: { $in: currentParentIds }, deletedAt },
        '_id'
      ).lean();
      const childIds = children.map(c => c._id);
      allIds.push(...childIds);
      currentParentIds = childIds.map(id => id.toString());
    }

    // If parent was also deleted, restore to root
    if (node.parentId) {
      const parent = await DossierNode.findById(node.parentId);
      if (!parent || parent.deletedAt) {
        node.parentId = null;
      }
    }

    // Bulk restore all at once
    await DossierNode.updateMany({ _id: { $in: allIds } }, { deletedAt: null });
    node.deletedAt = null;
    await node.save();

    if (!(await isDossierEmbargo(node.dossierId.toString()))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.restore', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title }, ip, ua);
    }
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
        await cleanupNodeFiles(child);
        await child.deleteOne();
      }
    }
    const nodeTitle = node.title;
    const nodeDossierId = node.dossierId.toString();
    await hardDeleteRecursive(node._id.toString());
    await cleanupNodeFiles(node);
    await node.deleteOne();
    if (!(await isDossierEmbargo(nodeDossierId))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.purge', 'dossier', nodeDossierId, { nodeId: req.params.nodeId, title: nodeTitle }, ip, ua);
    }
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
    const trashedNodes = await DossierNode.find({ dossierId, deletedAt: { $ne: null } });
    for (const n of trashedNodes) {
      await cleanupNodeFiles(n);
    }
    await DossierNode.deleteMany({ dossierId, deletedAt: { $ne: null } });
    if (!(await isDossierEmbargo(dossierId))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.empty_trash', 'dossier', dossierId, {}, ip, ua);
    }
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
    const oldParentId = node.parentId?.toString() ?? null;
    const newParentId = 'parentId' in req.body ? parentId : oldParentId;

    if ('parentId' in req.body) node.parentId = parentId;
    if ('order' in req.body) node.order = order;
    await node.save();

    // Reorder siblings in the target parent atomically
    if ('order' in req.body) {
      const siblings = await DossierNode.find({
        dossierId: node.dossierId,
        parentId: newParentId,
        _id: { $ne: node._id },
        deletedAt: null,
      }).sort({ order: 1 });

      // Insert node at the correct position and reorder all
      const ops = [];
      let idx = 0;
      for (const sibling of siblings) {
        if (idx === order) idx++; // skip the position reserved for moved node
        if (sibling.order !== idx) {
          ops.push(DossierNode.updateOne({ _id: sibling._id }, { order: idx }));
        }
        idx++;
      }

      // If old parent is different, reorder old parent's children too
      if (oldParentId !== (newParentId?.toString() ?? null)) {
        const oldSiblings = await DossierNode.find({
          dossierId: node.dossierId,
          parentId: oldParentId,
          _id: { $ne: node._id },
          deletedAt: null,
        }).sort({ order: 1 });
        for (let i = 0; i < oldSiblings.length; i++) {
          if (oldSiblings[i].order !== i) {
            ops.push(DossierNode.updateOne({ _id: oldSiblings[i]._id }, { order: i }));
          }
        }
      }

      if (ops.length) await Promise.all(ops);
    }

    if (!(await isDossierEmbargo(node.dossierId.toString()))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.move', 'dossier', node.dossierId.toString(), { nodeId: node._id.toString(), title: node.title, oldParentId, newParentId }, ip, ua);
    }
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
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
    const absFilePath = path.join(uploadDir, req.file.filename);

    const originalContentType = req.body.originalContentType;
    const originalFileSize = req.body.originalFileSize ? parseInt(req.body.originalFileSize, 10) : undefined;

    node.fileUrl = `/uploads/${req.file.filename}`;
    node.fileName = req.file.originalname;
    node.fileSize = originalFileSize || req.file.size;
    if (originalContentType) {
      (node as any).originalContentType = originalContentType;
    }
    await node.save();

    res.json(node);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function mentionUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const { mentionedUserId } = req.body;
    if (!mentionedUserId) {
      res.status(400).json({ message: 'mentionedUserId required' });
      return;
    }
    const node = await DossierNode.findById(nodeId);
    if (!node) { res.status(404).json({ message: 'Node not found' }); return; }

    const hasAccess = await checkDossierAccess(node.dossierId.toString(), req.user!.userId);
    if (!hasAccess) { res.status(403).json({ message: 'Forbidden' }); return; }

    const fromUser = await User.findById(req.user!.userId).select('firstName lastName');
    const fromName = fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : 'Quelqu\'un';

    await createNotification(
      mentionedUserId,
      'mention',
      `${fromName} vous a mentionné dans "${node.title}"`,
      node.dossierId.toString(),
      req.user!.userId,
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function duplicateNode(req: AuthRequest, res: Response): Promise<void> {
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

    // Get next order in the same parent
    const lastSibling = await DossierNode.findOne({
      dossierId: node.dossierId,
      parentId: node.parentId,
    }).sort({ order: -1 });
    const newOrder = lastSibling ? lastSibling.order + 1 : 0;

    const duplicate = await DossierNode.create({
      dossierId: node.dossierId,
      parentId: node.parentId,
      type: node.type,
      title: `${node.title} (copie)`,
      order: newOrder,
      content: node.content,
      contentText: node.contentText,
      excalidrawData: node.excalidrawData,
      mapData: node.mapData,
    });

    if (!(await isDossierEmbargo(node.dossierId.toString()))) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(req.user!.userId, 'node.duplicate', 'dossier', node.dossierId.toString(), { nodeId: duplicate._id.toString(), sourceNodeId: node._id.toString(), title: duplicate.title }, ip, ua);
    }
    res.status(201).json(duplicate);
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
    const originalContentType = req.body?.originalContentType;
    res.json({ url, originalContentType });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteUploadedFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Express 5 wildcard returns array of segments
    const raw = req.params.filepath;
    const filePath = Array.isArray(raw) ? raw.join('/') : (raw || req.params[0]);
    // Sanitize: block path traversal
    if (!filePath || filePath.includes('..')) {
      res.status(400).json({ message: 'Invalid file path' });
      return;
    }
    const fullPath = path.join(UPLOAD_DIR, filePath);
    // Ensure resolved path stays within UPLOAD_DIR
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
      res.status(400).json({ message: 'Invalid file path' });
      return;
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
