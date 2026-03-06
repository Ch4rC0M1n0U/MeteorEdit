import { Schema, model, Types } from 'mongoose';

export interface IComment {
  nodeId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>({
  nodeId: { type: Schema.Types.ObjectId, ref: 'DossierNode', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, { timestamps: true });

export default model<IComment>('Comment', commentSchema);
