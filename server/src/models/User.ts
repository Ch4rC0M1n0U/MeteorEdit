import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive: { type: Boolean, default: false },
    preferences: { type: Schema.Types.Mixed, default: {} },
    notificationPreferences: {
      type: Schema.Types.Mixed,
      default: {
        inApp: {
          'collaborator.added': true, 'collaborator.removed': true,
          'dossier.updated': true, 'node.updated': true,
          'mention': true, 'task.assigned': true,
          'task.deadline': true, 'task.completed': true,
          'dossier.shared': true, 'comment.reply': true,
          'system.announcement': true,
        },
        email: {
          'collaborator.added': false, 'collaborator.removed': false,
          'dossier.updated': false, 'node.updated': false,
          'mention': true, 'task.assigned': true,
          'task.deadline': true, 'task.completed': false,
          'dossier.shared': true, 'comment.reply': true,
          'system.announcement': false,
        },
        doNotDisturb: false,
        soundEnabled: true,
      },
    },
    avatarPath: { type: String, default: null },
    signature: {
      title: { type: String, default: '' },
      name: { type: String, default: '' },
      service: { type: String, default: '' },
      unit: { type: String, default: '' },
      email: { type: String, default: '' },
      city: { type: String, default: 'Bruxelles' },
    },
    signatureImagePath: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    twoFactorBackupCodes: [{ type: String }],
    encryptionPublicKey: { type: String, default: null },
    encryptionPrivateKey: { type: String, default: null },
    encryptionSalt: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
