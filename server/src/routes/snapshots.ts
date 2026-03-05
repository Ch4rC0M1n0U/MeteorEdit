import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from '../controllers/snapshotController';

const router = Router();
router.use(authenticate);

router.get('/nodes/:nodeId/snapshots', getSnapshots);
router.post('/nodes/:nodeId/snapshots', createSnapshot);
router.post('/snapshots/:snapshotId/restore', restoreSnapshot);
router.delete('/snapshots/:snapshotId', deleteSnapshot);

export default router;
