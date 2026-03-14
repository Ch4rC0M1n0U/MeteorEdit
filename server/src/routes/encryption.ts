import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  storeKeys,
  getMyKeys,
  getUserPublicKey,
  storeDossierKey,
  getDossierKeys,
  removeDossierKey,
} from '../controllers/encryptionController';

const router = Router();

/**
 * @swagger
 * /api/encryption/keys:
 *   post:
 *     tags: [Encryption]
 *     summary: Stocker les cles de chiffrement de l'utilisateur
 *     description: Enregistre la cle publique et la cle privee chiffree (RSA-OAEP 4096).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey, encryptedPrivateKey, salt]
 *             properties:
 *               publicKey:
 *                 type: string
 *               encryptedPrivateKey:
 *                 type: string
 *               salt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cles enregistrees
 *       400:
 *         description: Parametres manquants
 *   get:
 *     tags: [Encryption]
 *     summary: Obtenir ses propres cles de chiffrement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cles de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *                   nullable: true
 *                 encryptedPrivateKey:
 *                   type: string
 *                   nullable: true
 *                 salt:
 *                   type: string
 *                   nullable: true
 */
router.post('/keys', authenticate, storeKeys);
router.get('/keys', authenticate, getMyKeys);

/**
 * @swagger
 * /api/encryption/keys/{userId}:
 *   get:
 *     tags: [Encryption]
 *     summary: Obtenir la cle publique d'un utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cle publique
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Utilisateur non trouve
 */
router.get('/keys/:userId', authenticate, getUserPublicKey);

/**
 * @swagger
 * /api/encryption/dossier/{dossierId}:
 *   put:
 *     tags: [Encryption]
 *     summary: Stocker les cles de chiffrement d'un dossier
 *     description: Enregistre les cles AES chiffrees par utilisateur. Seul le proprietaire peut gerer le chiffrement.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dossierId
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
 *               encryptedKeys:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     encryptedKey:
 *                       type: string
 *     responses:
 *       200:
 *         description: Dossier mis a jour avec les cles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dossier'
 *       403:
 *         description: Seul le proprietaire peut gerer le chiffrement
 *       404:
 *         description: Dossier non trouve
 *   get:
 *     tags: [Encryption]
 *     summary: Obtenir les cles de chiffrement d'un dossier
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dossierId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cles du dossier
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 encryptionKeys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       encryptedKey:
 *                         type: string
 *       404:
 *         description: Dossier non trouve
 */
router.put('/dossier/:dossierId', authenticate, storeDossierKey);
router.get('/dossier/:dossierId', authenticate, getDossierKeys);

/**
 * @swagger
 * /api/encryption/dossier/{dossierId}/key/{userId}:
 *   delete:
 *     tags: [Encryption]
 *     summary: Supprimer la cle de chiffrement d'un utilisateur pour un dossier
 *     description: Retire la cle AES chiffree d'un collaborateur. Seul le proprietaire peut effectuer cette operation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dossierId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cle supprimee
 *       403:
 *         description: Seul le proprietaire peut gerer les cles
 *       404:
 *         description: Dossier non trouve
 */
router.delete('/dossier/:dossierId/key/:userId', authenticate, removeDossierKey);

export default router;
