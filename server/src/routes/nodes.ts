import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';
import {
  getNodes, createNode, updateNode,
  deleteNode, moveNode, uploadFile, uploadImage,
  getTrash, restoreNode, purgeNode, emptyTrash,
} from '../controllers/nodeController';

const router = Router();
router.use(authenticate);

// Node routes under dossier
router.get('/dossiers/:id/nodes', getNodes);
router.post('/dossiers/:id/nodes', createNode);
router.get('/dossiers/:id/trash', getTrash);
router.delete('/dossiers/:id/trash', emptyTrash);

// Node-specific routes
router.put('/nodes/:nodeId', updateNode);
router.delete('/nodes/:nodeId', deleteNode);
router.patch('/nodes/:nodeId/move', moveNode);
router.patch('/nodes/:nodeId/restore', restoreNode);
router.delete('/nodes/:nodeId/purge', purgeNode);
router.post('/nodes/:nodeId/upload', upload.single('file'), uploadFile);

// Image upload (for paste in editor/excalidraw)
router.post('/upload/image', upload.single('image'), uploadImage);

export default router;
