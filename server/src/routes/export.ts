import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { exportJSON } from '../controllers/exportController';

const router = Router();

router.get('/dossiers/:id/export/json', authenticate, exportJSON);

export default router;
