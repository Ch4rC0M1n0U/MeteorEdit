import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { listUsers, updateUser, deleteUser } from '../controllers/adminController';
import { updateSettings, uploadLogo, deleteLogo, uploadFavicon, deleteFavicon } from '../controllers/settingsController';
import { getStats } from '../controllers/statsController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.put('/settings', updateSettings);
router.post('/settings/logo', upload.single('logo'), uploadLogo);
router.delete('/settings/logo', deleteLogo);
router.post('/settings/favicon', upload.single('favicon'), uploadFavicon);
router.delete('/settings/favicon', deleteFavicon);

router.get('/stats', getStats);

export default router;
