import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { createNotification } from '../utils/notifier';
import { toAbsoluteUrl } from '../utils/imageUrl';
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

    // Enrichissement v3.28 : ajouter entityCount + noteCount pour les meta-stats
    // affichées sur les DossierCard. Pour entityCount : si entities est array
    // (dossier en clair), on prend sa longueur ; sinon null (E2E chiffré).
    // Pour noteCount : 1 seul aggregation pipeline batched sur tous les dossiers
    // de la page (pas de N+1).
    const dossierIds = dossiers.map((d) => d._id);
    const noteCounts = dossierIds.length > 0
      ? await DossierNode.aggregate([
          // `deletedAt: { $in: [null] }` matches both explicit nulls AND
          // documents where the field is absent (legacy data pre-soft-delete).
          // The strict `deletedAt: null` form would silently exclude those.
          { $match: { dossierId: { $in: dossierIds }, type: 'note', deletedAt: { $in: [null] } } },
          { $group: { _id: '$dossierId', count: { $sum: 1 } } },
        ])
      : [];
    const noteCountMap = new Map<string, number>(
      noteCounts.map((n: { _id: { toString(): string }; count: number }) => [String(n._id), n.count])
    );

    const enriched = dossiers.map((d) => ({
      ...d,
      entityCount: Array.isArray((d as { entities?: unknown }).entities)
        ? ((d as { entities: unknown[] }).entities).length
        : null,
      noteCount: noteCountMap.get(String(d._id)) ?? null,
    }));

    res.json({
      dossiers: enriched,
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
    const { collaborators, owner, _id, relatedDossiers, ...updateData } = req.body;
    // Filter out undefined values. Do NOT drop "ENC:..." strings — they are
    // legitimate end-to-end-encrypted payloads that the client expects the
    // server to round-trip verbatim. The Dossier schema declares the matching
    // fields (objectives, judicialFacts, description, entities) as String or
    // Mixed so they accept the ciphertext.
    for (const key of Object.keys(updateData)) {
      if (updateData[key] === undefined) delete updateData[key];
    }
    Object.assign(dossier, updateData);
    // Handle relatedDossiers separately (array of ObjectIds, filter invalid)
    if (Array.isArray(relatedDossiers)) {
      dossier.relatedDossiers = relatedDossiers.filter((id: any) => id && typeof id === 'string' && id.length === 24);
    }
    // Auto-set closureDate when status changes to closed
    if (req.body.status === 'closed' && !dossier.closureDate) {
      dossier.closureDate = new Date();
    } else if (req.body.status && req.body.status !== 'closed') {
      dossier.closureDate = null;
    }
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
  } catch (error: any) {
    console.error('[Dossier] Update failed:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Server error' });
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

/**
 * Stateless entity photo upload — accepts a file (already encrypted client-side
 * if the dossier is E2E), stores it under uploads/, returns the path. Does NOT
 * touch dossier.entities, so it works whether `entities` is an array (plaintext)
 * or a ciphertext string ("ENC:..."). The client is responsible for adding the
 * returned path to entity.photos and saving the dossier afterwards.
 */
export async function uploadEntityPhotoFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id).select('_id owner collaborators');
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (!isOwnerOrCollaborator(dossier as any, userId)) { res.status(403).json({ message: 'Access denied' }); return; }
    if (!req.file) { res.status(400).json({ message: 'No file provided' }); return; }

    const photoPath = `uploads/${req.file.filename}`;
    const meta = req.body?.originalContentType
      ? { path: photoPath, originalContentType: String(req.body.originalContentType) }
      : null;

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'entity.photo_upload', 'dossier', dossier._id.toString(), {
      photoPath,
    }, ip, req.headers['user-agent'] || '');

    res.status(201).json({ path: photoPath, metadata: meta });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

/**
 * Stateless entity photo deletion — removes a file from uploads/. Does NOT
 * touch dossier.entities. The client is responsible for removing the path
 * from entity.photos and saving the dossier afterwards.
 */
export async function deleteEntityPhotoFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id).select('_id owner collaborators');
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (!isOwnerOrCollaborator(dossier as any, userId)) { res.status(403).json({ message: 'Access denied' }); return; }

    const { photoPath } = req.body ?? {};
    if (typeof photoPath !== 'string' || !photoPath.startsWith('uploads/')) {
      res.status(400).json({ message: 'Invalid photoPath' });
      return;
    }

    // Defensive: keep the deletion confined to the uploads dir
    const uploadsRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const relative = photoPath.replace(/^uploads\//, '');
    const absPath = path.resolve(uploadsRoot, relative);
    if (!absPath.startsWith(uploadsRoot)) {
      res.status(400).json({ message: 'Path traversal blocked' });
      return;
    }
    if (fs.existsSync(absPath)) {
      try { fs.unlinkSync(absPath); } catch { /* file may be locked, ignore */ }
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'entity.photo_delete', 'dossier', dossier._id.toString(), {
      photoPath,
    }, ip, req.headers['user-agent'] || '');

    res.json({ deleted: true, path: photoPath });
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

    // Legacy endpoint — only works for plaintext dossiers (entities is an array).
    // For E2E-encrypted dossiers, clients must use the stateless endpoints
    // (uploadEntityPhotoFile / deleteEntityPhotoFile) and patch entity.photos
    // themselves before calling updateDossier.
    if (!Array.isArray(dossier.entities)) {
      res.status(409).json({
        message: 'Use stateless endpoint /entity-photo-file for encrypted dossiers',
      });
      return;
    }

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

    if (!Array.isArray(dossier.entities)) {
      res.status(409).json({ message: 'Dossier chiffré E2E : suppression de photo non disponible côté serveur.' });
      return;
    }

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

export async function transferDocumentToNode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) { res.status(404).json({ message: 'Dossier not found' }); return; }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.some(c => c.toString() === userId)) {
      res.status(403).json({ message: 'Access denied' }); return;
    }

    const docId = req.params.docId;
    const doc: any = dossier.linkedDocuments.find((d: any) => d._id.toString() === docId);
    if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }

    // Determine file extension and MIME type
    const fileName = doc.fileName;
    const displayTitle = fileName.replace(/\.enc$/, '');
    const ext = displayTitle.split('.').pop()?.toLowerCase() || '';
    const filePath = doc.filePath;

    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'opus'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

    // Prepare node data — returned to frontend for creation via store (handles encryption)
    let nodeData: any = {
      title: displayTitle,
      parentId: req.body?.parentId || null,
    };

    if (imageExts.includes(ext)) {
      const imageUrl = toAbsoluteUrl(filePath, req);
      nodeData.type = 'note';
      nodeData.content = {
        type: 'doc',
        content: [{
          type: 'image',
          attrs: { src: imageUrl, alt: displayTitle, title: displayTitle },
        }],
      };
    } else if (audioExts.includes(ext)) {
      nodeData.type = 'media';
      nodeData.mediaData = {
        source: {
          type: 'upload',
          fileUrl: filePath,
          fileName: displayTitle,
          mimeType: doc.originalContentType || (ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`),
          mediaType: 'audio',
        },
        metadata: { title: displayTitle },
        annotations: [],
      };
    } else if (videoExts.includes(ext)) {
      nodeData.type = 'media';
      nodeData.mediaData = {
        source: {
          type: 'upload',
          fileUrl: filePath,
          fileName: displayTitle,
          mimeType: doc.originalContentType || `video/${ext}`,
          mediaType: 'video',
        },
        metadata: { title: displayTitle },
        annotations: [],
      };
    } else {
      nodeData.type = 'document';
      nodeData.fileUrl = filePath;
      nodeData.fileName = displayTitle;
      nodeData.fileSize = doc.fileSize;
      nodeData.originalContentType = doc.originalContentType || undefined;
    }

    // Log the transfer activity
    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(userId, 'document.transfer', 'dossier', dossier._id.toString(), {
        title: dossier.title,
        fileName: displayTitle,
        targetNodeType: nodeData.type,
      }, ip, req.headers['user-agent'] || '');
    }

    // Return prepared node data — frontend creates the node via dossierStore.createNode() (handles encryption)
    res.json({ nodeData });
  } catch (error) {
    console.error('Transfer document to node error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

const ALLOWED_REPORT_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function closeDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Only owner can close dossier' });
      return;
    }
    // Final report file is OPTIONAL: a dossier can be closed without one.
    // If a file is provided, validate its mime type; otherwise just flip the
    // status to 'closed' and stamp the closure date.
    if (req.file && !ALLOWED_REPORT_MIMETYPES.includes(req.file.mimetype)) {
      const tmpPath = path.resolve(UPLOAD_DIR, req.file.filename);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      res.status(400).json({ message: 'Only PDF or DOCX files are allowed' });
      return;
    }

    if (req.file) {
      // Remove old report file if exists (replacing with the new one)
      if (dossier.finalReport?.filePath) {
        const oldPath = path.resolve(UPLOAD_DIR, dossier.finalReport.filePath.replace(/^uploads\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      dossier.finalReport = {
        fileName: req.file.originalname,
        filePath: `uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date(),
      };
    }

    dossier.status = 'closed';
    dossier.closureDate = new Date();
    await dossier.save();

    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.close', 'dossier', dossier._id.toString(), {
        title: dossier.title,
        reportFileName: req.file?.originalname ?? null,
      }, ip, req.headers['user-agent'] || '');
    }

    res.json(dossier);
  } catch (error) {
    console.error('Close dossier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getFinalReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    const userId = req.user!.userId;
    if (!isOwnerOrCollaborator(dossier, userId)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    if (!dossier.finalReport?.filePath) {
      res.status(404).json({ message: 'No final report found' });
      return;
    }

    const relativePath = dossier.finalReport.filePath.replace(/^uploads\//, '');
    let filePath = path.resolve(UPLOAD_DIR, relativePath);

    // Try .enc variants if file not found (encrypted files)
    if (!fs.existsSync(filePath)) {
      const appendedEnc = filePath + '.enc';
      const replacedEnc = filePath.replace(/\.[^.]+$/, '.enc');
      if (fs.existsSync(appendedEnc)) {
        filePath = appendedEnc;
      } else if (replacedEnc !== filePath && fs.existsSync(replacedEnc)) {
        filePath = replacedEnc;
      } else {
        res.status(404).json({ message: 'Report file not found on disk' });
        return;
      }
    }

    const isEncrypted = filePath.endsWith('.enc');
    const contentType = isEncrypted ? 'application/octet-stream' : (dossier.finalReport.mimeType || 'application/octet-stream');
    const displayName = dossier.finalReport.fileName || 'final-report';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(displayName)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Get final report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteFinalReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Only owner can delete final report' });
      return;
    }
    if (!dossier.finalReport?.filePath) {
      res.status(404).json({ message: 'No final report found' });
      return;
    }

    // Delete file from disk (try plain and .enc variants)
    const relativePath = dossier.finalReport.filePath.replace(/^uploads\//, '');
    const filePath = path.resolve(UPLOAD_DIR, relativePath);
    for (const candidate of [filePath, filePath + '.enc', filePath.replace(/\.[^.]+$/, '.enc')]) {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    }

    const oldFileName = dossier.finalReport.fileName;
    dossier.finalReport = {
      fileName: null,
      filePath: null,
      fileSize: null,
      mimeType: null,
      uploadedAt: null,
    } as any;
    await dossier.save();

    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), {
        title: dossier.title,
        change: 'final_report_delete',
        fileName: oldFileName,
      }, ip, req.headers['user-agent'] || '');
    }

    res.json(dossier);
  } catch (error) {
    console.error('Delete final report error:', error);
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
