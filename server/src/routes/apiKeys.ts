import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listApiKeys, createApiKey, revokeApiKey, updateApiKey } from '../controllers/apiKeyController';

const router = Router();

router.use(authenticate);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.patch('/:id', updateApiKey);
router.delete('/:id', revokeApiKey);

export default router;
