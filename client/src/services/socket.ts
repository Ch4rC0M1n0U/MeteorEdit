import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('accessToken');
  socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001', {
    auth: { token },
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
