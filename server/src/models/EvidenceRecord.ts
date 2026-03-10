import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvidenceVerification {
  verifiedAt: Date;
  verifiedBy: Types.ObjectId;
  status: 'valid' | 'tampered' | 'missing';
  computedHash: string | null;
}

export interface IEvidenceRecord extends Document {
  nodeId: Types.ObjectId;
  dossierId: Types.ObjectId;
  capturedBy: Types.ObjectId;
  capturedAt: Date;
  fileHash: string;
  filePath: string;
  fileSize: number;
  sourceUrl: string | null;
  evidenceType: 'file' | 'screenshot' | 'clip';
  verifications: IEvidenceVerification[];
  lastVerifiedAt: Date | null;
  lastVerificationStatus: 'valid' | 'tampered' | 'missing' | null;
  createdAt: Date;
}

const verificationSchema = new Schema({
  verifiedAt: { type: Date, required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['valid', 'tampered', 'missing'], required: true },
  computedHash: { type: String, default: null },
}, { _id: false });

const evidenceRecordSchema = new Schema({
  nodeId: { type: Schema.Types.ObjectId, ref: 'DossierNode', required: true, index: true },
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true },
  capturedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  capturedAt: { type: Date, required: true, immutable: true },
  fileHash: { type: String, required: true, immutable: true },
  filePath: { type: String, required: true, immutable: true },
  fileSize: { type: Number, required: true },
  sourceUrl: { type: String, default: null },
  evidenceType: { type: String, enum: ['file', 'screenshot', 'clip'], required: true },
  verifications: [verificationSchema],
  lastVerifiedAt: { type: Date, default: null },
  lastVerificationStatus: { type: String, enum: ['valid', 'tampered', 'missing'], default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

evidenceRecordSchema.index({ dossierId: 1, capturedAt: -1 });

export default mongoose.model<IEvidenceRecord>('EvidenceRecord', evidenceRecordSchema);
