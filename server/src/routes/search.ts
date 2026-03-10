import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { search } from '../controllers/searchController';

const router = Router();

/**
 * @swagger
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Recherche globale
 *     description: Recherche dans les dossiers et les noeuds accessibles par l'utilisateur.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Terme de recherche (min 2 caracteres pour la recherche full-text)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, closed]
 *         description: Filtrer les dossiers par statut
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Tags separes par virgule
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filtrer par proprietaire (ID utilisateur)
 *       - in: query
 *         name: collaborator
 *         schema:
 *           type: string
 *         description: Filtrer par collaborateur (ID utilisateur)
 *       - in: query
 *         name: nodeType
 *         schema:
 *           type: string
 *           enum: [folder, note, mindmap, document, map, dataset]
 *         description: Filtrer les noeuds par type
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, title, date]
 *           default: relevance
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Resultats de recherche
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dossiers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 nodes:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     dossierTotal:
 *                       type: number
 *                     nodeTotal:
 *                       type: number
 *       401:
 *         description: Non authentifie
 */
router.get('/', authenticate, search);

export default router;
