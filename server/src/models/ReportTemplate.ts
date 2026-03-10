import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReportTemplate extends Document {
  title: string;
  description: string;
  prompt: string;
  owner: Types.ObjectId;
  isDefault: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reportTemplateSchema = new Schema<IReportTemplate>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    prompt: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDefault: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reportTemplateSchema.index({ owner: 1 });
reportTemplateSchema.index({ isShared: 1 });

export default mongoose.model<IReportTemplate>('ReportTemplate', reportTemplateSchema);
