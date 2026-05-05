import { Router } from 'express';
import { extensionAuth } from '../middleware/extensionAuth';
import { authenticate } from '../middleware/auth';
import {
  verify,
  importCookies,
  listMySessions,
  clearMySession,
  downloadExtension,
} from '../controllers/extensionController';
import {
  listExtensionDossiers,
  clipFromExtension,
} from '../controllers/extensionClipController';

const router = Router();

// Public download — no auth (the ZIP is just the source already in the repo)
router.get('/download', downloadExtension);

// Bearer-token auth: used by the browser extension
router.get('/auth/verify', extensionAuth, verify);
router.post('/cookies/import', extensionAuth, importCookies);
router.get('/dossiers', extensionAuth, listExtensionDossiers);
router.post('/clip', extensionAuth, clipFromExtension);

// Session-based auth: used by the web app (Profile > Sessions sociales)
router.get('/sessions', authenticate, listMySessions);
router.delete('/sessions/:platform', authenticate, clearMySession);

export default router;
