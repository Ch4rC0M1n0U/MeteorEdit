import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Comment from '../models/Comment';

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
  await comment.deleteOne();
  res.json({ message: 'Deleted' });
}

export async function getCommentCount(req: AuthRequest, res: Response) {
  const nodeId = req.params.nodeId as string;
  const count = await Comment.countDocuments({ nodeId });
  res.json({ count });
}
