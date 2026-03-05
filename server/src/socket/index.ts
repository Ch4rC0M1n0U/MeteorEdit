import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Auth middleware
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

    // Join dossier room
    socket.on('join-dossier', (dossierId: string) => {
      socket.join(`dossier:${dossierId}`);
      socket.to(`dossier:${dossierId}`).emit('user-joined', { userId: user.userId });
    });

    // Leave dossier room
    socket.on('leave-dossier', (dossierId: string) => {
      socket.leave(`dossier:${dossierId}`);
      socket.to(`dossier:${dossierId}`).emit('user-left', { userId: user.userId });
    });

    // Node content update (notes)
    socket.on('node-update', (data: { dossierId: string; nodeId: string; content: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-updated', {
        nodeId: data.nodeId,
        content: data.content,
        userId: user.userId,
      });
    });

    // Excalidraw update
    socket.on('excalidraw-update', (data: { dossierId: string; nodeId: string; elements: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('excalidraw-updated', {
        nodeId: data.nodeId,
        elements: data.elements,
        userId: user.userId,
      });
    });

    // Node tree changes
    socket.on('node-created', (data: { dossierId: string; node: any }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-added', data.node);
    });

    socket.on('node-deleted', (data: { dossierId: string; nodeId: string }) => {
      socket.to(`dossier:${data.dossierId}`).emit('node-removed', { nodeId: data.nodeId });
    });

    socket.on('disconnect', () => {
      console.log(`User ${user.userId} disconnected`);
    });
  });

  return io;
}
