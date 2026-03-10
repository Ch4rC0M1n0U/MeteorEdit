import { Schema, model, Types } from 'mongoose';

export interface ITask {
  dossierId: Types.ObjectId;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export default model<ITask>('Task', taskSchema);
