import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';
import {
  getNodes, getNode, createNode, updateNode,
  deleteNode, moveNode, duplicateNode, uploadFile, uploadImage, deleteUploadedFile, mentionUser,
  getTrash, restoreNode, purgeNode, emptyTrash, viewNode,
} from '../controllers/nodeController';
import { getComments, createComment, deleteComment, getCommentCount } from '../controllers/commentController';
import { serveFile } from '../controllers/fileController';

const router = Router();
router.use(authenticate);

router.get('/files/:filename', serveFile);

/**
 * @swagger
 * /api/dossiers/{id}/nodes:
 *   get:
 *     tags: [Nodes]
 *     summary: Lister les noeuds d'un dossier
 *     description: Retourne tous les noeuds non supprimes du dossier, tries par ordre.
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
 *         description: Liste des noeuds
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *   post:
 *     tags: [Nodes]
 *     summary: Creer un noeud dans un dossier
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du dossier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [folder, note, mindmap, document, map, dataset]
 *               title:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *               content:
 *                 type: object
 *               excalidrawData:
 *                 type: object
 *               mapData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Noeud cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 */
router.get('/dossiers/:id/nodes', getNodes);
router.post('/dossiers/:id/nodes', createNode);

/**
 * @swagger
 * /api/dossiers/{id}/trash:
 *   get:
 *     tags: [Nodes]
 *     summary: Lister les noeuds dans la corbeille
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
 *         description: Noeuds supprimes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *   delete:
 *     tags: [Nodes]
 *     summary: Vider la corbeille du dossier
 *     description: Supprime definitivement tous les noeuds de la corbeille.
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
 *         description: Corbeille videe
 *       403:
 *         description: Acces refuse
 */
router.get('/dossiers/:id/trash', getTrash);
router.delete('/dossiers/:id/trash', emptyTrash);

/**
 * @swagger
 * /api/nodes/{nodeId}:
 *   put:
 *     tags: [Nodes]
 *     summary: Mettre a jour un noeud
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
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
 *               content:
 *                 type: object
 *               excalidrawData:
 *                 type: object
 *               mapData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Noeud mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 *   delete:
 *     tags: [Nodes]
 *     summary: Supprimer un noeud (corbeille)
 *     description: Deplace le noeud et ses enfants dans la corbeille (soft delete).
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
 *         description: Noeud deplace dans la corbeille
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.get('/nodes/:nodeId', getNode);
router.put('/nodes/:nodeId', updateNode);
router.post('/nodes/:nodeId/view', viewNode);
router.delete('/nodes/:nodeId', deleteNode);

/**
 * @swagger
 * /api/nodes/{nodeId}/move:
 *   patch:
 *     tags: [Nodes]
 *     summary: Deplacer un noeud
 *     description: Change le parent et/ou l'ordre d'un noeud. Reordonne automatiquement les freres.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
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
 *               parentId:
 *                 type: string
 *                 nullable: true
 *               order:
 *                 type: number
 *     responses:
 *       200:
 *         description: Noeud deplace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.patch('/nodes/:nodeId/move', moveNode);

/**
 * @swagger
 * /api/nodes/{nodeId}/duplicate:
 *   post:
 *     tags: [Nodes]
 *     summary: Dupliquer un noeud avec son contenu
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Noeud duplique
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.post('/nodes/:nodeId/duplicate', duplicateNode);

/**
 * @swagger
 * /api/nodes/{nodeId}/restore:
 *   patch:
 *     tags: [Nodes]
 *     summary: Restaurer un noeud depuis la corbeille
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
 *         description: Noeud restaure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.patch('/nodes/:nodeId/restore', restoreNode);

/**
 * @swagger
 * /api/nodes/{nodeId}/purge:
 *   delete:
 *     tags: [Nodes]
 *     summary: Supprimer definitivement un noeud
 *     description: Supprime le noeud et tous ses enfants de facon permanente.
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
 *         description: Noeud supprime definitivement
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.delete('/nodes/:nodeId/purge', purgeNode);

/**
 * @swagger
 * /api/nodes/{nodeId}/upload:
 *   post:
 *     tags: [Nodes]
 *     summary: Uploader un fichier pour un noeud document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
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
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Fichier uploade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DossierNode'
 *       400:
 *         description: Aucun fichier fourni
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.post('/nodes/:nodeId/upload', upload.single('file'), uploadFile);

/**
 * @swagger
 * /api/nodes/{nodeId}/mention:
 *   post:
 *     tags: [Nodes]
 *     summary: Mentionner un utilisateur dans un noeud
 *     description: Envoie une notification a l'utilisateur mentionne.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentionedUserId]
 *             properties:
 *               mentionedUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mention envoyee
 *       400:
 *         description: mentionedUserId requis
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Noeud non trouve
 */
router.post('/nodes/:nodeId/mention', mentionUser);

/**
 * @swagger
 * /api/nodes/{nodeId}/comments:
 *   get:
 *     tags: [Comments]
 *     summary: Lister les commentaires d'un noeud
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
 *         description: Liste des commentaires
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *   post:
 *     tags: [Comments]
 *     summary: Ajouter un commentaire a un noeud
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Commentaire cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Contenu requis
 */
router.get('/nodes/:nodeId/comments', getComments);
router.post('/nodes/:nodeId/comments', createComment);

/**
 * @swagger
 * /api/nodes/{nodeId}/comments/count:
 *   get:
 *     tags: [Comments]
 *     summary: Nombre de commentaires d'un noeud
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
 *         description: Nombre de commentaires
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 */
router.get('/nodes/:nodeId/comments/count', getCommentCount);

/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     tags: [Comments]
 *     summary: Supprimer un commentaire
 *     description: L'auteur ou un admin peut supprimer le commentaire.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commentaire supprime
 *       403:
 *         description: Non autorise
 *       404:
 *         description: Commentaire non trouve
 */
router.delete('/comments/:commentId', deleteComment);

/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     tags: [Nodes]
 *     summary: Uploader une image (editeur/Excalidraw)
 *     description: Upload une image pour insertion dans l'editeur TipTap ou Excalidraw.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploadee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       400:
 *         description: Aucun fichier fourni
 */
router.post('/upload/image', upload.single('image'), uploadImage);

/**
 * @swagger
 * /api/upload/{filename}:
 *   delete:
 *     tags: [Nodes]
 *     summary: Supprimer un fichier uploade
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier supprime
 */
router.delete('/upload/*filepath', deleteUploadedFile);

export default router;
