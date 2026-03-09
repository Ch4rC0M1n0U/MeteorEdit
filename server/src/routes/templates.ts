import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resolveTemplate,
  getAvailablePlaceholders,
} from '../controllers/templateController';

const router = Router();

router.use(authenticate);

router.get('/', getTemplates);
router.get('/placeholders', getAvailablePlaceholders);
router.get('/:id', getTemplate);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/resolve', resolveTemplate);

export default router;
