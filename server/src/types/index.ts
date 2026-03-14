import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  preferences: Record<string, any>;
  notificationPreferences: {
    inApp: Record<string, boolean>;
    email: Record<string, boolean>;
    doNotDisturb: boolean;
    soundEnabled: boolean;
  };
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
  photos: string[];
}

export interface IInvestigator {
  name: string;
  service: string;
  unit: string;
  phone: string;
  email: string;
}

export interface ILinkedDocument {
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: Date;
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
  classification: 'priority' | 'routine';
  isUrgent: boolean;
  isEmbargo: boolean;
  magistrate: string;
  isFirstRequest: boolean;
  dossierLanguage: 'fr' | 'nl';
  linkedDocuments: ILinkedDocument[];
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[];
  encryptionKeys: { userId: Types.ObjectId; encryptedKey: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IDossierNode extends Document {
  dossierId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  type: 'folder' | 'note' | 'mindmap' | 'document' | 'map' | 'dataset' | 'media';
  title: string;
  order: number;
  content: any | null;
  contentText: string | null;
  excalidrawData: any | null;
  mapData: any | null;
  mediaData: any | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileHash: string | null;
  originalContentType: string | null;
  originalFileSize: number | null;
  hashVerifiedAt: Date | null;
  lastVerificationStatus: 'valid' | 'tampered' | 'missing' | null;
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
  trashAutoDeleteDays: number;
  // Storage
  maxFileSizeMB: number;
  allowedFileTypes: string;
  // SMTP
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpSecure: boolean;
  // Web Clipper
  clipperTimeoutMs: number;
  clipperQuality: number;
  clipperUserAgent: string;
  clipperProxy: string;
  // Network
  allowedOrigins: string;
  announcementEnabled: boolean;
  announcementMessage: string;
  announcementVariant: 'info' | 'warning' | 'error';
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
  type: 'collaborator.added' | 'collaborator.removed' | 'dossier.updated' | 'node.updated' | 'mention' | 'task.assigned' | 'task.deadline' | 'task.completed' | 'dossier.shared' | 'comment.reply' | 'system.announcement';
  message: string;
  dossierId: Types.ObjectId | null;
  fromUserId: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}
