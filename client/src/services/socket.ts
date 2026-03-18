import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('accessToken');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const base = apiUrl.replace(/\/api$/, '');
  // Relative URL → use current origin for Socket.io
  const socketUrl = base.startsWith('/') || base === '' ? window.location.origin : base;
  socket = io(socketUrl, {
    auth: { token },
    rejectUnauthorized: false,
    transports: ['polling', 'websocket'],
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
