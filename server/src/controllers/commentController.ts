import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Comment from '../models/Comment';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { getIO, getUserSockets } from '../socket';
import { logActivity } from '../utils/activityLogger';

async function isNodeInEmbargoDossier(nodeId: string): Promise<boolean> {
  const node = await DossierNode.findById(nodeId).select('dossierId').lean();
  if (!node) return false;
  const dossier = await Dossier.findById(node.dossierId).select('isEmbargo').lean();
  return !!dossier?.isEmbargo;
}

export async function getComments(req: AuthRequest, res: Response) {
  const nodeId = req.params.nodeId as string;
  const comments = await Comment.find({ nodeId })
    .sort({ createdAt: -1 })
    .populate('userId', 'firstName lastName avatarPath');
  res.json(comments);
}

export async function createComment(req: AuthRequest, res: Response) {
  const nodeId = req.params.nodeId as string;
  const { content } = req.body;
  if (!content?.trim()) {
    res.status(400).json({ message: 'Content required' });
    return;
  }
  const comment = await Comment.create({
    nodeId,
    userId: req.user!.userId,
    content: content.trim(),
  });
  const populated = await Comment.findById(comment._id).populate('userId', 'firstName lastName avatarPath');
  if (!(await isNodeInEmbargoDossier(nodeId))) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'comment.create', 'dossier', null, { nodeId, commentId: comment._id.toString() }, ip);
  }
  const io = getIO();
  if (io) {
    const senderSockets = getUserSockets().get(req.user!.userId);
    let broadcast: any = io;
    if (senderSockets?.size) {
      broadcast = io.except([...senderSockets]);
    }
    broadcast.emit('comment-added', { nodeId, comment: populated });
  }
  res.status(201).json(populated);
}

export async function deleteComment(req: AuthRequest, res: Response) {
  const commentId = req.params.commentId as string;
  const comment = await Comment.findById(commentId);
  if (!comment) {
    res.status(404).json({ message: 'Comment not found' });
    return;
  }
  if (comment.userId.toString() !== req.user!.userId && req.user!.role !== 'admin') {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }
  const nodeId = comment.nodeId.toString();
  const embargoCheck = await isNodeInEmbargoDossier(nodeId);
  await comment.deleteOne();
  if (!embargoCheck) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'comment.delete', 'dossier', null, { nodeId, commentId }, ip);
  }
  const io = getIO();
  if (io) {
    const senderSockets = getUserSockets().get(req.user!.userId);
    let broadcast: any = io;
    if (senderSockets?.size) {
      broadcast = io.except([...senderSockets]);
    }
    broadcast.emit('comment-deleted', { nodeId, commentId });
  }
  res.json({ message: 'Deleted' });
}

export async function getCommentCount(req: AuthRequest, res: Response) {
  const nodeId = req.params.nodeId as string;
  const count = await Comment.countDocuments({ nodeId });
  res.json({ count });
}
