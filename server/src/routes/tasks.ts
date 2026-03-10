import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/taskController';

const router = Router();
router.use(authenticate);

router.get('/dossiers/:dossierId/tasks', listTasks);
router.post('/dossiers/:dossierId/tasks', createTask);
router.put('/tasks/:taskId', updateTask);
router.delete('/tasks/:taskId', deleteTask);

export default router;
