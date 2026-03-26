import { Schema, model, Document } from 'mongoose';

export interface IApiKey extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true },
  permissions: { type: [String], default: ['read'] },
  lastUsedAt: { type: Date, default: null },
  lastUsedIp: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default model<IApiKey>('ApiKey', apiKeySchema);
