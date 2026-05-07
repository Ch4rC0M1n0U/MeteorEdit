import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Types } from 'mongoose';
import type { ExtensionRequest } from '../middleware/extensionAuth';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { logActivity } from '../utils/activityLogger';
import { getIO } from '../socket';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
const CLIPS_DIR = path.join(UPLOAD_DIR, 'clips');

const MAX_BASE64_BYTES = 50 * 1024 * 1024; // ~50 MB hard limit on the encoded payload

function ensureClipsDir(): void {
  if (!fs.existsSync(CLIPS_DIR)) {
    fs.mkdirSync(CLIPS_DIR, { recursive: true });
  }
}

function getRequestMeta(req: ExtensionRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

/**
 * Decode a "data:image/png;base64,...." or raw base64 string to a Buffer.
 * Returns null if the input is invalid.
 */
function decodeScreenshot(input: unknown): Buffer | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input.length > MAX_BASE64_BYTES) return null;
  const commaIdx = input.indexOf(',');
  const base64 = commaIdx !== -1 && input.startsWith('data:') ? input.slice(commaIdx + 1) : input;
  try {
    const buf = Buffer.from(base64, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function safeHostname(rawUrl: string): string {
  try { return new URL(rawUrl).hostname; } catch { return ''; }
}

function shortTitle(title: string, fallback: string): string {
  const t = (title ?? '').trim();
  if (t) return t.length > 140 ? t.slice(0, 137) + '…' : t;
  return fallback || 'Capture web';
}

interface ClipBody {
  dossierId?: string;
  parentId?: string | null;
  url?: string;
  title?: string;
  capturedAt?: string;
  mode?: 'full' | 'area';
  screenshotBase64?: string;
  html?: string | null;
}

/**
 * GET /api/extension/dossiers
 * Returns the list of dossiers the token's user can write to.
 * Minimal payload: just _id, title, encrypted flag.
 */
export async function listExtensionDossiers(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossiers = await Dossier.find({
      $and: [
        { $or: [{ owner: userId }, { collaborators: userId }] },
        { status: { $ne: 'closed' } },
      ],
    })
      .select('_id title encrypted status createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(dossiers);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/extension/clip
 * Body: { dossierId, parentId?, url, title, capturedAt, mode, screenshotBase64, html? }
 *
 * Saves the screenshot to uploads/clips/ and creates a "note" DossierNode
 * with TipTap content embedding the image and source metadata.
 */
export async function clipFromExtension(req: ExtensionRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const body = (req.body ?? {}) as ClipBody;
    const {
      dossierId,
      parentId,
      url = '',
      title = '',
      capturedAt,
      mode = 'full',
      screenshotBase64,
      html,
    } = body;

    if (!dossierId || !Types.ObjectId.isValid(dossierId)) {
      res.status(400).json({ message: 'Invalid dossierId' });
      return;
    }
    if (parentId && !Types.ObjectId.isValid(parentId)) {
      res.status(400).json({ message: 'Invalid parentId' });
      return;
    }

    const buf = decodeScreenshot(screenshotBase64);
    if (!buf) {
      res.status(400).json({ message: 'Missing or invalid screenshotBase64' });
      return;
    }

    const dossier = await Dossier.findOne({
      _id: dossierId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id encrypted').lean();
    if (!dossier) {
      res.status(403).json({ message: 'Access denied to this dossier' });
      return;
    }

    if ((dossier as any).encrypted) {
      res.status(409).json({
        message:
          'Le dossier est chiffré (E2E). Le clipper de l\'extension ne peut pas y déposer de contenu pour l\'instant — utilisez un dossier non chiffré.',
      });
      return;
    }

    ensureClipsDir();
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `clip-${ts}-${rand}.png`;
    const filepath = path.join(CLIPS_DIR, filename);
    fs.writeFileSync(filepath, buf);
    const storedPath = `uploads/clips/${filename}`;

    const host = safeHostname(url);
    const dateStr = capturedAt ? new Date(capturedAt) : new Date();
    const dateLabel = dateStr.toLocaleString('fr-FR');
    const noteTitle = shortTitle(title, host || 'Capture web');

    // TipTap JSON: source meta + image. We avoid adding huge HTML directly to the
    // node content (it would bloat the editor). If the user requested HTML, we
    // append a collapsed text block at the end with stripped text.
    const content: any = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: noteTitle }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'italic' }], text: `Capture ${mode === 'area' ? 'd\'une zone' : 'plein écran'} — ${dateLabel}` },
          ],
        },
        ...(url
          ? [{
              type: 'paragraph',
              content: [
                { type: 'text', marks: [{ type: 'bold' }], text: 'Source : ' },
                { type: 'text', marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }], text: url },
              ],
            }]
          : []),
        {
          type: 'image',
          attrs: { src: `/${storedPath}`, alt: noteTitle, title: noteTitle },
        },
      ],
    };

    if (typeof html === 'string' && html.trim().length > 0) {
      // Convert raw HTML text content to a single quoted paragraph (cap at 20KB).
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20000);
      if (text.length > 0) {
        content.content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Contenu textuel extrait' }],
        });
        content.content.push({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        });
      }
    }

    const node = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'note',
      title: noteTitle,
      content,
      contentText: noteTitle,
      order: 0,
    });

    // Live notify any opened web app currently viewing the dossier so the new
    // note appears without a manual refresh. Same event the client already
    // handles for other in-app creations.
    const io = getIO();
    if (io) {
      const populatedNode = await DossierNode.findById(node._id).lean();
      io.to(`dossier:${String(dossierId)}`).emit('node-added', populatedNode ?? node.toObject());
    }

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'extension.clip', 'dossier', String(dossierId), {
      nodeId: String(node._id),
      url,
      mode,
      bytes: buf.length,
    }, ip, ua);

    res.status(201).json({
      nodeId: String(node._id),
      title: noteTitle,
      screenshotPath: `/${storedPath}`,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
