import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/taskController';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/dossiers/{dossierId}/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Lister les taches d'un dossier
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
 *         description: Liste des taches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       403:
 *         description: Acces refuse
 *   post:
 *     tags: [Tasks]
 *     summary: Creer une tache dans un dossier
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               assigneeId:
 *                 type: string
 *                 nullable: true
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Tache creee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       403:
 *         description: Acces refuse
 */
router.get('/dossiers/:dossierId/tasks', listTasks);
router.post('/dossiers/:dossierId/tasks', createTask);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   put:
 *     tags: [Tasks]
 *     summary: Mettre a jour une tache
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [todo, in_progress, done]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               assigneeId:
 *                 type: string
 *                 nullable: true
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Tache mise a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Tache non trouvee
 *   delete:
 *     tags: [Tasks]
 *     summary: Supprimer une tache
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tache supprimee
 *       403:
 *         description: Acces refuse
 *       404:
 *         description: Tache non trouvee
 */
router.put('/tasks/:taskId', updateTask);
router.delete('/tasks/:taskId', deleteTask);

export default router;
