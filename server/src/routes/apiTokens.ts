import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from '../controllers/apiTokenController';

const router = Router();

router.use(authenticate);

router.post('/', createApiToken);
router.get('/', listApiTokens);
router.delete('/:id', revokeApiToken);

export default router;
