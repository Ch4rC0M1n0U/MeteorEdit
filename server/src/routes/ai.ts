import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getAiStatus, generateReport, cancelGenerateReport } from '../controllers/aiController';

const router = Router();
router.use(authenticate);

router.get('/status', getAiStatus);
router.post('/generate-report', generateReport);
router.post('/generate-report/cancel', cancelGenerateReport);

export default router;
