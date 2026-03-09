import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listDossiers, createDossier, getDossier,
  updateDossier, deleteDossier, updateCollaborators, getTags,
  uploadDossierLogo, deleteDossierLogo,
} from '../controllers/dossierController';
import { getUserDashboard } from '../controllers/dashboardController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getUserDashboard);
router.get('/', listDossiers);
router.post('/', createDossier);
router.get('/tags', getTags);
router.get('/:id', getDossier);
router.put('/:id', updateDossier);
router.delete('/:id', deleteDossier);
router.patch('/:id/collaborators', updateCollaborators);
router.post('/:id/logo', upload.single('logo'), uploadDossierLogo);
router.delete('/:id/logo', deleteDossierLogo);

export default router;
