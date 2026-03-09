import { Router } from 'express';
import { getBranding } from '../controllers/settingsController';
import { getMapboxToken } from '../controllers/pluginSettingsController';

const router = Router();
router.get('/branding', getBranding);
router.get('/mapbox', getMapboxToken);

export default router;
