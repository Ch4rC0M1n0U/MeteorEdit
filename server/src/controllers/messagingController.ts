import { Response } from 'express';
import { Types } from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import ReadReceipt from '../models/ReadReceipt';
import {
  authorizeConversationAccess,
  ensureDossierChannel,
  shareAtLeastOneDossier,
} from '../utils/messagingAuthz';
import User from '../models/User';
import Dossier from '../models/Dossier';
import { sanitizeMessageBody, buildPreview } from '../utils/messageSanitize';
import { getIO } from '../socket';
import { logActivity } from '../utils/activityLogger';

function getRequestMeta(req: AuthRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

/**
 * GET /api/messaging/conversations
 * Lists conversations the current user belongs to, with last message + unread count.
 */
export async function getMyConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const conversations = await Conversation.find({ participants: userId, archivedAt: null })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'firstName lastName email avatarUrl')
      .lean();

    // Compute unread counts in parallel
    const receipts = await ReadReceipt.find({
      userId,
      conversationId: { $in: conversations.map((c) => c._id) },
    }).lean();
    const receiptMap = new Map(receipts.map((r) => [String(r.conversationId), r]));

    const result = await Promise.all(
      conversations.map(async (c) => {
        const last = receiptMap.get(String(c._id));
        const filter: any = { conversationId: c._id, deletedAt: null, authorId: { $ne: userId } };
        if (last) filter._id = { $gt: last.lastReadMessageId };
        const unreadCount = await Message.countDocuments(filter);
        return { ...c, unreadCount };
      })
    );

    res.json({ conversations: result });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/messaging/conversations/dossier/:dossierId
 * Returns (creating if needed) the channel-dossier conversation for that dossier.
 */
export async function openDossierChannel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossierId = String(req.params.dossierId);
    if (!Types.ObjectId.isValid(dossierId)) {
      res.status(400).json({ message: 'Invalid dossierId' });
      return;
    }
    const conv = await ensureDossierChannel(dossierId, userId);
    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'firstName lastName email avatarUrl')
      .lean();
    res.json({ conversation: populated });
  } catch (err: unknown) {
    res.status(403).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/messaging/conversations/:id/messages?before=<messageId>&limit=50
 * Cursor-based pagination newest-first.
 */
export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) {
      res.status(403).json({ message: authz.reason });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100);
    const before = req.query.before ? String(req.query.before) : null;

    const filter: any = { conversationId: authz.conversation._id, deletedAt: null };
    if (before && Types.ObjectId.isValid(before)) {
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    const messages = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('authorId', 'firstName lastName email avatarUrl')
      .lean();

    res.json({
      messages: messages.reverse(), // oldest-first for the client
      hasMore: messages.length === limit,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/messaging/conversations/:id/messages
 * body: { body, replyTo?, mentions?, nodeRef?, isEncrypted? }
 */
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) {
      res.status(403).json({ message: authz.reason });
      return;
    }

    const isEncrypted = !!req.body?.isEncrypted;
    let body: string;
    if (isEncrypted) {
      // For E2E DMs the body is opaque ciphertext — don't sanitize, but cap length
      const raw = String(req.body?.body ?? '');
      if (raw.length === 0) { res.status(400).json({ message: 'Empty body' }); return; }
      if (raw.length > 32000) { res.status(400).json({ message: 'Body too long' }); return; }
      body = raw;
    } else {
      body = sanitizeMessageBody(req.body?.body);
      if (!body) { res.status(400).json({ message: 'Empty body' }); return; }
    }

    // Validate mentions: must be participants of the conversation
    const rawMentions = Array.isArray(req.body?.mentions) ? req.body.mentions : [];
    const validMentions = rawMentions
      .filter((m: unknown) => typeof m === 'string' && Types.ObjectId.isValid(m))
      .map((m: string) => new Types.ObjectId(m))
      .filter((m: Types.ObjectId) =>
        authz.conversation.participants.some((p) => String(p) === String(m))
      );

    // Validate replyTo: must belong to same conversation
    let replyTo: Types.ObjectId | undefined;
    if (req.body?.replyTo && Types.ObjectId.isValid(req.body.replyTo)) {
      const target = await Message.findOne({
        _id: req.body.replyTo,
        conversationId: authz.conversation._id,
      }).select('_id').lean();
      if (target) replyTo = target._id as Types.ObjectId;
    }

    // Validate nodeRef
    let nodeRef: { dossierId: Types.ObjectId; nodeId: Types.ObjectId } | undefined;
    if (req.body?.nodeRef?.dossierId && req.body?.nodeRef?.nodeId
        && Types.ObjectId.isValid(req.body.nodeRef.dossierId)
        && Types.ObjectId.isValid(req.body.nodeRef.nodeId)) {
      // For channel-dossier conversations, the nodeRef must be in the same dossier
      if (authz.conversation.type === 'channel-dossier'
          && String(authz.conversation.dossierId) === String(req.body.nodeRef.dossierId)) {
        nodeRef = {
          dossierId: new Types.ObjectId(req.body.nodeRef.dossierId),
          nodeId: new Types.ObjectId(req.body.nodeRef.nodeId),
        };
      }
    }

    const message = await Message.create({
      conversationId: authz.conversation._id,
      authorId: userId,
      body,
      isEncrypted,
      mentions: validMentions,
      replyTo,
      nodeRef,
    });

    // Update conversation lastMessage* fields
    const previewSource = isEncrypted ? '[message chiffré]' : body;
    await Conversation.updateOne(
      { _id: authz.conversation._id },
      { $set: { lastMessageAt: message.createdAt, lastMessagePreview: buildPreview(previewSource) } }
    );

    const populated = await Message.findById(message._id)
      .populate('authorId', 'firstName lastName email avatarUrl')
      .lean();

    // Broadcast via socket.io to all participants in the conversation room
    const io = getIO();
    if (io) {
      io.to(`conv:${String(authz.conversation._id)}`).emit('message:new', {
        message: populated,
        conversationId: String(authz.conversation._id),
        lastMessagePreview: buildPreview(previewSource),
        lastMessageAt: message.createdAt,
      });
    }

    res.status(201).json({ message: populated });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * PUT /api/messaging/messages/:id
 * Author-only (or channel admin in special cases — kept author-only here).
 */
export async function editMessage(req: AuthRequest, res: Response): Promise<void> {
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
    if (String(message.authorId) !== userId) {
      res.status(403).json({ message: 'Only the author can edit a message' });
      return;
    }
    // Re-check the user still has access to the conversation
    const authz = await authorizeConversationAccess(userId, String(message.conversationId));
    if (!authz.ok) {
      res.status(403).json({ message: authz.reason });
      return;
    }

    const newBody = message.isEncrypted ? String(req.body?.body ?? '') : sanitizeMessageBody(req.body?.body);
    if (!newBody) { res.status(400).json({ message: 'Empty body' }); return; }
    if (message.isEncrypted && newBody.length > 32000) {
      res.status(400).json({ message: 'Body too long' });
      return;
    }

    message.body = newBody;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(messageId)
      .populate('authorId', 'firstName lastName email avatarUrl')
      .lean();

    const io = getIO();
    if (io) {
      io.to(`conv:${String(message.conversationId)}`).emit('message:edit', {
        message: populated,
        conversationId: String(message.conversationId),
      });
    }

    res.json({ message: populated });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * DELETE /api/messaging/messages/:id
 * Author or channel-dossier admin (= dossier owner).
 */
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
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
    if (!authz.ok) {
      res.status(403).json({ message: authz.reason });
      return;
    }
    const isAuthor = String(message.authorId) === userId;
    if (!isAuthor && !authz.isAdmin) {
      res.status(403).json({ message: 'Only the author or the channel admin can delete a message' });
      return;
    }

    message.deletedAt = new Date();
    await message.save();

    const { ip, ua } = getRequestMeta(req);
    if (!isAuthor) {
      await logActivity(userId, 'messaging.admin-delete', 'system', messageId, {
        conversationId: String(message.conversationId),
        originalAuthor: String(message.authorId),
      }, ip, ua);
    }

    const io = getIO();
    if (io) {
      io.to(`conv:${String(message.conversationId)}`).emit('message:delete', {
        messageId,
        conversationId: String(message.conversationId),
        deletedBy: userId,
      });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/messaging/conversations/:id/read
 * body: { lastReadMessageId }
 */
export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { lastReadMessageId } = req.body ?? {};
    if (!lastReadMessageId || !Types.ObjectId.isValid(lastReadMessageId)) {
      res.status(400).json({ message: 'Invalid lastReadMessageId' });
      return;
    }
    const authz = await authorizeConversationAccess(userId, id);
    if (!authz.ok) {
      res.status(403).json({ message: authz.reason });
      return;
    }

    // Ensure the message belongs to this conversation
    const msg = await Message.findOne({
      _id: lastReadMessageId,
      conversationId: authz.conversation._id,
    }).select('_id').lean();
    if (!msg) {
      res.status(404).json({ message: 'Message not in this conversation' });
      return;
    }

    await ReadReceipt.findOneAndUpdate(
      { conversationId: authz.conversation._id, userId },
      {
        $set: {
          lastReadMessageId: new Types.ObjectId(lastReadMessageId),
          readAt: new Date(),
        },
      },
      { upsert: true }
    );

    const io = getIO();
    if (io) {
      io.to(`conv:${String(authz.conversation._id)}`).emit('read:update', {
        conversationId: String(authz.conversation._id),
        userId,
        lastReadMessageId,
      });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}


/**
 * GET /api/messaging/contacts
 * Returns the list of users this user can DM (= shares at least one dossier with).
 */
export async function getDmCandidates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    // All users who own a dossier where I am collaborator OR who are collaborator on a dossier I own/collab on
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select("owner collaborators").lean();

    const peerIds = new Set<string>();
    for (const d of dossiers) {
      if (String(d.owner) !== userId) peerIds.add(String(d.owner));
      for (const c of d.collaborators) {
        const cs = String(c);
        if (cs !== userId) peerIds.add(cs);
      }
    }

    if (peerIds.size === 0) { res.json({ contacts: [] }); return; }

    const users = await User.find({ _id: { $in: Array.from(peerIds) } })
      .select("firstName lastName email avatarUrl")
      .lean();

    res.json({ contacts: users });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Server error" });
  }
}

/**
 * POST /api/messaging/conversations/direct
 * body: { peerId }
 * Creates (idempotent) a direct conversation with the given peer if they share a dossier.
 */
export async function openDirect(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const peerId = String(req.body?.peerId ?? "");
    if (!Types.ObjectId.isValid(peerId) || peerId === userId) {
      res.status(400).json({ message: "Invalid peerId" });
      return;
    }
    const can = await shareAtLeastOneDossier(userId, peerId);
    if (!can) {
      res.status(403).json({ message: "You can only DM users you collaborate with on a dossier" });
      return;
    }

    // Idempotent lookup: a direct conversation between exactly these two users
    const existing = await Conversation.findOne({
      type: "direct",
      participants: { $all: [new Types.ObjectId(userId), new Types.ObjectId(peerId)], $size: 2 },
    });
    if (existing) {
      const populated = await Conversation.findById(existing._id)
        .populate("participants", "firstName lastName email avatarUrl")
        .lean();
      res.json({ conversation: populated });
      return;
    }

    const conv = await Conversation.create({
      type: "direct",
      participants: [new Types.ObjectId(userId), new Types.ObjectId(peerId)],
      createdBy: new Types.ObjectId(userId),
    });
    const populated = await Conversation.findById(conv._id)
      .populate("participants", "firstName lastName email avatarUrl")
      .lean();
    res.status(201).json({ conversation: populated });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Server error" });
  }
}

/**
 * GET /api/messaging/users/:userId/pubkey
 * Returns the public RSA key of a user — used by the sender to encrypt DM bodies.
 * Only resolvable for users we share a dossier with.
 */
export async function getPeerPublicKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const peerId = String(req.params.userId);
    if (!Types.ObjectId.isValid(peerId)) {
      res.status(400).json({ message: "Invalid userId" });
      return;
    }
    if (peerId !== userId) {
      const can = await shareAtLeastOneDossier(userId, peerId);
      if (!can) { res.status(403).json({ message: "Access denied" }); return; }
    }
    const user = await User.findById(peerId).select("encryptionPublicKey").lean();
    res.json({ publicKey: user?.encryptionPublicKey || null });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Server error" });
  }
}
