import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  osintSearch,
  osintExportToNote,
  getDorkTemplates,
} from '../controllers/osintSearchController';

const router = Router();
router.use(authenticate);
router.post('/search', osintSearch);
router.post('/search/export', osintExportToNote);
router.get('/dorks', getDorkTemplates);
export default router;
