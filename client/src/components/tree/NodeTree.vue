<template>
  <div class="node-tree">
    <button
      class="nt-item"
      :class="{ active: !dossierStore.selectedNode }"
      @click="dossierStore.selectNode(null)"
    >
      <v-icon size="18">mdi-information-outline</v-icon>
      <span>{{ $t('tree.dossierInfo') }}</span>
    </button>

    <div class="nt-section-label">
      <span>{{ $t('tree.content') }}</span>
    </div>

    <div
      class="nt-root-drop"
      :class="{ 'nt-root-drop-active': rootDropActive }"
      @dragover.prevent
      @dragenter.prevent="onRootDragEnter"
      @dragleave="onRootDragLeave"
      @drop="onRootDrop"
    >
      <template v-if="flattenedNodes.length <= 200">
        <NodeTreeItem
          v-for="item in flattenedNodes"
          :key="item.id"
          :node="item.node"
          :all-nodes="dossierStore.nodes"
          :depth="item.depth"
          :expanded="item.expanded"
          @toggle-expand="toggleExpanded"
          @create="(type, parentId) => $emit('create', type, parentId)"
          @duplicate="(nodeId) => $emit('duplicate', nodeId)"
        />
      </template>
      <RecycleScroller
        v-else
        :items="flattenedNodes"
        :item-size="34"
        key-field="id"
        class="nt-scroller"
        v-slot="{ item }"
      >
        <NodeTreeItem
          :node="item.node"
          :all-nodes="dossierStore.nodes"
          :depth="item.depth"
          :expanded="item.expanded"
          @toggle-expand="toggleExpanded"
          @create="(type, parentId) => $emit('create', type, parentId)"
          @duplicate="(nodeId) => $emit('duplicate', nodeId)"
        />
      </RecycleScroller>
    </div>

    <v-menu>
      <template #activator="{ props }">
        <button v-bind="props" class="nt-add-btn">
          <v-icon size="16" class="mr-1">mdi-plus</v-icon>
          <span class="mono">{{ $t('tree.add') }}</span>
        </button>
      </template>
      <div class="glass-card nt-add-menu">
        <button class="nt-add-option" @click="$emit('create', 'folder', null)">
          <v-icon size="16">mdi-folder-plus-outline</v-icon>
          <span>{{ $t('tree.folder') }}</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'note', null)">
          <v-icon size="16">mdi-note-plus-outline</v-icon>
          <span>{{ $t('tree.note') }}</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'mindmap', null)">
          <v-icon size="16">mdi-vector-polyline</v-icon>
          <span>{{ $t('tree.mindmap') }}</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'map', null)">
          <v-icon size="16">mdi-map-outline</v-icon>
          <span>{{ $t('tree.map') }}</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'dataset', null)">
          <v-icon size="16">mdi-table</v-icon>
          <span>{{ $t('tree.dataset') }}</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'media', null)">
          <v-icon size="16">mdi-play-circle-outline</v-icon>
          <span>{{ $t('tree.media') }}</span>
        </button>
      </div>
    </v-menu>

    <!-- Corbeille -->
    <div class="nt-section-label" style="margin-top: 8px;">
      <span>{{ $t('tree.others') }}</span>
    </div>

    <button class="nt-trash-header" @click="trashOpen = !trashOpen">
      <v-icon size="16">mdi-delete-outline</v-icon>
      <span>{{ $t('tree.trash') }}</span>
      <span v-if="trashRootNodes.length" class="nt-trash-badge">{{ trashRootNodes.length }}</span>
      <v-icon size="14" class="nt-trash-chevron">{{ trashOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
    </button>

    <div v-if="trashOpen && trashRootNodes.length" class="nt-trash-list">
      <div v-for="node in trashRootNodes" :key="node._id" class="nt-trash-item">
        <v-icon size="14" class="nt-trash-item-icon">{{ trashIcon(node.type) }}</v-icon>
        <span class="nt-trash-item-title">{{ node.title }}</span>
        <button class="nt-trash-action" @click="handleRestore(node._id)" :title="$t('common.restore')">
          <v-icon size="14">mdi-restore</v-icon>
        </button>
        <button class="nt-trash-action nt-trash-action-danger" @click="handlePurge(node._id, node.title)" :title="$t('tree.deletePermanently')">
          <v-icon size="14">mdi-delete-forever-outline</v-icon>
        </button>
      </div>
    </div>

    <div v-if="trashOpen && !trashRootNodes.length" class="nt-trash-empty">
      <span>{{ $t('tree.emptyTrash') }}</span>
    </div>

    <button
      v-if="trashOpen && trashRootNodes.length"
      class="nt-empty-trash-btn"
      @click="handleEmptyTrash"
    >
      <v-icon size="14" class="mr-1">mdi-delete-sweep-outline</v-icon>
      <span class="mono">{{ $t('tree.clearTrash') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import api from '../../services/api';
import NodeTreeItem from './NodeTreeItem.vue';
import type { DossierNode } from '../../types';

const { t } = useI18n();

const emit = defineEmits<{ create: [type: string, parentId: string | null]; duplicate: [nodeId: string]; fileDrop: [files: FileList, parentId: string | null] }>();

const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const trashOpen = ref(false);
const rootDropActive = ref(false);
const rootDragCounter = ref(0);

// Virtualization: flatten tree with expand/collapse state
const expandedIds = ref<Set<string>>(new Set());

watch(() => dossierStore.nodes, (newNodes) => {
  for (const n of newNodes) {
    if (n.type === 'folder' && !expandedIds.value.has(n._id)) {
      expandedIds.value.add(n._id);
    }
  }
}, { immediate: true });

function toggleExpanded(nodeId: string) {
  if (expandedIds.value.has(nodeId)) {
    expandedIds.value.delete(nodeId);
  } else {
    expandedIds.value.add(nodeId);
  }
}

interface FlatNode {
  id: string;
  node: DossierNode;
  depth: number;
  expanded: boolean;
}

const flattenedNodes = computed<FlatNode[]>(() => {
  const result: FlatNode[] = [];
  const nodesByParent = new Map<string | null, DossierNode[]>();

  for (const n of dossierStore.nodes) {
    const key = n.parentId || null;
    if (!nodesByParent.has(key)) nodesByParent.set(key, []);
    nodesByParent.get(key)!.push(n);
  }

  for (const [, children] of nodesByParent) {
    children.sort((a, b) => a.order - b.order);
  }

  function walk(parentId: string | null, depth: number) {
    const children = nodesByParent.get(parentId) || [];
    for (const child of children) {
      const expanded = expandedIds.value.has(child._id);
      result.push({ id: child._id, node: child, depth, expanded });
      if (child.type === 'folder' && expanded) {
        walk(child._id, depth + 1);
      }
    }
  }

  walk(null, 0);
  return result;
});

function onRootDragEnter() {
  rootDragCounter.value++;
  rootDropActive.value = true;
}
function onRootDragLeave() {
  rootDragCounter.value--;
  if (rootDragCounter.value <= 0) {
    rootDragCounter.value = 0;
    rootDropActive.value = false;
  }
}

// Global dragend to reset state when drag ends anywhere (including on children that stopPropagation)
function onGlobalDragEnd() {
  rootDragCounter.value = 0;
  rootDropActive.value = false;
}
onMounted(() => document.addEventListener('dragend', onGlobalDragEnd));
onUnmounted(() => document.removeEventListener('dragend', onGlobalDragEnd));

async function onRootDrop(e: DragEvent) {
  rootDragCounter.value = 0;
  rootDropActive.value = false;

  // Check for file drop from OS
  if (e.dataTransfer?.files?.length) {
    e.preventDefault();
    emit('fileDrop', e.dataTransfer.files, null);
    return;
  }

  const draggedId = e.dataTransfer?.getData('text/plain');
  if (!draggedId) return;
  const node = dossierStore.nodes.find(n => n._id === draggedId);
  if (!node || node.parentId === null) return;
  try {
    await api.patch(`/nodes/${draggedId}/move`, {
      parentId: null,
      order: rootNodes.value.length,
    });
    // Refetch all nodes
    if (dossierStore.currentDossier) {
      const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/nodes`);
      dossierStore.nodes = data;
    }
  } catch (err) {
    console.error('Root drop failed:', err);
  }
}

const rootNodes = computed(() =>
  dossierStore.nodes.filter(n => n.parentId === null).sort((a, b) => a.order - b.order)
);

// Only show top-level trashed nodes (those whose parent is not also in trash)
const trashRootNodes = computed(() => {
  const trashIds = new Set(dossierStore.trashNodes.map(n => n._id));
  return dossierStore.trashNodes.filter(n => !n.parentId || !trashIds.has(n.parentId));
});

function trashIcon(type: string) {
  switch (type) {
    case 'folder': return 'mdi-folder-outline';
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'map': return 'mdi-map-outline';
    case 'document': return 'mdi-file-document-outline';
    case 'dataset': return 'mdi-table';
    case 'media': return 'mdi-play-circle-outline';
    default: return 'mdi-file-outline';
  }
}

async function handleRestore(nodeId: string) {
  await dossierStore.restoreNode(nodeId);
}

async function handlePurge(nodeId: string, title: string) {
  const ok = await confirm({
    title: t('tree.permanentDelete'),
    message: t('tree.permanentDeleteConfirm', { title }),
    confirmText: t('common.delete'),
    variant: 'danger',
  });
  if (ok) await dossierStore.purgeNode(nodeId);
}

async function handleEmptyTrash() {
  const ok = await confirm({
    title: t('tree.clearTrash'),
    message: t('tree.clearTrashConfirmMessage'),
    confirmText: t('tree.clearTrashConfirmButton'),
    variant: 'danger',
  });
  if (ok) await dossierStore.emptyTrashAction();
}
</script>

<style scoped>
.node-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nt-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nt-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.nt-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}

/* Section labels */
.nt-section-label {
  padding: 12px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
}

.nt-root-drop {
  min-height: 20px;
}
.nt-scroller {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}
.nt-root-drop-active {
  outline: 2px dashed var(--me-accent);
  outline-offset: -2px;
  border-radius: 8px;
}
.nt-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  margin-top: 4px;
  border-radius: 8px;
  background: none;
  border: 1px dashed var(--me-border);
  color: var(--me-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nt-add-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.nt-add-menu {
  padding: 6px;
  min-width: 180px;
}
.nt-add-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nt-add-option:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}

/* Trash section */
.nt-trash-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nt-trash-header:hover {
  color: var(--me-text-secondary);
  background: rgba(248, 113, 113, 0.05);
}
.nt-trash-badge {
  background: rgba(248, 113, 113, 0.15);
  color: var(--me-error, #f87171);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  font-family: var(--me-font-mono);
}
.nt-trash-chevron {
  margin-left: auto;
  color: var(--me-text-muted);
}
.nt-trash-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
}
.nt-trash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.15s;
}
.nt-trash-item:hover {
  background: rgba(248, 113, 113, 0.05);
}
.nt-trash-item-icon {
  color: var(--me-text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}
.nt-trash-item-title {
  flex: 1;
  font-size: 13px;
  color: var(--me-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: line-through;
  opacity: 0.7;
}
.nt-trash-action {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}
.nt-trash-item:hover .nt-trash-action {
  opacity: 1;
}
.nt-trash-action:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.nt-trash-action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error, #f87171);
}
.nt-trash-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--me-text-muted);
  opacity: 0.5;
  text-align: center;
  font-style: italic;
}
.nt-empty-trash-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  border-radius: 8px;
  background: none;
  border: 1px dashed rgba(248, 113, 113, 0.3);
  color: var(--me-error, #f87171);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.7;
}
.nt-empty-trash-btn:hover {
  opacity: 1;
  background: rgba(248, 113, 113, 0.08);
  border-color: var(--me-error, #f87171);
}
</style>
