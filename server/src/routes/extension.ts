import { Router } from 'express';
import { extensionAuth } from '../middleware/extensionAuth';
import { authenticate } from '../middleware/auth';
import {
  verify,
  listDossiers,
  getMyPublicKey,
  importCookies,
  listDossierImports,
} from '../controllers/extensionController';

const router = Router();

// Bearer-token auth used by the browser extension
router.get('/auth/verify', extensionAuth, verify);
router.get('/dossiers', extensionAuth, listDossiers);
router.get('/me/pubkey', extensionAuth, getMyPublicKey);
router.post('/cookies/import', extensionAuth, importCookies);

// Session-based auth used by the web app to read back imports
router.get('/dossiers/:dossierId/imports', authenticate, listDossierImports);

export default router;
