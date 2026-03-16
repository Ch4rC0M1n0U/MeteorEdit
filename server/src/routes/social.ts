import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { socialLogin, listCookies, deleteCookies } from '../controllers/socialAuthController';
import { scrapeProfile } from '../controllers/scrapeController';

const router = Router();

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

export default router;
