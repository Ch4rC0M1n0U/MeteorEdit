import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  storeKeys,
  getMyKeys,
  getUserPublicKey,
  storeDossierKey,
  getDossierKeys,
} from '../controllers/encryptionController';

const router = Router();

router.post('/keys', authenticate, storeKeys);
router.get('/keys', authenticate, getMyKeys);
router.get('/keys/:userId', authenticate, getUserPublicKey);
router.put('/dossier/:dossierId', authenticate, storeDossierKey);
router.get('/dossier/:dossierId', authenticate, getDossierKeys);

export default router;
