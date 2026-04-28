import { Schema, model, Document, Types } from 'mongoose';

export interface IApiToken extends Document {
  userId: Types.ObjectId;
  name: string;
  prefix: string;        // first 12 chars of token shown to user (e.g. "mext_abc123")
  tokenHash: string;     // bcrypt hash of full token
  scope: 'extension';    // future-proof for other token types
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

const apiTokenSchema = new Schema<IApiToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  prefix: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true },
  scope: { type: String, enum: ['extension'], default: 'extension' },
  lastUsedAt: { type: Date, default: null },
  lastUsedIp: { type: String, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

apiTokenSchema.index({ userId: 1, revokedAt: 1 });

export default model<IApiToken>('ApiToken', apiTokenSchema);
