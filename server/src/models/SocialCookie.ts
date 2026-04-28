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
  | 'strava'
  | 'reddit'
  | 'telegram'
  | 'mastodon'
  | 'linktree'
  | 'paypal';

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
  /** AES-256-GCM encrypted JSON array of auth cookies (browser extension import) */
  webCookiesEncrypted?: string;
  /** Number of cookies stored (for UI display, no sensitive data) */
  webCookiesCount?: number;
  webCookiesUpdatedAt?: Date;
  webCookiesUpdatedVia?: 'extension' | 'manual';
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
  'reddit',
  'telegram',
  'mastodon',
  'linktree',
  'paypal',
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
  webCookiesEncrypted: { type: String, default: null },
  webCookiesCount: { type: Number, default: 0 },
  webCookiesUpdatedAt: { type: Date, default: null },
  webCookiesUpdatedVia: { type: String, enum: ['extension', 'manual'], default: null },
}, { timestamps: true });

socialCookieSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default model<ISocialCookie>('SocialCookie', socialCookieSchema);
