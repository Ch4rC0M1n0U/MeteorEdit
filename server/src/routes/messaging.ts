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
import {
  addReaction,
  removeReaction,
  getReactions,
  togglePin,
  getPinnedMessages,
  archiveConversation,
  unarchiveConversation,
  exportConversation,
} from '../controllers/messagingExtras';

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

// Phase 4
router.post('/messages/:id/reactions', addReaction);
router.delete('/messages/:id/reactions/:emoji', removeReaction);
router.get('/conversations/:id/reactions', getReactions);
router.post('/messages/:id/pin', togglePin);
router.get('/conversations/:id/pinned', getPinnedMessages);
router.post('/conversations/:id/archive', archiveConversation);
router.post('/conversations/:id/unarchive', unarchiveConversation);
router.get('/conversations/:id/export', exportConversation);

export default router;
