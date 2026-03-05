import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, refresh, getPreferences, updatePreferences } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';
import { updateProfile, uploadAvatar, deleteAvatar, changePassword } from '../controllers/profileController';
import { setup2FA, verify2FA, disable2FA, validate2FA } from '../controllers/twoFactorController';
import { searchUsers } from '../controllers/userSearchController';

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

router.get('/users/search', authenticate, searchUsers);
router.get('/me', authenticate, me);
router.post('/refresh', refresh);
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);

// Profile routes
router.put('/profile', authenticate, updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);
router.put('/password', authenticate, changePassword);

// 2FA routes
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/verify', authenticate, verify2FA);
router.delete('/2fa', authenticate, disable2FA);
router.post('/2fa/validate', validate2FA); // No auth — uses tempToken

export default router;
