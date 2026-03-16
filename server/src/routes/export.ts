import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { exportJSON, importJSON, importElephantastic } from '../controllers/exportController';

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

/**
 * @swagger
 * /api/dossiers/import/json:
 *   post:
 *     tags: [Export]
 *     summary: Importer un dossier depuis un fichier JSON
 *     description: Cree un nouveau dossier a partir d'un export JSON precedent.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossier]
 *             properties:
 *               dossier:
 *                 type: object
 *               nodes:
 *                 type: array
 *               version:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dossier importe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       400:
 *         description: Donnees invalides
 */
router.post('/dossiers/import/json', authenticate, importJSON);

/**
 * @swagger
 * /api/dossiers/{id}/import-elephantastic:
 *   post:
 *     tags: [Export]
 *     summary: Importer des donnees Elephantastic
 *     description: Cree un dossier avec des notes a partir d'un export Elephantastic JSON.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du dossier cible
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityName, items]
 *             properties:
 *               entityName:
 *                 type: string
 *               items:
 *                 type: array
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Import reussi
 *       400:
 *         description: Donnees invalides
 */
router.post('/dossiers/:id/import-elephantastic', authenticate, importElephantastic);

export default router;
