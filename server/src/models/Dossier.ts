import mongoose, { Schema } from 'mongoose';
import { IDossier } from '../types';

const entitySchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, default: '' },
}, { _id: false });

const investigatorSchema = new Schema({
  name: { type: String, default: '' },
  service: { type: String, default: '' },
  unit: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
}, { _id: false });

const dossierSchema = new Schema<IDossier>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
    objectives: { type: String, default: '' },
    entities: [entitySchema],
    judicialFacts: { type: String, default: '' },
    tags: [{ type: String, lowercase: true, trim: true }],
    investigator: { type: investigatorSchema, default: () => ({}) },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

dossierSchema.index({ title: 'text', description: 'text', objectives: 'text', judicialFacts: 'text' });
dossierSchema.index({ tags: 1 });

export default mongoose.model<IDossier>('Dossier', dossierSchema);
