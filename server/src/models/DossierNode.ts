import mongoose, { Schema } from 'mongoose';
import { IDossierNode } from '../types';

const dossierNodeSchema = new Schema<IDossierNode>(
  {
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'DossierNode', default: null },
    type: { type: String, enum: ['folder', 'note', 'mindmap', 'document', 'map', 'dataset'], required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    content: { type: Schema.Types.Mixed, default: null },
    contentText: { type: String, default: null },
    excalidrawData: { type: Schema.Types.Mixed, default: null },
    mapData: { type: Schema.Types.Mixed, default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    fileHash: { type: String, default: null },
    hashVerifiedAt: { type: Date, default: null },
    lastVerificationStatus: { type: String, enum: ['valid', 'tampered', 'missing'], default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dossierNodeSchema.index({ dossierId: 1, parentId: 1 });
dossierNodeSchema.index({ contentText: 'text', title: 'text' });

export default mongoose.model<IDossierNode>('DossierNode', dossierNodeSchema);
