import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import NoteTemplate from '../models/NoteTemplate';
import Dossier from '../models/Dossier';
import User from '../models/User';
import { logActivity } from '../utils/activityLogger';

// Available placeholders and their resolution
const PLACEHOLDER_RESOLVERS: Record<string, (dossier: any, user: any) => string> = {
  '{{dossier.title}}': (d) => d.title || '',
  '{{dossier.description}}': (d) => d.description || '',
  '{{dossier.status}}': (d) => d.status || '',
  '{{dossier.investigator.name}}': (d) => d.investigator?.name || '',
  '{{dossier.investigator.service}}': (d) => d.investigator?.service || '',
  '{{dossier.investigator.unit}}': (d) => d.investigator?.unit || '',
  '{{dossier.investigator.phone}}': (d) => d.investigator?.phone || '',
  '{{dossier.investigator.email}}': (d) => d.investigator?.email || '',
  '{{date.now}}': () => new Date().toLocaleDateString('fr-FR'),
  '{{user.name}}': (_d, u) => u ? `${u.firstName} ${u.lastName}` : '',
};

function resolvePlaceholders(content: any, dossier: any, user: any): any {
  if (!content) return content;
  const json = JSON.stringify(content);
  let resolved = json;
  for (const [placeholder, resolver] of Object.entries(PLACEHOLDER_RESOLVERS)) {
    const value = resolver(dossier, user);
    resolved = resolved.split(placeholder).join(value);
  }
  return JSON.parse(resolved);
}

// GET /api/templates - List user's templates
export async function getTemplates(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const templates = await NoteTemplate.find({ owner: userId }).sort({ updatedAt: -1 });
  res.json(templates);
}

// GET /api/templates/available-placeholders
export async function getAvailablePlaceholders(_req: AuthRequest, res: Response) {
  const placeholders = Object.keys(PLACEHOLDER_RESOLVERS).map(key => ({
    key,
    label: key.replace(/\{\{|\}\}/g, ''),
  }));
  res.json(placeholders);
}

// GET /api/templates/:id
export async function getTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const template = await NoteTemplate.findOne({ _id: req.params.id, owner: userId });
  if (!template) return res.status(404).json({ message: 'Template non trouve' });
  res.json(template);
}

// POST /api/templates
export async function createTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { title, description, content } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'Titre requis' });

  const template = await NoteTemplate.create({
    title: title.trim(),
    description: description || '',
    content,
    owner: userId,
  });

  await logActivity(userId, 'template.create', 'system', template._id.toString(), { title: template.title }, req.ip || '');
  res.status(201).json(template);
}

// PUT /api/templates/:id
export async function updateTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { title, description, content } = req.body;

  const template = await NoteTemplate.findOneAndUpdate(
    { _id: req.params.id, owner: userId },
    { title, description, content },
    { returnDocument: 'after' }
  );
  if (!template) return res.status(404).json({ message: 'Template non trouve' });

  await logActivity(userId, 'template.update', 'system', template._id.toString(), { title: template.title }, req.ip || '');
  res.json(template);
}

// DELETE /api/templates/:id
export async function deleteTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const template = await NoteTemplate.findOneAndDelete({ _id: req.params.id, owner: userId });
  if (!template) return res.status(404).json({ message: 'Template non trouve' });

  await logActivity(userId, 'template.delete', 'system', null, { title: template.title }, req.ip || '');
  res.json({ message: 'Template supprime' });
}

// POST /api/templates/:id/resolve - Resolve placeholders with dossier data
export async function resolveTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId } = req.body;

  const template = await NoteTemplate.findOne({ _id: req.params.id, owner: userId });
  if (!template) return res.status(404).json({ message: 'Template non trouve' });

  if (!dossierId) return res.status(400).json({ message: 'dossierId requis' });

  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return res.status(404).json({ message: 'Dossier non trouve' });

  // Check access
  const isOwner = dossier.owner.toString() === userId;
  const isCollaborator = dossier.collaborators.some(c => c.toString() === userId);
  if (!isOwner && !isCollaborator) return res.status(403).json({ message: 'Acces refuse' });

  const user = await User.findById(userId);
  const resolvedContent = resolvePlaceholders(template.content, dossier, user);

  res.json({ content: resolvedContent });
}
