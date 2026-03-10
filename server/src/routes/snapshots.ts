import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from '../controllers/snapshotController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/nodes/{nodeId}/snapshots:
 *   get:
 *     tags: [Snapshots]
 *     summary: Lister les snapshots d'un noeud
 *     description: Retourne les 50 derniers snapshots du noeud.
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
 *         description: Liste des snapshots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   label:
 *                     type: string
 *                   type:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 *   post:
 *     tags: [Snapshots]
 *     summary: Creer un snapshot du noeud
 *     description: Sauvegarde l'etat actuel du contenu (note ou mindmap).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 description: Label optionnel pour le snapshot
 *     responses:
 *       201:
 *         description: Snapshot cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Snapshot'
 *       400:
 *         description: Aucun contenu a sauvegarder
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.get('/nodes/:nodeId/snapshots', getSnapshots);
router.post('/nodes/:nodeId/snapshots', createSnapshot);

/**
 * @swagger
 * /api/snapshots/{snapshotId}/restore:
 *   post:
 *     tags: [Snapshots]
 *     summary: Restaurer un snapshot
 *     description: Remplace le contenu actuel du noeud par celui du snapshot.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: snapshotId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Noeud restaure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Snapshot ou noeud non trouve
 */
router.post('/snapshots/:snapshotId/restore', restoreSnapshot);

/**
 * @swagger
 * /api/snapshots/{snapshotId}:
 *   delete:
 *     tags: [Snapshots]
 *     summary: Supprimer un snapshot
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: snapshotId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Snapshot supprime
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Snapshot non trouve
 */
router.delete('/snapshots/:snapshotId', deleteSnapshot);

export default router;
