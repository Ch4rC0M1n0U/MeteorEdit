import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listDossiers, createDossier, getDossier,
  updateDossier, deleteDossier, updateCollaborators,
} from '../controllers/dossierController';

const router = Router();
router.use(authenticate);

router.get('/', listDossiers);
router.post('/', createDossier);
router.get('/:id', getDossier);
router.put('/:id', updateDossier);
router.delete('/:id', deleteDossier);
router.patch('/:id/collaborators', updateCollaborators);

export default router;
