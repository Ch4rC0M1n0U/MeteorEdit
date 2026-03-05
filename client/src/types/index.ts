export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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

export interface Dossier {
  _id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  objectives: string;
  entities: Entity[];
  judicialFacts: string;
  tags: string[];
  investigator: Investigator;
  owner: string;
  collaborators: (string | CollaboratorUser)[];
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

export interface DossierNode {
  _id: string;
  dossierId: string;
  parentId: string | null;
  type: 'folder' | 'note' | 'mindmap' | 'document';
  title: string;
  order: number;
  content: any | null;
  excalidrawData: any | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  children?: DossierNode[];
}
