import { Schema, model, Document, Types } from 'mongoose';

export interface IExtensionImport extends Document {
  userId: Types.ObjectId;
  dossierId: Types.ObjectId;
  tokenId: Types.ObjectId;
  platform: string;
  cookieCount: number;
  encryptedPayload: {
    version: number;
    algorithm: string;
    encryptedKey: string;
    iv: string;
    ciphertext: string;
  };
  createdAt: Date;
}

const extensionImportSchema = new Schema<IExtensionImport>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
  tokenId: { type: Schema.Types.ObjectId, ref: 'ApiToken', required: true },
  platform: { type: String, required: true, index: true },
  cookieCount: { type: Number, required: true, default: 0 },
  encryptedPayload: {
    version: { type: Number, required: true },
    algorithm: { type: String, required: true },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

extensionImportSchema.index({ dossierId: 1, createdAt: -1 });

export default model<IExtensionImport>('ExtensionImport', extensionImportSchema);
