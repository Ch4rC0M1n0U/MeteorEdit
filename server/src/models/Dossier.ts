import mongoose, { Schema } from 'mongoose';
import { IDossier } from '../types';

const entitySchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  photos: [{ type: String }],
}, { _id: false });

const investigatorSchema = new Schema({
  name: { type: String, default: '' },
  service: { type: String, default: '' },
  unit: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
}, { _id: false });

const linkedDocumentSchema = new Schema({
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const dossierSchema = new Schema<IDossier>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
    icon: { type: String, default: null },
    logoPath: { type: String, default: null },
    objectives: { type: String, default: '' },
    entities: [entitySchema],
    judicialFacts: { type: String, default: '' },
    tags: [{ type: String, lowercase: true, trim: true }],
    investigator: { type: investigatorSchema, default: () => ({}) },
    classification: { type: String, enum: ['priority', 'routine'], default: 'routine' },
    isUrgent: { type: Boolean, default: false },
    isEmbargo: { type: Boolean, default: false },
    magistrate: { type: String, default: '' },
    isFirstRequest: { type: Boolean, default: true },
    dossierLanguage: { type: String, enum: ['fr', 'nl'], default: 'fr' },
    linkedDocuments: [linkedDocumentSchema],
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    encryptionKeys: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      encryptedKey: { type: String },
    }],
    isEncrypted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

dossierSchema.index({ title: 'text', description: 'text', objectives: 'text', judicialFacts: 'text' });
dossierSchema.index({ tags: 1 });
dossierSchema.index({ owner: 1 });
dossierSchema.index({ collaborators: 1 });
dossierSchema.index({ createdAt: -1 });

export default mongoose.model<IDossier>('Dossier', dossierSchema);
