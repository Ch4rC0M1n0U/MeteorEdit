import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { exportJSON } from '../controllers/exportController';

const router = Router();

/**
 * @swagger
 * /api/dossiers/{id}/export/json:
 *   get:
 *     tags: [Export]
 *     summary: Exporter un dossier en JSON
 *     description: Telecharge le dossier et tous ses noeuds au format JSON.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du dossier
 *     responses:
 *       200:
 *         description: Fichier JSON du dossier
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dossier:
 *                   $ref: '#/components/schemas/Dossier'
 *                 nodes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DossierNode'
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Dossier non trouve
 */
router.get('/dossiers/:id/export/json', authenticate, exportJSON);

export default router;
