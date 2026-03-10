import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { clipWebContent, getClipDossiers } from '../controllers/clipperController';

const router = Router();
router.use(authenticate);

router.get('/dossiers', getClipDossiers);
router.post('/', clipWebContent);

export default router;
