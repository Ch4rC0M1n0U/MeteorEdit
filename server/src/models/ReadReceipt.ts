import { Schema, model, Document, Types } from 'mongoose';

export interface IReadReceipt extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadMessageId: Types.ObjectId;
  readAt: Date;
}

const readReceiptSchema = new Schema<IReadReceipt>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
  readAt: { type: Date, default: Date.now },
});

readReceiptSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export default model<IReadReceipt>('ReadReceipt', readReceiptSchema);
