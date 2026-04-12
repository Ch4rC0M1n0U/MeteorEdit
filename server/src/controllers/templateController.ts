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
  const template = await NoteTemplate.findOne({ _id: req.params.id, owner: userId }).lean();
  if (!template) return res.status(404).json({ message: 'Template non trouve' });
  res.json(template);
}

// POST /api/templates
export async function createTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { title, description, content, interactiveQuestions } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'Titre requis' });

  const template = await NoteTemplate.create({
    title: title.trim(),
    description: description || '',
    content,
    interactiveQuestions: interactiveQuestions || [],
    owner: userId,
  });

  await logActivity(userId, 'template.create', 'system', template._id.toString(), { title: template.title }, req.ip || '');
  res.status(201).json(template);
}

// PUT /api/templates/:id
export async function updateTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { title, description, content, interactiveQuestions } = req.body;

  const updateData: Record<string, any> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (content !== undefined) updateData.content = content;
  if (interactiveQuestions !== undefined) updateData.interactiveQuestions = interactiveQuestions;

  const template = await NoteTemplate.findOneAndUpdate(
    { _id: req.params.id, owner: userId },
    updateData,
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

  const template = await NoteTemplate.findOne({ _id: req.params.id, owner: userId }).lean();
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

// POST /api/templates/:id/compile - Compile interactive template with answers
export async function compileTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId, answers } = req.body;

  const template = await NoteTemplate.findOne({ _id: req.params.id, owner: userId }).lean();
  if (!template) return res.status(404).json({ message: 'Template non trouve' });

  if (!dossierId) return res.status(400).json({ message: 'dossierId requis' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ message: 'answers requis' });

  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return res.status(404).json({ message: 'Dossier non trouve' });

  const isOwner = dossier.owner.toString() === userId;
  const isCollaborator = dossier.collaborators.some((c: any) => c.toString() === userId);
  if (!isOwner && !isCollaborator) return res.status(403).json({ message: 'Acces refuse' });

  const user = await User.findById(userId);
  const questions: any[] = template.interactiveQuestions || [];

  // Determine which questions are active based on answers
  function getActiveQuestions(): any[] {
    const active: any[] = [];
    for (const q of questions.sort((a: any, b: any) => a.order - b.order)) {
      if (!q.parentId) {
        active.push(q);
      } else if (answers[q.parentId] === q.parentAnswerValue) {
        active.push(q);
      }
    }
    return active;
  }

  // Build the compiled content by assembling base content + conditional blocks
  const baseContent = template.content || { type: 'doc', content: [] };
  const docNodes: any[] = [...(baseContent.content || [])];

  const activeQuestions = getActiveQuestions();
  for (const q of activeQuestions) {
    const answer = answers[q.id];
    if (!answer) continue;

    let block = q.contentBlocks?.[q.type === 'text' ? '__text__' : answer];
    if (!block) continue;

    // For text type, replace {{questionId}} placeholders with the answer text
    if (q.type === 'text' && block) {
      const blockJson = JSON.stringify(block);
      const replaced = blockJson.split(`{{${q.id}}}`).join(answer);
      block = JSON.parse(replaced);
    }

    // Append block's content nodes to the document
    if (block.content && Array.isArray(block.content)) {
      docNodes.push(...block.content);
    }
  }

  // Also replace text-type answer references in the assembled doc
  let assembledJson = JSON.stringify({ type: 'doc', content: docNodes });
  for (const q of activeQuestions) {
    if (q.type === 'text' && answers[q.id]) {
      assembledJson = assembledJson.split(`{{${q.id}}}`).join(answers[q.id]);
    }
  }

  const assembledContent = JSON.parse(assembledJson);
  const resolvedContent = resolvePlaceholders(assembledContent, dossier, user);

  await logActivity(userId, 'template.compile', 'system', template._id.toString(), { title: template.title, dossierId }, req.ip || '');
  res.json({ content: resolvedContent, title: template.title });
}
