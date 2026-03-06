/**
 * Yjs WebSocket server for collaborative editing.
 * Implements the y-websocket protocol (y-protocols/sync + y-protocols/awareness).
 *
 * Persistence strategy:
 * - Primary: LevelDB stores Yjs document updates (real-time)
 * - Secondary: Clients save content to MongoDB API every 30s (for search indexing / API reads)
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import path from 'path';
import * as Y from 'yjs';
import { LeveldbPersistence } from 'y-leveldb';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;

const persistencePath = path.join(__dirname, '..', 'yjs-docs');
const ldb = new LeveldbPersistence(persistencePath);

interface DocEntry {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>; // ws -> set of controlled awareness client ids
}

const docs = new Map<string, DocEntry>();

async function getOrCreateDoc(docName: string): Promise<DocEntry> {
  const existing = docs.get(docName);
  if (existing) return existing;

  const doc = new Y.Doc();
  const persistedDoc = await ldb.getYDoc(docName);
  const persistedState = Y.encodeStateAsUpdate(persistedDoc);
  Y.applyUpdate(doc, persistedState);
  persistedDoc.destroy();

  doc.on('update', (update: Uint8Array, origin: any) => {
    ldb.storeUpdate(docName, update);
    // Broadcast update to all connected clients except the origin
    const entry = docs.get(docName);
    if (!entry) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    for (const [conn] of entry.conns) {
      if (conn !== origin && conn.readyState === WebSocket.OPEN) {
        conn.send(msg);
      }
    }
  });

  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);

  awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changedClients = added.concat(updated, removed);
    const entry = docs.get(docName);
    if (!entry) return;
    const awarenessMessage = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessMessage);
    const msg = encoding.toUint8Array(encoder);
    for (const [conn] of entry.conns) {
      if (conn.readyState === WebSocket.OPEN) {
        conn.send(msg);
      }
    }
  });

  const entry: DocEntry = { doc, awareness, conns: new Map() };
  docs.set(docName, entry);
  return entry;
}

function removeConn(docName: string, ws: WebSocket) {
  const entry = docs.get(docName);
  if (!entry) return;
  const controlledIds = entry.conns.get(ws);
  entry.conns.delete(ws);
  if (controlledIds) {
    awarenessProtocol.removeAwarenessStates(entry.awareness, Array.from(controlledIds), null);
  }
  if (entry.conns.size === 0) {
    entry.awareness.destroy();
    entry.doc.destroy();
    docs.delete(docName);
  }
}

function sendSyncStep1(ws: WebSocket, doc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
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
    const entry = await getOrCreateDoc(docName);
    entry.conns.set(ws, new Set());

    // Send sync step 1 to initiate sync protocol
    sendSyncStep1(ws, entry.doc);

    // Send current awareness states
    const awarenessStates = entry.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(
        entry.awareness,
        Array.from(awarenessStates.keys())
      ));
      ws.send(encoding.toUint8Array(encoder));
    }

    ws.on('message', (data: Buffer) => {
      try {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, entry.doc, ws);
            const reply = encoding.toUint8Array(encoder);
            // Only send if encoder has more than the message type
            if (encoding.length(encoder) > 1) {
              ws.send(reply);
            }
            break;
          }
          case messageAwareness: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(entry.awareness, update, ws);
            break;
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
