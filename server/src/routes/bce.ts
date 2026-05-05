import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  searchName,
  searchAddress,
  getCompany,
  listJuridicalForms,
  listByJuridicalForm,
  exportToNotes,
} from '../controllers/bceSearchController';

const router = Router();

router.use(authenticate);

router.get('/search/name', searchName);
router.get('/search/address', searchAddress);
router.get('/company/:cbeNumber', getCompany);
router.get('/juridical-forms', listJuridicalForms);
router.get('/juridical-forms/:code/companies', listByJuridicalForm);
router.post('/export', exportToNotes);

export default router;
