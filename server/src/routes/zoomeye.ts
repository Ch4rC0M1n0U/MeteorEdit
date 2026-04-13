import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getZoomEyeStatus, zoomeyeSearch, zoomeyeHostInfo } from '../controllers/zoomeyeController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/zoomeye/status:
 *   get:
 *     tags: [ZoomEye]
 *     summary: Check ZoomEye availability and quota
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ZoomEye status and remaining credits
 */
router.get('/status', getZoomEyeStatus);

/**
 * @swagger
 * /api/zoomeye/search:
 *   post:
 *     tags: [ZoomEye]
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
router.post('/search', zoomeyeSearch);

/**
 * @swagger
 * /api/zoomeye/host/{ip}:
 *   get:
 *     tags: [ZoomEye]
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
router.get('/host/:ip', zoomeyeHostInfo);

export default router;
