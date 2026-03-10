import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, refresh, getPreferences, updatePreferences, uploadTemplateLogo, getNotificationPreferences, updateNotificationPreferences } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';
import { updateProfile, uploadAvatar, deleteAvatar, changePassword, updateSignature, uploadSignatureImage, saveDrawnSignature, deleteSignatureImage } from '../controllers/profileController';
import { setup2FA, verify2FA, disable2FA, validate2FA } from '../controllers/twoFactorController';
import { searchUsers } from '../controllers/userSearchController';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouvel utilisateur
 *     description: Cree un compte utilisateur. Le compte doit etre active par un administrateur.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compte cree avec succes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *       400:
 *         description: Email deja enregistre ou mot de passe invalide
 *       403:
 *         description: Inscriptions desactivees
 *       500:
 *         description: Erreur serveur
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
], register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur et retourne des tokens JWT. Si le 2FA est active, retourne un tempToken.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion reussie
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 *                 - type: object
 *                   properties:
 *                     requires2FA:
 *                       type: boolean
 *                     tempToken:
 *                       type: string
 *       401:
 *         description: Identifiants invalides
 *       403:
 *         description: Compte non active
 *       500:
 *         description: Erreur serveur
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], login);

/**
 * @swagger
 * /api/auth/users/search:
 *   get:
 *     tags: [Auth]
 *     summary: Rechercher des utilisateurs actifs
 *     description: Recherche des utilisateurs par email, prenom ou nom (minimum 2 caracteres).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Terme de recherche (min 2 caracteres)
 *     responses:
 *       200:
 *         description: Liste des utilisateurs correspondants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   email:
 *                     type: string
 *       401:
 *         description: Non authentifie
 */
router.get('/users/search', authenticate, searchUsers);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtenir le profil de l'utilisateur connecte
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 avatarPath:
 *                   type: string
 *                   nullable: true
 *                 twoFactorEnabled:
 *                   type: boolean
 *                 preferences:
 *                   type: object
 *                 signature:
 *                   type: object
 *                 signatureImagePath:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Non authentifie
 *       404:
 *         description: Utilisateur non trouve
 */
router.get('/me', authenticate, me);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rafraichir les tokens JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nouveaux tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Refresh token manquant
 *       401:
 *         description: Refresh token invalide
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/auth/preferences:
 *   get:
 *     tags: [Auth]
 *     summary: Obtenir les preferences utilisateur
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences utilisateur (objet libre)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Non authentifie
 *   put:
 *     tags: [Auth]
 *     summary: Mettre a jour les preferences utilisateur
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Objet de preferences (merge avec l'existant)
 *     responses:
 *       200:
 *         description: Preferences mises a jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Non authentifie
 */
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Profile]
 *     summary: Mettre a jour le profil (prenom, nom, email)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profil mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Email deja utilise
 *       401:
 *         description: Non authentifie
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @swagger
 * /api/auth/avatar:
 *   post:
 *     tags: [Profile]
 *     summary: Uploader un avatar
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 avatarPath:
 *                   type: string
 *       400:
 *         description: Aucun fichier fourni
 *       401:
 *         description: Non authentifie
 *   delete:
 *     tags: [Profile]
 *     summary: Supprimer l'avatar
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar supprime
 *       401:
 *         description: Non authentifie
 */
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     tags: [Profile]
 *     summary: Changer le mot de passe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe change
 *       400:
 *         description: Mot de passe invalide
 *       401:
 *         description: Mot de passe actuel incorrect
 */
router.put('/password', authenticate, changePassword);

/**
 * @swagger
 * /api/auth/signature:
 *   put:
 *     tags: [Profile]
 *     summary: Mettre a jour la signature textuelle
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               name:
 *                 type: string
 *               service:
 *                 type: string
 *               unit:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signature mise a jour
 *       401:
 *         description: Non authentifie
 */
router.put('/signature', authenticate, updateSignature);

/**
 * @swagger
 * /api/auth/signature/image:
 *   post:
 *     tags: [Profile]
 *     summary: Uploader une image de signature
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               signatureImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image de signature uploadee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signatureImagePath:
 *                   type: string
 *       400:
 *         description: Aucun fichier fourni
 *       401:
 *         description: Non authentifie
 *   delete:
 *     tags: [Profile]
 *     summary: Supprimer l'image de signature
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Image de signature supprimee
 *       401:
 *         description: Non authentifie
 */
router.post('/signature/image', authenticate, upload.single('signatureImage'), uploadSignatureImage);

/**
 * @swagger
 * /api/auth/signature/draw:
 *   post:
 *     tags: [Profile]
 *     summary: Sauvegarder une signature dessinee (base64 PNG)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataUrl]
 *             properties:
 *               dataUrl:
 *                 type: string
 *                 description: Data URL base64 PNG (data:image/png;base64,...)
 *     responses:
 *       200:
 *         description: Signature sauvegardee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signatureImagePath:
 *                   type: string
 *       400:
 *         description: Donnees invalides
 *       401:
 *         description: Non authentifie
 */
router.post('/signature/draw', authenticate, saveDrawnSignature);
router.delete('/signature/image', authenticate, deleteSignatureImage);

/**
 * @swagger
 * /api/auth/template-logo:
 *   post:
 *     tags: [Profile]
 *     summary: Uploader un logo pour les templates de rapport
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               templateLogo:
 *                 type: string
 *                 format: binary
 *               slot:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logo uploade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   type: string
 *       400:
 *         description: Aucun fichier fourni
 *       401:
 *         description: Non authentifie
 */
router.post('/template-logo', authenticate, upload.single('templateLogo'), uploadTemplateLogo);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     tags: [2FA]
 *     summary: Initialiser la configuration 2FA
 *     description: Genere un secret TOTP et retourne le QR code et les codes de secours.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration 2FA initialisee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: QR code en data URL
 *                 secret:
 *                   type: string
 *                   description: Secret TOTP en base32
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: 2FA deja active
 *       401:
 *         description: Non authentifie
 */
router.post('/2fa/setup', authenticate, setup2FA);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     tags: [2FA]
 *     summary: Verifier et activer le 2FA
 *     description: Verifie le code TOTP pour confirmer l'activation du 2FA.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA active avec succes
 *       400:
 *         description: Code invalide ou setup non initie
 *       401:
 *         description: Non authentifie
 */
router.post('/2fa/verify', authenticate, verify2FA);

/**
 * @swagger
 * /api/auth/2fa:
 *   delete:
 *     tags: [2FA]
 *     summary: Desactiver le 2FA
 *     description: Desactive le 2FA apres verification du mot de passe.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA desactive
 *       401:
 *         description: Mot de passe invalide
 *       403:
 *         description: 2FA obligatoire selon la politique admin
 */
router.delete('/2fa', authenticate, disable2FA);

/**
 * @swagger
 * /api/auth/2fa/validate:
 *   post:
 *     tags: [2FA]
 *     summary: Valider le code 2FA lors de la connexion
 *     description: Valide le code TOTP ou un code de secours avec le tempToken obtenu lors du login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, code]
 *             properties:
 *               tempToken:
 *                 type: string
 *                 description: Token temporaire recu lors du login
 *               code:
 *                 type: string
 *                 description: Code TOTP ou code de secours
 *     responses:
 *       200:
 *         description: Authentification reussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                 backupCodeUsed:
 *                   type: boolean
 *       400:
 *         description: Code invalide
 *       401:
 *         description: Token expire ou invalide
 */
router.post('/2fa/validate', validate2FA); // No auth — uses tempToken

router.get('/notification-preferences', authenticate, getNotificationPreferences);
router.patch('/notification-preferences', authenticate, updateNotificationPreferences);

export default router;
