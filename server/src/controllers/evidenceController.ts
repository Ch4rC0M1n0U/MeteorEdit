import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import EvidenceRecord from '../models/EvidenceRecord';

import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { computeFileHash } from '../utils/hashFile';
import { logActivity } from '../utils/activityLogger';
import fs from 'fs';
import path from 'path';

function getIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
}

async function checkAccess(req: AuthRequest, dossierId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  const userId = req.user!.userId;
  const isOwner = dossier.owner.toString() === userId;
  const isCollab = dossier.collaborators.some((c: any) => c.toString() === userId);
  return isOwner || isCollab;
}

// GET /api/nodes/:nodeId/evidence
export async function getNodeEvidence(req: AuthRequest, res: Response) {
  try {
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ nodeId: req.params.nodeId })
      .sort({ capturedAt: -1 })
      .populate('capturedBy', 'firstName lastName');

    if (!records.length) return res.status(404).json({ error: 'No evidence record' });
    res.json(records);
  } catch (err) {
    console.error('getNodeEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/nodes/:nodeId/evidence/verify
export async function verifyNodeIntegrity(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const record = await EvidenceRecord.findOne({ nodeId: req.params.nodeId })
      .sort({ capturedAt: -1 });
    if (!record) {
      return res.status(404).json({ error: 'No evidence record' });
    }

    let status: 'valid' | 'tampered' | 'missing' | 'enriched';
    let computedHash: string | null = null;

    let resolvedPath = record.filePath;
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(process.cwd(), resolvedPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      status = 'missing';
    } else {
      computedHash = await computeFileHash(resolvedPath);
      if (computedHash === record.fileHash) {
        // File matches current hash — check if it was enriched (hash differs from original)
        status = (record.originalHash && record.fileHash !== record.originalHash) ? 'enriched' : 'valid';
      } else {
        status = 'tampered';
      }
    }

    // Backfill originalHash for old records that don't have it
    if (!record.originalHash) {
      await EvidenceRecord.updateOne(
        { _id: record._id, originalHash: null },
        { $set: { originalHash: record.fileHash } },
      );
      record.set('originalHash', record.fileHash, { strict: false });
    }

    record.verifications.push({
      verifiedAt: new Date(),
      verifiedBy: userId as any,
      status,
      computedHash,
    });
    record.lastVerifiedAt = new Date();
    record.lastVerificationStatus = status;
    await record.save();

    node.set('hashVerifiedAt', new Date());
    node.set('lastVerificationStatus', status);
    await node.save();

    await logActivity(userId, 'evidence.verified', 'node', node._id.toString(), { status, nodeTitle: node.title }, getIp(req));

    res.json({ status, computedHash, originalHash: record.fileHash, match: status === 'valid' });
  } catch (err) {
    console.error('verifyNodeIntegrity error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/dossiers/:id/evidence
export async function getDossierEvidence(req: AuthRequest, res: Response) {
  try {
    const dossierId = req.params.id as string;
    if (!(await checkAccess(req, dossierId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ dossierId })
      .sort({ capturedAt: -1 })
      .populate('capturedBy', 'firstName lastName')
      .populate('nodeId', 'title type');

    res.json(records);
  } catch (err) {
    console.error('getDossierEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /api/dossiers/:id/evidence/purge-missing
export async function purgeMissingEvidence(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const dossierId = req.params.id as string;
    if (!(await checkAccess(req, dossierId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ dossierId });
    let purged = 0;

    for (const record of records) {
      let resolvedPath = record.filePath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(process.cwd(), resolvedPath);
      }
      if (!fs.existsSync(resolvedPath)) {
        await EvidenceRecord.deleteOne({ _id: record._id });
        purged++;
      }
    }

    if (purged > 0) {
      await logActivity(userId, 'evidence.purge_missing', 'dossier', dossierId, {
        purged,
        total: records.length,
      }, getIp(req));
    }

    res.json({ purged, remaining: records.length - purged });
  } catch (err) {
    console.error('purgeMissingEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/dossiers/:id/evidence/verify-all
export async function verifyAllDossierEvidence(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const dossierId = req.params.id as string;
    if (!(await checkAccess(req, dossierId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ dossierId });
    if (!records.length) return res.status(404).json({ error: 'No evidence records' });

    const results: { id: string; status: string }[] = [];

    for (const record of records) {
      let status: 'valid' | 'tampered' | 'missing' | 'enriched';
      let computedHash: string | null = null;

      let resolvedPath = record.filePath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(process.cwd(), resolvedPath);
      }

      if (!fs.existsSync(resolvedPath)) {
        status = 'missing';
      } else {
        computedHash = await computeFileHash(resolvedPath);
        if (computedHash === record.fileHash) {
          status = (record.originalHash && record.fileHash !== record.originalHash) ? 'enriched' : 'valid';
        } else {
          status = 'tampered';
        }
      }

      // Backfill originalHash for old records
      if (!record.originalHash) {
        await EvidenceRecord.updateOne(
          { _id: record._id, originalHash: null },
          { $set: { originalHash: record.fileHash } },
        );
        record.set('originalHash', record.fileHash, { strict: false });
      }

      record.verifications.push({
        verifiedAt: new Date(),
        verifiedBy: userId as any,
        status,
        computedHash,
      });
      record.lastVerifiedAt = new Date();
      record.lastVerificationStatus = status;
      await record.save();

      results.push({ id: record._id.toString(), status });
    }

    const hasT = results.some(r => r.status === 'tampered');
    const hasM = results.some(r => r.status === 'missing');
    const allV = results.every(r => r.status === 'valid');
    const worstStatus = hasT ? 'tampered' : hasM ? 'missing' : allV ? 'valid' : null;

    await logActivity(userId, 'evidence.verified_all_dossier', 'dossier', dossierId, {
      count: records.length,
      worstStatus,
    }, getIp(req));

    res.json({ results, worstStatus, total: records.length });
  } catch (err) {
    console.error('verifyAllDossierEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/nodes/:nodeId/evidence/verify-all
export async function verifyAllNodeEvidence(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ nodeId: req.params.nodeId });
    if (!records.length) return res.status(404).json({ error: 'No evidence records' });

    const results: { id: string; status: string }[] = [];

    for (const record of records) {
      let status: 'valid' | 'tampered' | 'missing' | 'enriched';
      let computedHash: string | null = null;

      let resolvedPath = record.filePath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(process.cwd(), resolvedPath);
      }

      if (!fs.existsSync(resolvedPath)) {
        status = 'missing';
      } else {
        computedHash = await computeFileHash(resolvedPath);
        if (computedHash === record.fileHash) {
          status = (record.originalHash && record.fileHash !== record.originalHash) ? 'enriched' : 'valid';
        } else {
          status = 'tampered';
        }
      }

      // Backfill originalHash for old records
      if (!record.originalHash) {
        await EvidenceRecord.updateOne(
          { _id: record._id, originalHash: null },
          { $set: { originalHash: record.fileHash } },
        );
        record.set('originalHash', record.fileHash, { strict: false });
      }

      record.verifications.push({
        verifiedAt: new Date(),
        verifiedBy: userId as any,
        status,
        computedHash,
      });
      record.lastVerifiedAt = new Date();
      record.lastVerificationStatus = status;
      await record.save();

      results.push({ id: record._id.toString(), status });
    }

    // Update node with worst status
    const hasT = results.some(r => r.status === 'tampered');
    const hasM = results.some(r => r.status === 'missing');
    const allV = results.every(r => r.status === 'valid');
    const worstStatus = hasT ? 'tampered' : hasM ? 'missing' : allV ? 'valid' : null;

    node.set('hashVerifiedAt', new Date());
    node.set('lastVerificationStatus', worstStatus);
    await node.save();

    await logActivity(userId, 'evidence.verified_all', 'node', node._id.toString(), {
      nodeTitle: node.title,
      count: records.length,
      worstStatus,
    }, getIp(req));

    res.json({ results, worstStatus });
  } catch (err) {
    console.error('verifyAllNodeEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/nodes/:nodeId/evidence/client-verify
export async function clientVerifyIntegrity(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { nodeId } = req.params;
    const { computedHash } = req.body;

    if (!computedHash) {
      res.status(400).json({ error: 'computedHash required' });
      return;
    }

    const node = await DossierNode.findById(nodeId);
    if (!node) { res.status(404).json({ error: 'Node not found' }); return; }
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const evidence = await EvidenceRecord.findOne({ nodeId }).sort({ capturedAt: -1 });
    if (!evidence) {
      res.status(404).json({ error: 'No evidence record found' });
      return;
    }

    // Compare client-computed hash with stored original
    let status: 'valid' | 'tampered' | 'enriched';
    if (computedHash === evidence.originalHash) {
      status = 'valid';
    } else if (computedHash === evidence.fileHash && evidence.fileHash !== evidence.originalHash) {
      status = 'enriched';
    } else {
      status = 'tampered';
    }

    evidence.verifications.push({
      verifiedAt: new Date(),
      verifiedBy: userId as any,
      status,
      computedHash,
    });
    evidence.lastVerifiedAt = new Date();
    evidence.lastVerificationStatus = status;
    await evidence.save();

    node.set('hashVerifiedAt', new Date());
    node.set('lastVerificationStatus', status);
    await node.save();

    await logActivity(userId, 'evidence.client_verified', 'node', node._id.toString(), { status, nodeTitle: node.title }, getIp(req));

    res.json({ status, originalHash: evidence.originalHash, computedHash });
  } catch (err) {
    console.error('clientVerifyIntegrity error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/nodes/:nodeId/evidence/rehash
export async function rehashNodeEvidence(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await EvidenceRecord.find({ nodeId: req.params.nodeId });
    if (!records.length) return res.status(404).json({ error: 'No evidence records' });

    let updated = 0;

    for (const record of records) {
      let resolvedPath = record.filePath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(process.cwd(), resolvedPath);
      }

      if (!fs.existsSync(resolvedPath)) continue;

      const newHash = await computeFileHash(resolvedPath);
      if (newHash !== record.fileHash) {
        // Backfill originalHash for old records
        if (!record.originalHash) {
          await EvidenceRecord.updateOne(
            { _id: record._id, originalHash: null },
            { $set: { originalHash: record.fileHash } },
          );
          record.set('originalHash', record.fileHash, { strict: false });
        }
        record.fileHash = newHash;
        record.fileSize = fs.statSync(resolvedPath).size;
        record.verifications.push({
          verifiedAt: new Date(),
          verifiedBy: userId as any,
          status: 'enriched',
          computedHash: newHash,
        });
        record.lastVerifiedAt = new Date();
        record.lastVerificationStatus = 'enriched';
        await record.save();
        updated++;
      }
    }

    if (updated > 0) {
      node.set('hashVerifiedAt', new Date());
      node.set('lastVerificationStatus', 'enriched');
      await node.save();

      await logActivity(userId, 'evidence.rehashed', 'node', node._id.toString(), {
        nodeTitle: node.title,
        updated,
      }, getIp(req));
    }

    res.json({ updated, total: records.length });
  } catch (err) {
    console.error('rehashNodeEvidence error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

