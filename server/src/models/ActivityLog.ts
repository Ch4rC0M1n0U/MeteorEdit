import mongoose, { Schema } from 'mongoose';
import { IActivityLog } from '../types';

const activityLogSchema = new Schema<IActivityLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    required: true,
  },
  targetType: { type: String, enum: ['dossier', 'user', 'system', 'node'], required: true },
  targetId: { type: Schema.Types.ObjectId, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

export default mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
