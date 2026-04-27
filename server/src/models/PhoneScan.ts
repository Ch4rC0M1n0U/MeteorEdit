import { Schema, model, Document, Types } from 'mongoose';

export type PhoneScanStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed' | 'rate_limited';
export type PhoneScannerPlatform = 'whatsapp';

export interface IPhoneScanProgress {
  tested: number;
  found: number;
  errors: number;
}

export interface IPhoneScan extends Document {
  dossierId: Types.ObjectId;
  userId: Types.ObjectId;
  pattern: string;
  countryCode: string;
  totalCombinations: number;
  status: PhoneScanStatus;
  platforms: PhoneScannerPlatform[];
  progress: IPhoneScanProgress;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const phoneScanSchema = new Schema<IPhoneScan>({
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pattern: { type: String, required: true },
  countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
  totalCombinations: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'cancelled', 'failed', 'rate_limited'],
    default: 'queued',
    index: true,
  },
  platforms: {
    type: [String],
    enum: ['whatsapp'],
    default: ['whatsapp'],
  },
  progress: {
    tested: { type: Number, default: 0 },
    found: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
  },
  startedAt: Date,
  completedAt: Date,
  errorMessage: String,
}, { timestamps: true });

phoneScanSchema.index({ dossierId: 1, createdAt: -1 });

export default model<IPhoneScan>('PhoneScan', phoneScanSchema);
