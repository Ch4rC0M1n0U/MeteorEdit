import { Router } from 'express';
import { getBranding } from '../controllers/settingsController';

const router = Router();
router.get('/branding', getBranding);

export default router;
