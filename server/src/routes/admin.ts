import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { listUsers, updateUser, deleteUser, resetUserPassword, resetUser2FA, getAuditLogs, getAuditStats } from '../controllers/adminController';
import { updateSettings, uploadLogo, deleteLogo, uploadFavicon, deleteFavicon, uploadLoginBackground, deleteLoginBackground, testEmail } from '../controllers/settingsController';
import { exportBackup, importBackup, getStorageInfo } from '../controllers/backupController';
import { getStats } from '../controllers/statsController';
import { getPluginSettings, updatePluginSettings } from '../controllers/pluginSettingsController';
import { listOllamaModels, pullOllamaModel, cancelPullOllamaModel, deleteOllamaModel, updateOllamaSettings } from '../controllers/aiController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Lister tous les utilisateurs
 *     description: Retourne la liste de tous les utilisateurs (admin uniquement).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifie
 *       403:
 *         description: Acces admin requis
 */
router.get('/users', listUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier un utilisateur
 *     description: Permet d'activer/desactiver un compte, changer le role, modifier les infos.
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
 *               isActive:
 *                 type: boolean
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Utilisateur mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Email deja utilise
 *       404:
 *         description: Utilisateur non trouve
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer un utilisateur
 *     description: Supprime definitivement un utilisateur. Impossible de se supprimer soi-meme.
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
 *         description: Utilisateur supprime
 *       400:
 *         description: Impossible de se supprimer soi-meme
 *       404:
 *         description: Utilisateur non trouve
 */
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Reinitialiser le mot de passe d'un utilisateur
 *     description: Genere un mot de passe temporaire aleatoire.
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
 *         description: Mot de passe reinitialise
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tempPassword:
 *                   type: string
 *       404:
 *         description: Utilisateur non trouve
 */
router.post('/users/:id/reset-password', resetUserPassword);

/**
 * @swagger
 * /api/admin/users/{id}/reset-2fa:
 *   post:
 *     tags: [Admin]
 *     summary: Reinitialiser le 2FA d'un utilisateur
 *     description: Desactive le 2FA et supprime le secret et les codes de secours.
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
 *         description: 2FA reinitialise
 *       404:
 *         description: Utilisateur non trouve
 */
router.post('/users/:id/reset-2fa', resetUser2FA);

/**
 * @swagger
 * /api/admin/settings:
 *   put:
 *     tags: [Admin]
 *     summary: Mettre a jour les parametres du site
 *     description: Modifie les parametres de branding, securite et maintenance.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appName:
 *                 type: string
 *               accentColor:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *               loginMessage:
 *                 type: string
 *               require2FA:
 *                 type: boolean
 *               maintenanceMode:
 *                 type: boolean
 *               maintenanceMessage:
 *                 type: string
 *               registrationEnabled:
 *                 type: boolean
 *               sessionTimeoutMinutes:
 *                 type: number
 *               passwordMinLength:
 *                 type: number
 *               passwordRequireUppercase:
 *                 type: boolean
 *               passwordRequireNumber:
 *                 type: boolean
 *               passwordRequireSpecial:
 *                 type: boolean
 *               maxLoginAttempts:
 *                 type: number
 *               lockoutDurationMinutes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Parametres mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSettings'
 */
router.put('/settings', updateSettings);

/**
 * @swagger
 * /api/admin/settings/logo:
 *   post:
 *     tags: [Admin]
 *     summary: Uploader le logo du site
 *     security:
 *       - bearerAuth: []
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
 *               $ref: '#/components/schemas/SiteSettings'
 *       400:
 *         description: Aucun fichier fourni
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer le logo du site
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logo supprime
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSettings'
 */
router.post('/settings/logo', upload.single('logo'), uploadLogo);
router.delete('/settings/logo', deleteLogo);

/**
 * @swagger
 * /api/admin/settings/favicon:
 *   post:
 *     tags: [Admin]
 *     summary: Uploader le favicon du site
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               favicon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Favicon uploade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSettings'
 *       400:
 *         description: Aucun fichier fourni
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer le favicon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favicon supprime
 */
router.post('/settings/favicon', upload.single('favicon'), uploadFavicon);
router.delete('/settings/favicon', deleteFavicon);

/**
 * @swagger
 * /api/admin/settings/login-background:
 *   post:
 *     tags: [Admin]
 *     summary: Uploader l'image de fond de la page de connexion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               loginBackground:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploadee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSettings'
 *       400:
 *         description: Aucun fichier fourni
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer l'image de fond de la page de connexion
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Image supprimee
 */
router.post('/settings/login-background', upload.single('loginBackground'), uploadLoginBackground);
router.delete('/settings/login-background', deleteLoginBackground);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Obtenir les statistiques globales
 *     description: Statistiques sur les utilisateurs, dossiers, connexions.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                 activeUsers:
 *                   type: number
 *                 onlineCount:
 *                   type: number
 *                 totalDossiers:
 *                   type: number
 *                 weeklyDossiers:
 *                   type: number
 *                 statusDistribution:
 *                   type: array
 *                   items:
 *                     type: object
 *                 dossiersPerUser:
 *                   type: array
 *                   items:
 *                     type: object
 *                 loginsPerDay:
 *                   type: array
 *                   items:
 *                     type: object
 *                 recentLogins:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/stats', getStats);

// Email
router.post('/settings/test-email', testEmail);

// Backup & Storage
router.get('/backup/export', exportBackup);
router.post('/backup/import', upload.single('backup'), importBackup);
router.get('/storage-info', getStorageInfo);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Obtenir les logs d'audit
 *     description: Logs d'activite avec pagination et filtres.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filtrer par utilisateur
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filtrer par action
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [dossier, user, system, node]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche dans action, IP, metadata
 *     responses:
 *       200:
 *         description: Logs d'audit pagines
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 limit:
 *                   type: number
 */
router.get('/audit-logs', getAuditLogs);

/**
 * @swagger
 * /api/admin/audit-stats:
 *   get:
 *     tags: [Admin]
 *     summary: Statistiques des logs d'audit
 *     description: Compteurs d'activite du jour et de la semaine, top utilisateurs et actions.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques d'audit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 today:
 *                   type: number
 *                 week:
 *                   type: number
 *                 topUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 topActions:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/audit-stats', getAuditStats);

/**
 * @swagger
 * /api/admin/plugins:
 *   get:
 *     tags: [Admin]
 *     summary: Obtenir les parametres des plugins
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parametres des plugins
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PluginSettings'
 *   put:
 *     tags: [Admin]
 *     summary: Mettre a jour les parametres des plugins
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mapbox:
 *                 type: object
 *                 properties:
 *                   apiKey:
 *                     type: string
 *                   defaultStyle:
 *                     type: string
 *                   defaultCenter:
 *                     type: array
 *                     items:
 *                       type: number
 *                   defaultZoom:
 *                     type: number
 *     responses:
 *       200:
 *         description: Parametres mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PluginSettings'
 */
router.get('/plugins', getPluginSettings);
router.put('/plugins', updatePluginSettings);

/**
 * @swagger
 * /api/admin/ai/models:
 *   get:
 *     tags: [Admin]
 *     summary: Lister les modeles Ollama disponibles
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
 *                 type: object
 *       502:
 *         description: Impossible de contacter Ollama
 */
router.get('/ai/models', listOllamaModels);

/**
 * @swagger
 * /api/admin/ai/models/pull:
 *   post:
 *     tags: [Admin]
 *     summary: Telecharger un modele Ollama (SSE)
 *     description: Lance le telechargement d'un modele avec progression en Server-Sent Events.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [model]
 *             properties:
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flux SSE de progression
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Nom du modele requis
 */
router.post('/ai/models/pull', pullOllamaModel);

/**
 * @swagger
 * /api/admin/ai/models/pull/cancel:
 *   post:
 *     tags: [Admin]
 *     summary: Annuler le telechargement d'un modele
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [model]
 *             properties:
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Annulation en cours
 *       404:
 *         description: Aucun telechargement actif
 */
router.post('/ai/models/pull/cancel', cancelPullOllamaModel);

/**
 * @swagger
 * /api/admin/ai/models/{name}:
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer un modele Ollama
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du modele
 *     responses:
 *       200:
 *         description: Modele supprime
 *       502:
 *         description: Erreur de suppression
 */
router.delete('/ai/models/:name', deleteOllamaModel);

/**
 * @swagger
 * /api/admin/ai/settings:
 *   put:
 *     tags: [Admin]
 *     summary: Mettre a jour les parametres IA (Ollama)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseUrl:
 *                 type: string
 *               selectedModel:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               reportPrompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Parametres IA mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 baseUrl:
 *                   type: string
 *                 selectedModel:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *                 reportPrompt:
 *                   type: string
 */
router.put('/ai/settings', updateOllamaSettings);

export default router;
