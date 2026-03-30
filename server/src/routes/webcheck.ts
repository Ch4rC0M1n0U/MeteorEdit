import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { importWebCheck } from '../controllers/webcheckController';

const router = Router();

router.post('/dossiers/:id/import-webcheck', authenticate, importWebCheck);

export default router;
