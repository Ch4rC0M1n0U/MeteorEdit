<template>
  <div
    draggable="true"
    @dragstart="onDragStart"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    :class="{ 'nti-drop-target': isDragOver }"
  >
    <div
      class="nti-item"
      :class="{ active: dossierStore.selectedNode?._id === node._id }"
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
      <span class="nti-title">{{ node.title }}</span>

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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import api from '../../services/api';
import type { DossierNode } from '../../types';

const props = defineProps<{ node: DossierNode; allNodes: DossierNode[] }>();
defineEmits<{ create: [type: string, parentId: string] }>();

const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const showMenu = ref(false);
const isDragOver = ref(false);
const expanded = ref(true);

const icon = computed(() => {
  if (props.node.type === 'folder') {
    return expanded.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline';
  }
  switch (props.node.type) {
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'document': return 'mdi-file-document-outline';
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

function onDragOver() {
  if (props.node.type === 'folder') {
    isDragOver.value = true;
  }
}

function onDragLeave() {
  isDragOver.value = false;
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const draggedId = e.dataTransfer?.getData('text/plain');
  if (!draggedId || draggedId === props.node._id) return;
  if (props.node.type !== 'folder') return;

  try {
    const { data } = await api.patch(`/nodes/${draggedId}/move`, {
      parentId: props.node._id,
      order: children.value.length,
    });
    const idx = dossierStore.nodes.findIndex(n => n._id === draggedId);
    if (idx >= 0) {
      dossierStore.nodes[idx] = data;
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
  padding: 5px 6px;
  border-radius: var(--me-radius-xs);
  cursor: pointer;
  transition: all 0.15s;
  gap: 4px;
  position: relative;
}
.nti-item:hover {
  background: var(--me-accent-glow);
}
.nti-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-left: 2px solid var(--me-accent);
  padding-left: 4px;
}
.nti-item.active .nti-icon {
  color: var(--me-accent);
}
.nti-item.active .nti-title {
  color: var(--me-accent);
  font-weight: 600;
}
.nti-chevron {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}
.nti-chevron:hover {
  background: var(--me-bg-elevated);
  color: var(--me-text-primary);
}
.nti-chevron-spacer {
  width: 20px;
  flex-shrink: 0;
}
.nti-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.nti-title {
  flex: 1;
  font-size: 13px;
  color: var(--me-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: 2px;
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
  margin-left: 12px;
  border-left: 1px solid var(--me-border);
  padding-left: 4px;
}
.nti-drop-target {
  outline: 2px dashed var(--me-accent);
  outline-offset: -2px;
  border-radius: var(--me-radius-xs);
}
.nti-context-menu {
  padding: 6px;
  min-width: 160px;
}
.nti-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 12px;
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
