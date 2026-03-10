<template>
  <div>
    <div
      class="nti-item"
      :class="{
        active: dossierStore.selectedNode?._id === node._id,
        'nti-drop-inside': dropPosition === 'inside',
        'nti-drop-before': dropPosition === 'before',
        'nti-drop-after': dropPosition === 'after',
      }"
      draggable="true"
      @dragstart="onDragStart"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="dossierStore.selectNode(node)"
      @contextmenu.prevent="showMenu = true"
    >
      <!-- Chevron pour les dossiers -->
      <button
        v-if="node.type === 'folder'"
        class="nti-chevron"
        @click.stop="expanded = !expanded"
      >
        <v-icon size="14">{{ expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </button>
      <span v-else class="nti-chevron-spacer" />

      <v-icon size="16" class="nti-icon">{{ icon }}</v-icon>
      <input
        v-if="renaming"
        ref="renameInputRef"
        v-model="renameValue"
        class="nti-rename-input"
        @keyup.enter="confirmRename"
        @keyup.escape="cancelRename"
        @blur="confirmRename"
        @click.stop
      />
      <span v-else class="nti-title" @dblclick.stop="startRename">{{ node.title }}</span>
      <EvidenceBadge v-if="node.fileHash" :file-hash="node.fileHash" :last-status="node.lastVerificationStatus" />

      <v-menu v-model="showMenu" location="end">
        <template #activator="{ props }">
          <button v-bind="props" class="nti-menu-btn" @click.stop>
            <v-icon size="14">mdi-dots-horizontal</v-icon>
          </button>
        </template>
        <div class="glass-card nti-context-menu">
          <button v-if="node.type === 'folder'" class="nti-ctx-item" @click="$emit('create', 'folder', node._id)">
            <v-icon size="14">mdi-folder-plus-outline</v-icon> Sous-dossier
          </button>
          <button v-if="node.type === 'folder'" class="nti-ctx-item" @click="$emit('create', 'note', node._id)">
            <v-icon size="14">mdi-note-plus-outline</v-icon> Note
          </button>
          <button v-if="node.type === 'folder'" class="nti-ctx-item" @click="$emit('create', 'mindmap', node._id)">
            <v-icon size="14">mdi-vector-polyline</v-icon> Mind map
          </button>
          <button v-if="node.type === 'folder'" class="nti-ctx-item" @click="$emit('create', 'map', node._id)">
            <v-icon size="14">mdi-map-outline</v-icon> Carte
          </button>
          <button v-if="node.type === 'folder'" class="nti-ctx-item" @click="$emit('create', 'dataset', node._id)">
            <v-icon size="14">mdi-table</v-icon> Dataset
          </button>
          <button class="nti-ctx-item" @click="showMenu = false; startRename()">
            <v-icon size="14">mdi-pencil-outline</v-icon> Renommer
          </button>
          <button class="nti-ctx-item" @click="showMenu = false; $emit('duplicate', node._id)">
            <v-icon size="14">mdi-content-copy</v-icon> Dupliquer
          </button>
          <button class="nti-ctx-item nti-ctx-danger" @click="handleDelete">
            <v-icon size="14">mdi-trash-can-outline</v-icon> Supprimer
          </button>
        </div>
      </v-menu>
    </div>

    <div v-if="node.type === 'folder' && expanded && children.length" class="nti-children">
      <NodeTreeItem
        v-for="child in children"
        :key="child._id"
        :node="child"
        :all-nodes="allNodes"
        @create="(type, parentId) => $emit('create', type, parentId)"
        @duplicate="(nodeId) => $emit('duplicate', nodeId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import api from '../../services/api';
import type { DossierNode } from '../../types';
import EvidenceBadge from '../evidence/EvidenceBadge.vue';

const props = defineProps<{ node: DossierNode; allNodes: DossierNode[] }>();
defineEmits<{ create: [type: string, parentId: string]; duplicate: [nodeId: string] }>();

const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const showMenu = ref(false);
const dropPosition = ref<'before' | 'after' | 'inside' | null>(null);
const expanded = ref(true);

// Inline rename
const renaming = ref(false);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRename() {
  renaming.value = true;
  renameValue.value = props.node.title;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

async function confirmRename() {
  if (!renaming.value) return;
  renaming.value = false;
  const trimmed = renameValue.value.trim();
  if (!trimmed || trimmed === props.node.title) return;
  await dossierStore.updateNode(props.node._id, { title: trimmed });
}

function cancelRename() {
  renaming.value = false;
}

const icon = computed(() => {
  if (props.node.type === 'folder') {
    return expanded.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline';
  }
  switch (props.node.type) {
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'map': return 'mdi-map-outline';
    case 'document': return 'mdi-file-document-outline';
    case 'dataset': return 'mdi-table';
    default: return 'mdi-file-outline';
  }
});

const children = computed(() =>
  props.allNodes.filter(n => n.parentId === props.node._id).sort((a, b) => a.order - b.order)
);

async function handleDelete() {
  const ok = await confirm({
    title: 'Supprimer',
    message: `Envoyer "${props.node.title}" dans la corbeille ?`,
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (ok) dossierStore.deleteNode(props.node._id);
}

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.node._id);
}

function onDragOver(e: DragEvent) {
  const el = (e.currentTarget as HTMLElement);
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;

  if (props.node.type === 'folder' && ratio > 0.25 && ratio < 0.75) {
    dropPosition.value = 'inside';
  } else if (ratio <= 0.5) {
    dropPosition.value = 'before';
  } else {
    dropPosition.value = 'after';
  }
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  const related = e.relatedTarget as HTMLElement | null;
  // Only reset if we're truly leaving the item, not moving to a child element
  if (!related || !el.contains(related)) {
    dropPosition.value = null;
  }
}

function getSiblings(parentId: string | null) {
  return dossierStore.nodes
    .filter(n => n.parentId === parentId && !n.deletedAt)
    .sort((a, b) => a.order - b.order);
}

function isDescendant(nodeId: string, potentialParentId: string): boolean {
  let current = potentialParentId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) return false;
    visited.add(current);
    if (current === nodeId) return true;
    const parent = props.allNodes.find(n => n._id === current);
    current = parent?.parentId || '';
  }
  return false;
}

async function onDrop(e: DragEvent) {
  e.stopPropagation();
  const pos = dropPosition.value;
  dropPosition.value = null;
  const draggedId = e.dataTransfer?.getData('text/plain');
  if (!draggedId || draggedId === props.node._id || !pos) return;

  // Prevent dropping a folder into its own descendant
  if (pos === 'inside' && isDescendant(draggedId, props.node._id)) return;

  try {
    if (pos === 'inside' && props.node.type === 'folder') {
      await api.patch(`/nodes/${draggedId}/move`, {
        parentId: props.node._id,
        order: children.value.length,
      });
    } else {
      const targetParentId = props.node.parentId;
      const siblings = getSiblings(targetParentId);
      const targetIndex = siblings.findIndex(n => n._id === props.node._id);
      const insertIndex = pos === 'before' ? targetIndex : targetIndex + 1;

      await api.patch(`/nodes/${draggedId}/move`, {
        parentId: targetParentId,
        order: insertIndex,
      });
    }

    // Refetch all nodes to ensure consistent state
    if (dossierStore.currentDossier) {
      const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/nodes`);
      dossierStore.nodes = data;
    }
  } catch (err) {
    console.error('Move failed:', err);
  }
}
</script>

<style scoped>
.nti-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  gap: 6px;
  position: relative;
}
.nti-item:hover {
  background: var(--me-accent-glow);
}
.nti-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.nti-item.active .nti-icon {
  color: var(--me-accent);
}
.nti-item.active .nti-title {
  color: var(--me-accent);
  font-weight: 600;
}
.nti-chevron {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}
.nti-chevron:hover {
  background: var(--me-bg-elevated);
  color: var(--me-text-primary);
}
.nti-chevron-spacer {
  width: 22px;
  flex-shrink: 0;
}
.nti-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.nti-title {
  flex: 1;
  font-size: 14px;
  color: var(--me-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nti-rename-input {
  flex: 1;
  font-size: 14px;
  color: var(--me-text-primary);
  background: var(--me-bg-surface);
  border: 1px solid var(--me-accent);
  border-radius: 4px;
  padding: 1px 6px;
  outline: none;
  min-width: 0;
  font-family: inherit;
}
.nti-item.active .nti-title {
  color: var(--me-accent);
}
.nti-item:hover .nti-title {
  color: var(--me-text-primary);
}
.nti-menu-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
}
.nti-item:hover .nti-menu-btn {
  opacity: 1;
}
.nti-menu-btn:hover {
  background: var(--me-bg-elevated);
  color: var(--me-text-primary);
}
.nti-children {
  margin-left: 14px;
  border-left: 1px solid var(--me-border);
  padding-left: 6px;
}
.nti-drop-inside {
  outline: 2px dashed var(--me-accent);
  outline-offset: -2px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.06);
}
.nti-drop-before {
  box-shadow: inset 0 2px 0 0 var(--me-accent);
}
.nti-drop-after {
  box-shadow: inset 0 -2px 0 0 var(--me-accent);
}
.nti-context-menu {
  padding: 6px;
  min-width: 180px;
}
.nti-ctx-item {
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
.nti-ctx-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.nti-ctx-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
</style>
