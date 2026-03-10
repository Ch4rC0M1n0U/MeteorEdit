import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getAiStatus, generateReport, cancelGenerateReport, enrichEntity, summarizeContent } from '../controllers/aiController';

const router = Router();
router.use(authenticate);

router.get('/status', getAiStatus);
router.post('/generate-report', generateReport);
router.post('/generate-report/cancel', cancelGenerateReport);
router.post('/enrich-entity', enrichEntity);
router.post('/summarize', summarizeContent);

export default router;
