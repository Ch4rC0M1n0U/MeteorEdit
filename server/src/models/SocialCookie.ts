import { Schema, model, Document, Types } from 'mongoose';

export interface ISocialCookie extends Document {
  userId: Types.ObjectId;
  platform: string;
  cookies: string;
  createdAt: Date;
  updatedAt: Date;
}

const socialCookieSchema = new Schema<ISocialCookie>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: {
    type: String,
    enum: ['youtube', 'instagram', 'tiktok', 'snapchat', 'facebook', 'x', 'whatsapp'],
    required: true,
  },
  cookies: { type: String, required: true },
}, { timestamps: true });

socialCookieSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default model<ISocialCookie>('SocialCookie', socialCookieSchema);
