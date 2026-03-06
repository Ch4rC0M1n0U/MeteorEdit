<template>
  <div class="mindmap-outer">
    <div class="mindmap-toolbar">
      <button class="mm-tb-btn" @click="addNode">
        <v-icon size="16">mdi-plus</v-icon>
        <span class="mono">Ajouter</span>
      </button>
      <button class="mm-tb-btn" @click="removeSelected" :disabled="!selectedNodeId">
        <v-icon size="16">mdi-delete-outline</v-icon>
        <span class="mono">Supprimer</span>
      </button>
      <button class="mm-tb-btn" @click="autoLayout">
        <v-icon size="16">mdi-auto-fix</v-icon>
        <span class="mono">Organiser</span>
      </button>
      <div v-if="awarenessUsers.length" class="collab-presence">
        <span v-for="u in awarenessUsers" :key="u.name" class="collab-user" :style="{ background: u.color }" :title="u.name">
          {{ u.initials }}
        </span>
      </div>
    </div>
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
      :min-zoom="0.2"
      :max-zoom="4"
      fit-view-on-init
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @node-double-click="onNodeDoubleClick"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <Background />
      <Controls />
      <template #node-mindmap="{ data, id }">
        <div
          class="mm-node"
          :class="{ 'mm-node-root': data.isRoot, 'mm-node-editing': editingNodeId === id }"
          :style="{ borderColor: data.color || 'var(--me-accent)' }"
        >
          <input
            v-if="editingNodeId === id"
            ref="editInputRef"
            v-model="editingLabel"
            class="mm-node-input"
            @blur="finishEdit(id)"
            @keydown.enter="finishEdit(id)"
            @keydown.escape="cancelEdit"
          />
          <span v-else class="mm-node-label">{{ data.label }}</span>
        </div>
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';

import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@vue-flow/core';

interface MindmapData {
  nodes: Node[];
  edges: Edge[];
}

const props = defineProps<{ data: any; nodeId: string }>();
const emit = defineEmits<{ 'update:data': [value: MindmapData] }>();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const selectedNodeId = ref<string | null>(null);
const editingNodeId = ref<string | null>(null);
const editingLabel = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);
const awarenessUsers = ref<Array<{ name: string; color: string; initials: string }>>([]);

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastData: MindmapData | null = null;
let suppressYjsSync = false;

// Yjs
let ydoc: Y.Doc | null = null;
let provider: WebsocketProvider | null = null;
let yMap: Y.Map<any> | null = null;

const authStore = useAuthStore();

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

const userName = authStore.user ? `${authStore.user.firstName} ${authStore.user.lastName}` : 'Anonyme';
const userColor = hashColor(authStore.user?.id || 'default');

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateId(): string {
  return crypto.randomUUID();
}

function initFromData(data: any) {
  if (data?.nodes?.length) {
    nodes.value = data.nodes.map((n: any) => ({
      ...n,
      type: n.type || 'mindmap',
    }));
    edges.value = data.edges || [];
  } else {
    // Default: create a root node
    const rootId = generateId();
    nodes.value = [{
      id: rootId,
      type: 'mindmap',
      position: { x: 300, y: 200 },
      data: { label: 'Idee centrale', isRoot: true, color: '#4f46e5' },
    }];
    edges.value = [];
  }
}

function getData(): MindmapData {
  return {
    nodes: nodes.value.map(n => ({ ...n })),
    edges: edges.value.map(e => ({ ...e })),
  };
}

function emitAndSave() {
  const data = getData();
  emit('update:data', data);
  scheduleSave(data);
  syncToYjs(data);
}

function onNodesChange(changes: NodeChange[]) {
  // Vue Flow applies changes automatically
  // We just need to emit/save after position changes
  const hasPositionChange = changes.some((c: any) => c.type === 'position' && c.dragging === false);
  const hasDimensionChange = changes.some((c: any) => c.type === 'dimensions');
  const hasRemove = changes.some((c: any) => c.type === 'remove');
  if (hasPositionChange || hasRemove || hasDimensionChange) {
    emitAndSave();
  }
}

function onEdgesChange(_changes: EdgeChange[]) {
  emitAndSave();
}

function onConnect(connection: Connection) {
  const edgeId = `e-${connection.source}-${connection.target}`;
  edges.value.push({
    id: edgeId,
    source: connection.source,
    target: connection.target,
    type: 'smoothstep',
    animated: true,
    style: { stroke: 'var(--me-accent)', strokeWidth: 2 },
  });
  emitAndSave();
}

function addNode() {
  const id = generateId();
  const parentId = selectedNodeId.value;
  const color = getRandomColor();

  let x = 300 + Math.random() * 200;
  let y = 200 + Math.random() * 200;

  if (parentId) {
    const parent = nodes.value.find(n => n.id === parentId);
    if (parent) {
      const childCount = edges.value.filter(e => e.source === parentId).length;
      x = parent.position.x + 250;
      y = parent.position.y + (childCount * 100) - 50;
    }
  }

  nodes.value.push({
    id,
    type: 'mindmap',
    position: { x, y },
    data: { label: 'Nouveau noeud', isRoot: false, color },
  });

  if (parentId) {
    edges.value.push({
      id: `e-${parentId}-${id}`,
      source: parentId,
      target: id,
      type: 'smoothstep',
      animated: true,
      style: { stroke: color, strokeWidth: 2 },
    });
  }

  emitAndSave();
}

function removeSelected() {
  if (!selectedNodeId.value) return;
  const id = selectedNodeId.value;
  const node = nodes.value.find(n => n.id === id);
  if (node?.data?.isRoot) return; // Don't delete root

  nodes.value = nodes.value.filter(n => n.id !== id);
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id);
  selectedNodeId.value = null;
  emitAndSave();
}

function autoLayout() {
  // Simple tree layout from root
  const rootNode = nodes.value.find(n => n.data?.isRoot);
  if (!rootNode) return;

  const visited = new Set<string>();
  const hGap = 250;
  const vGap = 80;

  function layoutSubtree(nodeId: string, x: number, y: number): number {
    visited.add(nodeId);
    const children = edges.value
      .filter(e => e.source === nodeId && !visited.has(e.target))
      .map(e => e.target);

    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) return y;

    if (children.length === 0) {
      node.position = { x, y };
      return y + vGap;
    }

    let currentY = y;
    for (const childId of children) {
      currentY = layoutSubtree(childId, x + hGap, currentY);
    }

    const midY = (y + currentY - vGap) / 2;
    node.position = { x, y: midY };
    return currentY;
  }

  layoutSubtree(rootNode.id, 50, 50);

  // Handle orphan nodes (not connected to root)
  let orphanY = 50;
  for (const n of nodes.value) {
    if (!visited.has(n.id)) {
      n.position = { x: 600, y: orphanY };
      orphanY += vGap;
    }
  }

  emitAndSave();
}

function onNodeDoubleClick({ node }: { node: Node }) {
  editingNodeId.value = node.id;
  editingLabel.value = node.data.label;
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
}

function finishEdit(nodeId: string) {
  const node = nodes.value.find(n => n.id === nodeId);
  if (node && editingLabel.value.trim()) {
    node.data = { ...node.data, label: editingLabel.value.trim() };
  }
  editingNodeId.value = null;
  emitAndSave();
}

function cancelEdit() {
  editingNodeId.value = null;
}

function onPaneClick() {
  selectedNodeId.value = null;
}

function onNodeClick({ node }: { node: Node }) {
  selectedNodeId.value = node.id;
}

// --- Persistence ---

function scheduleSave(data: MindmapData) {
  lastData = data;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (lastData) {
      api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
      lastData = null;
    }
    saveTimeout = null;
  }, 5000);
}

function flushSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (lastData) {
    api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
    lastData = null;
  }
}

// --- Yjs collaboration ---

function setupYjs() {
  cleanupYjs();

  ydoc = new Y.Doc();
  const yjsUrl = import.meta.env.VITE_YJS_URL || 'ws://localhost:3002';
  const token = localStorage.getItem('accessToken') || '';
  provider = new WebsocketProvider(yjsUrl, `node:${props.nodeId}`, ydoc, {
    params: { token },
  });
  yMap = ydoc.getMap('mindmap-data');

  // Awareness
  provider.awareness.setLocalStateField('user', { name: userName, color: userColor });
  provider.awareness.on('change', () => {
    if (!provider) return;
    const states = Array.from(provider.awareness.getStates().values());
    awarenessUsers.value = states
      .filter((s: any) => s.user && s.user.name !== userName)
      .map((s: any) => ({
        name: s.user.name,
        color: s.user.color,
        initials: s.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      }));
  });

  // Remote changes -> update local
  yMap.observe((_event: any, transaction: Y.Transaction) => {
    if (transaction.local) return;
    if (!yMap) return;
    const remoteNodes = yMap.get('nodes');
    const remoteEdges = yMap.get('edges');
    if (remoteNodes) {
      suppressYjsSync = true;
      nodes.value = remoteNodes;
      edges.value = remoteEdges || [];
      suppressYjsSync = false;
    }
  });

  // Initial sync
  provider.on('sync', (isSynced: boolean) => {
    if (!isSynced || !yMap) return;
    const existingNodes = yMap.get('nodes');
    if (!existingNodes && nodes.value.length) {
      // Push local data to Yjs
      ydoc!.transact(() => {
        yMap!.set('nodes', JSON.parse(JSON.stringify(nodes.value)));
        yMap!.set('edges', JSON.parse(JSON.stringify(edges.value)));
      });
    } else if (existingNodes) {
      // Apply remote data
      suppressYjsSync = true;
      nodes.value = existingNodes;
      edges.value = yMap.get('edges') || [];
      suppressYjsSync = false;
    }
  });
}

function syncToYjs(data: MindmapData) {
  if (suppressYjsSync || !yMap || !ydoc) return;
  ydoc.transact(() => {
    yMap!.set('nodes', JSON.parse(JSON.stringify(data.nodes)));
    yMap!.set('edges', JSON.parse(JSON.stringify(data.edges)));
  });
}

function cleanupYjs() {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (ydoc) {
    ydoc.destroy();
    ydoc = null;
  }
  yMap = null;
  awarenessUsers.value = [];
}

// --- Lifecycle ---

onMounted(() => {
  initFromData(props.data);
  setupYjs();
});

watch(() => props.nodeId, () => {
  flushSave();
  cleanupYjs();
  initFromData(props.data);
  setupYjs();
});

onBeforeUnmount(() => {
  flushSave();
  cleanupYjs();
});
</script>

<style>
.mindmap-outer {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.mindmap-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--me-bg-surface);
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
  z-index: 10;
}

.mm-tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.mm-tb-btn:hover:not(:disabled) {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.mm-tb-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mm-node {
  padding: 10px 20px;
  border-radius: 12px;
  background: var(--me-bg-surface, #fff);
  border: 2px solid var(--me-accent);
  min-width: 120px;
  text-align: center;
  font-size: 13px;
  color: var(--me-text-primary, #222);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.15s, border-color 0.15s;
  cursor: grab;
}
.mm-node:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.mm-node-root {
  font-weight: 700;
  font-size: 15px;
  padding: 14px 28px;
  border-width: 3px;
}
.mm-node-editing {
  padding: 6px 8px;
}
.mm-node-label {
  user-select: none;
}
.mm-node-input {
  border: 1px solid var(--me-accent);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  background: var(--me-bg-base, #fff);
  color: var(--me-text-primary, #222);
  outline: none;
  width: 100%;
  min-width: 100px;
  text-align: center;
}

.collab-presence {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.collab-user {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--me-bg-surface);
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--me-font-mono);
  cursor: default;
}

/* Override Vue Flow defaults for dark theme */
.vue-flow {
  flex: 1;
  min-height: 0;
}
.vue-flow__background {
  background: var(--me-bg-base, #fafafa);
}
</style>
