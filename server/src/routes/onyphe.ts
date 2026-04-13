import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getOnypheStatus, onypheSearch, onypheHostInfo } from '../controllers/onypheController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/onyphe/status:
 *   get:
 *     tags: [Onyphe]
 *     summary: Check Onyphe availability and quota
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onyphe status and remaining credits
 */
router.get('/status', getOnypheStatus);

/**
 * @swagger
 * /api/onyphe/search:
 *   post:
 *     tags: [Onyphe]
 *     summary: Search hosts by geographic location
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *               radius: { type: number, default: 5 }
 *               filters: { type: string }
 *               page: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Search results with matches
 */
router.post('/search', onypheSearch);

/**
 * @swagger
 * /api/onyphe/host/{ip}:
 *   get:
 *     tags: [Onyphe]
 *     summary: Get host summary information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Host details
 */
router.get('/host/:ip', onypheHostInfo);

export default router;
