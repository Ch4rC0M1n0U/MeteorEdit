import { Router } from 'express';
import { getSetupStatus, initialize } from '../controllers/setupController';

const router = Router();

/**
 * @swagger
 * /api/setup/status:
 *   get:
 *     summary: Get setup status and service diagnostics
 *     tags: [Setup]
 *     parameters:
 *       - in: query
 *         name: dev
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Dev mode — returns diagnostics without side effects
 *     responses:
 *       200:
 *         description: Setup status with service health checks
 */
router.get('/status', getSetupStatus);

/**
 * @swagger
 * /api/setup/initialize:
 *   post:
 *     summary: Initialize the application (create first admin + configure settings)
 *     tags: [Setup]
 *     parameters:
 *       - in: query
 *         name: dev
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Dev mode — simulates initialization without writing to DB
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admin:
 *                 type: object
 *                 properties:
 *                   email: { type: string }
 *                   password: { type: string }
 *                   firstName: { type: string }
 *                   lastName: { type: string }
 *               settings:
 *                 type: object
 *                 properties:
 *                   appName: { type: string }
 *                   accentColor: { type: string }
 *                   loginMessage: { type: string }
 *                   registrationEnabled: { type: boolean }
 *                   language: { type: string }
 *     responses:
 *       200:
 *         description: Setup completed (or simulated in dev mode)
 *       400:
 *         description: Validation error
 *       409:
 *         description: Setup already completed
 */
router.post('/initialize', initialize);

export default router;
