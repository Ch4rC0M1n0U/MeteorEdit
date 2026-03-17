import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkText, getStatus } from '../controllers/languagetoolController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/languagetool/status:
 *   get:
 *     tags: [LanguageTool]
 *     summary: Verifier le statut de LanguageTool
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut du service
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/status', getStatus);

/**
 * @swagger
 * /api/languagetool/check:
 *   post:
 *     tags: [LanguageTool]
 *     summary: Verifier l'orthographe et la grammaire
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *               language:
 *                 type: string
 *                 default: auto
 *               disabledRules:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultats de la verification
 *       502:
 *         description: Service LanguageTool indisponible
 */
router.post('/check', checkText);

export default router;
