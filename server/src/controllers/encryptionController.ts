import { Response } from 'express';
import User from '../models/User';
import Dossier from '../models/Dossier';
import { AuthRequest } from '../middleware/auth';

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
    const { encryptedKeys, isEncrypted } = req.body;

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
    if (isEncrypted !== undefined) {
      dossier.isEncrypted = isEncrypted;
    }
    await dossier.save();

    // Re-fetch with populated fields
    const updated = await Dossier.findById(dossierId).populate('collaborators', 'firstName lastName email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

export async function getDossierKeys(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossierId } = req.params;
    const dossier = await Dossier.findById(dossierId).select('encryptionKeys isEncrypted owner');
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouve' });
      return;
    }
    res.json({
      encryptionKeys: dossier.encryptionKeys || [],
      isEncrypted: dossier.isEncrypted || false,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
