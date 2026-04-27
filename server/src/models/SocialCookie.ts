import { Schema, model, Document, Types } from 'mongoose';

export type SocialPlatform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'snapchat'
  | 'facebook'
  | 'x'
  | 'whatsapp'
  | 'threads'
  | 'linkedin'
  | 'strava';

export type SessionMode = 'cookies' | 'wa-web' | 'both';

export interface IWhatsappWebSession {
  isActive: boolean;
  pairedAt?: Date;
  authPath?: string;
  accountInfo?: { phone?: string; name?: string };
  lastUsedAt?: Date;
}

export interface IDailyScanCounter {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ISocialCookie extends Document {
  userId: Types.ObjectId;
  platform: SocialPlatform;
  cookies: string;
  sessionMode: SessionMode;
  whatsappWebSession?: IWhatsappWebSession;
  dailyScanCounter?: IDailyScanCounter;
  createdAt: Date;
  updatedAt: Date;
}

export const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  'youtube',
  'instagram',
  'tiktok',
  'snapchat',
  'facebook',
  'x',
  'whatsapp',
  'threads',
  'linkedin',
  'strava',
];

const socialCookieSchema = new Schema<ISocialCookie>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: {
    type: String,
    enum: SUPPORTED_PLATFORMS,
    required: true,
  },
  cookies: { type: String, default: '' },
  sessionMode: {
    type: String,
    enum: ['cookies', 'wa-web', 'both'],
    default: 'cookies',
  },
  whatsappWebSession: {
    isActive: { type: Boolean, default: false },
    pairedAt: Date,
    authPath: String,
    accountInfo: {
      phone: String,
      name: String,
    },
    lastUsedAt: Date,
  },
  dailyScanCounter: {
    date: { type: String, default: '' },
    count: { type: Number, default: 0 },
  },
}, { timestamps: true });

socialCookieSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default model<ISocialCookie>('SocialCookie', socialCookieSchema);
