import mongoose, { Schema } from 'mongoose';
import { ILoginLog } from '../types';

const loginLogSchema = new Schema<ILoginLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    ip: { type: String, default: '' },
  },
  { timestamps: false }
);

// Auto-expire logs after 90 days
loginLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<ILoginLog>('LoginLog', loginLogSchema);
