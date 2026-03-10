import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { clipWebContent, getClipDossiers } from '../controllers/clipperController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/clip/dossiers:
 *   get:
 *     tags: [Clipper]
 *     summary: Lister les dossiers disponibles pour le clipper
 *     description: Retourne les dossiers accessibles (max 50) pour selection dans le web clipper.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des dossiers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 */
router.get('/dossiers', getClipDossiers);

/**
 * @swagger
 * /api/clip:
 *   post:
 *     tags: [Clipper]
 *     summary: Clipper du contenu web
 *     description: Capture du contenu web et cree un noeud note avec screenshot dans un dossier.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId, title, content]
 *             properties:
 *               dossierId:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *               title:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               content:
 *                 type: string
 *                 description: Contenu HTML
 *               textContent:
 *                 type: string
 *                 description: Contenu texte brut (optionnel)
 *     responses:
 *       201:
 *         description: Noeud cree avec le contenu clippe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       400:
 *         description: Parametres manquants
 *       403:
 *         description: Acces refuse au dossier
 *       404:
 *         description: Dossier non trouve
 */
router.post('/', clipWebContent);

export default router;
