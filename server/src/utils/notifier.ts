import Notification from '../models/Notification';
import { getIO, getUserSockets } from '../socket';

export async function createNotification(
  userId: string,
  type: 'collaborator.added' | 'collaborator.removed' | 'dossier.updated' | 'node.updated',
  message: string,
  dossierId: string | null = null,
  fromUserId: string | null = null
): Promise<void> {
  try {
    const notification = await Notification.create({ userId, type, message, dossierId, fromUserId });
    const populated = await notification.populate('fromUserId', 'firstName lastName');

    const io = getIO();
    const sockets = getUserSockets().get(userId);
    if (io && sockets) {
      for (const socketId of sockets) {
        io.to(socketId).emit('notification:new', populated);
      }
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
}
