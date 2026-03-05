import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISnapshot extends Document {
  nodeId: Types.ObjectId;
  dossierId: Types.ObjectId;
  type: 'note' | 'mindmap';
  content: any;
  label: string;
  createdAt: Date;
}

const snapshotSchema = new Schema<ISnapshot>(
  {
    nodeId: { type: Schema.Types.ObjectId, ref: 'DossierNode', required: true, index: true },
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true },
    type: { type: String, enum: ['note', 'mindmap'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    label: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<ISnapshot>('Snapshot', snapshotSchema);
