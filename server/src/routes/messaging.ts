import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getMyConversations,
  openDossierChannel,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  getDmCandidates,
  openDirect,
  getPeerPublicKey,
} from '../controllers/messagingController';

const router = Router();

router.use(authenticate);

router.get('/conversations', getMyConversations);
router.post('/conversations/dossier/:dossierId', openDossierChannel);
router.post('/conversations/direct', openDirect);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/read', markAsRead);
router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);
router.get('/contacts', getDmCandidates);
router.get('/users/:userId/pubkey', getPeerPublicKey);

export default router;
