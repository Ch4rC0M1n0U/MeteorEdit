export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  grade: string;
  matricule: string;
  service: string;
  unit: string;
  role: 'admin' | 'user';
  isActive: boolean;
  avatarPath: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LinkedDocument {
  _id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: string;
}

export interface Dossier {
  _id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  icon: string | null;
  logoPath: string | null;
  objectives: string;
  entities: Entity[];
  judicialFacts: string;
  tags: string[];
  investigator: Investigator;
  classification: 'priority' | 'routine';
  isUrgent: boolean;
  isEmbargo: boolean;
  isContinuous: boolean;
  magistrate: string;
  isFirstRequest: boolean;
  dossierLanguage: 'fr' | 'nl';
  referenceNumber: string;
  arrivalDate: string | null;
  attributionDate: string | null;
  closureDate: string | null;
  linkedDocuments: LinkedDocument[];
  owner: string;
  collaborators: (string | CollaboratorUser)[];
  encryptionKeys: { userId: string; encryptedKey: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Entity {
  name: string;
  type: string;
  description: string;
}

export interface Investigator {
  name: string;
  service: string;
  unit: string;
  phone: string;
  email: string;
}

export interface TemplateQuestion {
  id: string;
  parentId: string | null;
  parentAnswerValue: string | null;
  order: number;
  type: 'boolean' | 'radio' | 'checkbox' | 'text';
  label: string;
  options?: string[];
  contentBlocks: Record<string, any>;
}

export interface NoteTemplate {
  _id: string;
  title: string;
  description: string;
  content: any;
  interactiveQuestions?: TemplateQuestion[];
  owner: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSource {
  type: 'url' | 'upload';
  url?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType: string;
  mediaType: 'video' | 'audio';
}

export interface MediaMetadata {
  title: string;
  platform?: string;
  channelName?: string;
  channelUrl?: string;
  sourceUrl?: string;
  publishedAt?: string;
  duration?: number;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface MediaAnnotation {
  id: string;
  timestamp: number;
  type: 'capture' | 'note';
  comment: string;
  screenshotUrl?: string;
  createdAt: string;
  modifiedAt?: string;
}

export interface MediaData {
  source: MediaSource;
  metadata: MediaMetadata;
  annotations: MediaAnnotation[];
}

export interface DossierNode {
  _id: string;
  dossierId: string;
  parentId: string | null;
  type: 'folder' | 'note' | 'mindmap' | 'document' | 'map' | 'dataset' | 'media';
  title: string;
  order: number;
  content: any | null;
  contentText: string | null;
  excalidrawData: any | null;
  mapData: any | null;
  mediaData: MediaData | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  children?: DossierNode[];
}

export interface TaskAssignee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
}

export interface TaskCreator {
  _id: string;
  firstName: string;
  lastName: string;
}

export interface Task {
  _id: string;
  dossierId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId: TaskAssignee | null;
  createdBy: TaskCreator;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}


