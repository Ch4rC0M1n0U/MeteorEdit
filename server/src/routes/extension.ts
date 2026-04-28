import { Router } from 'express';
import { extensionAuth } from '../middleware/extensionAuth';
import { authenticate } from '../middleware/auth';
import {
  verify,
  importCookies,
  listMySessions,
  clearMySession,
} from '../controllers/extensionController';

const router = Router();

// Bearer-token auth: used by the browser extension
router.get('/auth/verify', extensionAuth, verify);
router.post('/cookies/import', extensionAuth, importCookies);

// Session-based auth: used by the web app (Profile > Sessions sociales)
router.get('/sessions', authenticate, listMySessions);
router.delete('/sessions/:platform', authenticate, clearMySession);

export default router;
