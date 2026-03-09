import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import User from '../models/User';
import { logActivity } from '../utils/activityLogger';

async function getOllamaConfig() {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});
  return settings.ollama;
}

// GET /api/ai/status - Check if AI is configured and available
export async function getAiStatus(_req: AuthRequest, res: Response) {
  const config = await getOllamaConfig();
  res.json({
    enabled: config.enabled,
    hasModel: !!config.selectedModel,
    model: config.selectedModel,
  });
}

// GET /api/admin/ai/models - List models available in Ollama
export async function listOllamaModels(req: AuthRequest, res: Response) {
  const config = await getOllamaConfig();
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`);
    if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
    const data = await response.json() as { models?: any[] };
    res.json(data.models || []);
  } catch (err: any) {
    res.status(502).json({ message: `Impossible de contacter Ollama: ${err.message}` });
  }
}

// Track active pull operations for cancellation
const activePulls = new Map<string, AbortController>();

// POST /api/admin/ai/models/pull - Pull a model with SSE progress streaming
export async function pullOllamaModel(req: AuthRequest, res: Response) {
  const config = await getOllamaConfig();
  const { model } = req.body;
  if (!model?.trim()) return res.status(400).json({ message: 'Nom du modele requis' });

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const abortController = new AbortController();
  const pullId = `${req.user!.userId}-${model}`;
  activePulls.set(pullId, abortController);

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const response = await fetch(`${config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      sendEvent({ type: 'error', message: text || `Status ${response.status}` });
      res.end();
      activePulls.delete(pullId);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      sendEvent({ type: 'error', message: 'No response body' });
      res.end();
      activePulls.delete(pullId);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            status?: string;
            digest?: string;
            total?: number;
            completed?: number;
          };

          if (parsed.total && parsed.completed) {
            const percent = Math.round((parsed.completed / parsed.total) * 100);
            sendEvent({
              type: 'progress',
              status: parsed.status,
              digest: parsed.digest,
              total: parsed.total,
              completed: parsed.completed,
              percent,
            });
          } else {
            sendEvent({ type: 'status', status: parsed.status });
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'ai.model_pull', 'system', null, { model }, ip);
    sendEvent({ type: 'done', message: `Modele ${model} telecharge avec succes` });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      sendEvent({ type: 'cancelled', message: 'Telechargement annule' });
    } else {
      sendEvent({ type: 'error', message: `Erreur telechargement: ${err.message}` });
    }
  } finally {
    activePulls.delete(pullId);
    res.end();
  }
}

// POST /api/admin/ai/models/pull/cancel - Cancel an active pull
export async function cancelPullOllamaModel(req: AuthRequest, res: Response) {
  const { model } = req.body;
  const pullId = `${req.user!.userId}-${model}`;
  const controller = activePulls.get(pullId);
  if (controller) {
    controller.abort();
    activePulls.delete(pullId);
    res.json({ message: 'Annulation en cours' });
  } else {
    res.status(404).json({ message: 'Aucun telechargement actif pour ce modele' });
  }
}

// DELETE /api/admin/ai/models/:name - Delete a model from Ollama
export async function deleteOllamaModel(req: AuthRequest, res: Response) {
  const config = await getOllamaConfig();
  const modelName = req.params.name;

  try {
    const response = await fetch(`${config.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(req.user!.userId, 'ai.model_delete', 'system', null, { model: modelName }, ip);
    res.json({ message: `Modele ${modelName} supprime` });
  } catch (err: any) {
    res.status(502).json({ message: `Erreur suppression: ${err.message}` });
  }
}

// PUT /api/admin/ai/settings - Update Ollama settings
export async function updateOllamaSettings(req: AuthRequest, res: Response) {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});

  const { baseUrl, selectedModel, enabled, reportPrompt } = req.body;
  if (baseUrl !== undefined) settings.ollama.baseUrl = baseUrl;
  if (selectedModel !== undefined) settings.ollama.selectedModel = selectedModel;
  if (typeof enabled === 'boolean') settings.ollama.enabled = enabled;
  if (reportPrompt !== undefined) settings.ollama.reportPrompt = reportPrompt;

  await settings.save();
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  await logActivity(req.user!.userId, 'settings.ai_update', 'system', null, { baseUrl, selectedModel, enabled }, ip);
  res.json(settings.ollama);
}

// Track active report generations for cancellation
const activeGenerations = new Map<string, AbortController>();

// POST /api/ai/generate-report - Generate AI report with SSE streaming
export async function generateReport(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId } = req.body;

  if (!dossierId) return res.status(400).json({ message: 'dossierId requis' });

  const config = await getOllamaConfig();
  if (!config.enabled || !config.selectedModel) {
    return res.status(400).json({ message: 'IA non configuree' });
  }

  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return res.status(404).json({ message: 'Dossier non trouve' });

  const isOwner = dossier.owner.toString() === userId;
  const isCollaborator = dossier.collaborators.some(c => c.toString() === userId);
  if (!isOwner && !isCollaborator) return res.status(403).json({ message: 'Acces refuse' });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const abortController = new AbortController();
  const genId = `${userId}-${dossierId}`;
  activeGenerations.set(genId, abortController);

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Gather dossier data
  const nodes = await DossierNode.find({ dossierId, deletedAt: null }).select('title type contentText');
  const noteContents = nodes
    .filter(n => n.type === 'note' && n.contentText)
    .map(n => `### ${n.title}\n${n.contentText}`)
    .join('\n\n');

  const entitiesText = dossier.entities?.length
    ? dossier.entities.map(e => `- ${e.name} (${e.type}): ${e.description}`).join('\n')
    : 'Aucune entite';

  const investigatorText = dossier.investigator?.name
    ? `${dossier.investigator.name} - ${dossier.investigator.service} - ${dossier.investigator.unit}`
    : 'Non renseigne';

  // Get user signature for report signing
  const currentUser = await User.findById(userId).select('signature firstName lastName');
  const sig = currentUser?.signature;
  const signatureText = sig?.name
    ? [sig.title, sig.name, sig.service, sig.unit, sig.email].filter(Boolean).join('\n')
    : `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Non renseigne';

  const promptTemplate = config.reportPrompt || `Tu es un analyste OSINT professionnel. Genere un rapport d'investigation structure et detaille.`;
  const prompt = promptTemplate
    .replace(/\{\{title\}\}/g, dossier.title || '')
    .replace(/\{\{description\}\}/g, dossier.description || 'Non renseignee')
    .replace(/\{\{status\}\}/g, dossier.status || '')
    .replace(/\{\{objectives\}\}/g, dossier.objectives || 'Non renseignes')
    .replace(/\{\{judicialFacts\}\}/g, dossier.judicialFacts || 'Non renseignes')
    .replace(/\{\{entities\}\}/g, entitiesText)
    .replace(/\{\{investigator\}\}/g, investigatorText)
    .replace(/\{\{signature\}\}/g, signatureText)
    .replace(/\{\{notes\}\}/g, noteContents || 'Aucune note')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-FR'));

  sendEvent({ type: 'log', message: 'Connexion au modele IA...' });
  sendEvent({ type: 'log', message: `Modele: ${config.selectedModel}` });
  sendEvent({ type: 'log', message: `Dossier: ${dossier.title} (${nodes.length} elements)` });

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.selectedModel,
        prompt,
        stream: true,
        options: {
          temperature: 0.3,
          num_predict: 4096,
        },
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Ollama status ${response.status}`);
    }

    sendEvent({ type: 'log', message: 'Generation en cours...' });

    const reader = response.body?.getReader();
    if (!reader) {
      sendEvent({ type: 'error', message: 'No response body' });
      res.end();
      activeGenerations.delete(genId);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let tokenCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            response?: string;
            done?: boolean;
            total_duration?: number;
            eval_count?: number;
            eval_duration?: number;
          };

          if (parsed.response) {
            fullContent += parsed.response;
            tokenCount++;
            sendEvent({
              type: 'token',
              token: parsed.response,
              tokenCount,
            });
          }

          if (parsed.done) {
            const durationSec = parsed.total_duration
              ? (parsed.total_duration / 1e9).toFixed(1)
              : '?';
            const tokensPerSec = parsed.eval_count && parsed.eval_duration
              ? (parsed.eval_count / (parsed.eval_duration / 1e9)).toFixed(1)
              : '?';

            sendEvent({
              type: 'log',
              message: `Generation terminee - ${tokenCount} tokens en ${durationSec}s (${tokensPerSec} tokens/s)`,
            });
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'ai.generate_report', 'dossier', dossierId, { model: config.selectedModel, title: dossier.title }, ip);

    sendEvent({
      type: 'done',
      content: fullContent,
      model: config.selectedModel,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      sendEvent({ type: 'cancelled', message: 'Generation annulee' });
    } else {
      sendEvent({ type: 'error', message: `Erreur generation IA: ${err.message}` });
    }
  } finally {
    activeGenerations.delete(genId);
    res.end();
  }
}

// POST /api/ai/generate-report/cancel - Cancel active report generation
export async function cancelGenerateReport(req: AuthRequest, res: Response) {
  const { dossierId } = req.body;
  const genId = `${req.user!.userId}-${dossierId}`;
  const controller = activeGenerations.get(genId);
  if (controller) {
    controller.abort();
    activeGenerations.delete(genId);
    res.json({ message: 'Generation annulee' });
  } else {
    res.status(404).json({ message: 'Aucune generation active' });
  }
}
