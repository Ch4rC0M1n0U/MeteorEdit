import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getChangelog, markAsRead, createChangelog } from '../controllers/changelogController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/changelog:
 *   get:
 *     tags: [Changelog]
 *     summary: Get all changelog entries
 *     description: Returns all changelog entries sorted by date desc, with unread count based on user preferences.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Changelog entries with unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 changelogs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       version:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       entries:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               enum: [feature, fix, improvement]
 *                             message:
 *                               type: string
 *                 unreadCount:
 *                   type: number
 */
router.get('/', getChangelog);

/**
 * @swagger
 * /api/changelog/read:
 *   post:
 *     tags: [Changelog]
 *     summary: Mark changelog as read
 *     description: Sets the user's lastChangelogRead preference to the current time.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.post('/read', markAsRead);

/**
 * @swagger
 * /api/changelog:
 *   post:
 *     tags: [Changelog]
 *     summary: Create a changelog entry (admin only)
 *     description: Creates a new changelog entry for a given version.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - version
 *               - entries
 *             properties:
 *               version:
 *                 type: string
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [feature, fix, improvement]
 *                     message:
 *                       type: string
 *     responses:
 *       201:
 *         description: Changelog created
 *       409:
 *         description: Version already exists
 */
router.post('/', requireAdmin, createChangelog);

export default router;
