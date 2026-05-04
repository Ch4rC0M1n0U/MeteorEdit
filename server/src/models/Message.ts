import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  authorId: Types.ObjectId;
  /** Plaintext for channels, base64 ciphertext for direct (E2E) */
  body: string;
  /** Set to true when body is encrypted with the recipient's RSA public key (DM E2E) */
  isEncrypted: boolean;
  mentions: Types.ObjectId[];
  /** Optional reference to another message (reply / quote) — phase 4 */
  replyTo?: Types.ObjectId;
  /** Optional reference to a dossier node, e.g. "look at this note" */
  nodeRef?: { dossierId: Types.ObjectId; nodeId: Types.ObjectId };
  editedAt?: Date | null;
  deletedAt?: Date | null;
  /** Timestamp + userId of the person who pinned the message in its conversation */
  pinnedAt?: Date | null;
  pinnedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  body: { type: String, required: true, maxlength: 8000 },
  isEncrypted: { type: Boolean, default: false },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  nodeRef: {
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier' },
    nodeId: { type: Schema.Types.ObjectId, ref: 'DossierNode' },
  },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  pinnedAt: { type: Date, default: null },
  pinnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ deletedAt: 1 });
// TTL — auto-delete soft-deleted messages after 30 days, hard-delete all messages after 1 year
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

export default model<IMessage>('Message', messageSchema);
