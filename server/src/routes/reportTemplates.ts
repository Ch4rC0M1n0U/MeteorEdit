import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from '../controllers/reportTemplateController';

const router = Router();

router.use(authenticate);

router.get('/', listReportTemplates);
router.post('/', createReportTemplate);
router.put('/:id', updateReportTemplate);
router.delete('/:id', deleteReportTemplate);

export default router;
