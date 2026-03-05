/**
 * Yjs WebSocket server for collaborative editing.
 *
 * Persistence strategy:
 * - Primary: LevelDB stores Yjs document updates (real-time)
 * - Secondary: Clients save content to MongoDB API every 30s (for search indexing / API reads)
 * - MongoDB contentText field is updated on each API save for full-text search
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import path from 'path';
import * as Y from 'yjs';
import { LeveldbPersistence } from 'y-leveldb';

const persistencePath = path.join(__dirname, '..', 'yjs-docs');
const ldb = new LeveldbPersistence(persistencePath);

// Track active documents: docName -> { doc, conns }
const docs = new Map<string, { doc: Y.Doc; conns: Set<WebSocket> }>();

async function getOrCreateDoc(docName: string): Promise<Y.Doc> {
  const existing = docs.get(docName);
  if (existing) return existing.doc;

  const doc = new Y.Doc();
  // Load persisted state
  const persistedDoc = await ldb.getYDoc(docName);
  const persistedState = Y.encodeStateAsUpdate(persistedDoc);
  Y.applyUpdate(doc, persistedState);
  persistedDoc.destroy();

  // Persist future updates
  doc.on('update', (update: Uint8Array) => {
    ldb.storeUpdate(docName, update);
  });

  docs.set(docName, { doc, conns: new Set() });
  return doc;
}

function removeConn(docName: string, ws: WebSocket) {
  const entry = docs.get(docName);
  if (!entry) return;
  entry.conns.delete(ws);
  if (entry.conns.size === 0) {
    // No more connections, clean up
    entry.doc.destroy();
    docs.delete(docName);
  }
}

export function startYjsServer(port: number = 3002) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Yjs WebSocket Server');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
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
    const doc = await getOrCreateDoc(docName);
    const entry = docs.get(docName)!;
    entry.conns.add(ws);

    // Send current state to new client
    const stateVector = Y.encodeStateVector(doc);
    const update = Y.encodeStateAsUpdate(doc);
    ws.send(Y.encodeStateAsUpdate(doc));

    // Handle incoming messages (Yjs updates from client)
    ws.on('message', (message: Buffer) => {
      try {
        const update = new Uint8Array(message);
        Y.applyUpdate(doc, update);
        // Broadcast to other clients
        for (const conn of entry.conns) {
          if (conn !== ws && conn.readyState === WebSocket.OPEN) {
            conn.send(message);
          }
        }
      } catch (err) {
        console.error('Yjs message error:', err);
      }
    });

    ws.on('close', () => {
      removeConn(docName, ws);
    });
  });

  server.listen(port, () => {
    console.log(`Yjs WebSocket server running on port ${port}`);
  });

  return server;
}
