import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import User from '../models/User';

const onlineUsers = new Set<string>();
let ioInstance: Server | null = null;
const userSockets = new Map<string, Set<string>>();

// Track map presence per nodeId: nodeId -> Map<userId, user data>
const mapPresence = new Map<string, Map<string, any>>();

// Track dossier presence per dossierId: dossierId -> Map<userId, user data>
const dossierPresence = new Map<string, Map<string, any>>();

export function getOnlineUsers(): Set<string> {
  return onlineUsers;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}

export function getIO(): Server | null {
  return ioInstance;
}

export function getUserSockets(): Map<string, Set<string>> {
  return userSockets;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`User ${user.userId} connected`);
    onlineUsers.add(user.userId);

    if (!userSockets.has(user.userId)) userSockets.set(user.userId, new Set());
    userSockets.get(user.userId)!.add(socket.id);

    // Broadcast online count to admin room
    io.to('admin-room').emit('online-count', onlineUsers.size);

    // Join admin room if admin
    if (user.role === 'admin') {
      socket.join('admin-room');
      socket.emit('online-count', onlineUsers.size);
    }

    socket.on('join-dossier', async (dossierId: string) => {
      socket.join(`dossier:${dossierId}`);

      // Fetch user info for presence
      try {
        const dbUser = await User.findById(user.userId).select('firstName lastName avatarPath').lean();
        if (dbUser) {
          const userData = {
            userId: user.userId,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            avatarPath: dbUser.avatarPath || null,
            initials: `${dbUser.firstName[0] || ''}${dbUser.lastName[0] || ''}`.toUpperCase(),
          };

          // Store presence
          if (!dossierPresence.has(dossierId)) dossierPresence.set(dossierId, new Map());
          const presenceMap = dossierPresence.get(dossierId)!;
          presenceMap.set(user.userId, userData);

          // Send existing users to the joiner (excluding self)
          const existingUsers = Array.from(presenceMap.values()).filter(u => u.userId !== user.userId);
          if (existingUsers.length) {
            socket.emit('dossier-presence-list', { dossierId, users: existingUsers });
          }

          // Broadcast join to others
          socket.to(`dossier:${dossierId}`).emit('user-joined', userData);
        }
      } catch (err) {
        console.error('Failed to fetch user for presence:', err);
        socket.to(`dossier:${dossierId}`).emit('user-joined', { userId: user.userId });
      }
    });

    socket.on('leave-dossier', (dossierId: string) => {
      socket.leave(`dossier:${dossierId}`);

      // Remove from dossier presence
      const presenceMap = dossierPresence.get(dossierId);
      if (presenceMap) {
        presenceMap.delete(user.userId);
        if (presenceMap.size === 0) dossierPresence.delete(dossierId);
      }

      socket.to(`dossier:${dossierId}`).emit('user-left', { userId: user.userId });
    });

    // Fallback: used when Yjs collaboration is not available.
    // When Yjs is active, real-time sync happens via y-websocket.
    socket.on('node-update', (data: { dossierId: string; nodeId: string; content: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-updated', {
        nodeId: data.nodeId,
        content: data.content,
        userId: user.userId,
      });
    });

    // Fallback: used when Yjs collaboration is not available.
    // When Yjs is active, real-time sync happens via y-websocket.
    socket.on('excalidraw-update', (data: { dossierId: string; nodeId: string; elements: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('excalidraw-updated', {
        nodeId: data.nodeId,
        elements: data.elements,
        userId: user.userId,
      });
    });

    // Map marker events
    socket.on('map-marker-add', (data: { dossierId: string; nodeId: string; marker: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-marker-added', {
        nodeId: data.nodeId,
        marker: data.marker,
        userId: user.userId,
      });
    });

    socket.on('map-marker-update', (data: { dossierId: string; nodeId: string; marker: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-marker-updated', {
        nodeId: data.nodeId,
        marker: data.marker,
        userId: user.userId,
      });
    });

    socket.on('map-marker-delete', (data: { dossierId: string; nodeId: string; markerId: string }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-marker-deleted', {
        nodeId: data.nodeId,
        markerId: data.markerId,
        userId: user.userId,
      });
    });

    // Map drawing events
    socket.on('map-drawing-add', (data: { dossierId: string; nodeId: string; drawing: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-drawing-added', {
        nodeId: data.nodeId,
        drawing: data.drawing,
        userId: user.userId,
      });
    });

    socket.on('map-drawing-update', (data: { dossierId: string; nodeId: string; drawing: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-drawing-updated', {
        nodeId: data.nodeId,
        drawing: data.drawing,
        userId: user.userId,
      });
    });

    socket.on('map-drawing-delete', (data: { dossierId: string; nodeId: string; drawingId: string }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-drawing-deleted', {
        nodeId: data.nodeId,
        drawingId: data.drawingId,
        userId: user.userId,
      });
    });

    // Map entity events
    socket.on('map-entity-add', (data: { dossierId: string; nodeId: string; entity: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-entity-added', {
        nodeId: data.nodeId,
        entity: data.entity,
        userId: user.userId,
      });
    });

    socket.on('map-entity-update', (data: { dossierId: string; nodeId: string; entity: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-entity-updated', {
        nodeId: data.nodeId,
        entity: data.entity,
        userId: user.userId,
      });
    });

    socket.on('map-entity-delete', (data: { dossierId: string; nodeId: string; entityId: string }) => {
      socket.to(`dossier:${data.dossierId}`).emit('map-entity-deleted', {
        nodeId: data.nodeId,
        entityId: data.entityId,
        userId: user.userId,
      });
    });

    // Map presence events
    socket.on('map-presence-join', (data: { dossierId: string; nodeId: string; user: any }) => {
      // Store presence
      if (!mapPresence.has(data.nodeId)) mapPresence.set(data.nodeId, new Map());
      const nodePresence = mapPresence.get(data.nodeId)!;
      nodePresence.set(data.user.userId, data.user);

      // Send existing users to the joiner
      const existingUsers = Array.from(nodePresence.values()).filter(u => u.userId !== data.user.userId);
      if (existingUsers.length) {
        socket.emit('map-presence-list', { nodeId: data.nodeId, users: existingUsers });
      }

      // Broadcast join to others
      socket.to(`dossier:${data.dossierId}`).emit('map-presence-joined', {
        nodeId: data.nodeId,
        user: data.user,
      });
    });

    socket.on('map-presence-leave', (data: { dossierId: string; nodeId: string; userId: string }) => {
      // Remove from tracking
      const nodePresence = mapPresence.get(data.nodeId);
      if (nodePresence) {
        nodePresence.delete(data.userId);
        if (nodePresence.size === 0) mapPresence.delete(data.nodeId);
      }

      socket.to(`dossier:${data.dossierId}`).emit('map-presence-left', {
        nodeId: data.nodeId,
        userId: data.userId,
      });
    });

    socket.on('node-created', (data: { dossierId: string; node: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-added', data.node);
    });

    socket.on('node-deleted', (data: { dossierId: string; nodeId: string }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-removed', { nodeId: data.nodeId });
    });

    socket.on('disconnect', () => {
      console.log(`User ${user.userId} disconnected`);
      userSockets.get(user.userId)?.delete(socket.id);
      if (userSockets.get(user.userId)?.size === 0) userSockets.delete(user.userId);
      onlineUsers.delete(user.userId);
      io.to('admin-room').emit('online-count', onlineUsers.size);

      // Clean up map presence for this user
      for (const [nodeId, nodePresence] of mapPresence) {
        if (nodePresence.has(user.userId)) {
          nodePresence.delete(user.userId);
          if (nodePresence.size === 0) mapPresence.delete(nodeId);
        }
      }

      // Clean up dossier presence for this user
      for (const [dossierId, presenceMap] of dossierPresence) {
        if (presenceMap.has(user.userId)) {
          presenceMap.delete(user.userId);
          if (presenceMap.size === 0) dossierPresence.delete(dossierId);
          // Notify others in the dossier room
          io.to(`dossier:${dossierId}`).emit('user-left', { userId: user.userId });
        }
      }
    });
  });

  return io;
}
