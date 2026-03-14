import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNodeEvidence,
  verifyNodeIntegrity,
  verifyAllNodeEvidence,
  verifyAllDossierEvidence,
  purgeMissingEvidence,
  getDossierEvidence,
  rehashNodeEvidence,
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
 * /api/nodes/{nodeId}/evidence/verify-all:
 *   post:
 *     tags: [Evidence]
 *     summary: Verifier l'integrite de toutes les preuves d'un node
 *     description: Recalcule le hash SHA-256 de tous les fichiers associes au node.
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
 *         description: Resultats de verification groupee
 *       404:
 *         description: Node ou records non trouves
 */
router.post('/nodes/:nodeId/evidence/verify-all', verifyAllNodeEvidence);

/**
 * @swagger
 * /api/nodes/{nodeId}/evidence/rehash:
 *   post:
 *     tags: [Evidence]
 *     summary: Re-certifier les preuves apres enrichissement
 *     description: Recalcule le hash SHA-256 des fichiers modifies via l'application et met a jour le statut en 'enriched'.
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
 *         description: Nombre de preuves mises a jour
 *       404:
 *         description: Node ou records non trouves
 */
router.post('/nodes/:nodeId/evidence/rehash', rehashNodeEvidence);

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

/**
 * @swagger
 * /api/dossiers/{id}/evidence/verify-all:
 *   post:
 *     tags: [Evidence]
 *     summary: Verifier l'integrite de toutes les preuves d'un dossier
 *     description: Recalcule le hash SHA-256 de tous les fichiers du dossier.
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
 *         description: Resultats de verification groupee
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Aucune preuve trouvee
 */
router.post('/dossiers/:id/evidence/verify-all', verifyAllDossierEvidence);

/**
 * @swagger
 * /api/dossiers/{id}/evidence/purge-missing:
 *   delete:
 *     tags: [Evidence]
 *     summary: Supprimer les preuves dont le fichier n'existe plus
 *     description: Supprime les EvidenceRecords dont le fichier source a ete supprime du disque.
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
 *         description: Nombre de preuves supprimees
 *       403:
 *         description: Acces refuse
 */
router.delete('/dossiers/:id/evidence/purge-missing', purgeMissingEvidence);

export default router;
