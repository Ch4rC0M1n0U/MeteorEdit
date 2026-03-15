import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import type { Dossier, DossierNode } from '../types';
import { useEncryptionStore } from './encryption';

export const useDossierStore = defineStore('dossier', () => {
  const dossiers = ref<Dossier[]>([]);
  const currentDossier = ref<Dossier | null>(null);
  const nodes = ref<DossierNode[]>([]);
  const trashNodes = ref<DossierNode[]>([]);
  const selectedNode = ref<DossierNode | null>(null);
  const loading = ref(false);
  const favorites = ref<string[]>([]);
  const activeCollaborators = ref<{ userId: string; firstName: string; lastName: string; avatarPath: string | null; initials: string }[]>([]);
  const nodeContentCache = ref<Map<string, DossierNode>>(new Map());

  // Sensitive dossier fields that get encrypted
  const ENCRYPTED_DOSSIER_FIELDS = ['objectives', 'judicialFacts', 'description', 'entities'] as const;

  /**
   * Decrypt sensitive fields of a dossier if it's encrypted.
   */
  async function decryptDossierFields(dossier: Dossier): Promise<Dossier> {
    const encStore = useEncryptionStore();
    if (!encStore.isUnlocked) return dossier;
    try {
      const key = await encStore.getDossierKey(dossier._id);
      if (!key) return dossier;
      const result = { ...dossier };
      for (const field of ENCRYPTED_DOSSIER_FIELDS) {
        const val = (result as any)[field];
        // Only decrypt values with "ENC:" prefix (backward compat: plaintext is returned as-is)
        if (val && typeof val === 'string' && val.startsWith('ENC:')) {
          try {
            (result as any)[field] = await encStore.decryptForDossier(dossier._id, val.slice(4));
          } catch {
            // Decryption failed, leave as-is
          }
        }
      }
      return result;
    } catch {
      return dossier;
    }
  }

  /**
   * Encrypt sensitive fields of dossier data before sending to server.
   */
  async function encryptDossierFields(dossierId: string, data: Partial<Dossier>): Promise<Partial<Dossier>> {
    const encStore = useEncryptionStore();
    if (!encStore.isUnlocked) return data;
    try {
      const result = { ...data };
      for (const field of ENCRYPTED_DOSSIER_FIELDS) {
        if ((result as any)[field] !== undefined) {
          const val = (result as any)[field];
          // Don't re-encrypt already encrypted data
          if (typeof val === 'string' && val.startsWith('ENC:')) continue;
          const encrypted = await encStore.encryptForDossier(dossierId, val);
          (result as any)[field] = 'ENC:' + encrypted;
        }
      }
      return result;
    } catch {
      return data;
    }
  }

  /**
   * Decrypt node content if the parent dossier is encrypted.
   */
  async function decryptNodeContent(node: DossierNode, dossierId: string): Promise<DossierNode> {
    const encStore = useEncryptionStore();
    if (!encStore.isUnlocked) return node;
    try {
      const result = { ...node };
      if (result.content && typeof result.content === 'string' && (result.content as string).startsWith('ENC:')) {
        try {
          result.content = await encStore.decryptForDossier(dossierId, (result.content as string).slice(4));
        } catch { /* leave as-is */ }
      }
      if (result.excalidrawData && typeof result.excalidrawData === 'string' && (result.excalidrawData as string).startsWith('ENC:')) {
        try {
          result.excalidrawData = await encStore.decryptForDossier(dossierId, (result.excalidrawData as string).slice(4));
        } catch { /* leave as-is */ }
      }
      if (result.mapData && typeof result.mapData === 'string' && (result.mapData as string).startsWith('ENC:')) {
        try {
          result.mapData = await encStore.decryptForDossier(dossierId, (result.mapData as string).slice(4));
        } catch { /* leave as-is */ }
      }
      if (result.mediaData && typeof result.mediaData === 'string' && (result.mediaData as string).startsWith('ENC:')) {
        try {
          result.mediaData = await encStore.decryptForDossier(dossierId, (result.mediaData as string).slice(4));
        } catch { /* leave as-is */ }
      }
      return result;
    } catch {
      return node;
    }
  }

  /**
   * Encrypt node content before saving, if dossier is encrypted.
   */
  async function encryptNodeData(nodeData: Partial<DossierNode>, dossierId: string): Promise<Partial<DossierNode>> {
    const encStore = useEncryptionStore();
    if (!encStore.isUnlocked) return nodeData;
    try {
      const result = { ...nodeData };
      if (result.content !== undefined && result.content !== null) {
        if (!(typeof result.content === 'string' && (result.content as string).startsWith('ENC:'))) {
          const encrypted = await encStore.encryptForDossier(dossierId, result.content);
          result.content = 'ENC:' + encrypted;
        }
      }
      if (result.excalidrawData !== undefined && result.excalidrawData !== null) {
        if (!(typeof result.excalidrawData === 'string' && (result.excalidrawData as string).startsWith('ENC:'))) {
          const encrypted = await encStore.encryptForDossier(dossierId, result.excalidrawData);
          result.excalidrawData = 'ENC:' + encrypted;
        }
      }
      if (result.mapData !== undefined && result.mapData !== null) {
        if (!(typeof result.mapData === 'string' && (result.mapData as string).startsWith('ENC:'))) {
          const encrypted = await encStore.encryptForDossier(dossierId, result.mapData);
          result.mapData = 'ENC:' + encrypted;
        }
      }
      if (result.mediaData !== undefined && result.mediaData !== null) {
        if (!(typeof result.mediaData === 'string' && (result.mediaData as string).startsWith('ENC:'))) {
          const encrypted = await encStore.encryptForDossier(dossierId, result.mediaData);
          result.mediaData = 'ENC:' + encrypted;
        }
      }
      // Clear contentText for encrypted dossiers (can't search encrypted content server-side)
      if (result.content !== undefined) {
        result.contentText = null;
      }
      return result;
    } catch {
      return nodeData;
    }
  }

  async function fetchFavorites() {
    try {
      const { data } = await api.get('/auth/preferences');
      favorites.value = data.favorites || [];
    } catch {
      favorites.value = [];
    }
  }

  async function toggleFavorite(dossierId: string) {
    const idx = favorites.value.indexOf(dossierId);
    if (idx >= 0) {
      favorites.value.splice(idx, 1);
    } else {
      favorites.value.push(dossierId);
    }
    await api.put('/auth/preferences', { favorites: favorites.value });
  }

  function isFavorite(dossierId: string): boolean {
    return favorites.value.includes(dossierId);
  }

  const hasMoreDossiers = ref(true);
  const dossierPage = ref(1);

  async function fetchDossiers(reset = false) {
    loading.value = true;
    try {
      if (reset) {
        dossierPage.value = 1;
        dossiers.value = [];
        hasMoreDossiers.value = true;
      }
      const { data } = await api.get('/dossiers', {
        params: { page: dossierPage.value, limit: 20 },
      });
      // Support both old (array) and new (paginated) response formats
      if (Array.isArray(data)) {
        dossiers.value = data;
        hasMoreDossiers.value = false;
      } else {
        if (reset || dossierPage.value === 1) {
          dossiers.value = data.dossiers;
        } else {
          dossiers.value.push(...data.dossiers);
        }
        hasMoreDossiers.value = dossierPage.value < data.pagination.totalPages;
        dossierPage.value++;
      }
    } finally {
      loading.value = false;
    }
  }

  async function createDossier(dossierData: Partial<Dossier>) {
    const { data } = await api.post<Dossier>('/dossiers', dossierData);
    dossiers.value.unshift(data);

    // Auto-setup encryption for the new dossier
    const encStore = useEncryptionStore();
    if (encStore.isUnlocked) {
      await encStore.setupDossierEncryption(data._id);
    }

    return data;
  }

  async function openDossier(id: string) {
    loading.value = true;
    try {
      const [dossierRes, nodesRes, trashRes] = await Promise.all([
        api.get<Dossier>(`/dossiers/${id}`),
        api.get<DossierNode[]>(`/dossiers/${id}/nodes`),
        api.get<DossierNode[]>(`/dossiers/${id}/trash`),
      ]);

      // Ensure dossier encryption is set up (creates AES key if missing)
      const encStore = useEncryptionStore();
      if (encStore.isUnlocked) {
        const existingKey = await encStore.getDossierKey(id);
        if (!existingKey) {
          await encStore.setupDossierEncryption(id);
        }
      }

      currentDossier.value = await decryptDossierFields(dossierRes.data);
      // Nodes are now lightweight metadata (no content fields)
      nodes.value = nodesRes.data;
      trashNodes.value = trashRes.data;

      selectedNode.value = null;
      nodeContentCache.value.clear();

      const socket = connectSocket();
      socket.emit('join-dossier', id);
      setupSocketListeners();
    } finally {
      loading.value = false;
    }
  }

  async function closeDossier() {
    if (currentDossier.value) {
      const socket = getSocket();
      socket?.emit('leave-dossier', currentDossier.value._id);
    }
    currentDossier.value = null;
    nodes.value = [];
    trashNodes.value = [];
    selectedNode.value = null;
    activeCollaborators.value = [];
    nodeContentCache.value.clear();
  }

  function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.off('node-updated');
    socket.off('node-content-updated');
    socket.off('excalidraw-updated');
    socket.off('media-updated');
    socket.off('dossier-updated');
    socket.off('node-added');
    socket.off('node-removed');
    socket.off('dossier-presence-list');
    socket.off('user-joined');
    socket.off('user-left');

    // Dossier presence
    socket.on('dossier-presence-list', (data: { dossierId: string; users: any[] }) => {
      activeCollaborators.value = data.users;
    });

    socket.on('user-joined', (userData: { userId: string; firstName?: string; lastName?: string; avatarPath?: string | null; initials?: string }) => {
      if (!userData.firstName) return; // Skip unenriched events
      if (!activeCollaborators.value.find(u => u.userId === userData.userId)) {
        activeCollaborators.value.push(userData as any);
      }
    });

    socket.on('user-left', (data: { userId: string }) => {
      activeCollaborators.value = activeCollaborators.value.filter(u => u.userId !== data.userId);
    });

    socket.on('node-updated', (data: { nodeId: string; content: any }) => {
      nodeContentCache.value.delete(data.nodeId);
      const idx = nodes.value.findIndex(n => n._id === data.nodeId);
      if (idx >= 0) {
        nodes.value[idx] = { ...nodes.value[idx], content: data.content };
      }
      if (selectedNode.value?._id === data.nodeId) {
        selectedNode.value = { ...selectedNode.value, content: data.content };
      }
    });

    // Media data sync (annotations, captures) from another user
    socket.on('media-updated', async (data: { nodeId: string; mediaData: any }) => {
      // Decrypt mediaData if encrypted
      let mediaData = data.mediaData;
      if (currentDossier.value && typeof mediaData === 'string' && mediaData.startsWith('ENC:')) {
        try {
          const encStore = useEncryptionStore();
          mediaData = await encStore.decryptForDossier(currentDossier.value._id, mediaData.slice(4));
        } catch { /* leave as-is */ }
      }
      const idx = nodes.value.findIndex(n => n._id === data.nodeId);
      if (idx >= 0) {
        nodes.value[idx] = { ...nodes.value[idx], mediaData };
      }
      if (selectedNode.value?._id === data.nodeId) {
        selectedNode.value = { ...selectedNode.value, mediaData };
      }
    });

    // Dossier metadata sync (logo, title, etc.)
    socket.on('dossier-updated', (data: { dossier: any }) => {
      const updated = data.dossier;
      if (currentDossier.value?._id === updated._id) {
        currentDossier.value = { ...currentDossier.value, ...updated };
      }
      const idx = dossiers.value.findIndex(d => d._id === updated._id);
      if (idx >= 0) {
        dossiers.value[idx] = { ...dossiers.value[idx], ...updated };
      }
    });

    // Screenshot/background update from server (e.g. web clipper screenshot ready)
    socket.on('node-content-updated', (data: { nodeId: string; content: any; fileUrl?: string }) => {
      nodeContentCache.value.delete(data.nodeId);
      const idx = nodes.value.findIndex(n => n._id === data.nodeId);
      if (idx >= 0) {
        nodes.value[idx] = { ...nodes.value[idx], content: data.content, fileUrl: data.fileUrl };
      }
      if (selectedNode.value?._id === data.nodeId) {
        selectedNode.value = { ...selectedNode.value, content: data.content, fileUrl: data.fileUrl };
      }
    });

    socket.on('excalidraw-updated', (data: { nodeId: string; elements: any }) => {
      const idx = nodes.value.findIndex(n => n._id === data.nodeId);
      if (idx >= 0) {
        nodes.value[idx] = { ...nodes.value[idx], excalidrawData: data.elements };
      }
      if (selectedNode.value?._id === data.nodeId) {
        selectedNode.value = { ...selectedNode.value, excalidrawData: data.elements };
      }
    });

    socket.on('node-added', (node: DossierNode) => {
      if (!nodes.value.find(n => n._id === node._id)) {
        nodes.value.push(node);
      }
    });

    socket.on('node-removed', (data: { nodeId: string }) => {
      nodes.value = nodes.value.filter(n => n._id !== data.nodeId && n.parentId !== data.nodeId);
      if (selectedNode.value?._id === data.nodeId) selectedNode.value = null;
    });
  }

  async function updateDossier(id: string, data: Partial<Dossier>) {
    const encryptedData = await encryptDossierFields(id, data);
    const res = await api.put<Dossier>(`/dossiers/${id}`, encryptedData);
    // Decrypt the response for local state
    const decrypted = await decryptDossierFields(res.data);
    currentDossier.value = decrypted;
    const idx = dossiers.value.findIndex(d => d._id === id);
    if (idx >= 0) dossiers.value[idx] = decrypted;
  }

  async function deleteDossier(id: string) {
    await api.delete(`/dossiers/${id}`);
    dossiers.value = dossiers.value.filter(d => d._id !== id);
    if (currentDossier.value?._id === id) closeDossier();
  }

  async function createNode(nodeData: Partial<DossierNode>) {
    const dossierId = currentDossier.value!._id;
    const encryptedNodeData = await encryptNodeData(nodeData, dossierId);
    const { data } = await api.post<DossierNode>(
      `/dossiers/${dossierId}/nodes`,
      encryptedNodeData
    );
    // Decrypt for local state
    const decrypted = await decryptNodeContent(data, dossierId);
    nodes.value.push(decrypted);
    getSocket()?.emit('node-created', { dossierId, node: data });
    return decrypted;
  }

  async function updateNode(nodeId: string, nodeData: Partial<DossierNode>) {
    const dossierId = currentDossier.value?._id;
    const encryptedNodeData = dossierId
      ? await encryptNodeData(nodeData, dossierId)
      : nodeData;
    const { data } = await api.put<DossierNode>(`/nodes/${nodeId}`, encryptedNodeData);
    // Decrypt for local state
    const decrypted = dossierId
      ? await decryptNodeContent(data, dossierId)
      : data;
    const idx = nodes.value.findIndex(n => n._id === nodeId);
    if (idx >= 0) nodes.value[idx] = decrypted;
    nodeContentCache.value.set(nodeId, decrypted);
    if (selectedNode.value?._id === nodeId) selectedNode.value = decrypted;
    // Notify collaborators of mediaData changes via socket
    if (nodeData.mediaData && dossierId) {
      getSocket()?.emit('media-update', {
        dossierId,
        nodeId,
        mediaData: encryptedNodeData.mediaData,
      });
    }
    return decrypted;
  }

  async function deleteNode(nodeId: string) {
    await api.delete(`/nodes/${nodeId}`);
    // Move to trash locally: collect node + descendants
    const toTrash: DossierNode[] = [];
    function collect(id: string) {
      const node = nodes.value.find(n => n._id === id);
      if (node) toTrash.push({ ...node, deletedAt: new Date().toISOString() });
      nodes.value.filter(n => n.parentId === id).forEach(n => collect(n._id));
    }
    collect(nodeId);
    trashNodes.value.unshift(...toTrash);
    nodes.value = nodes.value.filter(n => !toTrash.find(t => t._id === n._id));
    if (selectedNode.value?._id === nodeId) selectedNode.value = null;
    getSocket()?.emit('node-deleted', { dossierId: currentDossier.value!._id, nodeId });
  }

  async function restoreNode(nodeId: string) {
    const { data } = await api.patch<DossierNode>(`/nodes/${nodeId}/restore`);
    // Remove from trash and add back to nodes
    const restored = trashNodes.value.filter(n => n._id === nodeId || n.parentId === nodeId);
    trashNodes.value = trashNodes.value.filter(n => !restored.find(r => r._id === n._id));

    const dossierId = currentDossier.value?._id;
    const decrypted = dossierId
      ? await decryptNodeContent(data, dossierId)
      : data;
    nodes.value.push(decrypted);

    // Also restore children from server
    if (currentDossier.value) {
      const { data: freshNodes } = await api.get<DossierNode[]>(`/dossiers/${currentDossier.value._id}/nodes`);
      nodes.value = freshNodes;
    }
  }

  async function purgeNode(nodeId: string) {
    await api.delete(`/nodes/${nodeId}/purge`);
    trashNodes.value = trashNodes.value.filter(n => n._id !== nodeId && n.parentId !== nodeId);
  }

  async function emptyTrashAction() {
    if (!currentDossier.value) return;
    await api.delete(`/dossiers/${currentDossier.value._id}/trash`);
    trashNodes.value = [];
  }

  async function selectNode(node: DossierNode | null) {
    if (!node) {
      selectedNode.value = null;
      return;
    }

    // Check cache first
    const cached = nodeContentCache.value.get(node._id);
    if (cached) {
      selectedNode.value = cached;
      api.post(`/nodes/${node._id}/view`).catch(() => {});
      return;
    }

    // Fetch full node content
    try {
      const { data } = await api.get<DossierNode>(`/nodes/${node._id}`);
      const dossierId = currentDossier.value?._id;
      const fullNode = dossierId
        ? await decryptNodeContent(data, dossierId)
        : data;

      // Update cache and selected node
      nodeContentCache.value.set(node._id, fullNode);
      selectedNode.value = fullNode;

      // Also update the node in the nodes array with full data
      const idx = nodes.value.findIndex(n => n._id === node._id);
      if (idx >= 0) nodes.value[idx] = fullNode;
    } catch {
      // Fallback to lightweight node
      selectedNode.value = node;
    }

    api.post(`/nodes/${node._id}/view`).catch(() => {});
  }

  // Fallback: used when Yjs collaboration is not available.
  // When Yjs is active, real-time sync happens via y-websocket.
  function emitNodeUpdate(nodeId: string, content: any) {
    if (currentDossier.value) {
      getSocket()?.emit('node-update', { dossierId: currentDossier.value._id, nodeId, content });
    }
  }

  // Fallback: used when Yjs collaboration is not available.
  // When Yjs is active, real-time sync happens via y-websocket.
  function emitExcalidrawUpdate(nodeId: string, elements: any) {
    if (currentDossier.value) {
      getSocket()?.emit('excalidraw-update', { dossierId: currentDossier.value._id, nodeId, elements });
    }
  }

  return {
    dossiers, currentDossier, nodes, trashNodes, selectedNode, loading,
    hasMoreDossiers, dossierPage,
    favorites, fetchFavorites, toggleFavorite, isFavorite, activeCollaborators, nodeContentCache,
    fetchDossiers, createDossier, openDossier, closeDossier,
    updateDossier, deleteDossier,
    createNode, updateNode, deleteNode, selectNode,
    restoreNode, purgeNode, emptyTrashAction,
    emitNodeUpdate, emitExcalidrawUpdate,
  };
});
