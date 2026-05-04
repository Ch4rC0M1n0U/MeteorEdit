import { Schema, model, Document, Types } from 'mongoose';

export interface IMessageReaction extends Document {
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

const messageReactionSchema = new Schema<IMessageReaction>({
  messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true, maxlength: 16 },
}, { timestamps: { createdAt: true, updatedAt: false } });

// One user can react with the same emoji at most once per message
messageReactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

export default model<IMessageReaction>('MessageReaction', messageReactionSchema);
