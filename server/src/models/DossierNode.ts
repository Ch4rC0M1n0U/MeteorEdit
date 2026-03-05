import mongoose, { Schema } from 'mongoose';
import { IDossierNode } from '../types';

const dossierNodeSchema = new Schema<IDossierNode>(
  {
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'DossierNode', default: null },
    type: { type: String, enum: ['folder', 'note', 'mindmap', 'document'], required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    content: { type: Schema.Types.Mixed, default: null },
    excalidrawData: { type: Schema.Types.Mixed, default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dossierNodeSchema.index({ dossierId: 1, parentId: 1 });

export default mongoose.model<IDossierNode>('DossierNode', dossierNodeSchema);
