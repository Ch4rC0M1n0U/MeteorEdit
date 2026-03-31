import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  telegramSendCode, telegramSignIn, telegramAuthStatus, telegramLogout,
  telegramSearch, telegramSearchMessages, telegramResolveUsername, telegramPhoneLookup,
} from '../controllers/telegramController';

const router = Router();
router.use(authenticate);

// Auth flow
router.post('/auth/send-code', telegramSendCode);
router.post('/auth/sign-in', telegramSignIn);
router.get('/auth/status', telegramAuthStatus);
router.post('/auth/logout', telegramLogout);

// Search
router.post('/search', telegramSearch);
router.post('/search/messages', telegramSearchMessages);

// Lookup
router.post('/resolve', telegramResolveUsername);
router.post('/phone-lookup', telegramPhoneLookup);

export default router;
