import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ReportTemplate from '../models/ReportTemplate';
import PluginSettings from '../models/PluginSettings';

// GET /api/report-templates
export async function listReportTemplates(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  try {
    // Get user's own templates + shared templates
    const templates = await ReportTemplate.find({
      $or: [{ owner: userId }, { isShared: true }],
    })
      .sort({ isDefault: -1, updatedAt: -1 })
      .populate('owner', 'firstName lastName');

    // Also include the default prompt from PluginSettings as a virtual "system" entry
    let settings = await PluginSettings.findOne();
    if (!settings) settings = await PluginSettings.create({});

    const result = {
      templates,
      defaultPrompt: settings.ollama.reportPrompt,
    };

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/report-templates
export async function createReportTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { title, description, prompt, isShared } = req.body;

  if (!title?.trim() || !prompt?.trim()) {
    return res.status(400).json({ message: 'Titre et prompt requis' });
  }

  try {
    const template = await ReportTemplate.create({
      title: title.trim(),
      description: description || '',
      prompt,
      owner: userId,
      isShared: !!isShared,
    });

    res.status(201).json(template);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/report-templates/:id
export async function updateReportTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { title, description, prompt, isShared } = req.body;

  try {
    const template = await ReportTemplate.findById(id);
    if (!template) return res.status(404).json({ message: 'Template non trouve' });

    // Only the owner can edit
    if (template.owner.toString() !== userId) {
      return res.status(403).json({ message: 'Acces refuse' });
    }

    if (title !== undefined) template.title = title.trim();
    if (description !== undefined) template.description = description;
    if (prompt !== undefined) template.prompt = prompt;
    if (isShared !== undefined) template.isShared = isShared;

    await template.save();
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/report-templates/:id
export async function deleteReportTemplate(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const template = await ReportTemplate.findById(id);
    if (!template) return res.status(404).json({ message: 'Template non trouve' });

    if (template.owner.toString() !== userId) {
      return res.status(403).json({ message: 'Acces refuse' });
    }

    await template.deleteOne();
    res.json({ message: 'Template supprime' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
