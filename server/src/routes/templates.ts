import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resolveTemplate,
  getAvailablePlaceholders,
} from '../controllers/templateController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/templates:
 *   get:
 *     tags: [Templates]
 *     summary: Lister les modeles de notes
 *     description: Retourne les modeles de notes de l'utilisateur connecte.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des modeles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NoteTemplate'
 *   post:
 *     tags: [Templates]
 *     summary: Creer un modele de note
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: object
 *                 description: Contenu TipTap JSON
 *     responses:
 *       201:
 *         description: Modele cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteTemplate'
 *       400:
 *         description: Titre requis
 */
router.get('/', getTemplates);

/**
 * @swagger
 * /api/templates/placeholders:
 *   get:
 *     tags: [Templates]
 *     summary: Obtenir les placeholders disponibles
 *     description: Retourne la liste des placeholders utilisables dans les modeles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des placeholders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                   label:
 *                     type: string
 */
router.get('/placeholders', getAvailablePlaceholders);

/**
 * @swagger
 * /api/templates/{id}:
 *   get:
 *     tags: [Templates]
 *     summary: Obtenir un modele par ID
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
 *         description: Detail du modele
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteTemplate'
 *       404:
 *         description: Modele non trouve
 *   put:
 *     tags: [Templates]
 *     summary: Mettre a jour un modele
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
 *               content:
 *                 type: object
 *     responses:
 *       200:
 *         description: Modele mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteTemplate'
 *       404:
 *         description: Modele non trouve
 *   delete:
 *     tags: [Templates]
 *     summary: Supprimer un modele
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
 *       404:
 *         description: Modele non trouve
 */
router.get('/:id', getTemplate);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

/**
 * @swagger
 * /api/templates/{id}/resolve:
 *   post:
 *     tags: [Templates]
 *     summary: Resoudre les placeholders d'un modele
 *     description: Remplace les placeholders par les donnees reelles du dossier.
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
 *             required: [dossierId]
 *             properties:
 *               dossierId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contenu avec placeholders resolus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: object
 *       400:
 *         description: dossierId requis
 *       403:
 *         description: Acces refuse au dossier
 *       404:
 *         description: Modele ou dossier non trouve
 */
router.post('/:id/resolve', resolveTemplate);

export default router;
