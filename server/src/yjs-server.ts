/**
 * Yjs WebSocket server for collaborative editing.
 *
 * Persistence strategy:
 * - Primary: LevelDB stores Yjs document updates (real-time, via y-websocket)
 * - Secondary: Clients save content to MongoDB API every 30s (for search indexing / API reads)
 * - MongoDB contentText field is updated on each API save for full-text search
 */
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import path from 'path';

// y-websocket utils is CommonJS
const ywsUtils = require('y-websocket/bin/utils');
const { setupWSConnection } = ywsUtils;

// Set up LevelDB persistence
import { LeveldbPersistence } from 'y-leveldb';

const persistencePath = path.join(__dirname, '..', 'yjs-docs');
const ldb = new LeveldbPersistence(persistencePath);

ywsUtils.setPersistence({
  bindState: async (docName: string, ydoc: any) => {
    const persistedYdoc = await ldb.getYDoc(docName);
    const newUpdates = ydoc.encodeStateAsUpdate();
    await ldb.storeUpdate(docName, newUpdates);
    const Y = require('yjs');
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    ydoc.on('update', (update: Uint8Array) => {
      ldb.storeUpdate(docName, update);
    });
  },
  writeState: async (_docName: string, _ydoc: any) => {
    // State is handled by the update listener in bindState
  },
});

export function startYjsServer(port: number = 3002) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Yjs WebSocket Server');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    const docName = url.pathname.slice(1) || 'default';
    setupWSConnection(ws, req, { docName });
  });

  server.listen(port, () => {
    console.log(`Yjs WebSocket server running on port ${port}`);
  });

  return server;
}
