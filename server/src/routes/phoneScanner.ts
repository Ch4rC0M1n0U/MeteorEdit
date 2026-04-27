import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  createScan,
  getScan,
  getScanResults,
  cancelScan,
  getDossierHistory,
  resultToEntity,
  getAdminSettings,
  updateAdminSettings,
  getAdminStats,
} from '../controllers/phoneScannerController';

const router = Router();

router.use(authenticate);

// User routes
router.post('/scans', createScan);
router.get('/scans/:id', getScan);
router.get('/scans/:id/results', getScanResults);
router.delete('/scans/:id', cancelScan);
router.get('/dossiers/:dossierId/history', getDossierHistory);
router.post('/results/:id/to-entity', resultToEntity);

// Admin routes
router.get('/admin/settings', requireAdmin, getAdminSettings);
router.put('/admin/settings', requireAdmin, updateAdminSettings);
router.get('/admin/stats', requireAdmin, getAdminStats);

export default router;
