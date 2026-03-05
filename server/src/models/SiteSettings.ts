import mongoose, { Schema } from 'mongoose';
import { ISiteSettings } from '../types';

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    appName: { type: String, default: 'MeteorEdit' },
    logoPath: { type: String, default: null },
    accentColor: { type: String, default: '#38bdf8' },
    faviconPath: { type: String, default: null },
    loginMessage: { type: String, default: '' },
    require2FA: { type: Boolean, default: false },
  },
  { collection: 'sitesettings' }
);

export default mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);
