import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const onlineUsers = new Set<string>();

export function getOnlineUsers(): Set<string> {
  return onlineUsers;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

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
      onlineUsers.delete(user.userId);
      io.to('admin-room').emit('online-count', onlineUsers.size);
    });
  });

  return io;
}
