import { Schema, model, Document, Types } from 'mongoose';
import type { PhoneScannerPlatform } from './PhoneScan';

export type PhoneScanResultStatus = 'exists' | 'not_found' | 'error' | 'rate_limited';

export interface IPhoneScanProfile {
  name?: string;
  about?: string;
  avatarUrl?: string;
  isBusiness?: boolean;
}

export interface IPhoneScanResult extends Document {
  scanId: Types.ObjectId;
  dossierId: Types.ObjectId;
  userId: Types.ObjectId;
  phoneE164: string;
  platform: PhoneScannerPlatform;
  status: PhoneScanResultStatus;
  profile?: IPhoneScanProfile;
  errorMessage?: string;
  testedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const phoneScanResultSchema = new Schema<IPhoneScanResult>({
  scanId: { type: Schema.Types.ObjectId, ref: 'PhoneScan', required: true, index: true },
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  phoneE164: { type: String, required: true, index: true },
  platform: {
    type: String,
    enum: ['whatsapp'],
    required: true,
  },
  status: {
    type: String,
    enum: ['exists', 'not_found', 'error', 'rate_limited'],
    required: true,
  },
  profile: {
    name: String,
    about: String,
    avatarUrl: String,
    isBusiness: Boolean,
  },
  errorMessage: String,
  testedAt: { type: Date, default: Date.now },
}, { timestamps: true });

phoneScanResultSchema.index({ dossierId: 1, testedAt: -1 });
phoneScanResultSchema.index({ phoneE164: 1, platform: 1, testedAt: -1 });

export default model<IPhoneScanResult>('PhoneScanResult', phoneScanResultSchema);
