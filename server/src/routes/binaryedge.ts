import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getBinaryEdgeStatus, binaryedgeSearch, binaryedgeHostInfo } from '../controllers/binaryedgeController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/binaryedge/status:
 *   get:
 *     tags: [BinaryEdge]
 *     summary: Check BinaryEdge availability and subscription info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: BinaryEdge status and remaining credits
 */
router.get('/status', getBinaryEdgeStatus);

/**
 * @swagger
 * /api/binaryedge/search:
 *   post:
 *     tags: [BinaryEdge]
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
router.post('/search', binaryedgeSearch);

/**
 * @swagger
 * /api/binaryedge/host/{ip}:
 *   get:
 *     tags: [BinaryEdge]
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
router.get('/host/:ip', binaryedgeHostInfo);

export default router;
