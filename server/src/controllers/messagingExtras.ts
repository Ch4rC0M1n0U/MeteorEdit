import { Response } from 'express';
import { Types } from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Message from '../models/Message';
import MessageReaction from '../models/MessageReaction';
import { authorizeConversationAccess } from '../utils/messagingAuthz';
import { getIO } from '../socket';

const ALLOWED_EMOJIS = new Set([
  '👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🚀', '👀', '✅',
  '❌', '🔥', '💯', '🙏', '👏', '🤔', '💡', '🤝', '🤖', '📌',
]);

export async function addReaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const messageId = String(req.params.id);
    const emoji = String(req.body?.emoji ?? '');
    if (!Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'Invalid messageId' });
      return;
    }
    if (!ALLOWED_EMOJIS.has(emoji)) {
      res.status(400).json({ message: 'Emoji not allowed' });
      return;
    }
    const message = await Message.findById(messageId).select('conversationId deletedAt').lean();
    if (!message || message.deletedAt) {
      res.status(404).json({ message: 'Message not found' });
      return;
    }
    const authz = await authorizeConversationAccess(userId, String(message.conversationId));
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    await MessageReaction.findOneAndUpdate(
      { messageId, userId, emoji },
      { $setOnInsert: { messageId, conversationId: message.conversationId, userId, emoji } },
      { upsert: true }
    );

    getIO()?.to(`conv:${String(message.conversationId)}`).emit('reaction:add', {
      conversationId: String(message.conversationId),
      messageId,
      userId,
      emoji,
    });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function removeReaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const messageId = String(req.params.id);
    const emoji = decodeURIComponent(String(req.params.emoji ?? ''));
    if (!Types.ObjectId.isValid(messageId) || !emoji) {
      res.status(400).json({ message: 'Invalid params' });
      return;
    }
    const message = await Message.findById(messageId).select('conversationId').lean();
    if (!message) { res.status(404).json({ message: 'Message not found' }); return; }
    const authz = await authorizeConversationAccess(userId, String(message.conversationId));
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    await MessageReaction.deleteOne({ messageId, userId, emoji });

    getIO()?.to(`conv:${String(message.conversationId)}`).emit('reaction:remove', {
      conversationId: String(message.conversationId),
      messageId,
      userId,
      emoji,
    });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function getReactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    const reactions = await MessageReaction.find({ conversationId: authz.conversation._id })
      .select('messageId userId emoji createdAt')
      .lean();
    res.json({ reactions });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function togglePin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const messageId = String(req.params.id);
    if (!Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'Invalid messageId' });
      return;
    }
    const message = await Message.findById(messageId);
    if (!message || message.deletedAt) {
      res.status(404).json({ message: 'Message not found' });
      return;
    }
    const authz = await authorizeConversationAccess(userId, String(message.conversationId));
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    const isAuthor = String(message.authorId) === userId;
    if (!isAuthor && !authz.isAdmin) {
      res.status(403).json({ message: 'Only the author or the channel admin can pin' });
      return;
    }

    const wasPinned = !!message.pinnedAt;
    message.pinnedAt = wasPinned ? null : new Date();
    message.pinnedBy = wasPinned ? null : new Types.ObjectId(userId);
    await message.save();

    getIO()?.to(`conv:${String(message.conversationId)}`).emit('message:pin', {
      conversationId: String(message.conversationId),
      messageId,
      pinned: !wasPinned,
      pinnedAt: message.pinnedAt,
      pinnedBy: userId,
    });
    res.json({ pinned: !wasPinned });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function getPinnedMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    const pinned = await Message.find({
      conversationId: authz.conversation._id,
      pinnedAt: { $ne: null },
      deletedAt: null,
    })
      .sort({ pinnedAt: -1 })
      .populate('authorId', 'firstName lastName email avatarUrl')
      .lean();
    res.json({ messages: pinned });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function archiveConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    if (authz.conversation.type === 'channel-dossier' && !authz.isAdmin) {
      res.status(403).json({ message: 'Only the dossier owner can archive a channel' });
      return;
    }
    authz.conversation.archivedAt = new Date();
    await authz.conversation.save();
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

export async function unarchiveConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    authz.conversation.archivedAt = null;
    await authz.conversation.save();
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/messaging/conversations/:id/export
 * Returns the raw message list as JSON. For E2E DMs the body is still
 * ciphertext — the client decrypts before generating the final markdown.
 */
export async function exportConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) { res.status(403).json({ message: authz.reason }); return; }

    const messages = await Message.find({ conversationId: authz.conversation._id, deletedAt: null })
      .sort({ createdAt: 1 })
      .populate('authorId', 'firstName lastName email')
      .lean();

    res.json({
      conversation: {
        id: String(authz.conversation._id),
        type: authz.conversation.type,
        createdAt: authz.conversation.createdAt,
      },
      messages: messages.map((m) => ({
        _id: String(m._id),
        authorId: m.authorId,
        body: m.body,
        isEncrypted: !!m.isEncrypted,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        pinnedAt: m.pinnedAt,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
