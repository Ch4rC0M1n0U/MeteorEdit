import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

export async function storeKeys(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { publicKey, encryptedPrivateKey, salt } = req.body;
    if (!publicKey || !encryptedPrivateKey || !salt) {
      res.status(400).json({ message: 'publicKey, encryptedPrivateKey et salt sont requis' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouve' });
      return;
    }
    user.encryptionPublicKey = publicKey;
    user.encryptionPrivateKey = encryptedPrivateKey;
    user.encryptionSalt = salt;
    await user.save();
    res.json({ message: 'Cles enregistrees' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function getMyKeys(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select(
      'encryptionPublicKey encryptionPrivateKey encryptionSalt'
    );
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouve' });
      return;
    }
    res.json({
      publicKey: user.encryptionPublicKey || null,
      encryptedPrivateKey: user.encryptionPrivateKey || null,
      salt: user.encryptionSalt || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function getUserPublicKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.userId).select('encryptionPublicKey');
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouve' });
      return;
    }
    res.json({ publicKey: user.encryptionPublicKey || null });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function storeDossierKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId } = req.params;
    const { encryptedKeys } = req.body;

    const dossier = await Dossier.findById(dossierId);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouve' });
      return;
    }

    // Only owner can manage encryption
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Seul le proprietaire peut gerer le chiffrement' });
      return;
    }

    if (encryptedKeys !== undefined) {
      dossier.encryptionKeys = encryptedKeys;
    }
    await dossier.save();

    // Re-fetch with populated fields
    const updated = await Dossier.findById(dossierId).populate('collaborators', 'firstName lastName email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function removeDossierKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId, userId } = req.params;
    const dossier = await Dossier.findById(dossierId);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouve' });
      return;
    }
    if (dossier.owner.toString() !== req.user!.userId) {
      res.status(403).json({ message: 'Seul le proprietaire peut gerer les cles' });
      return;
    }
    dossier.encryptionKeys = dossier.encryptionKeys.filter(
      (k: any) => k.userId.toString() !== userId
    );
    await dossier.save();
    res.json({ message: 'Cle supprimee' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function getDossierKeys(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId } = req.params;
    const dossier = await Dossier.findById(dossierId).select('encryptionKeys owner');
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouve' });
      return;
    }
    res.json({
      encryptionKeys: dossier.encryptionKeys || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function scanEncryptionStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Count nodes with plaintext content (not starting with "ENC:")
    const unencryptedContentNodes = await DossierNode.countDocuments({
      content: { $ne: null, $exists: true },
      deletedAt: null,
    });

    // Count nodes with unencrypted files (fileUrl not ending in .enc)
    const unencryptedFileNodes = await DossierNode.countDocuments({
      fileUrl: { $ne: null, $not: /\.enc$/ },
      deletedAt: null,
    });

    // Count dossiers without encryption keys
    const unencryptedDossiers = await Dossier.countDocuments({
      $or: [
        { encryptionKeys: { $size: 0 } },
        { encryptionKeys: { $exists: false } },
      ],
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'encryption.scan', 'system', null, {
      unencryptedContentNodes,
      unencryptedFileNodes,
      unencryptedDossiers,
    }, ip, req.headers['user-agent'] || '');

    res.json({
      unencryptedContentNodes,
      unencryptedFileNodes,
      unencryptedDossiers,
      totalNodes: await DossierNode.countDocuments({ deletedAt: null }),
      totalDossiers: await Dossier.countDocuments({}),
    });
  } catch (error) {
    console.error('Scan encryption status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function listUnencryptedFiles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const nodes = await DossierNode.find({
      fileUrl: { $ne: null, $not: /\.enc$/ },
      deletedAt: null,
    }).select('_id dossierId title fileUrl fileName fileSize type').lean();

    res.json({ files: nodes });
  } catch (error) {
    console.error('List unencrypted files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function listUnencryptedContent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const nodes = await DossierNode.find({
      content: { $ne: null, $exists: true, $not: /^"ENC:/ },
      deletedAt: null,
    }).select('_id dossierId title type').lean();

    const excalidrawNodes = await DossierNode.find({
      excalidrawData: { $ne: null, $exists: true },
      deletedAt: null,
    }).select('_id dossierId title type').lean();

    const mapNodes = await DossierNode.find({
      mapData: { $ne: null, $exists: true },
      deletedAt: null,
    }).select('_id dossierId title type').lean();

    res.json({
      contentNodes: nodes,
      excalidrawNodes,
      mapNodes,
    });
  } catch (error) {
    console.error('List unencrypted content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function replaceWithEncrypted(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const node = await DossierNode.findById(nodeId);
    if (!node || !node.fileUrl) {
      res.status(404).json({ message: 'Node or file not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }

    // Delete old file
    const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
    const oldFilePath = path.resolve(UPLOAD_DIR, '..', node.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Update node with new encrypted file path
    const newFileUrl = `/uploads/${req.file.filename}`;
    node.fileUrl = newFileUrl;
    node.originalContentType = req.body.originalContentType || null;
    node.originalFileSize = req.body.originalFileSize ? parseInt(req.body.originalFileSize) : null;
    await node.save();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'encryption.migrate_file', 'node', nodeId as string, {
      newFileUrl,
    }, ip, req.headers['user-agent']?.toString() || '');

    res.json({ message: 'File replaced', fileUrl: newFileUrl });
  } catch (error) {
    console.error('Replace with encrypted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function listUnencryptedDossierFiles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossiers = await Dossier.find({}).select('_id title logoPath linkedDocuments entities').lean();
    const items: Array<{
      dossierId: string;
      dossierTitle: string;
      type: 'logo' | 'document' | 'entityPhoto';
      filePath: string;
      entityIndex?: number;
      photoIndex?: number;
      docId?: string;
    }> = [];

    for (const d of dossiers) {
      // Logo
      if (d.logoPath && !d.logoPath.endsWith('.enc')) {
        items.push({ dossierId: d._id.toString(), dossierTitle: d.title, type: 'logo', filePath: d.logoPath });
      }
      // Linked documents
      if (d.linkedDocuments) {
        for (const doc of d.linkedDocuments) {
          if (doc.filePath && !doc.filePath.endsWith('.enc')) {
            items.push({ dossierId: d._id.toString(), dossierTitle: d.title, type: 'document', filePath: doc.filePath, docId: (doc as any)._id?.toString() });
          }
        }
      }
      // Entity photos
      if (d.entities) {
        d.entities.forEach((entity: any, ei: number) => {
          if (entity.photos) {
            entity.photos.forEach((photo: string, pi: number) => {
              if (photo && !photo.endsWith('.enc')) {
                items.push({ dossierId: d._id.toString(), dossierTitle: d.title, type: 'entityPhoto', filePath: photo, entityIndex: ei, photoIndex: pi });
              }
            });
          }
        });
      }
    }

    res.json({ items });
  } catch (error) {
    console.error('List unencrypted dossier files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function replaceDossierFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId } = req.params;
    const { type, entityIndex, photoIndex, docId } = req.body;

    if (!req.file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }

    const dossier = await Dossier.findById(dossierId);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }

    const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
    const newFileUrl = `/uploads/${req.file.filename}`;

    if (type === 'logo') {
      // Delete old file
      if (dossier.logoPath) {
        const oldPath = path.resolve(UPLOAD_DIR, '..', dossier.logoPath.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      dossier.logoPath = newFileUrl;
    } else if (type === 'document' && docId) {
      const doc = (dossier.linkedDocuments as any[]).find((d: any) => d._id?.toString() === docId);
      if (doc) {
        const oldPath = path.resolve(UPLOAD_DIR, '..', doc.filePath.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        doc.filePath = newFileUrl;
      }
    } else if (type === 'entityPhoto' && entityIndex != null && photoIndex != null) {
      const entity = (dossier.entities as any[])?.[entityIndex];
      if (entity?.photos?.[photoIndex]) {
        const oldPath = path.resolve(UPLOAD_DIR, '..', entity.photos[photoIndex].replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        entity.photos[photoIndex] = newFileUrl;
      }
    } else {
      res.status(400).json({ message: 'Invalid type' });
      return;
    }

    await dossier.save();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'encryption.migrate_dossier_file', 'dossier', dossierId as string, { type, newFileUrl }, ip, req.headers['user-agent']?.toString() || '');

    res.json({ message: 'File replaced', fileUrl: newFileUrl });
  } catch (error) {
    console.error('Replace dossier file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function migrateBranding(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    if (!settings) {
      res.json({ migrated: 0 });
      return;
    }

    const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
    const brandingDir = path.join(UPLOAD_DIR, 'branding');
    if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

    let migrated = 0;
    const fields = ['logoPath', 'faviconPath', 'loginBackgroundPath'] as const;

    for (const field of fields) {
      const currentPath = settings[field];
      if (!currentPath || currentPath.includes('branding/')) continue;

      // Extract filename
      const filename = currentPath.split('/').pop();
      if (!filename) continue;

      const oldPath = path.join(UPLOAD_DIR, filename);
      const newPath = path.join(brandingDir, filename);

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        (settings as any)[field] = `uploads/branding/${filename}`;
        migrated++;
      }
    }

    await settings.save();

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'encryption.migrate_branding', 'system', null, { migrated }, ip, req.headers['user-agent'] || '');

    res.json({ migrated });
  } catch (error) {
    console.error('Migrate branding error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
