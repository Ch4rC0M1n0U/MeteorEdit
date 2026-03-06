import mongoose, { Schema } from 'mongoose';
import { IActivityLog } from '../types';

const activityLogSchema = new Schema<IActivityLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: [
      'login', 'dossier.create', 'dossier.delete', 'dossier.update',
      'collaborator.add', 'collaborator.remove',
      'user.role_change', 'user.activate', 'user.deactivate', 'user.delete',
      'admin.reset_password', 'admin.reset_2fa',
    ],
    required: true,
  },
  targetType: { type: String, enum: ['dossier', 'user', 'system'], required: true },
  targetId: { type: Schema.Types.ObjectId, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
