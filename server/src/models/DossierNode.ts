import mongoose, { Schema } from 'mongoose';
import { IDossierNode } from '../types';
import { sanitizeTipTapImageUrls } from '../utils/imageUrl';

const dossierNodeSchema = new Schema<IDossierNode>(
  {
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'DossierNode', default: null },
    type: { type: String, enum: ['folder', 'note', 'mindmap', 'document', 'map', 'dataset', 'media', 'timeline'], required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    content: { type: Schema.Types.Mixed, default: null },
    contentText: { type: String, default: null },
    excalidrawData: { type: Schema.Types.Mixed, default: null },
    mapData: { type: Schema.Types.Mixed, default: null },
    mediaData: { type: Schema.Types.Mixed, default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    originalContentType: { type: String, default: null },
    originalFileSize: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ─── IMAGE URL GUARD (pre-save) ───────────────────────────────────
// Last line of defense: sanitize all image URLs in TipTap content
// before ANY write to the database. Catches absolute URLs, blob:,
// and data: URIs that should never be persisted.
// ───────────────────────────────────────────────────────────────────
dossierNodeSchema.pre('save', function () {
  if (this.type === 'note' && this.content && typeof this.content === 'object') {
    sanitizeTipTapImageUrls(this.content);
  }
});

dossierNodeSchema.index({ dossierId: 1, parentId: 1 });
dossierNodeSchema.index({ contentText: 'text', title: 'text' });
dossierNodeSchema.index({ parentId: 1 });
dossierNodeSchema.index({ dossierId: 1, deletedAt: 1, order: 1 });

export default mongoose.model<IDossierNode>('DossierNode', dossierNodeSchema);
