import { Schema, model, Document, Types } from 'mongoose';

export type ConversationType = 'channel-dossier' | 'direct';

export interface IConversation extends Document {
  type: ConversationType;
  /** Only set for type === 'channel-dossier' — owner of the dossier becomes admin de facto */
  dossierId?: Types.ObjectId;
  participants: Types.ObjectId[];
  /** Owner of the dossier (channel admin) — empty for direct conversations */
  adminId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  type: { type: String, enum: ['channel-dossier', 'direct'], required: true, index: true },
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', default: null, index: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  adminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '', maxlength: 240 },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ dossierId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'channel-dossier' } });

export default model<IConversation>('Conversation', conversationSchema);
