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
