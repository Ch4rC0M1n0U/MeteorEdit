import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  preferences: Record<string, any>;
  avatarPath: string | null;
  signature: {
    title: string;
    name: string;
    service: string;
    unit: string;
    email: string;
  };
  signatureImagePath: string | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string[];
  encryptionPublicKey: string | null;
  encryptionPrivateKey: string | null;
  encryptionSalt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  role: string;
}

export interface IEntity {
  name: string;
  type: string;
  description: string;
}

export interface IInvestigator {
  name: string;
  service: string;
  unit: string;
  phone: string;
  email: string;
}

export interface IDossier extends Document {
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  icon: string | null;
  logoPath: string | null;
  objectives: string;
  entities: IEntity[];
  judicialFacts: string;
  tags: string[];
  investigator: IInvestigator;
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[];
  encryptionKeys: { userId: Types.ObjectId; encryptedKey: string }[];
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDossierNode extends Document {
  dossierId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  type: 'folder' | 'note' | 'mindmap' | 'document' | 'map' | 'dataset';
  title: string;
  order: number;
  content: any | null;
  contentText: string | null;
  excalidrawData: any | null;
  mapData: any | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoginLog extends Document {
  userId: Types.ObjectId;
  timestamp: Date;
  ip: string;
}

export interface ISiteSettings extends Document {
  appName: string;
  logoPath: string | null;
  accentColor: string;
  faviconPath: string | null;
  loginMessage: string;
  loginBackgroundPath: string | null;
  require2FA: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  action: string;
  targetType: 'dossier' | 'user' | 'system' | 'node';
  targetId: Types.ObjectId | null;
  metadata: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

export interface IPluginSettings extends Document {
  mapbox: {
    apiKey: string;
    defaultStyle: string;
    defaultCenter: [number, number];
    defaultZoom: number;
  };
  ollama: {
    baseUrl: string;
    selectedModel: string;
    enabled: boolean;
    reportPrompt: string;
  };
}

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'collaborator.added' | 'collaborator.removed' | 'dossier.updated' | 'node.updated' | 'mention' | 'task.assigned';
  message: string;
  dossierId: Types.ObjectId | null;
  fromUserId: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}
