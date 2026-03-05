import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import type { Dossier, DossierNode } from '../types';

export const useDossierStore = defineStore('dossier', () => {
  const dossiers = ref<Dossier[]>([]);
  const currentDossier = ref<Dossier | null>(null);
  const nodes = ref<DossierNode[]>([]);
  const trashNodes = ref<DossierNode[]>([]);
  const selectedNode = ref<DossierNode | null>(null);
  const loading = ref(false);

  async function fetchDossiers() {
    loading.value = true;
    try {
      const { data } = await api.get<Dossier[]>('/dossiers');
      dossiers.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createDossier(dossierData: Partial<Dossier>) {
    const { data } = await api.post<Dossier>('/dossiers', dossierData);
    dossiers.value.unshift(data);
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
      currentDossier.value = dossierRes.data;
      nodes.value = nodesRes.data;
      trashNodes.value = trashRes.data;
      selectedNode.value = null;

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
  }

  function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.off('node-updated');
    socket.off('excalidraw-updated');
    socket.off('node-added');
    socket.off('node-removed');

    socket.on('node-updated', (data: { nodeId: string; content: any }) => {
      const idx = nodes.value.findIndex(n => n._id === data.nodeId);
      if (idx >= 0) {
        nodes.value[idx] = { ...nodes.value[idx], content: data.content };
      }
      if (selectedNode.value?._id === data.nodeId) {
        selectedNode.value = { ...selectedNode.value, content: data.content };
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
    const res = await api.put<Dossier>(`/dossiers/${id}`, data);
    currentDossier.value = res.data;
    const idx = dossiers.value.findIndex(d => d._id === id);
    if (idx >= 0) dossiers.value[idx] = res.data;
  }

  async function deleteDossier(id: string) {
    await api.delete(`/dossiers/${id}`);
    dossiers.value = dossiers.value.filter(d => d._id !== id);
    if (currentDossier.value?._id === id) closeDossier();
  }

  async function createNode(nodeData: Partial<DossierNode>) {
    const { data } = await api.post<DossierNode>(
      `/dossiers/${currentDossier.value!._id}/nodes`,
      nodeData
    );
    nodes.value.push(data);
    getSocket()?.emit('node-created', { dossierId: currentDossier.value!._id, node: data });
    return data;
  }

  async function updateNode(nodeId: string, nodeData: Partial<DossierNode>) {
    const { data } = await api.put<DossierNode>(`/nodes/${nodeId}`, nodeData);
    const idx = nodes.value.findIndex(n => n._id === nodeId);
    if (idx >= 0) nodes.value[idx] = data;
    if (selectedNode.value?._id === nodeId) selectedNode.value = data;
    return data;
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
    nodes.value.push(data);
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

  function selectNode(node: DossierNode | null) {
    selectedNode.value = node;
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
    fetchDossiers, createDossier, openDossier, closeDossier,
    updateDossier, deleteDossier,
    createNode, updateNode, deleteNode, selectNode,
    restoreNode, purgeNode, emptyTrashAction,
    emitNodeUpdate, emitExcalidrawUpdate,
  };
});
