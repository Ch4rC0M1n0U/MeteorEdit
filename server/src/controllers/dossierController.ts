import { Response } from 'express';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import { createNotification } from '../utils/notifier';
import User from '../models/User';

export async function listDossiers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).sort({ updatedAt: -1 });
    res.json(dossiers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function createDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.create({
      ...req.body,
      owner: req.user!.userId,
    });
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'dossier.create', 'dossier', dossier._id.toString(), { title: dossier.title }, ip);
    res.status(201).json(dossier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getDossier(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.map(c => c.toString()).includes(userId)) {
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
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title }, ip);
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
    await DossierNode.deleteMany({ dossierId: dossier._id });
    await dossier.deleteOne();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'dossier.delete', 'dossier', req.params.id, { title: dossier.title }, ip);
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
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const added = currentCollabs.filter(c => !previousCollabs.includes(c));
    const removed = previousCollabs.filter(c => !currentCollabs.includes(c));
    for (const uid of added) await logActivity(req.user!.userId, 'collaborator.add', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip);
    for (const uid of removed) await logActivity(req.user!.userId, 'collaborator.remove', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip);
    const actor = await User.findById(req.user!.userId).select('firstName lastName');
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';
    for (const uid of added) {
      await createNotification(uid, 'collaborator.added', `${actorName} vous a ajoute au dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
    }
    for (const uid of removed) {
      await createNotification(uid, 'collaborator.removed', `${actorName} vous a retire du dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
    }
    res.json(dossier);
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
