import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITemplateQuestion {
  id: string;
  parentId: string | null;
  parentAnswerValue: string | null;
  order: number;
  type: 'boolean' | 'radio' | 'checkbox' | 'text';
  label: string;
  options?: string[];
  contentBlocks: Record<string, any>;
}

export interface INoteTemplate extends Document {
  title: string;
  description: string;
  content: any;
  interactiveQuestions: ITemplateQuestion[];
  owner: Types.ObjectId;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const noteTemplateSchema = new Schema<INoteTemplate>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    content: { type: Schema.Types.Mixed, default: null },
    interactiveQuestions: { type: Schema.Types.Mixed, default: [] },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

noteTemplateSchema.index({ owner: 1 });

export default mongoose.model<INoteTemplate>('NoteTemplate', noteTemplateSchema);
