import { Types } from 'mongoose';
import Conversation, { IConversation } from '../models/Conversation';
import Dossier from '../models/Dossier';

/**
 * Authorization for messaging conversations.
 *
 * The server NEVER trusts the client's claim that a user belongs to a conversation.
 * It re-checks on every operation:
 *   - For channel-dossier: user must currently be owner OR collaborator of the dossier
 *   - For direct: user must be in conversation.participants AND share at least one
 *     dossier with the other participant (collaboration link)
 */

export type AuthzCheckResult =
  | { ok: true; conversation: IConversation; isAdmin: boolean }
  | { ok: false; reason: string };

export async function authorizeConversationAccess(
  userId: string,
  conversationId: string
): Promise<AuthzCheckResult> {
  if (!Types.ObjectId.isValid(conversationId)) {
    return { ok: false, reason: 'Invalid conversationId' };
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { ok: false, reason: 'Conversation not found' };

  if (conversation.type === 'channel-dossier') {
    if (!conversation.dossierId) return { ok: false, reason: 'Channel without dossier' };
    const dossier = await Dossier.findOne({
      _id: conversation.dossierId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id owner').lean();
    if (!dossier) return { ok: false, reason: 'Access denied to dossier' };
    const isAdmin = String(dossier.owner) === String(userId);
    return { ok: true, conversation, isAdmin };
  }

  if (conversation.type === 'direct') {
    const isParticipant = conversation.participants.some((p) => String(p) === String(userId));
    if (!isParticipant) return { ok: false, reason: 'Not a participant' };
    return { ok: true, conversation, isAdmin: false };
  }

  return { ok: false, reason: 'Unknown conversation type' };
}

/**
 * Ensure a channel-dossier conversation exists for a given dossier.
 * Returns the conversation, creating it if needed and syncing participants
 * with the current dossier collaborators (in case some have changed).
 */
export async function ensureDossierChannel(
  dossierId: string,
  userId: string
): Promise<IConversation> {
  const dossier = await Dossier.findOne({
    _id: dossierId,
    $or: [{ owner: userId }, { collaborators: userId }],
  }).select('_id owner collaborators').lean();
  if (!dossier) {
    throw new Error('Access denied or dossier not found');
  }

  const participants = [
    new Types.ObjectId(String(dossier.owner)),
    ...dossier.collaborators.map((c: any) => new Types.ObjectId(String(c))),
  ];
  // Dedup
  const uniqueParticipantIds = Array.from(new Set(participants.map((p) => String(p)))).map(
    (id) => new Types.ObjectId(id)
  );

  const conversation = await Conversation.findOneAndUpdate(
    { type: 'channel-dossier', dossierId: new Types.ObjectId(String(dossier._id)) },
    {
      $set: {
        participants: uniqueParticipantIds,
        adminId: new Types.ObjectId(String(dossier.owner)),
      },
      $setOnInsert: {
        type: 'channel-dossier',
        dossierId: new Types.ObjectId(String(dossier._id)),
        createdBy: new Types.ObjectId(String(dossier.owner)),
      },
    },
    { upsert: true, new: true }
  );

  return conversation as IConversation;
}

/**
 * For direct messages: check that two users share at least one dossier.
 */
export async function shareAtLeastOneDossier(userIdA: string, userIdB: string): Promise<boolean> {
  if (userIdA === userIdB) return false;
  const count = await Dossier.countDocuments({
    $or: [
      { owner: userIdA, collaborators: userIdB },
      { owner: userIdB, collaborators: userIdA },
      { collaborators: { $all: [userIdA, userIdB] } },
    ],
  });
  return count > 0;
}
