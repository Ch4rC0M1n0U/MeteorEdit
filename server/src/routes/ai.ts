import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getAiStatus, getAiClientConfig, generateReport, cancelGenerateReport, enrichEntity, cancelEnrichEntity, summarizeContent, reformulateText, testUserClaudeConnection, testUserOpenAIConnection } from '../controllers/aiController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/ai/status:
 *   get:
 *     tags: [AI]
 *     summary: Verifier le statut de l'IA
 *     description: Retourne si l'IA est activee et quel modele est selectionne.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut IA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 hasModel:
 *                   type: boolean
 *                 model:
 *                   type: string
 */
router.get('/status', getAiStatus);
router.get('/config', getAiClientConfig);
router.post('/test/claude', testUserClaudeConnection);
router.post('/test/openai', testUserOpenAIConnection);

/**
 * @swagger
 * /api/ai/generate-report:
 *   post:
 *     tags: [AI]
 *     summary: Generer un rapport IA (SSE)
 *     description: Genere un rapport d'investigation structure via Ollama avec streaming SSE.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId]
 *             properties:
 *               dossierId:
 *                 type: string
 *               templateId:
 *                 type: string
 *                 description: ID du template de rapport (optionnel)
 *     responses:
 *       200:
 *         description: Flux SSE avec tokens et logs
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: dossierId requis ou IA non configuree
 *       403:
 *         description: Acces refuse au dossier
 *       404:
 *         description: Dossier non trouve
 */
router.post('/generate-report', generateReport);

/**
 * @swagger
 * /api/ai/generate-report/cancel:
 *   post:
 *     tags: [AI]
 *     summary: Annuler la generation d'un rapport
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId]
 *             properties:
 *               dossierId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generation annulee
 *       404:
 *         description: Aucune generation active
 */
router.post('/generate-report/cancel', cancelGenerateReport);

/**
 * @swagger
 * /api/ai/enrich-entity:
 *   post:
 *     tags: [AI]
 *     summary: Enrichir une entite via l'IA (SSE)
 *     description: Utilise Ollama pour generer une description detaillee de l'entite avec streaming SSE temps reel.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId, entityIndex]
 *             properties:
 *               dossierId:
 *                 type: string
 *               entityIndex:
 *                 type: number
 *                 description: Index de l'entite dans le tableau entities du dossier
 *     responses:
 *       200:
 *         description: Flux SSE avec tokens et logs
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Parametres manquants ou IA non configuree
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Dossier ou entite non trouve
 */
router.post('/enrich-entity', enrichEntity);

/**
 * @swagger
 * /api/ai/enrich-entity/cancel:
 *   post:
 *     tags: [AI]
 *     summary: Annuler l'enrichissement d'une entite
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId, entityIndex]
 *             properties:
 *               dossierId:
 *                 type: string
 *               entityIndex:
 *                 type: number
 *     responses:
 *       200:
 *         description: Enrichissement annule
 *       404:
 *         description: Aucun enrichissement actif
 */
router.post('/enrich-entity/cancel', cancelEnrichEntity);

/**
 * @swagger
 * /api/ai/summarize:
 *   post:
 *     tags: [AI]
 *     summary: Resumer le contenu d'un noeud ou dossier
 *     description: Genere un resume structure en points cles via Ollama.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dossierId]
 *             properties:
 *               dossierId:
 *                 type: string
 *               nodeId:
 *                 type: string
 *                 description: Si fourni, resume le noeud; sinon resume le dossier entier
 *     responses:
 *       200:
 *         description: Resume genere
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 *       400:
 *         description: Parametres manquants, IA non configuree ou aucun contenu
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Dossier ou noeud non trouve
 *       502:
 *         description: Erreur Ollama
 */
router.post('/summarize', summarizeContent);
router.post('/reformulate', reformulateText);

export default router;
