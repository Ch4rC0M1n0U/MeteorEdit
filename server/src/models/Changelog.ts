import mongoose, { Schema, Document } from 'mongoose';

export interface IChangelog extends Document {
  version: string;
  date: Date;
  entries: { type: 'feature' | 'fix' | 'improvement'; message: string }[];
  createdAt: Date;
}

const changelogSchema = new Schema<IChangelog>({
  version: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  entries: [{
    type: { type: String, enum: ['feature', 'fix', 'improvement'], required: true },
    message: { type: String, required: true },
  }],
}, { timestamps: true });

changelogSchema.index({ date: -1 });

export default mongoose.model<IChangelog>('Changelog', changelogSchema);
