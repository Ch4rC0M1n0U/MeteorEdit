import { Response } from 'express';
import { Types } from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import PhoneScan from '../models/PhoneScan';
import PhoneScanResult from '../models/PhoneScanResult';
import { getPhoneScannerSettings } from '../models/PhoneScannerSettings';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import {
  countCombinations,
  expandPattern,
  estimateDurationMs,
  normalizePattern,
  TooManyCombinationsError,
} from '../services/phoneScannerHelpers';
import { phoneScannerQueue } from '../services/phoneScannerQueue';
import { logActivity } from '../utils/activityLogger';

function getRequestMeta(req: AuthRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

async function userOwnsDossier(userId: string, dossierId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(dossierId)) return false;
  const dossier = await Dossier.findOne({
    _id: dossierId,
    $or: [{ owner: userId }, { collaborators: userId }],
  }).select('_id').lean();
  return !!dossier;
}

/**
 * POST /api/phone-scanner/scans
 * body: { dossierId, pattern, countryCode, platforms?, dryRun? }
 */
export async function createScan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId, pattern, countryCode, platforms = ['whatsapp'], dryRun = false } = req.body;

    if (!dossierId || !pattern || !countryCode) {
      res.status(400).json({ message: 'dossierId, pattern, and countryCode are required' });
      return;
    }
    if (!(await userOwnsDossier(userId, dossierId))) {
      res.status(403).json({ message: 'Access denied to this dossier' });
      return;
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      res.status(400).json({ message: 'At least one platform must be selected' });
      return;
    }

    const settings = await getPhoneScannerSettings();
    const cleanPattern = normalizePattern(pattern);
    const total = countCombinations(cleanPattern);

    let warnLevel: 'ok' | 'warn' | 'block' = 'ok';
    if (total >= settings.combinationsBlockThreshold) warnLevel = 'block';
    else if (total >= settings.combinationsWarnThreshold) warnLevel = 'warn';

    const estimatedDurationMs = estimateDurationMs(total, settings.minDelayMs, settings.maxDelayMs);

    if (dryRun) {
      res.json({
        totalCombinations: total,
        warnLevel,
        estimatedDurationMs,
        thresholds: {
          warn: settings.combinationsWarnThreshold,
          block: settings.combinationsBlockThreshold,
        },
      });
      return;
    }

    if (warnLevel === 'block') {
      res.status(400).json({
        message: `Pattern would generate ${total} combinations, exceeding the limit of ${settings.combinationsBlockThreshold}`,
        totalCombinations: total,
      });
      return;
    }

    // Validate by expanding (catches edge cases)
    try {
      expandPattern(cleanPattern, settings.combinationsBlockThreshold);
    } catch (err) {
      if (err instanceof TooManyCombinationsError) {
        res.status(400).json({ message: err.message, totalCombinations: err.count });
        return;
      }
      res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid pattern' });
      return;
    }

    const scan = await PhoneScan.create({
      dossierId,
      userId,
      pattern: cleanPattern,
      countryCode: countryCode.toUpperCase(),
      totalCombinations: total,
      status: 'queued',
      platforms,
    });

    phoneScannerQueue.enqueue(scan);

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'phone-scanner.scan.start', 'system', String(scan._id), {
      dossierId,
      pattern: cleanPattern,
      totalCombinations: total,
      platforms,
    }, ip, ua);

    res.status(201).json({
      scanId: String(scan._id),
      totalCombinations: total,
      warnLevel,
      estimatedDurationMs,
    });
  } catch (err: unknown) {
    console.error('[phoneScanner.createScan] error:', err);
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/phone-scanner/scans/:id
 */
export async function getScan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const scan = await PhoneScan.findById(req.params.id);
    if (!scan) {
      res.status(404).json({ message: 'Scan not found' });
      return;
    }
    if (String(scan.userId) !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    res.json({ scan });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/phone-scanner/scans/:id/results?status=&platform=
 */
export async function getScanResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const scan = await PhoneScan.findById(req.params.id).select('userId').lean();
    if (!scan) {
      res.status(404).json({ message: 'Scan not found' });
      return;
    }
    if (String(scan.userId) !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const filter: Record<string, unknown> = { scanId: req.params.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.platform) filter.platform = req.query.platform;

    const results = await PhoneScanResult.find(filter).sort({ testedAt: -1 }).lean();
    res.json({ results });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * DELETE /api/phone-scanner/scans/:id (cancel)
 */
export async function cancelScan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const scan = await PhoneScan.findById(req.params.id);
    if (!scan) {
      res.status(404).json({ message: 'Scan not found' });
      return;
    }
    if (String(scan.userId) !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    if (scan.status === 'completed' || scan.status === 'cancelled' || scan.status === 'failed') {
      res.status(400).json({ message: `Scan is already ${scan.status}` });
      return;
    }

    const cancelled = phoneScannerQueue.cancel(String(scan._id));
    if (!cancelled) {
      // Job not running anymore, mark as cancelled directly
      scan.status = 'cancelled';
      scan.completedAt = new Date();
      await scan.save();
    }

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'phone-scanner.scan.cancel', 'system', String(scan._id), {}, ip, ua);

    res.json({ success: true, scanId: String(scan._id) });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/phone-scanner/dossiers/:dossierId/history?limit=20
 */
export async function getDossierHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossierId = String(req.params.dossierId);

    if (!(await userOwnsDossier(userId, dossierId))) {
      res.status(403).json({ message: 'Access denied to this dossier' });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const scans = await PhoneScan.find({ dossierId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ scans });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * POST /api/phone-scanner/results/:id/to-entity
 * body: { dossierId?, customName?, customDescription? }
 *
 * Creates a "phone" entity in the target dossier from the scan result.
 * The entity is stored as a child note under a "Phone Scanner" folder
 * (auto-created if missing) with the profile data in its content.
 */
export async function resultToEntity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await PhoneScanResult.findById(req.params.id);
    if (!result) {
      res.status(404).json({ message: 'Result not found' });
      return;
    }
    if (String(result.userId) !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const targetDossierId = (req.body?.dossierId as string | undefined) ?? String(result.dossierId);
    if (!(await userOwnsDossier(userId, targetDossierId))) {
      res.status(403).json({ message: 'Access denied to target dossier' });
      return;
    }

    // Find or create a "Phone Scanner" folder under the dossier
    const existingFolder = await DossierNode.findOne({
      dossierId: targetDossierId,
      type: 'folder',
      title: 'Phone Scanner',
    });
    const folderIsNew = !existingFolder;
    const folder = existingFolder ?? await DossierNode.create({
      dossierId: targetDossierId,
      parentId: null,
      type: 'folder',
      title: 'Phone Scanner',
      order: 999,
    });

    const profile = result.profile ?? {};
    const baseName = (req.body?.customName as string | undefined)
      || profile.name
      || result.phoneE164;
    const description = (req.body?.customDescription as string | undefined)
      || profile.about
      || `${result.platform.toUpperCase()} — ${result.status}`;

    const platformLabel = result.platform.charAt(0).toUpperCase() + result.platform.slice(1);
    const headingText = profile.name
      ? `${profile.name} — ${platformLabel}`
      : `${result.phoneE164} — ${platformLabel}`;

    const tiptapContent: { type: 'doc'; content: any[] } = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: headingText }],
        },
      ],
    };

    if (profile.avatarUrl) {
      tiptapContent.content.push({
        type: 'paragraph',
        content: [
          {
            type: 'image',
            attrs: {
              src: profile.avatarUrl,
              alt: profile.name ? `Photo de profil — ${profile.name}` : 'Photo de profil',
            },
          },
        ],
      });
    }

    const infoRows: Array<[string, string]> = [
      ['Numéro', result.phoneE164],
      ['Plateforme', platformLabel],
      ['Statut', result.status],
    ];
    if (profile.name) infoRows.push(['Nom', profile.name]);
    if (profile.about) infoRows.push(['À propos', profile.about]);
    if (profile.isBusiness) infoRows.push(['Type', 'Compte business']);

    for (const [label, value] of infoRows) {
      tiptapContent.content.push({
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: `${label} : ` },
          { type: 'text', text: value },
        ],
      });
    }

    if (description && description !== profile.about) {
      tiptapContent.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: description }],
      });
    }

    const contentText = infoRows.map(([k, v]) => `${k}: ${v}`).join('\n');

    const node = await DossierNode.create({
      dossierId: targetDossierId,
      parentId: folder._id,
      type: 'note',
      title: baseName,
      content: tiptapContent,
      contentText,
      order: 0,
    });

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'phone-scanner.entity.create', 'dossier', targetDossierId, {
      resultId: String(result._id),
      nodeId: String(node._id),
      phoneE164: result.phoneE164,
      platform: result.platform,
    }, ip, ua);

    res.status(201).json({
      nodeId: String(node._id),
      folderId: String(folder._id),
      node: node.toObject(),
      folder: folderIsNew ? folder.toObject() : null,
    });
  } catch (err: unknown) {
    console.error('[phoneScanner.resultToEntity] error:', err);
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/* ───────────── Admin ───────────── */

/**
 * GET /api/phone-scanner/admin/settings
 */
export async function getAdminSettings(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await getPhoneScannerSettings();
    res.json({ settings });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * PUT /api/phone-scanner/admin/settings
 */
export async function updateAdminSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await getPhoneScannerSettings();
    const updatable = [
      'maxDailyChecksGlobal',
      'maxDailyChecksPerUser',
      'minDelayMs',
      'maxDelayMs',
      'combinationsWarnThreshold',
      'combinationsBlockThreshold',
      'resultsTtlDays',
    ] as const;

    for (const key of updatable) {
      if (typeof req.body?.[key] === 'number' && req.body[key] >= 0) {
        (settings as unknown as Record<string, number>)[key] = req.body[key];
      }
    }
    await settings.save();

    const { ip, ua } = getRequestMeta(req);
    await logActivity(req.user!.userId, 'phone-scanner.settings.update', 'system', null, {
      changes: req.body,
    }, ip, ua);

    res.json({ settings });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}

/**
 * GET /api/phone-scanner/admin/stats
 */
export async function getAdminStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await getPhoneScannerSettings();
    const activeScansCount = await PhoneScan.countDocuments({ status: 'running' });
    const queuedScansCount = await PhoneScan.countDocuments({ status: 'queued' });
    const last24h = new Date(Date.now() - 24 * 3600 * 1000);
    const recentScansCount = await PhoneScan.countDocuments({ createdAt: { $gte: last24h } });

    const topUsers = await PhoneScan.aggregate([
      { $match: { createdAt: { $gte: last24h } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          count: 1,
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          _id: 0,
        },
      },
    ]);

    res.json({
      globalDailyCounter: settings.globalDailyCounter,
      maxDailyChecksGlobal: settings.maxDailyChecksGlobal,
      maxDailyChecksPerUser: settings.maxDailyChecksPerUser,
      activeScansCount,
      queuedScansCount,
      recentScansCount,
      topUsers,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
  }
}
