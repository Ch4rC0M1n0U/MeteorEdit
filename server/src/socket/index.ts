import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const onlineUsers = new Set<string>();
let ioInstance: Server | null = null;
const userSockets = new Map<string, Set<string>>();

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

    socket.on('join-dossier', (dossierId: string) => {
      socket.join(`dossier:${dossierId}`);
      socket.to(`dossier:${dossierId}`).emit('user-joined', { userId: user.userId });
    });

    socket.on('leave-dossier', (dossierId: string) => {
      socket.leave(`dossier:${dossierId}`);
      socket.to(`dossier:${dossierId}`).emit('user-left', { userId: user.userId });
    });

    socket.on('node-update', (data: { dossierId: string; nodeId: string; content: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-updated', {
        nodeId: data.nodeId,
        content: data.content,
        userId: user.userId,
      });
    });

    socket.on('excalidraw-update', (data: { dossierId: string; nodeId: string; elements: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('excalidraw-updated', {
        nodeId: data.nodeId,
        elements: data.elements,
        userId: user.userId,
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
    });
  });

  return io;
}
