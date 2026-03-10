import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import EvidenceRecord from '../models/EvidenceRecord';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { computeFileHash } from '../utils/hashFile';
import { logActivity } from '../utils/activityLogger';
import { generateEvidenceCertificate } from '../utils/certificateGenerator';
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

    const record = await EvidenceRecord.findOne({ nodeId: req.params.nodeId })
      .sort({ capturedAt: -1 })
      .populate('capturedBy', 'firstName lastName');

    if (!record) return res.status(404).json({ error: 'No evidence record' });
    res.json(record);
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
    if (!record) return res.status(404).json({ error: 'No evidence record' });

    let status: 'valid' | 'tampered' | 'missing';
    let computedHash: string | null = null;

    let resolvedPath = record.filePath;
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(process.cwd(), resolvedPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      status = 'missing';
    } else {
      computedHash = await computeFileHash(resolvedPath);
      status = computedHash === record.fileHash ? 'valid' : 'tampered';
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

// GET /api/nodes/:nodeId/evidence/certificate
export async function exportEvidenceCertificate(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const node = await DossierNode.findById(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    if (!(await checkAccess(req, node.dossierId.toString()))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dossier = await Dossier.findById(node.dossierId);
    if (!dossier) return res.status(404).json({ error: 'Dossier not found' });

    const record = await EvidenceRecord.findOne({ nodeId: req.params.nodeId })
      .sort({ capturedAt: -1 })
      .populate('capturedBy', 'firstName lastName');
    if (!record) return res.status(404).json({ error: 'No evidence record' });

    const pdfBuffer = await generateEvidenceCertificate(
      record as any,
      { title: node.title, type: node.type },
      { title: dossier.title }
    );

    await logActivity(userId, 'evidence.certificate_exported', 'node', node._id.toString(), { nodeTitle: node.title }, getIp(req));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificat-integrite-${node._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('exportEvidenceCertificate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
