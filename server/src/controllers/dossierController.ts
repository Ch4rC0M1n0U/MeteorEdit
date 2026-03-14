import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { createNotification } from '../utils/notifier';
import User from '../models/User';

/** Check if user is owner or collaborator of a dossier */
function isOwnerOrCollaborator(dossier: any, userId: string): boolean {
  return dossier.owner.toString() === userId || dossier.collaborators.some((c: any) => (c._id || c).toString() === userId);
}

export async function listDossiers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter = { $or: [{ owner: userId }, { collaborators: userId }] };
    const [dossiers, total] = await Promise.all([
      Dossier.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dossier.countDocuments(filter),
    ]);

    res.json({
      dossiers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List dossiers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function createDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.create({
      ...req.body,
      owner: req.user!.userId,
    });
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.create', 'dossier', dossier._id.toString(), { title: dossier.title }, ip, req.headers['user-agent'] || '');
    }
    res.status(201).json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id).populate('collaborators', 'firstName lastName email');
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    const userId = req.user!.userId;
    // Embargo: only owner/collaborators can access, even admin is blocked
    if (!isOwnerOrCollaborator(dossier, userId)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Only owner can update dossier' });
      return;
    }
    Object.assign(dossier, req.body);
    await dossier.save();
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title }, ip, req.headers['user-agent'] || '');
    }
    if (dossier.collaborators.length > 0) {
      const actor = await User.findById(req.user!.userId).select('firstName lastName');
      const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';
      for (const collab of dossier.collaborators) {
        const collabId = collab.toString();
        if (collabId !== req.user!.userId) {
          await createNotification(collabId, 'dossier.updated', `${actorName} a modifie le dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
        }
      }
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Only owner can delete dossier' });
      return;
    }
    const wasEmbargo = dossier.isEmbargo;
    await DossierNode.deleteMany({ dossierId: dossier._id });
    await dossier.deleteOne();
    if (!wasEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.delete', 'dossier', req.params.id as string, { title: dossier.title }, ip, req.headers['user-agent'] || '');
    }
    res.json({ message: 'Dossier deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateCollaborators(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Only owner can manage collaborators' });
      return;
    }
    const previousCollabs = dossier.collaborators.map(c => c.toString());
    dossier.collaborators = req.body.collaborators || [];
    await dossier.save();
    const currentCollabs = dossier.collaborators.map(c => c.toString());
    const added = currentCollabs.filter(c => !previousCollabs.includes(c));
    const removed = previousCollabs.filter(c => !currentCollabs.includes(c));
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      for (const uid of added) await logActivity(req.user!.userId, 'collaborator.add', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip, ua);
      for (const uid of removed) await logActivity(req.user!.userId, 'collaborator.remove', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip, ua);
    }
    const actor = await User.findById(req.user!.userId).select('firstName lastName');
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';
    for (const uid of added) {
      await createNotification(uid, 'collaborator.added', `${actorName} vous a ajoute au dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
    }
    for (const uid of removed) {
      await createNotification(uid, 'collaborator.removed', `${actorName} vous a retire du dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
    }
    const updated = await Dossier.findById(req.params.id).populate('collaborators', 'firstName lastName email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getTags(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const tags = await Dossier.distinct('tags', {
      $or: [{ owner: userId }, { collaborators: userId }],
    });
    res.json(tags.filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadDossierLogo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    if (dossier.owner.toString() !== req.user!.userId) { res.status(403).json({ message: 'Only owner can update dossier' }); return; }
    if (!req.file) { res.status(400).json({ message: 'No file provided' }); return; }
    if (dossier.logoPath) {
      const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', dossier.logoPath.replace(/^uploads\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    dossier.logoPath = `uploads/${req.file.filename}`;
    if (req.body.originalContentType) {
      (dossier as any).logoOriginalContentType = req.body.originalContentType;
    }
    dossier.icon = null;
    await dossier.save();
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title, change: 'logo_upload' }, ip, req.headers['user-agent'] || '');
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteDossierLogo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    if (dossier.owner.toString() !== req.user!.userId) { res.status(403).json({ message: 'Only owner can update dossier' }); return; }
    if (dossier.logoPath) {
      const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', dossier.logoPath.replace(/^uploads\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      dossier.logoPath = null;
      await dossier.save();
    }
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title, change: 'logo_delete' }, ip, req.headers['user-agent'] || '');
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadLinkedDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.some(c => c.toString() === userId)) {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    if (!req.file) { res.status(400).json({ message: 'No file provided' }); return; }
    const originalFileSize = req.body.originalFileSize ? parseInt(req.body.originalFileSize, 10) : undefined;
    dossier.linkedDocuments.push({
      fileName: req.file.originalname,
      filePath: `uploads/${req.file.filename}`,
      fileSize: originalFileSize || req.file.size,
      originalContentType: req.body.originalContentType || undefined,
      uploadedAt: new Date(),
    } as any);
    await dossier.save();
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title, change: 'linked_document_upload', fileName: req.file.originalname }, ip, req.headers['user-agent'] || '');
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function uploadEntityPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (!isOwnerOrCollaborator(dossier, userId)) { res.status(403).json({ message: 'Access denied' }); return; }
    if (!req.file) { res.status(400).json({ message: 'No file provided' }); return; }

    const entityIndex = parseInt(req.params.entityIndex as string, 10);
    if (isNaN(entityIndex) || entityIndex < 0 || entityIndex >= dossier.entities.length) {
      res.status(404).json({ message: 'Entity not found' }); return;
    }

    const entity = dossier.entities[entityIndex];
    if (!entity.photos) entity.photos = [];
    const photoPath = `uploads/${req.file.filename}`;
    entity.photos.push(photoPath);
    // Store original content type metadata if provided (encrypted upload)
    if (req.body.originalContentType) {
      const entityAny = entity as any;
      if (!entityAny.photoMetadata) entityAny.photoMetadata = [];
      entityAny.photoMetadata.push({ path: photoPath, originalContentType: req.body.originalContentType });
    }
    await dossier.save();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'entity.photo_upload', 'dossier', dossier._id.toString(), {
      entityName: entity.name, entityType: entity.type,
    }, ip, req.headers['user-agent'] || '');

    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteEntityPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (!isOwnerOrCollaborator(dossier, userId)) { res.status(403).json({ message: 'Access denied' }); return; }

    const entityIndex = parseInt(req.params.entityIndex as string, 10);
    if (isNaN(entityIndex) || entityIndex < 0 || entityIndex >= dossier.entities.length) {
      res.status(404).json({ message: 'Entity not found' }); return;
    }

    const { photoPath } = req.body;
    if (!photoPath) { res.status(400).json({ message: 'photoPath required' }); return; }

    const entity = dossier.entities[entityIndex];
    const photoIndex = (entity.photos || []).indexOf(photoPath);
    if (photoIndex === -1) { res.status(404).json({ message: 'Photo not found' }); return; }

    // Delete file from disk
    const absPath = path.resolve(process.env.UPLOAD_DIR || './uploads', photoPath.replace(/^uploads\//, ''));
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

    entity.photos.splice(photoIndex, 1);
    await dossier.save();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'entity.photo_delete', 'dossier', dossier._id.toString(), {
      entityName: entity.name, entityType: entity.type,
    }, ip, req.headers['user-agent'] || '');

    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteLinkedDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.some(c => c.toString() === userId)) {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    const docId = req.params.docId;
    const doc = dossier.linkedDocuments.find((d: any) => d._id.toString() === docId);
    if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }
    const filePath = path.resolve(process.env.UPLOAD_DIR || './uploads', doc.filePath.replace(/^uploads\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    dossier.linkedDocuments = dossier.linkedDocuments.filter((d: any) => d._id.toString() !== docId) as any;
    await dossier.save();
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title, change: 'linked_document_delete', fileName: doc.fileName }, ip, req.headers['user-agent'] || '');
    }
    res.json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
