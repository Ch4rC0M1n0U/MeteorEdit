import mongoose, { Schema } from 'mongoose';
import { INotification } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['collaborator.added', 'collaborator.removed', 'dossier.updated', 'node.updated'],
      required: true,
    },
    message: { type: String, required: true },
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', default: null },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<INotification>('Notification', notificationSchema);
