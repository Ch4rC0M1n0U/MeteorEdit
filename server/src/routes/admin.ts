import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { listUsers, updateUser, deleteUser, resetUserPassword, resetUser2FA, getAuditLogs, getAuditStats } from '../controllers/adminController';
import { updateSettings, uploadLogo, deleteLogo, uploadFavicon, deleteFavicon, uploadLoginBackground, deleteLoginBackground } from '../controllers/settingsController';
import { getStats } from '../controllers/statsController';
import { getActivityLogs } from '../controllers/activityLogController';
import { getPluginSettings, updatePluginSettings } from '../controllers/pluginSettingsController';
import { listOllamaModels, pullOllamaModel, cancelPullOllamaModel, deleteOllamaModel, updateOllamaSettings } from '../controllers/aiController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:id/reset-2fa', resetUser2FA);

router.put('/settings', updateSettings);
router.post('/settings/logo', upload.single('logo'), uploadLogo);
router.delete('/settings/logo', deleteLogo);
router.post('/settings/favicon', upload.single('favicon'), uploadFavicon);
router.delete('/settings/favicon', deleteFavicon);
router.post('/settings/login-background', upload.single('loginBackground'), uploadLoginBackground);
router.delete('/settings/login-background', deleteLoginBackground);

router.get('/stats', getStats);
router.get('/logs', getActivityLogs);
router.get('/audit-logs', getAuditLogs);
router.get('/audit-stats', getAuditStats);

router.get('/plugins', getPluginSettings);
router.put('/plugins', updatePluginSettings);

router.get('/ai/models', listOllamaModels);
router.post('/ai/models/pull', pullOllamaModel);
router.post('/ai/models/pull/cancel', cancelPullOllamaModel);
router.delete('/ai/models/:name', deleteOllamaModel);
router.put('/ai/settings', updateOllamaSettings);

export default router;
