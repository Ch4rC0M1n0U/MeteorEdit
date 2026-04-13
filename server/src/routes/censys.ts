import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getCensysStatus, censysSearch, censysHostInfo } from '../controllers/censysController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/censys/status:
 *   get:
 *     tags: [Censys]
 *     summary: Check Censys availability and quota
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Censys status and remaining credits
 */
router.get('/status', getCensysStatus);

/**
 * @swagger
 * /api/censys/search:
 *   post:
 *     tags: [Censys]
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
 *               cursor: { type: string }
 *     responses:
 *       200:
 *         description: Search results with matches
 */
router.post('/search', censysSearch);

/**
 * @swagger
 * /api/censys/host/{ip}:
 *   get:
 *     tags: [Censys]
 *     summary: Get detailed host information
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
router.get('/host/:ip', censysHostInfo);

export default router;
