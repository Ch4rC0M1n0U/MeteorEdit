import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNodeEvidence,
  verifyNodeIntegrity,
  getDossierEvidence,
  exportEvidenceCertificate,
} from '../controllers/evidenceController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/nodes/{nodeId}/evidence:
 *   get:
 *     tags: [Evidence]
 *     summary: Obtenir le certificat d'integrite d'un node
 *     description: Retourne le dernier EvidenceRecord du node (hash SHA-256, timestamp, verifications).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record d'integrite
 *       404:
 *         description: Node ou record non trouve
 */
router.get('/nodes/:nodeId/evidence', getNodeEvidence);

/**
 * @swagger
 * /api/nodes/{nodeId}/evidence/verify:
 *   post:
 *     tags: [Evidence]
 *     summary: Verifier l'integrite d'un fichier
 *     description: Recalcule le hash SHA-256 du fichier sur disque et compare avec le hash original.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultat de la verification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [valid, tampered, missing]
 *                 computedHash:
 *                   type: string
 *                 originalHash:
 *                   type: string
 *                 match:
 *                   type: boolean
 *       404:
 *         description: Node ou record non trouve
 */
router.post('/nodes/:nodeId/evidence/verify', verifyNodeIntegrity);

/**
 * @swagger
 * /api/nodes/{nodeId}/evidence/certificate:
 *   get:
 *     tags: [Evidence]
 *     summary: Exporter le certificat d'integrite en PDF
 *     description: Genere et telecharge un PDF de certificat d'integrite de preuve numerique.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Node ou record non trouve
 */
router.get('/nodes/:nodeId/evidence/certificate', exportEvidenceCertificate);

/**
 * @swagger
 * /api/dossiers/{id}/evidence:
 *   get:
 *     tags: [Evidence]
 *     summary: Lister toutes les preuves d'un dossier
 *     description: Retourne tous les EvidenceRecords du dossier avec les infos des nodes associes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des records d'integrite
 *       403:
 *         description: Acces refuse
 */
router.get('/dossiers/:id/evidence', getDossierEvidence);

export default router;
