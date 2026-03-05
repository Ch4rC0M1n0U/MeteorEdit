import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  preferences: Record<string, any>;
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
  objectives: string;
  entities: IEntity[];
  judicialFacts: string;
  investigator: IInvestigator;
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IDossierNode extends Document {
  dossierId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  type: 'folder' | 'note' | 'mindmap' | 'document';
  title: string;
  order: number;
  content: any | null;
  excalidrawData: any | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISiteSettings extends Document {
  appName: string;
  logoPath: string | null;
  accentColor: string;
  faviconPath: string | null;
  loginMessage: string;
}
