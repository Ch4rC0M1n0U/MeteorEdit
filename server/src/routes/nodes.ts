import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';
import {
  getNodes, createNode, updateNode,
  deleteNode, moveNode, uploadFile, uploadImage,
  getTrash, restoreNode, purgeNode, emptyTrash,
} from '../controllers/nodeController';
import { getComments, createComment, deleteComment, getCommentCount } from '../controllers/commentController';

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

// Comments
router.get('/nodes/:nodeId/comments', getComments);
router.post('/nodes/:nodeId/comments', createComment);
router.get('/nodes/:nodeId/comments/count', getCommentCount);
router.delete('/comments/:commentId', deleteComment);

// Image upload (for paste in editor/excalidraw)
router.post('/upload/image', upload.single('image'), uploadImage);

export default router;
