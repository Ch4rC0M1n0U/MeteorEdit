import { Schema, model, Document } from 'mongoose';

export interface IPhoneScannerSettings extends Document {
  maxDailyChecksGlobal: number;
  maxDailyChecksPerUser: number;
  minDelayMs: number;
  maxDelayMs: number;
  combinationsWarnThreshold: number;
  combinationsBlockThreshold: number;
  resultsTtlDays: number;
  globalDailyCounter: { date: string; count: number };
  createdAt: Date;
  updatedAt: Date;
}

const phoneScannerSettingsSchema = new Schema<IPhoneScannerSettings>({
  maxDailyChecksGlobal: { type: Number, default: 200 },
  maxDailyChecksPerUser: { type: Number, default: 50 },
  minDelayMs: { type: Number, default: 30000 },
  maxDelayMs: { type: Number, default: 60000 },
  combinationsWarnThreshold: { type: Number, default: 50 },
  combinationsBlockThreshold: { type: Number, default: 200 },
  resultsTtlDays: { type: Number, default: 30 },
  globalDailyCounter: {
    date: { type: String, default: '' },
    count: { type: Number, default: 0 },
  },
}, { timestamps: true });

export default model<IPhoneScannerSettings>('PhoneScannerSettings', phoneScannerSettingsSchema);

/**
 * Singleton accessor — creates the settings doc on first call.
 */
export async function getPhoneScannerSettings(): Promise<IPhoneScannerSettings> {
  const Model = model<IPhoneScannerSettings>('PhoneScannerSettings');
  let settings = await Model.findOne();
  if (!settings) {
    settings = await Model.create({});
  }
  return settings;
}
