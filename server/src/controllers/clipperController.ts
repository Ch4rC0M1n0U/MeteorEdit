import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

async function captureScreenshot(url: string, filename: string): Promise<string | null> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const screenshotDir = path.join(UPLOAD_DIR, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    await browser.close();
    browser = null;

    console.log(`Screenshot captured: ${filepath}`);
    return `uploads/screenshots/${filename}`;
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    return null;
  }
}

/**
 * Web Clipper — captures web content as a note node in a dossier.
 * POST /api/clip
 * Body: { dossierId, parentId?, title, url, content (HTML string), textContent? }
 */
export async function clipWebContent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId, parentId, title, url, content, textContent } = req.body;

    if (!dossierId || !title || !content) {
      res.status(400).json({ error: 'dossierId, title et content requis' });
      return;
    }

    const dossier = await Dossier.findById(dossierId);
    if (!dossier) { res.status(404).json({ error: 'Dossier introuvable' }); return; }
    const hasAccess = dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
    if (!hasAccess) { res.status(403).json({ error: 'Accès refusé' }); return; }

    // Capture screenshot BEFORE creating node
    const filename = `clip-${Date.now()}.png`;
    const screenshotPath = url ? await captureScreenshot(url, filename) : null;

    // Build TipTap-compatible JSON content
    const tiptapNodes: any[] = [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: title }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Source : ' },
          {
            type: 'text',
            marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }],
            text: url,
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: `Capturé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
          },
        ],
      },
      { type: 'horizontalRule' },
    ];

    // Add screenshot if captured
    if (screenshotPath) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const serverBase = `${protocol}://${host}`;
      tiptapNodes.push({
        type: 'image',
        attrs: {
          src: `${serverBase}/${screenshotPath}`,
          alt: `Capture de ${title}`,
          title: `Screenshot - ${url}`,
        },
      });
    }

    // Add text content
    tiptapNodes.push({
      type: 'paragraph',
      content: [{ type: 'text', text: textContent || content.replace(/<[^>]+>/g, ' ').substring(0, 50000) }],
    });

    const tiptapContent = { type: 'doc', content: tiptapNodes };

    const lastNode = await DossierNode.findOne({
      dossierId,
      parentId: parentId || null,
    }).sort({ order: -1 });

    const node = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'note',
      title: `📎 ${title}`,
      content: tiptapContent,
      contentText: textContent || content.replace(/<[^>]+>/g, ' ').substring(0, 50000),
      fileUrl: screenshotPath || undefined,
      order: lastNode ? lastNode.order + 1 : 0,
    });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'clip.create', 'dossier', dossierId, { nodeId: node._id.toString(), url, title }, ip, ua);

    res.status(201).json(node);
  } catch (error) {
    console.error('Clip error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Returns a list of dossiers the user can clip into.
 * GET /api/clip/dossiers
 */
export async function getClipDossiers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id title').sort({ updatedAt: -1 }).limit(50);
    res.json(dossiers);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
