import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, refresh, getPreferences, updatePreferences } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], login);

router.get('/me', authenticate, me);
router.post('/refresh', refresh);
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);

export default router;
