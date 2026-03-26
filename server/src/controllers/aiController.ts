import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PluginSettings from '../models/PluginSettings';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import User from '../models/User';
import ReportTemplate from '../models/ReportTemplate';
import { logActivity } from '../utils/activityLogger';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface AiConfig {
  provider: 'ollama' | 'claude' | 'openai';
  ollamaBaseUrl: string;
  ollamaModel: string;
  claudeApiKey: string;
  claudeModel: string;
  openaiApiKey: string;
  openaiModel: string;
  enabled: boolean;
  reportPrompt: string;
  model: string; // resolved model name
}

async function getAiConfig(userId?: string): Promise<AiConfig & { isCommercial: boolean }> {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});

  const provider = settings.aiProvider || 'ollama';
  const claude = settings.claude || { apiKey: '', selectedModel: 'claude-sonnet-4-20250514', enabled: false };
  const openai = settings.openai || { apiKey: '', selectedModel: 'gpt-4o', enabled: false };

  // Check user-level config if individual mode is enabled
  let userProvider: string | null = null;
  let userClaudeKey = '';
  let userClaudeModel = '';
  let userOpenaiKey = '';
  let userOpenaiModel = '';

  if (settings.aiIndividualMode && userId) {
    const user = await User.findById(userId).select('preferences');
    if (user?.preferences) {
      const prefs = user.preferences;
      userClaudeKey = prefs.claudeApiKey || '';
      userClaudeModel = prefs.claudeModel || 'claude-sonnet-4-20250514';
      userOpenaiKey = prefs.openaiApiKey || '';
      userOpenaiModel = prefs.openaiModel || 'gpt-4o';
      if (prefs.aiProvider) userProvider = prefs.aiProvider;
    }
  }

  // Resolve provider: user preference > admin config
  let resolvedProvider: 'ollama' | 'claude' | 'openai' = 'ollama';
  let enabled = settings.ollama.enabled;
  let model = settings.ollama.selectedModel || '';
  let resolvedClaudeKey = claude.apiKey || '';
  let resolvedClaudeModel = claude.selectedModel || 'claude-sonnet-4-20250514';
  let resolvedOpenaiKey = openai.apiKey || '';
  let resolvedOpenaiModel = openai.selectedModel || 'gpt-4o';

  // Try user-level provider first
  if (userProvider === 'claude' && userClaudeKey) {
    resolvedProvider = 'claude';
    enabled = true;
    model = userClaudeModel;
    resolvedClaudeKey = userClaudeKey;
    resolvedClaudeModel = userClaudeModel;
  } else if (userProvider === 'openai' && userOpenaiKey) {
    resolvedProvider = 'openai';
    enabled = true;
    model = userOpenaiModel;
    resolvedOpenaiKey = userOpenaiKey;
    resolvedOpenaiModel = userOpenaiModel;
  } else {
    // Fall back to admin config
    const isClaude = provider === 'claude' && claude.enabled && claude.apiKey;
    const isOpenAI = provider === 'openai' && openai.enabled && openai.apiKey;
    if (isClaude) {
      resolvedProvider = 'claude';
      enabled = claude.enabled;
      model = claude.selectedModel || 'claude-sonnet-4-20250514';
    } else if (isOpenAI) {
      resolvedProvider = 'openai';
      enabled = openai.enabled;
      model = openai.selectedModel || 'gpt-4o';
    }
  }

  return {
    provider: resolvedProvider,
    ollamaBaseUrl: settings.ollama.baseUrl || 'http://localhost:11434',
    ollamaModel: settings.ollama.selectedModel || '',
    claudeApiKey: resolvedClaudeKey,
    claudeModel: resolvedClaudeModel,
    openaiApiKey: resolvedOpenaiKey,
    openaiModel: resolvedOpenaiModel,
    enabled,
    reportPrompt: settings.ollama.reportPrompt,
    model,
    isCommercial: resolvedProvider === 'claude' || resolvedProvider === 'openai',
  };
}

// Legacy helper for admin endpoints that only need Ollama
async function getOllamaConfig() {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});
  const config = settings.ollama;
  // Use OLLAMA_URL env var as fallback when DB has default localhost value
  if (process.env.OLLAMA_URL && (!config.baseUrl || config.baseUrl === 'http://localhost:11434')) {
    config.baseUrl = process.env.OLLAMA_URL;
  }
  return config;
}

/** Stream text generation from Claude API via SSE */
async function streamClaude(
  apiKey: string,
  model: string,
  prompt: string,
  sendEvent: (data: any) => void,
  signal: AbortSignal,
  maxTokens: number = 4096,
  temperature: number = 0.3,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  }, { signal });

  let fullContent = '';
  let tokenCount = 0;

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      tokenCount++;
      sendEvent({ type: 'token', token: event.delta.text, tokenCount });
    }
  }

  const finalMessage = await stream.finalMessage();
  const inputTokens = finalMessage.usage?.input_tokens || 0;
  const outputTokens = finalMessage.usage?.output_tokens || 0;
  sendEvent({
    type: 'log',
    message: `Generation terminee - ${outputTokens} tokens generes (${inputTokens} tokens en entree)`,
  });

  return fullContent;
}

/** Stream text generation from Ollama API via SSE */
async function streamOllama(
  baseUrl: string,
  model: string,
  prompt: string,
  sendEvent: (data: any) => void,
  signal: AbortSignal,
  maxTokens: number = 4096,
  temperature: number = 0.3,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      options: { temperature, num_predict: maxTokens },
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ollama status ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

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
          sendEvent({ type: 'token', token: parsed.response, tokenCount });
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

  return fullContent;
}

/** Stream text generation from OpenAI API via SSE */
async function streamOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  sendEvent: (data: any) => void,
  signal: AbortSignal,
  maxTokens: number = 4096,
  temperature: number = 0.3,
): Promise<string> {
  const client = new OpenAI({ apiKey });

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  }, { signal });

  let fullContent = '';
  let tokenCount = 0;

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      fullContent += text;
      tokenCount++;
      sendEvent({ type: 'token', token: text, tokenCount });
    }
  }

  sendEvent({
    type: 'log',
    message: `Generation terminee - ${tokenCount} tokens generes (${model})`,
  });

  return fullContent;
}

// GET /api/ai/status - Check if AI is configured and available
export async function getAiStatus(_req: AuthRequest, res: Response) {
  const config = await getAiConfig(_req.user?.userId);
  res.json({
    enabled: config.enabled,
    hasModel: !!config.model,
    model: config.model,
    provider: config.provider,
  });
}

// GET /api/ai/config - Get resolved AI config for current user (no secrets)
export async function getAiClientConfig(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});

  const config = await getAiConfig(userId);
  res.json({
    provider: config.provider,
    model: config.model,
    enabled: config.enabled,
    isCommercial: config.isCommercial,
    aiIndividualMode: settings.aiIndividualMode || false,
    disclaimerMessage: settings.aiDisclaimerMessage || '',
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
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'ai.model_pull', 'system', null, { model }, ip, ua);
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
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'ai.model_delete', 'system', null, { model: modelName }, ip, ua);
    res.json({ message: `Modele ${modelName} supprime` });
  } catch (err: any) {
    res.status(502).json({ message: `Erreur suppression: ${err.message}` });
  }
}

// PUT /api/admin/ai/settings - Update AI settings (Ollama + Claude + provider)
export async function updateOllamaSettings(req: AuthRequest, res: Response) {
  let settings = await PluginSettings.findOne();
  if (!settings) settings = await PluginSettings.create({});

  const { baseUrl, selectedModel, enabled, reportPrompt, aiProvider, claude, openai } = req.body;
  // Ollama settings
  if (baseUrl !== undefined) settings.ollama.baseUrl = baseUrl;
  if (selectedModel !== undefined) settings.ollama.selectedModel = selectedModel;
  if (typeof enabled === 'boolean') settings.ollama.enabled = enabled;
  if (reportPrompt !== undefined) settings.ollama.reportPrompt = reportPrompt;
  // Provider selection
  if (aiProvider !== undefined) settings.aiProvider = aiProvider;
  // Ensure sub-documents exist (for documents created before these fields were added)
  if (!settings.claude) (settings as any).claude = {};
  if (!settings.openai) (settings as any).openai = {};
  if (settings.aiIndividualMode === undefined) (settings as any).aiIndividualMode = false;
  if (!settings.aiDisclaimerMessage) (settings as any).aiDisclaimerMessage = '';
  // Claude settings
  if (claude) {
    if (claude.apiKey !== undefined) settings.claude.apiKey = claude.apiKey;
    if (claude.selectedModel !== undefined) settings.claude.selectedModel = claude.selectedModel;
    if (typeof claude.enabled === 'boolean') settings.claude.enabled = claude.enabled;
  }
  // OpenAI settings
  if (openai) {
    if (openai.apiKey !== undefined) settings.openai.apiKey = openai.apiKey;
    if (openai.selectedModel !== undefined) settings.openai.selectedModel = openai.selectedModel;
    if (typeof openai.enabled === 'boolean') settings.openai.enabled = openai.enabled;
  }
  // Individual mode settings
  if (typeof req.body.aiIndividualMode === 'boolean') settings.aiIndividualMode = req.body.aiIndividualMode;
  if (req.body.aiDisclaimerMessage !== undefined) {
    const oldMessage = settings.aiDisclaimerMessage;
    settings.aiDisclaimerMessage = req.body.aiDisclaimerMessage;
    // Reset all users' disclaimer dismissed flag if message changed
    if (oldMessage !== req.body.aiDisclaimerMessage) {
      await User.updateMany(
        { 'preferences.aiDisclaimerDismissed': true },
        { $set: { 'preferences.aiDisclaimerDismissed': false } }
      );
    }
  }

  await settings.save();
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  await logActivity(req.user!.userId, 'settings.ai_update', 'system', null, { aiProvider, baseUrl, selectedModel, enabled }, ip, ua);
  res.json({
    ollama: settings.ollama,
    claude: { selectedModel: settings.claude.selectedModel, enabled: settings.claude.enabled, hasKey: !!settings.claude.apiKey },
    openai: { selectedModel: settings.openai.selectedModel, enabled: settings.openai.enabled, hasKey: !!settings.openai.apiKey },
    aiProvider: settings.aiProvider,
    aiIndividualMode: settings.aiIndividualMode,
    aiDisclaimerMessage: settings.aiDisclaimerMessage,
  });
}

// POST /api/admin/ai/claude/test - Test Claude API key
export async function testClaudeConnection(req: AuthRequest, res: Response) {
  let { apiKey } = req.body;
  // If no key provided, use stored key
  if (!apiKey) {
    const settings = await PluginSettings.findOne();
    apiKey = settings?.claude?.apiKey;
  }
  if (!apiKey) return res.status(400).json({ message: 'Cle API requise' });

  try {
    const client = new Anthropic({ apiKey });
    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
    res.json({ ok: true, message: `Connexion reussie (${text.trim()})` });
  } catch (err: any) {
    // Parse Anthropic error for user-friendly message
    let message = err.message || 'Erreur inconnue';
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch { /* not JSON, use raw message */ }
    const status = err.status || 502;
    res.status(status).json({ ok: false, message });
  }
}

// POST /api/admin/ai/openai/test - Test OpenAI API key
export async function testOpenAIConnection(req: AuthRequest, res: Response) {
  let { apiKey } = req.body;
  if (!apiKey) {
    const settings = await PluginSettings.findOne();
    apiKey = settings?.openai?.apiKey;
  }
  if (!apiKey) return res.status(400).json({ message: 'Cle API requise' });

  try {
    const client = new OpenAI({ apiKey });
    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });
    const text = result.choices?.[0]?.message?.content || '';
    res.json({ ok: true, message: `Connexion reussie (${text.trim()})` });
  } catch (err: any) {
    let message = err.message || 'Erreur inconnue';
    // OpenAI SDK errors have .error.message
    if (err.error?.message) message = err.error.message;
    const status = err.status || 502;
    res.status(status).json({ ok: false, message });
  }
}

// Track active operations for cancellation
const activeGenerations = new Map<string, AbortController>();
const activeEnrichments = new Map<string, AbortController>();

// POST /api/ai/generate-report - Generate AI report with SSE streaming
export async function generateReport(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId, templateId } = req.body;

  if (!dossierId) return res.status(400).json({ message: 'dossierId requis' });

  const config = await getAiConfig(userId);
  if (!config.enabled || !config.model) {
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
    ? dossier.entities.map(e => {
        let line = `- ${e.name} (${e.type}): ${e.description}`;
        if (e.photos?.length) line += ` [${e.photos.length} photo(s) jointe(s)]`;
        return line;
      }).join('\n')
    : 'Aucune entite';

  // Linked documents from dossier info
  const linkedDocsText = dossier.linkedDocuments?.length
    ? dossier.linkedDocuments.map(d => {
        const sizeMB = (d.fileSize / (1024 * 1024)).toFixed(1);
        const date = d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('fr-FR') : '';
        return `- ${d.fileName} (${sizeMB} Mo${date ? ', ajoute le ' + date : ''})`;
      }).join('\n')
    : 'Aucune piece jointe';

  // Media nodes (photos, documents uploaded as nodes)
  const mediaNodes = nodes.filter(n => n.type === 'media' || n.type === 'document');
  const mediaText = mediaNodes.length
    ? mediaNodes.map(n => `- ${n.title} (${n.type})`).join('\n')
    : '';

  const investigatorText = dossier.investigator?.name
    ? `${dossier.investigator.name} - ${dossier.investigator.service} - ${dossier.investigator.unit}`
    : 'Non renseigne';

  // Get user signature for report signing
  const currentUser = await User.findById(userId).select('signature firstName lastName');
  const sig = currentUser?.signature;
  const signatureText = sig?.name
    ? [sig.title, sig.name, sig.service, sig.unit, sig.email].filter(Boolean).join('\n')
    : `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Non renseigne';

  // Load prompt from template if templateId provided, otherwise fall back to PluginSettings
  let promptTemplate: string;
  if (templateId) {
    const reportTemplate = await ReportTemplate.findById(templateId);
    if (reportTemplate) {
      promptTemplate = reportTemplate.prompt;
    } else {
      promptTemplate = config.reportPrompt || `Tu es un analyste OSINT professionnel. Genere un rapport d'investigation structure et detaille.`;
    }
  } else {
    promptTemplate = config.reportPrompt || `Tu es un analyste OSINT professionnel. Genere un rapport d'investigation structure et detaille.`;
  }
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
    .replace(/\{\{linkedDocuments\}\}/g, linkedDocsText)
    .replace(/\{\{media\}\}/g, mediaText || 'Aucun media')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-FR'));

  const providerLabel = config.provider === 'claude' ? 'Claude API' : config.provider === 'openai' ? 'OpenAI API' : 'Ollama (local)';
  sendEvent({ type: 'log', message: `Provider: ${providerLabel}` });
  sendEvent({ type: 'log', message: `Modele: ${config.model}` });
  sendEvent({ type: 'log', message: `Dossier: ${dossier.title} (${nodes.length} elements)` });

  // Heartbeat for Ollama model loading
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  if (config.provider === 'ollama') {
    sendEvent({ type: 'log', message: 'Chargement du modele en memoire (peut prendre un moment)...' });
    let elapsedSec = 0;
    heartbeat = setInterval(() => {
      elapsedSec += 5;
      sendEvent({ type: 'log', message: `Attente du modele... ${elapsedSec}s` });
    }, 5000);
  }

  try {
    let fullContent: string;

    if (config.provider === 'claude') {
      sendEvent({ type: 'log', message: 'Generation en cours...' });
      fullContent = await streamClaude(config.claudeApiKey, config.claudeModel, prompt, sendEvent, abortController.signal, 4096, 0.3);
    } else if (config.provider === 'openai') {
      sendEvent({ type: 'log', message: 'Generation en cours...' });
      fullContent = await streamOpenAI(config.openaiApiKey, config.openaiModel, prompt, sendEvent, abortController.signal, 4096, 0.3);
    } else {
      fullContent = await streamOllama(config.ollamaBaseUrl, config.ollamaModel, prompt, sendEvent, abortController.signal, 4096, 0.3);
    }

    if (heartbeat) clearInterval(heartbeat);

    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(userId, 'ai.generate_report', 'dossier', dossierId, { model: config.model, provider: config.provider, title: dossier.title }, ip, ua);
    }

    sendEvent({
      type: 'done',
      content: fullContent,
      model: config.model,
    });
  } catch (err: any) {
    if (heartbeat) clearInterval(heartbeat);
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

// POST /api/ai/enrich-entity - Enrich entity info with SSE streaming
export async function enrichEntity(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId, entityIndex } = req.body;

  if (!dossierId || entityIndex === undefined) {
    return res.status(400).json({ message: 'dossierId et entityIndex requis' });
  }

  const config = await getAiConfig(userId);
  if (!config.enabled || !config.model) {
    return res.status(400).json({ message: 'IA non configuree' });
  }

  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return res.status(404).json({ message: 'Dossier non trouve' });

  const isOwner = dossier.owner.toString() === userId;
  const isCollaborator = dossier.collaborators.some(c => c.toString() === userId);
  if (!isOwner && !isCollaborator) return res.status(403).json({ message: 'Acces refuse' });

  const entity = dossier.entities?.[entityIndex];
  if (!entity) return res.status(404).json({ message: 'Entite non trouvee' });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const abortController = new AbortController();
  const enrichId = `${userId}-${dossierId}-${entityIndex}`;
  activeEnrichments.set(enrichId, abortController);

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const prompt = `Tu es un analyste OSINT. Enrichis les informations sur l'entite suivante en fournissant une description detaillee et pertinente pour une investigation.

Entite: ${entity.name}
Type: ${entity.type}
Description actuelle: ${entity.description || 'Aucune'}

Contexte du dossier: ${dossier.title}
${dossier.description ? `Description du dossier: ${dossier.description}` : ''}

Fournis une description enrichie de cette entite (2-4 paragraphes). Inclus des informations factuelles potentielles, des pistes de recherche OSINT, et des elements a verifier. Reponds uniquement avec la description enrichie, sans introduction ni conclusion.`;

  const providerLabel = config.provider === 'claude' ? 'Claude API' : config.provider === 'openai' ? 'OpenAI API' : 'Ollama (local)';
  sendEvent({ type: 'log', message: `Enrichissement de "${entity.name}" (${entity.type})...` });
  sendEvent({ type: 'log', message: `Provider: ${providerLabel} | Modele: ${config.model}` });

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  if (config.provider === 'ollama') {
    let elapsed = 0;
    heartbeat = setInterval(() => {
      elapsed += 5;
      sendEvent({ type: 'log', message: `Attente du modele... ${elapsed}s` });
    }, 5000);
  }

  try {
    let fullContent: string;

    if (config.provider === 'claude') {
      sendEvent({ type: 'log', message: 'Generation en cours...' });
      fullContent = await streamClaude(config.claudeApiKey, config.claudeModel, prompt, sendEvent, abortController.signal, 1024, 0.3);
    } else if (config.provider === 'openai') {
      sendEvent({ type: 'log', message: 'Generation en cours...' });
      fullContent = await streamOpenAI(config.openaiApiKey, config.openaiModel, prompt, sendEvent, abortController.signal, 1024, 0.3);
    } else {
      fullContent = await streamOllama(config.ollamaBaseUrl, config.ollamaModel, prompt, sendEvent, abortController.signal, 1024, 0.3);
    }

    if (heartbeat) clearInterval(heartbeat);

    // Save enriched description
    const enrichedDescription = fullContent.trim() || entity.description;
    dossier.entities![entityIndex].description = enrichedDescription;
    await dossier.save();

    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(userId, 'entity.enrich', 'dossier', dossierId, { entityName: entity.name, entityType: entity.type }, ip, ua);
    }

    sendEvent({ type: 'done', description: enrichedDescription, model: config.model });
  } catch (err: any) {
    if (heartbeat) clearInterval(heartbeat);
    if (err.name === 'AbortError') {
      sendEvent({ type: 'cancelled', message: 'Enrichissement annule' });
    } else {
      sendEvent({ type: 'error', message: `Erreur IA: ${err.message}` });
    }
  } finally {
    activeEnrichments.delete(enrichId);
    res.end();
  }
}

// POST /api/ai/enrich-entity/cancel - Cancel active enrichment
export async function cancelEnrichEntity(req: AuthRequest, res: Response) {
  const { dossierId, entityIndex } = req.body;
  const enrichId = `${req.user!.userId}-${dossierId}-${entityIndex}`;
  const controller = activeEnrichments.get(enrichId);
  if (controller) {
    controller.abort();
    activeEnrichments.delete(enrichId);
    res.json({ message: 'Enrichissement annule' });
  } else {
    res.status(404).json({ message: 'Aucun enrichissement actif' });
  }
}

// POST /api/ai/summarize - Summarize a node or dossier using Ollama
export async function summarizeContent(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { dossierId, nodeId } = req.body;

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

  let contentToSummarize = '';
  let targetTitle = dossier.title;

  if (nodeId) {
    const node = await DossierNode.findById(nodeId);
    if (!node) return res.status(404).json({ message: 'Noeud non trouve' });
    targetTitle = node.title;
    contentToSummarize = node.contentText || '';
    if (!contentToSummarize && node.content) {
      contentToSummarize = typeof node.content === 'string' ? node.content : JSON.stringify(node.content);
    }
  } else {
    const nodes = await DossierNode.find({ dossierId, deletedAt: null, type: 'note' }).select('title contentText');
    contentToSummarize = nodes
      .filter(n => n.contentText)
      .map(n => `### ${n.title}\n${n.contentText}`)
      .join('\n\n');
    if (dossier.description) contentToSummarize = `Description: ${dossier.description}\n\n${contentToSummarize}`;
    if (dossier.objectives) contentToSummarize = `Objectifs: ${dossier.objectives}\n\n${contentToSummarize}`;
  }

  if (!contentToSummarize.trim()) {
    return res.status(400).json({ message: 'Aucun contenu a resumer' });
  }

  const prompt = `Tu es un analyste OSINT. Fais un resume concis et structure du contenu suivant.

Titre: ${targetTitle}

Contenu:
${contentToSummarize.substring(0, 8000)}

Fournis un resume structure en points cles (bullet points). Sois concis mais complet. Reponds uniquement avec le resume.`;

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.selectedModel,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 1024 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama status ${response.status}`);
    const data = await response.json() as { response?: string };

    if (!dossier.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(userId, 'ai.summarize', nodeId ? 'node' : 'dossier', nodeId || dossierId, { title: targetTitle }, ip, ua);
    }

    res.json({ summary: data.response?.trim() || '' });
  } catch (err: any) {
    res.status(502).json({ message: `Erreur IA: ${err.message}` });
  }
}

// POST /api/ai/reformulate - Reformulate selected text (supports all AI providers)
export async function reformulateText(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { text, tone } = req.body;

  if (!text?.trim()) return res.status(400).json({ message: 'Texte requis' });
  if (text.length > 2000) return res.status(400).json({ message: 'Texte trop long (max 2000 caracteres)' });

  const config = await getAiConfig(userId);
  if (!config.enabled || !config.model) {
    return res.status(400).json({ message: 'IA non configuree' });
  }

  const toneMap: Record<string, string> = {
    formal: 'formel et professionnel',
    concise: 'concis et direct',
    fluent: 'fluide et naturel',
    simple: 'simple et accessible',
  };
  const toneDesc = toneMap[tone || 'fluent'] || 'fluide et naturel';

  const prompt = `Reformule ce texte en style ${toneDesc}. Reponds UNIQUEMENT avec la reformulation.\n\n${text.trim()}`;

  // Helper: call Ollama as fallback
  async function callOllama(signal: AbortSignal): Promise<string> {
    const ollamaConfig = await getOllamaConfig();
    if (!ollamaConfig.enabled || !ollamaConfig.selectedModel) throw new Error('Ollama non configure');
    const response = await fetch(`${ollamaConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaConfig.selectedModel,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 256 },
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Ollama status ${response.status}`);
    const data = await response.json() as { response?: string };
    return data.response || '';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let result = '';
    let usedProvider: string = config.provider;

    if (config.provider === 'claude' && config.claudeApiKey) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: config.claudeApiKey });
        const msg = await client.messages.create({
          model: config.claudeModel,
          max_tokens: 256,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        });
        result = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      } catch (err: any) {
        // Fallback to Ollama on quota/rate limit/auth errors
        console.warn(`[AI] Claude failed (${err.status || err.message}), falling back to Ollama`);
        result = await callOllama(controller.signal);
        usedProvider = 'ollama (fallback)';
      }
    } else if (config.provider === 'openai' && config.openaiApiKey) {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiApiKey}` },
          body: JSON.stringify({
            model: config.openaiModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 256,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`OpenAI status ${resp.status}`);
        const data = await resp.json() as any;
        result = data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        // Fallback to Ollama on quota/rate limit/auth errors
        console.warn(`[AI] OpenAI failed (${err.message}), falling back to Ollama`);
        result = await callOllama(controller.signal);
        usedProvider = 'ollama (fallback)';
      }
    } else {
      result = await callOllama(controller.signal);
    }

    clearTimeout(timeout);

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'ai.reformulate', 'system', null, { textLength: text.length, tone, provider: usedProvider }, ip, ua);

    result = result.trim().replace(/^["']|["']$/g, '');
    res.json({ suggestions: [result] });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ message: 'Reformulation timeout (30s)' });
    }
    res.status(502).json({ message: `Erreur IA: ${err.message}` });
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

// POST /api/ai/test/claude - Test user's Claude API key
export async function testUserClaudeConnection(req: AuthRequest, res: Response) {
  let { apiKey } = req.body;
  if (!apiKey) {
    const user = await User.findById(req.user!.userId).select('preferences');
    apiKey = user?.preferences?.claudeApiKey;
  }
  if (!apiKey) return res.status(400).json({ message: 'Cle API requise' });

  try {
    const client = new Anthropic({ apiKey });
    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
    res.json({ ok: true, message: `Connexion reussie (${text.trim()})` });
  } catch (err: any) {
    let message = err.message || 'Erreur inconnue';
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch { /* not JSON */ }
    res.status(err.status || 502).json({ ok: false, message });
  }
}

// POST /api/ai/test/openai - Test user's OpenAI API key
export async function testUserOpenAIConnection(req: AuthRequest, res: Response) {
  let { apiKey } = req.body;
  if (!apiKey) {
    const user = await User.findById(req.user!.userId).select('preferences');
    apiKey = user?.preferences?.openaiApiKey;
  }
  if (!apiKey) return res.status(400).json({ message: 'Cle API requise' });

  try {
    const client = new OpenAI({ apiKey });
    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });
    const text = result.choices?.[0]?.message?.content || '';
    res.json({ ok: true, message: `Connexion reussie (${text.trim()})` });
  } catch (err: any) {
    let message = err.message || 'Erreur inconnue';
    if (err.error?.message) message = err.error.message;
    res.status(err.status || 502).json({ ok: false, message });
  }
}
