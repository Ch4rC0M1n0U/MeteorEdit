import mongoose, { Schema } from 'mongoose';
import { ISiteSettings } from '../types';

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    appName: { type: String, default: 'MeteorEdit' },
    logoPath: { type: String, default: null },
    accentColor: { type: String, default: '#38bdf8' },
    faviconPath: { type: String, default: null },
    loginMessage: { type: String, default: '' },
    loginBackgroundPath: { type: String, default: null },
    require2FA: { type: Boolean, default: false },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'Le site est en maintenance. Veuillez reessayer plus tard.' },
    registrationEnabled: { type: Boolean, default: true },
    sessionTimeoutMinutes: { type: Number, default: 480 },
    passwordMinLength: { type: Number, default: 8 },
    passwordRequireUppercase: { type: Boolean, default: false },
    passwordRequireNumber: { type: Boolean, default: false },
    passwordRequireSpecial: { type: Boolean, default: false },
    maxLoginAttempts: { type: Number, default: 0 },
    lockoutDurationMinutes: { type: Number, default: 15 },
    trashAutoDeleteDays: { type: Number, default: 0 }, // 0 = disabled
    // Storage
    maxFileSizeMB: { type: Number, default: 50 },
    allowedFileTypes: { type: String, default: 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.zip' },
    // SMTP
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPass: { type: String, default: '' },
    smtpFrom: { type: String, default: '' },
    smtpSecure: { type: Boolean, default: false },
    // Web Clipper
    clipperTimeoutMs: { type: Number, default: 30000 },
    clipperQuality: { type: Number, default: 80 },
    clipperUserAgent: { type: String, default: '' },
    clipperProxy: { type: String, default: '' },
    // Defaults
    defaultEncryptionEnabled: { type: Boolean, default: false },
    // Network
    allowedOrigins: { type: String, default: '*' },
    announcementEnabled: { type: Boolean, default: false },
    announcementMessage: { type: String, default: '' },
    announcementVariant: { type: String, default: 'info', enum: ['info', 'warning', 'error'] },
  },
  { collection: 'sitesettings' }
);

export default mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);
