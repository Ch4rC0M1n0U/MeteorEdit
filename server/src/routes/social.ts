import { Router } from 'express';
import path from 'path';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { socialLogin, listCookies, deleteCookies, importCookies, generateBridgeToken, uploadCookiesFile } from '../controllers/socialAuthController';
import { scrapeProfile, scanUsername } from '../controllers/scrapeController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

/**
 * @swagger
 * /api/social/login/{platform}:
 *   post:
 *     tags: [Social]
 *     summary: Lancer la connexion sociale via Puppeteer
 *     description: Ouvre un navigateur Puppeteer sur la page de connexion de la plateforme. L'utilisateur dispose de 5 minutes pour se connecter manuellement. Les cookies sont ensuite captures et stockes (chiffres) pour une utilisation ulterieure (scraping, telechargement).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [youtube, instagram, tiktok, snapchat, facebook, x]
 *         description: Plateforme sociale ciblee
 *     responses:
 *       200:
 *         description: Connexion reussie, cookies captures
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 platform:
 *                   type: string
 *                 cookieCount:
 *                   type: integer
 *       400:
 *         description: Plateforme non supportee ou aucun cookie capture
 *       401:
 *         description: Non authentifie
 *       403:
 *         description: Plateforme non activee dans les parametres
 *       408:
 *         description: Connexion expiree ou navigateur ferme
 *       500:
 *         description: Erreur serveur
 */
router.post('/login/:platform', authenticate, socialLogin);

/**
 * @swagger
 * /api/social/cookies:
 *   get:
 *     tags: [Social]
 *     summary: Lister les plateformes avec des cookies actifs
 *     description: Retourne la liste des plateformes pour lesquelles l'utilisateur a des cookies stockes, avec la date de derniere mise a jour.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des cookies par plateforme
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   platform:
 *                     type: string
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Non authentifie
 *       500:
 *         description: Erreur serveur
 */
router.get('/cookies', authenticate, listCookies);

/**
 * @swagger
 * /api/social/cookies/{platform}:
 *   delete:
 *     tags: [Social]
 *     summary: Supprimer les cookies d'une plateforme
 *     description: Supprime les cookies stockes pour la plateforme specifiee. L'utilisateur devra se reconnecter pour utiliser les fonctionnalites OSINT sur cette plateforme.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [youtube, instagram, tiktok, snapchat, facebook, x]
 *         description: Plateforme dont les cookies doivent etre supprimes
 *     responses:
 *       200:
 *         description: Cookies supprimes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 platform:
 *                   type: string
 *       401:
 *         description: Non authentifie
 *       404:
 *         description: Aucun cookie trouve pour cette plateforme
 *       500:
 *         description: Erreur serveur
 */
router.delete('/cookies/:platform', authenticate, deleteCookies);

/**
 * @swagger
 * /api/social/cookies/{platform}/import:
 *   post:
 *     tags: [Social]
 *     summary: Importer des cookies manuellement
 *     description: Importe des cookies exportes depuis une extension navigateur (Cookie-Editor, EditThisCookie). Utile pour les plateformes dont le login OAuth bloque Puppeteer (ex. Strava via Google).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies]
 *             properties:
 *               cookies:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     value:
 *                       type: string
 *                     domain:
 *                       type: string
 *     responses:
 *       200:
 *         description: Cookies importes avec succes
 *       400:
 *         description: Aucun cookie valide fourni
 *       401:
 *         description: Non authentifie
 */
router.post('/cookies/:platform/import', (req, _res, next) => {
  // Accept token via query param for browser extension (CORS strips Authorization header)
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticate, importCookies);

/**
 * @swagger
 * /api/social/bridge-token:
 *   post:
 *     tags: [Social]
 *     summary: Generate a bridge token for browser extension authentication
 *     description: Generates a short-lived JWT (24h) that a browser extension can use to authenticate API calls for cookie synchronization. The token includes the server URL for extension configuration.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bridge token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for extension authentication
 *                 serverUrl:
 *                   type: string
 *                   description: Base URL of the server
 *                 expiresIn:
 *                   type: string
 *                   description: Token expiration duration
 *                   example: '24h'
 *       401:
 *         description: Non authentifie
 *       500:
 *         description: Erreur serveur
 */
router.post('/bridge-token', authenticate, generateBridgeToken);

/**
 * @swagger
 * /api/social/cookies-file:
 *   post:
 *     tags: [Social]
 *     summary: Upload a Netscape cookies.txt file
 *     description: Parses a Netscape-format cookies.txt file and imports the cookies. Auto-detects the platform from cookie domains if not specified. Useful for importing cookies exported from browser extensions or tools like yt-dlp.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [cookiesFile]
 *             properties:
 *               cookiesFile:
 *                 type: string
 *                 format: binary
 *                 description: Netscape cookies.txt file
 *               platform:
 *                 type: string
 *                 description: Target platform (auto-detected from domains if omitted)
 *                 enum: [youtube, instagram, tiktok, snapchat, facebook, x, linkedin, strava]
 *     responses:
 *       200:
 *         description: Cookies imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 platform:
 *                   type: string
 *                 cookieCount:
 *                   type: integer
 *       400:
 *         description: No file uploaded, no valid cookies, or platform could not be detected
 *       401:
 *         description: Non authentifie
 *       500:
 *         description: Erreur serveur
 */
router.post('/cookies-file', authenticate, upload.single('cookiesFile'), uploadCookiesFile);

/**
 * @swagger
 * /api/social/extension-download:
 *   get:
 *     tags: [Social]
 *     summary: Telecharger l'extension Cookie Bridge
 *     description: Telecharge l'extension Chrome MeteorEdit Cookie Bridge en fichier ZIP.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fichier ZIP de l'extension
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/extension-download', async (_req, res) => {
  try {
    const archiver = await import('archiver');
    const extensionDir = path.resolve(__dirname, '..', '..', '..', 'extension');
    const fs = await import('fs');
    if (!fs.existsSync(extensionDir)) {
      res.status(404).json({ message: 'Extension not found on server' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="meteoredit-cookie-bridge.zip"');
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(extensionDir, 'meteoredit-cookie-bridge');
    archive.finalize();
  } catch (err: any) {
    console.error('Extension download error:', err);
    res.status(500).json({ message: 'Failed to create extension zip' });
  }
});

/**
 * @swagger
 * /api/social/scrape-profile:
 *   post:
 *     tags: [Social]
 *     summary: Extraire un profil de reseau social
 *     description: Lance Puppeteer avec les cookies stockes pour scraper un profil public. Cree automatiquement un noeud note dans le dossier avec le contenu TipTap genere (infos, stats, images). Plateformes supportees — Snapchat, Instagram, TikTok, YouTube, Facebook, X/Twitter, WhatsApp.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, dossierId]
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL du profil a scraper
 *               dossierId:
 *                 type: string
 *                 description: ID du dossier cible
 *               parentId:
 *                 type: string
 *                 description: ID du noeud parent (optionnel)
 *     responses:
 *       200:
 *         description: Profil extrait et noeud cree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 node:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     dossierId:
 *                       type: string
 *                     parentId:
 *                       type: string
 *                       nullable: true
 *                     type:
 *                       type: string
 *                     title:
 *                       type: string
 *                     content:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 profile:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                     username:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     stats:
 *                       type: object
 *       400:
 *         description: URL manquante, plateforme non reconnue ou scraper non disponible
 *       401:
 *         description: Non authentifie
 *       403:
 *         description: Acces refuse au dossier ou plateforme non activee
 *       500:
 *         description: Erreur lors de l'extraction du profil
 */
router.post('/scrape-profile', authenticate, scrapeProfile);
router.post('/scan-username', authenticate, scanUsername);

export default router;
