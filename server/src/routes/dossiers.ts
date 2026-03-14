import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listDossiers, createDossier, getDossier,
  updateDossier, deleteDossier, updateCollaborators, getTags,
  uploadDossierLogo, deleteDossierLogo,
  uploadLinkedDocument, deleteLinkedDocument,
  uploadEntityPhoto, deleteEntityPhoto,
} from '../controllers/dossierController';
import { getUserDashboard, getTaskStats } from '../controllers/dashboardController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/dossiers/dashboard:
 *   get:
 *     tags: [Dossiers]
 *     summary: Obtenir le tableau de bord utilisateur
 *     description: Retourne les statistiques et l'activite recente de l'utilisateur connecte.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donnees du dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDossiers:
 *                   type: number
 *                 ownedDossiers:
 *                   type: number
 *                 collabDossiers:
 *                   type: number
 *                 statusCounts:
 *                   type: object
 *                   properties:
 *                     open:
 *                       type: number
 *                     in_progress:
 *                       type: number
 *                     closed:
 *                       type: number
 *                 totalNodes:
 *                   type: number
 *                 nodeCountsByType:
 *                   type: array
 *                   items:
 *                     type: object
 *                 recentActivity:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 *                 activityPerDay:
 *                   type: array
 *                   items:
 *                     type: object
 *                 recentDossiers:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Non authentifie
 */
router.get('/dashboard', getUserDashboard);
router.get('/dashboard/task-stats', getTaskStats);

/**
 * @swagger
 * /api/dossiers:
 *   get:
 *     tags: [Dossiers]
 *     summary: Lister les dossiers de l'utilisateur
 *     description: Retourne tous les dossiers dont l'utilisateur est proprietaire ou collaborateur.
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
 *                 $ref: '#/components/schemas/Dossier'
 *       401:
 *         description: Non authentifie
 *   post:
 *     tags: [Dossiers]
 *     summary: Creer un nouveau dossier
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
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, closed]
 *               icon:
 *                 type: string
 *               objectives:
 *                 type: string
 *               entities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Entity'
 *               judicialFacts:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               investigator:
 *                 $ref: '#/components/schemas/Investigator'
 *     responses:
 *       201:
 *         description: Dossier cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       401:
 *         description: Non authentifie
 */
router.get('/', listDossiers);
router.post('/', createDossier);

/**
 * @swagger
 * /api/dossiers/tags:
 *   get:
 *     tags: [Dossiers]
 *     summary: Obtenir tous les tags utilises
 *     description: Retourne la liste unique de tous les tags des dossiers accessibles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste de tags
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       401:
 *         description: Non authentifie
 */
router.get('/tags', getTags);

/**
 * @swagger
 * /api/dossiers/{id}:
 *   get:
 *     tags: [Dossiers]
 *     summary: Obtenir un dossier par ID
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
 *         description: Detail du dossier
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Dossier non trouve
 *   put:
 *     tags: [Dossiers]
 *     summary: Mettre a jour un dossier
 *     description: Seul le proprietaire peut modifier le dossier.
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
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, closed]
 *               icon:
 *                 type: string
 *               objectives:
 *                 type: string
 *               entities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Entity'
 *               judicialFacts:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               investigator:
 *                 $ref: '#/components/schemas/Investigator'
 *     responses:
 *       200:
 *         description: Dossier mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       403:
 *         description: Seul le proprietaire peut modifier
 *       404:
 *         description: Dossier non trouve
 *   delete:
 *     tags: [Dossiers]
 *     summary: Supprimer un dossier
 *     description: Supprime le dossier et tous ses noeuds. Seul le proprietaire peut supprimer.
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
 *         description: Dossier supprime
 *       403:
 *         description: Seul le proprietaire peut supprimer
 *       404:
 *         description: Dossier non trouve
 */
router.get('/:id', getDossier);
router.put('/:id', updateDossier);
router.delete('/:id', deleteDossier);

/**
 * @swagger
 * /api/dossiers/{id}/collaborators:
 *   patch:
 *     tags: [Dossiers]
 *     summary: Gerer les collaborateurs d'un dossier
 *     description: Remplace la liste des collaborateurs. Seul le proprietaire peut gerer les collaborateurs.
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
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Liste des IDs utilisateur
 *     responses:
 *       200:
 *         description: Collaborateurs mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       403:
 *         description: Seul le proprietaire peut gerer les collaborateurs
 *       404:
 *         description: Dossier non trouve
 */
router.patch('/:id/collaborators', updateCollaborators);

/**
 * @swagger
 * /api/dossiers/{id}/logo:
 *   post:
 *     tags: [Dossiers]
 *     summary: Uploader le logo du dossier
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       400:
 *         description: Aucun fichier fourni
 *       403:
 *         description: Seul le proprietaire peut modifier
 *       404:
 *         description: Dossier non trouve
 *   delete:
 *     tags: [Dossiers]
 *     summary: Supprimer le logo du dossier
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
 *         description: Logo supprime
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       403:
 *         description: Seul le proprietaire peut modifier
 *       404:
 *         description: Dossier non trouve
 */
router.post('/:id/logo', upload.single('logo'), uploadDossierLogo);
router.delete('/:id/logo', deleteDossierLogo);
router.post('/:id/documents', upload.single('document'), uploadLinkedDocument);
router.delete('/:id/documents/:docId', deleteLinkedDocument);
router.post('/:id/entities/:entityIndex/photo', upload.single('photo'), uploadEntityPhoto);
router.delete('/:id/entities/:entityIndex/photo', deleteEntityPhoto);
export default router;
