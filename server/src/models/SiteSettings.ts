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
  },
  { collection: 'sitesettings' }
);

export default mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);
