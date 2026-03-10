import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from '../controllers/reportTemplateController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/report-templates:
 *   get:
 *     tags: [ReportTemplates]
 *     summary: Lister les modeles de rapport
 *     description: Retourne les modeles de l'utilisateur et les modeles partages.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Modeles et prompt par defaut
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportTemplate'
 *                 defaultPrompt:
 *                   type: string
 *   post:
 *     tags: [ReportTemplates]
 *     summary: Creer un modele de rapport
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, prompt]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               prompt:
 *                 type: string
 *               isShared:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Modele cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportTemplate'
 *       400:
 *         description: Titre et prompt requis
 */
router.get('/', listReportTemplates);
router.post('/', createReportTemplate);

/**
 * @swagger
 * /api/report-templates/{id}:
 *   put:
 *     tags: [ReportTemplates]
 *     summary: Mettre a jour un modele de rapport
 *     description: Seul le proprietaire peut modifier son modele.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               prompt:
 *                 type: string
 *               isShared:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Modele mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportTemplate'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Modele non trouve
 *   delete:
 *     tags: [ReportTemplates]
 *     summary: Supprimer un modele de rapport
 *     description: Seul le proprietaire peut supprimer son modele.
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
 *         description: Modele supprime
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Modele non trouve
 */
router.put('/:id', updateReportTemplate);
router.delete('/:id', deleteReportTemplate);

export default router;
